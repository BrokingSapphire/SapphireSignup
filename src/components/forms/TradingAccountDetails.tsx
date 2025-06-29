import React, { useState, useEffect } from "react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import Cookies from "js-cookie";

interface TradingAccountDetailsProps {
  onNext: () => void;
  initialData?: {
    father_spouse_name?: string;
    mother_name?: string;
    maiden_name?: string;
    [key: string]: unknown; // Allow extra fields if needed
  };
  isCompleted?: boolean;
}

interface TradingAccountFormData {
  fatherSpouseName: string;
  motherName: string;
  maidenName: string; // Optional field
}

interface FormErrors {
  fatherSpouseName: boolean;
  motherName: boolean;
}

const initialFormData: TradingAccountFormData = {
  fatherSpouseName: "",
  motherName: "",
  maidenName: "",
};

const initialErrors: FormErrors = {
  fatherSpouseName: false,
  motherName: false,
};

// Global flag to track if completion toast has been shown in this session
let hasShownGlobalCompletedToast = false;

const TradingAccountDetails: React.FC<TradingAccountDetailsProps> = ({
  onNext,
  initialData,
  isCompleted,
}) => {
  const [formData, setFormData] = useState<TradingAccountFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>(initialErrors);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<TradingAccountFormData>(initialFormData);

  // Helper function to format names properly (only used when needed)
  const formatName = (name: string): string => {
    if (!name) return '';
    
    return name
      .trim()
      .split(' ')
      .map(word => {
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .filter(word => word.length > 0) // Remove empty strings
      .join(' ');
  };

  // Prefill data from initialData (API response) and show completion toast
  useEffect(() => {
    if (isCompleted && initialData) {
      const prefilledData = {
        fatherSpouseName: formatName(initialData.father_spouse_name || ""),
        motherName: formatName(initialData.mother_name || ""),
        maidenName: formatName(initialData.maiden_name || ""),
      };
      
      setFormData(prefilledData);
      setOriginalData(prefilledData);
      
      // Show completion toast only once per session
      if (!hasShownGlobalCompletedToast) {
        hasShownGlobalCompletedToast = true;
      }
    }
  }, [initialData, isCompleted]);

  // Also try to prefill father's name from PAN data if available and not already completed
  useEffect(() => {
    const fetchPanData = async () => {
      if (isCompleted) return; // Don't fetch if already completed
      
      try {
        const token = Cookies.get('authToken');
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint/pan`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }
        );
        
        if (response.data?.data?.full_name) {
          // Extract father's name from PAN data (typically the middle name)
          const nameParts = response.data.data.full_name.split(' ');
          if (nameParts.length >= 3 && !formData.fatherSpouseName) {
            // Construct father's name from middle name + last name
            const fatherName = `${nameParts[1]} ${nameParts[nameParts.length - 1]}`;
            const formattedFatherName = formatName(fatherName);
            setFormData(prev => ({
              ...prev,
              fatherSpouseName: formattedFatherName
            }));
          }
        }
      } catch (error) {
        // Silently handle error - PAN data might not be available yet
        console.error(error);
      }
    };
    
    fetchPanData();
  }, [isCompleted, formData.fatherSpouseName]);

  // const validateForm = () => {
  //   const newErrors = {
  //     fatherSpouseName: !formData.fatherSpouseName.trim(),
  //     motherName: !formData.motherName.trim(),
  //   };

  //   setErrors(newErrors);
  //   return !Object.values(newErrors).some((error) => error);
  // };

  // FIXED: Allow normal typing without formatting on every keystroke
  const handleInputChange = (
    field: keyof TradingAccountFormData,
    value: string
  ) => {
    if (isSubmitting) return;

    // Don't format on every keystroke - just store the raw value
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: false,
    }));
    
    setError(null);
  };

  // NEW: Format name when user finishes typing (onBlur)
  const handleInputBlur = (
    field: keyof TradingAccountFormData,
    value: string
  ) => {
    if (isSubmitting) return;

    // Only format name fields
    if (field === 'fatherSpouseName' || field === 'motherName' || field === 'maidenName') {
      const formattedValue = formatName(value);
      setFormData((prev) => ({
        ...prev,
        [field]: formattedValue,
      }));
    }
  };

  // Check if there are changes that require API call
  const hasChanges = () => {
    if (!isCompleted) return true; // Not completed yet, so needs API call
    return (
      formData.fatherSpouseName !== originalData.fatherSpouseName ||
      formData.motherName !== originalData.motherName ||
      formData.maidenName !== originalData.maidenName
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    // Format all name fields before validation and submission
    const formattedData = {
      fatherSpouseName: formatName(formData.fatherSpouseName),
      motherName: formatName(formData.motherName),
      maidenName: formatName(formData.maidenName),
    };

    // Update form data with formatted values
    setFormData(formattedData);

    // If no changes and already completed, just proceed to next step
    if (!hasChanges() && isCompleted) {
      onNext();
      return;
    }

    // Validate with formatted data
    const newErrors = {
      fatherSpouseName: !formattedData.fatherSpouseName.trim(),
      motherName: !formattedData.motherName.trim(),
    };

    setErrors(newErrors);
    if (Object.values(newErrors).some((error) => error)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const token = Cookies.get('authToken');
    
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "user_detail",
          father_spouse_name: formattedData.fatherSpouseName.trim(),
          mother_name: formattedData.motherName.trim(),
          maiden_name: formattedData.maidenName.trim() || undefined,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.data) {
        setError("Failed to save parent details. Please try again.");
        return;
      }

      
      setTimeout(() => {
        onNext();
      }, 100);
      
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as import("axios").AxiosError).response === "object"
      ) {
        const axiosError = err as import("axios").AxiosError;
        const response = axiosError.response;
        if (response?.data && typeof response.data === "object" && "message" in response.data) {
          setError(`Error: ${(response.data as { message?: string }).message}`);
        } else if (response?.status === 400) {
          setError("Invalid details. Please check and try again.");
        } else if (response?.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else {
          setError("Failed to save details. Please try again.");
        }
      } else {
        setError("Failed to save details. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.fatherSpouseName.trim() && formData.motherName.trim();

  const getButtonText = () => {
    if (isSubmitting) return "Continue";
    return "Continue";
  };

  const isButtonDisabled = () => {
    if (isSubmitting) return true;
    return !isFormValid;
  };

  // Always show the same UI - whether fresh or completed
  return (
    <div className="mx-auto -mt-28 sm:mt-10">
      <FormHeading
        title={"Parent Details"}
        description={"Provide your parent/spouse information for KYC verification."}
      />

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block mb-2">
            Father&apos;s/Spouse Name<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Enter father's or spouse's full name"
            value={formData.fatherSpouseName}
            onChange={(e) => handleInputChange("fatherSpouseName", e.target.value)}
            onBlur={(e) => handleInputBlur("fatherSpouseName", e.target.value)}
            disabled={isSubmitting}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              isCompleted && formData.fatherSpouseName === originalData.fatherSpouseName 
                ? 'border-gray-300' 
                : 'border-gray-300'
            }`}
          />
          {errors.fatherSpouseName && (
            <p className="text-red-500 text-sm mt-1">
              Please enter father&apos;s or spouse&apos;s name
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block mb-2">
            Mother&apos;s Name<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Enter your mother's full name"
            value={formData.motherName}
            onChange={(e) => handleInputChange("motherName", e.target.value)}
            onBlur={(e) => handleInputBlur("motherName", e.target.value)}
            disabled={isSubmitting}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              isCompleted && formData.motherName === originalData.motherName 
                ? 'border-gray-300' 
                : 'border-gray-300'
            }`}
          />
          {errors.motherName && (
            <p className="text-red-500 text-sm mt-1">
              Please enter your mother&apos;s name
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <Button
          variant={"ghost"}
          type="submit"
          disabled={isButtonDisabled()}
          className={`w-full py-6 ${
            isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {getButtonText()}
        </Button>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="">
            This information is required for KYC verification and will be kept
            confidential in accordance with our privacy policy.
          </p>
        </div>
      </form>
    </div>
  );
};

export default TradingAccountDetails;