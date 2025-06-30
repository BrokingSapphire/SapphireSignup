"use client";
import React, { useState, useEffect, useCallback } from "react";
import LeftPanel from "./LeftPanel";
import MobileVerification from "../forms/MobileVerification";
import EmailVerification from "../forms/EmailVerification";
import AadhaarVerification from "../forms/AadharVerification";
import TradingAccountDetails from "../forms/TradingAccountDetails";
import PANVerify from "../forms/PANVerify";
import TradingAccountDetails2 from "../forms/TradingAccountDetails2";
import IPVVerification from "../forms/IPV";
import NomineeSelection from "../forms/NomineeSelection";
import LastStepPage from "../forms/ESign";
import CongratulationsPage from "../forms/Congratulations";
import InvestmentSegment from "../forms/InvestmentSegment.tsx";
import TradingPreferences from "../forms/TradingPreferences";
import { ChevronDown, ChevronUp } from "lucide-react";
import BankAccountLinking from "../forms/BankAccountLinking";
import SignatureComponent from "../forms/Signature";
import MPIN from "../forms/MPIN";
import { useCheckpoint, CheckpointStep } from "@/hooks/useCheckpoint";
import { useUrlStateRecovery } from "@/hooks/useUrlStateRecovery"; // Import the new hook
import SetPassword from "../forms/SetPassword";
import { toast } from "sonner";
import axios from "axios";
import Cookies from "js-cookie";
import { queryClient } from "@/providers/QueryProvider"; // Adjust the path as needed to where your queryClient is exported

const OnboardingCarousel = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [forceProgress, setForceProgress] = useState(false);
  const [hasReachedEsign, setHasReachedEsign] = useState(false);
  const [hasCleanedOnCongratulations, setHasCleanedOnCongratulations] = useState(false); // New state to track cleanup

  // Add the URL state recovery hook
  const { isRecovering } = useUrlStateRecovery();

  // Use checkpoint hook to manage state
  const { 
    currentStep: resumeStep, 
    isLoading: checkpointLoading,
    error: checkpointError,
    getStepData,
    isStepCompleted,
    isEmailCompleted,
    isMobileCompleted,
    getClientId,
    refetchStep,
    isClientInitialized, // New flag from useCheckpoint
  } = useCheckpoint();

  const TOTAL_STEPS = 16;

  // ENHANCED: Complete cleanup utility function with clientId preservation
  const performCompleteCleanup = useCallback(async (preserveClientId = true) => {
    try {
      // Save clientId if we want to preserve it
      let savedClientId = null;
      if (preserveClientId && typeof window !== 'undefined') {
        savedClientId = localStorage.getItem('clientId');
      }
      
      // Clear localStorage
      localStorage.clear();
      
      // Restore clientId if we saved it
      if (savedClientId && preserveClientId) {
        localStorage.setItem('clientId', savedClientId);
      }
      
      // Clear all cookies
      Cookies.remove('authToken');
      Object.keys(Cookies.get()).forEach(cookieName => {
        Cookies.remove(cookieName);
      });
      
      // Clear axios headers
      delete axios.defaults.headers.common['Authorization'];
      
      // Clear TanStack Query cache completely
      queryClient.clear();
      queryClient.invalidateQueries();
      queryClient.removeQueries();
      return true;
    } catch {
      console.error('Error during complete cleanup');
      return false;
    }
  }, []);

  // ENHANCED: Logout handler with proper cache clearing
  const handleLogout = useCallback(async () => {
    try {
      // Perform complete cleanup without preserving clientId for logout
      const success = await performCompleteCleanup(false);
      
      if (success) {
        // Show confirmation toast
        toast.success("Logged out successfully!");
        
        // Reset component state after clearing everything
        setTimeout(() => {
          setCurrentStep(0);
          setIsInitialized(false);
          setHasReachedEsign(false);
          setHasCleanedOnCongratulations(false);
        }, 500);
      } else {
        toast.error("Error during logout. Please refresh the page.");
      }
    } catch {
      toast.error("Error during logout. Please refresh the page.");
    }
  }, [performCompleteCleanup]);

  // NEW: Clear storage immediately when reaching congratulations page
  useEffect(() => {
    if (currentStep === 15 && !hasCleanedOnCongratulations) {  
      // Perform cleanup with clientId preservation
      performCompleteCleanup(true).then(() => {
        setHasCleanedOnCongratulations(true);
      });
    }
  }, [currentStep, hasCleanedOnCongratulations, performCompleteCleanup]);

  // ENHANCED: Congratulations completion handler (now just for any final cleanup)
  const handleCongratulationsComplete = useCallback(async () => {
    try {
    } catch (error) {
      console.error('Error in congratulations complete handler:', error);
    }
  }, []);

  // Smart reload protection - Allow reload on email (step 0), mobile (step 1), aadhaar (step 3), and esign (step 12) steps
  useEffect(() => {
    const isAllowedReloadStep = currentStep === 0 || currentStep === 1 || currentStep === 3 || currentStep === 12 || currentStep ===15;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning for steps other than email, mobile, aadhaar, and esign
      if (!isAllowedReloadStep && isInitialized) {
        // Show browser's default confirmation dialog
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your progress may be lost.'; // Required for Chrome
        
        // Show toast warning (may not be visible due to browser dialog)
        toast.error("Please don't reload the page during the verification process!");
        
        return 'Are you sure you want to leave? Your progress may be lost.'; // Some browsers require a return value
      }
    };

    const handleUnload = () => {
      // Show toast when user actually tries to leave (only for protected steps)
      if (!isAllowedReloadStep && isInitialized) {
        toast.error("Page reload detected! Please resubmit if verification was interrupted.");
      }
    };

    // Add event listeners only for protected steps
    if (!isAllowedReloadStep && isInitialized) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('unload', handleUnload);
    }

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [currentStep, isInitialized]);

  // UPDATED: Initialize current step from checkpoint data and client ID from localStorage
  // Wait for URL recovery to complete before initialization
  useEffect(() => {
    // Wait for both checkpoint loading, client initialization AND URL recovery
    if (!checkpointLoading && isClientInitialized && !isInitialized && !isRecovering) {
      setCurrentStep(resumeStep);
      
      // Check if user has reached esign step (step 12) or beyond
      if (resumeStep > 12) {
        setHasReachedEsign(true);
        // Clear localStorage and cookies when reaching esign
        // clearStorageAndCookies();
      }
      
      // Check localStorage for existing client ID
      if (typeof window !== 'undefined') {
        const storedClientId = localStorage.getItem('clientId');
        if (storedClientId) {
        } else {
          const existingClientId = getClientId();
          if (existingClientId) {
            localStorage.setItem('clientId', existingClientId);
          }
        }
      }
      
      setIsInitialized(true);
    }
  }, [checkpointLoading, resumeStep, isInitialized, getClientId, isClientInitialized, isRecovering]);


  // Special effect to handle income proof progress
  useEffect(() => {
    // If we're on the investment segment and forceProgress is true
    if (currentStep === 4 && forceProgress) {
      // Check if income proof exists
      const checkIncomeProof = async () => {
        try {
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/income-proof`,
            {
              headers: {
                Authorization: `Bearer ${Cookies.get('authToken')}`
              }
            }
          );
          
          if (response.status === 200 && response.data?.data?.url) {
            // Refetch investment segment data
            refetchStep(CheckpointStep.INVESTMENT_SEGMENT);
            refetchStep(CheckpointStep.INCOME_PROOF);
            
            // Proceed to next step with a delay
            setTimeout(() => {
              setCurrentStep(5); // Move to the User Details step
              setForceProgress(false);
            }, 1000);
          } else {
            // Reset force progress if no valid income proof
            setForceProgress(false);
          }
        } catch (error) {
          console.error("Error checking income proof:", error);
          setForceProgress(false);
        }
      };
      
      checkIncomeProof();
    }
  }, [currentStep, forceProgress, refetchStep]);

  // Helper function to get client ID from localStorage
  const getStoredClientId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('clientId');
  };

  // Check if the current step is completed
  const isCurrentStepCompleted = () => {
    // If force progress is enabled, always consider current step completed
    if (forceProgress && currentStep === 4) {
      return true;
    }
    
    switch (currentStep) {
      case 0: // Email
        return isEmailCompleted();
      case 1: // Mobile
        return isMobileCompleted();
      case 2: // PAN
        return isStepCompleted(CheckpointStep.PAN);
      case 3: // Aadhaar
        return isStepCompleted(CheckpointStep.AADHAAR);
      case 4: // Investment Segment
        // Enhanced check: Investment segment is complete if:
        // 1. Investment segment step is completed AND
        // 2. If income proof is required, it must also be completed
        const investmentCompleted = isStepCompleted(CheckpointStep.INVESTMENT_SEGMENT);
        if (!investmentCompleted) {
          return false;
        }

        const investmentData = getStepData(CheckpointStep.INVESTMENT_SEGMENT);
        const requiresIncomeProof = investmentData?.requiresIncomeProof === true;
        
        // Check if user selected risk segments
        const selectedSegments: string[] = Array.isArray(investmentData?.segments) ? investmentData.segments : [];
        const hasRiskSegments = selectedSegments.some((segment: string) => 
          segment === "F&O" || segment === "Currency" || segment === "Commodity"
        );
        
        // If income proof is required (either by backend flag or risk segments)
        if (requiresIncomeProof || hasRiskSegments) {
          const incomeProofCompleted = isStepCompleted(CheckpointStep.INCOME_PROOF);
          return incomeProofCompleted;
        }
        return true;
      case 5: // User Detail
        return isStepCompleted(CheckpointStep.USER_DETAIL);
      case 6: // Personal Detail
        return isStepCompleted(CheckpointStep.PERSONAL_DETAIL);
      case 7: // Other Detail
        return isStepCompleted(CheckpointStep.OTHER_DETAIL);
      case 8: // Bank Validation
        return isStepCompleted(CheckpointStep.BANK_VALIDATION);
      case 9: // IPV
        const ipvData = getStepData(CheckpointStep.IPV);
        return isStepCompleted(CheckpointStep.IPV) && ipvData && ipvData.url;
      case 10: // Signature
        const signatureData = getStepData(CheckpointStep.SIGNATURE);
        return isStepCompleted(CheckpointStep.SIGNATURE) && signatureData && signatureData.url;
      case 11: // Add Nominees
        return isStepCompleted(CheckpointStep.ADD_NOMINEES);
      case 12: // E-Sign
        return isStepCompleted(CheckpointStep.ESIGN);
      case 13: // Password Setup
        return isStepCompleted(CheckpointStep.PASSWORD_SETUP);
      case 14: // MPIN Setup
        return isStepCompleted(CheckpointStep.MPIN_SETUP);
      case 15: // Congratulations - always allow to proceed
        return true;
      default:
        return false;
    }
  };

  // ENHANCED: Determine if going back to a step is allowed
  const isBackNavigationAllowed = (targetStep: number): boolean => {
    // Never allow going back to email if it's completed
    if (targetStep === 0 && isEmailCompleted()) {
      toast.error("Email verification is already completed.");
      return false;
    }
    
    // Never allow going back to mobile if email and mobile are completed
    if (targetStep === 1 && isEmailCompleted() && isMobileCompleted()) {
      toast.error("Mobile verification is already completed.");
      return false;
    }
    
    // Never allow going back once esign step (12) is reached
    if (hasReachedEsign || currentStep >= 12) {
      toast.error("Cannot go back after reaching the esign step.");
      return false;
    }
    
    // Allow going back to PAN from Aadhaar and later steps - PAN can be edited
    // Don't restrict PAN navigation since users might need to correct PAN details
    
    return true;
  };

  // Check if back navigation should be disabled (for UI styling)
  const isBackNavigationDisabled = (): boolean => {
    // Disable back button on email step (step 0)
    if (currentStep === 0) {
      return true;
    }
    
    // Disable back button on mobile step (step 1) if email is completed
    if (currentStep === 1 && isEmailCompleted()) {
      return true;
    }
    
    // Disable back button on PAN step (step 2) - fade the up arrow
    if (currentStep === 2) {
      return true;
    }
    
    // Disable back button once esign step (12) is reached or beyond
    if (hasReachedEsign || currentStep >= 12) {
      return true;
    }
    
    return false;
  };

  // Check if forward navigation should be disabled
  const isForwardNavigationDisabled = (): boolean => {
    // Disable forward navigation on congratulations page (step 15)
    if (currentStep === 15) {
      return true;
    }
    
    // Disable if current step is not completed
    if (!isCurrentStepCompleted()) {
      return true;
    }
    
    return false;
  };

  // NEW: Enhanced handleNext that handles step completion properly
  const handleNext = useCallback(async (forceNext = false) => {
    if (isAnimating) return;
    
    // Don't allow next on congratulations page (step 15)
    if (currentStep === 15) {
      return;
    }
    
    // Set hasReachedEsign flag and clear storage when reaching esign step
    if (currentStep === 11 && !hasReachedEsign) { // Moving from step 11 to 12 (esign)
      setHasReachedEsign(true);
      // clearStorageAndCookies();
    }
    
    // Special case for investment segment with income proof
    if (currentStep === 4 && isStepCompleted(CheckpointStep.INCOME_PROOF)) {
      // Force proceed to next step
      setDirection(1);
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(5); // User Detail step
        setTimeout(() => {
          setIsAnimating(false);
        }, 100);
      }, 400);
      return;
    }
    
    // If forceNext is true, skip completion check (used after successful API calls)
    if (!forceNext) {
      // Check if current step is completed before allowing navigation
      if (!isCurrentStepCompleted()) {
        toast.error("Please complete the current step before proceeding.");
        return;
      }
    }
    
    setDirection(1);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => (prev + 1) % TOTAL_STEPS);
      setTimeout(() => {
        setIsAnimating(false);
      }, 100);
    }, 400);
  }, [isAnimating, TOTAL_STEPS, isCurrentStepCompleted, currentStep, isStepCompleted, hasReachedEsign]);

  const handlePrevious = useCallback(() => {
    if (isAnimating) return;
    
    // Don't allow going back from the first step
    if (currentStep === 0) {
      toast.error("You're already at the first step.");
      return;
    }
    
    // Don't allow going back on congratulations page
    if (currentStep === 15) {
      return;
    }
    
    // Calculate the target step
    const targetStep = currentStep - 1;
    
    // Check if going back is allowed
    if (!isBackNavigationAllowed(targetStep)) {
      return;
    }
    
    setDirection(-1);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(targetStep);
      setTimeout(() => {
        setIsAnimating(false);
      }, 100);
    }, 400);
  }, [isAnimating, currentStep, isBackNavigationAllowed]);

  // NEW: Enhanced step completion handler
  const handleStepCompletion = useCallback(async (stepType: CheckpointStep) => {
    // Invalidate the specific step cache
    refetchStep(stepType);
    
    // Wait a moment for cache invalidation, then proceed
    setTimeout(() => {
      handleNext(true); // Force next with true parameter
    }, 500);
  }, [refetchStep, handleNext]);

  const navigationButtons = [
    {
      icon: <ChevronUp size={18} />,
      onClick: handlePrevious,
      ariaLabel: "Previous step",
      disabled: isBackNavigationDisabled(),
    },
    {
      icon: <ChevronDown size={18} />,
      onClick: () => handleNext(false),
      ariaLabel: "Next step",
      disabled: isForwardNavigationDisabled(),
    },
  ];

  // Special handler for investment segment next
  const handleInvestmentNext = useCallback(async () => {
    // Check if income proof exists
    const checkIncomeProof = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/income-proof`,
          {
            headers: {
              Authorization: `Bearer ${Cookies.get('authToken')}`
            }
          }
        );
        
        if (response.status === 200 && response.data?.data?.url) {
          // Force advance to next step
          setForceProgress(true);
          handleNext(true);
        } else {
          // Normal next behavior - but use step completion handler
          await handleStepCompletion(CheckpointStep.INVESTMENT_SEGMENT);
        }
      } catch (error) {
        console.error("Error checking income proof:", error);
        // Proceed anyway with step completion handler
        await handleStepCompletion(CheckpointStep.INVESTMENT_SEGMENT);
      }
    };
    
    // Check income proof before proceeding
    checkIncomeProof();
  }, [handleNext, handleStepCompletion]);

  // Define components with enhanced onNext handlers
  const components = [
    { 
      id: "email", 
      component: (
        <EmailVerification 
          onNext={() => handleNext(true)} // Email verification handles its own completion
          initialData={undefined}
          isCompleted={isEmailCompleted()}
        />
      )
    },
    { 
      id: "mobile", 
      component: (
        <MobileVerification 
          onNext={() => handleNext(true)} // Mobile verification handles its own completion
          initialData={undefined}
          isCompleted={isMobileCompleted()}
        />
      )
    },
    
    { 
      id: "pan", 
      component: (
        <PANVerify 
          onNext={() => handleStepCompletion(CheckpointStep.PAN)}
          initialData={getStepData(CheckpointStep.PAN)}
          isCompleted={isStepCompleted(CheckpointStep.PAN)}
        />
      )
    },
    { 
      id: "aadhaar", 
      component: (
        <AadhaarVerification 
          onNext={() => handleStepCompletion(CheckpointStep.AADHAAR)}
          initialData={getStepData(CheckpointStep.AADHAAR)}
          isCompleted={isStepCompleted(CheckpointStep.AADHAAR)}
          panMaskedAadhaar={getStepData(CheckpointStep.PAN)?.masked_aadhaar as string | undefined}
        />
      )
    },
    {
      id: "investment segment",
      component: (
        <InvestmentSegment 
          onNext={handleInvestmentNext} // Use special handler
          initialData={getStepData(CheckpointStep.INVESTMENT_SEGMENT) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.INVESTMENT_SEGMENT)}
        />
      ),
    },
    { 
      id: "trading", 
      component: (
        <TradingAccountDetails 
          onNext={() => handleStepCompletion(CheckpointStep.USER_DETAIL)}
          initialData={getStepData(CheckpointStep.USER_DETAIL) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.USER_DETAIL)}
        />
      )
    },
    {
      id: "trading preference",
      component: (
        <TradingPreferences 
          onNext={() => handleStepCompletion(CheckpointStep.PERSONAL_DETAIL)}
          initialData={getStepData(CheckpointStep.PERSONAL_DETAIL)}
          isCompleted={isStepCompleted(CheckpointStep.PERSONAL_DETAIL)}
        />
      ),
    },
    {
      id: "trading2",
      component: (
        <TradingAccountDetails2 
          onNext={() => handleStepCompletion(CheckpointStep.OTHER_DETAIL)}
          initialData={getStepData(CheckpointStep.OTHER_DETAIL)}
          isCompleted={isStepCompleted(CheckpointStep.OTHER_DETAIL)}
        />
      ),
    },
    {
      id: "bankaccountdetails",
      component: (
        <BankAccountLinking 
          onNext={() => handleStepCompletion(CheckpointStep.BANK_VALIDATION)}
          initialData={getStepData(CheckpointStep.BANK_VALIDATION) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.BANK_VALIDATION)}
        />
      ),
    },
    { 
      id: "ipv", 
      component: (
        <IPVVerification 
          onNext={() => handleStepCompletion(CheckpointStep.IPV)}
          initialData={getStepData(CheckpointStep.IPV) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.IPV)}
        />
      )
    },
    { 
      id: "signature", 
      component: (
        <SignatureComponent 
          onNext={() => handleStepCompletion(CheckpointStep.SIGNATURE)}
          initialData={getStepData(CheckpointStep.SIGNATURE) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.SIGNATURE)}
        />
      )
    },
    { 
      id: "nominee", 
      component: (
        <NomineeSelection 
          onNext={() => handleStepCompletion(CheckpointStep.ADD_NOMINEES)}
          initialData={getStepData(CheckpointStep.ADD_NOMINEES)}
          isCompleted={isStepCompleted(CheckpointStep.ADD_NOMINEES)}
        />
      )
    },
    {
      id: "Last Step", 
      component: (
        <LastStepPage 
          onNext={() => handleStepCompletion(CheckpointStep.ESIGN)}
          initialData={getStepData(CheckpointStep.ESIGN)}
          isCompleted={isStepCompleted(CheckpointStep.ESIGN)}
        />
      )
    },
    { 
      id: "Set Password", 
      component: (
        <SetPassword 
          onNext={() => {
            handleStepCompletion(CheckpointStep.PASSWORD_SETUP);
          }}
          initialData={getStepData(CheckpointStep.PASSWORD_SETUP) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.PASSWORD_SETUP)}
        />
      )
    },
    { 
      id: "MPIN", 
      component: (
        <MPIN 
          onNext={() => {
            handleStepCompletion(CheckpointStep.MPIN_SETUP);
          }}
          clientId={getStoredClientId() ?? undefined} // Pass client ID from localStorage, convert null to undefined
          initialData={getStepData(CheckpointStep.MPIN_SETUP) ?? undefined}
          isCompleted={isStepCompleted(CheckpointStep.MPIN_SETUP)}
        />
      )
    },
    {
      id: "congratulations",
      component: (
        <CongratulationsPage 
          onNext={handleCongratulationsComplete} // Use the enhanced completion handler
          clientId={getStoredClientId() ?? undefined} // Pass client ID from localStorage, convert null to undefined
        />
      ),
    },
  ];

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Disable keyboard navigation on congratulations page
      if (currentStep === 15) {
        return;
      }
      
      if (e.key === "ArrowUp") {
        handlePrevious();
      } else if (e.key === "ArrowDown") {
        handleNext(false);
      }
    };

    // Prevent scrolling
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      document.body.style.overflow = "";
    };
  }, [handleNext, handlePrevious, currentStep]);

  const getAnimationStyles = () => {
    if (!isAnimating) {
      return {
        transform: "translateY(0)",
        opacity: 1,
        transition: "none",
      };
    }

    return {
      transform: `translateY(${direction * -50}%)`,
      opacity: 0,
      transition:
        "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease-in-out",
    };
  };

  // UPDATED: Show loading state while fetching checkpoint data OR waiting for client initialization OR URL recovery
  if ((checkpointLoading || !isClientInitialized || isRecovering) && !isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRecovering ? "Restoring session..." : !isClientInitialized ? "Loading..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Show error state if checkpoint fetch failed
  if (checkpointError && !isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Progress</h3>
          <p className="text-gray-600 mb-4">
            We couldn&apos;t retrieve your previous progress. You can start from the beginning.
          </p>
          <button 
            onClick={() => {
              setCurrentStep(0);
              setIsInitialized(true);
            }}
            className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      {/* Static Left Panel */}
      {currentStep === components.length - 1 ? (
        <></>
      ) : (
        <div className="hidden lg:block w-[40%] h-full">
          <LeftPanel currentStep={currentStep} />
        </div>
      )}

      {/* Animated Right Panel */}
      <div
        className={`${
          currentStep === components.length - 1 ? "w-full" : "w-full lg:w-[60%] mx-4"
        } bg-white h-full`}
      >
        <div className="h-full flex items-center">
          <div className="p-4 lg:p-10 w-full max-w-2xl flex mx-auto relative">
            {/* Previous Screen */}
            {direction === 1 && (
              <div
                key={`prev-${currentStep}`}
                className="absolute inset-0 p-4 lg:p-12"
                style={{
                  transform: "translateY(-50%)",
                  opacity: 0,
                  transition: "none",
                }}
              >
                {
                  components[(currentStep - 1 + TOTAL_STEPS) % TOTAL_STEPS]
                    .component
                }
              </div>
            )}

            {/* Next Screen */}
            {direction === -1 && (
              <div
                key={`next-${currentStep}`}
                className="absolute inset-0 p-4 lg:p-12"
                style={{
                  transform: "translateY(50%)",
                  opacity: 0,
                  transition: "none",
                }}
              >
                {components[(currentStep + 1) % TOTAL_STEPS].component}
              </div>
            )}

            {/* Current Screen */}
            <div
              key={`current-${currentStep}`}
              className="w-full relative"
              style={getAnimationStyles()}
            >
              {components[currentStep].component}
            </div>
          </div>
        </div>

        {/* Progress Indicator - Smaller on mobile */}
        <div className="fixed top-2 lg:top-6 right-2 lg:right-6 flex gap-1 lg:gap-2 flex-wrap max-w-[80%] lg:max-w-none justify-end">
          {components.map((_, index) => (
            <div
              key={`indicator-${index}`}
              className={`w-1 lg:w-2 h-1 lg:h-2 rounded-full transition-colors duration-300 ${
                index === currentStep ? "bg-teal-600" : 
                index < currentStep ? "bg-green-500" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {/* ENHANCED: Logout Button with proper cache clearing */}
        {currentStep > 0 && currentStep !== 15 && (
          <div className={`fixed bottom-4 lg:bottom-6 ${currentStep !== 15 ? "left-1/2 -translate-x-1/2" : ""} lg:left-[41%] lg:translate-x-0`}>
            <button
              onClick={handleLogout}
              className="px-3 py-2 flex items-center justify-center bg-red-500 hover:bg-red-600 transition-all duration-300 ease-in-out border border-red-500 text-white shadow-lg rounded-md mr-2 lg:mr-0"
              aria-label="Logout"
              title="Logout"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        )}

        {/* Navigation Arrows - Hide on congratulations page */}
        {currentStep !== 15 && (
          <div className="hidden lg:flex fixed bottom-4 lg:bottom-6 left-1/2 transform -translate-x-1/2 lg:left-auto lg:transform-none lg:right-6  gap-1">
            {navigationButtons.map((button, index) => (
              <button
                key={index}
                className={`px-3 py-2 flex items-center justify-center ${
                  button.disabled 
                    ? "bg-gray-400 cursor-not-allowed opacity-50" 
                    : "bg-green-heading hover:bg-white hover:text-green-heading"
                } transition-all duration-300 ease-in-out border ${
                  button.disabled 
                    ? "border-gray-400" 
                    : "border-green-heading"
                } text-white shadow-lg ${
                  index === 0 ? "rounded-l-md" : "rounded-r-md"
                } ${isAnimating ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={button.onClick}
                disabled={isAnimating || button.disabled}
                aria-label={button.ariaLabel}
              >
                {button.icon}
              </button>
            ))}
          </div> 
        )}
      </div>

      {/* Global style to prevent scrolling */}
      <style jsx global>{`
        html,
        body {
          overflow: hidden;
          height: 100%;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
};

export default OnboardingCarousel;
