import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios from "axios";
import { toast } from "sonner";
import Cookies from "js-cookie";

// Define QRCode component interface
interface QRCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
}

// QR Code display component using the existing qrcode library
const QRCodeDisplay: React.FC<QRCodeProps> = ({ 
  value, 
  size = 200, 
  bgColor = '#FFFFFF', 
  fgColor = '#000000' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const generateQR = async () => {
      try {
        // Use the existing qrcode library that's already in your project
        const QRCode = await import('qrcode');
        
        const dataUrl = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor
          },
          errorCorrectionLevel: 'M'
        });
        
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
        
        // Fallback: Create a simple placeholder
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = size;
            canvas.height = size;
            
            // Draw a simple placeholder
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = fgColor;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('QR Code', size / 2, size / 2 - 10);
            ctx.fillText('Loading...', size / 2, size / 2 + 10);
            
            setQrDataUrl(canvas.toDataURL());
          }
        }
      }
    };

    if (value) {
      generateQR();
    }
  }, [value, size, bgColor, fgColor]);

  return (
    <div className="qr-code-container">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="QR Code"
          style={{ width: size, height: size }}
          className="qr-code-image"
        />
      ) : (
        <div 
          style={{ width: size, height: size }}
          className="qr-code-loading bg-gray-200 flex items-center justify-center rounded"
        >
          <span className="text-gray-500 text-sm">Generating...</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={size}
        height={size}
      />
    </div>
  );
};

interface SignatureQrCodeProps {
  onBack: () => void;
  onComplete: () => void;
  signatureUid: string;
}

const SignatureQrCode: React.FC<SignatureQrCodeProps> = ({
  onBack,
  onComplete,
  signatureUid
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [signatureCompleted, setSignatureCompleted] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'waiting' | 'checking' | 'completed' | 'failed'>('waiting');
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // QR code points to sapphirebroking.com with UUID as parameter
  const authToken = Cookies.get('authToken');
  const qrCodeUrl = `https://sapphirebroking.com/qr-signature?uid=${signatureUid}&authToken=${encodeURIComponent(authToken ?? '')}`;

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsPolling(false);
          setVerificationStatus('failed');
          setError("Session expired. Please try again.");
          toast.error("Session expired. Please try again.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Polling function
  const checkSignatureStatus = async () => {
    if (!isPolling || verificationStatus === 'completed') return;

    setVerificationStatus('checking');
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        setVerificationStatus('failed');
        setIsPolling(false);
        return;
      }

      // Use your existing getSignature endpoint
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/signature`,
        { 
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      // If we get a successful response with data, signature is completed
      if (response.status === 200 && response.data?.data?.url) {
        setSignatureCompleted(true);
        setVerificationStatus('completed');
        setIsPolling(false);
        toast.success("Signature completed successfully!");
        
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        
        // Auto-complete after a short delay
        setTimeout(() => {
          onComplete();
        }, 500);
      } else {
        setVerificationStatus('waiting');
      }
    } catch (err: unknown) {
      type AxiosErrorResponse = {
        status: number;
        data?: { message?: string };
      };
      type AxiosError = {
        response?: AxiosErrorResponse;
      };

      const isAxiosError = (error: unknown): error is AxiosError =>
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: unknown }).response === "object";

      if (isAxiosError(err) && err.response) {
        const response = err.response;
        if (response.status === 204) {
          // Signature not uploaded yet (NO_CONTENT from your backend)
          setVerificationStatus('waiting');
        } else if (response.data?.message) {
          const errorMessage = `Error: ${response.data.message}`;
          setError(errorMessage);
          setVerificationStatus('failed');
          setIsPolling(false);
          toast.error(errorMessage);
        } else if (response.status === 401) {
          const errorMessage = "Session expired. Please restart the process.";
          setError(errorMessage);
          setVerificationStatus('failed');
          setIsPolling(false);
          toast.error(errorMessage);
        } else {
          // For other errors, continue polling but show a warning
          console.warn(err);
          setVerificationStatus('waiting');
        }
      } else {
        // Unknown error shape
        console.warn(err);
        setVerificationStatus('waiting');
      }
    }
  };

  // Start polling when component mounts
  useEffect(() => {
    if (isPolling && signatureUid) {
      // Initial check
      checkSignatureStatus();
      
      // Set up polling interval (check every 3 seconds)
      pollingIntervalRef.current = setInterval(() => {
        checkSignatureStatus();
      }, 3000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isPolling, signatureUid]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full mx-auto flex flex-col items-start mt-16">
      <FormHeading
        title="Signature"
        description="Scan the QR code with your phone to sign digitally."
      />

      <div className="relative w-full mb-4">
        <div className="absolute right-2 -top-6 flex items-center text-gray-500 text-sm">
          <Clock className="h-4 w-4 mr-1" />
          <span>{formatTime(timeRemaining)}</span>
        </div>
        
        <div className="border-2 border-gray-300 rounded-lg p-4 flex justify-center items-center">
          <div className="w-64 h-64 flex items-center justify-center">
            {signatureUid ? (
              <QRCodeDisplay
                value={qrCodeUrl}
                size={200}
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            ) : (
              <div className="animate-pulse bg-gray-200 w-48 h-48 rounded flex items-center justify-center">
                <span className="text-gray-500">Loading...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center w-full mb-6">
        <p className="font-medium mb-2">
          Scan this QR code with your phone to continue!
        </p>
        <p className="text-sm text-gray-600 mb-4">
          The QR code will open a webpage where you can sign digitally
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-800 text-sm">
            <strong>Instructions:</strong>
          </p>
          <ol className="text-blue-700 text-sm mt-2 text-left space-y-1">
            <li>1. Scan the QR code with your phone camera</li>
            <li>2. Sign on the mobile signature pad</li>
            <li>3. Wait for automatic completion</li>
          </ol>
        </div>

        {/* Status indicator */}
        <div className="mb-4">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            verificationStatus === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
            verificationStatus === 'checking' ? 'bg-blue-100 text-blue-800' :
            verificationStatus === 'completed' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {verificationStatus === 'waiting' && '⏳ Waiting for signature...'}
            {verificationStatus === 'checking' && '🔍 Checking status...'}
            {verificationStatus === 'completed' && '✅ Signature completed!'}
            {verificationStatus === 'failed' && '❌ Signature failed'}
          </div>
        </div>
      </div>

      {error && (
        <div className="w-full mb-4 p-3 bg-red-50 rounded border border-red-200">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </div>
      )}

      <div className="w-full mt-4 flex justify-between items-center">
        <Button
          onClick={onBack}
          variant="link"
          className="flex items-center text-blue-500"
          disabled={signatureCompleted}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go Back
        </Button>
        
        {signatureCompleted && (
          <Button
            onClick={onComplete}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Continue
          </Button>
        )}
      </div>

      <style jsx>{`
        .qr-code-image {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          image-rendering: pixelated;
        }
      `}</style>
    </div>
  );
};

export default SignatureQrCode;