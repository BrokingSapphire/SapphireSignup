import React, { useState, useRef, useEffect } from "react";
import { Camera } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import QrCodeVerification from "./QrCodeVerification";
import axios from "axios";
import Cookies from 'js-cookie';
import { useCheckpoint, CheckpointStep } from '@/hooks/useCheckpoint';
import { toast } from "sonner";

/* eslint-disable */
interface IPVInitialData {
  // Define the expected properties for initialData here
  // Example:
  // uid?: string;
  // status?: string;
}

interface IPVVerificationProps {
  onNext: () => void;
  initialData?: IPVInitialData;
  isCompleted?: boolean;
}

// Global flag to track if completion toast has been shown in this session
let hasShownGlobalCompletedToast = false;

const IPVVerification: React.FC<IPVVerificationProps> = ({ 
  onNext, 
}) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [ipvUid, setIpvUid] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraAutoStarted, setCameraAutoStarted] = useState(false);
  const [wantsToReverify, setWantsToReverify] = useState(false);
  
  // Face detection states
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [faceDetector, setFaceDetector] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use the checkpoint hook to check for existing IPV data
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

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [imageFile, isLoading, ipvUid, wantsToReverify]);

  // Load MediaPipe Face Detection
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        // Load MediaPipe from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/face_detection.js';
        script.onload = async () => {
          const { FaceDetection } = (window as any);
          
          if (FaceDetection) {
            const detector = new FaceDetection({
              model: 'short_range'
            });
            
            detector.setOptions({
              model: 'short_range',
              minDetectionConfidence: 0.5,
            });
            
            detector.onResults((results: any) => {
              const faceDetected = results.detections && results.detections.length > 0;
              setIsFaceDetected(faceDetected);
              
              // Draw face detection overlay
              if (overlayCanvasRef.current && videoRef.current) {
                const canvas = overlayCanvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  // Clear previous drawings
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  
                  if (results.detections && results.detections.length > 0) {
                    results.detections.forEach((detection: any) => {
                      const bbox = detection.boundingBox;
                      const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2;
                      const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2;
                      const width = bbox.width * canvas.width;
                      const height = bbox.height * canvas.height;
                      
                      // Draw green rectangle around detected face
                      ctx.strokeStyle = '#10B981';
                      ctx.lineWidth = 3;
                      ctx.strokeRect(x, y, width, height);
                      
                      // Draw confidence score
                      ctx.fillStyle = '#10B981';
                      ctx.font = '16px Arial';
                      ctx.fillText(
                        `Face: ${(detection.score * 100).toFixed(0)}%`,
                        x,
                        y - 10
                      );
                    });
                  }
                }
              }
            });
            
            setFaceDetector(detector);
            setIsMediaPipeLoaded(true);
            console.log('MediaPipe Face Detection loaded successfully');
          }
        };
        
        script.onerror = () => {
          console.error('Failed to load MediaPipe Face Detection');
          setIsMediaPipeLoaded(false);
        };
        
        document.head.appendChild(script);
        
        return () => {
          document.head.removeChild(script);
        };
      } catch (error) {
        console.error('Error loading MediaPipe:', error);
        setIsMediaPipeLoaded(false);
      }
    };

    loadMediaPipe();
  }, []);

  // Start face detection when camera is active
  useEffect(() => {
    if (showCamera && faceDetector && videoRef.current) {
      const startDetection = () => {
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }
        
        detectionIntervalRef.current = setInterval(() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            faceDetector.send({ image: videoRef.current });
          }
        }, 100); // Check every 100ms
      };

      // Wait for video to be ready
      const video = videoRef.current;
      if (video.readyState >= 2) {
        startDetection();
      } else {
        video.addEventListener('loadeddata', startDetection);
      }

      return () => {
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }
      };
    }
  }, [showCamera, faceDetector]);

  // Check if IPV is already completed and show toast
  useEffect(() => {
    console.log("useEffect triggered - isStepCompleted:", isStepCompleted(CheckpointStep.IPV), "wantsToReverify:", wantsToReverify, "isInitialized:", isInitialized, "isLoading:", isLoading);
    
    if (isStepCompleted(CheckpointStep.IPV) && !wantsToReverify) {
      // IPV is already completed and user doesn't want to re-verify
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Show completion toast only once per session
      if (!hasShownGlobalCompletedToast) {
        hasShownGlobalCompletedToast = true;
      }
      return;
    }

    // If not completed OR user wants to re-verify, initialize IPV
    // But only if we haven't already initialized and we're not already loading
    if (((!isStepCompleted(CheckpointStep.IPV) && !isInitialized) || wantsToReverify) && !isLoading && !ipvUid) {
      console.log("Calling initializeIPV from useEffect");
      initializeIPV();
    }
  }, [isStepCompleted(CheckpointStep.IPV), wantsToReverify]);

  // Auto-start camera after initialization is complete
  useEffect(() => {
    if (isInitialized && ipvUid && !cameraAutoStarted && (wantsToReverify || !isStepCompleted(CheckpointStep.IPV))) {
      // Small delay to ensure everything is ready
      setTimeout(() => {
        startCamera();
        setCameraAutoStarted(true);
      }, 500);
    }
  }, [isInitialized, ipvUid, cameraAutoStarted, wantsToReverify, isStepCompleted]);

  const initializeIPV = async () => {
    console.log("initializeIPV called - isLoading:", isLoading, "ipvUid:", ipvUid);
    
    // Prevent multiple simultaneous calls
    if (isLoading || ipvUid) {
      console.log("Already initializing or UID exists, skipping...");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        return;
      }

      console.log("Making API call to initialize IPV session...");

      // Use the correct endpoint for IPV initialization
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/checkpoint`,
        {
          step: "ipv"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (response.data?.data?.uid) {
        console.log("IPV session initialized with UID:", response.data.data.uid);
        setIpvUid(response.data.data.uid);
        setIsInitialized(true);
      } else {
        setError("Failed to initialize IPV. Please try again.");
      }
    } catch (err: any) {
      console.error("IPV initialization error:", err);
      if (err.response) {
        if (err.response.data?.message) {
          setError(`Error: ${err.response.data.message}`);
        } else if (err.response.status === 400) {
          setError("Invalid request. Please try again.");
        } else if (err.response.status === 401) {
          setError("Authentication failed. Please restart the process.");
        } else if (err.response.status === 403) {
          setError("Access denied. Please check your authentication and try again.");
        } else {
          setError(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (err.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setShowCamera(true);
      setError(null);
      setIsFaceDetected(false);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera access failed. Please enable permissions.");
    }
  };

  const capturePhoto = () => {
    // Check if face is detected before allowing capture
    if (!isFaceDetected) {
      toast.error("Face not recognized! Please position your face clearly in front of the camera.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Flip the image back to normal orientation when capturing
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], "ipv-verification.jpg", {
              type: "image/jpeg",
            });
            setImageFile(capturedFile);
            setShowCamera(false);
            toast.success("Face detected and photo captured successfully!");

            // Stop all video tracks when photo is captured
            const stream = video.srcObject as MediaStream;
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
            }
          }
        }, "image/jpeg", 0.8);
      }
    }
  };

  const isButtonDisabled = () => {
    return Boolean((!imageFile && !shouldShowCompletedState) || 
      isLoading || 
      (shouldShowCamera && !ipvUid));
  };

  const handleSubmit = async () => {
    console.log("handleSubmit called - isLoading:", isLoading, "imageFile:", !!imageFile, "ipvUid:", !!ipvUid);
    
    // Prevent multiple submissions
    if (isLoading) {
      console.log("Already submitting, please wait...");
      return;
    }

    // If already completed and no new image and not wanting to re-verify, just go to next step
    if (isStepCompleted(CheckpointStep.IPV) && !imageFile && !wantsToReverify) {
      console.log("Step completed, no new image, proceeding to next step");
      onNext();
      return;
    }

    if (!imageFile || !ipvUid) {
      console.log("Missing image or UID, cannot submit");
      return;
    }

    console.log("Starting IPV submission...");
    setIsLoading(true);
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        return;
      }

      const formData = new FormData();
      formData.append('image', imageFile);

      console.log("Uploading IPV with UID:", ipvUid);

      // Use the correct PUT endpoint for IPV upload
      await axios.put(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/ipv/${ipvUid}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      console.log("IPV uploaded successfully");
      
      // Reset re-verification state immediately to prevent further submissions
      setWantsToReverify(false);
      setIsLoading(false); // Set loading to false immediately
      
      // Refetch IPV step to update the hook
      refetchStep(CheckpointStep.IPV);

      // Auto-advance after 100ms
      setTimeout(() => {
        onNext();
      }, 100);
      
    } catch (err: any) {
      console.error("IPV upload error:", err);
      setIsLoading(false); // Make sure to reset loading state on error
      
      if (err.response) {
        if (err.response.data?.message) {
          setError(`Upload failed: ${err.response.data.message}`);
        } else if (err.response.status === 401) {
          setError("Upload session expired. Please try again.");
          // Re-initialize IPV
          setIsInitialized(false);
          setIpvUid(null);
          setCameraAutoStarted(false);
        } else if (err.response.status === 422) {
          setError("Invalid image format. Please try again.");
        } else if (err.response.status === 403) {
          setError("Access denied. Please check your authentication and try again.");
        } else {
          setError(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (err.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleRetry = () => {
    setImageFile(null);
    setError(null);
    setIsInitialized(false);
    setIpvUid(null);
    setCameraAutoStarted(false);
    setWantsToReverify(true); // Set intent to re-verify
  };

  const handleVerifyAgain = () => {
    console.log("User wants to verify again");
    
    // Clear all states first
    setImageFile(null);
    setError(null);
    setShowCamera(false);
    setCameraAutoStarted(false);
    setIsFaceDetected(false);
    
    // Stop camera if running
    stopCamera();
    
    // Reset initialization states
    setIsInitialized(false);
    setIpvUid(null);
    
    // Set the intent to re-verify (this will trigger useEffect)
    setWantsToReverify(true);
  };

  // Initialize camera when showCamera becomes true
  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      if (showCamera && videoRef.current && overlayCanvasRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            
            // Setup overlay canvas to match video dimensions
            videoRef.current.addEventListener('loadedmetadata', () => {
              if (overlayCanvasRef.current && videoRef.current) {
                overlayCanvasRef.current.width = videoRef.current.videoWidth;
                overlayCanvasRef.current.height = videoRef.current.videoHeight;
              }
            });
          }
        } catch (err) {
          console.error("Camera access error:", err);
          setError("Camera access failed. Please enable permissions or use the mobile camera option.");
          setShowCamera(false);
        }
      }
    };

    if (showCamera) {
      setupCamera();
    }

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  const stopCamera = () => {
    setShowCamera(false);
    setIsFaceDetected(false);
    
    // Stop face detection
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    // Stop camera stream
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const shouldShowCamera = ipvUid && (wantsToReverify || !isStepCompleted(CheckpointStep.IPV));
  const shouldShowCompletedState = isStepCompleted(CheckpointStep.IPV) && !wantsToReverify;

  // Always show the same UI - whether fresh or completed
  if (showQrCode && ipvUid) {
    return (
      <QrCodeVerification
        onBack={() => setShowQrCode(false)}
        onComplete={onNext}
        ipvUid={ipvUid}
      />
    );
  }

  // Show initialization loading
  if (!isInitialized && isLoading) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16">
        <FormHeading
          title="Video Verification (IPV)"
          description="Initializing verification session..."
        />
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <span className="ml-3 text-gray-600">Setting up verification...</span>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (!isInitialized && error) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16">
        <FormHeading
          title="Video Verification (IPV)"
          description="Failed to initialize verification session."
        />
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
        <Button
          onClick={handleRetry}
          variant="ghost"
          className="w-full py-6"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const getButtonText = () => {
    if (isLoading) return "Uploading...";
    if (isStepCompleted(CheckpointStep.IPV) && !imageFile && !wantsToReverify) return "Continue";
    return "Continue";
  };

  return (
    <div className="mx-auto -mt-28 sm:mt-16">
      <FormHeading
        title="Video Verification (IPV)"
        description="A quick face-to-face verification for security."
      />

      {/* MediaPipe Loading Status */}
      {!isMediaPipeLoaded && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-700 text-sm">Loading face detection...</p>
          </div>
        </div>
      )}

      {/* Face Detection Status */}
      {showCamera && isMediaPipeLoaded && (
        <div className={`mb-4 p-3 rounded border ${
          isFaceDetected 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              isFaceDetected ? 'bg-green-500' : 'bg-yellow-500'
            }`}></div>
            <p className={`text-sm ${
              isFaceDetected ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {isFaceDetected ? '✓ Face detected - Ready to capture!' : 'Position your face clearly in the camera'}
            </p>
          </div>
        </div>
      )}

      {/* Show loading message when initializing for re-verification */}
      {wantsToReverify && !ipvUid && isLoading && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-700 text-sm">Initializing new verification session...</p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="border-2 border-dashed h-[300px] border-gray-300 rounded-lg flex flex-col items-center justify-center overflow-hidden relative">
          {shouldShowCompletedState ? (
            // Show completed state with option to verify again
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-600 font-medium">IPV Verification Completed</p>
              <p className="text-gray-600 text-sm">Click below to verify again if needed</p>
              <Button
                onClick={handleVerifyAgain}
                variant="ghost"
                className="py-3"
              >
                Verify Again
              </Button>
            </div>
          ) : showCamera ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded transform scale-x-[-1]"
              />
              {/* Face detection overlay */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none transform scale-x-[-1]"
                style={{ mixBlendMode: 'normal' }}
              />
            </>
          ) : imageFile ? (
            <div className="space-y-4 w-full flex flex-col items-center">
              <div className="relative w-full h-[250px]">
                <Image
                  src={URL.createObjectURL(imageFile)}
                  alt="IPV Preview"
                  className="object-cover rounded"
                  fill
                  priority
                />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Camera className="w-16 h-16 mx-auto text-gray-400" />
              <p className="text-gray-600">Camera will open automatically</p>
              {!cameraAutoStarted && shouldShowCamera && (
                <div className="flex justify-center">
                </div>
              )}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {showCamera && (
          <div className="flex justify-center mt-4 gap-4">
            <Button 
              onClick={capturePhoto} 
              variant="ghost" 
              className={`py-2 ${
                !isFaceDetected ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={!isFaceDetected}
            >
              {isFaceDetected ? 'Capture Photo' : 'Face Not Detected'}
            </Button>
            <Button onClick={stopCamera} variant="outline" className="py-2">
              Cancel
            </Button>
          </div>
        )}

        {imageFile && shouldShowCamera && (
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => {
                setImageFile(null);
                setError(null);
                setIsFaceDetected(false);
                // Auto-restart camera
                setTimeout(() => startCamera(), 100);
              }}
              variant="outline"
              className="py-2"
            >
              Re-Capture
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-2 p-2 bg-red-50 rounded">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isButtonDisabled()}
        variant="ghost"
        className={`w-full py-6 ${
          isButtonDisabled() ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {getButtonText()}
      </Button>

      <div className="hidden lg:block text-center text-sm text-gray-600 mt-4">
        <p>
          Please ensure your face is clearly visible and well-lit for successful verification.
          Session expires in 10 minutes. <strong>Press Enter to submit when ready.</strong>
        </p>
      </div>
    </div>
  );
};

export default IPVVerification;