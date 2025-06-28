import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios, { AxiosError } from "axios";
import { useAuthToken } from "@/hooks/useCheckpoint";
import { toast } from "sonner";

interface MobileVerificationProps {
  onNext: () => void;
  initialData?: {
    phone?: string;
    [key: string]: unknown;
  };
  isCompleted?: boolean;
}

interface ApiErrorResponse {
  message: string;
  [key: string]: unknown;
}

interface ApiResponse {
  token?: string;
  [key: string]: unknown;
}

const MobileVerification = ({ onNext, initialData, isCompleted }: MobileVerificationProps) => {
  const [mobileNumber, setMobileNumber] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(600); //  10 minutes in seconds
  const [resendTimer, setResendTimer] = useState(0);
  const [hasManuallyVerified, setHasManuallyVerified] = useState(false); // Track manual verification
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [, setEmail] = useState("");

  const { setAuthToken } = useAuthToken();

  // Enhanced function to get email from localStorage with JSON parsing
  const getEmailFromStorage = (): string => {
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

  // Enhanced function to get phone from localStorage with JSON parsing
  const getPhoneFromStorage = (): string => {
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

  // Prefill data from initialData or localStorage
  useEffect(() => {
    if (isCompleted && initialData?.phone) {
      // If step is completed, prefill with data from API AND save to localStorage
      setMobileNumber(initialData.phone);
      setShowOTP(true); // Show OTP fields when completed
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day in ms
      localStorage.setItem(
        "verifiedPhone",
        JSON.stringify({ value: initialData.phone, expiry })
      );
    } else {
      // Try to get data from localStorage (from previous session)
      const storedPhone = getPhoneFromStorage();
      if (storedPhone) {
        setMobileNumber(storedPhone);
      }
    }

    // Get email from localStorage with enhanced parsing
    const storedEmail = getEmailFromStorage();
    setEmail(storedEmail);
    
    // Debug logging
    console.log("Mobile verification - Retrieved email from localStorage:", storedEmail);
  }, [initialData, isCompleted]);

  // Only auto-advance if manually verified in this session
  useEffect(() => {
    if (isCompleted && hasManuallyVerified) {
      // Auto-advance to next step after a short delay, only if manually verified
      const timer = setTimeout(() => {
        onNext();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, hasManuallyVerified, onNext]);

  // OTP timer for 10 minutes
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (showOTP && otpTimer > 0 && !isCompleted) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOTP, otpTimer, isCompleted]);

  // Resend OTP timer for 30 seconds
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (resendTimer > 0 && !isCompleted) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer, isCompleted]);

  const validateMobile = (number: string) => {
    return /^[6-9][0-9]{9}$/.test(number);
  };

  const handleButtonClick = async () => {
    // If completed, go to next step
    if (isCompleted) {
      onNext();
      return;
    }

    // If button is disabled, don't proceed
    if (isButtonDisabled()) {
      return;
    }

    // If OTP is shown and filled, verify OTP
    if (showOTP && otp.every((digit) => digit !== "")) {
      await handleVerifyOTP();
    }
    // If OTP is not shown yet, send OTP
    else if (!showOTP) {
      await handleSendOTP();
    }
  };

  const handleVerifyOTP = async () => {
    setIsLoading(true);
    setError(null);

    // Re-check email from localStorage in case it was updated
    const currentEmail = getEmailFromStorage();
    
    if (!currentEmail) {
      console.error("Verify your email first!");
      toast.error("Please verify your email first!");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post<ApiResponse>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/verify-otp`,
        {
          type: "phone",
          phone: mobileNumber,
          email: currentEmail,
          otp: otp.join(""),
        }
      );

      const token = response.data.token;
      
      // Set token in axios default headers for all future requests
      if (token) {
        setAuthToken(token);
      }

      // Always store verified phone in localStorage as JSON with expiry
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day in ms
      localStorage.setItem(
        "verifiedPhone",
        JSON.stringify({ value: mobileNumber, expiry })
      );
      
      // Mark as manually verified before proceeding
      setHasManuallyVerified(true);

      if (!response) {
        toast.error("Failed to verify your code. Please try again.");
        console.error("Send OTP error, Response :", response);
        return;
      }

      toast.success("Mobile number verified successfully!");
      onNext();
    } catch (err: unknown) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      if (axiosError.response?.data?.message) {
        toast.error(axiosError.response.data.message);
      } else {
        toast.error("Error verifying OTP. Please try again.");
      }
      console.error("Verification error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!validateMobile(mobileNumber)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    // Re-check email from localStorage in case it was updated
    const currentEmail = getEmailFromStorage();
    
    if (!currentEmail) {
      console.error("Verify your email first!");
      toast.error("Please verify your email first!");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<ApiResponse>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/request-otp`,
        {
          type: "phone",
          email: currentEmail,
          phone: mobileNumber,
        }
      );
      if (!response) {
        toast.error("Failed to send verification code. Please try again.");
        console.error("Send OTP error, Response :", response);
        return;
      }

      // Save mobile number to localStorage as JSON with expiry
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day in ms
      localStorage.setItem(
        "verifiedPhone",
        JSON.stringify({ value: mobileNumber, expiry })
      );

      setShowOTP(true);
      setOtpTimer(600); // Reset OTP timer to 10 minutes
      setResendTimer(30); // Set resend timer to 30 seconds
      toast.success("OTP sent successfully to your mobile number!");
      // Focus on the first OTP input after showing OTP fields
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<ApiErrorResponse>;
      if (axiosError.response?.data?.message) {
        toast.error(axiosError.response.data.message);
      } else {
        toast.error("Failed to send OTP. Please try again.");
      }
      console.error("Send OTP error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Don't allow changes if completed
    if (isCompleted) return;

    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOTP = [...otp];
      newOTP[index] = value;
      setOtp(newOTP);
      setError(null);

      if (value !== "" && index < 5) {
        inputRefs.current[index + 1]?.focus();
      } else if (value !== "" && index === 5) {
        // If the last digit is filled, try to submit automatically
        if (otp.slice(0, 5).every((digit) => digit !== "")) {
          // Only auto-submit if all previous digits are filled
          setTimeout(() => handleButtonClick(), 300);
        }
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Don't handle key events if completed
    if (isCompleted) return;

    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      buttonRef.current?.click();
    }
  };

  // Handle Enter key press in mobile input
  const handleMobileKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buttonRef.current?.click();
    }
  };

  // Get button text based on current state
  const getButtonText = () => {
    if (isCompleted) return "Continue to Next Step";
    if (isLoading) {
      return showOTP ? "Verifying..." : "Sending OTP...";
    }
    return showOTP ? "Verify My Mobile" : "Get OTP";
  };

  // Determine if button should be disabled
  const isButtonDisabled = () => {
    if (isCompleted) return false;
    if (isLoading) return true;
    
    // Check if email is available for mobile verification
    const currentEmail = getEmailFromStorage();
    if (!currentEmail) return true;
    
    if (!showOTP) return !validateMobile(mobileNumber);
    return !otp.every((digit) => digit !== "");
  };

  return (
    <div className="mx-auto -mt-28 lg:mt-0 pt-24">
      <FormHeading
        title={"Verify your Mobile"}
        description={"Please enter your mobile for verification."}
      />

      {/* Show email status for debugging - can be removed in production */}
      {!getEmailFromStorage() && !isCompleted && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-yellow-800 text-sm">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>Please verify your email first before proceeding with mobile verification.</span>
          </div>
        </div>
      )}

      <div className="mb-8">
        <label className="block text-gray-700 mb-2">Mobile Number</label>
        <div className="flex gap-3">
          <div className="bg-gray-50 px-3 py-2 rounded border border-gray-300 text-gray-500">
            +91
          </div>
          <input
            type="tel"
            placeholder="Your 10 digit mobile number"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
            value={mobileNumber}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length > 10) return;
              setMobileNumber(value);
              setError(null);
            }}
            onKeyDown={handleMobileKeyDown}
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            disabled={isLoading || showOTP || isCompleted}
          />
        </div>
      </div>

      {showOTP && (
        <div className="mb-6">
          <label className="block text-left text-gray-heading mb-3">
            Enter OTP
          </label>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOTPChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-10 sm:w-12 h-10 sm:h-12 text-center border-2 border-gray-300 focus:outline-none focus:border-teal-500 text-xl appearance-none
                  ${
                    index === 0
                      ? "rounded-md rounded-r-none"
                      : index === 5
                      ? "rounded-md rounded-l-none"
                      : "rounded-none"
                  }`}
                disabled={isLoading || isCompleted}
              />
            ))}
          </div>
          {!isCompleted && (
            <div className="flex flex-col sm:flex-row justify-end text-sm mb-2 gap-2">
              <button
                className="text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSendOTP}
                disabled={isLoading || resendTimer > 0}
              >
                {resendTimer > 0 ? `Resend OTP (${resendTimer}s)` : "Resend OTP"}
              </button>
            </div>
          )}
        </div>
      )}

      <Button
        ref={buttonRef}
        onClick={handleButtonClick}
        disabled={isButtonDisabled()}
        variant="ghost"
        className={`w-full py-6 rounded mb-6 ${
          isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {getButtonText()}
      </Button>

      <div className="hidden lg:block text-center text-xs text-gray-600 mt-8 space-y-3">
        <p>
          I authorise Sapphire to fetch my KYC information from the C-KYC
          registry with my PAN.
        </p>
        <p>
          If you are looking to open a HUF, Corporate, Partnership,or NRI
          account, you have to{" "}
          <span className="text-blue-400">click here.</span>
        </p>
      </div>
    </div>
  );
};

export default MobileVerification;