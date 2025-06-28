import React, { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import axios, { AxiosError } from "axios";
import FormHeading from "./FormHeading";
import { useAuthToken } from "@/hooks/useCheckpoint";
import { toast } from "sonner";

// Declare global grecaptcha from Google's CDN
declare global {
  interface Window {
    grecaptcha: {
      render: (element: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId: number) => void;
    };
    onRecaptchaLoad?: () => void; // Add this to avoid type casting
  }
}

interface EmailVerificationProps {
  onNext: () => void;
  initialData?: {
    email?: string;
    [key: string]: unknown;
  };
  isCompleted?: boolean;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
  message?: string;
}

interface RecaptchaProps {
  sitekey: string;
  onChange: (token: string | null) => void;
  onExpired?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact';
  onReset?: () => void;
}

interface RecaptchaRef {
  reset: () => void;
}

// Custom ReCAPTCHA component using Google's CDN
const CustomReCAPTCHA = React.forwardRef<RecaptchaRef, RecaptchaProps>(({ 
  sitekey, 
  onChange, 
  onExpired, 
  onError,
  theme = 'light',
  size = 'normal',
  onReset
}, ref) => {
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const initRecaptcha = React.useCallback(() => {
    if (window.grecaptcha && window.grecaptcha.render && recaptchaContainerRef.current && widgetId === null) {
      try {
        const id = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey,
          callback: (token: string) => onChange(token),
          'expired-callback': () => {
            onChange(null);
            onExpired?.();
          },
          'error-callback': () => {
            onChange(null);
            onError?.();
          },
          theme,
          size
        });
        setWidgetId(id);
        setIsLoaded(true);
      } catch (error) {
        console.error('ReCAPTCHA render error:', error);
        onError?.();
      }
    }
  }, [onChange, onError, onExpired, sitekey, size, theme, widgetId]);

  const reset = React.useCallback(() => {
    if (widgetId !== null && window.grecaptcha && window.grecaptcha.reset) {
      try {
        window.grecaptcha.reset(widgetId);
        onChange(null);
        onReset?.();
      } catch (error) {
        console.error('ReCAPTCHA reset error:', error);
      }
    }
  }, [onChange, onReset, widgetId]);

  // Expose reset method to parent
  React.useImperativeHandle(ref, () => ({
    reset
  }), [reset]);

  useEffect(() => {
    // Check if grecaptcha is already loaded
    if (typeof window !== "undefined" && typeof window.grecaptcha !== "undefined" && typeof window.grecaptcha.render === "function") {
      initRecaptcha();
      return;
    }

    // Load Google reCAPTCHA script if not already loaded
    const existingScript = document.querySelector('script[src*="recaptcha"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit';
      script.async = true;
      script.defer = true;

      // Create global callback
      window.onRecaptchaLoad = () => {
        initRecaptcha();
      };

      document.head.appendChild(script);

      return () => {
        // Cleanup
        if (widgetId !== null && window.grecaptcha && window.grecaptcha.reset) {
          try {
            window.grecaptcha.reset(widgetId);
          } catch (error) {
            console.error('Cleanup error:', error);
          }
        }
      };
    } else {
      // Script exists, wait for it to load
      const checkGrecaptcha = setInterval(() => {
        if (window.grecaptcha && typeof window.grecaptcha.render === "function") {
          clearInterval(checkGrecaptcha);
          initRecaptcha();
        }
      }, 100);

      return () => clearInterval(checkGrecaptcha);
    }
  }, [initRecaptcha]);

  return (
    <div>
      <div ref={recaptchaContainerRef}></div>
      {!isLoaded && (
        <div className="flex items-center justify-center p-4 bg-gray-100 border border-gray-300 rounded">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading reCAPTCHA...</span>
        </div>
      )}
    </div>
  );
});

CustomReCAPTCHA.displayName = 'CustomReCAPTCHA';

const EmailVerification = ({ onNext, initialData, isCompleted }: EmailVerificationProps) => {
  const [email, setEmail] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(600); // 10 minutes in seconds
  const [resendTimer, setResendTimer] = useState(0);
  const [hasManuallyVerified, setHasManuallyVerified] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [isResendingOTP, setIsResendingOTP] = useState(false); // New state for resend loading
  
  // reCAPTCHA states
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0); // For resetting reCAPTCHA
  const [captchaVerified, setCaptchaVerified] = useState(false); // Track if captcha was verified before
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const recaptchaRef = useRef<RecaptchaRef>(null);

  const { setAuthToken } = useAuthToken();

  // Helper function to get email from localStorage with expiry check
  const getStoredEmail = () => {
    try {
      const stored = localStorage.getItem("email");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiry && Date.now() < parsed.expiry) {
          return parsed.value;
        } else {
          // Remove expired email
          localStorage.removeItem("email");
        }
      }
    } catch (error) {
      console.warn("Error reading stored email:", error);
      localStorage.removeItem("email");
    }
    return null;
  };

  // Reset captcha
  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaKey(prev => prev + 1); // This will force reCAPTCHA to reset
    // Reset the reCAPTCHA widget
    if (recaptchaRef.current && recaptchaRef.current.reset) {
      recaptchaRef.current.reset();
    }
  };

  // Initialize captcha on component mount
  useEffect(() => {
    if (!captchaVerified) {
      resetCaptcha();
    }
  }, [captchaVerified]);

  const handleCaptchaChange = (token: string | null) => {
    if (token) {
      setCaptchaToken(token);
      setCaptchaVerified(true); // Remember that captcha was verified
      toast.success("Captcha verification successful!");
    } else {
      setCaptchaToken(null);
    }
  };

  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
    toast.warning("Captcha expired. Please verify again.");
  };

  const handleCaptchaError = () => {
    setCaptchaToken(null);
    toast.error("Captcha verification failed. Please try again.");
  };

  const validateEmail = (email: string) => {
    return email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
  };

  const handleChangeEmail = () => {
    setShowChangeEmail(true);
    setShowOTP(false);
    setOtp(["", "", "", "", "", ""]);
    setOtpTimer(600);
    setResendTimer(0);
    
    // Don't reset captcha - keep it verified for change email
    // User doesn't need to solve captcha again for changing email
  };

  // Prefill email from initialData or localStorage (only if previously verified)
  useEffect(() => {
    if (isCompleted && initialData?.email) {
      // If step is completed, prefill with data from API 
      setEmail(initialData.email);
      // Also show OTP fields if step is completed
      setShowOTP(true);
    } else {
      // Try to get email from localStorage (only if previously verified and not expired)
      const storedEmail = getStoredEmail();
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
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
    else if (!showOTP || showChangeEmail) {
      await handleSendOTP();
    }
  };

  const handleVerifyOTP = async () => {
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/verify-otp`,
        {
          type: "email",
          email: email,
          otp: otp.join(""),
        }
      );

      if (!response.data) {
        toast.error("Failed to verify your code. Please try again.");
        return;
      }

      // ONLY save email to localStorage after successful verification
      const expiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day in ms
      localStorage.setItem("email", JSON.stringify({ value: email, expiry }));
      
      // Store auth token in cookies and axios headers
      if (response.data.token) {
        setAuthToken(response.data.token);
      }

      // Mark as manually verified before proceeding
      setHasManuallyVerified(true);

      toast.success("Email verified successfully!");
      onNext();
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      
      // Check for backend error message in different possible locations
      const errorMessage = 
        err.response?.data?.error?.message ||  // {"error":{"message":"Invalid OTP provided"}}
        err.response?.data?.message ||         // {"message":"Invalid OTP provided"}
        (typeof err.response?.data === 'object' && 
         'error' in err.response.data && 
         typeof err.response.data.error === 'string' ? 
         err.response.data.error : null) ||   // {"error":"Invalid OTP provided"}
        "Error verifying code. Please try again."; // fallback
      
      toast.error(errorMessage);
      console.error("Verification error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check for captcha verification only for initial send (not for change email)
    if (!captchaVerified && !captchaToken && !showChangeEmail) {
      toast.error("Please complete the captcha verification");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/request-otp`,
        {
          type: "email",
          email: email,
        }
      );

      if (!response.data) {
        toast.error("Failed to send verification code. Please try again.");
        return;
      }

      // DO NOT save email to localStorage yet - only after verification
      
      setShowOTP(true);
      setShowChangeEmail(false);
      setOtpTimer(600); // Reset OTP timer to 10 minutes
      setResendTimer(30); // Set resend timer to 30 seconds
      
      toast.success("Verification code sent to your email!");
      
      // Focus on the first OTP input after showing OTP fields
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      
      // Check for backend error message in different possible locations
      const errorMessage = 
        err.response?.data?.error?.message ||  // {"error":{"message":"Some error"}}
        err.response?.data?.message ||         // {"message":"Some error"}
        (typeof err.response?.data === 'object' && 
         'error' in err.response.data && 
         typeof err.response.data.error === 'string' ? 
         err.response.data.error : null) ||   // {"error":"Some error"}
        "Failed to send verification code. Please try again."; // fallback
      
      toast.error(errorMessage);
      console.error("Send OTP error:", err);
      
      // Reset captcha on error only if not previously verified and not changing email
      if (!captchaVerified && !showChangeEmail) {
        resetCaptcha();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Separate function for resending OTP without captcha requirement
  const handleResendOTP = async () => {
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsResendingOTP(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/request-otp`,
        {
          type: "email",
          email: email,
        }
      );

      if (!response.data) {
        toast.error("Failed to send verification code. Please try again.");
        return;
      }

      setOtpTimer(600); // Reset OTP timer to 10 minutes
      setResendTimer(30); // Set resend timer to 30 seconds
      
      toast.success("New verification code sent to your email!");
      
      // Clear existing OTP
      setOtp(["", "", "", "", "", ""]);
      
      // Focus on the first OTP input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      
      const errorMessage = 
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        (typeof err.response?.data === 'object' && 
         'error' in err.response.data && 
         typeof err.response.data.error === 'string' ? 
         err.response.data.error : null) ||
        "Failed to send verification code. Please try again.";
      
      toast.error(errorMessage);
      console.error("Resend OTP error:", err);
    } finally {
      setIsResendingOTP(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    // Don't allow changes if completed
    if (isCompleted) return;

    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOTP = [...otp];
      newOTP[index] = value;
      setOtp(newOTP);

      // Move to next input if value is entered
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

  // Handle Enter key press in email input
  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buttonRef.current?.click();
    }
  };

  // Get button text based on current state
  const getButtonText = () => {
    if (isCompleted) return "Continue to Next Step";
    if (isLoading) {
      return showOTP ? "Verifying..." : "Sending Code...";
    }
    return showOTP ? "Verify My Email" : "Get OTP";
  };

  // Determine if button should be disabled
  const isButtonDisabled = () => {
    if (isCompleted) return false;
    if (isLoading) return true;
    if (!showOTP || showChangeEmail) {
      // For change email, don't require captcha
      if (showChangeEmail) return !validateEmail(email);
      // Only check for captcha if not previously verified and not changing email
      if (!captchaVerified && !captchaToken) return true;
      return !validateEmail(email);
    }
    return !otp.every((digit) => digit !== "");
  };

  const shouldShowEmailInput = () => {
    return !showOTP || showChangeEmail || isCompleted;
  };

  const shouldShowCaptcha = () => {
    return (!showOTP || showChangeEmail) && !isCompleted && !captchaVerified && !showChangeEmail;
  };

  return (
    <div className="mx-auto -mt-28 sm:mt-0 pt-24">
      <FormHeading
        title={"Hi, Welcome to Sapphire!"}
        description={"Get started in just a few easy steps!"}
      />

      <div className="mb-6">
        <label className="block text-gray-700 mb-2">
          Email Address
          {showOTP && !showChangeEmail && !isCompleted && (
            <span className="text-sm ml-2">
              <button
                onClick={handleChangeEmail}
                className="text-blue-500 hover:text-blue-600 underline"
                type="button"
              >
                Change Email
              </button>
            </span>
          )}
        </label>
        {shouldShowEmailInput() && (
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="Enter your email address"
              className={`flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                isCompleted ? "bg-gray-50" : ""
              }`}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              onKeyDown={handleEmailKeyDown}
              disabled={isLoading || (showOTP && !showChangeEmail) || isCompleted}
            />
          </div>
        )}
        {!shouldShowEmailInput() && (
          <div className="text-gray-700 bg-gray-50 px-3 py-2 rounded border">
            {email}
          </div>
        )}
      </div>

      {/* Google reCAPTCHA v2 - Only show for initial email verification, not for change email */}
      {shouldShowCaptcha() && (
        <div className="mb-6">
            <div className="flex flex-col items-start">
            <CustomReCAPTCHA
              key={captchaKey}
              ref={recaptchaRef}
              sitekey={process.env.NEXT_PUBLIC_SITEKEY || ""}
              onChange={handleCaptchaChange}
              onExpired={handleCaptchaExpired}
              onError={handleCaptchaError}
              theme="light"
              size="normal"
              onReset={() => setCaptchaToken(null)}
            />
            </div>
        </div>
      )}

      {showOTP && (
        <div className="mb-6">
          <label className="block text-left text-gray-heading mb-3">
            Enter OTP
            {isCompleted && (
              <span className="text-sm ml-2">✓ Verified</span>
            )}
          </label>
          <div className="flex justify-center gap-2 mb-4">
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
                className={`w-12 h-12 text-center border-2 text-xl
                  ${isCompleted 
                    ? "border-gray-300 focus:outline-none focus:border-teal-500" 
                    : "border-gray-300 focus:outline-none focus:border-teal-500"
                  }
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
            <div className="flex w-full justify-end text-sm mb-2">
              <button
                className="text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleResendOTP}
                disabled={isResendingOTP || resendTimer > 0}
              >
                {isResendingOTP
                  ? "Sending..."
                  : resendTimer > 0
                  ? `Resend Code (${resendTimer}s)`
                  : "Resend Code"}
              </button>
            </div>
          )}
        </div>
      )}

      <Button
        ref={buttonRef}
        onClick={handleButtonClick}
        disabled={isButtonDisabled()}
        className={`w-full py-6 mb-6 ${
          isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
        } ${isCompleted ? "" : ""}`}
        variant="ghost"
      >
        {getButtonText()}
      </Button>

      <div className="hidden lg:block text-center text-xs text-gray-600 mt-8 space-y-3">
        <p>
          I authorise Sapphire to fetch my KYC information from the C-KYC
          registry with my PAN.
        </p>
        <p>
          If you are looking to open a HUF, Corporate, Partnership, or NRI
          account, you have to{" "}
          <span className="text-blue-400">click here.</span>
        </p>
      </div>
    </div>
  );
};

export default EmailVerification;