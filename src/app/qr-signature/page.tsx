'use client';

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

// Separate component to handle search params
const SignatureContent = () => {
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const authToken = searchParams.get('authToken');
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (!uid) {
      setError("Invalid signature link");
    }
    
    // Store auth token in cookie if provided
    if (authToken) {
      document.cookie = `authToken=${authToken}; path=/; max-age=3600; secure; samesite=strict`;
    }
  }, [uid, authToken]);

  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions with higher resolution for better quality
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Scale context to handle the resolution difference
    context.scale(2, 2);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "black";
    context.lineWidth = 3; // Slightly thicker for mobile
    
    // Set white background
    context.fillStyle = "white";
    context.fillRect(0, 0, rect.width, rect.height);
    
    contextRef.current = context;
  };

  useEffect(() => {
    if (uid) {
      const timer = setTimeout(() => {
        initializeCanvas();
      }, 100);
      
      // Add resize listener to reinitialize canvas when orientation changes
      const handleResize = () => {
        setTimeout(initializeCanvas, 100);
      };
      
      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", handleResize);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleResize);
      };
    }
  }, [uid]);

  const getEventPos = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const boundingRect = canvasRef.current?.getBoundingClientRect();
    if (!boundingRect) return { x: 0, y: 0 };

    let clientX, clientY;

    if ("touches" in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    return {
      x: clientX - boundingRect.left,
      y: clientY - boundingRect.top
    };
  };

  const startDrawing = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    setIsDrawing(true);
    const context = contextRef.current;
    if (!context) return;

    if ("touches" in event) {
      event.preventDefault(); // Prevent scrolling on touch
    }

    const { x, y } = getEventPos(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const context = contextRef.current;
    if (!context) return;

    if ("touches" in event) {
      event.preventDefault(); // Prevent scrolling on touch
    }

    const { x, y } = getEventPos(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    contextRef.current?.closePath();

    if (canvasRef.current) {
      const signatureData = canvasRef.current.toDataURL("image/png", 0.8);
      setSignature(signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    // Clear and set white background
    context.fillStyle = "white";
    context.fillRect(0, 0, rect.width, rect.height);
    context.strokeStyle = "black"; // Reset stroke color
    setSignature(null);
    setError(null);
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
    if (!signature || !uid) return;

    setIsLoading(true);
    setError(null);

    try {
      // Convert canvas signature to file
      const signatureFile = convertDataURLToFile(signature, "mobile-signature.png");
      
      const formData = new FormData();
      formData.append('image', signatureFile);

      // Use your existing putSignature endpoint
      await axios.put(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/v1/auth/signup/signature/${uid}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // NOTE: No withCredentials here because mobile doesn't have the user's cookies
          // The backend validates using the UUID in Redis
        }
      );

      setSuccess(true);
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status === 401) {
        setError("Signature session expired. Please scan the QR code again.");
      } else if (error.response?.data?.message) {
        setError(`Upload failed: ${error.response.data.message}`);
      } else {
        setError("Signature submission failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Signature Complete!</h1>
            <p className="text-gray-600">
              Your signature has been submitted successfully. You can now close this page and continue on your computer.
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Digital Signature</h1>
          <p className="text-gray-600">Please sign clearly in the box below</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <div className="border-2 border-gray-300 rounded-lg p-2 bg-white">
            <canvas
              ref={canvasRef}
              className="w-full h-48 rounded cursor-crosshair touch-none"
              style={{ 
                touchAction: 'none',
                background: 'white'
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          
          <div className="text-center mt-2">
            <p className="text-xs text-gray-500">
              Sign with your finger or stylus above
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <Button 
              onClick={clearSignature}
              variant="outline" 
              className="flex-1"
              disabled={isLoading}
            >
              Clear
            </Button>
            
            <Button 
              onClick={handleSubmit} 
              disabled={!signature || isLoading} 
              className="flex-1"
            >
              {isLoading ? "Submitting..." : "Submit Signature"}
            </Button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Secure signature powered by Sapphire Broking</p>
        </div>
      </div>
    </div>
  );
};

// Main page component with Suspense wrapper
const SignaturePage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading signature page...</p>
        </div>
      </div>
    }>
      <SignatureContent />
    </Suspense>
  );
};

export default SignaturePage;