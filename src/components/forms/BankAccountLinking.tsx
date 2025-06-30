"use client"
import React, { useState, useEffect, useRef } from "react";
import FormHeading from "./FormHeading";
import ManualBankDetails from "./ManualBankDetails";
import UpiLinking from "./UpiLinking";
import Image from "next/image";
import { toast } from "sonner";
import axios from "axios";
import Cookies from "js-cookie";

interface BankAccountLinkingProps {
  onNext: () => void;
  initialData?: {
    bank?: {
      account_no: string;
      ifsc_code: string;
      account_type: string;
      full_name: string;
    };
  };
  isCompleted?: boolean;
}

interface BankData {
  account_no: string;
  ifsc_code: string;
  account_type: string;
  full_name: string;
}

// Global flags to track toast states in this session
let hasShownValidationToast = false;

const BankAccountLinking: React.FC<BankAccountLinkingProps> = ({ 
  onNext, 
  initialData, 
  isCompleted 
}) => {
  const [linkingMethod, setLinkingMethod] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  // Refs for continue button
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const linkDifferentButtonRef = useRef<HTMLButtonElement>(null);

  // Add keyboard event listener for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isCompleted && bankData && continueButtonRef.current) {
        e.preventDefault();
        continueButtonRef.current.click();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCompleted, bankData]);

  // Check screen size on component mount and when window resizes
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };
    
    // Initial check
    checkScreenSize();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkScreenSize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // If on small screen and no method is selected yet, automatically select manual
  useEffect(() => {
    if (isSmallScreen && linkingMethod === null && !isCompleted) {
      setLinkingMethod("manual");
    }
  }, [isSmallScreen, linkingMethod, isCompleted]);

  // Handle initial data and show completion toast
  useEffect(() => {
    if (isCompleted && initialData?.bank) {
      setBankData(initialData.bank);
    }
  }, [initialData, isCompleted]);

  // Get stored full name from localStorage (only full_name key)
  const getStoredFullName = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const value = localStorage.getItem('full_name');
      if (value) {
        try {
          // Try parsing as JSON first (in case it's stored as an object)
          const parsed = JSON.parse(value);
          if (typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
          } else if (typeof parsed === 'object' && parsed && parsed.full_name) {
            return parsed.full_name.trim();
          }
        } catch {
          // If JSON parsing fails, treat as string
          return value.trim();
        }
      }
    } catch (error) {
      console.warn("Error reading localStorage key 'full_name':", error);
    }
    
    return null;
  };

  // Get Government ID name from multiple possible sources
  const getGovernmentIdName = async (): Promise<string | null> => {
    // First try localStorage
    const storedName = getStoredFullName();
    if (storedName) {
      return storedName;
    }

    // If not in localStorage, try to get from PAN API
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        { step: "pan" },
        {
          headers: {
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      if (response.data?.data?.full_name) {
        // Store in localStorage for future use
        localStorage.setItem('full_name', response.data.data.full_name);
        return response.data.data.full_name;
      }
    } catch (error) {
      console.warn(error);
    }

    return null;
  };

  // Enhanced name comparison function
  const compareNames = (bankName: string, govIdName: string): boolean => {
    console.log("Original names:", { bank: bankName, govId: govIdName });
    
    // Normalize both names
    const normalize = (name: string) => {
      return name
        .toLowerCase()
        .trim()
        // Remove common prefixes/suffixes
        .replace(/\b(mr|mrs|ms|dr|prof|shri|smt|kumari|kumar|devi|singh)\b\.?/gi, '')
        // Remove special characters and extra spaces
        .replace(/[.,\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedBank = normalize(bankName);
    const normalizedGovId = normalize(govIdName);
    
    console.log("Normalized names:", { bank: normalizedBank, govId: normalizedGovId });
    
    // If names are exactly the same after normalization
    if (normalizedBank === normalizedGovId) {
      console.log("Exact match found");
      return true;
    }
    
    // Split into words and filter meaningful words (length >= 2)
    const bankWords = normalizedBank.split(' ').filter(word => word.length >= 2);
    const govIdWords = normalizedGovId.split(' ').filter(word => word.length >= 2);
    
    console.log("Words:", { bankWords, govIdWords });
    
    // If either name has less than 2 words, be more strict
    if (bankWords.length < 2 || govIdWords.length < 2) {
      // For single names, require exact match or one contains the other
      const singleBankName = bankWords[0] || '';
      const singleGovIdName = govIdWords[0] || '';
      
      const isMatch = singleBankName === singleGovIdName || 
                     singleBankName.includes(singleGovIdName) || 
                     singleGovIdName.includes(singleBankName);
      
      console.log("Single name match:", isMatch);
      return isMatch;
    }
    
    // For multiple words, use stricter matching
    let exactMatches = 0;
    let partialMatches = 0;
    
    bankWords.forEach(bankWord => {
      govIdWords.forEach(govIdWord => {
        if (bankWord === govIdWord) {
          exactMatches++;
        } else if (bankWord.length >= 3 && govIdWord.length >= 3 && 
                  (bankWord.includes(govIdWord) || govIdWord.includes(bankWord))) {
          partialMatches++;
        }
      });
    });
    
    console.log("Match counts:", { exactMatches, partialMatches, totalBankWords: bankWords.length, totalGovIdWords: govIdWords.length });
    
    // Matching criteria:
    // 1. At least 2 exact word matches, OR
    // 2. At least 1 exact match + 1 partial match, OR
    // 3. If one name is subset of another with high similarity
    
    const minWords = Math.min(bankWords.length, govIdWords.length);
    const isMatch = exactMatches >= 2 || 
                   (exactMatches >= 1 && partialMatches >= 1) ||
                   (exactMatches >= Math.max(1, minWords - 1));
    
    console.log("Final match result:", isMatch);
    return isMatch;
  };

  // Updated validate bank details function that works for both UPI and manual entry
  const validateBankDetails = async (bankAccountHolderName?: string): Promise<boolean> => {
    setIsValidating(true);
    
    try {
      let bankHolderName = bankAccountHolderName;
      
      // If bank holder name is not provided, try to get it from the current bank data or API
      if (!bankHolderName) {
        if (bankData?.full_name) {
          bankHolderName = bankData.full_name;
        } else {
          // Try to get from API as fallback
          try {
            const response = await axios.get(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint/bank_validation`,
              {
                headers: {
                  Authorization: `Bearer ${Cookies.get('authToken')}`
                }
              }
            );

            if (response.data?.data?.bank?.full_name) {
              bankHolderName = response.data.data.bank.full_name;
            }
          } catch (apiError) {
            console.warn("Could not fetch bank details from API:", apiError);
          }
        }
      }

      if (!bankHolderName) {
        if (!hasShownValidationToast) {
          toast.error("Unable to verify bank account holder name. Please try again.");
          hasShownValidationToast = true;
        }
        return false;
      }

      // Get government ID name from localStorage
      const govIdName = getStoredFullName();
      
      if (!govIdName) {
        // Try to fetch from API if not in localStorage
        try {
          const govIdNameFromApi = await getGovernmentIdName();
          if (!govIdNameFromApi) {
            if (!hasShownValidationToast) {
              toast.error("Unable to verify identity. Please ensure your PAN details are completed.");
              hasShownValidationToast = true;
            }
            return false;
          }
        } catch (error) {
          console.error("Error fetching government ID name:", error);
          if (!hasShownValidationToast) {
            toast.error("Unable to verify identity. Please restart the process.");
            hasShownValidationToast = true;
          }
          return false;
        }
      }

      const finalGovIdName = govIdName || await getGovernmentIdName();
      
      if (!finalGovIdName) {
        if (!hasShownValidationToast) {
          toast.error("Unable to verify identity. Please restart the process.");
          hasShownValidationToast = true;
        }
        return false;
      }

      console.log("Comparing names:", { 
        bankAccountHolder: bankHolderName, 
        governmentId: finalGovIdName 
      });

      // Compare names using improved logic
      const namesMatch = compareNames(bankHolderName, finalGovIdName);
      
      if (!namesMatch) {
        if (!hasShownValidationToast) {
          toast.error(`Account holder name "${bankHolderName}" doesn't match with your Government ID name "${finalGovIdName}". Please ensure you're using the correct bank account.`);
          hasShownValidationToast = true;
        }
        
        // Reset to main component to allow retry
        setLinkingMethod(null);
        setBankData(null);
        
        return false;
      }
      
      console.log("Names matched successfully!");
      return true;
      
    } catch (error: unknown) {
      console.error("Error validating bank details:", error);

      if (!hasShownValidationToast) {
        // Type guard for AxiosError-like object
        type AxiosErrorLike = {
          response?: {
            status?: number;
          };
        };

        const axiosError = error as AxiosErrorLike;

        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof axiosError.response?.status === "number" &&
          axiosError.response?.status === 404
        ) {
          toast.error("Bank account details not found. Please complete bank validation first.");
        } else {
          toast.error("Error validating bank details. Please try again.");
        }
        hasShownValidationToast = true;
      }

      return false;
    } finally {
      setIsValidating(false);
    }
  };

  // Enhanced onNext handler with validation
  const handleNext = async () => {
    // If validation is in progress, don't proceed
    if (isValidating) {
      return;
    }

    // If already completed and no changes, proceed directly
    if (isCompleted && bankData) {
      const isValid = await validateBankDetails();
      if (isValid) {
        onNext();
      }
      return;
    }

    // For new submissions, validation will be handled in the child components
    onNext();
  };

  // Helper function to mask account number
  const maskAccountNumber = (accountNo: string): string => {
    if (!accountNo) return "";
    if (accountNo.length <= 4) return accountNo;
    return `****${accountNo.slice(-4)}`;
  };

  // Enhanced method selection handler
  const handleMethodSelection = (method: string) => {
    setLinkingMethod(method);
    // Reset validation toast flags when starting fresh
    hasShownValidationToast = false;
  };

  // Enhanced UPI success callback to validate names immediately
  interface UpiData {
    account_no?: string;
    ifsc_code?: string;
    account_type?: string;
    full_name?: string;
    account_holder_name?: string;
    name?: string;
    [key: string]: unknown; // Allow additional properties if needed
  }

  const handleUpiSuccess = async (upiData: UpiData) => {
    // If UPI data contains bank account holder name, validate immediately
    if (upiData?.full_name || upiData?.account_holder_name || upiData?.name) {
      const bankAccountHolderName = upiData.full_name || upiData.account_holder_name || upiData.name;
      
      // Update bank data
      setBankData({
        account_no: upiData.account_no || '',
        ifsc_code: upiData.ifsc_code || '',
        account_type: upiData.account_type || 'savings',
        full_name: bankAccountHolderName || ''
      });
      
      // Validate names
      const isValid = await validateBankDetails(bankAccountHolderName);
      
      if (isValid) {
        // Names match, proceed to next step
        onNext();
      } else {
        // Names don't match, the validateBankDetails function will show the error toast
        // and reset the linking method
      }
    } else {
      // No name data from UPI, proceed normally
      onNext();
    }
  };

  // Always show the same UI - whether fresh or completed
  const renderLinkingOption = () => {
    if (linkingMethod === "manual") {
      return (
        <ManualBankDetails 
          onNext={handleNext}
          onBack={() => setLinkingMethod(null)} 
          initialData={initialData}
          isCompleted={isCompleted}
          validateBankDetails={validateBankDetails}
        />
      );
    } else if (linkingMethod === "upi") {
      return (
        <UpiLinking 
          onNext={handleNext}
          onBack={() => setLinkingMethod(null)}
          validateBankDetails={validateBankDetails}
          onUpiSuccess={handleUpiSuccess}
        />
      );
    }
    
    return (
      <div className="w-full -mt-28 sm:mt-0 max-w-2xl mx-auto p-4">
        <FormHeading 
          title="Bank Account Details" 
          description="Seamlessly link your bank for smooth transactions." 
        />

        {/* Show completion info if already verified */}
        {isCompleted && bankData && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center mb-3">
              <svg className="w-6 h-6 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-gray-800 font-medium">Bank Account Already Verified</p>
                <p className="text-gray-600 text-sm">You can link a different account or proceed with the current one.</p>
              </div>
            </div>
            
            {/* Show current bank details */}
            <div className="mt-4 p-3 bg-white rounded border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Account Holder:</span>
                  <div className="font-medium text-gray-800">{bankData.full_name}</div>
                </div>
                <div>
                  <span className="text-gray-600">Account Number:</span>
                  <div className="font-medium text-gray-800">{maskAccountNumber(bankData.account_no)}</div>
                </div>
                <div>
                  <span className="text-gray-600">IFSC Code:</span>
                  <div className="font-medium text-gray-800">{bankData.ifsc_code}</div>
                </div>
                <div>
                  <span className="text-gray-600">Account Type:</span>
                  <div className="font-medium text-gray-800 capitalize">{bankData.account_type}</div>
                </div>
              </div>
            </div>

            {/* Continue or Change Options */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button 
                ref={continueButtonRef}
                onClick={handleNext}
                disabled={isValidating}
                className={`flex-1 bg-teal-800 text-white px-4 py-2 rounded hover:bg-teal-900 transition-colors ${
                  isValidating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isValidating ? 'Validating...' : 'Continue'}
              </button>
              <button 
                ref={linkDifferentButtonRef}
                onClick={() => handleMethodSelection("manual")}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
              >
                Link Different Account
              </button>
            </div>

          </div>
        )}

        {/* Show linking options for new users or when changing account */}
        {(!isCompleted || linkingMethod) && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {/* Only show UPI option on larger screens */}
              {!isSmallScreen && (
                <button 
                  className="flex flex-col items-center justify-center h-32 border-2 rounded hover:border-[#064D51] transition-colors"
                  onClick={() => handleMethodSelection("upi")}
                >
                  <div className="flex items-center justify-center w-20 h-10 mt-4 mb-2">
                    <Image width={1000} height={1000} src="/new-signup/new-upi.svg" alt="UPI" className="h-full w-20"  />
                  </div>
                  <div className="font-medium">Link with UPI</div>
                  <div className="text-xs text-gray-500">(recommended)</div>
                </button>
              )}
              
              <button 
                className={`flex flex-col items-center justify-center h-32 border-2 rounded hover:border-[#064D51] transition-colors ${
                  isSmallScreen ? "col-span-1" : ""
                }`}
                onClick={() => handleMethodSelection("manual")}
              >
                <div className="flex items-center justify-center space-x-1 mb-2">
                  <Image width={1000} height={1000} src="/new-signup/threeBanks.png" alt="Bank" className="h-full w-20"  />
                </div>
                <div className="font-medium">Enter bank</div>
                <div className="font-medium">details manually</div>
              </button>
            </div>

            {/* Show a back option if user is changing account */}
            {isCompleted && linkingMethod && (
              <div className="mt-4 flex justify-center">
                <button 
                  onClick={() => setLinkingMethod(null)}
                  className="text-gray-600 hover:text-gray-800 text-sm underline"
                >
                  ← Back to current account
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return renderLinkingOption();
}

export default BankAccountLinking;