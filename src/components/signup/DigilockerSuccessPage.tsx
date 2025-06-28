'use client'
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const DigilockerSuccessPage: React.FC = () => {
  const [countdown, setCountdown] = useState(4);
  const [isPopup, setIsPopup] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Detect if this is a popup window
    const detectPopup = () => {
      try {
        return (
          window.opener && 
          !window.opener.closed && 
          window.opener !== window
        ) || window.name === 'digilocker';
      } catch {
        return false;
      }
    };

    const isInPopup = detectPopup();
    setIsPopup(isInPopup);
    console.log("Is popup window:", isInPopup);

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (isInPopup) {
            // Try to close popup
            attemptClose();
          } else {
            // Redirect to main signup page
            router.push('/digilocker-success');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const attemptClose = () => {
    try {
      // Notify parent window
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ 
          type: 'DIGILOCKER_COMPLETED',
          source: 'digilocker_success_page'
        }, '*');
      }

      // Multiple close attempts
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.log("First close attempt failed:", e);
          
          // Fallback: navigate to about:blank
          setTimeout(() => {
            try {
              window.location.href = 'about:blank';
            } catch (err) {
              console.log("Navigate to blank failed:", err);
              // Final fallback: just hide content
              document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h2>Please close this window</h2><p>You can safely close this tab/window now.</p></div>';
            }
          }, 500);
        }
      }, 100);

    } catch (error) {
      console.error("Error in attemptClose:", error);
    }
  };

  const handleManualClose = () => {
    if (isPopup) {
      attemptClose();
    } else {
      router.push('/signup');
    }
  };

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

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          DigiLocker Verification Completed!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your Aadhaar verification through DigiLocker has been completed successfully. 
          {isPopup 
            ? " This window will close automatically." 
            : " You will be redirected back to the signup process."
          }
        </p>

        {/* Countdown */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full text-blue-600 font-bold text-lg">
            {countdown}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {isPopup ? "Closing" : "Redirecting"} in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        {/* Manual Action Button */}
        <button
          onClick={handleManualClose}
          className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          {isPopup ? 'Close Window' : 'Continue to Signup'}
        </button>

        {/* Additional Info */}
        <p className="text-xs text-gray-400 mt-4">
          {isPopup 
            ? "You can now continue with your account setup in the main window."
            : "Your Aadhaar verification has been completed successfully."
          }
        </p>
      </div>
    </div>
  );
};

export default DigilockerSuccessPage;