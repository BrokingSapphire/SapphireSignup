import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import { Check } from "lucide-react"; 
import RiskDisclosureModal from "../new-signup/RiskDisclosure";
import UploadIncomeProof from "./UploadIncomeProof";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { getApiEndpointByType } from "@/lib/utils";

interface InvestmentSegmentData {
  segments?: string[];
  [key: string]: unknown;
}

interface InvestmentSegmentProps {
  onNext: () => void;
  initialData?: InvestmentSegmentData;
  isCompleted?: boolean;
}


const InvestmentSegment: React.FC<InvestmentSegmentProps> = ({ 
  onNext, 
  initialData, 
  isCompleted 
}) => {
  const [selectedSegments, setSelectedSegments] = useState<string[]>(["Cash"]);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [hasAcceptedRisk, setHasAcceptedRisk] = useState(false);
  const [showUploadIncome, setShowUploadIncome] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [incomeProofUid, setIncomeProofUid] = useState<string | null>(null);
  const [isIncomeProofCompleted, setIsIncomeProofCompleted] = useState(false);

  const segments = [
    { id: "Cash", label: "Cash/Mutual Funds" },
    { id: "F&O", label: "F&O", requiresDisclosure: true },
    { id: "Debt", label: "Debt" },
    { id: "Currency", label: "Currency", requiresDisclosure: true },
    { id: "Commodity", label: "Commodity Derivatives", requiresDisclosure: true },
  ];

  // ✅ Fixed income proof type mapping
  const getDefaultIncomeProofType = () => {
    // Use the most common/recommended option as default
    return "bank_statement_6m_10k"; // Bank statement for 6 months with 10k balance
  };

  // Helper function to check if segments require income proof
  const getSegmentsRequiringProof = (segments: string[]) => {
    return segments.filter(segment => 
      segment === "F&O" || segment === "Currency" || segment === "Commodity"
    );
  };

  // Prefill data from initialData (API response) and show completion toast
  useEffect(() => {
    if (isCompleted && initialData && initialData.segments && initialData.segments.length > 0) {
      setSelectedSegments(initialData.segments);
      
    }
  }, [initialData, isCompleted]);

  // Check income proof status on component mount
  useEffect(() => {
    const checkIncomeProofStatus = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}${getApiEndpointByType('incomeProof')}`,
          {
            headers: {
              Authorization: `Bearer ${Cookies.get('authToken')}`,
            },
          }
        );
        
        if (response.status === 200 && response.data?.data?.url) {
          setIsIncomeProofCompleted(true);
        }
      } catch (error) {
        // If 204 or other error, income proof not uploaded yet
        console.warn(error);
        setIsIncomeProofCompleted(false);
      }
    };
    
    checkIncomeProofStatus();
  }, []);

  // Global Enter key handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        
        // If button is not disabled, trigger submit
        if (!isButtonDisabled()) {
          handleSubmitSegments();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedSegments, isLoading, hasAcceptedRisk]);

  const handleSegmentClick = (segmentId: string) => {
    if (segmentId === "Cash") return;

    // Just toggle the segment selection, don't show risk modal immediately
    toggleSegment(segmentId);
  };

  const toggleSegment = (segmentId: string) => {
    setSelectedSegments((prev) => {
      if (prev.includes(segmentId)) {
        return prev.filter((id) => id !== segmentId);
      }
      return [...prev, segmentId];
    });
  };

  const handleRiskAccept = () => {
    setHasAcceptedRisk(true);
    setShowRiskModal(false);
    
    // Continue with the submission after accepting risk
    handleSubmitSegmentsAfterRisk();
  };

  // Submit segments after risk acceptance
  const handleSubmitSegmentsAfterRisk = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}${getApiEndpointByType('checkpoint')}`,
        {
          step: "investment_segment",
          segments: selectedSegments,
        },
        {
          headers:{
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      // Check the response data structure
      if (!response.data) {
        toast.error("Failed to save investment segments. Please try again.");
        setIsLoading(false);
        return;
      }

      // Check if income proof is required from the server response
      const requiresIncomeProof = response.data.data?.requiresIncomeProof || false;
      const segmentsRequiringProof = response.data.data?.segmentsRequiringProof || [];

      if (requiresIncomeProof && segmentsRequiringProof.length > 0) {
        // Check if income proof is already uploaded
        if (isIncomeProofCompleted) {
          // toast.success("Investment segments saved successfully!");
          setTimeout(() => {
            onNext();
          }, 100);
        } else {
          // Need to upload income proof
          // toast.success("Investment segments saved! Income proof required for selected segments.");
          await handleInitializeIncomeProof();
        }
      } else {
        // toast.success("Investment segments saved successfully!");
        setTimeout(() => {
          onNext();
        }, 100);
      }
    } catch (err: unknown) {
      console.error("Error saving investment segments:", err);
      
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.data?.message) {
          toast.error(`Error: ${err.response.data.message}`);
        } else if (err.response.data?.error?.message) {
          toast.error(`Error: ${err.response.data.error.message}`);
        } else if (err.response.status === 400) {
          toast.error("Invalid investment segments. Please try again.");
        } else if (err.response.status === 401) {
          toast.error("Authentication failed. Please restart the process.");
        } else if (err.response.status === 403) {
          toast.error(err.response.data?.error?.message || "Please complete previous steps first.");
        } else if (err.response.status === 422) {
          toast.error("Invalid segment selection. Please try again.");
        } else {
          toast.error(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (axios.isAxiosError(err) && err.request) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Submit selected investment segments
  const handleSubmitSegments = async () => {
    // Check if any selected segments require risk disclosure
    const segmentsRequiringRisk = getSegmentsRequiringProof(selectedSegments);

    // If risk-requiring segments are selected but risk not accepted, show modal
    if (segmentsRequiringRisk.length > 0 && !hasAcceptedRisk) {
      setShowRiskModal(true);
      return;
    }

    // If risk already accepted or no risk segments, proceed directly
    await handleSubmitSegmentsAfterRisk();
  };

  // ✅ Fixed income proof initialization with correct type
  const handleInitializeIncomeProof = async () => {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}${getApiEndpointByType('checkpoint')}`,
        {
          step: "income_proof",
          income_proof_type: getDefaultIncomeProofType() // ✅ Use valid enum value
        },
        {
          headers:{
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      if (!response.data?.data?.uid) {
        toast.error("Failed to initialize income proof. Please try again.");
        if(response.data?.data == null) {
          toast.error("Empty data received from server. Please try again.");
        }
        return;
      }
      
      // Store the UID from backend response
      setIncomeProofUid(response.data.data.uid);
      setShowUploadIncome(true);
    } catch (err: unknown) {
      console.error("Error initializing income proof:", err);
      
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.data?.message) {
          toast.error(`Error: ${err.response.data.message}`);
        } else if (err.response.data?.error?.message) {
          toast.error(`Error: ${err.response.data.error.message}`);
        } else if (err.response.status === 401) {
          toast.error("Authentication failed. Please restart the process.");
        } else if (err.response.status === 422) {
          toast.error("Invalid income proof type. Please try again.");
        } else {
          toast.error(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (axios.isAxiosError(err) && err.request) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    }
  };

  // Handle upload income proof completion
  const handleIncomeProofNext = async () => {
    setIsIncomeProofCompleted(true);
    
    // Small delay to ensure state is updated
    setTimeout(() => {
      onNext();
    }, 500);
  };

  // Skip income proof upload
  const handleSkipIncomeProof = () => {
    onNext();
  };

  const getButtonText = () => {
    if (isLoading) return "Continue";
    
    // Check if any selected segments require risk disclosure
    const segmentsRequiringRisk = getSegmentsRequiringProof(selectedSegments);
    
    if (segmentsRequiringRisk.length > 0 && !hasAcceptedRisk) {
      return "Continue";
    }
    
    return "Continue";
  };

  const isButtonDisabled = () => {
    if (isLoading) return true;
    return selectedSegments.length === 0;
  };

  // If showing upload income proof, render that component
  if (showUploadIncome) {
    return (
      <UploadIncomeProof 
        onNext={handleIncomeProofNext} 
        onSkip={handleSkipIncomeProof}
        uid={incomeProofUid} // Pass the UID to UploadIncomeProof
      />
    );
  }

  // Always show the same UI - whether fresh or completed
  return (
    <div className="w-full -mt-28 sm:mt-0 max-w-2xl mx-auto p-4">
      <FormHeading 
        title="Choose your investment segment" 
        description="Choose where you want to invest and trade." 
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {segments.map((segment) => (
          <button
            key={segment.id}
            onClick={() => handleSegmentClick(segment.id)}
            disabled={isLoading}
            className={`px-4 py-2 border rounded flex items-center gap-5 transition-colors
              ${segment.id === "Cash" ? "cursor-default" : "cursor-pointer"}
              ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
              ${selectedSegments.includes(segment.id) ? "border-green-600 bg-green-50" : "border-gray-300 hover:border-green-600"}`}
          >
            <span className="whitespace-nowrap">{segment.label}</span>
            <div
              className={`h-6 w-6 flex items-center justify-center border-2 rounded-lg transition-colors
                ${selectedSegments.includes(segment.id) ? "border-green-600 bg-white" : "border-gray-400"}
              `}
            >
              {selectedSegments.includes(segment.id) && <Check className="h-4 w-4 text-green-600" />}
            </div>
          </button>
        ))}
      </div>

      <Button 
        onClick={handleSubmitSegments}
        disabled={isButtonDisabled()}
        variant="ghost" 
        className={`mt-6 w-full py-6 px-10 ${
          isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {getButtonText()}
      </Button>

      <div className="hidden lg:block text-center text-sm text-gray-600 space-y-3 mt-8">
        <p>
          If you choose the F&O, Currency, or Commodity Derivatives segment, you will be required to upload your income proof.
        </p>
      </div>

      {showRiskModal && (
        <RiskDisclosureModal
          onAccept={handleRiskAccept}
          onClose={() => {
            setShowRiskModal(false);
          }}
        />
      )}
    </div>
  );
};

export default InvestmentSegment;