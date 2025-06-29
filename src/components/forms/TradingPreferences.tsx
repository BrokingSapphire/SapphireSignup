import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";

interface TradingPreferencesProps {
  onNext: () => void;
  initialData?: unknown;
  isCompleted?: boolean;
}

type MaritalStatus = "Single" | "Married" | "Divorced";
type IncomeRange = "< 1 Lakh" | "1 - 5 Lacs" | "5 - 10 Lacs" | "10 - 25 Lacs" | "25 - 1 Cr" | "> 1Cr";
type ExperienceRange = "No Experience" | "< 1 year" | "1 - 5 years" | "5 - 10 years" | "10+ years";
type SettlementPreference = "Quarterly" | "Monthly";

const maritalStatusOptions: MaritalStatus[] = ["Single", "Married", "Divorced"];

// Global flags to track toast states in this session
let hasShownGlobalCompletedToast = false;
let hasShownSubmissionSuccessToast = false;

const TradingPreferences: React.FC<TradingPreferencesProps> = ({
  onNext,
  initialData,
  isCompleted,
}) => {
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<IncomeRange | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceRange | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementPreference>("Quarterly");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [hasJustSubmitted, setHasJustSubmitted] = useState(false);
  
  type OriginalData = {
    marital_status: MaritalStatus | null;
    annual_income: IncomeRange | null;
    trading_exp: ExperienceRange | null;
    account_settlement: SettlementPreference | null;
  };

  const [originalData, setOriginalData] = useState<OriginalData | null>(null);

  // Define a type for the API data structure
  type ApiTradingPreferences = {
    marital_status?: MaritalStatus;
    annual_income?: string;
    trading_exp?: string;
    acc_settlement?: SettlementPreference;
  };

  // Map API values back to frontend display values
  const mapFromApiValues = (data: ApiTradingPreferences) => {
    const incomeReverseMapping: Record<string, IncomeRange> = {
      "le_1_Lakh": "< 1 Lakh",
      "1_5_Lakh": "1 - 5 Lacs",
      "5_10_Lakh": "5 - 10 Lacs",
      "10_25_Lakh": "10 - 25 Lacs",
      "25_1_Cr": "25 - 1 Cr",
      "Ge_1_Cr": "> 1Cr"
    };

    const experienceReverseMapping: Record<string, ExperienceRange> = {
      "1": "No Experience",  // Note: Both "No Experience" and "< 1 year" map to "1"
      "1-5": "1 - 5 years",
      "5-10": "5 - 10 years",
      "10": "10+ years"
    };

    return {
      marital_status: data.marital_status ?? null,
      annual_income: data.annual_income ? incomeReverseMapping[data.annual_income] || null : null,
      trading_exp: data.trading_exp ? experienceReverseMapping[data.trading_exp] || null : null,
      account_settlement: data.acc_settlement ?? null,
    };
  };

  // Prefill data from initialData (API response) and show completion toast
  useEffect(() => {
    if (isCompleted && initialData && !isSubmitting && !hasJustSubmitted) {
      // Map API values back to display values
      const mappedData = mapFromApiValues(initialData);
      
      setMaritalStatus(mappedData.marital_status || null);
      setSelectedIncome(mappedData.annual_income || null);
      setSelectedExperience(mappedData.trading_exp || null);
      setSelectedSettlement(mappedData.account_settlement || "Quarterly");
      setOriginalData(mappedData);
      
      // Show completion toast only once per session and only if not currently submitting
      if (!hasShownGlobalCompletedToast) {
        hasShownGlobalCompletedToast = true;
        // Also set the submission success flag to prevent duplicate success messages
        hasShownSubmissionSuccessToast = true;
      }
    }
  }, [initialData, isCompleted, isSubmitting, hasJustSubmitted]);

  const handleMaritalStatusSelect = (status: MaritalStatus) => {
    if (isSubmitting) return;
    setMaritalStatus(status);
    setShowValidation(false);
    setError(null);
  };

  const handleIncomeSelect = (income: IncomeRange) => {
    if (isSubmitting) return;
    setSelectedIncome(income);
    setShowValidation(false);
    setError(null);
  };

  const handleExperienceSelect = (experience: ExperienceRange) => {
    if (isSubmitting) return;
    setSelectedExperience(experience);
    setShowValidation(false);
    setError(null);
  };

  const handleSettlementSelect = (settlement: SettlementPreference) => {
    if (isSubmitting) return;
    setSelectedSettlement(settlement);
    setShowValidation(false);
    setError(null);
  };

  const validateForm = () => {
    const isValid = maritalStatus && selectedIncome && selectedExperience && selectedSettlement;
    setShowValidation(!isValid);
    return isValid;
  };

  // Check if there are changes that require API call
  const hasChanges = () => {
    if (!isCompleted || !originalData) return true; // Not completed yet, so needs API call
    return (
      maritalStatus !== originalData.marital_status ||
      selectedIncome !== originalData.annual_income ||
      selectedExperience !== originalData.trading_exp ||
      selectedSettlement !== originalData.account_settlement
    );
  };

  // Map frontend values to API values - Fixed to match backend validation
  const mapToApiValues = () => {
    const incomeMapping: Record<IncomeRange, string> = {
      "< 1 Lakh": "le_1_Lakh",        // Fixed: was "less_than_1_lakh"
      "1 - 5 Lacs": "1_5_Lakh",       // Fixed: was "1_5_lakh"
      "5 - 10 Lacs": "5_10_Lakh",     // Fixed: was "5_10_lakh"
      "10 - 25 Lacs": "10_25_Lakh",   // Fixed: was "10_25_lakh"
      "25 - 1 Cr": "25_1_Cr",         // Fixed: was "25_1_cr"
      "> 1Cr": "Ge_1_Cr"              // Fixed: was "more_than_1_cr"
    };

    const experienceMapping: Record<ExperienceRange, string> = {
      "No Experience": "1",            // Fixed: was "0"
      "< 1 year": "1",                 // Fixed: was "0-1"
      "1 - 5 years": "1-5",           // Kept same
      "5 - 10 years": "5-10",         // Kept same
      "10+ years": "10"               // Fixed: was "10+"
    };

    return {
      marital_status: maritalStatus,
      annual_income: selectedIncome ? incomeMapping[selectedIncome] : null,
      trading_exp: selectedExperience ? experienceMapping[selectedExperience] : null,
      acc_settlement: selectedSettlement
    };
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
      const apiValues = mapToApiValues();
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "personal_detail",
          ...apiValues
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Cookies.get("authToken")}` 
          }
        }
      );

      if (!response.data) {
        setError("Failed to save personal details. Please try again.");
        return;
      }

      // Only show success toast if we haven't shown it already in this session
      if (!hasShownSubmissionSuccessToast) {
        // toast.success("Personal details saved successfully!");
        hasShownSubmissionSuccessToast = true;
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

  const isFormValid = maritalStatus && selectedIncome && selectedExperience && selectedSettlement;

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
    <div className="w-full  -mt-28 sm:mt-8 mx-auto">
      <FormHeading
        title="Personal Details"
        description="Provide your personal information for account setup."
      />

      <div className="space-y-6 mt-6">
        {/* Marital Status */}
        <div>
          <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
            Marital Status<span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {maritalStatusOptions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleMaritalStatusSelect(status)}
                disabled={isSubmitting}
                className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center text-xs sm:text-sm
                  ${
                    maritalStatus === status
                      ? "border-teal-800 bg-teal-50 text-teal-800"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }
                  ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {status}
              </button>
            ))}
          </div>
          {showValidation && !maritalStatus && (
            <p className="text-red-500 text-xs sm:text-sm mt-1">Please select your marital status</p>
          )}
        </div>

        {/* Annual Income */}
        <div>
          <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
            Annual Income<span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleIncomeSelect("< 1 Lakh")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedIncome === "< 1 Lakh"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-700 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              &lt; 1 Lakh
            </button>
            <button
              type="button"
              onClick={() => handleIncomeSelect("1 - 5 Lacs")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedIncome === "1 - 5 Lacs"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              1 - 5 Lacs
            </button>
            <button
              type="button"
              onClick={() => handleIncomeSelect("5 - 10 Lacs")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedIncome === "5 - 10 Lacs"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              5 - 10 Lacs
            </button>
            <button
              type="button"
              onClick={() => handleIncomeSelect("10 - 25 Lacs")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedIncome === "10 - 25 Lacs"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              10 - 25 Lacs
            </button>
            <button
              type="button"
              onClick={() => handleIncomeSelect("25 - 1 Cr")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedIncome === "25 - 1 Cr"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              25 - 1 Cr
            </button>
            <button
              type="button"
              onClick={() => handleIncomeSelect("> 1Cr")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedIncome === "> 1Cr"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              &gt; 1Cr
            </button>
          </div>
          {showValidation && !selectedIncome && (
            <p className="text-red-500 text-xs sm:text-sm mt-1">Please select your annual income</p>
          )}
        </div>

        {/* Trading Experience */}
        <div>
          <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
            Trading Experience<span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleExperienceSelect("No Experience")}
              disabled={isSubmitting}
              className={`py-2 px-2 sm:px-4 border rounded-md transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedExperience === "No Experience"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              No Experience
            </button>
            <button
              type="button"
              onClick={() => handleExperienceSelect("< 1 year")}
              disabled={isSubmitting}
              className={`py-2 px-2 sm:px-4 border rounded-md transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedExperience === "< 1 year"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              &lt; 1 year
            </button>
            <button
              type="button"
              onClick={() => handleExperienceSelect("1 - 5 years")}
              disabled={isSubmitting}
              className={`py-2 px-2 sm:px-4 border rounded-md transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedExperience === "1 - 5 years"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              1 - 5 years
            </button>
            <button
              type="button"
              onClick={() => handleExperienceSelect("5 - 10 years")}
              disabled={isSubmitting}
              className={`py-2 px-2 sm:px-4 border rounded-md transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedExperience === "5 - 10 years"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              5 - 10 years
            </button>
            <button
              type="button"
              onClick={() => handleExperienceSelect("10+ years")}
              disabled={isSubmitting}
              className={`py-2 px-2 sm:px-4 border rounded-md transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedExperience === "10+ years"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              10+ years
            </button>
          </div>
          {showValidation && !selectedExperience && (
            <p className="text-red-500 text-xs sm:text-sm mt-1">Please select your trading experience</p>
          )}
        </div>

        {/* Settlement Preference */}
        <div>
          <label className="block text-gray-900 font-medium mb-2 text-sm sm:text-base">
            Preference for running account settlement
            <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSettlementSelect("Quarterly")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedSettlement === "Quarterly"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Quarterly
            </button>
            <button
              type="button"
              onClick={() => handleSettlementSelect("Monthly")}
              disabled={isSubmitting}
              className={`px-2 sm:px-4 py-2 rounded border transition-colors text-center hover:border-gray-400 text-xs sm:text-sm ${
                selectedSettlement === "Monthly"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded mt-6">
          <p className="text-red-600 text-xs sm:text-sm">{error}</p>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        variant={"ghost"}
        disabled={isButtonDisabled()}
        className={`py-6 mt-8 w-full ${
          isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default TradingPreferences;