import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const UPIPaymentForm = ({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) => {
  const [upiId, setUpiId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add your UPI payment logic here
    onSuccess();
  };

  return (
    <div className="mx-auto w-full">
      <button
        onClick={onBack}
        className="flex items-center text-blue-500 mb-6 hover:text-blue-600"
      >
        <span className="mr-2">←</span> Go back
      </button>
      <div className="flex justify-between items-start gap-8">
        {/* Left section - QR Code */}
        <div className="flex-1 border-r border-gray-heading">
          <h3 className="text-center font-medium ">Scan and pay</h3>
          <Image
            src="/new-signup/upi/qr.svg" // Add your QR code image
            alt="QR Code"
            width={100}
            height={100}
            className="w-1/2 h-1/2 mx-auto my-6"
          />

          <p className="text-center text-sm">
            Scan and pay using
            <br />
            banking app
          </p>
        </div>

        {/* Right section - UPI ID input */}
        <div className="flex-1">
          <h3 className="font-medium mb-4">Enter UPI ID</h3>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="mobileNumber@upi"
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <Button className="w-full py-4" variant="ghost">
              {" "}
              Verify and pay
            </Button>
          </form>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-500">Enter your registered VPA</p>
            <p className="text-sm text-gray-500">
              Receive payment request on bank app
            </p>
            <p className="text-sm text-gray-500">Authorize payment request</p>
          </div>
        </div>
      </div>

      {/* Payment apps */}
      <div className="mt-8">
        <div className="flex justify-center items-center gap-6">
          <Image
            src="/new-signup/upi/gpay.svg"
            alt="Google Pay"
            width={24}
            height={24}
          />
          <Image
            src="/new-signup/upi/phonepe.svg"
            alt="PhonePe"
            width={24}
            height={24}
          />
          <Image
            src="/new-signup/upi/paytm.svg"
            alt="Paytm"
            width={24}
            height={24}
          />
          <Image
            src="/new-signup/upi/bhim.svg"
            alt="BHIM"
            width={24}
            height={24}
          />
        </div>
      </div>
    </div>
  );
};

export default UPIPaymentForm;
