import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface Bank {
  id: string;
  name: string;
  logo: string;
}

const NetbankingPaymentForm = ({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) => {
  const [selectedBank, setSelectedBank] = useState("");

  const banks: Bank[] = [
    {
      id: "axis",
      name: "Axis Bank",
      logo: "/new-signup/netbanking/axis-bank.svg",
    },
    {
      id: "hdfc",
      name: "HDFC Bank",
      logo: "/new-signup/netbanking/hdfc-bank.svg",
    },
    {
      id: "icici",
      name: "ICICI Bank",
      logo: "/new-signup/netbanking/icici-bank.svg",
    },
    {
      id: "sbi",
      name: "State Bank of India",
      logo: "/new-signup/netbanking/sbi-bank.svg",
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBank) {
      onSuccess();
    }
  };

  return (
    <div className="w-full mx-auto">
      <button
        onClick={onBack}
        className="flex items-center text-blue-500 mb-6 hover:text-blue-600"
      >
        <span className="mr-2">←</span> Go back
      </button>

      <div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2">
            {banks.map((bank) => (
              <label
                key={bank.id}
                className={`flex items-center p-4 rounded-md cursor-pointer ${
                  selectedBank === bank.id ? "bg-teal-50" : "bg-gray-50"
                } hover:bg-teal-50 transition-colors`}
              >
                <input
                  type="radio"
                  name="bank"
                  value={bank.id}
                  checked={selectedBank === bank.id}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <div className="flex items-center ml-3">
                  <Image
                    src={bank.logo}
                    alt={bank.name}
                    width={24}
                    height={24}
                    className="mr-2"
                  />
                  <span className="font-medium">{bank.name}</span>
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            className="text-blue-500 hover:text-blue-600 mt-4 text-sm"
          >
            + View all banks
          </button>

          <Button
            type="submit"
            disabled={!selectedBank}
            className={`w-full mt-6 py-6 ${
              selectedBank
                ? ""
                : "cursor-not-allowed"
            }`}
            variant="ghost"
          >
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
};

export default NetbankingPaymentForm;
