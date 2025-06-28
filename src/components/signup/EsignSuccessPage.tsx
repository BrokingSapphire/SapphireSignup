'use client'
import React, { useEffect, useState } from 'react';
import Image from 'next/image';

const EsignSuccessPage: React.FC = () => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Close the popup window
         
          
          if (window.opener) {
            window.close();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup timer on component unmount
    return () => clearInterval(timer);
  }, []);

  // Handle manual close
  const handleClose = () => {
    if (window.opener) {
      window.close();
    }
     console.log("clicked");
  };

  // Determine if the window can be closed programmatically
  const canClose = typeof window !== 'undefined' && !!window.opener;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-green-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
        </div>

        {/* eSign Image */}
        <div className="flex justify-center mb-6">
          <Image 
            width={80} 
            height={64} 
            src='/signup/e-sign.png' 
            alt="eSign Completed" 
            className="max-w-full h-auto rotate-90" 
          />
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          eSign Completed Successfully!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your KYC documents have been digitally signed. This window will close automatically.
        </p>

        {/* Countdown */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full text-blue-600 font-bold text-lg">
            {countdown}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Closing in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        {/* Manual Close Button */}
        <button
          onClick={handleClose}
          className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          {canClose ? 'Close Window' : 'Close Tab/Window'}
        </button>

        {/* Additional Info */}
        <p className="text-xs text-gray-400 mt-4">
          {canClose 
            ? "You can now continue with your account setup in the main window."
            : "Please close this tab manually and continue in the main window."
          }
        </p>
      </div>
    </div>
  );
};

export default EsignSuccessPage;