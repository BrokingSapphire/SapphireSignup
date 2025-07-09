'use client'
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Storage keys (same as in AadhaarVerification)
const DIGILOCKER_STORAGE_KEYS = {
  REDIRECT_FLOW: 'digilocker_redirect_flow',
  SESSION_URL: 'digilocker_session_url',
  POPUP_FAILED: 'digilocker_popup_failed',
  RETURN_FROM_REDIRECT: 'digilocker_return_from_redirect'
};

const DigilockerSuccessPage: React.FC = () => {
  const [countdown, setCountdown] = useState(5);
  const [, setIsPopup] = useState(false);
  const [, setIsRedirectFlow] = useState(false);
  const [flowType, setFlowType] = useState<'popup' | 'redirect' | 'unknown'>('unknown');
  const router = useRouter();

  useEffect(() => {
    // Detect the flow type and context
    const detectFlowType = () => {
      // Check if this was a redirect flow
      const wasRedirectFlow = localStorage.getItem(DIGILOCKER_STORAGE_KEYS.REDIRECT_FLOW) === 'true' ||
                             localStorage.getItem(DIGILOCKER_STORAGE_KEYS.POPUP_FAILED) === 'true';
      
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
      setIsRedirectFlow(wasRedirectFlow);
      
      if (isInPopup) {
        setFlowType('popup');
      } else if (wasRedirectFlow) {
        setFlowType('redirect');
      } else {
        setFlowType('unknown');
      }

      return { isInPopup, wasRedirectFlow };
    };

    const { isInPopup, wasRedirectFlow } = detectFlowType();

    // Handle different flow types
    if (isInPopup) {
      // Popup flow - notify parent and close
      console.log('DigiLocker success: Popup flow detected');
      
      // Start countdown for popup closure
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            attemptPopupClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
      
    } else if (wasRedirectFlow) {
      // Redirect flow - navigate back to signup
      console.log('DigiLocker success: Redirect flow detected');
      
      // Mark that we're returning from redirect
      localStorage.setItem(DIGILOCKER_STORAGE_KEYS.RETURN_FROM_REDIRECT, 'true');
      
      // Start countdown for redirect
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleRedirectReturn();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
      
    } else {
      // Unknown flow - could be direct navigation
      console.log('DigiLocker success: Unknown flow, treating as direct navigation');
      
      // Start countdown for fallback redirect
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            handleFallbackRedirect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [router]);

  const attemptPopupClose = () => {
    try {
      console.log('Attempting to close popup and notify parent');
      
      // Notify parent window first
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ 
          type: 'DIGILOCKER_COMPLETED',
          source: 'digilocker_success_page'
        }, '*');
        
        // Give parent a moment to process the message
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.error('Failed to close popup:', e);
            handlePopupCloseFallback();
          }
        }, 500);
      } else {
        // No parent window, try to close anyway
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.error('Failed to close popup (no parent):', e);
            handlePopupCloseFallback();
          }
        }, 100);
      }

    } catch (error) {
      console.error("Error in attemptPopupClose:", error);
      handlePopupCloseFallback();
    }
  };

  const handlePopupCloseFallback = () => {
    console.log('Popup close fallback - trying alternative methods');
    
    // Try multiple fallback methods
    setTimeout(() => {
      try {
        window.location.href = 'about:blank';
      } catch (err) {
        console.warn('about:blank fallback failed:', err);
        
        // Final fallback: just hide content and show close message
        setTimeout(() => {
          document.body.innerHTML = `
            <div style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
              <h2 style="color:#22c55e;">✓ DigiLocker Verification Completed!</h2>
              <p style="color:#666;margin:20px 0;">You can safely close this window now.</p>
              <p style="color:#999;font-size:14px;">Return to the main signup window to continue.</p>
            </div>
          `;
        }, 1000);
      }
    }, 500);
  };

  const handleRedirectReturn = () => {
    console.log('Handling redirect return to signup page');
    
    try {
    
      const signupUrl = window.location.origin + '/';
      
      window.location.href = signupUrl;
      
    } catch (error) {
      console.error('Error redirecting back to signup:', error);
      
      // Fallback: try different possible signup URLs
      const possibleUrls = [
        '/',
      ];
      
      // Try the first alternative
      if (possibleUrls.length > 0) {
        window.location.href = window.location.origin + possibleUrls[0];
      }
    }
  };

  const handleFallbackRedirect = () => {
    console.log('Handling fallback redirect (unknown flow)');
    
    // For unknown flows, redirect to main signup page
    try {
      const signupUrl = window.location.origin + '/';
      window.location.href = signupUrl;
    } catch (error) {
      console.error('Error in fallback redirect:', error);
      window.location.href = window.location.origin;
    }
  };

  const handleManualAction = () => {
    if (flowType === 'popup') {
      attemptPopupClose();
    } else if (flowType === 'redirect') {
      handleRedirectReturn();
    } else {
      handleFallbackRedirect();
    }
  };

  // Determine UI text based on flow type
  const getUIText = () => {
    switch (flowType) {
      case 'popup':
        return {
          title: 'DigiLocker Verification Completed!',
          description: 'Your Aadhaar verification through DigiLocker has been completed successfully. This window will close automatically.',
          countdownText: 'Closing',
          buttonText: 'Close Window',
          additionalInfo: 'You can now continue with your account setup in the main window.'
        };
      case 'redirect':
        return {
          title: 'DigiLocker Verification Completed!',
          description: 'Your Aadhaar verification through DigiLocker has been completed successfully. You will be redirected back to the signup process.',
          countdownText: 'Redirecting',
          buttonText: 'Continue to Signup',
          additionalInfo: 'Your verification has been completed successfully.'
        };
      default:
        return {
          title: 'DigiLocker Verification Completed!',
          description: 'Your Aadhaar verification through DigiLocker has been completed successfully.',
          countdownText: 'Redirecting',
          buttonText: 'Continue',
          additionalInfo: 'You will be redirected to continue the process.'
        };
    }
  };

  const uiText = getUIText();

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
          {uiText.title}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {uiText.description}
        </p>

        {/* Countdown */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full text-blue-600 font-bold text-lg">
            {countdown}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {uiText.countdownText} in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        {/* Manual Action Button */}
        <button
          onClick={handleManualAction}
          className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          {uiText.buttonText}
        </button>

        {/* Additional Info */}
        <p className="text-xs text-gray-400 mt-4">
          {uiText.additionalInfo}
        </p>
      </div>
    </div>
  );
};

export default DigilockerSuccessPage;