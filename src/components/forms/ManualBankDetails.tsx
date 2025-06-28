import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";

interface ManualBankDetailsProps {
  onNext: () => void;
  onBack: () => void;
  initialData?: {
    bank?: {
      account_no: string;
      ifsc_code: string;
      account_type: string;
      full_name: string;
    };
  };
  isCompleted?: boolean;
  validateBankDetails: () => Promise<boolean>;
}

interface FormData {
  ifscCode: string;
  accountNumber: string;
  accountType: string;
}

interface FormErrors {
  ifscCode?: string;
  accountNumber?: string;
  accountType?: string;
}

interface BankInfo {
  bankName?: string;
  branch?: string;
  city?: string;
  state?: string;
}

const ManualBankDetails: React.FC<ManualBankDetailsProps> = ({
  onNext,
  initialData,
  isCompleted,
  validateBankDetails,
}) => {
  const [formData, setFormData] = useState<FormData>({
    ifscCode: "",
    accountNumber: "",
    accountType: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<FormData>({
    ifscCode: "",
    accountNumber: "",
    accountType: "",
  });

  // New state for IFSC API
  const [bankInfo, setBankInfo] = useState<BankInfo>({});
  const [isLoadingBankInfo, setIsLoadingBankInfo] = useState(false);

  // Define a type for the bank data received from the API
  interface ApiBankData {
    account_no?: string;
    ifsc_code?: string;
    account_type?: string;
    full_name?: string;
  }

  // Map API account type values back to frontend display values
  const mapFromApiValues = (data: ApiBankData) => {
    const accountTypeReverseMapping: Record<string, string> = {
      "savings": "Savings",
      "current": "Current"
    };

    return {
      ifscCode: data.ifsc_code || "",
      accountNumber: data.account_no || "",
      accountType: data.account_type ? accountTypeReverseMapping[data.account_type] || "Savings" : "",
    };
  };

  // Fetch bank details from IFSC API
  const fetchBankDetails = async (ifscCode: string) => {
    if (!ifscCode || ifscCode.length !== 11) return;

    setIsLoadingBankInfo(true);
    try {
      const response = await axios.get(`https://ifsc.razorpay.com/${ifscCode}`);
      
      if (response.data) {
        setBankInfo({
          bankName: response.data.BANK,
          branch: response.data.BRANCH,
          city: response.data.CITY,
          state: response.data.STATE,
        });
      }
    } catch (error) {
      console.log("IFSC API error:", error);
      setBankInfo({});
    } finally {
      setIsLoadingBankInfo(false);
    }
  };

  // Effect to fetch bank details when IFSC code changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.ifscCode && formData.ifscCode.length === 11 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
        fetchBankDetails(formData.ifscCode);
      } else {
        setBankInfo({});
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [formData.ifscCode]);

  // Prefill data from initialData (API response) and show completion toast
  useEffect(() => {
    if (isCompleted && initialData?.bank) {
      // Map API values back to display values
      const mappedData = mapFromApiValues(initialData.bank);
      
      setFormData(mappedData);
      setOriginalData(mappedData);
      
      // Fetch bank info for the existing IFSC code
      if (mappedData.ifscCode) {
        fetchBankDetails(mappedData.ifscCode);
      }
    }
  }, [initialData, isCompleted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value.toUpperCase(), // Convert to uppercase for IFSC
    }));

    // Clear error when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
    }));
    setError(null);
  };

  const handleAccountTypeSelect = (accountType: string) => {
    setFormData((prev) => ({
      ...prev,
      accountType,
    }));

    // Clear error when user selects
    setErrors((prev) => ({
      ...prev,
      accountType: undefined,
    }));
    setError(null);
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (!formData.ifscCode) {
      newErrors.ifscCode = "IFSC Code is required";
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
      newErrors.ifscCode = "Invalid IFSC Code format";
    }

    if (!formData.accountNumber) {
      newErrors.accountNumber = "Account Number is required";
    } else if (formData.accountNumber.length < 9 || formData.accountNumber.length > 18) {
      newErrors.accountNumber = "Account Number should be between 9-18 digits";
    } else if (!/^\d+$/.test(formData.accountNumber)) {
      newErrors.accountNumber = "Account Number should contain only digits";
    }

    if (!formData.accountType) {
      newErrors.accountType = "Account Type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if there are changes that require API call
  const hasChanges = () => {
    if (!isCompleted) return true; // Not completed yet, so needs API call
    return (
      formData.ifscCode !== originalData.ifscCode ||
      formData.accountNumber !== originalData.accountNumber ||
      formData.accountType !== originalData.accountType
    );
  };

  const mapAccountTypeToApi = (accountType: string): string => {
    const mapping: Record<string, string> = {
      "Savings": "savings",
      "Current": "current"
    };
    return mapping[accountType] || accountType.toLowerCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // If no changes and already completed, validate and proceed
    if (!hasChanges() && isCompleted) {
      console.log("No changes detected, validating existing bank details");
      const isValid = await validateBankDetails();
      if (isValid) {
        onNext();
      }
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Submit bank details
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "bank_validation",
          validation_type: "bank",
          bank: {
            account_number: formData.accountNumber,
            ifsc_code: formData.ifscCode,
            account_type: mapAccountTypeToApi(formData.accountType),
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Cookies.get('authToken')}`,
          },
        }
      );


      // Wait a moment for the data to be processed, then validate
      setTimeout(async () => {
        const isValid = await validateBankDetails();
        if (isValid) {
          // toast.success("Bank account verified successfully!");
          setTimeout(() => {
            onNext();
          }, 1500);
        }
      }, 2000);
      
    } catch (err: unknown) {
      type AxiosErrorResponse = {
        response?: {
          data?: { message?: string };
          status?: number;
        };
      };

      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as AxiosErrorResponse).response === "object"
      ) {
        const response = (err as AxiosErrorResponse).response;
        
        if (response?.data?.message) {
          setError(`Error: ${response.data.message}`);
        } else if (response?.status === 422) {
          setError("Bank account does not exist or invalid details provided.");
        } else if (response?.status === 400) {
          setError("Invalid bank details. Please check and try again.");
        } else if (response?.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else {
          setError("Failed to verify bank account. Please try again.");
        }
      } else {
        setError("Failed to verify bank account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getButtonText = () => {
    if (isSubmitting) return "Verifying...";
    if (!hasChanges() && isCompleted) return "Continue";
    return "Continue";
  };

  const isFormValid = formData.ifscCode && formData.accountNumber && formData.accountType;
  const canSubmit = isFormValid && !isSubmitting;

  return (
    <div className="w-full -mt-28 sm:mt-4  max-w-2xl mx-auto  p-4">
      <FormHeading
        title="Bank Account Details"
        description="Seamlessly link your bank for smooth transactions."
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="ifscCode" className="block text-sm font-medium">
            IFSC Code*
          </label>
          <div className="relative">
            <input
              type="text"
              id="ifscCode"
              name="ifscCode"
              value={formData.ifscCode}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`w-full p-2 border rounded ${
                errors.ifscCode ? "border-red-500" : isCompleted && formData.ifscCode === originalData.ifscCode ? "border-gray-300" : "border-gray-300"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              placeholder="Enter IFSC Code (e.g., SBIN0001234)"
              maxLength={11}
            />
            {isLoadingBankInfo && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
              </div>
            )}
          </div>
          {errors.ifscCode && (
            <p className="text-xs text-red-500">{errors.ifscCode}</p>
          )}
          
          {/* Bank Info Display */}
          {bankInfo.bankName && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm">
                <div className="font-medium text-blue-800">{bankInfo.bankName}</div>
                {bankInfo.branch && (
                  <div className="text-blue-700">{bankInfo.branch}</div>
                )}
                {(bankInfo.city || bankInfo.state) && (
                  <div className="text-blue-600">
                    {[bankInfo.city, bankInfo.state].filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="accountNumber" className="block text-sm font-medium">
            A/C Number*
          </label>
          <input
            type="text"
            id="accountNumber"
            name="accountNumber"
            value={formData.accountNumber}
            onChange={(e) => {
              const { name, value } = e.target;
              // Only allow digits
              const numericValue = value.replace(/\D/g, '');
              setFormData((prev) => ({
                ...prev,
                [name]: numericValue,
              }));
              
              // Clear error when user starts typing
              setErrors((prev) => ({
                ...prev,
                [name]: undefined,
              }));
              setError(null);
            }}
            disabled={isSubmitting}
            className={`w-full p-2 border rounded ${
              errors.accountNumber ? "border-red-500" : isCompleted && formData.accountNumber === originalData.accountNumber ? "border-gray-300" : "border-gray-300"
            } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            placeholder="Enter Account Number"
            maxLength={18}
          />
          {errors.accountNumber && (
            <p className="text-xs text-red-500">{errors.accountNumber}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="accountType" className="block text-sm font-medium">
            Account Type*
          </label>
          <div className="flex gap-3">
            <div 
              onClick={() => !isSubmitting && handleAccountTypeSelect("Savings")}
              className={`px-4 py-2 rounded border transition-colors text-xs sm:text-sm hover:border-gray-400 cursor-pointer ${
                formData.accountType === "Savings"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Savings
            </div>

            <div 
              onClick={() => !isSubmitting && handleAccountTypeSelect("Current")}
              className={`px-4 py-2 rounded border transition-colors text-xs sm:text-sm hover:border-gray-400 cursor-pointer ${
                formData.accountType === "Current"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Current
            </div>
          </div>
          {errors.accountType && (
            <p className="text-xs text-red-500">{errors.accountType}</p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        
        <Button
            type="submit"
            disabled={!canSubmit}
            className={`bg-teal-800 w-full text-white p-6 rounded hover:bg-teal-900 ${
              !canSubmit ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {getButtonText()}
          </Button>

        <div className="text-center text-sm text-gray-600 mt-4">
          <p>
            We&apos;ll verify your bank account details for secure transactions. 
            The account holder name must match your Government ID.
          </p>
        </div>
      </form>
    </div>
  );
};

export default ManualBankDetails;