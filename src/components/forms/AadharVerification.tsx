import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from 'js-cookie';
import { useCheckpoint, CheckpointStep } from '@/hooks/useCheckpoint';
import { toast } from "sonner";

const getDateRestrictions = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // Maximum date: today (no future dates)
  
  // Minimum date: 18 years ago from today
  const minYear = currentYear - 100; // Allow up to 100 years old
  const minDate = `${minYear}-01-01`;
  
  // Calculate the exact date 18 years ago
  const eighteenYearsAgo = new Date(today);
  eighteenYearsAgo.setFullYear(currentYear - 18);
  
  const maxAllowedYear = eighteenYearsAgo.getFullYear();
  const maxAllowedMonth = String(eighteenYearsAgo.getMonth() + 1).padStart(2, '0');
  const maxAllowedDay = String(eighteenYearsAgo.getDate()).padStart(2, '0');
  
  const maxAllowedDate = `${maxAllowedYear}-${maxAllowedMonth}-${maxAllowedDay}`;
  
  return {
    min: minDate,
    max: maxAllowedDate
  };
};

const formatNameToTitleCase = (name: string): string => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

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
      // Format the name to title case before returning
      return formatNameToTitleCase(source.trim());
    }
  }
  return "";
};

// DigiLocker session management
const DIGILOCKER_STORAGE_KEYS = {
  REDIRECT_FLOW: 'digilocker_redirect_flow',
  SESSION_URL: 'digilocker_session_url',
  POPUP_FAILED: 'digilocker_popup_failed',
  RETURN_FROM_REDIRECT: 'digilocker_return_from_redirect'
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
  const [isRedirectFlow, setIsRedirectFlow] = useState(false);
  
  // Popup window management
  const digilockerWindowRef = useRef<Window | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const windowCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Component mount tracking for cleanup
  const isComponentMounted = useRef(true);
  
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMounted.current = false;
      cleanupPolling();
      cleanupPopup();
    };
  }, []);

  // Check if returning from DigiLocker redirect
  useEffect(() => {
    const checkRedirectReturn = () => {
      const wasRedirectedFromDigilocker = localStorage.getItem(DIGILOCKER_STORAGE_KEYS.REDIRECT_FLOW);
      const returnFromRedirect = localStorage.getItem(DIGILOCKER_STORAGE_KEYS.RETURN_FROM_REDIRECT);
      const savedUrl = localStorage.getItem(DIGILOCKER_STORAGE_KEYS.SESSION_URL);
      
      if (wasRedirectedFromDigilocker === 'true' || returnFromRedirect === 'true') {
        setIsRedirectFlow(true);
        
        // Restore the DigiLocker URL if available
        if (savedUrl) {
          setDigilockerUrl(savedUrl);
        }
        
        // Clean up redirect flags
        localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.REDIRECT_FLOW);
        localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.RETURN_FROM_REDIRECT);
        
        // Show status message
        toast.info("Checking DigiLocker verification status...", {
          duration: 3000
        });
        
        // Start polling immediately to check status
        setTimeout(() => {
          if (isComponentMounted.current) {
            startBackgroundPolling();
          }
        }, 1000);
      }
    };

    checkRedirectReturn();
  }, []);

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
  }, [currentStep, isLoading]);

  // Enhanced full_name monitoring
  useEffect(() => {
    const checkForFullName = () => {
      const currentFullName = getFullNameFromStorage();
      if (currentFullName && currentFullName !== mismatchFormData.full_name) {
        setMismatchFormData(prev => ({
          ...prev,
          full_name: formatNameToTitleCase(currentFullName)
        }));
      }
    };

    checkForFullName();
    const fullNameCheckInterval = setInterval(checkForFullName, 1000);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'full_name' && e.newValue) {
        setMismatchFormData(prev => ({
          ...prev,
          full_name: formatNameToTitleCase(e.newValue || "")
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
      const panFullName = formatNameToTitleCase(panData.full_name.trim());
      
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
        cleanupPopup();
        
        // If it's a completion message, trigger a check
        if (event.data?.type === 'DIGILOCKER_COMPLETED') {
          setTimeout(() => {
            if (isComponentMounted.current) {
              refetchStep(CheckpointStep.AADHAAR);
            }
          }, 1000);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [refetchStep]);

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
        console.error("Error closing DigiLocker popup:", error);
      }
      digilockerWindowRef.current = null;
    }
    
    // Clear window check interval
    if (windowCheckIntervalRef.current) {
      clearInterval(windowCheckIntervalRef.current);
      windowCheckIntervalRef.current = null;
    }
  };

  const startBackgroundPolling = () => {
    // Clear any existing polling interval
    cleanupPolling();
    
    pollIntervalRef.current = setInterval(async () => {
      if (!isComponentMounted.current) {
        cleanupPolling();
        return;
      }

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
              step: "aadhaar"
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
              },
            }
          );
          
          // Check for Aadhaar mismatch in POST response
          if (completeResponse.data?.data?.requires_additional_verification) {
            cleanupPolling();
            if (isComponentMounted.current) {
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
            }
            return;
          }
          
        } catch (completeError) {
          const err = completeError as {
            response?: {
              status?: number;
              data?: unknown;
            };
          };
          console.error("Aadhaar POST complete error:", err.response?.status, err.response?.data);

          // If POST complete fails with 401/404, Aadhaar is not ready yet - continue polling
          if (err.response?.status === 401 || err.response?.status === 404) {
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

        // Step 3: Validate completion using same logic as useCheckpoint hook
        if (statusResponse.status === 200 && statusResponse.data?.data) {
          // Aadhaar completed successfully - same validation as useCheckpoint
          cleanupPolling();
          
          if (isComponentMounted.current) {
            // Clean up storage
            localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.SESSION_URL);
            localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.POPUP_FAILED);
            
            toast.success("Aadhaar verification completed successfully!");
            
            // Clean up the popup window
            cleanupPopup();
            
            // Refetch Aadhaar step to update the hook
            refetchStep(CheckpointStep.AADHAAR);
            
            // Wait a bit for the hook to update, then advance
            setTimeout(() => {
              if (isComponentMounted.current) {
                onNext();
              }
            }, 1000);
          }
        }
        
      } catch (err: unknown) {
        const error = err as {
          response?: {
            data?: { message?: string; error?: { message?: string } };
            status?: number;
          };
        };

        console.error("Aadhaar polling error:", error.response?.status, error.response?.data);

        // Handle specific Aadhaar polling errors - same as useCheckpoint hook
        if (error.response?.status === 404) {
          // 404 means Aadhaar not found in database - not completed yet
          return;
        } else if (error.response?.status === 401) {
          // 401 means Aadhaar not authorized - not completed yet
          return;
        } else if (error.response?.status === 500) {
          // 500 server error - continue polling for a bit
          return;
        }
        
        // For other critical errors, stop polling
        console.error("Critical Aadhaar polling error:", err);
        cleanupPolling();
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 7 minutes (timeout)
    setTimeout(() => {
      if (isComponentMounted.current) {
        cleanupPolling();
      }
    }, 7 * 60 * 1000);
  };

  // Enhanced DigiLocker handler with popup blocking detection
  const handleDigilockerClick = async () => {
    // If already completed, just proceed to next step
    if (isCompleted || isStepCompleted(CheckpointStep.AADHAAR)) {
      onNext();
      return;
    }

    // Prevent multiple clicks while processing
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let urlToOpen = digilockerUrl;

      // If no URL yet, initialize DigiLocker first
      if (!urlToOpen) {
        // Get the auth token
        const authToken = Cookies.get('authToken');
        
        if (!authToken) {
          setError("Authentication token not found. Please restart the process.");
          return;
        }

        // Updated redirect URL to the success page
        const redirectUrl = `${window.location.origin}/digilocker-success`;

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
            timeout: 30000, // 30 second timeout
          }
        );

        if (response.data?.data?.uri) {
          urlToOpen = response.data.data.uri;
          setDigilockerUrl(urlToOpen);
          
          // Save URL to localStorage for redirect flow
          localStorage.setItem(DIGILOCKER_STORAGE_KEYS.SESSION_URL, urlToOpen);
          
          setIsInitialized(true);
        } else {
          setError("Failed to initialize DigiLocker. Please try again.");
          return;
        }
      }

      // Try to open popup first
      const digilockerWindow = window.open(
        urlToOpen,
        'digilocker',
        'width=500,height=600,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=no,status=no'
      );

      // Check if popup was blocked
      if (!digilockerWindow || digilockerWindow.closed || typeof digilockerWindow.closed === 'undefined') {
        // Popup blocked - use redirect flow
        handlePopupBlocked(urlToOpen);
        return;
      }

      // Popup opened successfully
      digilockerWindowRef.current = digilockerWindow;

      // Clear any existing window check interval
      if (windowCheckIntervalRef.current) {
        clearInterval(windowCheckIntervalRef.current);
      }

      // Monitor if the window is closed manually
      windowCheckIntervalRef.current = setInterval(() => {
        if (!isComponentMounted.current) {
          if (windowCheckIntervalRef.current) {
            clearInterval(windowCheckIntervalRef.current);
            windowCheckIntervalRef.current = null;
          }
          return;
        }

        if (digilockerWindow.closed) {
          clearInterval(windowCheckIntervalRef.current!);
          windowCheckIntervalRef.current = null;
          digilockerWindowRef.current = null;
        }
      }, 1000);

      // Start polling when popup opens
      startBackgroundPolling();

      toast.success("DigiLocker window opened. Complete the process there.");

    } catch (err: unknown) {
      if (!isComponentMounted.current) return;

      const error = err as {
        response?: {
          data?: { message?: string; error?: { message?: string } };
          status?: number;
        };
        request?: unknown;
        code?: string;
      };

      console.error("DigiLocker error:", err);
      
      if (error.code === 'ECONNABORTED') {
        setError("Request timeout. Please check your internet connection and try again.");
      } else if (error.response) {
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
      if (isComponentMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Handle popup blocking - redirect flow
  const handlePopupBlocked = (urlToOpen: string) => {
    // Mark as popup failed and set redirect flow
    localStorage.setItem(DIGILOCKER_STORAGE_KEYS.POPUP_FAILED, 'true');
    localStorage.setItem(DIGILOCKER_STORAGE_KEYS.REDIRECT_FLOW, 'true');
    
    // Show user-friendly message
    toast.info("Opening DigiLocker in this tab...", {
      duration: 2000
    });
    
    // Wait a moment then redirect
    setTimeout(() => {
      window.location.href = urlToOpen;
    }, 1500);
  };

  const handleRetry = () => {
    setError(null);
    setDigilockerUrl('');
    setIsInitialized(false);
    
    // Clean up everything including storage
    cleanupPolling();
    cleanupPopup();
    localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.SESSION_URL);
    localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.POPUP_FAILED);
    localStorage.removeItem(DIGILOCKER_STORAGE_KEYS.REDIRECT_FLOW);
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
        
        toast.success("Additional details submitted successfully!");
        
        // Auto-advance after 1 second
        setTimeout(() => {
          if (isComponentMounted.current) {
            onNext();
          }
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
      if (isComponentMounted.current) {
        setIsSubmittingMismatch(false);
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'dob') {
      // Validate age when date is selected
      const selectedDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - selectedDate.getFullYear();
      const monthDiff = today.getMonth() - selectedDate.getMonth();
      
      // Check if they haven't had their birthday this year yet
      const hasHadBirthdayThisYear = monthDiff > 0 || (monthDiff === 0 && today.getDate() >= selectedDate.getDate());
      const actualAge = hasHadBirthdayThisYear ? age : age - 1;
      
      if (actualAge < 18) {
        toast.error("You must be at least 18 years old to proceed");
        return; // Don't update the state with invalid date
      }
      
      if (selectedDate > today) {
        toast.error("Date of birth cannot be in the future");
        return; // Don't update the state with future date
      }
    }
    
    setMismatchFormData(prev => ({
      ...prev,
      [field]: field === 'full_name' ? formatNameToTitleCase(value) : value
    }));
  };

  const shouldShowCompletedState = isStepCompleted(CheckpointStep.AADHAAR);

  // Show initialization loading only when actively loading
  if (isLoading && !shouldShowCompletedState) {
    const loadingMessage = isRedirectFlow 
      ? "Checking DigiLocker verification status..." 
      : "Setting up DigiLocker session...";
      
    return (
      <div className="mx-auto -mt-28 sm:mt-0 pt-20">
        <FormHeading
          title="Verify Aadhaar (DigiLocker)"
          description={loadingMessage}
        />
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">
            {isRedirectFlow ? "Checking status..." : "Initializing DigiLocker..."}
          </span>
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
              min={getDateRestrictions().min}
              max={getDateRestrictions().max}
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

  // Show main DigiLocker interface - SAME UI FOR BOTH COMPLETED AND NOT COMPLETED
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

        <div className="hidden lg:flex items-start">
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
          <div className="">
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
        {shouldShowCompletedState ? "Continue" : (isLoading ? "Setting up DigiLocker..." : "Proceed to DigiLocker")}
      </Button>

      <div className="hidden lg:block mt-4 text-center text-xs text-gray-600">
        <p>
          {shouldShowCompletedState 
            ? "Aadhaar verification completed. Click Continue to proceed to the next step."
            : "Clicking the button will open DigiLocker. Complete the process and this page will automatically proceed to the next step."
          }
        </p>
      </div>
    </div>
  );
};

export default AadhaarVerification;