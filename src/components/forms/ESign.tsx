import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Check } from "lucide-react";
import FormHeading from "./FormHeading";
import Image from "next/image";
import axios from "axios";
import Cookies from "js-cookie";
import { useCheckpoint, CheckpointStep } from '@/hooks/useCheckpoint';
import { toast } from "sonner";

interface LastStepPageProps {
  onNext: () => void;
  initialData?: unknown;
  isCompleted?: boolean;
}

// Global flag to track if completion toast has been shown in this session
let hasShownGlobalCompletedToast = false;

const LastStepPage: React.FC<LastStepPageProps> = ({ 
  onNext, 
  initialData, 
  isCompleted 
}) => {
  const [isChecked, setIsChecked] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esignUrl, setEsignUrl] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const esignWindowRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const windowCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use the checkpoint hook to check for existing eSign data
  const { 
    isStepCompleted,
    refetchStep 
  } = useCheckpoint();
  const shouldShowCompletedState = isStepCompleted(CheckpointStep.ESIGN);
  // Add keyboard event listener for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        
        // If already completed, continue to next step
        if (shouldShowCompletedState) {
          onNext();
          return;
        }
        
        // If eSign URL is available and not loading, proceed to eSign
        if (esignUrl && !isLoading) {
          handleEsignClick();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shouldShowCompletedState, esignUrl, isLoading]);

  // Check if eSign is already completed and show toast
  useEffect(() => {
    if (isStepCompleted(CheckpointStep.ESIGN)) {
      // eSign is already completed
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Show completion toast only once per session
      if (!hasShownGlobalCompletedToast) {
        toast.success("eSign already completed! You can proceed to the next step.");
        hasShownGlobalCompletedToast = true;
      }
      return;
    }

    // If not completed, initialize eSign
    if (!isInitialized && !isLoading && !esignUrl) {
      initializeEsign();
    }
  }, [isStepCompleted(CheckpointStep.ESIGN)]); // Only depend on step completion

  // Also check initialData as fallback
  useEffect(() => {
    const data = initialData as { esign?: boolean } | undefined;
    if (isCompleted && data?.esign) {
      setIsInitialized(true);
    }
  }, [initialData, isCompleted]);

  // Add message listener for popup communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_POPUP' || event.data?.type === 'ESIGN_COMPLETED') {
        cleanupPopup();
        
        // If it's a completion message, trigger a check
        if (event.data?.type === 'ESIGN_COMPLETED') {
          setTimeout(() => {
            refetchStep(CheckpointStep.ESIGN);
          }, 1000);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [refetchStep]);

  // Start background polling after initialization
  useEffect(() => {
    if (isInitialized && esignUrl && !isStepCompleted(CheckpointStep.ESIGN)) {
      startBackgroundPolling();
    }

    // Cleanup polling on unmount
    return () => {
      cleanupPolling();
      cleanupPopup();
    };
  }, [isInitialized, esignUrl, isStepCompleted]);

  const cleanupPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const cleanupPopup = () => {
    // Close popup window if still open
    if (esignWindowRef.current && !esignWindowRef.current.closed) {
      try {
        esignWindowRef.current.close();
      } catch (error) {
        console.error("Error closing popup:", error);
      }
      esignWindowRef.current = null;
    }
    
    // Clear window check interval
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
      windowCheckIntervalRef.current = null;
    }
  };

  const initializeEsign = async () => {
    // Prevent multiple simultaneous calls
    if (isLoading || esignUrl) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Updated redirect URL to the success page
      const redirectUrl = `${window.location.origin}/esign-success`;

      // Get the auth token
      const authToken = Cookies.get('authToken');
      
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        return;
      }

      // Initialize eSign session
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "esign_initialize",
          redirect_url: redirectUrl
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
        }
      );

      if (response.data?.data?.uri) {
        setEsignUrl(response.data.data.uri);
        setIsInitialized(true);
      } else {
        setError("Failed to initialize eSign. Please try again.");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: { message?: string; error?: { message?: string } };
          status?: number;
        };
        request?: unknown;
      };

      console.error("eSign initialization error:", err);
      if (error.response) {
        if (error.response.data?.message) {
          setError(`Error: ${error.response.data.message}`);
        } else if (error.response.data?.error?.message) {
          setError(`Error: ${error.response.data.error.message}`);
        } else if (error.response.status === 400) {
          setError("Invalid request. Please try again.");
        } else if (error.response.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else if (error.response.status === 403) {
          setError("Access denied. Please check your authentication and try again.");
        } else if (error.response.status === 500) {
          setError("Server error. Please try again in a few moments.");
        } else {
          setError(`Server error (${error.response.status}). Please try again.`);
        }
      } else if (error.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startBackgroundPolling = () => { 
    // Clear any existing polling interval
    cleanupPolling();
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        // Get the auth token for polling
        const authToken = Cookies.get('authToken');
        
        if (!authToken) {
          cleanupPolling();
          return;
        }
        
        // Step 1: First call the POST complete API to trigger completion check
        try {
          const completeResponse = await axios.post(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
            {
              step: "esign_complete"
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
              },
            }
          );
          if (completeResponse.status !== 200) {
            console.warn(completeResponse.status);
          }
        } catch (completeError) {
          const err = completeError as {
            response?: {
              status?: number;
              data?: unknown;
            };
          };
          
          // If POST complete fails with 401/404, eSign is not ready yet - continue polling
          if (err.response?.status === 401 || err.response?.status === 404) {
            return;
          }
        }

        // Step 2: Now check actual completion status using GET API (same as useCheckpoint)
        const statusResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint/esign_complete`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            },
          }
        );

        // Step 3: Validate completion using same logic as useCheckpoint hook
        if (statusResponse.status === 200) {
          const hasData = statusResponse.data?.data;
          const hasUrl = statusResponse.data?.data?.url;
          const urlValue = statusResponse.data?.data?.url;
          const isValidStructure = hasData && typeof hasUrl !== 'undefined';
          
          if (isValidStructure) {
            // eSign completed successfully - same validation as useCheckpoint
            cleanupPolling();

            console.warn(urlValue);
            toast.success("eSign completed successfully!");
            
            // Clean up the popup window
            cleanupPopup();
            
            // Refetch eSign step to update the hook
            refetchStep(CheckpointStep.ESIGN);
            
            // Wait a bit longer for the hook to update, then advance
            setTimeout(() => {
              onNext();
            }, 1000);
          } else {
            console.warn("eSign GET endpoint returned success but invalid data structure for completion");
          }
        }
        
      } catch (err: unknown) {
        const error = err as {
          response?: {
            data?: { message?: string; error?: { message?: string } };
            status?: number;
          };
        };

        // Handle specific eSign polling errors - same as useCheckpoint hook
        if (error.response?.status === 404) {
          // 404 means eSign not found in database - not completed yet
          return;
        } else if (error.response?.status === 401) {
          // 401 means eSign not authorized - not completed yet
          return;
        } else if (error.response?.status === 500) {
          // 500 server error - continue polling for a bit
          return;
        }
        
        // For other critical errors, stop polling
        console.error("Critical eSign polling error:", err);
        cleanupPolling();
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 7 minutes (timeout)
    setTimeout(() => {
      cleanupPolling();
    }, 7 * 60 * 1000);
  };

  const handleEsignClick = () => {
    if (!esignUrl) {
      setError("eSign URL not available. Please try again.");
      return;
    }

    // Open eSign URL in new window/tab with specific name and features
    const esignWindow = window.open(
      esignUrl,
      'esign', // Named window for identification
      'width=800,height=600,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=no,status=no'
    );

    if (!esignWindow) {
      setError("Please allow popups for eSign to work. Then try again.");
      return;
    }

    // Store reference to the window
    esignWindowRef.current = esignWindow;

    // Clear any existing window check interval
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
    }

    // Monitor if the window is closed manually
    windowCheckIntervalRef.current = setInterval(() => {
      if (esignWindow.closed) {
        clearInterval(windowCheckIntervalRef.current!);
        windowCheckIntervalRef.current = null;
        esignWindowRef.current = null;
      }
    }, 1000);

    toast.success("eSign window opened. Complete the process there.");
  };

  const handleRetry = () => {
    setError(null);
    setEsignUrl(null);
    setIsInitialized(false);
    
    // Clean up everything
    cleanupPolling();
    cleanupPopup();
  };



  // Show initialization loading
  if (!isInitialized && isLoading) {
    return (
      <div className="mx-auto p-4 mt-10">
        <FormHeading
          title="Finish account set-up using Aadhar E-sign"
          description="Initializing eSign session..."
        />
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">Setting up eSign...</span>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (!isInitialized && error) {
    return (
      <div className="mx-auto p-4 mt-10">
        <FormHeading
          title="Finish account set-up using Aadhar E-sign"
          description="Failed to initialize eSign session."
        />
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
        <Button
          onClick={handleRetry}
          variant="ghost"
          className="w-full py-6"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (shouldShowCompletedState) {
    return (
      <div className="mx-auto p-4 mt-10">
        <FormHeading
          title="Finish account set-up using Aadhar E-sign"
          description="E-sign and complete your onboarding instantly."
        />

        <div className="flex justify-center mb-6">
          <div className="inline-block">
            <Image 
              width={100} 
              height={80} 
              src='/signup/e-sign.png' 
              alt="Aadhar E-sign Completed" 
              className="max-w-full h-auto rotate-90" 
            />
          </div>
        </div>

        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="text-green-800 font-medium">eSign Completed Successfully!</h3>
              <p className="text-green-700 text-sm">Your KYC documents have been digitally signed.</p>
            </div>
          </div>
        </div>

        <Button 
          variant="ghost"
          onClick={onNext} 
          className="py-6 w-full"
        >
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto p-4 mt-10">
      <FormHeading
        title="Finish account set-up using Aadhar E-sign"
        description="E-sign and complete your onboarding instantly."
      />
      
      <div className="flex justify-center -mt-10">
        <div className="inline-block">
          <Image 
            width={100} 
            height={80} 
            src='/signup/e-sign.png' 
            alt="Aadhar E-sign" 
            className="max-w-full h-auto rotate-90" 
          />
        </div>
      </div>
      
      <div className="mb-6 flex items-center cursor-pointer" onClick={() => setIsChecked(!isChecked)}>
        <div
          className={`h-6 w-6 flex items-center justify-center border-2 rounded-lg transition-colors cursor-pointer
            ${isChecked ? "border-green-600 bg-white" : "border-gray-400"}`}
        >
          {isChecked && <Check className="h-4 w-4 text-green-600" />}
        </div>
        <label className="text-sm text-gray-600 ml-2 cursor-pointer">
          I would like to receive ECN and other communications via email.
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Try Again
          </button>
        </div>
      )}
      
      <Button 
        variant="ghost"
        onClick={handleEsignClick} 
        disabled={!esignUrl}
        className={`py-6 w-full ${
          !esignUrl ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        Proceed to E-sign
      </Button>

      <div className="hidden sm:block mt-4 text-center text-xs text-gray-600">
        <p>
          Clicking the button will open eSign in a new window. 
          Complete the process there and this page will automatically proceed to the next step.
        </p>
      </div>
    </div>
  );
};

export default LastStepPage;