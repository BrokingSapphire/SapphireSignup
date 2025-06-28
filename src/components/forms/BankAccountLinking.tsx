// Enhanced BankAccountLinking component with name validation
"use client"
import React, { useState, useEffect } from "react";
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

  // Get stored full name from localStorage (try multiple possible keys)
  const getStoredFullName = (): string | null => {
    if (typeof window === 'undefined') return null;
    
    // Try common localStorage keys for full name
    const possibleKeys = ['full_name', 'fullName', 'name', 'user_name', 'userName'];
    
    for (const key of possibleKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          // Try parsing as JSON first (in case it's stored as an object)
          const parsed = JSON.parse(value);
          if (typeof parsed === 'string') {
            return parsed;
          } else if (typeof parsed === 'object' && parsed.name) {
            return parsed.name;
          } else if (typeof parsed === 'object' && parsed.full_name) {
            return parsed.full_name;
          }
        } catch {
          // If JSON parsing fails, treat as string
          return value;
        }
      }
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
      console.warn("Could not fetch PAN details:", error);
    }

    return null;
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
        }
      }

      if (!bankHolderName) {
        if (!hasShownValidationToast) {
          toast.error("Unable to verify bank account holder name. Please try again.");
          hasShownValidationToast = true;
        }
        return false;
      }

      // Get government ID name
      const govIdName = await getGovernmentIdName();
      
      if (!govIdName) {
        if (!hasShownValidationToast) {
          toast.error("Unable to verify identity. Please restart the process.");
          hasShownValidationToast = true;
        }
        return false;
      }

      // Compare names (allowing for minor variations)
      const namesMatch = compareNames(bankHolderName.toLowerCase().trim(), govIdName.toLowerCase().trim());
      
      if (!namesMatch) {
        if (!hasShownValidationToast) {
          toast.error("Account holder name doesn't match with your official Government ID. Please try again with the correct bank account.");
          hasShownValidationToast = true;
        }
        
        // Reset to main component to allow retry
        setLinkingMethod(null);
        setBankData(null);
        
        return false;
      }
      
      // Names match, proceed
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

  // Enhanced name comparison function
  const compareNames = (name1: string, name2: string): boolean => {
    // Remove common prefixes/suffixes and normalize
    const normalize = (name: string) => {
      return name
        .toLowerCase()
        .replace(/\b(mr|mrs|ms|dr|prof|shri|smt|kumari)\b\.?/g, '')
        .replace(/[.,\-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalized1 = normalize(name1);
    const normalized2 = normalize(name2);
    
    console.log("Comparing names:", { bank: normalized1, govId: normalized2 });
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Check if one name contains the other (for cases like "John Doe" vs "John")
    const words1 = normalized1.split(' ').filter(w => w.length > 2);
    const words2 = normalized2.split(' ').filter(w => w.length > 2);
    
    // Check if at least 2 significant words match or if it's a subset
    const matchingWords = words1.filter(word => 
      words2.some(w => w.includes(word) || word.includes(w))
    );
    
    const isMatch = matchingWords.length >= Math.min(2, Math.min(words1.length, words2.length));
    console.log("Name match result:", { matchingWords, isMatch });
    
    return isMatch;
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
    console.log("UPI success data:", upiData);
    
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
                onClick={handleNext}
                disabled={isValidating}
                className={`flex-1 bg-teal-800 text-white px-4 py-2 rounded hover:bg-teal-900 transition-colors ${
                  isValidating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isValidating ? 'Validating...' : 'Continue'}
              </button>
              <button 
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