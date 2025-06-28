import React, { useState } from "react";
import Image from "next/image";
import UPIPaymentForm from "./paymentOptions/UPIPaymentForm";
import NetbankingPaymentForm from "./paymentOptions/NetbankingPaymentForm";
import CardPaymentForm from "./paymentOptions/CardPaymentForm";
import { paymentOptions } from "@/constants/new-signup/constants";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";

const PaymentSelection = ({ onNext }: { onNext: () => void }) => {
  const [selectedPayment, setSelectedPayment] = useState("upi");
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const handlePaymentChange = (paymentId: string) => {
    setSelectedPayment(paymentId);
  };

  const handleProceed = () => {
    setShowPaymentForm(true);
  };

  const handleBack = () => {
    setShowPaymentForm(false);
  };

  const handlePaymentSuccess = () => {
    // After successful payment, continue with the onboarding flow
    onNext();
  };

  const renderPaymentForm = () => {
    switch (selectedPayment) {
      case "card":
        return (
          <CardPaymentForm
            onBack={handleBack}
            onSuccess={handlePaymentSuccess}
          />
        );
      case "upi":
        return (
          <UPIPaymentForm
            onBack={handleBack}
            onSuccess={handlePaymentSuccess}
          />
        );
      case "netbanking":
        return (
          <NetbankingPaymentForm
            onBack={handleBack}
            onSuccess={handlePaymentSuccess}
          />
        );
      default:
        return null;
    }
  };

  if (showPaymentForm) {
    return (
      <div className="w-full mx-auto">
        <FormHeading
          title={"Get Started with a One-Time Fee"}
          description={"Invest Smart. Pay Secure. Grow Confident."}
        />
        {renderPaymentForm()}
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      <h2 className="text-3xl font-lexend font-medium mb-3">
        Unlock Your Trading Potential - Get Started for{" "}
        <span className="text-orange-500"> Just ₹99/- only </span>
      </h2>

      <div className="mt-6">
        {/* <h2 className="text-gray-600 font-bold mb-2">
          Get Started with a One-Time Fee
        </h2> */}
        <p className="text-gray-600 mb-6">Choose Your Payment Option</p>
        

        <div className="space-y-3 w-full">
          {paymentOptions.map((option) => (
            <div
              key={option.id}
              className="flex items-center border rounded-lg p-4 cursor-pointer hover:border-blue-500"
              onClick={() => handlePaymentChange(option.id)}
            >
              <input
                type="radio"
                id={option.id}
                name="payment"
                checked={selectedPayment === option.id}
                onChange={() => handlePaymentChange(option.id)}
                className="h-4 w-4 text-blue-600 cursor-pointer"
              />
              <label
                htmlFor={option.id}
                className="ml-3 flex items-center justify-between w-full cursor-pointer"
              >
                <span>{option.label}</span>
                <div className="flex items-center gap-2">
                  {option.icon && (
                    <Image
                      src={option.icon}
                      alt={option.label}
                      className="h-6"
                      width={50}
                      height={50}
                    />
                  )}
                  {option.additionalIcons?.map((icon, index) => (
                    <Image
                      key={index}
                      src={icon}
                      alt="payment method"
                      className="h-6"
                      width={50}
                      height={50}
                    />
                  ))}
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleProceed} variant={"ghost"} className="mt-6 py-6">
        Proceed to pay
      </Button>
    </div>
  );
};

export default PaymentSelection;
