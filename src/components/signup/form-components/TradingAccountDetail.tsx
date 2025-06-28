import FormHeading from "@/components/forms/FormHeading";
import React, { useState } from "react";

interface TradingAccountDetailsProps {
  onNext: () => void;
}

const TradingAccountDetails: React.FC<TradingAccountDetailsProps> = ({
  onNext,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    maritalStatus: "",
    fatherName: "",
    motherName: "",
    isValid: false,
  });

  const validateForm = (updatedData: Partial<typeof formData>) => {
    const currentData = { ...formData, ...updatedData };
    return {
      isValid:
        currentData.maritalStatus.length > 0 &&
        currentData.fatherName.length > 0 &&
        currentData.motherName.length > 0,
    };
  };

  const updateFormData = (data: Partial<typeof formData>): void => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updates = {
      [name]: value,
    };

    updateFormData({
      ...updates,
      ...validateForm(updates),
    });
  };

  const handleMaritalStatusChange = (status: string) => {
    if (isSubmitting) return;

    const updates = { maritalStatus: status };
    updateFormData({
      ...updates,
      ...validateForm(updates),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onNext();
    } catch (error) {
      console.error("Error during submission:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <FormHeading
        title={"Trading Account Details"}
        description={"Set up your trading account in minutes."}
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block  text-md ">Marital Status</label>
          <div className="text-gray-700 flex gap-2">
            {["Single", "Married", "Divorced"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleMaritalStatusChange(status)}
                disabled={isSubmitting}
                className={`px-4 py-1 text-sm border rounded transition-colors
                  ${
                    formData.maritalStatus === status
                      ? "border-teal-600 bg-teal-50 "
                      : "border-gray-300 bg-white hover:border-gray-400"
                  }
                  ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-md">Father&apos;s Name</label>
          <input
            type="text"
            name="fatherName"
            value={formData.fatherName}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-600
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-md">Mother&apos;s Name</label>
          <input
            type="text"
            name="motherName"
            value={formData.motherName}
            onChange={handleInputChange}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-600
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          className={`w-full py-2 mt-4 text-white bg-teal-800 rounded transition-colors
            ${
              formData.isValid && !isSubmitting
                ? "hover:bg-teal-700"
                : "opacity-50 cursor-not-allowed"
            }`}
          disabled={!formData.isValid || isSubmitting}
        >
          {isSubmitting ? "Please wait..." : "Continue"}
        </button>
      </form>
    </div>
  );
};

export default TradingAccountDetails;
