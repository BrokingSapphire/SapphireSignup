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
  validateBankDetails: (bankAccountHolderName?: string) => Promise<boolean>;
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
  onUpiSuccess
}) => {
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [upiData, setUpiData] = useState<UpiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setIsPolling] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [isValidatingName, setIsValidatingName] = useState(false);

  // Use refs to track polling state and intervals
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (upiData && !isPollingRef.current && timeLeft > 0 && !isValidatingName && !error) {
      startPolling();
    }
  }, [upiData, timeLeft, isValidatingName, error]);

  const stopPolling = useCallback(() => {
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
    if (isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);
    
    // Start polling after 20 seconds
    pollingTimeoutRef.current = setTimeout(() => {
      // Initial check
      checkUpiStatus();
      
      // Set up interval for subsequent checks
      pollingIntervalRef.current = setInterval(() => {
        if (isPollingRef.current) {
          checkUpiStatus();
        }
      }, 3000); // Poll every 3 seconds
      
    }, 20000); // 20-second delay
  }, []);

  const initializeUpiVerification = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }
      
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

      if (response.data?.data) {
        setUpiData(response.data.data);
        // Generate QR code from payment link
        if (response.data.data.payment_link) {
          generateQRCode(response.data.data.payment_link);
        }
      } else {
        setError("Failed to initialize UPI verification. Please try again.");
      }
    } catch (err: unknown) {
      console.error("UPI initialization error:", err);
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
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const checkUpiStatus = async () => {
    if (!isPollingRef.current) {
      return;
    }

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
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
          timeout: 10000 // 10-second timeout
        }
      );

      // If successful (status 201), UPI payment is complete
      if (response.status === 201) {
        stopPolling();
        setIsValidatingName(true);
        toast.success("UPI payment completed! Validating account holder name...");
        // Get bank details from response - the account holder name should be in the response
        const bankDetails = response.data?.data?.bank || response.data?.data;
        const accountHolderName = bankDetails?.account_holder_name || bankDetails?.full_name;
        // Name validation against localStorage
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
        // Defensive: If no name, fallback to manual
        if (!accountHolderName) {
          setIsValidatingName(false);
          setError(null);
          toast.success("The Account Holder name Couldn't be fetched from your bank. Please try manual verification.");
          onBack();
          return;
        }
        // Improved name comparison: allow if main name matches, ignore extra words like (MINOR)
        const normalize = (name: string) =>
          name
            .toLowerCase()
            .replace(/\b(mr|mrs|ms|dr|shri|smt|kumari)\b\.?/g, '')
            .replace(/[.,\-_()]/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\(.*?\)/g, '') // remove anything in parentheses
            .trim();
        const mainName = normalize(accountHolderName);
        const storedMainName = normalize(storedName);
        // Allow if either name contains the other (for cases like 'AVI SRIVASTAVA' vs 'AVI SRIVASTAVA MINOR')
        if (
          !mainName.includes(storedMainName) &&
          !storedMainName.includes(mainName)
        ) {
          setIsValidatingName(false);
          setError(null);
          toast.success("The Account Holder name Doesn't match with the name in the Gov id, Please try again");
          onBack(); // Show manual verification component
          return;
        }
        // If onUpiSuccess callback is provided, use it for completion
        if (onUpiSuccess && bankDetails) {
          try {
            const upiDataWithName = {
              ...bankDetails,
              account_holder_name: accountHolderName,
              full_name: accountHolderName
            };
            await onUpiSuccess(upiDataWithName);
            setIsValidatingName(false);
          } catch (error) {
            console.error("UPI success validation failed:", error);
            setIsValidatingName(false);
          }
        } else {
          // Fallback: call complete_upi_validation
          try {
            await axios.post(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
              { step: 'complete_upi_validation' },
              {
                headers: {
                  Authorization: `Bearer ${Cookies.get('authToken')}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            setIsValidatingName(false);
            setTimeout(() => {
              onNext();
            }, 1500);
          } catch (error) {
            console.error("UPI success validation failed:", error);
            setIsValidatingName(false);
            setError('UPI validation completed but failed to save. Please try again.');
          }
        }
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      
      if (error.response?.status === 204) {
        return;
      } else if (error.response?.status === 406) {
        stopPolling();
        setError("UPI verification failed. Please try again or use manual bank details.");
      } else if (error.response?.status === 401) {
        stopPolling();
        setError("Session expired. Please refresh and try again.");
      } else {
        // For other errors, log but continue polling for a few more attempts
        console.warn(err);
      }
    }
  };

  const handleApiError = (err: unknown, defaultMessage: string) => {
    const error = err as { response?: { status?: number; data?: { message?: string } } };
    
    if (error.response?.data?.message) {
      setError(`Error: ${error.response.data.message}`);
    } else if (error.response?.status) {
      setError(`Server error (${error.response.status}). ${defaultMessage}`);
    } else {
      setError(defaultMessage);
    }
  };

  const handleRetry = () => { 
    // Reset all states
    setTimeLeft(300);
    setError(null);
    setIsValidatingName(false);
    setQrCodeDataUrl("");
    setUpiData(null);
    
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
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="link"
          onClick={onBack}
          className="text-blue-500 mr-auto flex items-center"
          disabled={isValidatingName}
        >
          Enter details manually <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default UpiLinking;