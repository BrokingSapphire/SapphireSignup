import Image from "next/image";
import React, { useState } from "react";

// Define image paths
const IMAGES = {
  UPIBlack: "https://signup.sapphirebroking.com/UPIBlack.png",
  blackbank: "https://signup.sapphirebroking.com/blackbank.png",
  QRCode: "https://signup.sapphirebroking.com/QRCode.png" // Add QR code image path
} as const;

// Define types for the form data
interface FormData {
  linkingMethod?: "upi" | "bank";
  ifscCode?: string;
  micrCode?: string;
  accountNumber?: string;
  reAccountNumber?: string;
  isValid: boolean;
}

// Define props interface
interface LinkBankAccountProps {
  onNextStep: () => void;
}

// Define button props interface
interface MethodButtonProps {
  selected: boolean;
  onClick: () => void;
  imageSrc: string;
  imageAlt: string;
  title: string;
  subtitle?: string;
}

const MethodButton: React.FC<MethodButtonProps> = ({
  selected,
  onClick,
  imageSrc,
  imageAlt,
  title,
  subtitle
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-6 border rounded-lg flex flex-col items-center justify-center space-y-4 transition-colors ${
      selected
        ? "border-teal-800"
        : "border-gray-300 hover:border-teal-800"
    }`}
  >
    <Image src={imageSrc} alt={imageAlt} width={1000} height={1000} className="h-12 w-auto" />
    <div className={`${subtitle ? 'text-2xl' : 'text-sm'} font-bold`}>
      {title}
    </div>
    {subtitle && (
      <div className="text-sm font-bold text-gray-500">{subtitle}</div>
    )}
  </button>
);

const UPIView: React.FC<{
  onBack: () => void;
  onManualLink: () => void;
}> = ({ onBack, onManualLink }) => (
  <div className="space-y-6">
    <div className="flex items-center space-x-4">
      <button 
        onClick={onBack}
        className="text-teal-800 hover:text-teal-700"
      >
        ← Back
      </button>
      <h2 className="text-4xl font-bold">Link bank account</h2>
    </div>
    <p className="text-gray-600">Step 6 of 9</p>

    <div className="space-y-4">
      <p className="font-medium">Scan QR Code</p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
        <li>It will be detailed from your account and</li>
        <li>Auto verified by bank</li>
        <li>More using UPI APP to complete bank verification</li>
      </ul>
      
      <div className="flex justify-center py-4">
        <Image 
          src={IMAGES.QRCode} 
          alt="QR Code"
          width={200}
          height={200}
          className="border-2 border-gray-200 rounded-lg"
        />
      </div>

      <button
        onClick={onManualLink}
        className="text-blue-500 hover:text-blue-600 flex items-center"
      >
        Link manually →
      </button>
    </div>
  </div>
);

const BankDetailsForm: React.FC<{
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onBack: () => void;
  onNextStep: () => void;
}> = ({ formData, setFormData, onBack, onNextStep }) => {
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      // Validate form
      const isValid = Boolean(
        newData.ifscCode &&
        newData.accountNumber &&
        newData.reAccountNumber &&
        newData.accountNumber === newData.reAccountNumber
      );
      return { ...newData, isValid };
    });
  };

  return (
    <div className="space-y-6 ">
      <div className="flex items-center space-x-4">
        <button 
          onClick={onBack}
          className="text-teal-800 hover:text-teal-700"
        >
          ← Back
        </button>
        <h2 className="text-4xl font-bold">Link bank account</h2>
      </div>
      <p className="text-gray-600">Step 6 of 9</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            IFSC Code*
          </label>
          <input
            type="text"
            value={formData.ifscCode || ''}
            onChange={(e) => handleInputChange('ifscCode', e.target.value)}
            className="w-full p-2 border rounded focus:ring-teal-800 focus:border-teal-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            MICR Code*
          </label>
          <input
            type="text"
            value={formData.micrCode || ''}
            onChange={(e) => handleInputChange('micrCode', e.target.value)}
            className="w-full p-2 border rounded focus:ring-teal-800 focus:border-teal-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            A/C Number*
          </label>
          <input
            type="text"
            value={formData.accountNumber || ''}
            onChange={(e) => handleInputChange('accountNumber', e.target.value)}
            className="w-full p-2 border rounded focus:ring-teal-800 focus:border-teal-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Re-enter A/C Number*
          </label>
          <input
            type="text"
            value={formData.reAccountNumber || ''}
            onChange={(e) => handleInputChange('reAccountNumber', e.target.value)}
            className="w-full p-2 border rounded focus:ring-teal-800 focus:border-teal-800"
          />
        </div>
      </div>

      <div>
        <button
          onClick={onNextStep}
          disabled={!formData.isValid}
          className={`w-full py-3 rounded transition-colors ${
            formData.isValid
              ? "bg-teal-800 text-white hover:bg-teal-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

const LinkBankAccount: React.FC<LinkBankAccountProps> = ({ onNextStep }) => {
  const [formData, setFormData] = useState<FormData>({
    linkingMethod: undefined,
    isValid: false
  });

  const [showBankForm, setShowBankForm] = useState(false);
  const [showUPIView, setShowUPIView] = useState(false);

  const handleMethodSelect = (method: "upi" | "bank"): void => {
    setFormData({
      linkingMethod: method,
      isValid: true,
    });
    
    if (method === "bank") {
      setShowBankForm(true);
    } else if (method === "upi") {
      setShowUPIView(true);
    }
  };

  const handleBack = () => {
    setShowBankForm(false);
    setShowUPIView(false);
    setFormData({
      linkingMethod: undefined,
      isValid: false
    });
  };

  if (showUPIView) {
    return (
      <UPIView
        onBack={handleBack}
        onManualLink={() => {
          setShowUPIView(false);
          setShowBankForm(true);
        }}
      />
    );
  }

  if (showBankForm) {
    return (
      <BankDetailsForm
        formData={formData}
        setFormData={setFormData}
        onBack={handleBack}
        onNextStep={onNextStep}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-4xl font-bold">Link bank account</h2>
        <p className="text-gray-600">Step 6 of 9</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <MethodButton
          selected={formData.linkingMethod === "upi"}
          onClick={() => handleMethodSelect("upi")}
          imageSrc={IMAGES.UPIBlack}
          imageAlt="UPI"
          title="Link with UPI"
          subtitle="(Recommended)"
        />

        <MethodButton
          selected={formData.linkingMethod === "bank"}
          onClick={() => handleMethodSelect("bank")}
          imageSrc={IMAGES.blackbank}
          imageAlt="Bank"
          title="Enter bank details manually"
        />
      </div>
    </div>
  );
};

export default LinkBankAccount;