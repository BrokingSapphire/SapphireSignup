import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";

interface TradingAccountDetails2Props {
  onNext: () => void;
  initialData?: unknown;
  isCompleted?: boolean;
}

const occupationOptions = [
  "Business",
  "Housewife",
  "Student",
  "Professional",
  "Private Sector",
  "Government Service",
  "Agriculturist",
  "Public Sector",
  "Retired",
  "Others",
];


const TradingAccountDetails2: React.FC<TradingAccountDetails2Props> = ({ 
  onNext, 
  initialData, 
  isCompleted 
}) => {
  const [occupation, setOccupation] = useState("");
  const [isPoliticallyExposed, setIsPoliticallyExposed] = useState<boolean>(false);
  const [showValidation, setShowValidation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasJustSubmitted, setHasJustSubmitted] = useState(false);
  interface TradingAccountFormData {
    occupation: string;
    is_politically_exposed: boolean;
  }
  const [originalData, setOriginalData] = useState<TradingAccountFormData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Define the expected API data shape
  interface ApiTradingAccountData {
    occupation?: string;
    is_politically_exposed?: boolean;
  }

  // Map API occupation values back to frontend display values
  const mapFromApiValues = (data: ApiTradingAccountData) => {
    const occupationReverseMapping: Record<string, string> = {
      "self employed": "Business",
      "housewife": "Housewife",
      "student": "Student",
      "private sector": "Professional", // Note: Both "Professional" and "Private Sector" map to "private sector"
      "govt servant": "Government Service", // Note: Both "Government Service" and "Public Sector" map to "govt servant"
      "agriculturalist": "Agriculturist",
      "retired": "Retired",
      "other": "Others"
    };

    return {
      occupation: data.occupation ? occupationReverseMapping[data.occupation] || "Others" : "",
      is_politically_exposed: data.is_politically_exposed
    };
  };

  // Prefill data from initialData (API response) and show completion toast
  useEffect(() => {
    if (isCompleted && initialData && !isSubmitting && !hasJustSubmitted) {
      // Map API values back to display values
      const mappedData = mapFromApiValues(initialData);
      
      setOccupation(mappedData.occupation);
      setIsPoliticallyExposed(mappedData.is_politically_exposed ?? false);
      setOriginalData({
        occupation: mappedData.occupation,
        is_politically_exposed: mappedData.is_politically_exposed ?? false
      });
      
    }
  }, [initialData, isCompleted, isSubmitting, hasJustSubmitted]);

  const handleOccupationSelect = (selected: string) => {
    if (isSubmitting) return;
    setOccupation(selected);
    setShowValidation(false);
    setError(null);
  };

  const handlePoliticallyExposedChange = (value: boolean) => {
    if (isSubmitting) return;
    setIsPoliticallyExposed(value);
    setShowValidation(false);
    setError(null);
  };

  const validateForm = () => {
    const isValid = occupation !== "";
    setShowValidation(!isValid);
    return isValid;
  };

  // Check if there are changes that require API call
  const hasChanges = () => {
    if (!isCompleted || !originalData) return true; // Not completed yet, so needs API call
    return (
      occupation !== originalData.occupation ||
      isPoliticallyExposed !== originalData.is_politically_exposed
    );
  };

  // Map frontend occupation values to API values - Fixed to match backend validation
  const mapOccupationToApi = (occupation: string): string => {
    const occupationMapping: Record<string, string> = {
      "Business": "self employed",           // Fixed: was "business"
      "Housewife": "housewife",             // Kept same
      "Student": "student",                 // Kept same
      "Professional": "private sector",     // Fixed: was "professional"
      "Private Sector": "private sector",   // Fixed: was "private_sector"
      "Government Service": "govt servant", // Fixed: was "government_service"
      "Agriculturist": "agriculturalist",   // Fixed: was "agriculturist"
      "Public Sector": "govt servant",      // Fixed: was "public_sector"
      "Retired": "retired",                 // Kept same
      "Others": "other"                     // Fixed: was "others"
    };
    return occupationMapping[occupation] || "other";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // If no changes and already completed, just proceed to next step
    if (!hasChanges() && isCompleted) {
      onNext();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "other_detail",
          occupation: mapOccupationToApi(occupation),
          politically_exposed: isPoliticallyExposed,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Cookies.get("authToken")}` 
          }
        }
      );

      if (!response.data) {
        setError("Failed to save other details. Please try again.");
        return;
      }

      
      // Mark that we just submitted to prevent the "already saved" toast
      setHasJustSubmitted(true);
      
      // Auto-advance after 2 seconds
      setTimeout(() => {
        onNext();
      }, 500);
      
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: { message?: string };
          status?: number;
        };
      };

      if (error.response?.data?.message) {
        setError(`Error: ${error.response.data.message}`);
      } else if (error.response?.status === 400) {
        setError("Invalid details. Please check and try again.");
      } else if (error.response?.status === 401) {
        setError("Authentication failed. Please restart the process.");
      } else {
        setError("Failed to save details. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = occupation !== "";

  const getButtonText = () => {
    if (isSubmitting) return "Continue";
    return "Continue";
  };

  const isButtonDisabled = () => {
    if (isSubmitting) return true;
    return !isFormValid;
  };

  // Always show the same UI - whether fresh or completed
  return (
    <div className="mx-auto -mt-28 sm:mt-14">
      <FormHeading
        title={"Other Details"}
        description={"Provide additional information for your trading account."}
      />

      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
            Occupation<span className="text-red-500">*</span>
          </label>
          {/* Using consistent grid layout like TradingPreferences with responsive design */}
          <div className="grid grid-cols-2 gap-2">
            {occupationOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleOccupationSelect(option)}
                disabled={isSubmitting}
                className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center text-xs sm:text-sm
                  ${
                    occupation === option
                      ? "border-teal-800 bg-teal-50 text-teal-800"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }
                  ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {option}
              </button>
            ))}
          </div>
          {showValidation && !occupation && (
            <p className="text-red-500 text-xs sm:text-sm mt-1">
              Please select your occupation
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
            Are you a politically exposed person?
            <span className="text-red-500">*</span>
          </label>
          {/* Using consistent grid layout with responsive design */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handlePoliticallyExposedChange(true)}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center text-xs sm:text-sm
                ${
                  isPoliticallyExposed === true
                    ? "border-teal-800 bg-teal-50 text-teal-800"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }
                ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handlePoliticallyExposedChange(false)}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center text-xs sm:text-sm
                ${
                  isPoliticallyExposed === false
                    ? "border-teal-800 bg-teal-50 text-teal-800"
                    : "border-gray-300 text-gray-600 hover:border-gray-400"
                }
                ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              No
            </button>
          </div>
          {showValidation && isPoliticallyExposed === null && (
            <p className="text-red-500 text-xs sm:text-sm mt-1">Please select an option</p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded">
            <p className="text-red-600 text-xs sm:text-sm">{error}</p>
          </div>
        )}

        <Button
          variant={"ghost"}
          type="submit"
          disabled={isButtonDisabled()}
          className={`w-full py-6 ${
            isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {getButtonText()}
        </Button>
      </form>
    </div>
  );
};

export default TradingAccountDetails2;