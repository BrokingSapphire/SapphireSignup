import React, { useState, useRef, useEffect, useCallback } from "react";
import FormHeading from "./FormHeading";
import SignatureQrCode from "./SignatureQrCode";
import axios, { AxiosError } from "axios";
import Cookies from 'js-cookie';
import { useCheckpoint, CheckpointStep } from '@/hooks/useCheckpoint';
import { toast } from "sonner";
import { Button } from "../ui/button";

interface SignatureComponentProps {
  onNext: () => void;
  initialData?: {
    [key: string]: unknown;
  };
  isCompleted?: boolean;
}

interface ApiErrorResponse {
  data?: {
    message?: string;
  };
  message?: string;
}

// Global flag to track if completion toast has been shown in this session
let hasShownGlobalCompletedToast = false;

const SignatureComponent: React.FC<SignatureComponentProps> = ({ 
  onNext
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [signatureUid, setSignatureUid] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wantsToResign, setWantsToResign] = useState(false);
  const [isInitializingForQr, setIsInitializingForQr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Use the checkpoint hook to check for existing signature data
  const { 
    isStepCompleted,
    refetchStep 
  } = useCheckpoint();

  // Add keyboard event listener for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isButtonDisabled()) {
        e.preventDefault();
        handleSubmit();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [signature, isLoading, signatureUid, wantsToResign]); // Dependencies for isButtonDisabled check

  const initializeSignature = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoading || signatureUid) {
      return;
    }

    setIsLoading(true);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        toast.error("Authentication token not found. Please restart the process.");
        return;
      }

      // Use the correct endpoint for signature initialization
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "signature"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.data?.data?.uid) {
        setSignatureUid(response.data.data.uid);
        setIsInitialized(true);
        
        // If we were initializing for QR code, show it now
        if (isInitializingForQr) {
          setShowQrCode(true);
          setIsInitializingForQr(false);
        }
      } else {
        toast.error("Failed to initialize signature session. Please try again.");
      }
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      console.error("Signature initialization error:", err);
      
      if (err.response) {
        if (err.response.data?.message) {
          toast.error(`Error: ${err.response.data.message}`);
        } else if (err.response.status === 400) {
          toast.error("Invalid request. Please try again.");
        } else if (err.response.status === 401) {
          toast.error("Authentication failed. Please restart the process.");
        } else if (err.response.status === 403) {
          toast.error("Access denied. Please check your authentication and try again.");
        } else {
          toast.error(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (err.request) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
      
      // Reset QR initialization state on error
      setIsInitializingForQr(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, signatureUid, isInitializingForQr]);

  // Check if signature is already completed and show toast
  useEffect(() => {
    const isSignatureCompleted = isStepCompleted(CheckpointStep.SIGNATURE);
    
    if (isSignatureCompleted && !wantsToResign) {
      // Signature is already completed and user doesn't want to re-sign
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Show completion toast only once per session
      if (!hasShownGlobalCompletedToast) {
        hasShownGlobalCompletedToast = true;
      }
      return;
    }

    // If not completed OR user wants to re-sign, initialize signature
    // But only if we haven't already initialized and we're not already loading
    if (((!isSignatureCompleted && !isInitialized) || wantsToResign) && !isLoading && !signatureUid) {
      initializeSignature();
    }
  }, [isStepCompleted, wantsToResign, isInitialized, isLoading, signatureUid, initializeSignature]);

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions with higher resolution for better quality
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    canvas.style.width = `${canvas.offsetWidth}px`;
    canvas.style.height = `${canvas.offsetHeight}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Scale context to handle the resolution difference
    context.scale(2, 2);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "black";
    context.lineWidth = 2;
    contextRef.current = context;
  }, []);

  useEffect(() => {
    if (isInitialized && signatureUid) {
      initializeCanvas();
      // Add resize listener to reinitialize canvas when window resizes
      const handleResize = () => {
        initializeCanvas();
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isInitialized, signatureUid, initializeCanvas]);

  // Additional effect to reinitialize canvas when returning from QR screen
  useEffect(() => {
    if (!showQrCode && isInitialized && signatureUid && canvasRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initializeCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showQrCode, isInitialized, signatureUid, initializeCanvas]);

  const startDrawing = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    setIsDrawing(true);
    const context = contextRef.current;
    if (!context) return;

    let clientX, clientY;

    if ("touches" in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      event.preventDefault(); // Prevent scrolling on touch
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const boundingRect = canvasRef.current?.getBoundingClientRect();
    if (!boundingRect) return;

    const x = clientX - boundingRect.left;
    const y = clientY - boundingRect.top;

    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const context = contextRef.current;
    if (!context) return;

    let clientX, clientY;

    if ("touches" in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
      event.preventDefault(); // Prevent scrolling on touch
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const boundingRect = canvasRef.current?.getBoundingClientRect();
    if (!boundingRect) return;

    const x = clientX - boundingRect.left;
    const y = clientY - boundingRect.top;

    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    contextRef.current?.closePath();

    if (canvasRef.current) {
      const signatureData = canvasRef.current.toDataURL();
      setSignature(signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const convertDataURLToFile = (dataURL: string, filename: string): File => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSubmit = async () => { 
    // Prevent multiple submissions
    if (isLoading) {
      return;
    }

    // If already completed and no new signature and not wanting to re-sign, just go to next step
    if (isStepCompleted(CheckpointStep.SIGNATURE) && !signature && !wantsToResign) {
      onNext();
      return;
    }

    if (!signature || !signatureUid) {
      return;
    }
    setIsLoading(true);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        toast.error("Authentication token not found. Please restart the process.");
        return;
      }

      // Convert canvas signature to file
      const signatureFile = convertDataURLToFile(signature, "signature.png");
      
      const formData = new FormData();
      formData.append('image', signatureFile);

      // Use the correct PUT endpoint for signature upload
      await axios.put(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/signature/${signatureUid}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${authToken}`
          }
        }
      );
      
      // Reset re-signing state immediately to prevent further submissions
      setWantsToResign(false);
      setIsLoading(false); // Set loading to false immediately
      
      // Refetch signature step to update the hook
      refetchStep(CheckpointStep.SIGNATURE);

      // Auto-advance after a short delay
      setTimeout(() => {
        onNext();
      }, 100);
      
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      console.error("Signature upload error:", err);
      setIsLoading(false); // Make sure to reset loading state on error
      
      if (err.response) {
        if (err.response.data?.message) {
          toast.error(`Upload failed: ${err.response.data.message}`);
        } else if (err.response.status === 401) {
          toast.error("Session expired. Please try again.");
          // Re-initialize signature session
          setIsInitialized(false);
          setSignatureUid(null);
          clearSignature();
        } else if (err.response.status === 422) {
          toast.error("Invalid signature format. Please try again.");
        } else if (err.response.status === 403) {
          toast.error("Access denied. Please check your authentication and try again.");
        } else {
          toast.error(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (err.request) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleRetry = () => {
    setIsInitialized(false);
    setSignatureUid(null);
    clearSignature();
    setWantsToResign(true); // Set intent to re-sign
    // initializeSignature will be called by useEffect
  };

  const handleSignAgain = () => {
    
    // Clear all states first
    setSignature(null);
    setIsDrawing(false);
    
    // Clear canvas if it exists
    if (canvasRef.current && contextRef.current) {
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    // Reset initialization states
    setIsInitialized(false);
    setSignatureUid(null);
    
    // Set the intent to re-sign (this will trigger useEffect)
    setWantsToResign(true);
  };

  // Helper function to check if button should be disabled
  const isButtonDisabled = () => {
    return Boolean((!signature && !shouldShowCompletedState) || 
      isLoading || 
      (shouldShowCanvas && !signatureUid));
  };

  // Render QR code component if user clicks "Click Here"
  if (showQrCode && signatureUid) {
    return (
      <SignatureQrCode
        onBack={() => {
          setShowQrCode(false);
          // Force canvas reinitialization when returning from QR screen
          setTimeout(() => {
            initializeCanvas();
          }, 100);
        }}
        onComplete={onNext}
        signatureUid={signatureUid}
      />
    );
  }

  // Show initialization loading
  if (!isInitialized && isLoading) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16">
        <FormHeading
          title="Signature"
          description={isInitializingForQr ? "Setting up mobile signature session..." : "Initializing signature session..."}
        />
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">
            {isInitializingForQr ? "Preparing mobile signature..." : "Setting up signature pad..."}
          </span>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed (but don't show red error box)
  if (!isInitialized && !isLoading && !signatureUid && !isStepCompleted(CheckpointStep.SIGNATURE)) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16">
        <FormHeading
          title="Signature"
          description="Let's set up your signature session."
        />
        <div className="flex items-center justify-center h-40">
          <button
            onClick={handleRetry}
            className="px-8 py-6 rounded bg-teal-800 hover:bg-teal-900 text-white"
          >
            Initialize Signature
          </button>
        </div>
      </div>
    );
  }

  const getButtonText = () => {
    if (isLoading) return "Submitting...";
    if (isStepCompleted(CheckpointStep.SIGNATURE) && !signature && !wantsToResign) return "Continue";
    return "Submit";
  };

  const shouldShowCanvas = signatureUid && (wantsToResign || !isStepCompleted(CheckpointStep.SIGNATURE));
  const shouldShowCompletedState = isStepCompleted(CheckpointStep.SIGNATURE) && !wantsToResign;

  return (
    <div className="mx-auto -mt-28 sm:mt-16">
      <FormHeading
        title="Signature"
        description="Add your signature to complete the paperwork"
      />

      {/* Show loading message when initializing for re-signing */}
      {wantsToResign && !signatureUid && isLoading && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-700 text-sm">
              {isInitializingForQr ? "Preparing mobile signature session..." : "Initializing new signature session..."}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="border-2 border-dashed h-[300px] border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center overflow-hidden">
          {shouldShowCompletedState ? (
            // Show completed state with option to sign again
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-600 font-medium">Signature Already Submitted</p>
              <p className="text-gray-600 text-sm">Click below to sign again if needed</p>
              <Button
              variant={"ghost"}
                onClick={handleSignAgain}
                className="px-6 py-3 "
              >
                Sign Again
              </Button>
            </div>
          ) : (
            // Show canvas for signing
            <canvas
              ref={canvasRef}
              className={`w-full h-full bg-white rounded-md touch-none ${
                !shouldShowCanvas ? "opacity-50 cursor-not-allowed" : "cursor-crosshair"
              }`}
              onMouseDown={shouldShowCanvas ? startDrawing : undefined}
              onMouseMove={shouldShowCanvas ? draw : undefined}
              onMouseUp={shouldShowCanvas ? stopDrawing : undefined}
              onMouseLeave={shouldShowCanvas ? stopDrawing : undefined}
              onTouchStart={shouldShowCanvas ? startDrawing : undefined}
              onTouchMove={shouldShowCanvas ? draw : undefined}
              onTouchEnd={shouldShowCanvas ? stopDrawing : undefined}
            />
          )}
        </div>


          {/* disable Late on */}
        {/* QR Code option */}
        {/* <div className="text-center mt-4">
          <button
            onClick={handleQrCodeClick}
            className="hidden lg:block text-sm decoration-dotted underline"
            disabled={isLoading && !isInitializingForQr}
          >
            Facing issues with your signature? Click here and use your mobile device to complete the Signature.
          </button>
        </div> */}

        <div className="flex flex-col gap-y-2 mt-4">
          {/* Only show clear button when canvas is active */}
          {shouldShowCanvas && (
            <button
              onClick={clearSignature}
              disabled={isLoading}
              className={`px-8 py-3 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Clear
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={isButtonDisabled()}
            className={`px-8 py-3 rounded bg-teal-800 hover:bg-teal-900 text-white ${
              isButtonDisabled() 
                ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {getButtonText()}
          </button>
        </div>
      </div>
      <div className="hidden lg:block text-center text-sm text-gray-600 mt-4">
        <p>
          Please sign clearly within the box above. Your signature will be used for document verification.
          Session expires in 10 minutes. <strong>Press Enter to submit when ready.</strong>
        </p>
      </div>
    </div>
  );
};

export default SignatureComponent;