"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import LeftPanel from "./LeftPanel";
import MobileVerification from "../forms/MobileVerification";
import EmailVerification from "../forms/EmailVerification";
import AadhaarVerification from "../forms/AadharVerification";

import PANVerify from "../forms/PANVerify";

import IPVVerification from "../forms/IPV";

import LastStepPage from "../forms/ESign";
import CongratulationsPage from "../forms/Congratulations";


import { ChevronDown, ChevronUp } from "lucide-react";
import BankAccountLinking from "../forms/BankAccountLinking";
import SignatureComponent from "../forms/Signature";
import MPIN from "../forms/MPIN";
import PanUploadComponent from "../forms/PanUploadComponent";
import { useCheckpoint, CheckpointStep } from "@/hooks/useCheckpoint";
import { useUrlStateRecovery } from "@/hooks/useUrlStateRecovery";
import SetPassword from "../forms/SetPassword";
import { toast } from "sonner";
import axios from "axios";
import Cookies from "js-cookie";
import { queryClient } from "@/providers/QueryProvider";
import GuardianPanVerify from "./GuardianPanVerify";
import GuardianAadhar from "./GuardianAadhar";

const OnboardingCarousel = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [forceProgress, setForceProgress] = useState(false);
  const [hasReachedEsign, setHasReachedEsign] = useState(false);
  const [hasCleanedOnCongratulations, setHasCleanedOnCongratulations] = useState(false);

  const { isRecovering } = useUrlStateRecovery();

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
    isClientInitialized,
    checkPanUploadRequirement,
    isPanUploadRequired,
    setPanUploadRequired,
  } = useCheckpoint();

  // Dynamic step indices based on PAN requirement
  const STEP_INDICES = useMemo(() => {
    const base = {
      EMAIL: 0,
      MOBILE: 1,
      PAN: 2,
      AADHAAR: 3,
      INVESTMENT_SEGMENT: 4,
      USER_DETAIL: 5,
      PERSONAL_DETAIL: 6,
      OTHER_DETAIL: 7,
      BANK_VALIDATION: 8,
      IPV: 9,
      SIGNATURE: 10,
      ADD_NOMINEES: 11,
    };

    if (isPanUploadRequired === true) {
      return {
        ...base,
        PAN_UPLOAD: 12,
        ESIGN: 13,
        SET_PASSWORD: 14,
        MPIN: 15,
        CONGRATULATIONS: 16,
      };
    } else {
      return {
        ...base,
        ESIGN: 12,
        SET_PASSWORD: 13,
        MPIN: 14,
        CONGRATULATIONS: 15,
      };
    }
  }, [isPanUploadRequired]);

  // Helper function to get client ID from localStorage
  const getStoredClientId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('clientId');
  }, []);

  // Enhanced step completion check
  const isCurrentStepCompleted = useCallback((): boolean => {
    if (forceProgress && currentStep === STEP_INDICES.INVESTMENT_SEGMENT) {
      return true;
    }
    
    switch (currentStep) {
      case STEP_INDICES.EMAIL: 
        return isEmailCompleted();
      case STEP_INDICES.MOBILE: 
        return isMobileCompleted();
      case STEP_INDICES.PAN: 
        return isStepCompleted(CheckpointStep.PAN);
      case STEP_INDICES.AADHAAR: 
        return isStepCompleted(CheckpointStep.AADHAAR);
      case STEP_INDICES.INVESTMENT_SEGMENT:
        const investmentCompleted = isStepCompleted(CheckpointStep.INVESTMENT_SEGMENT);
        if (!investmentCompleted) return false;

        const investmentData = getStepData(CheckpointStep.INVESTMENT_SEGMENT);
        const requiresIncomeProof = investmentData?.requiresIncomeProof === true;
        const selectedSegments: string[] = Array.isArray(investmentData?.segments) ? investmentData.segments : [];
        const hasRiskSegments = selectedSegments.some((segment: string) => 
          segment === "F&O" || segment === "Currency" || segment === "Commodity"
        );
        
        if (requiresIncomeProof || hasRiskSegments) {
          return isStepCompleted(CheckpointStep.INCOME_PROOF);
        }
        return true;
      case STEP_INDICES.USER_DETAIL: 
        return isStepCompleted(CheckpointStep.USER_DETAIL);
      case STEP_INDICES.PERSONAL_DETAIL: 
        return isStepCompleted(CheckpointStep.PERSONAL_DETAIL);
      case STEP_INDICES.OTHER_DETAIL: 
        return isStepCompleted(CheckpointStep.OTHER_DETAIL);
      case STEP_INDICES.BANK_VALIDATION: 
        return isStepCompleted(CheckpointStep.BANK_VALIDATION);
      case STEP_INDICES.IPV: {
        const ipvData = getStepData(CheckpointStep.IPV);
        return isStepCompleted(CheckpointStep.IPV) && 
               ipvData !== null && 
               typeof ipvData === 'object' && 
               'url' in ipvData && 
               Boolean(ipvData.url);
      }
      case STEP_INDICES.SIGNATURE: {
        const signatureData = getStepData(CheckpointStep.SIGNATURE);
        return isStepCompleted(CheckpointStep.SIGNATURE) && 
               signatureData !== null && 
               typeof signatureData === 'object' && 
               'url' in signatureData && 
               Boolean(signatureData.url);
      }
      case STEP_INDICES.ADD_NOMINEES: 
        return isStepCompleted(CheckpointStep.ADD_NOMINEES);
      default:
        // Handle PAN_UPLOAD case with proper type checking
        if (isPanUploadRequired === true && 'PAN_UPLOAD' in STEP_INDICES && currentStep === STEP_INDICES.PAN_UPLOAD) {
          return isStepCompleted(CheckpointStep.PAN_VERIFICATION_RECORD);
        }
        if ('ESIGN' in STEP_INDICES && currentStep === STEP_INDICES.ESIGN) {
          return isStepCompleted(CheckpointStep.ESIGN);
        }
        if ('SET_PASSWORD' in STEP_INDICES && currentStep === STEP_INDICES.SET_PASSWORD) {
          return isStepCompleted(CheckpointStep.PASSWORD_SETUP);
        }
        if ('MPIN' in STEP_INDICES && currentStep === STEP_INDICES.MPIN) {
          return isStepCompleted(CheckpointStep.MPIN_SETUP);
        }
        if ('CONGRATULATIONS' in STEP_INDICES && currentStep === STEP_INDICES.CONGRATULATIONS) {
          return true;
        }
        return false;
    }
  }, [currentStep, STEP_INDICES, isEmailCompleted, isMobileCompleted, isStepCompleted, getStepData, isPanUploadRequired, forceProgress]);

  // Enhanced step completion handler
  const handleStepCompletion = useCallback(async (stepType: CheckpointStep): Promise<void> => {
    refetchStep(stepType);
    
    setTimeout(() => {
      handleNext(true);
    }, 500);
  }, [refetchStep]);

  // Congratulations completion handler
  const handleCongratulationsComplete = useCallback(async (): Promise<void> => {
    try {
      // Additional cleanup if needed
    } catch (error) {
      console.error(error);
    }
  }, []);

  // Enhanced handleNext that handles step completion properly
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNext = useCallback(async (forceNext = false) => {
    if (isAnimating) return;
    
    const components = getComponents();
    if (currentStep === components.length - 1) {
      return;
    }
    
    // Set hasReachedEsign flag when reaching esign step
    if ('ESIGN' in STEP_INDICES && currentStep === STEP_INDICES.ESIGN - 1 && !hasReachedEsign) {
      setHasReachedEsign(true);
    }
    
    // Special case for investment segment with income proof
    if (currentStep === STEP_INDICES.INVESTMENT_SEGMENT && isStepCompleted(CheckpointStep.INCOME_PROOF)) {
      setDirection(1);
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(STEP_INDICES.USER_DETAIL);
        setTimeout(() => {
          setIsAnimating(false);
        }, 100);
      }, 400);
      return;
    }
    
    // If forceNext is true, skip completion check
    // Commented out completion check to allow free navigation
    // if (!forceNext) {
    //   if (!isCurrentStepCompleted()) {
    //     toast.error("Please complete the current step before proceeding.");
    //     return;
    //   }
    // }
    
    setDirection(1);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, components.length - 1));
      setTimeout(() => {
        setIsAnimating(false);
      }, 100);
    }, 400);
  }, [isAnimating, isCurrentStepCompleted, currentStep, isStepCompleted, hasReachedEsign, STEP_INDICES]);

  // Enhanced nominee completion handler with PAN check
  const handleNomineeNext = useCallback(async (): Promise<void> => {
    try {
      // First complete the nominee step
      await handleStepCompletion(CheckpointStep.ADD_NOMINEES);
      
      // Check if PAN upload is required (if not already determined)
      if (isPanUploadRequired === null) {
        const panRequired = await checkPanUploadRequirement();
        setPanUploadRequired(panRequired);
      }
    } catch (error) {
      toast.error(
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Error completing nominee step. Please try again."
      );
      toast.error("Error completing nominee step. Please try again.",);
      
      // Fallback: assume no PAN upload required
      if (isPanUploadRequired === null) {
        setPanUploadRequired(false);
      }
    }
  }, [handleStepCompletion, checkPanUploadRequirement, isPanUploadRequired, setPanUploadRequired]);

  // Special handler for investment segment next
  const handleInvestmentNext = useCallback(async (): Promise<void> => {
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
          setForceProgress(true);
          handleNext(true);
        } else {
          await handleStepCompletion(CheckpointStep.INVESTMENT_SEGMENT);
        }
      } catch (error) {
        console.error(error);
        await handleStepCompletion(CheckpointStep.INVESTMENT_SEGMENT);
      }
    };
    
    checkIncomeProof();
  }, [handleNext, handleStepCompletion]);

  // Function to get dynamic step components based on PAN requirement
  const getComponents = useCallback(() => {
    const baseComponents = [
      { 
        id: "email", 
        component: (
          <EmailVerification 
            onNext={() => handleNext(true)}
            initialData={undefined}
            isCompleted={isEmailCompleted()}
          />
        )
      },
      { 
        id: "mobile", 
        component: (
          <MobileVerification 
            onNext={() => handleNext(true)}
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
        id: "GuardianPanVerify",
        component: (
          <GuardianPanVerify
            onNext={() => handleStepCompletion(CheckpointStep.PAN)}
            initialData={getStepData(CheckpointStep.PAN)}
            isCompleted={isStepCompleted(CheckpointStep.PAN)}
            
          />
        )
      },
      {
        id: "GuardianAadhar",
        component: (
          <GuardianAadhar
            onNext={() => handleStepCompletion(CheckpointStep.PAN)}
            initialData={getStepData(CheckpointStep.PAN)}
            isCompleted={isStepCompleted(CheckpointStep.PAN)}
            
          />
        )
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
      
    ];

    // Conditionally add PAN upload component
    if (isPanUploadRequired === true) {
      baseComponents.push({
        id: "pan-upload",
        component: (
          <PanUploadComponent 
            onNext={() => handleStepCompletion(CheckpointStep.PAN_VERIFICATION_RECORD)}
            initialData={getStepData(CheckpointStep.PAN_VERIFICATION_RECORD) ?? undefined}
            isCompleted={isStepCompleted(CheckpointStep.PAN_VERIFICATION_RECORD)}
          />
        ),
      });
    }

    // Add remaining components
    baseComponents.push(
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
            clientId={getStoredClientId() ?? undefined}
            initialData={getStepData(CheckpointStep.MPIN_SETUP) ?? undefined}
            isCompleted={isStepCompleted(CheckpointStep.MPIN_SETUP)}
          />
        )
      },
      {
        id: "congratulations",
        component: (
          <CongratulationsPage 
            onNext={handleCongratulationsComplete}
            clientId={getStoredClientId() ?? undefined}
          />
        ),
      }
    );

    return baseComponents;
  }, [
    isPanUploadRequired,
    isEmailCompleted,
    isMobileCompleted,
    getStepData,
    isStepCompleted,
    handleStepCompletion,
    handleNomineeNext,
    handleInvestmentNext,
    handleCongratulationsComplete,
    getStoredClientId,
    handleNext
  ]);

  // Early PAN requirement check when approaching nominees step
  useEffect(() => {
    const checkPanRequirementEarly = async () => {
      if (currentStep === STEP_INDICES.ADD_NOMINEES && isPanUploadRequired === null) {
        try {
          const panRequired = await checkPanUploadRequirement();
          setPanUploadRequired(panRequired);
        } catch (error) {
          console.error(error);
          setPanUploadRequired(false);
        }
      }
    };

    checkPanRequirementEarly();
  }, [currentStep, isPanUploadRequired, checkPanUploadRequirement, setPanUploadRequired, STEP_INDICES.ADD_NOMINEES]);

  // Complete cleanup utility function
  const performCompleteCleanup = useCallback(async (preserveClientId = true): Promise<boolean> => {
    try {
      let savedClientId = null;
      if (preserveClientId && typeof window !== 'undefined') {
        savedClientId = localStorage.getItem('clientId');
      }
      
      localStorage.clear();
      
      if (savedClientId && preserveClientId) {
        localStorage.setItem('clientId', savedClientId);
      }
      
      Cookies.remove('authToken');
      Object.keys(Cookies.get()).forEach(cookieName => {
        Cookies.remove(cookieName);
      });
      
      delete axios.defaults.headers.common['Authorization'];
      
      queryClient.clear();
      queryClient.invalidateQueries();
      queryClient.removeQueries();
      return true;
    } catch {
      return false;
    }
  }, []);

  // Logout handler
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      const success = await performCompleteCleanup(false);
      
      if (success) {
        toast.success("Logged out successfully!");
        
        setTimeout(() => {
          setCurrentStep(0);
          setIsInitialized(false);
          setHasReachedEsign(false);
          setHasCleanedOnCongratulations(false);
          setPanUploadRequired(false); // Set to false instead of null
        }, 500);
      } else {
        toast.error("Error during logout. Please refresh the page.");
      }
    } catch {
      toast.error("Error during logout. Please refresh the page.");
    }
  }, [performCompleteCleanup, setPanUploadRequired]);

  // Enhanced back navigation logic
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isBackNavigationAllowed = useCallback((targetStep: number): boolean => {
    // Commented out restrictions to allow free navigation
    // if (targetStep === STEP_INDICES.EMAIL && isEmailCompleted()) {
    //   toast.error("Email verification is already completed.");
    //   return false;
    // }
    
    // if (targetStep === STEP_INDICES.MOBILE && isEmailCompleted() && isMobileCompleted()) {
    //   toast.error("Mobile verification is already completed.");
    //   return false;
    // }
    
    // if ('ESIGN' in STEP_INDICES && (hasReachedEsign || currentStep >= STEP_INDICES.ESIGN)) {
    //   toast.error("Cannot go back after reaching the esign step.");
    //   return false;
    // }
    
    return true;
  }, [STEP_INDICES, isEmailCompleted, isMobileCompleted, hasReachedEsign, currentStep]);

  // Check if back navigation should be disabled
  const isBackNavigationDisabled = (): boolean => {
    if (currentStep === 0) return true;
    // Commented out restrictions to allow free navigation
    // if (currentStep === 1 && isEmailCompleted()) return true;
    // if (currentStep === 2) return true;
    
    // if ('ESIGN' in STEP_INDICES && (hasReachedEsign || currentStep >= STEP_INDICES.ESIGN)) return true;
    
    return false;
  };

  // Check if forward navigation should be disabled
  const isForwardNavigationDisabled = (): boolean => {
    const components = getComponents();
    if (currentStep === components.length - 1) return true;
    // Commented out completion check to allow free navigation
    // if (!isCurrentStepCompleted()) return true;
    return false;
  };

  const handlePrevious = useCallback(() => {
    if (isAnimating) return;
    
    if (currentStep === 0) {
      toast.error("You're already at the first step.");
      return;
    }
    
    const components = getComponents();
    if (currentStep === components.length - 1) {
      return;
    }
    
    const targetStep = currentStep - 1;
    
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
  }, [isAnimating, currentStep, isBackNavigationAllowed, getComponents]);

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

  // Clear storage when reaching congratulations page
  useEffect(() => {
    const components = getComponents();
    if (currentStep === components.length - 1 && !hasCleanedOnCongratulations) {  
      performCompleteCleanup(true).then(() => {
        setHasCleanedOnCongratulations(true);
      });
    }
  }, [currentStep, hasCleanedOnCongratulations, performCompleteCleanup, getComponents]);

  // Smart reload protection
  useEffect(() => {
    const components = getComponents();
    const congratulationsIndex = components.length - 1;
    
    const isAllowedReloadStep = currentStep === 0 || currentStep === 1 || currentStep === 3 || 
                               ('ESIGN' in STEP_INDICES && currentStep === STEP_INDICES.ESIGN) || 
                               currentStep === congratulationsIndex;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isAllowedReloadStep && isInitialized) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? Your progress may be lost.';
        toast.error("Please don't reload the page during the verification process!");
        return 'Are you sure you want to leave? Your progress may be lost.';
      }
    };

    const handleUnload = () => {
      if (!isAllowedReloadStep && isInitialized) {
        toast.error("Page reload detected! Please resubmit if verification was interrupted.");
      }
    };

    if (!isAllowedReloadStep && isInitialized) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('unload', handleUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [currentStep, isInitialized, STEP_INDICES, getComponents]);

  // Initialize current step from checkpoint data
  useEffect(() => {
    if (!checkpointLoading && isClientInitialized && !isInitialized && !isRecovering) {
      setCurrentStep(resumeStep);
      
      // Check if user has reached esign step or beyond
      if ('ESIGN' in STEP_INDICES && resumeStep >= STEP_INDICES.ESIGN) {
        setHasReachedEsign(true);
      }
      
      // Check localStorage for existing client ID
      if (typeof window !== 'undefined') {
        const storedClientId = localStorage.getItem('clientId');
        if (!storedClientId) {
          const existingClientId = getClientId();
          if (existingClientId) {
            localStorage.setItem('clientId', existingClientId);
          }
        }
      }
      
      setIsInitialized(true);
    }
  }, [checkpointLoading, resumeStep, isInitialized, getClientId, isClientInitialized, isRecovering, STEP_INDICES]);

  // Special effect to handle income proof progress
  useEffect(() => {
    if (currentStep === STEP_INDICES.INVESTMENT_SEGMENT && forceProgress) {
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
            refetchStep(CheckpointStep.INVESTMENT_SEGMENT);
            refetchStep(CheckpointStep.INCOME_PROOF);
            
            setTimeout(() => {
              setCurrentStep(STEP_INDICES.USER_DETAIL);
              setForceProgress(false);
            }, 1000);
          } else {
            setForceProgress(false);
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : typeof error === "string"
              ? error
              : "Error checking income proof. Please try again."
          );
          setForceProgress(false);
        }
      };
      
      checkIncomeProof();
    }
  }, [currentStep, forceProgress, refetchStep, STEP_INDICES.INVESTMENT_SEGMENT, STEP_INDICES.USER_DETAIL]);

  // Get components for rendering
  const components = getComponents();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      if (currentStep === components.length - 1) {
        return;
      }
      
      if (e.key === "ArrowUp") {
        handlePrevious();
      } else if (e.key === "ArrowDown") {
        handleNext(false);
      }
    };

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      document.body.style.overflow = "";
    };
  }, [handleNext, handlePrevious, currentStep, components.length]);

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

  // Enhanced loading state management
  const isLoadingPanRequirement = isPanUploadRequired === null && currentStep >= STEP_INDICES.ADD_NOMINEES;

  // Show loading state
  if ((checkpointLoading || !isClientInitialized || isRecovering || isLoadingPanRequirement) && !isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRecovering 
              ? "Restoring session..." 
              : isLoadingPanRequirement 
              ? "Checking requirements..." 
              : !isClientInitialized 
              ? "Loading..." 
              : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
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
                  components[(currentStep - 1 + components.length) % components.length]
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
                {components[(currentStep + 1) % components.length].component}
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

        {/* Logout Button */}
        {currentStep > 0 && currentStep !== components.length - 1 && (
          <div className={`fixed bottom-4 lg:bottom-6 ${currentStep !== components.length - 1 ? "left-1/2 -translate-x-1/2" : ""} lg:left-[41%] lg:translate-x-0`}>
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
        {currentStep !== components.length - 1 && (
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