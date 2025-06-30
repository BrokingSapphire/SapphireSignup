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

// MediaPipe Types
interface MediaPipeResults {
  detections: Array<{
    boundingBox: {
      xCenter: number;
      yCenter: number;
      width: number;
      height: number;
    };
    score: number;
  }>;
}

interface MediaPipeFaceDetection {
  setOptions: (options: {
    model: string;
    minDetectionConfidence: number;
  }) => void;
  onResults: (callback: (results: MediaPipeResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => void;
  close: () => void;
}

interface MediaPipeWindow extends Window {
  FaceDetection?: new (config: { 
    locateFile?: (file: string) => string;
    model?: string;
  }) => MediaPipeFaceDetection;
}

declare const window: MediaPipeWindow;

interface IPVInitialData {
  uid?: string;
  status?: string;
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
  const [faceDetector, setFaceDetector] = useState<MediaPipeFaceDetection | null>(null);
  const [hasShownNoFaceToast, setHasShownNoFaceToast] = useState(false);
  const [isMonitoringFace, setIsMonitoringFace] = useState(false); // New state to track if we're actively monitoring
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const noFaceToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  }, [imageFile, isLoading, ipvUid, wantsToReverify, isFaceDetected]);

  // Load MediaPipe Face Detection
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        // Check if already loaded
        if (window.FaceDetection) {
          initializeFaceDetector();
          return;
        }
        
        const loadScript = (src: string): Promise<void> => {
          return new Promise((resolve, reject) => {
            // Check if script already exists
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
              resolve();
              return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
          });
        };

        // Load MediaPipe scripts in correct order
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js');
        
        // Small delay to ensure everything is loaded
        setTimeout(() => {
          if (window.FaceDetection) {
            initializeFaceDetector();
          } else {
            console.error('FaceDetection not available after script load');
            setIsMediaPipeLoaded(false);
          }
        }, 1000);
        
      } catch (error) {
        console.error('Error loading MediaPipe:', error);
        setIsMediaPipeLoaded(false);
      }
    };

    const initializeFaceDetector = () => {
      try {
        if (!window.FaceDetection) {
          console.error('FaceDetection constructor not available');
          return;
        }
        
        const detector = new window.FaceDetection({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
          }
        });
        
        // Set options with decreased accuracy (0.3) as requested
        detector.setOptions({
          model: 'short_range',
          minDetectionConfidence: 0.3, // Decreased from 0.6 to 0.3
        });
        
        detector.onResults((results: MediaPipeResults) => {
          const faceDetected = results.detections && results.detections.length > 0;
          setIsFaceDetected(faceDetected);
          
          // Show toast if no face detected after camera starts (only once per session)
          if (isMonitoringFace && !faceDetected && !hasShownNoFaceToast) {
            // Clear any existing timeout
            if (noFaceToastTimeoutRef.current) {
              clearTimeout(noFaceToastTimeoutRef.current);
            }
            
            // Set timeout to show toast after 3 seconds of no face detection
            noFaceToastTimeoutRef.current = setTimeout(() => {
              if (!isFaceDetected && isMonitoringFace) {
                toast.error("Face not recognized! Please position your face clearly in front of the camera.");
                setHasShownNoFaceToast(true);
              }
            }, 3000);
          }
          
          // Clear timeout if face is detected
          if (faceDetected && noFaceToastTimeoutRef.current) {
            clearTimeout(noFaceToastTimeoutRef.current);
            noFaceToastTimeoutRef.current = null;
          }
        });
        
        setFaceDetector(detector);
        setIsMediaPipeLoaded(true);
      } catch (error) {
        console.error('Error initializing face detector:', error);
        setIsMediaPipeLoaded(false);
      }
    };

    loadMediaPipe();

    // Cleanup function
    return () => {
      if (noFaceToastTimeoutRef.current) {
        clearTimeout(noFaceToastTimeoutRef.current);
      }
    };
  }, []);

  // Start face detection when camera is active
  useEffect(() => {
    if (showCamera && faceDetector && videoRef.current && isMediaPipeLoaded) {
      const startDetection = () => {
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }

        setIsMonitoringFace(true);
        detectionIntervalRef.current = setInterval(() => {
          if (videoRef.current && videoRef.current.readyState >= 2 && faceDetector && isMonitoringFace) {
            try {
              faceDetector.send({ image: videoRef.current });
            } catch (error) {
              console.error('Error sending frame to face detector:', error);
            }
          }
        }, 500);
      };

      // Wait for video to be ready
      const video = videoRef.current;
      if (video.readyState >= 2) {
        startDetection();
      } else {
        const handleLoadedData = () => {
          startDetection();
          video.removeEventListener('loadeddata', handleLoadedData);
        };
        video.addEventListener('loadeddata', handleLoadedData);
      }

      return () => {
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
        }
        setIsMonitoringFace(false);
      };
    }
  }, [showCamera, faceDetector, isMediaPipeLoaded, isMonitoringFace]);

  // Check if IPV is already completed and show toast
  useEffect(() => {
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
    // Prevent multiple simultaneous calls
    if (isLoading || ipvUid) {
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
        setIpvUid(response.data.data.uid);
        setIsInitialized(true);
      } else {
        setError("Failed to initialize IPV. Please try again.");
      }
    } catch (err: unknown) {
      console.error("IPV initialization error:", err);
      if (axios.isAxiosError(err)) {
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
      setHasShownNoFaceToast(false);
      setIsMonitoringFace(true);
      
      // Clear any existing no-face toast timeout
      if (noFaceToastTimeoutRef.current) {
        clearTimeout(noFaceToastTimeoutRef.current);
        noFaceToastTimeoutRef.current = null;
      }
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
            setIsMonitoringFace(false); // Stop monitoring after capture
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
    // If showing completed state, always allow continue
    if (shouldShowCompletedState) {
      return false;
    }
    
    // If showing camera, require face detection and monitoring must be active
    if (showCamera) {
      return !isFaceDetected || isLoading || !isMonitoringFace;
    }
    
    // If not showing camera, require image file
    return !imageFile || isLoading || !ipvUid;
  };

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (isLoading) {
      return;
    }

    // If already completed and no new image and not wanting to re-verify, just go to next step
    if (isStepCompleted(CheckpointStep.IPV) && !imageFile && !wantsToReverify) {
      onNext();
      return;
    }

    // If showing camera and face detected, capture photo first
    if (showCamera && isFaceDetected) {
      capturePhoto();
      return;
    }

    if (!imageFile || !ipvUid) {
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

      const formData = new FormData();
      formData.append('image', imageFile);

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
      
      // Reset re-verification state immediately to prevent further submissions
      setWantsToReverify(false);
      setIsLoading(false); // Set loading to false immediately
      
      // Refetch IPV step to update the hook
      refetchStep(CheckpointStep.IPV);

      // Auto-advance after 100ms
      setTimeout(() => {
        onNext();
      }, 100);
      
    } catch (err: unknown) {
      console.error("IPV upload error:", err);
      setIsLoading(false); // Make sure to reset loading state on error
      
      if (axios.isAxiosError(err)) {
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
    setWantsToReverify(true);
    setHasShownNoFaceToast(false);
    setIsMonitoringFace(false);
    
    // Clear any existing timeouts
    if (noFaceToastTimeoutRef.current) {
      clearTimeout(noFaceToastTimeoutRef.current);
      noFaceToastTimeoutRef.current = null;
    }
  };

  const handleVerifyAgain = () => {
    // Clear all states first
    setImageFile(null);
    setError(null);
    setShowCamera(false);
    setCameraAutoStarted(false);
    setIsFaceDetected(false);
    setHasShownNoFaceToast(false);
    setIsMonitoringFace(false);
    
    // Clear any existing timeouts
    if (noFaceToastTimeoutRef.current) {
      clearTimeout(noFaceToastTimeoutRef.current);
      noFaceToastTimeoutRef.current = null;
    }
    
    // Stop camera if running
    stopCamera();
    
    // Reset initialization states
    setIsInitialized(false);
    setIpvUid(null);
    
    // Set the intent to re-verify (this will trigger useEffect)
    setWantsToReverify(true);
  };

  const handleRecapturePhoto = () => {
    setImageFile(null);
    setError(null);
    setIsFaceDetected(false);
    setHasShownNoFaceToast(false);
    setIsMonitoringFace(true);
    
    // Clear any existing timeouts
    if (noFaceToastTimeoutRef.current) {
      clearTimeout(noFaceToastTimeoutRef.current);
      noFaceToastTimeoutRef.current = null;
    }
    
    // Restart camera
    setTimeout(() => startCamera(), 100);
  };

  // Initialize camera when showCamera becomes true
  useEffect(() => {
    let stream: MediaStream | null = null;

    const setupCamera = async () => {
      if (showCamera && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: "user",
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 }
            },
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            
            // Add event listener for when video is ready
            videoRef.current.onloadedmetadata = () => {
              return "";
            };
          }
        } catch (err) {
          console.error("Camera access error:", err);
          setError("Camera access failed. Please enable permissions or use the mobile camera option.");
          setShowCamera(false);
          setIsMonitoringFace(false);
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
    setHasShownNoFaceToast(false);
    setIsMonitoringFace(false);
    
    // Clear any existing timeouts
    if (noFaceToastTimeoutRef.current) {
      clearTimeout(noFaceToastTimeoutRef.current);
      noFaceToastTimeoutRef.current = null;
    }
    
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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cleanup face detector
      if (faceDetector) {
        try {
          faceDetector.close();
        } catch (error) {
          console.error('Error closing face detector:', error);
        }
      }
      
      // Clear timeouts
      if (noFaceToastTimeoutRef.current) {
        clearTimeout(noFaceToastTimeoutRef.current);
      }
      
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      
      // Stop camera
      stopCamera();
    };
  }, []);

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
    if (shouldShowCompletedState) return "Continue";
    if (showCamera) {
      return isFaceDetected && isMonitoringFace ? "Capture Photo" : "Detecting Face...";
    }
    return "Continue";
  };

  return (
    <div className="mx-auto -mt-28 sm:mt-16">
      <FormHeading
        title="Video Verification (IPV)"
        description="A quick face-to-face verification for security."
      />

      {/* MediaPipe Loading Status */}
      {!isMediaPipeLoaded && showCamera && (
        <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <p className="text-blue-700 text-sm">Loading face detection...</p>
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover rounded transform scale-x-[-1]"
            />
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
            <Button onClick={stopCamera} variant="outline" className="py-2">
              Cancel
            </Button>
          </div>
        )}

{imageFile && !shouldShowCompletedState && !showCamera && (
  <div className="flex justify-center mt-4">
    <Button
      onClick={handleRecapturePhoto}
      variant="outline"
      className="py-6 w-full"
    >
      Recapture Photo
    </Button>
  </div>
)}

{error && (
  <div className="mt-2 p-2 bg-red-50 rounded">
    <p className="text-red-600 text-sm">{error}</p>
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
        className={`w-full py-6 transition-opacity duration-300 ${
          isButtonDisabled() ? "opacity-30 cursor-not-allowed" : "opacity-100"
        }`}
      >
        {getButtonText()}
      </Button>
    </div>
  );
};

export default IPVVerification;