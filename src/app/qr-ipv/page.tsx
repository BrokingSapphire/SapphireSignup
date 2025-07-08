'use client';

import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { toast } from "sonner";

// MediaPipe Types (same as IPV component)
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

// Separate component to handle search params
const QRIPVContent = () => {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const authToken = searchParams.get('authToken');
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  // Face detection states (same as IPV component)
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [faceDetector, setFaceDetector] = useState<MediaPipeFaceDetection | null>(null);
  const [hasShownNoFaceToast, setHasShownNoFaceToast] = useState(false);
  const [isMonitoringFace, setIsMonitoringFace] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const noFaceToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save authToken to cookies immediately when component mounts
  useEffect(() => {
    if (authToken) {
      // Set cookie with secure settings
      document.cookie = `authToken=${authToken}; path=/; secure; samesite=strict; max-age=3600`;
      console.log('AuthToken saved to cookies:', authToken);
    }
  }, [authToken]);

  useEffect(() => {
    if (!uid) {
      setError("Invalid verification link");
    }
  }, [uid]);

  // Load MediaPipe Face Detection (same as IPV component)
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
        
        // Set options with same confidence as IPV component
        detector.setOptions({
          model: 'short_range',
          minDetectionConfidence: 0.4,
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

  // Start face detection when camera is active (same as IPV component)
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
    // Check if face is detected before allowing capture (same as IPV component)
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

        // Flip the image back to normal orientation when capturing (same as IPV component)
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            // Create file with proper timestamp and higher quality
            const timestamp = new Date().getTime();
            const capturedFile = new File([blob], `mobile-ipv-${timestamp}.jpg`, {
              type: "image/jpeg",
              lastModified: timestamp,
            });
            
            console.log('Captured file details:', {
              name: capturedFile.name,
              size: capturedFile.size,
              type: capturedFile.type,
              lastModified: capturedFile.lastModified
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
          } else {
            toast.error("Failed to capture photo. Please try again.");
          }
        }, "image/jpeg", 0.9); // Increased quality to 0.9
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Uploaded file details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      if (!file.type.startsWith("image/")) {
        setError("Please upload a valid image file");
        toast.error("Please upload a valid image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // Increased to 10MB
        setError("Image size should be less than 10MB");
        toast.error("Image size should be less than 10MB");
        return;
      }
      
      // Additional validation for common image formats
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setError("Please upload a JPEG, PNG, or WebP image");
        toast.error("Please upload a JPEG, PNG, or WebP image");
        return;
      }
      
      setImageFile(file);
      setError(null);
      toast.success("Image uploaded successfully!");
    }
  };

  const handleSubmit = async () => {
    if (!imageFile || !uid) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      // Use your existing putIpv endpoint - NO AUTHORIZATION HEADER
      // Backend validates using UUID in Redis only
      await axios.put(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/ipv/${uid}`,
        formData,
        {
          headers: {
            // Only Content-Type, no Authorization header
          },
        }
      );

      setSuccess(true);
      toast.success("Verification completed successfully!");
    } catch (err: unknown) {
      console.error("Mobile IPV upload error:", err);
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          if (err.response.status === 401) {
            setError("Verification session expired. Please scan the QR code again.");
            toast.error("Verification session expired. Please scan the QR code again.");
          } else if (err.response.status === 422) {
            setError("Invalid image format. Please try again with a clear photo of your face.");
            toast.error("Invalid image format. Please try again with a clear photo of your face.");
          } else if (err.response.data?.message) {
            setError(`Upload failed: ${err.response.data.message}`);
            toast.error(`Upload failed: ${err.response.data.message}`);
          } else {
            setError(`Server error (${err.response.status}). Please try again.`);
            toast.error(`Server error (${err.response.status}). Please try again.`);
          }
        } else if (err.request) {
          setError("Network error. Please check your connection and try again.");
          toast.error("Network error. Please check your connection and try again.");
        } else {
          setError("An unexpected error occurred. Please try again.");
          toast.error("An unexpected error occurred. Please try again.");
        }
      } else {
        setError("Verification failed. Please try again.");
        toast.error("Verification failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize camera when showCamera becomes true (same as IPV component)
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
          setError("Camera access failed. Please enable permissions or try uploading an image.");
          setShowCamera(false);
          setIsMonitoringFace(false);
          toast.error("Camera access failed. Please enable permissions or try uploading an image.");
        }
      }
    };

    if (showCamera) {
      setupCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showCamera]);

  // Cleanup on component unmount (same as IPV component)
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
      const video = videoRef.current;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Complete!</h1>
            <p className="text-gray-600">
              Your identity has been verified successfully. You can now close this page and continue on your computer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="mb-4">
            <Image 
              src="/logo.png"
              alt="Sapphire Broking"
              width={32}
              height={32}
              className="h-8 mx-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Identity Verification</h1>
          <p className="text-gray-600">Take a clear photo of your face for verification</p>
        </div>

        {/* MediaPipe Loading Status */}
        {!isMediaPipeLoaded && showCamera && (
          <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <p className="text-blue-700 text-sm">Loading face detection...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center min-h-[200px] flex flex-col items-center justify-center">
            {showCamera ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-48 object-cover rounded transform scale-x-[-1]"
              />
            ) : imageFile ? (
              <div className="space-y-4">
                <div className="relative w-full h-32">
                  <Image
                    src={URL.createObjectURL(imageFile)}
                    alt="Preview"
                    className="object-contain rounded"
                    fill
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Camera className="w-12 h-12 mx-auto text-gray-400" />
                <p className="text-gray-600">Take a photo</p>
              </div>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {showCamera ? (
          <div className="flex gap-3 mb-4">
            <Button 
              onClick={capturePhoto} 
              className="flex-1"
              disabled={!isFaceDetected || !isMonitoringFace}
            >
              {isFaceDetected && isMonitoringFace ? "Capture Photo" : "Detecting Face..."}
            </Button>
            <Button 
              onClick={() => {
                setShowCamera(false);
                setIsMonitoringFace(false);
                const video = videoRef.current;
                if (video && video.srcObject) {
                  const stream = video.srcObject as MediaStream;
                  stream.getTracks().forEach((track) => track.stop());
                }
              }} 
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            <Button onClick={startCamera} className="w-full" disabled={isLoading}>
              <Camera className="w-4 h-4 mr-2" />
              Open Camera
            </Button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {imageFile && !showCamera && (
          <div className="space-y-3">
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading} 
              className="w-full"
            >
              {isLoading ? "Verifying..." : "Submit Verification"}
            </Button>
            
            <Button 
              onClick={() => {
                setImageFile(null);
                setError(null);
              }} 
              variant="outline" 
              className="w-full"
              disabled={isLoading}
            >
              Take Another Photo
            </Button>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Secure verification powered by Sapphire Broking</p>
        </div>
      </div>
    </div>
  );
};

// Main page component with Suspense wrapper
const QRIPVPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading verification page...</p>
        </div>
      </div>
    }>
      <QRIPVContent />
    </Suspense>
  );
};

export default QRIPVPage;