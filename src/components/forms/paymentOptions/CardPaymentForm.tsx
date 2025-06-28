import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const CardPaymentForm = ({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) => {
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  });
  const [showCvv, setShowCvv] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add your card payment logic here
    onSuccess();
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove all non-numeric characters and spaces
    const numbersOnly = value.replace(/\D/g, "");

    // Format the card number with spaces after every 4 digits
    let formattedValue = "";
    for (let i = 0; i < numbersOnly.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedValue += " ";
      }
      formattedValue += numbersOnly[i];
    }

    // Update state with formatted value
    setCardDetails({ ...cardDetails, cardNumber: formattedValue });
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    const numbersOnly = value.replace(/\D/g, "");
    setCardDetails({ ...cardDetails, cvv: numbersOnly });
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 10; i++) {
      years.push(currentYear + i);
    }
    return years;
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return month < 10 ? `0${month}` : `${month}`;
  });

  return (
    <div className="w-full mx-auto">
      <button
        onClick={onBack}
        className="flex items-center text-blue-500 mb-6 hover:text-blue-600"
      >
        <span className="mr-2">←</span> Go back
      </button>
      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="cardNumber" className="block text-gray-700 mb-2">
              Card Number
            </label>
            <input
              type="text"
              id="cardNumber"
              value={cardDetails.cardNumber}
              onChange={handleCardNumberChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
              maxLength={14}
              placeholder="Enter your card number"
            />
          </div>

          <div>
            <label htmlFor="cardName" className="block text-gray-700 mb-2">
              Name on Card
            </label>
            <input
              type="text"
              id="cardName"
              value={cardDetails.cardName}
              onChange={(e) =>
                setCardDetails({ ...cardDetails, cardName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="Enter name as on card"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-gray-700 mb-2">
                Expiry Month & Year
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={cardDetails.expiryMonth}
                    onChange={(e) =>
                      setCardDetails({
                        ...cardDetails,
                        expiryMonth: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none pr-8"
                  >
                    <option value="">Month</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                <div className="relative flex-1">
                  <select
                    value={cardDetails.expiryYear}
                    onChange={(e) =>
                      setCardDetails({
                        ...cardDetails,
                        expiryYear: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 appearance-none pr-8"
                  >
                    <option value="">Year</option>
                    {generateYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg
                      className="h-4 w-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-1/3">
              <label htmlFor="cvv" className="block text-gray-700 mb-2">
                Enter CVV
              </label>
              <div className="relative">
                <input
                  type={showCvv ? "text" : "password"}
                  id="cvv"
                  value={cardDetails.cvv}
                  onChange={handleCvvChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  maxLength={3}
                  placeholder="CVV"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 focus:outline-none"
                  onClick={() => setShowCvv(!showCvv)}
                >
                  {showCvv ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full mt-6 py-6" variant={"ghost"}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CardPaymentForm;
