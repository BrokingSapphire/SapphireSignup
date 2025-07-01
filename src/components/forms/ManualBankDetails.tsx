import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";

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
  validateBankDetails: (bankHolderName?: string) => Promise<boolean>;
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

// Razorpay IFSC API Response Type
interface IFSCApiResponse {
  ISO3166: string;
  MICR: string;
  DISTRICT: string;
  UPI: boolean;
  CENTRE: string;
  ADDRESS: string;
  RTGS: boolean;
  STATE: string;
  BRANCH: string;
  NEFT: boolean;
  SWIFT: string | null;
  CONTACT: string;
  CITY: string;
  IMPS: boolean;
  BANK: string;
  BANKCODE: string;
  IFSC: string;
}

interface BankInfo {
  bankName?: string;
  branch?: string;
  city?: string;
  state?: string;
}

// Bank validation API response types
interface PennyDropResponse {
  data?: {
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    account_type?: string;
    verification_status?: string;
    message?: string;
  };
  message?: string;
}

interface CompleteBankValidationResponse {
  data?: {
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    account_type?: string;
    verification_status?: string;
    is_completed?: boolean;
  };
  message?: string;
}

const ManualBankDetails: React.FC<ManualBankDetailsProps> = ({
  onNext,
  onBack,
  initialData,
  isCompleted,
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

  // IFSC API state
  const [bankInfo, setBankInfo] = useState<BankInfo>({});
  const [isLoadingBankInfo, setIsLoadingBankInfo] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);

  // Bank verification states
  const [verificationStage, setVerificationStage] = useState<'form' | 'penny_drop' | 'name_validation' | 'completion' | 'success'>('form');
  const [bankAccountHolderName, setBankAccountHolderName] = useState<string>("");

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

  // IFSC Code validation
  const validateIFSCCode = (ifscCode: string): boolean => {
    // IFSC format: 4 letters + 1 zero + 6 alphanumeric characters
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifscCode);
  };

  // Fetch bank details from Razorpay IFSC API
  const fetchBankDetails = async (ifscCode: string) => {
    if (!ifscCode || ifscCode.length !== 11 || !validateIFSCCode(ifscCode)) {
      setBankInfo({});
      setIfscError(null);
      return;
    }

    setIsLoadingBankInfo(true);
    setIfscError(null);
    
    try {
      const response = await axios.get<IFSCApiResponse>(`https://ifsc.razorpay.com/${ifscCode}`);
      
      if (response.data) {
        setBankInfo({
          bankName: response.data.BANK,
          branch: response.data.BRANCH,
          city: response.data.CITY,
          state: response.data.STATE,
        });
        
        // Clear IFSC error if API call is successful
        setErrors(prev => ({ ...prev, ifscCode: undefined }));
      }
    } catch (error) {
      console.error("IFSC API Error:", error);
      setBankInfo({});
      setIfscError("Invalid IFSC code or bank not found");
      
      // Set IFSC error in form errors
      setErrors(prev => ({ ...prev, ifscCode: "Invalid IFSC code or bank not found" }));
    } finally {
      setIsLoadingBankInfo(false);
    }
  };

  // Effect to fetch bank details when IFSC code changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.ifscCode && formData.ifscCode.length === 11) {
        if (validateIFSCCode(formData.ifscCode)) {
          fetchBankDetails(formData.ifscCode);
        } else {
          setBankInfo({});
          setIfscError("Invalid IFSC code format");
          setErrors(prev => ({ ...prev, ifscCode: "Invalid IFSC code format" }));
        }
      } else {
        setBankInfo({});
        setIfscError(null);
        // Don't show error if user is still typing
        if (formData.ifscCode.length > 0 && formData.ifscCode.length < 11) {
          setErrors(prev => ({ ...prev, ifscCode: undefined }));
        }
      }
    }, 300); // Reduced debounce time for better UX

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
      
      // Set verification stage to success for completed banks
      setVerificationStage('success');
    }
  }, [initialData, isCompleted]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    let processedValue = value;
    
    if (name === 'ifscCode') {
      // Convert to uppercase and limit to 11 characters
      processedValue = value.toUpperCase().slice(0, 11);
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    // Clear error when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: undefined,
    }));
    setError(null);
    
    // Clear IFSC specific error
    if (name === 'ifscCode') {
      setIfscError(null);
    }
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
    } else if (!validateIFSCCode(formData.ifscCode)) {
      newErrors.ifscCode = "Invalid IFSC Code format (e.g., SBIN0001234)";
    } else if (ifscError) {
      newErrors.ifscCode = ifscError;
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

  // Step 1: Penny Drop Verification
  const performPennyDrop = async (): Promise<string | null> => {
    setVerificationStage('penny_drop');
    
    try {
      toast.info("Initiating bank account verification...");
      
      const response = await axios.post<PennyDropResponse>(
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

      console.log("Penny Drop Response:", response.data);

      // Extract account holder name from response
      const accountHolderName = response.data?.data?.account_holder_name;
      
      if (!accountHolderName) {
        throw new Error("Account holder name not found in response");
      }

      toast.success("Bank account verified! Validating account holder name...");
      setBankAccountHolderName(accountHolderName);
      
      return accountHolderName;
      
    } catch (err: unknown) {
      console.error("Penny Drop Error:", err);
      
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
          throw new Error(`Bank verification failed: ${response.data.message}`);
        } else if (response?.status === 422) {
          throw new Error("Bank account does not exist or invalid details provided.");
        } else if (response?.status === 400) {
          throw new Error("Invalid bank details. Please check and try again.");
        } else if (response?.status === 401) {
          throw new Error("Authentication failed. Please restart the process.");
        }else if (response?.status === 429){
          throw new Error("Too many requests. Please try again later.");
        } else {
          throw new Error("Failed to verify bank account. Please try again.");
        }
      } else {
        throw new Error("Failed to verify bank account. Please try again.");
      }
    }
  };

  // Step 2: Name Validation
  const performNameValidation = async (accountHolderName: string): Promise<boolean> => {
    setVerificationStage('name_validation');
    try {
      toast.info("Validating account holder name with government ID...");
      // Get full_name from localStorage
      let storedName = null;
      if (typeof window !== 'undefined') {
        storedName = localStorage.getItem('full_name');
        try {
          if (storedName) {
            storedName = JSON.parse(storedName);
            if (typeof storedName === 'object' && storedName.full_name) {
              storedName = storedName.full_name;
            }
          }
        } catch { /* ignore */ }
      }
      if (!storedName) {
        toast.error('Could not find your official name for validation. Please restart.');
        return false;
      }
      // Normalize and compare
      const normalize = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');
      if (normalize(accountHolderName) !== normalize(storedName)) {
        toast.error("Account holder name doesn't match your Government ID. Please use the correct bank account.");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Name Validation Error:", error);
      throw error;
    }
  };

  // Step 3: Complete Bank Validation
  const completeBankValidation = async (): Promise<void> => {
    setVerificationStage('completion');
    
    try {
      toast.info("Finalizing bank verification...");
      
      const response = await axios.post<CompleteBankValidationResponse>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        { step: "complete_bank_validation" },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Cookies.get('authToken')}`,
          },
        }
      );

      console.log("Complete Bank Validation Response:", response.data);

      if (response.data?.data?.is_completed) {
        toast.success("Bank account verification completed successfully!");
        setVerificationStage('success');
      } else {
        throw new Error("Bank verification completion failed");
      }
      
    } catch (error) {
      console.error("Complete Bank Validation Error:", error);
      throw new Error("Failed to complete bank verification. Please try again.");
    }
  };

  // Main form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!hasChanges() && isCompleted) {
      onNext();
      return;
    }
    if (!validateForm()) {
      return;
    }
    if (isLoadingBankInfo) {
      setError("Please wait for IFSC verification to complete");
      return;
    }
    if (ifscError || !bankInfo.bankName) {
      setError("Please enter a valid IFSC code");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // Step 1: Perform Penny Drop
      const accountHolderName = await performPennyDrop();
      if (!accountHolderName) {
        throw new Error("Failed to get account holder name");
      }
      // Step 2: Validate Name
      const isValid = await performNameValidation(accountHolderName);
      if (!isValid) {
        setIsSubmitting(false);
        setVerificationStage('form');
        setBankAccountHolderName("");
        return;
      }
      // Step 3: Complete Bank Validation
      await completeBankValidation();
      setTimeout(() => {
        onNext();
      }, 1500);
    } catch (err: unknown) {
      console.error("Bank Verification Process Error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Bank verification failed. Please try again.");
      }
      setVerificationStage('form');
      setBankAccountHolderName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getButtonText = () => {
    if (isSubmitting) {
      switch (verificationStage) {
        case 'penny_drop':
          return "Verifying Bank Account...";
        case 'name_validation':
          return "Validating Name...";
        case 'completion':
          return "Completing Verification...";
        default:
          return "Verifying...";
      }
    }
    if (!hasChanges() && isCompleted) return "Continue";
    return "Verify Bank Account";
  };

  const getVerificationStageIndicator = () => {
    if (!isSubmitting && verificationStage === 'form') return null;

    const stages = [
      { key: 'penny_drop', label: 'Bank Verification', icon: '🏦' },
      { key: 'name_validation', label: 'Name Validation', icon: '👤' },
      { key: 'completion', label: 'Finalizing', icon: '✅' },
    ];

    return (
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800 mb-3">Verification Progress</h4>
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const isCurrentStage = verificationStage === stage.key;
            const isCompletedStage = stages.findIndex(s => s.key === verificationStage) > index;
            
            return (
              <div key={stage.key} className={`flex items-center space-x-3 ${
                isCurrentStage ? 'text-blue-800' : isCompletedStage ? 'text-green-600' : 'text-gray-500'
              }`}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                  isCurrentStage ? 'bg-blue-200 animate-pulse' : 
                  isCompletedStage ? 'bg-green-200' : 'bg-gray-200'
                }`}>
                  {isCompletedStage ? '✓' : isCurrentStage ? '...' : index + 1}
                </div>
                <span className="text-sm">{stage.icon} {stage.label}</span>
                {isCurrentStage && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>
            );
          })}
        </div>
        
        {bankAccountHolderName && (
          <div className="mt-3 p-2 bg-white rounded border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Account Holder:</strong> {bankAccountHolderName}
            </p>
          </div>
        )}
      </div>
    );
  };

  const isFormValid = formData.ifscCode && formData.accountNumber && formData.accountType && !ifscError && bankInfo.bankName;
  const canSubmit = isFormValid && !isSubmitting && !isLoadingBankInfo;

  function toTitleCase(text: string): string {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return (
    <div className="w-full -mt-28 sm:mt-4 max-w-2xl mx-auto p-4">
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
                errors.ifscCode ? "border-red-500" : 
                bankInfo.bankName ? "border-green-500" : 
                "border-gray-300"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              placeholder="Enter IFSC Code (e.g., SBIN0001234)"
              maxLength={11}
            />
            {isLoadingBankInfo && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
              </div>
            )}
            {bankInfo.bankName && !isLoadingBankInfo && (
              <div className="absolute right-3 top-2.5">
                <div className="w-4 h-4 text-green-500">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            )}
          </div>
          {errors.ifscCode && (
            <p className="text-xs text-red-500">{errors.ifscCode}</p>
          )}
          
          {/* Bank Info Display */}
          {bankInfo.bankName && !isLoadingBankInfo && (
            <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-800">
                <span className="font-medium">{bankInfo.bankName}</span>
                {bankInfo.branch && <span>, {toTitleCase(bankInfo.branch)}</span>}
                {bankInfo.city && <span>, {toTitleCase(bankInfo.city)}</span>}
                {bankInfo.state && <span>, {toTitleCase(bankInfo.state)}</span>}
              </div>
            </div>
          )}
          
          {/* IFSC Error Display */}
          {ifscError && !isLoadingBankInfo && formData.ifscCode.length === 11 && (
            <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-sm text-red-700">
                {ifscError}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="accountNumber" className="block text-sm font-medium">
            Account Number*
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
              errors.accountNumber ? "border-red-500" : "border-gray-300"
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

        {/* Verification Stage Indicator */}
        {getVerificationStageIndicator()}

        {error && (
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className={`bg-teal-800 w-full text-white p-6 rounded hover:bg-teal-900 transition-opacity ${
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
          
          {/* Detailed verification process explanation */}
         
        </div>

        {/* Back button */}
        <div className="flex justify-center mt-4">
          <Button
            type="button"
            variant="link"
            onClick={onBack}
            disabled={isSubmitting}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to linking options
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ManualBankDetails;