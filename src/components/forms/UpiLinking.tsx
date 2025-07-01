import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import { ArrowRight, Clock } from "lucide-react";
import Image from "next/image";
import axios from "axios";
import QRCode from "qrcode";
import Cookies from "js-cookie";
import { toast } from "sonner";

interface UpiLinkingProps {
  onNext: () => void;
  onBack: () => void;
  validateBankDetails?: (bankAccountHolderName?: string) => Promise<boolean>;
  onUpiSuccess?: (upiData: Record<string, unknown>) => Promise<void>;
}

interface UpiData {
  payment_link: string;
  ios_links: {
    paytm: string;
    phonepe: string;
    gpay: string;
    bhim: string;
    whatsapp: string;
  };
}

const UpiLinking: React.FC<UpiLinkingProps> = ({ 
  onBack, 
  onNext,
  // onUpiSuccess
}) => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [upiData, setUpiData] = useState<UpiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isValidatingName, setIsValidatingName] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [hasProcessedPayment, setHasProcessedPayment] = useState(false);

  // Use refs to track polling state and intervals
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hasProcessedPaymentRef = useRef(false);

  // Initialize UPI verification
  useEffect(() => {
    initializeUpiVerification();
    
    // Cleanup on unmount
    return () => {
      stopPolling();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Timer effect with ref-based cleanup
  useEffect(() => {
    if (timeLeft <= 0) {
      setError("Verification timeout. Please try again.");
      stopPolling();
      return;
    }

    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          setError("Verification timeout. Please try again.");
          stopPolling();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeLeft]);

  // Start polling when UPI data is available
  useEffect(() => {
    if (upiData && !isPollingRef.current && timeLeft > 0 && !isValidatingName && !error && !hasProcessedPaymentRef.current) {
      startPolling();
    }
  }, [upiData, timeLeft, isValidatingName, error]);

  const stopPolling = useCallback(() => {
    console.log('[UPI] Stopping polling...');
    isPollingRef.current = false;
    setIsPolling(false);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (isPollingRef.current || hasProcessedPaymentRef.current) {
      console.log('[UPI] Polling already active or payment already processed, skipping...');
      return;
    }

    console.log('[UPI] Starting immediate polling...');
    isPollingRef.current = true;
    setIsPolling(true);
    setPollAttempts(0);
    
    // Start polling immediately with shorter intervals
    checkUpiStatus();
    
    // Set up interval for subsequent checks
    pollingIntervalRef.current = setInterval(() => {
      if (isPollingRef.current && !hasProcessedPaymentRef.current) {
        checkUpiStatus();
      } else {
        stopPolling();
      }
    }, 2000); // Poll every 2 seconds for faster detection
  }, []);

  const initializeUpiVerification = async () => {
    console.log('[UPI] Initializing UPI verification...');
    setIsLoading(true);
    setError(null);
    setHasProcessedPayment(false);
    hasProcessedPaymentRef.current = false;

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }
      
      console.log('[UPI] Sending bank_validation_start request...');
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "bank_validation_start",
          validation_type: "upi"
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[UPI] bank_validation_start response:', response.data);

      if (response.data?.data) {
        setUpiData(response.data.data);
        // Generate QR code from payment link
        if (response.data.data.payment_link) {
          console.log('[UPI] Generating QR code for payment link:', response.data.data.payment_link);
          generateQRCode(response.data.data.payment_link);
        }
      } else {
        setError("Failed to initialize UPI verification. Please try again.");
      }
    } catch (err: unknown) {
      console.error('[UPI] Initialization error:', err);
      handleApiError(err, "Failed to initialize UPI verification. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateQRCode = async (paymentLink: string) => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(paymentLink, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrCodeDataUrl);
      console.log('[UPI] QR code generated successfully');
    } catch (err) {
      console.error('[UPI] Error generating QR code:', err);
    }
  };

  const checkUpiStatus = async () => {
    if (!isPollingRef.current || hasProcessedPaymentRef.current) {
      console.log('[UPI] Polling stopped or payment already processed, skipping status check');
      return;
    }

    const currentAttempt = pollAttempts + 1;
    setPollAttempts(currentAttempt);
    console.log(`[UPI] Checking UPI status... (attempt ${currentAttempt})`);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        console.log('[UPI] No auth token, stopping polling');
        stopPolling();
        return;
      }
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "bank_validation",
          validation_type: "upi"
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000 // Reduced timeout for faster response
        }
      );

      console.log(`[UPI] Status check response status (attempt ${currentAttempt}):`, response.status);
      console.log(`[UPI] Status check response data (attempt ${currentAttempt}):`, response.data);

      // Check for payment completion based on both status and response data
      const isPaymentComplete = (response.status === 200 || response.status === 201) && 
                               response.data?.data && 
                               (response.data.data.account_holder_name || response.data.data.full_name);

      if (isPaymentComplete) {
        console.log('[UPI] Payment detected as complete! Processing response...');
        
        // Immediately mark as processed to prevent duplicate processing
        hasProcessedPaymentRef.current = true;
        setHasProcessedPayment(true);
        stopPolling();
        setIsValidatingName(true);
        
        toast.success("UPI payment completed! Validating account holder name...");
        
        // Get bank details from response
        const bankDetails = response.data?.data?.bank || response.data?.data;
        const accountHolderName = bankDetails?.account_holder_name || bankDetails?.full_name;
        
        console.log('[UPI] Full API response:', JSON.stringify(response.data, null, 2));
        console.log('[UPI] Extracted bankDetails:', bankDetails);
        console.log('[UPI] Extracted accountHolderName:', accountHolderName);
        
        // Defensive: If no name, fallback to manual
        if (!accountHolderName) {
          console.log('[UPI] No accountHolderName found, falling back to manual.');
          setIsValidatingName(false);
          setError(null);
          hasProcessedPaymentRef.current = false;
          setHasProcessedPayment(false);
          toast.error("Account holder name couldn't be fetched from your bank. Please try manual verification.");
          onBack();
          return;
        }

        // Process the payment
        await processPaymentCompletion(accountHolderName);
        
      } else if (response.status === 200 || response.status === 201) {
        // Status is success but no account holder name yet - continue polling
        console.log('[UPI] Payment status successful but no account details yet, continuing to poll...');
      } else {
        console.log('[UPI] Payment not yet completed, continuing to poll...');
      }

      // Stop polling after too many attempts to prevent infinite polling
      if (currentAttempt >= 150) { // 150 attempts * 2 seconds = 5 minutes
        console.log('[UPI] Maximum polling attempts reached, stopping...');
        stopPolling();
        setError("Payment verification took too long. Please try again.");
      }

    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      
      console.log(`[UPI] Status check error (attempt ${currentAttempt}):`, err);
      console.log('[UPI] Error response status:', error.response?.status);
      
      if (error.response?.status === 204) {
        console.log('[UPI] Status 204 - Payment not yet completed, continuing to poll...');
        return;
      } else if (error.response?.status === 406) {
        console.log('[UPI] Status 406 - UPI verification failed');
        stopPolling();
        setError("UPI verification failed. Please try again or use manual bank details.");
      } else if (error.response?.status === 401) {
        console.log('[UPI] Status 401 - Session expired');
        stopPolling();
        setError("Session expired. Please refresh and try again.");
      } else if (error.response?.status === 500) {
        console.log('[UPI] Status 500 - Server error, will retry');
        // Don't stop polling for 500 errors, they might be temporary
        return;
      } else {
        // For other errors, log but continue polling for a few more attempts
        console.warn('[UPI] Other error, continuing to poll:', err);
      }
    }
  };

  const processPaymentCompletion = async (accountHolderName: string) => {
    try {
      // Get stored name from localStorage
      let storedName = null;
      if (typeof window !== 'undefined') {
        const rawStoredName = localStorage.getItem('full_name');
        console.log('[UPI] Raw localStorage full_name:', rawStoredName);
        
        if (rawStoredName) {
          try {
            const parsedName = JSON.parse(rawStoredName);
            console.log('[UPI] Parsed localStorage name:', parsedName);
            
            if (typeof parsedName === 'object' && parsedName?.full_name) {
              storedName = parsedName.full_name;
            } else if (typeof parsedName === 'string') {
              storedName = parsedName;
            }
          } catch (e) {
            console.log('[UPI] Failed to parse localStorage name, treating as string:', e);
            storedName = rawStoredName;
          }
        }
      }
      
      console.log('[UPI] Final stored name for comparison:', storedName);
      
      if (!storedName) {
        console.log('[UPI] No storedName found, falling back to manual.');
        setIsValidatingName(false);
        setError(null);
        hasProcessedPaymentRef.current = false;
        setHasProcessedPayment(false);
        toast.error("Government ID name not found. Please try manual verification.");
        onBack();
        return;
      }

      // Enhanced name comparison with better logging
      const normalize = (name: string) => {
        const normalized = name
          .toLowerCase()
          .replace(/\b(mr|mrs|ms|dr|shri|smt|kumari)\b\.?/g, '') // Remove titles
          .replace(/[.,\-_()]/g, ' ') // Replace punctuation with spaces
          .replace(/\s+/g, ' ') // Multiple spaces to single space
          .replace(/\(.*?\)/g, '') // Remove anything in parentheses like (MINOR)
          .trim();
        
        console.log(`[UPI] Normalized "${name}" to "${normalized}"`);
        return normalized;
      };

      const normalizedAccountName = normalize(accountHolderName);
      const normalizedStoredName = normalize(storedName);
      
      console.log('[UPI] Comparing names:');
      console.log('[UPI] - Account holder (normalized):', normalizedAccountName);
      console.log('[UPI] - Stored name (normalized):', normalizedStoredName);

      // Check if names match (allowing for partial matches)
      const isExactMatch = normalizedAccountName === normalizedStoredName;
      const isPartialMatch = normalizedAccountName.includes(normalizedStoredName) || 
                            normalizedStoredName.includes(normalizedAccountName);
      
      console.log('[UPI] Name comparison results:');
      console.log('[UPI] - Exact match:', isExactMatch);
      console.log('[UPI] - Partial match:', isPartialMatch);
      
      if (!isExactMatch && !isPartialMatch) {
        console.log('[UPI] Name mismatch detected, falling back to manual.');
        setIsValidatingName(false);
        setError(null);
        hasProcessedPaymentRef.current = false;
        setHasProcessedPayment(false);
        toast.error("Account holder name doesn't match with your Government ID. Please try manual verification.");
        onBack();
        return;
      }

      // Names match! Call completion API
      console.log('[UPI] Names matched! Calling complete_upi_validation API...');
      
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        { step: 'complete_upi_validation' },
        {
          headers: {
            Authorization: `Bearer ${Cookies.get('authToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('[UPI] Completion API response:', completionResponse.data);
      console.log('[UPI] Completion API status:', completionResponse.status);
      
      setIsValidatingName(false);
      toast.success("Bank account verified successfully!");
      
      setTimeout(() => {
        console.log('[UPI] Proceeding to next step...');
        onNext();
      }, 1500);
      
    } catch (completionError) {
      console.error('[UPI] Completion API failed:', completionError);
      setIsValidatingName(false);
      hasProcessedPaymentRef.current = false;
      setHasProcessedPayment(false);
      setError('UPI validation completed but failed to save. Please try again.');
      toast.error('UPI validation completed but failed to save. Please try again.');
    }
  };

  const handleApiError = (err: unknown, defaultMessage: string) => {
    const error = err as { response?: { status?: number; data?: { message?: string } } };
    
    console.error('[UPI] API Error:', err);
    
    if (error.response?.data?.message) {
      setError(`Error: ${error.response.data.message}`);
    } else if (error.response?.status) {
      setError(`Server error (${error.response.status}). ${defaultMessage}`);
    } else {
      setError(defaultMessage);
    }
  };

  const handleRetry = () => { 
    console.log('[UPI] Retrying UPI verification...');
    // Reset all states
    setTimeLeft(300);
    setError(null);
    setIsValidatingName(false);
    setQrCodeDataUrl("");
    setUpiData(null);
    setPollAttempts(0);
    setHasProcessedPayment(false);
    hasProcessedPaymentRef.current = false;
    
    // Stop any existing polling
    stopPolling();
    
    // Reinitialize
    initializeUpiVerification();
  };

  // Format the time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (isLoading) {
    return (
      <div className="w-full -mt-28 sm:mt-8 max-w-2xl mx-auto p-2">
        <FormHeading
          title="Bank Account Details"
          description="Initializing UPI verification..."
        />
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">Setting up UPI verification...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-8 max-w-2xl mx-auto p-2">
        <FormHeading
          title="Bank Account Details"
          description="UPI verification encountered an issue."
        />
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
        <div className="mt-6 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleRetry}
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            Try Again
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={onBack}
            className="text-blue-500"
          >
            Enter details manually
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-8 max-w-2xl mx-auto p-2">
      <FormHeading
        title="Bank Account Details"
        description="Seamlessly link your bank for smooth transactions."
      />
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">UPI QR</h3>
        </div>
        <div className="flex items-center text-gray-500 text-sm">
          <Clock className="h-4 w-4 mr-1" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>
      <div className="mt-2">
        <div className="bg-[#F7F9FD] p-3 rounded flex flex-col md:flex-row gap-4 mt-2 mb-2">
          <div className="flex-1 flex justify-center">
            <div className="bg-white p-1 rounded-lg shadow-sm">
              {qrCodeDataUrl ? (
                <Image
                  height={160}
                  width={160} 
                  src={qrCodeDataUrl} 
                  alt="UPI Payment QR Code"
                  className="w-36 h-36"
                />
              ) : upiData?.payment_link ? (
                <div className="w-40 h-40 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
                    <span className="text-xs text-gray-500">Generating QR...</span>
                  </div>
                </div>
              ) : (
                <div className="w-40 h-40 bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Loading QR...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-gray-700 mb-2 text-center font-medium">
              Scan the QR using any UPI App
            </p>

            <div className="flex space-x-2 mb-3">
              <Image
                src="/new-signup/fourBanks.png"
                width={200}
                height={100}
                alt="banks"
              />
            </div>
          </div>
        </div>
        
        <div className="bg-[#F7F9FD] p-3 rounded mt-6 space-y-1 text-sm">
          <h4 className="font-semibold">Scan QR Code</h4>
          <ul className="list-disc list-inside space-y-0.5 text-gray-600">
            <li>
              ₹1 will be debited from your account and refunded within 24 hours.
            </li>
            <li>Scan using any UPI app to complete bank verification.</li>
            <li>We&apos;ll verify that the account holder name matches your Government ID.</li>
            <li>We&apos;ll automatically detect once payment is completed.</li>
          </ul>
        </div>

        {isPolling && !isValidatingName && !hasProcessedPayment && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-800 text-sm">
                Waiting for UPI payment completion...
              </span>
            </div>
          </div>
        )}

        {isValidatingName && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
              <span className="text-yellow-800 text-sm">
                Validating account holder name...
              </span>
            </div>
          </div>
        )}

        {hasProcessedPayment && !isValidatingName && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center">
              <div className="w-4 h-4 text-green-600 mr-3">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-green-800 text-sm">
                Payment processed successfully!
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="link"
          onClick={onBack}
          className="text-blue-500 mr-auto flex items-center"
          disabled={isValidatingName || hasProcessedPayment}
        >
          Enter details manually <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default UpiLinking;