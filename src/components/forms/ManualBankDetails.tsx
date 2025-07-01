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
  // onBack,
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
  const [, setBankAccountHolderName] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const [isWaitingForRetry, setIsWaitingForRetry] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);

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
      console.error("[MANUAL] IFSC API Error:", error);
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
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.ifscCode]);

  // Countdown effect for retry
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (retryCountdown > 0) {
      intervalId = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            setIsWaitingForRetry(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [retryCountdown]);

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

  // Enhanced error handling function
  const handlePennyDropError = (err: unknown, attemptNumber: number): { shouldRetry: boolean; errorMessage: string; waitTime?: number } => {
    console.error(`[MANUAL] Penny Drop Error (attempt ${attemptNumber}):`, err);
    
    type AxiosErrorResponse = {
      response?: {
        data?: { 
          message?: string;
          error?: {
            message?: string;
            details?: string[];
            code?: number;
          };
        };
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
      
      console.log("[MANUAL] Error response:", response);
      console.log("[MANUAL] Error response status:", response?.status);
      console.log("[MANUAL] Error response data:", response?.data);
      
      // Check for wrapped errors in 500 responses
      if (response?.status === 500 && response?.data?.error?.details) {
        const details = response.data.error.details;
        console.log("[MANUAL] Checking wrapped error details:", details);
        
        // Check for wrapped 429 error
        const has429Error = details.some((detail: string) => 
          detail.includes('429') || detail.toLowerCase().includes('too many requests')
        );
        
        if (has429Error) {
          const waitTime = Math.min(30 + (attemptNumber * 15), 120); // Progressive backoff
          return {
            shouldRetry: attemptNumber < 3,
            errorMessage: `Too many requests. ${attemptNumber < 3 ? `Will retry in ${waitTime} seconds.` : 'Please try again later.'}`,
            waitTime
          };
        }
        
        // Check for wrapped 422 error (Bank account doesn't exist)
        const has422Error = details.some((detail: string) => 
          detail.includes('422') || detail.toLowerCase().includes('unprocessable entity')
        );
        
        if (has422Error) {
          return {
            shouldRetry: false,
            errorMessage: "Bank account does not exist or invalid details provided. Please check your account number and IFSC code."
          };
        }
        
        // Check for wrapped 400 error (Bad request)
        const has400Error = details.some((detail: string) => 
          detail.includes('400') || detail.toLowerCase().includes('bad request')
        );
        
        if (has400Error) {
          return {
            shouldRetry: false,
            errorMessage: "Invalid bank details format. Please check and try again."
          };
        }
        
        // Check for wrapped 401 error (Unauthorized)
        const has401Error = details.some((detail: string) => 
          detail.includes('401') || detail.toLowerCase().includes('unauthorized')
        );
        
        if (has401Error) {
          return {
            shouldRetry: false,
            errorMessage: "Authentication failed. Please restart the process."
          };
        }
      }
      
      // Check for direct 429 error
      const is429Error = response?.status === 429 || 
                        response?.data?.message?.toLowerCase().includes('too many requests') ||
                        response?.data?.error?.message?.toLowerCase().includes('too many requests');
      
      if (is429Error) {
        const waitTime = Math.min(30 + (attemptNumber * 15), 120);
        return {
          shouldRetry: attemptNumber < 3,
          errorMessage: `Too many requests. ${attemptNumber < 3 ? `Will retry in ${waitTime} seconds.` : 'Please try again later.'}`,
          waitTime
        };
      }
      
      // Handle direct status codes
      if (response?.status === 500) {
        // Generic 500 error without wrapped details
        return {
          shouldRetry: attemptNumber < 2,
          errorMessage: "Server error occurred. Please try again.",
          waitTime: 10
        };
      } else if (response?.status === 422) {
        return {
          shouldRetry: false,
          errorMessage: "Bank account does not exist or invalid details provided. Please check your account number and IFSC code."
        };
      } else if (response?.status === 400) {
        return {
          shouldRetry: false,
          errorMessage: "Invalid bank details format. Please check and try again."
        };
      } else if (response?.status === 401) {
        return {
          shouldRetry: false,
          errorMessage: "Authentication failed. Please restart the process."
        };
      } else if (response?.data?.message) {
        return {
          shouldRetry: false,
          errorMessage: `Bank verification failed: ${response.data.message}`
        };
      }
    }
    
    return {
      shouldRetry: false,
      errorMessage: "Failed to verify bank account. Please try again."
    };
  };

  // Step 1: Penny Drop Verification with retry logic
  const performPennyDrop = async (attemptNumber: number = 1): Promise<string | null> => {
    setVerificationStage('penny_drop');
    
    try {
      console.log(`[MANUAL] Starting penny drop verification (attempt ${attemptNumber})...`);
      toast.info(`Initiating bank account verification${attemptNumber > 1 ? ` (attempt ${attemptNumber})` : ''}...`);
      
      const requestData = {
        step: "bank_validation",
        validation_type: "bank",
        bank: {
          account_number: formData.accountNumber,
          ifsc_code: formData.ifscCode,
          account_type: mapAccountTypeToApi(formData.accountType),
        }
      };
      
      console.log("[MANUAL] Penny drop request data:", requestData);
      
      const response = await axios.post<PennyDropResponse>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Cookies.get('authToken')}`,
          },
          timeout: 30000, // Increased timeout
        }
      );

      console.log("[MANUAL] Penny Drop Response:", response.data);
      console.log("[MANUAL] Penny Drop Status:", response.status);

      // Extract account holder name from response
      const accountHolderName = response.data?.data?.account_holder_name;
      
      console.log("[MANUAL] Extracted account holder name:", accountHolderName);
      
      if (!accountHolderName) {
        throw new Error("Account holder name not found in response");
      }

      toast.success("Bank account verified! Validating account holder name...");
      setBankAccountHolderName(accountHolderName);
      setRetryCount(0); // Reset retry count on success
      
      return accountHolderName;
      
    } catch (err: unknown) {
      const errorResult = handlePennyDropError(err, attemptNumber);
      
      if (errorResult.shouldRetry && errorResult.waitTime) {
        console.log(`[MANUAL] Will retry after ${errorResult.waitTime} seconds...`);
        setIsWaitingForRetry(true);
        setRetryCountdown(errorResult.waitTime);
        setError(errorResult.errorMessage);
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, (errorResult.waitTime ?? 10) * 1000));
        
        setIsWaitingForRetry(false);
        setRetryCountdown(0);
        setRetryCount(attemptNumber);
        
        return performPennyDrop(attemptNumber + 1);
      } else {
        throw new Error(errorResult.errorMessage);
      }
    }
  };

  // Step 2: Name Validation
  const performNameValidation = async (accountHolderName: string): Promise<boolean> => {
    setVerificationStage('name_validation');
    
    try {
      console.log("[MANUAL] Starting name validation...");
      console.log("[MANUAL] Account holder name to validate:", accountHolderName);
      
      toast.info("Validating account holder name with government ID...");
      
      // Get full_name from localStorage
      let storedName = null;
      if (typeof window !== 'undefined') {
        const rawStoredName = localStorage.getItem('full_name');
        console.log("[MANUAL] Raw localStorage full_name:", rawStoredName);
        
        if (rawStoredName) {
          try {
            const parsedName = JSON.parse(rawStoredName);
            console.log("[MANUAL] Parsed localStorage name:", parsedName);
            
            if (typeof parsedName === 'object' && parsedName?.full_name) {
              storedName = parsedName.full_name;
            } else if (typeof parsedName === 'string') {
              storedName = parsedName;
            }
          } catch (e) {
            console.log("[MANUAL] Failed to parse localStorage name, treating as string:", e);
            storedName = rawStoredName;
          }
        }
      }
      
      console.log("[MANUAL] Final stored name for comparison:", storedName);
      
      if (!storedName) {
        toast.error('Could not find your official name for validation. Please restart.');
        return false;
      }
      
      // Enhanced name comparison (similar to UPI)
      const normalize = (name: string) => {
        const normalized = name
          .toLowerCase()
          .replace(/\b(mr|mrs|ms|dr|shri|smt|kumari)\b\.?/g, '') // Remove titles
          .replace(/[.,\-_()]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+/g, ' ') // Multiple spaces to single space
          .replace(/\(.*?\)/g, '') // Remove anything in parentheses like (MINOR)
          .trim();
        
        console.log(`[MANUAL] Normalized "${name}" to "${normalized}"`);
        return normalized;
      };
      
      const normalizedAccountName = normalize(accountHolderName);
      const normalizedStoredName = normalize(storedName);
      
      console.log('[MANUAL] Comparing names:');
      console.log('[MANUAL] - Account holder (normalized):', normalizedAccountName);
      console.log('[MANUAL] - Stored name (normalized):', normalizedStoredName);

      // Check if names match (allowing for partial matches)
      const isExactMatch = normalizedAccountName === normalizedStoredName;
      const isPartialMatch = normalizedAccountName.includes(normalizedStoredName) || 
                            normalizedStoredName.includes(normalizedAccountName);
      
      console.log('[MANUAL] Name comparison results:');
      console.log('[MANUAL] - Exact match:', isExactMatch);
      console.log('[MANUAL] - Partial match:', isPartialMatch);
      
      if (!isExactMatch && !isPartialMatch) {
        console.log('[MANUAL] Name mismatch detected');
        toast.error("Account holder name doesn't match your Government ID. Please use the correct bank account.");
        return false;
      }
      
      console.log('[MANUAL] Names matched successfully');
      return true;
      
    } catch (error) {
      console.error("[MANUAL] Name Validation Error:", error);
      throw error;
    }
  };

  // Step 3: Complete Bank Validation
  const completeBankValidation = async (): Promise<void> => {
    setVerificationStage('completion');
    
    try {
      console.log("[MANUAL] Starting completion API call...");
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

      console.log("[MANUAL] Complete Bank Validation Response:", response.data);
      console.log("[MANUAL] Complete Bank Validation Status:", response.status);

      if (response.data?.data?.is_completed) {
        toast.success("Bank account verification completed successfully!");
        setVerificationStage('success');
        console.log("[MANUAL] Bank verification completed successfully");
      } else {
        throw new Error("Bank verification completion failed");
      }
      
    } catch (error) {
      console.error("[MANUAL] Complete Bank Validation Error:", error);
      throw new Error("Failed to complete bank verification. Please try again.");
    }
  };

  // Main form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isWaitingForRetry) return;
    
    console.log("[MANUAL] Form submission started");
    
    if (!hasChanges() && isCompleted) {
      console.log("[MANUAL] No changes detected, proceeding to next step");
      onNext();
      return;
    }
    
    if (!validateForm()) {
      console.log("[MANUAL] Form validation failed");
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
    setRetryCount(0);
    
    try {
      // Step 1: Perform Penny Drop with retry logic
      console.log("[MANUAL] Step 1: Starting penny drop");
      const accountHolderName = await performPennyDrop();
      
      if (!accountHolderName) {
        throw new Error("Failed to get account holder name");
      }
      
      // Step 2: Validate Name
      console.log("[MANUAL] Step 2: Starting name validation");
      const isValid = await performNameValidation(accountHolderName);
      
      if (!isValid) {
        console.log("[MANUAL] Name validation failed, resetting form");
        setIsSubmitting(false);
        setVerificationStage('form');
        setBankAccountHolderName("");
        return;
      }
      
      // Step 3: Complete Bank Validation
      console.log("[MANUAL] Step 3: Starting completion");
      await completeBankValidation();
      
      console.log("[MANUAL] All steps completed, proceeding to next step");
      setTimeout(() => {
        onNext();
      }, 1500);
      
    } catch (err: unknown) {
      console.error("[MANUAL] Bank Verification Process Error:", err);
      
      if (err instanceof Error) {
        setError(err.message);
        toast.error(err.message);
      } else {
        setError("Bank verification failed. Please try again.");
        toast.error("Bank verification failed. Please try again.");
      }
      
      setVerificationStage('form');
      setBankAccountHolderName("");
      
    } finally {
      setIsSubmitting(false);
      setIsWaitingForRetry(false);
      setRetryCountdown(0);
    }
  };

  const getButtonText = () => {
    if (isWaitingForRetry) {
      return `Retrying in ${retryCountdown}s...`;
    }
    
    if (isSubmitting) {
      switch (verificationStage) {
        case 'penny_drop':
          return retryCount > 0 ? `Retrying Bank Verification... (${retryCount + 1}/4)` : "Verifying Bank Account...";
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


  const isFormValid = formData.ifscCode && formData.accountNumber && formData.accountType && !ifscError && bankInfo.bankName;
  const canSubmit = isFormValid && !isSubmitting && !isLoadingBankInfo && !isWaitingForRetry;

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
              disabled={isSubmitting || isWaitingForRetry}
              className={`w-full p-2 border rounded ${
                errors.ifscCode ? "border-red-500" : 
                bankInfo.bankName ? "border-green-500" : 
                "border-gray-300"
              } ${(isSubmitting || isWaitingForRetry) ? "opacity-50 cursor-not-allowed" : ""}`}
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
            disabled={isSubmitting || isWaitingForRetry}
            className={`w-full p-2 border rounded ${
              errors.accountNumber ? "border-red-500" : "border-gray-300"
            } ${(isSubmitting || isWaitingForRetry) ? "opacity-50 cursor-not-allowed" : ""}`}
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
              onClick={() => !(isSubmitting || isWaitingForRetry) && handleAccountTypeSelect("Savings")}
              className={`px-4 py-2 rounded border transition-colors text-xs sm:text-sm hover:border-gray-400 cursor-pointer ${
                formData.accountType === "Savings"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${(isSubmitting || isWaitingForRetry) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Savings
            </div>

            <div 
              onClick={() => !(isSubmitting || isWaitingForRetry) && handleAccountTypeSelect("Current")}
              className={`px-4 py-2 rounded border transition-colors text-xs sm:text-sm hover:border-gray-400 cursor-pointer ${
                formData.accountType === "Current"
                  ? "border-teal-800 bg-teal-50 text-teal-800"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
              } ${(isSubmitting || isWaitingForRetry) ? "opacity-50 cursor-not-allowed" : ""}`}
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
          
          {/* Rate limit explanation */}
          {retryCount > 0 && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="text-sm font-medium text-yellow-800 mb-1">Rate Limit Information</h4>
              <p className="text-xs text-yellow-700">
                Our verification service has rate limits to prevent abuse. If you encounter delays, 
                the system will automatically retry with progressive delays (30s, 45s, 60s intervals).
              </p>
            </div>
          )}
        </div>

      </form>
    </div>
  );
};

export default ManualBankDetails;