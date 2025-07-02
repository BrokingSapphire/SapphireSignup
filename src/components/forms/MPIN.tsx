import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";

interface MPINProps {
  onNext: (clientId: string) => void;
  clientId?: string;
  initialData?: {
    mpin_already_set?: boolean;
    // Add other properties as needed based on API response
  };
  isCompleted?: boolean;
}

const MPIN: React.FC<MPINProps> = ({ 
  onNext, 
  clientId, 
  initialData, 
  isCompleted 
}) => {
  const [mpin, setMpin] = useState(["", "", "", ""]);
  const [confirmMpin, setConfirmMpin] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');

  const mpinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmMpinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Function to handle going back to enter step
  const handleEditMpin = () => {
    setStep('enter');
    setMpin(["", "", "", ""]);
    setConfirmMpin(["", "", "", ""]);
    setError(null);
    setTimeout(() => {
      mpinRefs.current[0]?.focus();
    }, 100);
  };

  // Memoize handleSubmit to prevent unnecessary re-renders and fix dependency issue
  const handleSubmit = useCallback(async () => {
    if (!clientId) {
      setError("Client ID not found. Please restart the process.");
      return;
    }

    const mpinString = mpin.join("");
    const confirmMpinString = confirmMpin.join("");

    if (mpinString.length !== 4) {
      setError("Please enter a 4-digit MPIN");
      return;
    }

    if (confirmMpinString.length !== 4) {
      setError("Please confirm your 4-digit MPIN");
      return;
    }

    if (mpinString !== confirmMpinString) {
      setError("MPIN and confirmation don't match. Please try again.");
      setStep('enter');
      setMpin(["", "", "", ""]);
      setConfirmMpin(["", "", "", ""]);
      setTimeout(() => {
        mpinRefs.current[0]?.focus();
      }, 100);
      return;
    }

    if (isCompleted) {
      onNext(clientId);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Set MPIN using checkpoint API
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/setup-mpin`,
        {
          mpin: mpinString,
          confirm_mpin: confirmMpinString
        },
        {
          headers:{
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      // If successful, proceed to next step with client ID
      onNext(clientId);
    } catch (err: unknown) {
      type AxiosErrorResponse = {
        response?: {
          data?: { message?: string; error?: { message?: string } };
          status?: number;
        };
        request?: unknown;
      };

      const error = err as AxiosErrorResponse;

      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof error.response === "object"
      ) {
        const response = error.response;
        if (response?.data?.message) {
          setError(`Error: ${response.data.message}`);
        } else if (response?.data?.error?.message) {
          setError(`Error: ${response.data.error.message}`);
        } else if (response?.status === 400) {
          setError("Invalid MPIN. Please try again.");
        } else if (response?.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else if (response?.status === 403) {
          setError("Please set password first.");
        } else if (response?.status === 422) {
          setError("MPIN validation failed. Please try again.");
        } else {
          setError(`Server error (${response?.status}). Please try again.`);
        }
      } else if (
        typeof err === "object" &&
        err !== null &&
        "request" in err
      ) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }

      // Reset form on error
      setStep('enter');
      setMpin(["", "", "", ""]);
      setConfirmMpin(["", "", "", ""]);
      setTimeout(() => {
        mpinRefs.current[0]?.focus();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  }, [clientId, mpin, confirmMpin, isCompleted, onNext]);

  // Prefill data from initialData (API response)
  useEffect(() => {
    if (isCompleted && initialData?.mpin_already_set) {
      // If MPIN is already set, proceed immediately
      if (clientId) {
        onNext(clientId);
      }
    }
  }, [initialData, isCompleted, clientId, onNext]);

  const handleMpinChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    if (!/^\d*$/.test(value)) return; // Only allow numbers

    const newMpin = [...mpin];
    newMpin[index] = value;
    setMpin(newMpin);
    setError(null);

    // Auto-focus next input
    if (value && index < 3) {
      mpinRefs.current[index + 1]?.focus();
    }

    // Move to confirm step when all 4 digits are entered
    if (newMpin.every(digit => digit !== "") && step === 'enter') {
      setStep('confirm');
      setTimeout(() => {
        confirmMpinRefs.current[0]?.focus();
      }, 100);
    }
  };

  const handleConfirmMpinChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    if (!/^\d*$/.test(value)) return; // Only allow numbers

    const newConfirmMpin = [...confirmMpin];
    newConfirmMpin[index] = value;
    setConfirmMpin(newConfirmMpin);
    setError(null);

    // Auto-focus next input
    if (value && index < 3) {
      confirmMpinRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 confirm digits are entered
    if (newConfirmMpin.every(digit => digit !== "")) {
      setTimeout(() => {
        handleSubmit();
      }, 200);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    isConfirm: boolean = false
  ) => {
    // Handle Enter key
    if (e.key === "Enter") {
      e.preventDefault();
      if (step === 'confirm' && isComplete() && !isLoading) {
        handleSubmit();
      }
      return;
    }

    if (e.key === "Backspace") {
      const currentMpin = isConfirm ? confirmMpin : mpin;
      const setCurrentMpin = isConfirm ? setConfirmMpin : setMpin;
      const refs = isConfirm ? confirmMpinRefs : mpinRefs;

      if (!currentMpin[index] && index > 0) {
        // Move to previous input if current is empty
        refs.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newMpin = [...currentMpin];
        newMpin[index] = "";
        setCurrentMpin(newMpin);
      }
    }
  };

  const isComplete = () => {
    return mpin.every(digit => digit !== "") && confirmMpin.every(digit => digit !== "");
  };

  // Show completed state
  if (isCompleted) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16 max-w-md">
        <FormHeading
          title="MPIN Set Successfully!"
          description="Your 4-digit MPIN has been configured for secure transactions."
        />

        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="text-green-800 font-medium">MPIN Set Successfully!</h3>
              <p className="text-green-700 text-sm">Your account is now ready for trading.</p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            if (clientId) {
              onNext(clientId);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (clientId) {
                onNext(clientId);
              }
            }
          }}
          variant="ghost"
          className="w-full py-6"
        >
          Complete Setup
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto -mt-28 sm:mt-16 max-w-md">
      <FormHeading
        title={step === 'enter' ? "Set Your MPIN" : "Confirm Your MPIN"}
        description={
          step === 'enter' 
            ? "Create a 4-digit MPIN for secure transactions"
            : "Re-enter your 4-digit MPIN to confirm"
        }
      />

      <div className="space-y-6">
        {/* MPIN Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-4 text-center">
            {step === 'enter' ? "Enter 4-digit MPIN" : "Confirm 4-digit MPIN"}
          </label>
          <div className="flex justify-center space-x-4">
            {(step === 'enter' ? mpin : confirmMpin).map((digit, index) => (
              <input
                key={`${step}-${index}`}
                ref={(el) => {
                  if (step === 'enter') {
                    mpinRefs.current[index] = el;
                  } else {
                    confirmMpinRefs.current[index] = el;
                  }
                }}
                type="password"
                value={digit}
                onChange={(e) => 
                  step === 'enter' 
                    ? handleMpinChange(index, e.target.value)
                    : handleConfirmMpinChange(index, e.target.value)
                }
                onKeyDown={(e) => handleKeyDown(e, index, step === 'confirm')}
                className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                maxLength={1}
                disabled={isLoading}
              />
            ))}
          </div>
        </div>

        {/* Progress indicator with clickable first dot */}
        <div className="flex justify-center space-x-2">
          <div 
            className={`w-3 h-3 rounded-full cursor-pointer transition-all hover:scale-110 ${
              step === 'enter' ? 'bg-teal-600' : 'bg-green-500 hover:bg-green-600'
            }`}
            onClick={handleEditMpin}
            title="Click to edit MPIN"
          />
          <div className={`w-3 h-3 rounded-full ${step === 'confirm' ? 'bg-teal-600' : 'bg-gray-300'}`} />
        </div>

        {error && (
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {step === 'confirm' && (
            <Button
              onClick={handleSubmit}
              disabled={!isComplete() || isLoading}
              variant="ghost"
              className={`w-full py-6 ${
                (!isComplete() || isLoading) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Setting MPIN..." : "Confirm MPIN"}
            </Button>
          )}
        </div>

        <div className="hidden lg:block text-center text-sm text-gray-600">
          <p>
            Your MPIN will be used for secure transactions and account access.
            Keep it confidential and don&apos;t share with anyone.
          </p>
          {step === 'confirm' && (
            <p className="mt-2 text-xs text-gray-500">
              <strong>Press Enter to submit when all digits are entered</strong>
            </p>
          )}
          {step === 'confirm' && (
            <p className="mt-1 text-xs text-gray-500">
              Click the first dot above to change your MPIN
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MPIN;