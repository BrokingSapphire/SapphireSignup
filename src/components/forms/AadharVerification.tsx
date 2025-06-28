import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from 'js-cookie';
import { useCheckpoint, CheckpointStep } from '@/hooks/useCheckpoint';
import { toast } from "sonner";

interface AadhaarVerificationProps {
  onNext: () => void;
  initialData?: unknown;
  isCompleted?: boolean;
  panMaskedAadhaar?: string; // Masked Aadhaar from PAN verification
}

// Global flag to track if completion toast has been shown in this session
let hasShownGlobalCompletedToast = false;

const getFullNameFromStorage = () => {
  const sources = [
    localStorage.getItem("full_name"),
  ];
  
  for (const source of sources) {
    if (source && source.trim()) {
      console.log("Found full_name from storage:", source);
      return source.trim();
    }
  }
  
  console.log("No full_name found in storage, using empty string");
  return "";
};

const AadhaarVerification = ({ 
  onNext, 
  isCompleted,
  panMaskedAadhaar
}: AadhaarVerificationProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'initial' | 'digilocker_pending' | 'mismatch'>('initial');
  const [digilockerUrl, setDigilockerUrl] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Popup window management
  const digilockerWindowRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const windowCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Aadhaar mismatch form state
  const [mismatchFormData, setMismatchFormData] = useState({
    full_name: getFullNameFromStorage(),
    dob: ''
  });
  
  const [isSubmittingMismatch, setIsSubmittingMismatch] = useState(false);
  const [, setMismatchInfo] = useState<{
    pan_masked_aadhaar?: string;
    digilocker_masked_aadhaar?: string;
    requires_manual_review?: boolean;
  }>({});

  // Use the checkpoint hook
  const { 
    hasMismatchData, 
    getMismatchData, 
    isStepCompleted,
    getStepData,
    refetchStep 
  } = useCheckpoint();

  // Add keyboard event listener for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // For mismatch form, let the form handle Enter naturally
      if (currentStep === 'mismatch') {
        return;
      }

      // For main DigiLocker interface, handle Enter to trigger continue/proceed
      if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        handleDigilockerClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isLoading, digilockerUrl]);

  // Enhanced full_name monitoring
  useEffect(() => {
    const checkForFullName = () => {
      const currentFullName = getFullNameFromStorage();
      if (currentFullName && currentFullName !== mismatchFormData.full_name) {
        console.log("Updating full_name from storage:", currentFullName);
        setMismatchFormData(prev => ({
          ...prev,
          full_name: currentFullName
        }));
      }
    };

    checkForFullName();
    const fullNameCheckInterval = setInterval(checkForFullName, 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'full_name' && e.newValue) {
        console.log("full_name updated via storage event:", e.newValue);
        setMismatchFormData(prev => ({
          ...prev,
          full_name: e.newValue || ""
        }));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(fullNameCheckInterval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [mismatchFormData.full_name]);

  // Get full_name from PAN step data
  useEffect(() => {
    const panData = getStepData(CheckpointStep.PAN);
    if (panData?.full_name && typeof panData.full_name === 'string') {
      const panFullName = panData.full_name.trim();
      console.log("Found full_name from PAN step data:", panFullName);
      
      localStorage.setItem("full_name", panFullName);
      
      if (!mismatchFormData.full_name || mismatchFormData.full_name !== panFullName) {
        setMismatchFormData(prev => ({
          ...prev,
          full_name: panFullName
        }));
      }
    }
  }, [getStepData, mismatchFormData.full_name]);

  // Check Aadhaar completion status and show toast
  useEffect(() => {
    if (isStepCompleted(CheckpointStep.AADHAAR)) {
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Show completion toast only once per session
      if (!hasShownGlobalCompletedToast) {
        toast.success("Aadhaar verification already completed! You can proceed to the next step.");
        hasShownGlobalCompletedToast = true;
      }
      return;
    }

    // Check for existing mismatch data
    if (hasMismatchData()) {
      const existingMismatchData = getMismatchData();
      console.log('Found existing mismatch data:', existingMismatchData);
      
      setMismatchInfo({
        pan_masked_aadhaar: typeof existingMismatchData?.pan_masked_aadhaar === 'string'
          ? existingMismatchData.pan_masked_aadhaar
          : panMaskedAadhaar,
        digilocker_masked_aadhaar: typeof existingMismatchData?.digilocker_masked_aadhaar === 'string'
          ? existingMismatchData.digilocker_masked_aadhaar
          : undefined,
        requires_manual_review: typeof existingMismatchData?.requires_manual_review === 'boolean'
          ? existingMismatchData.requires_manual_review
          : undefined
      });
      
      setCurrentStep('mismatch');
      setIsInitialized(true);
      return;
    }

    // Mark as initialized but don't auto-load DigiLocker URL
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [isStepCompleted(CheckpointStep.AADHAAR), hasMismatchData()]);

  // Add message listener for popup communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_POPUP' || event.data?.type === 'DIGILOCKER_COMPLETED') {
        console.log("Received close/completion message from popup");
        cleanupPopup();
        
        // If it's a completion message, trigger a check
        if (event.data?.type === 'DIGILOCKER_COMPLETED') {
          setTimeout(() => {
            refetchStep(CheckpointStep.AADHAAR);
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
    // Only auto-start polling if DigiLocker window is open and we have a URL
    if (isInitialized && digilockerUrl && digilockerWindowRef.current && !digilockerWindowRef.current.closed && !isStepCompleted(CheckpointStep.AADHAAR)) {
      startBackgroundPolling();
    }

    // Cleanup polling on unmount
    return () => {
      cleanupPolling();
      cleanupPopup();
    };
  }, [isInitialized, digilockerUrl, isStepCompleted]);

  const cleanupPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const cleanupPopup = () => {
    // Close popup window if still open
    if (digilockerWindowRef.current && !digilockerWindowRef.current.closed) {
      try {
        digilockerWindowRef.current.close();
      } catch (error) {
        console.log("Error closing popup:", error);
      }
      digilockerWindowRef.current = null;
    }
    
    // Clear window check interval
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
      windowCheckIntervalRef.current = null;
    }
  };

  const initializeDigilocker = async () => {
    console.log("initializeDigilocker called - isLoading:", isLoading, "digilockerUrl:", digilockerUrl);
    
    // Prevent multiple simultaneous calls
    if (isLoading || digilockerUrl) {
      console.log("Already initializing or URL exists, skipping...");
      return Promise.resolve();
    }

    setIsLoading(true);
    setError(null);

    try {
      // Updated redirect URL to the success page
      const redirectUrl = `${window.location.origin}/digilocker-success`;

      // Get the auth token
      const authToken = Cookies.get('authToken');
      
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        setIsLoading(false);
        return Promise.reject(new Error("No auth token"));
      }

      console.log("Making API call to initialize DigiLocker session...");

      // Initialize DigiLocker session
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "aadhaar_uri",
          redirect: redirectUrl
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
        }
      );

      console.log("DigiLocker initialization response:", response.data);

      if (response.data?.data?.uri) {
        console.log("DigiLocker session initialized with URL:", response.data.data.uri);
        setDigilockerUrl(response.data.data.uri);
        setIsInitialized(true);
        return Promise.resolve();
      } else {
        setError("Failed to initialize DigiLocker. Please try again.");
        return Promise.reject(new Error("No URI received"));
      }
    } catch (err: unknown) {
      const error = err as {
        response?: {
          data?: { message?: string; error?: { message?: string } };
          status?: number;
        };
        request?: unknown;
      };

      console.error("DigiLocker initialization error:", err);
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
      return Promise.reject(err);
    } finally {
      setIsLoading(false);
    }
  };

  const startBackgroundPolling = () => {
    console.log("Starting background polling for Aadhaar completion...");
    
    // Clear any existing polling interval
    cleanupPolling();
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        // Get the auth token for polling
        const authToken = Cookies.get('authToken');
        
        if (!authToken) {
          console.log("No auth token, stopping polling");
          cleanupPolling();
          return;
        }
        
        console.log("Background polling for Aadhaar completion...");
        
        // Step 1: First call the POST complete API to trigger completion check
        try {
          const completeResponse = await axios.post(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
            {
              step: "aadhaar"
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
              },
            }
          );
          console.log("Aadhaar POST complete response:", completeResponse.status, completeResponse.data);
          
          // Check for Aadhaar mismatch in POST response
          if (completeResponse.data?.data?.requires_additional_verification) {
            cleanupPolling();
            setMismatchInfo({
              pan_masked_aadhaar: completeResponse.data.data.pan_masked_aadhaar || panMaskedAadhaar,
              digilocker_masked_aadhaar: completeResponse.data.data.digilocker_masked_aadhaar
            });
            setCurrentStep('mismatch');
            
            toast.warning("Aadhaar mismatch detected. Please provide additional details.");
            
            // Clean up the popup window
            cleanupPopup();
            
            // Refetch the mismatch checkpoint to update the hook
            refetchStep(CheckpointStep.AADHAAR_MISMATCH_DETAILS);
            return;
          }
          
        } catch (completeError) {
          const err = completeError as {
            response?: {
              status?: number;
              data?: unknown;
            };
          };
          console.log("Aadhaar POST complete error:", err.response?.status, err.response?.data);
          
          // If POST complete fails with 401/404, Aadhaar is not ready yet - continue polling
          if (err.response?.status === 401 || err.response?.status === 404) {
            console.log("Aadhaar not ready yet, continuing to poll...");
            return;
          }
        }

        // Step 2: Now check actual completion status using GET API (same as useCheckpoint)
        const statusResponse = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint/aadhaar`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            },
          }
        );

        console.log("Aadhaar GET status check response:", statusResponse.status, statusResponse.data);

        // Step 3: Validate completion using same logic as useCheckpoint hook
        if (statusResponse.status === 200 && statusResponse.data?.data) {
          // Aadhaar completed successfully - same validation as useCheckpoint
          cleanupPolling();
          
          console.log("Aadhaar completed successfully detected by polling!");
          toast.success("Aadhaar verification completed successfully!");
          
          // Clean up the popup window
          cleanupPopup();
          
          // Refetch Aadhaar step to update the hook
          refetchStep(CheckpointStep.AADHAAR);
          
          // Wait a bit for the hook to update, then advance
          setTimeout(() => {
            console.log("Auto-advancing to next step after Aadhaar completion");
            onNext();
          }, 1000);
        }
        
      } catch (err: unknown) {
        const error = err as {
          response?: {
            data?: { message?: string; error?: { message?: string } };
            status?: number;
          };
        };

        console.log("Aadhaar polling error:", error.response?.status, error.response?.data);

        // Handle specific Aadhaar polling errors - same as useCheckpoint hook
        if (error.response?.status === 404) {
          // 404 means Aadhaar not found in database - not completed yet
          console.log("Aadhaar not found in database (404) - not completed yet, continuing to poll...");
          return;
        } else if (error.response?.status === 401) {
          // 401 means Aadhaar not authorized - not completed yet
          console.log("Aadhaar not authorized (401) - not completed yet, continuing to poll...");
          return;
        } else if (error.response?.status === 500) {
          // 500 server error - continue polling for a bit
          console.log("Server error (500), continuing to poll...");
          return;
        }
        
        // For other critical errors, stop polling
        console.error("Critical Aadhaar polling error:", err);
        cleanupPolling();
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 7 minutes (timeout)
    setTimeout(() => {
      cleanupPolling();
      console.log("Aadhaar polling timeout after 7 minutes");
    }, 7 * 60 * 1000);
  };

  const handleDigilockerClick = () => {
    // If already completed, just proceed to next step
    if (isCompleted || isStepCompleted(CheckpointStep.AADHAAR)) {
      onNext();
      return;
    }

    // If no URL yet, initialize DigiLocker first
    if (!digilockerUrl) {
      initializeDigilocker().then(() => {
        // After initialization, open the URL if available
        if (digilockerUrl) {
          openDigilockerPopup();
        }
      });
      return;
    }

    // Open DigiLocker popup
    openDigilockerPopup();
  };

  const openDigilockerPopup = () => {
    if (!digilockerUrl) {
      setError("DigiLocker URL not available. Please try again.");
      return;
    }

    console.log("Opening DigiLocker URL:", digilockerUrl);

    // Open DigiLocker URL in new window/tab with specific name and features
    const digilockerWindow = window.open(
      digilockerUrl,
      'digilocker', // Named window for identification
      'width=800,height=600,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=no,status=no'
    );

    if (!digilockerWindow) {
      setError("Please allow popups for DigiLocker to work. Then try again.");
      return;
    }

    // Store reference to the window
    digilockerWindowRef.current = digilockerWindow;

    // Clear any existing window check interval
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
    }

    // Monitor if the window is closed manually
    windowCheckIntervalRef.current = setInterval(() => {
      if (digilockerWindow.closed) {
        clearInterval(windowCheckIntervalRef.current!);
        windowCheckIntervalRef.current = null;
        digilockerWindowRef.current = null;
        console.log("DigiLocker window was closed");
      }
    }, 1000);

    // Start polling when popup opens
    startBackgroundPolling();

    toast.success("DigiLocker window opened. Complete the process there.");
  };

  const handleRetry = () => {
    setError(null);
    setDigilockerUrl('');
    setIsInitialized(false);
    
    // Clean up everything
    cleanupPolling();
    cleanupPopup();
  };

  // Handle Aadhaar mismatch form submission
  const handleMismatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mismatchFormData.full_name.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    
    if (!mismatchFormData.dob) {
      toast.error("Please select your date of birth");
      return;
    }
    
    setIsSubmittingMismatch(true);
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      
      if (!authToken) {
        toast.error("Authentication token not found. Please restart the process.");
        setIsSubmittingMismatch(false);
        return;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "aadhaar_mismatch_details",
          full_name: mismatchFormData.full_name.trim(),
          dob: mismatchFormData.dob
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.data?.message) {
        setMismatchInfo(prev => ({
          ...prev,
          requires_manual_review: response.data.data?.requires_manual_review
        }));
        
        // Reset to initial state
        setCurrentStep('initial');
        
        // Refetch both checkpoints to update the hook
        refetchStep(CheckpointStep.AADHAAR_MISMATCH_DETAILS);
        refetchStep(CheckpointStep.AADHAAR);
        
        // Auto-advance after 2 seconds
        setTimeout(() => {
          onNext();
        }, 1000);
      } else {
        toast.error("Failed to submit additional details. Please try again.");
      }

    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string; error?: { message?: string } }; status?: number } };
      const errorMessage = 
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Failed to submit additional details. Please try again.";
      
      toast.error(errorMessage);
    } finally {
      setIsSubmittingMismatch(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setMismatchFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const shouldShowCompletedState = isStepCompleted(CheckpointStep.AADHAAR);

  // Show initialization loading only when actively loading
  if (isLoading && !shouldShowCompletedState) {
    return (
      <div className="mx-auto -mt-28 sm:mt-0 pt-20">
        <FormHeading
          title="Verify Aadhaar (DigiLocker)"
          description="Initializing DigiLocker session..."
        />
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">Setting up DigiLocker...</span>
        </div>
      </div>
    );
  }

  // Show Aadhaar mismatch form
  if (currentStep === 'mismatch') {
    return (
      <div className="mx-auto -mt-28 sm:mt-0 pt-20">
        <FormHeading
          title={"Additional Verification Required"}
          description={"We detected a mismatch between your PAN and Aadhaar details. Please provide additional information to complete verification."}
        />

        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-yellow-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-800 mb-1">Aadhaar Mismatch Detected</h3>
              <p className="text-yellow-700 text-sm mb-2">
                The Aadhaar number linked to your PAN doesn&apos;t match the one from DigiLocker verification.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleMismatchSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name (as per Aadhaar) *
            </label>
            <input
              type="text"
              required
              value={mismatchFormData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your full name as per Aadhaar"
              disabled={isSubmittingMismatch}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth (as per Aadhaar) *
            </label>
            <input
              type="date"
              required
              value={mismatchFormData.dob}
              onChange={(e) => handleInputChange('dob', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmittingMismatch}
            />
          </div>

          <Button
            type="submit"
            variant="ghost"
            className={`w-full py-6 ${isSubmittingMismatch ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={isSubmittingMismatch || !mismatchFormData.full_name.trim() || !mismatchFormData.dob}
          >
            {isSubmittingMismatch ? "Submitting..." : "Submit Additional Details"}
          </Button>
        </form>

        <div className="hidden lg:block text-center text-xs text-gray-600 mt-6">
          <p>Please ensure all details match exactly with your Aadhaar card.</p>
        </div>
      </div>
    );
  }

  // Show completed state
  if (shouldShowCompletedState) {
    return (
      <div className="mx-auto -mt-28 sm:mt-0 pt-20">
        <FormHeading
          title="Verify Aadhaar (DigiLocker)"
          description="Fast and easy Aadhaar-based verification."
        />

        <div className="flex justify-center mb-6">
          <div className="inline-block">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
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

  // Show main DigiLocker interface
  return (
    <div className="mx-auto -mt-28 sm:mt-0 pt-20">
      <FormHeading
        title={"Verify Aadhaar (DigiLocker)"}
        description={"Fast and easy Aadhaar-based verification."}
      />

      <div className="bg-blue-50 p-6 rounded-lg mb-8">
        <div className="flex items-start mb-4">
          <div className="bg-blue-100 p-2 rounded-full mr-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-600"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-sm md:text-base font-semibold text-blue-800 mb-1">
              Why DigiLocker?
            </h3>
            <p className="text-sm sm:text-xs md:text-sm text-blue-700">
              DigiLocker is a secure digital platform by the Government of India
              that allows you to access and share your documents easily.
            </p>
          </div>
        </div>

        <div className="flex items-start">
          <div className="bg-blue-100 p-2 rounded-full mr-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-600"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-sm md:text-base font-semibold text-blue-800 mb-1">
              Benefits of DigiLocker
            </h3>
            <ul className="text-sm sm:text-xs md:text-sm text-blue-700 list-disc ml-4 space-y-1">
              <li>Faster verification with no manual paperwork</li>
              <li>Secure government-approved platform</li>
              <li>Instant KYC verification</li>
            </ul>
          </div>
        </div>
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
        onClick={handleDigilockerClick} 
        disabled={isLoading}
        className={`py-6 w-full ${
          isLoading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
        )}
        {shouldShowCompletedState ? "Continue to Next Step" : (isLoading ? "Loading..." : "Proceed to DigiLocker")}
      </Button>

      <div className="hidden lg:block mt-4 text-center text-xs text-gray-600">
        <p>
          Clicking the button will open DigiLocker in a new window. 
          Complete the process there and this page will automatically proceed to the next step.
        </p>
      </div>
    </div>
  );
};

export default AadhaarVerification;