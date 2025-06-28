import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import { ChevronDown, Upload, Check } from "lucide-react";
import axios from "axios";
import Cookies from "js-cookie";
import { useCheckpoint, CheckpointStep } from "@/hooks/useCheckpoint";
import { toast } from "sonner";

interface UploadIncomeProofProps {
  onNext: (file?: File) => void;
  onSkip?: () => void;
  uid?: string | null; // UID from the income_proof initialization (optional for re-initialization)
}

// Global flag to track if completion toast has been shown in this session
let hasShownGlobalCompletedToast = false;

const UploadIncomeProof: React.FC<UploadIncomeProofProps> = ({ 
  onNext,
  onSkip,
  uid: initialUid 
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("Bank statement (last 6 months) with ₹10,000+ average balance.");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(initialUid || null);
  const [isIncomeProofCompleted, setIsIncomeProofCompleted] = useState(false);
  const [originalDocumentType, setOriginalDocumentType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { refetchStep } = useCheckpoint();

  // Check income proof status on component mount
  useEffect(() => {
    const checkIncomeProofStatus = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/income-proof`,
          {
            headers: {
              Authorization: `Bearer ${Cookies.get('authToken')}`
            }
          }
        );
        
        if (response.status === 200 && response.data?.data?.url) {
          setIsIncomeProofCompleted(true);
          
          // Set original document type if available in response
          if (response.data.data.income_proof_type) {
            const mappedType = mapApiToDisplayOption(response.data.data.income_proof_type);
            setSelectedOption(mappedType);
            setOriginalDocumentType(mappedType);
          }
          
          // Show completion toast only once per session
          if (!hasShownGlobalCompletedToast) {
            hasShownGlobalCompletedToast = true;
          }
        }
      } catch (error) {
        // If 204 or other error, income proof not uploaded yet
        console.log("Income proof not yet uploaded",error);
        setIsIncomeProofCompleted(false);
      }
    };
    
    checkIncomeProofStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setError("Please upload a PDF, JPG, JPEG, or PNG file.");
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError("File size must be less than 10MB.");
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        setError("Please upload a PDF, JPG, JPEG, or PNG file.");
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setError("File size must be less than 10MB.");
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Map frontend display options to backend API values
  const mapDocumentTypeToApi = (displayOption: string): string => {
    const mapping: Record<string, string> = {
      "Bank statement (last 6 months) with ₹10,000+ average balance.": "bank_statement_6m_10k",
      "Latest salary slip with ₹15,000+ gross monthly income.": "salary_slip_15k_monthly",
      "Latest Form 16 with ₹1,20,000+ annual income": "form_16_120k_annual",
      "Net worth certificate of ₹10,00,000+.": "net_worth_certificate_10l",
      "Latest demat statement with ₹10,000+ holdings.": "demat_statement_10k_holdings"
    };
    return mapping[displayOption] || "bank_statement_6m_10k";
  };

  // Map API values back to display options
  const mapApiToDisplayOption = (apiValue: string): string => {
    const mapping: Record<string, string> = {
      "bank_statement_6m_10k": "Bank statement (last 6 months) with ₹10,000+ average balance.",
      "salary_slip_15k_monthly": "Latest salary slip with ₹15,000+ gross monthly income.",
      "form_16_120k_annual": "Latest Form 16 with ₹1,20,000+ annual income",
      "net_worth_certificate_10l": "Net worth certificate of ₹10,00,000+.",
      "demat_statement_10k_holdings": "Latest demat statement with ₹10,000+ holdings."
    };
    return mapping[apiValue] || "Bank statement (last 6 months) with ₹10,000+ average balance.";
  };

  // Check if there are changes that require API call
  const hasChanges = () => {
    if (!isIncomeProofCompleted) return true; // Not completed yet, so needs API call
    if (selectedFile) return true; // New file selected
    if (selectedOption !== originalDocumentType) return true; // Document type changed
    return false; // No changes
  };

  // Initialize income proof with selected document type
  const initializeIncomeProof = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      const incomeProofType = mapDocumentTypeToApi(selectedOption);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "income_proof",
          income_proof_type: incomeProofType
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      if (!response.data?.data?.uid) {
        setError("Failed to initialize income proof. Please try again.");
        return null;
      }

      const newUid = response.data.data.uid;
      setUid(newUid);
      return newUid;
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: { message?: string; error?: { message?: string } };
          status?: number;
        };
        request?: unknown;
      };

      if (error.response) {
        if (error.response.data?.error?.message) {
          setError(`Initialization failed: ${error.response.data.error.message}`);
        } else if (error.response.data?.message) {
          setError(`Initialization failed: ${error.response.data.message}`);
        } else if (error.response.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else {
          setError(`Server error (${error.response.status}). Please try again.`);
        }
      } else if (error.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      return null;
    } finally {
      setIsInitializing(false);
    }
  };

  const handleUploadAndContinue = async () => {
    // If no changes and already completed, just proceed to next step
    if (!hasChanges() && isIncomeProofCompleted) {
      console.log("No changes detected, proceeding to next step");
      onNext();
      return;
    }

    if (!selectedFile && !isIncomeProofCompleted) {
      setError("Please select a file to upload.");
      return;
    }

    let currentUid = uid;

    // Initialize income proof if we don't have a UID or if document type changed
    if (!currentUid || selectedOption !== originalDocumentType) {
      currentUid = await initializeIncomeProof();
      if (!currentUid) {
        return; // Error already set in initializeIncomeProof
      }
    }

    // If file is selected, upload it
    if (selectedFile) {
      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('pdf', selectedFile);

        const response = await axios.put(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/income-proof/${currentUid}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${Cookies.get('authToken')}`
            }
          }
        );

        if (response.status === 201) {
          setIsIncomeProofCompleted(true);
          toast.success("Income proof uploaded successfully!");
          
          // Refetch the income proof status after a short delay
          setTimeout(() => {
            refetchStep(CheckpointStep.INCOME_PROOF);
            
            // Wait a bit longer before proceeding
            setTimeout(() => {
              onNext(selectedFile);
            }, 200);
          }, 200);
        } else {
          setError("Upload failed. Please try again.");
        }
      } catch (err: unknown) {
        const error = err as {
          response?: {
            data?: { message?: string; error?: { message?: string } };
            status?: number;
          };
          request?: unknown;
        };

        if (error.response) {
          if (error.response.data?.error?.message) {
            setError(`Upload failed: ${error.response.data.error.message}`);
          } else if (error.response.data?.message) {
            setError(`Upload failed: ${error.response.data.message}`);
          } else if (error.response.status === 401) {
            setError("Authentication failed. Please restart the process.");
          } else if (error.response.status === 422) {
            setError("Invalid file or upload error. Please try again.");
          } else {
            setError(`Server error (${error.response.status}). Please try again.`);
          }
        } else if (error.request) {
          setError("Network error. Please check your connection and try again.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } finally {
        setIsUploading(false);
      }
    } else {
      // No file selected but document type might have changed
      if (selectedOption !== originalDocumentType) {
        toast.success("Document type updated successfully!");
        setTimeout(() => {
          onNext();
        }, 200);
      } else {
        onNext();
      }
    }
  };

  const documentOptions = [
    "Bank statement (last 6 months) with ₹10,000+ average balance.",
    "Latest salary slip with ₹15,000+ gross monthly income.",
    "Latest Form 16 with ₹1,20,000+ annual income",
    "Net worth certificate of ₹10,00,000+.",
    "Latest demat statement with ₹10,000+ holdings."
  ];

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') {
      return (
        <div className="bg-red-100 text-red-800 rounded-full p-2 mb-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="10" y1="9" x2="8" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      );
    } else {
      return (
        <div className="bg-blue-100 text-blue-800 rounded-full p-2 mb-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
            <polyline points="21,15 16,10 5,21" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
      );
    }
  };

  const getButtonText = () => {
    if (isInitializing) return "Initializing...";
    if (isUploading) return "Uploading...";
    
    if (!hasChanges() && isIncomeProofCompleted) {
      return "Continue";
    }
    
    if (selectedFile) {
      return "Upload & Continue";
    }
    
    return "Continue";
  };

  const isProcessing = isUploading || isInitializing;

  return (
    <div className="w-full max-w-xl mx-auto mt-16">
      <FormHeading
        title="Upload Income Proof"
        description="A small step for you, a big leap towards seamless trading!"
      />


      <div className="mt-6 p-2 bg-[#F7F9FD] rounded">
        <div className="relative">
          <div
            className={`border rounded-md p-4 flex justify-between items-center cursor-pointer ${
              isIncomeProofCompleted ? 'border-green-600 bg-green-50' : ''
            }`}
            onClick={() => !isProcessing && setDropdownOpen(!dropdownOpen)}
          >
            <span className="w-[90%] text-center flex items-center justify-center">
              {selectedOption}
              {isIncomeProofCompleted && selectedOption === originalDocumentType && (
                <Check className="h-5 w-5 text-green-600 ml-2" />
              )}
            </span>
            <ChevronDown
              className={`h-5 w-5 transition-transform ${
                dropdownOpen ? "transform rotate-180" : ""
              } ${isProcessing ? "opacity-50" : ""}`}
            />
          </div>

          {dropdownOpen && !isProcessing && (
            <div className="absolute z-10 mt-1 bg-white border rounded-md shadow-lg w-full">
              {documentOptions.map((option, index) => (
                <div
                  key={index}
                  className={`p-3 text-center hover:bg-gray-100 cursor-pointer flex items-center justify-center ${
                    option === selectedOption ? 'bg-green-50' : ''
                  }`}
                  onClick={() => {
                    setSelectedOption(option);
                    setDropdownOpen(false);
                    // Reset UID when document type changes to force re-initialization
                    if (option !== selectedOption && uid) {
                      setUid(null);
                    }
                  }}
                >
                  <span>{option}</span>
                  {isIncomeProofCompleted && option === originalDocumentType && (
                    <Check className="h-4 w-4 text-green-600 ml-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-4 border-2 border-dashed bg-white border-gray-300 rounded-md p-6 text-center"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center">
              {getFileIcon(selectedFile.type)}
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setError(null);
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-800"
                disabled={isProcessing}
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-gray-600 mb-2">Drag and drop file here or</p>
              <button
                onClick={handleBrowseClick}
                className="text-blue-600 hover:text-blue-800 font-medium"
                disabled={isProcessing}
              >
                Choose file
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: PDF, JPG, JPEG, PNG (Max 10MB)
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}


      </div>

      <div className="flex gap-3 mt-4">
        {onSkip && (
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isProcessing}
            className="flex-1 py-6"
          >
            Skip for now
          </Button>
        )}
        
        <Button
          variant="ghost"
          onClick={handleUploadAndContinue}
          disabled={isProcessing || (!selectedFile && !isIncomeProofCompleted)}
          className={`${onSkip ? 'flex-1' : 'w-full'} py-6 ${
            (isProcessing || (!selectedFile && !isIncomeProofCompleted)) ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {getButtonText()}
        </Button>
      </div>

      <div className="text-center text-sm text-gray-600 mt-4">
        <p>
          Upload any of the above documents to verify your income eligibility for derivative trading.
        </p>
      
      </div>
    </div>
  );
};

export default UploadIncomeProof;