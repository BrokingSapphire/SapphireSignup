import React, { useState } from "react";

const CardVerification = ({ onNext }: { onNext: () => void }) => {
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [errors, setErrors] = useState({
    card: false,
    name: false,
    expiry: false,
    cvv: false,
  });

  const validateCard = () => {
    const isCardValid = cardNumber.length === 16;
    const isNameValid = cardName.trim().length > 0;
    const isExpiryValid = expiryMonth !== "" && expiryYear !== "";
    const isCvvValid = cvv.length === 3;

    setErrors({
      card: cardNumber.length > 0 && !isCardValid,
      name: cardName.length > 0 && !isNameValid,
      expiry:
        (expiryMonth.length > 0 || expiryYear.length > 0) && !isExpiryValid,
      cvv: cvv.length > 0 && !isCvvValid,
    });

    return isCardValid && isNameValid && isExpiryValid && isCvvValid;
  };

  const handleSubmit = () => {
    if (validateCard()) {
      onNext();
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <div className=" mx-auto">
      <h2 className="text-3xl font-bold mb-2">Payment Details</h2>
      <p className="text-gray-600 mb-8">
        Enter your card information to complete the process
      </p>

      <div className="mb-6">
        <label className="block text-gray-700 mb-2">Card Number</label>
        <input
          type="text"
          placeholder="1234 5678 9012 3456"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ""))}
          maxLength={16}
        />
        {errors.card && (
          <p className="text-red-500 text-sm mt-1">
            Please enter a valid card number
          </p>
        )}
      </div>

      <div className="mb-6">
        <label className="block text-gray-700 mb-2">Name on Card</label>
        <input
          type="text"
          placeholder="Enter cardholder name"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">
            Please enter the cardholder name
          </p>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-gray-700 mb-2">Expiry Date</label>
          <div className="flex gap-2">
            <select
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={expiryMonth}
              onChange={(e) => setExpiryMonth(e.target.value)}
            >
              <option value="">MM</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={(i + 1).toString().padStart(2, "0")}>
                  {(i + 1).toString().padStart(2, "0")}
                </option>
              ))}
            </select>
            <select
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={expiryYear}
              onChange={(e) => setExpiryYear(e.target.value)}
            >
              <option value="">YY</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {errors.expiry && (
            <p className="text-red-500 text-sm mt-1">
              Please select expiry date
            </p>
          )}
        </div>

        <div className="w-1/3">
          <label className="block text-gray-700 mb-2">CVV</label>
          <input
            type="password"
            placeholder="123"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
            maxLength={3}
          />
          {errors.cvv && (
            <p className="text-red-500 text-sm mt-1">Enter valid CVV</p>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className={`w-full bg-teal-800 text-white py-3 rounded font-medium hover:bg-teal-700 transition-colors ${
          !cardNumber || !cardName || !expiryMonth || !expiryYear || !cvv
            ? "opacity-50 cursor-not-allowed"
            : ""
        }`}
        disabled={
          !cardNumber || !cardName || !expiryMonth || !expiryYear || !cvv
        }
      >
        Continue
      </button>

      <div className="mt-6 text-sm text-gray-600">
        <p className="mb-4">
          Your payment information is encrypted and secure. We use
          industry-standard security measures to protect your data.
        </p>
      </div>
    </div>
  );
};

export default CardVerification;
