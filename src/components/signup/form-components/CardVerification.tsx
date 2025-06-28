import React, { useState } from "react";

interface CardVerificationProps {
  onNextStep: () => void;
}

const CardVerification: React.FC<CardVerificationProps> = ({ onNextStep }) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    cardNumber: "",
    cardName: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
    isValid: false,
    cardError: false,
  });

  const validateForm = (updatedData: Partial<typeof formData>) => {
    const currentData = { ...formData, ...updatedData };
    return {
      isValid:
        currentData.cardNumber.length === 16 &&
        currentData.cardName.trim().length > 0 &&
        currentData.expiryMonth !== "" &&
        currentData.expiryYear !== "" &&
        currentData.cvv.length === 3,
    };
  };

  const updateFormData = (data: Partial<typeof formData>): void => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    const updates = {
      cardNumber: value,
      cardError: value.length > 0 && value.length !== 16,
    };
    updateFormData({
      ...updates,
      ...validateForm(updates),
    });
  };

  const handleCardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const updates = { cardName: value };
    updateFormData({
      ...updates,
      ...validateForm(updates),
    });
  };

  const handleExpiryChange = (
    type: "month" | "year",
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const updates =
      type === "month"
        ? { expiryMonth: e.target.value }
        : { expiryYear: e.target.value };
    updateFormData({
      ...updates,
      ...validateForm(updates),
    });
  };

  const handleCVVChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    const updates = { cvv: value };
    updateFormData({
      ...updates,
      ...validateForm(updates),
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onNextStep();
    } catch (error) {
      console.error("Error during submission:", error);
      updateFormData({
        cardError: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <div className="max-w-2xl mx-auto mb-24 p-4">
      <div className="w-full">
        <h1 className="text-4xl font-bold mb-4">
          Get Started with a One-Time Fee
        </h1>
        <p className="text-gray-600 mb-8">
          Complete Your Card Details Today and Access Exclusive Features!
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2">Card Number</label>
              <input
                type="text"
                className="w-full border rounded-md px-4 py-2"
                placeholder="Enter your card number"
                value={formData.cardNumber}
                onChange={handleCardNumberChange}
                maxLength={16}
                onInput={(e: React.FormEvent<HTMLInputElement>) => {
                  e.currentTarget.value = e.currentTarget.value.replace(
                    /[^0-9]/g,
                    ""
                  );
                }}
                disabled={isSubmitting}
              />
              {formData.cardError && (
                <p className="text-red-500 mt-2">
                  Please enter a valid 16-digit card number.
                </p>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Name on Card</label>
              <input
                type="text"
                className="w-full border rounded-md px-4 py-2"
                placeholder="Enter cardholder name"
                value={formData.cardName}
                onChange={handleCardNameChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-gray-700 mb-2">
                  Expiry Month & Year
                </label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded-md px-4 py-2"
                    value={formData.expiryMonth}
                    onChange={(e) => handleExpiryChange("month", e)}
                    disabled={isSubmitting}
                  >
                    <option value="">Month</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = (i + 1).toString().padStart(2, "0");
                      return (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    className="flex-1 border rounded-md px-4 py-2"
                    value={formData.expiryYear}
                    onChange={(e) => handleExpiryChange("year", e)}
                    disabled={isSubmitting}
                  >
                    <option value="">Year</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-1/3">
                <label className="block text-gray-700 mb-2">Enter CVV</label>
                <input
                  type="password"
                  className="w-full border rounded-md px-4 py-2"
                  placeholder="CVV"
                  value={formData.cvv}
                  onChange={handleCVVChange}
                  maxLength={3}
                  onInput={(e: React.FormEvent<HTMLInputElement>) => {
                    e.currentTarget.value = e.currentTarget.value.replace(
                      /[^0-9]/g,
                      ""
                    );
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full bg-teal-800 text-white py-3 rounded-md hover:bg-teal-700 ${
                formData.isValid && !isSubmitting
                  ? ""
                  : "opacity-50 cursor-not-allowed"
              }`}
              disabled={!formData.isValid || isSubmitting}
            >
              {isSubmitting ? "Please wait..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardVerification;
