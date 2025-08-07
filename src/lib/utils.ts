import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// API endpoint mapping for different routes
const API_ENDPOINTS = {
  signup: {
    verifyOtp: '/api/v1/auth/signup/verify-otp',
    requestOtp: '/api/v1/auth/signup/request-otp',
    checkpoint: '/api/v1/auth/signup/checkpoint',
    finalize: '/api/v1/auth/signup/finalize',
    setupPassword: '/api/v1/auth/signup/setup-password',
    setupMpin: '/api/v1/auth/signup/setup-mpin',
    panCheckpoint: '/api/v1/auth/signup/checkpoint/pan',
    aadhaarCheckpoint: '/api/v1/auth/signup/checkpoint/aadhaar',
    aadhaarUri: '/api/v1/auth/signup/checkpoint/aadhaar_uri',
    ipv: '/api/v1/auth/signup/ipv',
    esignComplete: '/api/v1/auth/signup/checkpoint/esign_complete',
    incomeProof: '/api/v1/auth/signup/income-proof',
    signature: '/api/v1/auth/signup/signature',
    validateIfsc: '/api/v1/auth/signup/validate-ifsc',
    panVerificationRecord: '/api/v1/auth/signup/pan-verification-record',
    ipvWithId: '/api/v1/auth/signup/ipv',
    incomeProofWithId: '/api/v1/auth/signup/income-proof',
    signatureWithId: '/api/v1/auth/signup/signature'
  },
  minor: {
    // Define your minor API endpoints here - they can be completely different
    verifyOtp: '/api/v1/auth/minor/verify-otp',
    requestOtp: '/api/v1/auth/minor/request-otp',
    checkpoint: '/api/v1/auth/minor/checkpoint',
    finalize: '/api/v1/auth/minor/finalize',
    setupPassword: '/api/v1/auth/minor/setup-password',
    setupMpin: '/api/v1/auth/minor/setup-mpin',
    panCheckpoint: '/api/v1/auth/minor/checkpoint/pan',
    aadhaarCheckpoint: '/api/v1/auth/minor/checkpoint/aadhaar',
    aadhaarUri: '/api/v1/auth/minor/checkpoint/aadhaar_uri',
    ipv: '/api/v1/auth/minor/ipv',
    esignComplete: '/api/v1/auth/minor/checkpoint/esign_complete',
    incomeProof: '/api/v1/auth/minor/income-proof',
    signature: '/api/v1/auth/minor/signature',
    validateIfsc: '/api/v1/auth/minor/validate-ifsc',
    panVerificationRecord: '/api/v1/auth/minor/pan-verification-record',
    ipvWithId: '/api/v1/auth/minor/ipv',
    incomeProofWithId: '/api/v1/auth/minor/income-proof',
    signatureWithId: '/api/v1/auth/minor/signature'
  }
};

// Clean function to get the correct API endpoint based on current route
export const getApiEndpointByType = (endpointType: keyof typeof API_ENDPOINTS.signup): string => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    
    if (currentPath === '/minor') {
      return API_ENDPOINTS.minor[endpointType];
    }
  }
  return API_ENDPOINTS.signup[endpointType];
};
