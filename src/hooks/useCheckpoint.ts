import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { useState, useEffect, useCallback } from 'react';

export enum CheckpointStep {
  PAN = 'pan',
  AADHAAR = 'aadhaar',
  AADHAAR_MISMATCH_DETAILS = 'aadhaar_mismatch_details',
  INVESTMENT_SEGMENT = 'investment_segment',
  INCOME_PROOF = 'income_proof',
  USER_DETAIL = 'user_detail',
  PERSONAL_DETAIL = 'personal_detail',
  OTHER_DETAIL = 'other_detail',
  BANK_VALIDATION = 'bank_validation',
  IPV = 'ipv',
  SIGNATURE = 'signature',
  ADD_NOMINEES = 'add_nominees',
  PAN_VERIFICATION_RECORD = 'pan_verification_record',
  ESIGN = 'esign',
  PASSWORD_SETUP = 'password_setup',
  MPIN_SETUP = 'mpin_setup',
  COMPLETE_BANK_VALIDATION = 'complete_bank_validation',
  COMPLETE_UPI_VALIDATION = 'complete_upi_validation'
}

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
  PAN_UPLOAD = 'pan_upload',
  LAST_STEP = 'last_step',
  SET_PASSWORD = 'set_password',
  MPIN = 'mpin',
  CONGRATULATIONS = 'congratulations'
}

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
  CheckpointStep.PAN_VERIFICATION_RECORD,
  CheckpointStep.ESIGN,
  CheckpointStep.PASSWORD_SETUP,
  CheckpointStep.MPIN_SETUP,
];

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

interface BankValidationData {
  account_holder_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_type?: string;
  verification_status?: string;
  is_completed?: boolean;
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
  data: StepDataWithUrl | InvestmentSegmentData | PasswordSetupData | MpinSetupData | BankValidationData | Record<string, unknown> | null;
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
  hasMismatchData: () => boolean;
  getMismatchData: () => CheckpointData['data'];
  forceNextStep: (currentStepIndex: number) => number;
  isClientInitialized: boolean;
  checkPanUploadRequirement: () => Promise<boolean>;
  isPanUploadRequired: boolean | null;
  setPanUploadRequired: (required: boolean | null) => void;
}

export const useCheckpoint = (): UseCheckpointReturn => {
  const queryClient = useQueryClient();
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  const [isPanUploadRequired, setIsPanUploadRequired] = useState<boolean | null>(null);
  
  useEffect(() => {
    setIsClientInitialized(true);
  }, []);
  
  const getAuthToken = () => {
    return Cookies.get('authToken') || '';
  };

  const getEmailFromStorage = (): string => {
    if (!isClientInitialized) return '';
    
    try {
      const storedEmail = localStorage.getItem("email");
      if (!storedEmail) return "";
      
      try {
        const parsedEmail = JSON.parse(storedEmail);
        if (typeof parsedEmail === 'object' && parsedEmail.value) {
          if (parsedEmail.expiry && Date.now() > parsedEmail.expiry) {
            localStorage.removeItem("email");
            return "";
          }
          
          if (parsedEmail.recoveredFromUrl) {
            return "";
          }
          
          return parsedEmail.value;
        }
      } catch {
        return storedEmail;
      }
      
      return "";
    } catch (error: unknown) {
      if (error instanceof Error) {
        // Optionally log error.message or handle it
      }
      return "";
    }
  };

  const getPhoneFromStorage = (): string => {
    if (!isClientInitialized) return '';
    
    try {
      const storedPhone = localStorage.getItem("verifiedPhone");
      if (!storedPhone) return "";
      
      try {
        const parsedPhone = JSON.parse(storedPhone);
        if (typeof parsedPhone === 'object' && parsedPhone.value) {
          if (parsedPhone.expiry && Date.now() > parsedPhone.expiry) {
            localStorage.removeItem("verifiedPhone");
            return "";
          }
          
          if (parsedPhone.recoveredFromUrl) {
            return "";
          }
          
          return parsedPhone.value;
        }
      } catch {
        return storedPhone;
      }
      
      return "";
    } catch (error) {
      console.log("Error retrieving phone from storage:", error);
      return "";
    }
  };

  const isEmailCompleted = () => {
    if (!isClientInitialized) {
      return false;
    }
    
    const email = getEmailFromStorage();
    return !!email;
  };

  const isMobileCompleted = () => {
    if (!isClientInitialized) {
      return false;
    }
  
    const tokenExists = !!getAuthToken();
    const phone = getPhoneFromStorage();
    const phoneExists = !!phone;
    
    return tokenExists && phoneExists;
  };

  const checkPanUploadRequirement = useCallback(async (retryCount = 0): Promise<boolean> => {
    try {
      const token = getAuthToken();
      if (!token) {
        return false;
      }

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/pan-verification-record`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );

      if (response.status === 200 && response.data?.data?.url) {
        return false;
      }
      
      return true;
    } catch (error: unknown) {
      const err = error as AxiosError;
      
      if (err.response?.status === 204) {
        return true;
      }
      
      if ((!err.response || err.code === 'ECONNABORTED') && retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return checkPanUploadRequirement(retryCount + 1);
      }
      
      return false;
    }
  }, [getAuthToken]);

  const setPanUploadRequired = useCallback((required: boolean | null) => {
    setIsPanUploadRequired(required);
  }, []);

  const fetchCheckpointStep = async (step: CheckpointStep): Promise<CheckpointData> => {
    const token = getAuthToken();
    if (!token) throw new Error('No auth token found');

    try {
      let response;
      
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
          
          if (response.status === 200 && response.data?.data?.url) {
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error: unknown) {
          const err = error as AxiosError;
          if (err.response?.status === 204) {
            return {
              step,
              data: null,
              completed: false,
            };
          }
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
          
          if (response.status === 200 && response.data?.data?.url) {
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error: unknown) {
          const err = error as AxiosError;
          if (err.response?.status === 204) {
            return {
              step,
              data: null,
              completed: false,
            };
          }
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
          
          if (response.status === 200 && response.data?.data?.url) {
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error) {
          const err = error as AxiosError;
          if (err.response?.status === 204) {
            return {
              step,
              data: null,
              completed: false,
            };
          }
          throw error;
        }
      } else if (step === CheckpointStep.PAN_VERIFICATION_RECORD) {
        try {
          response = await axios.get(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/pan-verification-record`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          
          if (response.status === 200 && response.data?.data?.url) {
            return {
              step,
              data: response.data.data as StepDataWithUrl,
              completed: true,
            };
          } else {
            return {
              step,
              data: null,
              completed: false,
            };
          }
        } catch (error) {
          const err = error as AxiosError;
          if (err.response?.status === 204) {
            return {
              step,
              data: null,
              completed: false,
            };
          }
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
          
          if (response.status === 200) {
            const hasData = response.data?.data;
            const hasUrl = response.data?.data?.url;
            const urlValue = response.data?.data?.url;
            const isValidUrl = urlValue && urlValue.trim() !== "";
            
            if (hasData && typeof hasUrl !== 'undefined' && isValidUrl) {
              return {
                step,
                data: { url: urlValue } as StepDataWithUrl,
                completed: true,
              };
            } else if (hasData && typeof hasUrl !== 'undefined' && urlValue === "") {
              return {
                step,
                data: { url: "" } as StepDataWithUrl,
                completed: true,
              };
            } else {
              return {
                step,
                data: null,
                completed: false,
              };
            }
          }
        } catch (error) {
          const err = error as AxiosError;
          
          if (err.response?.status === 404) {
            return {
              step,
              data: null,
              completed: false,
            };
          } else if (err.response?.status === 401) {
            return {
              step,
              data: null,
              completed: false,
            };
          }
          
          throw error;
        }
      } else if (step === CheckpointStep.BANK_VALIDATION) {
        response = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: { step: 'bank_validation' },
          }
        );
        if (response.status === 200 && response.data?.data?.bank) {
          return {
            step,
            data: response.data.data.bank,
            completed: true,
          };
        } else {
          return {
            step,
            data: null,
            completed: false,
          };
        }

      } else {
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
    } catch (error: unknown) {
      const err = error as AxiosError<ApiErrorResponse>;
      if (err.response?.status === 404 || err.response?.status === 204) {
        return {
          step,
          data: null,
          completed: false,
        };
      }
      
      if (step === CheckpointStep.PASSWORD_SETUP && err.response?.status === 400) {
        const errorMessage = err.response?.data?.error?.message || err.response?.data?.message || '';
        if (errorMessage.includes('Password already set')) {
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

  const panQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.PAN],
    queryFn: () => fetchCheckpointStep(CheckpointStep.PAN),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const aadhaarQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.AADHAAR],
    queryFn: () => fetchCheckpointStep(CheckpointStep.AADHAAR),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const aadhaarMismatchQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.AADHAAR_MISMATCH_DETAILS],
    queryFn: () => fetchCheckpointStep(CheckpointStep.AADHAAR_MISMATCH_DETAILS),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const investmentSegmentQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.INVESTMENT_SEGMENT],
    queryFn: () => fetchCheckpointStep(CheckpointStep.INVESTMENT_SEGMENT),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const incomeProofQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.INCOME_PROOF],
    queryFn: () => fetchCheckpointStep(CheckpointStep.INCOME_PROOF),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const userDetailQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.USER_DETAIL],
    queryFn: () => fetchCheckpointStep(CheckpointStep.USER_DETAIL),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const personalDetailQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.PERSONAL_DETAIL],
    queryFn: () => fetchCheckpointStep(CheckpointStep.PERSONAL_DETAIL),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const otherDetailQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.OTHER_DETAIL],
    queryFn: () => fetchCheckpointStep(CheckpointStep.OTHER_DETAIL),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const bankValidationQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.BANK_VALIDATION],
    queryFn: () => fetchCheckpointStep(CheckpointStep.BANK_VALIDATION),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const completeBankValidationQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.COMPLETE_BANK_VALIDATION],
    queryFn: () => fetchCheckpointStep(CheckpointStep.COMPLETE_BANK_VALIDATION),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const completeUpiValidationQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.COMPLETE_UPI_VALIDATION],
    queryFn: () => fetchCheckpointStep(CheckpointStep.COMPLETE_UPI_VALIDATION),
    enabled: !!getAuthToken() && isClientInitialized && 
      !(completeBankValidationQuery.data?.completed && 
        (completeBankValidationQuery.data.data as BankValidationData)?.is_completed === true),
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const ipvQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.IPV],
    queryFn: () => fetchCheckpointStep(CheckpointStep.IPV),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const signatureQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.SIGNATURE],
    queryFn: () => fetchCheckpointStep(CheckpointStep.SIGNATURE),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const addNomineesQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.ADD_NOMINEES],
    queryFn: () => fetchCheckpointStep(CheckpointStep.ADD_NOMINEES),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const panVerificationQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.PAN_VERIFICATION_RECORD],
    queryFn: () => fetchCheckpointStep(CheckpointStep.PAN_VERIFICATION_RECORD),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const esignQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.ESIGN],
    queryFn: () => fetchCheckpointStep(CheckpointStep.ESIGN),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const passwordSetupQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.PASSWORD_SETUP],
    queryFn: () => fetchCheckpointStep(CheckpointStep.PASSWORD_SETUP),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const mpinSetupQuery = useQuery({
    queryKey: ['checkpoint', CheckpointStep.MPIN_SETUP],
    queryFn: () => fetchCheckpointStep(CheckpointStep.MPIN_SETUP),
    enabled: !!getAuthToken() && isClientInitialized,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as AxiosError;
      if (err?.response?.status === 404 || err?.response?.status === 204) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const checkpointQueries = [
    panQuery,
    aadhaarQuery,
    aadhaarMismatchQuery,
    investmentSegmentQuery,
    incomeProofQuery,
    userDetailQuery,
    personalDetailQuery,
    otherDetailQuery,
    bankValidationQuery,
    completeBankValidationQuery,
    completeUpiValidationQuery,
    ipvQuery,
    signatureQuery,
    addNomineesQuery,
    panVerificationQuery,
    esignQuery,
    passwordSetupQuery,
    mpinSetupQuery,
  ];

  const checkpointData: Record<CheckpointStep, CheckpointData | null> = {
    [CheckpointStep.PAN]: panQuery.data || null,
    [CheckpointStep.AADHAAR]: aadhaarQuery.data || null,
    [CheckpointStep.AADHAAR_MISMATCH_DETAILS]: aadhaarMismatchQuery.data || null,
    [CheckpointStep.INVESTMENT_SEGMENT]: investmentSegmentQuery.data || null,
    [CheckpointStep.INCOME_PROOF]: incomeProofQuery.data || null,
    [CheckpointStep.USER_DETAIL]: userDetailQuery.data || null,
    [CheckpointStep.PERSONAL_DETAIL]: personalDetailQuery.data || null,
    [CheckpointStep.OTHER_DETAIL]: otherDetailQuery.data || null,
    [CheckpointStep.BANK_VALIDATION]: bankValidationQuery.data || null,
    [CheckpointStep.COMPLETE_BANK_VALIDATION]: completeBankValidationQuery.data || null,
    [CheckpointStep.COMPLETE_UPI_VALIDATION]: completeUpiValidationQuery.data || null,
    [CheckpointStep.IPV]: ipvQuery.data || null,
    [CheckpointStep.SIGNATURE]: signatureQuery.data || null,
    [CheckpointStep.ADD_NOMINEES]: addNomineesQuery.data || null,
    [CheckpointStep.PAN_VERIFICATION_RECORD]: panVerificationQuery.data || null,
    [CheckpointStep.ESIGN]: esignQuery.data || null,
    [CheckpointStep.PASSWORD_SETUP]: passwordSetupQuery.data || null,
    [CheckpointStep.MPIN_SETUP]: mpinSetupQuery.data || null,
  };

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

  const hasMismatchData = (): boolean => {
    const mismatchData = checkpointData[CheckpointStep.AADHAAR_MISMATCH_DETAILS];
    return !!(mismatchData?.data && mismatchData.completed);
  };

  const getMismatchData = (): CheckpointData['data'] => {
    const mismatchData = checkpointData[CheckpointStep.AADHAAR_MISMATCH_DETAILS];
    return mismatchData?.data || null;
  };

  const hasValidData = (step: CheckpointStep): boolean => {
    const stepData = checkpointData[step];
    
    if (!stepData?.completed || !stepData.data) {
      return false;
    }

    switch (step) {
      case CheckpointStep.INVESTMENT_SEGMENT: {
        const data = stepData.data as InvestmentSegmentData;
        return !!(data.segments && data.segments.length > 0);
      }
      
      case CheckpointStep.INCOME_PROOF: {
        const data = stepData.data as StepDataWithUrl;
        return !!data.url;
      }
      
      case CheckpointStep.IPV: {
        const data = stepData.data as StepDataWithUrl;
        return !!data.url;
      }
      
      case CheckpointStep.SIGNATURE: {
        const data = stepData.data as StepDataWithUrl;
        return !!data.url;
      }
      
      case CheckpointStep.PAN_VERIFICATION_RECORD: {
        const data = stepData.data as StepDataWithUrl;
        return !!data.url;
      }
      
      case CheckpointStep.ESIGN: {
        const hasUrlField = stepData.data && typeof stepData.data === 'object' && 'url' in stepData.data;
        return hasUrlField;
      }
      
      case CheckpointStep.COMPLETE_BANK_VALIDATION: {
        const data = stepData.data as BankValidationData;
        return data.is_completed === true;
      }
      
      case CheckpointStep.COMPLETE_UPI_VALIDATION: {
        const data = stepData.data as BankValidationData;
        return data.is_completed === true;
      }
      
      case CheckpointStep.PASSWORD_SETUP:
        return !!stepData.data;
      
      case CheckpointStep.MPIN_SETUP:
        return !!stepData.data;
      
      default:
        return true;
    }
  };

  const isStepCompleted = (step: CheckpointStep): boolean => {
    return hasValidData(step);
  };
  
  const forceNextStep = (currentStepIndex: number): number => {
    const STEP_TO_COMPONENT_INDEX = {
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
      [AllSteps.PAN_UPLOAD]: 12,
      [AllSteps.LAST_STEP]: 13,
      [AllSteps.SET_PASSWORD]: 14,
      [AllSteps.MPIN]: 15,
      [AllSteps.CONGRATULATIONS]: 16,
    } as const;

    if (currentStepIndex === STEP_TO_COMPONENT_INDEX[AllSteps.INVESTMENT_SEGMENT]) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.USER_DETAIL];
    }
    return currentStepIndex;
  };

  const isInvestmentSegmentStepComplete = (): boolean => {
    const investmentCompleted = isStepCompleted(CheckpointStep.INVESTMENT_SEGMENT);
    if (!investmentCompleted) {
      return false;
    }

    const investmentData = checkpointData[CheckpointStep.INVESTMENT_SEGMENT];
    const data = investmentData?.data as InvestmentSegmentData;
    const requiresIncomeProof = data?.requiresIncomeProof === true;
    
    const selectedSegments = data?.segments || [];
    const hasRiskSegments = selectedSegments.some((segment: string) => 
      segment === "F&O" || segment === "Currency" || segment === "Commodity"
    );
    
    if (requiresIncomeProof || hasRiskSegments) {
      const incomeProofCompleted = isStepCompleted(CheckpointStep.INCOME_PROOF);
      return incomeProofCompleted;
    }
    
    return true;
  };

  const isBankValidationComplete = (): boolean => {
    const completeBankValidation = checkpointData[CheckpointStep.COMPLETE_BANK_VALIDATION];
    const completeUpiValidation = checkpointData[CheckpointStep.COMPLETE_UPI_VALIDATION];
    
    const bankCompleted = completeBankValidation?.data && 
      (completeBankValidation.data as BankValidationData).is_completed === true;
    
    const upiCompleted = completeUpiValidation?.data && 
      (completeUpiValidation?.data as BankValidationData | undefined)?.is_completed === true;

    return !!bankCompleted || !!upiCompleted;
  };

  const getCurrentStep = (): number => {
    const STEP_TO_COMPONENT_INDEX = {
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
      [AllSteps.PAN_UPLOAD]: 12,
      [AllSteps.LAST_STEP]: isPanUploadRequired === true ? 13 : 12,
      [AllSteps.SET_PASSWORD]: isPanUploadRequired === true ? 14 : 13,
      [AllSteps.MPIN]: isPanUploadRequired === true ? 15 : 14,
      [AllSteps.CONGRATULATIONS]: isPanUploadRequired === true ? 16 : 15,
    } as const;

    if (!isClientInitialized) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.EMAIL];
    }

    if (!isEmailCompleted()) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.EMAIL];
    }

    if (!isMobileCompleted()) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.MOBILE];
    }

    if (!isStepCompleted(CheckpointStep.PAN)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.PAN];
    }

    const mismatchData = checkpointData[CheckpointStep.AADHAAR_MISMATCH_DETAILS];
    if (mismatchData?.completed) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.AADHAAR];
    }

    if (!isStepCompleted(CheckpointStep.AADHAAR)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.AADHAAR];
    }

    if (!isInvestmentSegmentStepComplete()) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.INVESTMENT_SEGMENT];
    }
    
    if (!isStepCompleted(CheckpointStep.USER_DETAIL)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.USER_DETAIL];
    }

    if (!isStepCompleted(CheckpointStep.PERSONAL_DETAIL)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.PERSONAL_DETAIL];
    }

    if (!isStepCompleted(CheckpointStep.OTHER_DETAIL)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.OTHER_DETAIL];
    }

    if (!isStepCompleted(CheckpointStep.BANK_VALIDATION) && !isBankValidationComplete()) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.BANK_VALIDATION];
    }

    if (!isStepCompleted(CheckpointStep.IPV)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.IPV];
    }

    if (!isStepCompleted(CheckpointStep.SIGNATURE)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.SIGNATURE];
    }

    if (!isStepCompleted(CheckpointStep.ADD_NOMINEES)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.ADD_NOMINEES];
    }

    if (isPanUploadRequired === true && !isStepCompleted(CheckpointStep.PAN_VERIFICATION_RECORD)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.PAN_UPLOAD];
    }

    if (!isStepCompleted(CheckpointStep.ESIGN)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.LAST_STEP];
    }

    if (!isStepCompleted(CheckpointStep.PASSWORD_SETUP)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.SET_PASSWORD];
    }

    if (!isStepCompleted(CheckpointStep.MPIN_SETUP)) {
      return STEP_TO_COMPONENT_INDEX[AllSteps.MPIN];
    }

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
    isClientInitialized,
    checkPanUploadRequirement,
    isPanUploadRequired,
    setPanUploadRequired,
  };
};

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