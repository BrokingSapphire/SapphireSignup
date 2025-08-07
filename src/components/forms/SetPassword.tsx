import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import { Eye, EyeOff, Check, X } from "lucide-react";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
import { getApiEndpoint } from "@/lib/utils";

interface InitialData {
  client_id?: string;
  // Add other properties as needed based on API response
}

interface SetPasswordProps {
  onNext: () => void;
  initialData?: InitialData;
  isCompleted?: boolean;
}

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

const SetPassword: React.FC<SetPasswordProps> = ({ 
  onNext, 
  initialData, 
  isCompleted 
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [isFinalizingInBackground, setIsFinalizingInBackground] = useState(false);
  const [, setFinalizeError] = useState<string | null>(null);

  const [validation, setValidation] = useState<PasswordValidation>({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Enhanced keyboard event handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isFormValid() && !isLoading) {
      e.preventDefault();
      handlePasswordSubmit();
    }
  };

  // Global keyboard navigation handler
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (isLoading) return;

      switch (event.key) {
        case 'Enter':
          event.preventDefault();
          if (isFormValid() && !isLoading) {
            handlePasswordSubmit();
          }
          break;
        case 'Escape':
          event.preventDefault();
          setError(null);
          break;
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isLoading, password, confirmPassword, validation]);

  // Prefill data from initialData (API response) and localStorage
  useEffect(() => {
    // Check localStorage first
    const storedClientId = localStorage.getItem('clientId');
    if (storedClientId) {
      setClientId(storedClientId);
    }

    // Also check initialData
    if (isCompleted && initialData?.client_id) {
      setClientId(initialData.client_id);
      // Save to localStorage if not already there
      if (!storedClientId) {
        localStorage.setItem('clientId', initialData.client_id);
      }
    }
  }, [initialData, isCompleted]);

  // Try to finalize in background (non-blocking)
  useEffect(() => {
    if (!isCompleted && !clientId) {
      handleFinalizeInBackground();
    }
  }, [isCompleted, clientId]);

  // Validate password in real-time
  useEffect(() => {
    setValidation({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, [password]);

  const handleFinalizeInBackground = async () => {
    setIsFinalizingInBackground(true);
    setFinalizeError(null);

    try {
      const response = await axios.post(
        getApiEndpoint(`${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/finalize`),
        {},
        {
          headers:{
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      if (response.data?.data?.clientId) {
        const newClientId = response.data.data.clientId;
        setClientId(newClientId);
        // Save to localStorage
        localStorage.setItem('clientId', newClientId);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.warn(err.response?.data?.message || err.message);
        setFinalizeError(err.response?.data?.message || 'Finalize failed');
      } else if (err instanceof Error) {
        console.warn(err.message);
        setFinalizeError(err.message || 'Finalize failed');
      } else {
        console.warn('Finalize API failed (non-blocking): Unknown error');
        setFinalizeError('Finalize failed');
      }
      // Don't block the user, they can still set password
    } finally {
      setIsFinalizingInBackground(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!isFormValid()) {
      // Check specifically for password mismatch
      if (password !== confirmPassword) {
        toast.error("Passwords do not match. Please ensure both password fields are identical.");
        return;
      }
      return;
    }

    if (isCompleted && clientId) {
      onNext();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the setup-password API directly
      const response = await axios.post(
        getApiEndpoint(`${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/setup-password`),
        {
          password: password,
          confirm_password: confirmPassword
        },
        {
          headers:{
            Authorization: `Bearer ${Cookies.get('authToken')}`
          }
        }
      );

      // Check if response contains client_id and save to localStorage
      if (response.data?.data?.client_id) {
        const newClientId = response.data.data.client_id;
        setClientId(newClientId);
        localStorage.setItem('clientId', newClientId);
      }

      // Proceed to next step
      onNext();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Handle "Password already set" error specifically
          if (
            err.response.status === 400 &&
            (err.response.data?.message?.includes("Password already set") ||
              err.response.data?.error?.message?.includes("Password already set"))
          ) 
          {
            onNext();
            return;
          }

          if (err.response.data?.message) {
            setError(`Error: ${err.response.data.message}`);
          } else if (err.response.data?.error?.message) {
            setError(`Error: ${err.response.data.error.message}`);
          } else if (err.response.status === 400) {
            setError("Invalid password. Please check requirements and try again.");
          } else if (err.response.status === 401) {
            setError("Authentication failed. Please restart the process.");
          } else if (err.response.status === 403) {
            setError("Please complete the previous steps first.");
          } else if (err.response.status === 422) {
            setError("Password validation failed. Please check requirements.");
          } else {
            setError(`Server error (${err.response.status}). Please try again.`);
          }
        } else if (err.request) {
          setError("Network error. Please check your connection and try again.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    const allValidationsPassed = Object.values(validation).every(Boolean);
    const passwordsMatch = password === confirmPassword;
    return allValidationsPassed && passwordsMatch && password.length > 0;
  };

  const getButtonText = () => {
    if (isCompleted) return "Continue";
    return isLoading ? "Setting Password..." : "Set Password";
  };

  // Show completed state
  if (isCompleted && clientId) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16 max-w-md">
        <FormHeading
          title="Password Set Successfully!"
          description="Your account password has been configured."
        />

        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <h3 className="text-green-800 font-medium">Password Set Successfully!</h3>
              <p className="text-green-700 text-sm">Client ID: {clientId}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={onNext}
          variant="ghost"
          className="w-full py-6"
          onKeyDown={handleKeyDown}
        >
          Continue to MPIN Setup
        </Button>
      </div>
    );
  }

  // Show password setup form
  return (
    <div className="mx-auto -mt-10 sm:mt-16 max-w-md">
      <FormHeading
        title="Set Your Password"
        description="Create a secure password for your trading account."
      />

      {/* Background finalize status */}
      {isFinalizingInBackground && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-700 text-sm">Setting up your account...</p>
          </div>
        </div>
      )}


      <div className="space-y-4">
        {/* Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              onCopy={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 px-3 flex items-center"
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Confirm Password Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              onCopy={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
              placeholder="Confirm your password"
              disabled={isLoading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 px-3 flex items-center"
              disabled={isLoading}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Password Requirements */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Password Requirements:
          </h4>
          <div className="space-y-2">
            {[
              { key: 'minLength', text: 'At least 8 characters' },
              { key: 'hasUppercase', text: 'One uppercase letter' },
              { key: 'hasLowercase', text: 'One lowercase letter' },
              { key: 'hasNumber', text: 'One number' },
              { key: 'hasSpecialChar', text: 'One special character' },
            ].map(({ key, text }) => (
              <div key={key} className="flex items-center">
                {validation[key as keyof PasswordValidation] ? (
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <X className="h-4 w-4 text-red-500 mr-2" />
                )}
                <span
                  className={`text-sm ${
                    validation[key as keyof PasswordValidation]
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>

        </div>

        {error && (
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <Button
          onClick={handlePasswordSubmit}
          disabled={!isFormValid() || isLoading}
          variant="ghost"
          className={`w-full py-6 ${
            (!isFormValid() || isLoading) ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {getButtonText()}
        </Button>
      </div>
    </div>
  );
};

export default SetPassword;