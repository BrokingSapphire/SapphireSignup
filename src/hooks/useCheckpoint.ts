import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { useState, useEffect } from 'react';

// Define checkpoint steps that exist in your backend API
export enum CheckpointStep {
  PAN = 'pan',
  AADHAAR = 'aadhaar',
  AADHAAR_MISMATCH_DETAILS = 'aadhaar_mismatch_details',
  INVESTMENT_SEGMENT = 'investment_segment',
  INCOME_PROOF = 'income_proof', // Backend step that doesn't have its own UI
  USER_DETAIL = 'user_detail',
  PERSONAL_DETAIL = 'personal_detail',
  OTHER_DETAIL = 'other_detail',
  BANK_VALIDATION = 'bank_validation',
  IPV = 'ipv',
  SIGNATURE = 'signature',
  ADD_NOMINEES = 'add_nominees',
  ESIGN = 'esign',
  PASSWORD_SETUP = 'password_setup',
  MPIN_SETUP = 'mpin_setup'
}

// All steps in your flow (including non-API steps)
export enum AllSteps {
  EMAIL = 'email',
  MOBILE = 'mobile',
  PAN = 'pan',
  AADHAAR = 'aadhaar',
  INVESTMENT_SEGMENT = 'investment_segment',
  USER_DETAIL = 'user_detail',
  PERSONAL_DETAIL = 'personal_detail',
  OTHER_DETAIL = 'other_detail',
  BANK_VALIDATION = 'bank_validation',
  IPV = 'ipv',
  SIGNATURE = 'signature',
  ADD_NOMINEES = 'add_nominees',
  LAST_STEP = 'last_step',
  SET_PASSWORD = 'set_password',
  MPIN = 'mpin',
  CONGRATULATIONS = 'congratulations'
}

// Component mapping to steps
export const STEP_TO_COMPONENT_INDEX = {
  [AllSteps.EMAIL]: 0,
  [AllSteps.MOBILE]: 1,
  [AllSteps.PAN]: 2,
  [AllSteps.AADHAAR]: 3,
  [AllSteps.INVESTMENT_SEGMENT]: 4,
  [AllSteps.USER_DETAIL]: 5,
  [AllSteps.PERSONAL_DETAIL]: 6,
  [AllSteps.OTHER_DETAIL]: 7,
  [AllSteps.BANK_VALIDATION]: 8,
  [AllSteps.IPV]: 9,
  [AllSteps.SIGNATURE]: 10,
  [AllSteps.ADD_NOMINEES]: 11,
  [AllSteps.LAST_STEP]: 12,
  [AllSteps.SET_PASSWORD]: 13,
  [AllSteps.MPIN]: 14,
  [AllSteps.CONGRATULATIONS]: 15,
} as const;

// Define the order of steps to check (only API steps)
const API_STEP_ORDER = [
  CheckpointStep.PAN,
  CheckpointStep.AADHAAR,
  CheckpointStep.AADHAAR_MISMATCH_DETAILS,
  CheckpointStep.INVESTMENT_SEGMENT,
  CheckpointStep.INCOME_PROOF,
  CheckpointStep.USER_DETAIL,
  CheckpointStep.PERSONAL_DETAIL,
  CheckpointStep.OTHER_DETAIL,
  CheckpointStep.BANK_VALIDATION,
  CheckpointStep.IPV,
  CheckpointStep.SIGNATURE,
  CheckpointStep.ADD_NOMINEES,
  CheckpointStep.ESIGN,
  CheckpointStep.PASSWORD_SETUP,
  CheckpointStep.MPIN_SETUP,
];

// Type definitions for API responses
interface StepDataWithUrl {
  url: string;
  [key: string]: unknown;
}

interface InvestmentSegmentData {
  segments: string[];
  requiresIncomeProof?: boolean;
  [key: string]: unknown;
}

interface PasswordSetupData {
  password_set?: boolean;
  client_id?: string;
  [key: string]: unknown;
}

interface MpinSetupData {
  client_id?: string;
  [key: string]: unknown;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
  message?: string;
}

interface CheckpointData {
  step: CheckpointStep;
  data: StepDataWithUrl | InvestmentSegmentData | PasswordSetupData | MpinSetupData | Record<string, unknown> | null;
  completed: boolean;
}

interface UseCheckpointReturn {
  checkpointData: Record<CheckpointStep, CheckpointData | null>;
  currentStep: number;
  isLoading: boolean;
  error: Error | null;
  refetchStep: (step: CheckpointStep) => void;
  invalidateAll: () => void;
  getStepData: (step: CheckpointStep) => CheckpointData['data'];
  isStepCompleted: (step: CheckpointStep) => boolean;
  isEmailCompleted: () => boolean;
  isMobileCompleted: () => boolean;
  getClientId: () => string | null;
  // New functions for mismatch handling
  hasMismatchData: () => boolean;
  getMismatchData: () => CheckpointData['data'];
  // Force next step function for income proof
  forceNextStep: (currentStepIndex: number) => number;
  // Client-side initialization state
  isClientInitialized: boolean;
}

// Custom hook to manage checkpoint data
export const useCheckpoint = (): UseCheckpointReturn => {
  const queryClient = useQueryClient();
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  
  // Initialize client-side state
  useEffect(() => {
    setIsClientInitialized(true);
  }, []);
  
  // Get auth token from cookies
  const getAuthToken = () => {
    return Cookies.get('authToken') || '';
  };

  // UPDATED: Enhanced function to get email from localStorage with JSON parsing and URL recovery support
  const getEmailFromStorage = (): string => {
    if (!isClientInitialized) return '';
    
    try {
      const storedEmail = localStorage.getItem("email");
      if (!storedEmail) return "";
      
      // Try to parse as JSON first (new format)
      try {
        const parsedEmail = JSON.parse(storedEmail);
        if (typeof parsedEmail === 'object' && parsedEmail.value) {
          // Check if email has expired
          if (parsedEmail.expiry && Date.now() > parsedEmail.expiry) {
            localStorage.removeItem("email");
            return "";
          }
          
          // Log if this was recovered from URL
          if (parsedEmail.recoveredFromUrl) {
            console.log("Using email recovered from URL redirect");
          }
          
          return parsedEmail.value;
        }
      } catch {
        // If JSON parsing fails, treat as plain string (old format)
        return storedEmail;
      }
      
      return "";
    } catch (error) {
      console.error("Error retrieving email from localStorage:", error);
      return "";
    }
  };

  // UPDATED: Enhanced function to get phone from localStorage with JSON parsing and URL recovery support
  const getPhoneFromStorage = (): string => {
    if (!isClientInitialized) return '';
    
    try {
      const storedPhone = localStorage.getItem("verifiedPhone");
      if (!storedPhone) return "";
      
      // Try to parse as JSON first (new format)
      try {
        const parsedPhone = JSON.parse(storedPhone);
        if (typeof parsedPhone === 'object' && parsedPhone.value) {
          // Check if phone has expired
          if (parsedPhone.expiry && Date.now() > parsedPhone.expiry) {
            localStorage.removeItem("verifiedPhone");
            return "";
          }
          
          // Log if this was recovered from URL
          if (parsedPhone.recoveredFromUrl) {
            console.log("Using phone recovered from URL redirect");
          }
          
          return parsedPhone.value;
        }
      } catch {
        // If JSON parsing fails, treat as plain string (old format)
        return storedPhone;
      }
      
      return "";
    } catch (error) {
      console.error("Error retrieving phone from localStorage:", error);
      return "";
    }
  };

  // Check if email is completed - Enhanced with JSON parsing
  const isEmailCompleted = () => {
    if (!isClientInitialized) {
      return false;
    }
    
    const email = getEmailFromStorage();
    const emailExists = !!email;
    
    // Debug logging
    console.log("Email completed check:", emailExists, "Email value:", email);
    return emailExists;
  };

  // Check if mobile is completed - Enhanced with auth token and phone verification
  const isMobileCompleted = () => {
    if (!isClientInitialized) {
      return false;
    }
  
    // Check both auth token and verified phone
    const tokenExists = !!getAuthToken();
    const phone = getPhoneFromStorage();
    const phoneExists = !!phone;
    
    // Mobile is completed if both token and phone exist
    const mobileCompleted = tokenExists && phoneExists;
    
    // Debug logging
    console.log("Mobile completed check:", mobileCompleted, "Token exists:", tokenExists, "Phone exists:", phoneExists, "Phone value:", phone);
    return mobileCompleted;
  };

  // Function to fetch specific checkpoint step
  const fetchCheckpointStep = async (step: CheckpointStep): Promise<CheckpointData> => {
    const token = getAuthToken();
    if (!token) throw new Error('No auth token found');

    try {
      let response;
      
      // Use specific endpoints for special steps
      if (step === CheckpointStep.IPV) {
        try {
          response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/ipv`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          // IPV endpoint returns 200 OK with data when completed
          if (response.status === 200 && response.data?.data?.url) {
            console.log("IPV completed successfully with URL:", response.data.data.url);
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            // If no URL in response, IPV is not completed
            console.log("IPV endpoint returned 200 but no URL data");
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error) {
          const err = error as AxiosError;
          // Handle 204 No Content specifically (IPV not uploaded)
          if (err.response?.status === 204) {
            console.log("IPV endpoint returned 204 No Content - not uploaded yet");
            return {
              step,
              data: null,
              completed: false,
            };
          }
          // For other errors, re-throw to be handled by outer catch
          throw error;
        }
      } else if (step === CheckpointStep.SIGNATURE) {
        try {
          response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/signature`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          // Signature endpoint returns 200 OK with data when completed
          if (response.status === 200 && response.data?.data?.url) {
            console.log("Signature completed successfully with URL:", response.data.data.url);
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            // If no URL in response, signature is not completed
            console.log("Signature endpoint returned 200 but no URL data");
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error) {
          const err = error as AxiosError;
          // Handle 204 No Content specifically (signature not uploaded)
          if (err.response?.status === 204) {
            console.log("Signature endpoint returned 204 No Content - not uploaded yet");
            return {
              step,
              data: null,
              completed: false,
            };
          }
          // For other errors, re-throw to be handled by outer catch
          throw error;
        }
      } else if (step === CheckpointStep.INCOME_PROOF) {
        try {
          response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/income-proof`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          // Income proof endpoint returns URL if the file is uploaded
          if (response.status === 200 && response.data?.data?.url) {
            console.log("Income proof is completed with data:", response.data.data.url);
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            console.log("Income proof endpoint returned success but no data");
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error) {
          const err = error as AxiosError;
          // Handle 204 No Content specifically
          if (err.response?.status === 204) {
            console.log("Income proof endpoint returned 204 No Content");
            return {
              step,
              data: null,
              completed: false,
            };
          }
          console.error("Error fetching income proof:", error);
          throw error;
        }
      } else if (step === CheckpointStep.ESIGN) {
        try {
        response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint/esign_complete`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        
        console.log("eSign complete response:", response.data);
        console.log("eSign response.data:", JSON.stringify(response.data, null, 2));
        console.log("eSign response.data.data:", response.data?.data);
        console.log("eSign response.data.data.url:", response.data?.data?.url);
        console.log("eSign URL type:", typeof response.data?.data?.url);
        console.log("eSign URL length:", response.data?.data?.url?.length);
        
        // Check if we have the expected structure
        if (response.status === 200) {
            const hasData = response.data?.data;
            const hasUrl = response.data?.data?.url;
            const urlValue = response.data?.data?.url;
            const isValidUrl = urlValue && urlValue.trim() !== "";
            
            console.log("eSign validation:", {
                hasData,
                hasUrl,
                urlValue,
                isValidUrl,
                urlLength: urlValue?.length
            });
            
            if (hasData && typeof hasUrl !== 'undefined' && isValidUrl) {
                console.log("eSign completed successfully with URL:", urlValue);
                return {
                    step,
                    data: { url: urlValue } as StepDataWithUrl,
                    completed: true,
                };
            } else if (hasData && typeof hasUrl !== 'undefined' && urlValue === "") {
                // Empty URL means record exists but no file
                console.log("eSign record found but URL is empty");
                return {
                    step,
                    data: { url: "" } as StepDataWithUrl,
                    completed: true, // Still completed if record exists
                };
            } else {
                console.log("eSign complete endpoint returned success but invalid data structure");
                console.log("Expected: response.data.data.url, Got:", response.data);
                return {
                    step,
                    data: null,
                    completed: false,
                };
            }
        }
    } catch (error) {
        const err = error as AxiosError;
        console.log("eSign complete error:", err.response?.status, err.response?.data);
        
        // Handle specific error cases
        if (err.response?.status === 404) {
            console.log("eSign not found in database - not completed yet");
            return {
                step,
                data: null,
                completed: false,
            };
        } else if (err.response?.status === 401) {
            console.log("eSign not authorized - not completed yet");
            return {
                step,
                data: null,
                completed: false,
            };
        }
        
        // For other errors, re-throw
        throw error;
    }
}
      else {
        // Use the general checkpoint endpoint for all other steps
        response = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint/${step}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
      
      return {
        step,
        data: response.data.data as Record<string, unknown>,
        completed: true,
      };
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      if (err.response?.status === 404 || err.response?.status === 204) {
        // Step not completed yet
        return {
          step,
          data: null,
          completed: false,
        };
      }
      
      // Special handling for PASSWORD_SETUP step
      if (step === CheckpointStep.PASSWORD_SETUP && err.response?.status === 400) {
        const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || '';
        if (errorMessage.includes('Password already set')) {
          console.log("Password already set - treating as completed");
          return {
            step,
            data: { password_set: true } as PasswordSetupData,
            completed: true,
          };
        }
      }
      
      throw error;
    }
  };

  // Query only API-backed checkpoint steps - moved outside callback
  const checkpointQueries = API_STEP_ORDER.map(step => 
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['checkpoint', step],
      queryFn: () => fetchCheckpointStep(step),
      enabled: !!getAuthToken() && isClientInitialized, // Only fetch if we have a token AND client is initialized
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 20 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        const err = error as AxiosError;
        // Don't retry on 404 or 204 (step not completed)
        if (err?.response?.status === 404 || err?.response?.status === 204) {
          return false;
        }
        return failureCount < 3;
      },
    })
  );

  // Process data into a more usable format
  const checkpointData: Record<CheckpointStep, CheckpointData | null> = 
    API_STEP_ORDER.reduce((acc, step, index) => {
      const query = checkpointQueries[index];
      acc[step] = query.data || null;
      return acc;
    }, {} as Record<CheckpointStep, CheckpointData | null>);

  // Get client ID from completed checkpoints
  const getClientId = (): string | null => {
    const passwordData = checkpointData[CheckpointStep.PASSWORD_SETUP];
    if (passwordData?.data && typeof passwordData.data === 'object' && 'client_id' in passwordData.data) {
      return passwordData.data.client_id as string;
    }
    
    const mpinData = checkpointData[CheckpointStep.MPIN_SETUP];
    if (mpinData?.data && typeof mpinData.data === 'object' && 'client_id' in mpinData.data) {
      return mpinData.data.client_id as string;
    }
    
    for (const step of API_STEP_ORDER) {
      const stepData = checkpointData[step];
      if (stepData?.data && typeof stepData.data === 'object' && 'client_id' in stepData.data) {
        return stepData.data.client_id as string;
      }
    }
    
    return null;
  };

  // Check if there's mismatch data in Redis
  const hasMismatchData = (): boolean => {
    const mismatchData = checkpointData[CheckpointStep.AADHAAR_MISMATCH_DETAILS];
    return !!(mismatchData?.data && mismatchData.completed);
  };

  // Get mismatch data
  const getMismatchData = (): CheckpointData['data'] => {
    const mismatchData = checkpointData[CheckpointStep.AADHAAR_MISMATCH_DETAILS];
    return mismatchData?.data || null;
  };

  // Helper function to check if a step has valid data
  const hasValidData = (step: CheckpointStep): boolean => {
    const stepData = checkpointData[step];
    
    // console.log(`Validating step ${step}:`, {
    //   stepData,
    //   completed: stepData?.completed,
    //   data: stepData?.data
    // });
    
    if (!stepData?.completed || !stepData.data) {
      return false;
    }

    // Specific validation rules for different steps
    switch (step) {
      case CheckpointStep.INVESTMENT_SEGMENT: {
        const data = stepData.data as InvestmentSegmentData;
        return !!(data.segments && data.segments.length > 0);
      }
      
      case CheckpointStep.INCOME_PROOF: {
        const data = stepData.data as StepDataWithUrl;
        return !!data.url; // Check for URL presence
      }
      
      case CheckpointStep.IPV: {
        const data = stepData.data as StepDataWithUrl;
        const isValid = !!data.url;
        console.log(`IPV validation - URL exists: ${isValid}, URL value:`, data.url);
        return isValid;
      }
      
      case CheckpointStep.SIGNATURE: {
        const data = stepData.data as StepDataWithUrl;
        const isValid = !!data.url;
        console.log(`Signature validation - URL exists: ${isValid}, URL value:`, data.url);
        return isValid;
      }
      
      case CheckpointStep.ESIGN: {
        // For eSign, check if we have step data with url field (even empty string means completed)
        const hasUrlField = stepData.data && typeof stepData.data === 'object' && 'url' in stepData.data;
        console.log(`eSign validation - hasUrlField: ${hasUrlField}, url value:`, (stepData.data as StepDataWithUrl)?.url);
        return hasUrlField;
      }
      
      case CheckpointStep.PASSWORD_SETUP:
        // For password setup, check if we have data (including "password already set" case)
        return !!stepData.data;
      
      case CheckpointStep.MPIN_SETUP:
        // For MPIN setup, check if we have data
        return !!stepData.data;
      
      // For other steps, just check if there's any data
      default:
        return true;
    }
  };

  // Function to check if a step is completed, with proper validation
  const isStepCompleted = (step: CheckpointStep): boolean => {
    return hasValidData(step);
  };
  
  // Special function to force moving to the next step
  // This is used when we need to bypass step validation
  const forceNextStep = (currentStepIndex: number): number => {
    // If we're on the investment segment step
    if (currentStepIndex === STEP_TO_COMPONENT_INDEX[AllSteps.INVESTMENT_SEGMENT]) {
      // Force move to User Detail step
      return STEP_TO_COMPONENT_INDEX[AllSteps.USER_DETAIL];
    }
    return currentStepIndex;
  };

  // NEW: Enhanced investment segment completion check
  const isInvestmentSegmentStepComplete = (): boolean => {
    // First check if investment segment itself is completed
    const investmentCompleted = isStepCompleted(CheckpointStep.INVESTMENT_SEGMENT);
    if (!investmentCompleted) {
      return false;
    }

    // Get investment segment data to check if income proof is required
    const investmentData = checkpointData[CheckpointStep.INVESTMENT_SEGMENT];
    const data = investmentData?.data as InvestmentSegmentData;
    const requiresIncomeProof = data?.requiresIncomeProof === true;
    
    // Also check if user selected risk segments that would require income proof
    const selectedSegments = data?.segments || [];
    const hasRiskSegments = selectedSegments.some((segment: string) => 
      segment === "F&O" || segment === "Currency" || segment === "Commodity"
    );
    
    // If income proof is required (either by backend flag or risk segments)
    if (requiresIncomeProof || hasRiskSegments) {
      // Check if income proof is also completed
      const incomeProofCompleted = isStepCompleted(CheckpointStep.INCOME_PROOF);
      console.log(`Investment segment complete: ${investmentCompleted}, Income proof required: ${requiresIncomeProof || hasRiskSegments}, Income proof completed: ${incomeProofCompleted}`);
      return incomeProofCompleted;
    }
    
    // If no income proof required, investment segment completion is sufficient
    console.log(`Investment segment complete: ${investmentCompleted}, No income proof required`);
    return true;
  };

  // Determine current step considering all steps
  const getCurrentStep = (): number => {
    // Don't calculate step if client is not initialized
    if (!isClientInitialized) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.EMAIL];
    }

    // Check email completion
    if (!isEmailCompleted()) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.EMAIL];
    }

    // Check mobile completion
    if (!isMobileCompleted()) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.MOBILE];
    }

    // Check PAN completion
    if (!isStepCompleted(CheckpointStep.PAN)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.PAN];
    }

    // Check for mismatch data first (this avoids expensive DigiLocker calls)
    const mismatchData = checkpointData[CheckpointStep.AADHAAR_MISMATCH_DETAILS];
    if (mismatchData?.completed) {
      // There's mismatch data, user needs to fill mismatch form
      return STEP_TO_COMPONENT_INDEX[AllSteps.AADHAAR];
    }

    // Check Aadhaar completion
    if (!isStepCompleted(CheckpointStep.AADHAAR)) {
      // console.log("Aadhaar not completed, returning Aadhaar step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.AADHAAR];
    }

    // Check Investment Segment with enhanced validation (includes income proof check)
    if (!isInvestmentSegmentStepComplete()) {
      // console.log("Investment segment step not complete, returning investment segment step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.INVESTMENT_SEGMENT];
    }
    
    // console.log("Investment segment step complete, proceeding to user detail");
    
    // Check User Detail
    if (!isStepCompleted(CheckpointStep.USER_DETAIL)) {
      // console.log("User detail not completed, returning user detail step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.USER_DETAIL];
    }

    // Check Personal Detail
    if (!isStepCompleted(CheckpointStep.PERSONAL_DETAIL)) {
      // console.log("Personal detail not completed, returning personal detail step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.PERSONAL_DETAIL];
    }

    // Check Other Detail
    if (!isStepCompleted(CheckpointStep.OTHER_DETAIL)) {
      // console.log("Other detail not completed, returning other detail step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.OTHER_DETAIL];
    }

    // Check Bank Validation
    if (!isStepCompleted(CheckpointStep.BANK_VALIDATION)) {
      // console.log("Bank validation not completed, returning bank validation step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.BANK_VALIDATION];
    }

    // Check IPV with enhanced validation
    if (!isStepCompleted(CheckpointStep.IPV)) {
      // console.log("IPV not completed, returning IPV step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.IPV];
    }

    // Check Signature with enhanced validation
    if (!isStepCompleted(CheckpointStep.SIGNATURE)) {
      // console.log("Signature not completed, returning signature step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.SIGNATURE];
    }

    // Check Add Nominees
    if (!isStepCompleted(CheckpointStep.ADD_NOMINEES)) {
      // console.log("Add nominees not completed, returning add nominees step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.ADD_NOMINEES];
    }

    // Check eSign
    if (!isStepCompleted(CheckpointStep.ESIGN)) {
      // console.log("eSign not completed, returning last step");
      // console.log("eSign step data:", checkpointData[CheckpointStep.ESIGN]);
      return STEP_TO_COMPONENT_INDEX[AllSteps.LAST_STEP];
    }

    // Check password setup
    if (!isStepCompleted(CheckpointStep.PASSWORD_SETUP)) {
      // console.log("Password setup not completed, returning set password step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.SET_PASSWORD];
    }

    // Check MPIN setup
    if (!isStepCompleted(CheckpointStep.MPIN_SETUP)) {
      // console.log("MPIN setup not completed, returning MPIN step");
      return STEP_TO_COMPONENT_INDEX[AllSteps.MPIN];
    }

    // All completed
    // console.log("All steps completed, returning congratulations step");
    return STEP_TO_COMPONENT_INDEX[AllSteps.CONGRATULATIONS];
  };

  const currentComponentStep = getCurrentStep();
  const isLoading = checkpointQueries.some(query => query.isLoading);
  const error = checkpointQueries.find(query => query.error)?.error as Error | null;

  return {
    checkpointData,
    currentStep: currentComponentStep,
    isLoading,
    error,
    refetchStep: (step: CheckpointStep) => {
      queryClient.invalidateQueries({ queryKey: ['checkpoint', step] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['checkpoint'] });
    },
    getStepData: (step: CheckpointStep) => checkpointData[step]?.data ?? null,
    isStepCompleted,
    isEmailCompleted,
    isMobileCompleted,
    getClientId,
    hasMismatchData,
    getMismatchData,
    forceNextStep,
    isClientInitialized, // Export this for external use
  };
};

// Hook specifically for auth token management
export const useAuthToken = () => {
  const setAuthToken = (token: string) => {
    Cookies.set('authToken', token, { expires: 1, secure: true, sameSite: 'strict' });
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const getAuthToken = () => {
    return Cookies.get('authToken');
  };

  const removeAuthToken = () => {
    Cookies.remove('authToken');
    delete axios.defaults.headers.common['Authorization'];
  };

  return {
    setAuthToken,
    getAuthToken,
    removeAuthToken,
  };
};