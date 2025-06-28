import React, { useState, useEffect } from "react";
import NomineeManagement from "./NomineeManagement";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";
import { useCheckpoint, CheckpointStep } from '@/hooks/useCheckpoint'; // Adjust import path as needed
import { Button } from "../ui/button";

interface NomineeSelectionProps {
  onNext: () => void;
  initialData?: unknown;
  isCompleted?: boolean;
}

const NomineeSelection: React.FC<NomineeSelectionProps> = ({ 
  onNext, 
  initialData, 
  isCompleted 
}) => {
  const [showNomineeForm, setShowNomineeForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the checkpoint hook to check for existing nominee data
  const { 
    isStepCompleted,
    getStepData,
    refetchStep 
  } = useCheckpoint();

  // Check if nominees step is completed and if there are actual nominees
  useEffect(() => {
    if (isStepCompleted(CheckpointStep.ADD_NOMINEES)) {
      const nomineeData = getStepData(CheckpointStep.ADD_NOMINEES);
      
      // If there are actual nominees, show the nominee management form
      if (Array.isArray(nomineeData?.nominees) && nomineeData.nominees.length > 0) {
        setShowNomineeForm(true);
      }
      // If step is completed but no nominees, it was skipped - show initial selection
    }
  }, [isStepCompleted, getStepData]);

  // Also check initialData as fallback
  useEffect(() => {
    const data = initialData as { nominees?: unknown[] } | undefined;
    if (isCompleted) {
      if (data?.nominees && data.nominees.length > 0) {
        setShowNomineeForm(true);
      }
    }
  }, [isCompleted, initialData]);

  const handleSkip = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        setIsLoading(false);
        return;
      }

      // Send empty nominees array to backend
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "add_nominees",
          nominees: []
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (!response.data) {
        setError("Failed to skip nominees. Please try again.");
        return;
      }

      // Refetch the nominees step to update the hook
      refetchStep(CheckpointStep.ADD_NOMINEES);

      onNext();
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: { message?: string; error?: { message?: string } };
          status?: number;
        };
        request?: unknown;
      };

      console.error("Skip nominees error:", err);
      if (error.response) {
        if (error.response.data?.message) {
          setError(`Error: ${error.response.data.message}`);
        } else if (error.response.data?.error?.message) {
          setError(`Error: ${error.response.data.error.message}`);
        } else if (error.response.status === 400) {
          setError("Invalid request. Please try again.");
        } else if (error.response.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else if (error.response.status === 403) {
          setError("Access denied. Please check your authentication and try again.");
        } else if (error.response.status === 422) {
          setError("Unable to process request. Please try again.");
        } else {
          setError(`Server error (${error.response.status}). Please try again.`);
        }
      } else if (error.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNominees = () => {
    setShowNomineeForm(true);
  };

  // Check if step is completed and has actual nominees data
  const stepCompleted = isStepCompleted(CheckpointStep.ADD_NOMINEES);
  const nomineeData = getStepData(CheckpointStep.ADD_NOMINEES);
  const hasNominees = Array.isArray(nomineeData?.nominees) && nomineeData.nominees.length > 0;

  // If completed and has nominees, show the nominee management form
  if (stepCompleted && hasNominees && showNomineeForm) {
    return (
      <NomineeManagement 
        onNext={onNext} 
        initialData={nomineeData} 
        isCompleted={true} 
      />
    );
  }

  // If completed but no nominees (skipped), show skip confirmation
  if (stepCompleted && !hasNominees && !showNomineeForm) {
    return (
      <div className="max-w-2xl -mt-28 sm:mt-0 mx-auto">
        <FormHeading
          title={"Nominees Skipped"}
          description={"You have chosen to skip adding nominees. You can add them later from your account settings."}
        />

        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-yellow-800 font-medium">No nominees added</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Button
          variant='ghost'
            onClick={handleAddNominees}
            className="text-white py-3 px-2 rounded-md "
          >
            Add nominees now
          </Button>

          <button
            onClick={onNext}
            className="w-full bg-teal-800 text-white py-3 rounded font-medium hover:bg-teal-700 transition-colors"
          >
            Continue to Next Step
          </button>
        </div>
      </div>
    );
  }

  // Show nominee form if user clicked "Add nominees"
  if (showNomineeForm) {
    return (
      <NomineeManagement 
        onNext={onNext} 
        initialData={nomineeData || initialData} 
        isCompleted={Boolean(stepCompleted && hasNominees)} 
      />
    );
  }

  // Default: Show initial selection
  return (
    <div className="max-w-2xl -mt-28 sm:mt-0 mx-auto">
      <FormHeading
        title={"Nominees"}
        description={
          "You can add up to 5 nominee(s) to your account. Adding nominees makes the claim process simple in case of unforeseen events."
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Button
        variant='ghost'
          onClick={handleAddNominees}
          className="text-white py-6 px-2 rounded-md"
          disabled={isLoading}
        >
          Add nominee now (Recommended)
        </Button>

        <button
          onClick={handleSkip}
          disabled={isLoading}
          className={`w-full border border-gray-300 text-gray-700 py-3 rounded font-medium hover:bg-gray-50 transition-colors ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isLoading ? "Skipping..." : "Skip for now"}
        </button>
      </div>
    </div>
  );
};

export default NomineeSelection;