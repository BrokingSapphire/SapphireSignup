import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import FormHeading from "./FormHeading";
import axios, { AxiosError } from "axios";
import Cookies from 'js-cookie';
import { toast } from "sonner";
import { getApiEndpointByType } from "@/lib/utils";

interface PanUploadComponentProps {
  onNext: () => void;
  initialData?: {
    url?: string;
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

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

const PanUploadComponent: React.FC<PanUploadComponentProps> = ({ 
  onNext,
  initialData,
  isCompleted 
}) => {
  const [uploadUid, setUploadUid] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  // const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [uploadedFile, isUploading, uploadUid, isCompleted]);

  // Initialize PAN upload session with retry logic
  const initializePanUpload = useCallback(async (attemptCount = 0) => {
    if (isInitializing || uploadUid) {
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        return;
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}${getApiEndpointByType('checkpoint')}`,
        {
          step: "pan_verification_record"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          timeout: 15000, // 15 second timeout
        }
      );

      if (response.data?.data?.uid) {
        setUploadUid(response.data.data.uid);
        setIsInitialized(true);
        // setRetryCount(0); // Reset retry count on success
        toast.success("Upload session initialized successfully!");
      } else {
        throw new Error("No UID received from server");
      }
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      // Only console.log for PAN record validation as specified
      console.log("PAN upload initialization error:", err);
      
      // Retry logic for network errors
      if ((!err.response || err.code === 'ECONNABORTED') && attemptCount < 2) {
        console.warn(`Retrying PAN upload initialization... (${attemptCount + 1}/3)`);
        setTimeout(() => {
          initializePanUpload(attemptCount + 1);
        }, 2000 * (attemptCount + 1)); // Exponential backoff
        return;
      }
      
      if (err.response) {
        if (err.response.data?.message) {
          setError(`Initialization failed: ${err.response.data.message}`);
        } else if (err.response.status === 400) {
          setError("Invalid request. Please try again.");
        } else if (err.response.status === 401) {
          setError("Session expired. Please refresh the page and try again.");
        } else if (err.response.status === 403) {
          setError("Access denied. Please check your authentication and try again.");
        } else if (err.response.status >= 500) {
          setError("Server error. Please try again in a few moments.");
        } else {
          setError(`Server error (${err.response.status}). Please try again.`);
        }
      } else if (err.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, uploadUid]);

  // Initialize on component mount if not completed
  useEffect(() => {
    if (!isCompleted && !isInitialized && !uploadUid && !isInitializing) {
      initializePanUpload();
    }
  }, [isCompleted, isInitialized, uploadUid, isInitializing, initializePanUpload]);

  // Validate file before setting it
  const validateFile = (file: File): string | null => {
    // Check file type
    if (file.type !== 'application/pdf') {
      return "Please select a PDF file only.";
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return "File size must be less than 10MB.";
    }

    // Check minimum file size (at least 10KB to ensure it's not empty)
    const minSize = 10 * 1024; // 10KB
    if (file.size < minSize) {
      return "File appears to be too small. Please ensure it's a valid PDF document.";
    }

    return null;
  };

  // Handle file selection with enhanced validation
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploadedFile(file);
    setError(null);
    setUploadProgress(null);
    toast.success(`File "${file.name}" selected successfully!`);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Enhanced upload function with progress tracking and retry logic
  const uploadPanDocument = async (attemptCount = 0) => {
    if (!uploadedFile || !uploadUid) {
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress({ loaded: 0, total: uploadedFile.size, percentage: 0 });

    try {
      const authToken = Cookies.get('authToken');
      if (!authToken) {
        setError("Authentication token not found. Please restart the process.");
        return;
      }

      const formData = new FormData();
      formData.append('pdf', uploadedFile);

      await axios.put(
        `${process.env.NEXT_PUBLIC_BASE_URL}${getApiEndpointByType('panVerificationRecord')}/${uploadUid}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${authToken}`
          },
          timeout: 60000, // 60 second timeout for file upload
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress({
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage
              });
            }
          }
        }
      );

      setUploadProgress({ loaded: uploadedFile.size, total: uploadedFile.size, percentage: 100 });
      toast.success("PAN document uploaded successfully!");
      
      // Auto-advance after a short delay
      setTimeout(() => {
        onNext();
      }, 1500);
      
    } catch (error) {
      const err = error as AxiosError<ApiErrorResponse>;
      // Only console.log for PAN record validation as specified
      console.log("PAN upload error:", err);
      
      // Retry logic for network errors
      if ((!err.response || err.code === 'ECONNABORTED') && attemptCount < 2) {
        console.warn(`Retrying upload... (${attemptCount + 1}/3)`);
        toast.info(`Upload failed, retrying... (${attemptCount + 1}/3)`);
        setTimeout(() => {
          uploadPanDocument(attemptCount + 1);
        }, 3000 * (attemptCount + 1)); // Exponential backoff
        return;
      }
      
      setUploadProgress(null);
      
      if (err.response) {
        if (err.response.data?.message) {
          setError(`Upload failed: ${err.response.data.message}`);
        } else if (err.response.status === 401) {
          setError("Session expired. Please refresh the page and try again.");
        } else if (err.response.status === 413) {
          setError("File too large. Please ensure your file is under 10MB.");
        } else if (err.response.status === 422) {
          setError("Invalid file format or corrupted file. Please upload a valid PDF document.");
        } else if (err.response.status === 403) {
          setError("Access denied. Please check your authentication and try again.");
        } else if (err.response.status >= 500) {
          setError("Server error. Please try again in a few moments.");
        } else {
          setError(`Upload failed (${err.response.status}). Please try again.`);
        }
      } else if (err.request) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError("An unexpected error occurred during upload. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (isCompleted) {
      onNext();
      return;
    }

    if (!uploadedFile) {
      setError("Please select a PAN document to upload.");
      return;
    }

    if (!uploadUid) {
      setError("Upload session not initialized. Please try refreshing the page.");
      return;
    }

    await uploadPanDocument();
  };

  const handleRetry = () => {
    setError(null);
    setIsInitialized(false);
    setUploadUid(null);
    setUploadedFile(null);
    setUploadProgress(null);
    // setRetryCount(prev => prev + 1);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    initializePanUpload();
  };

  const removeFile = () => {
    setUploadedFile(null);
    setError(null);
    setUploadProgress(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info("File removed");
  };

  const isButtonDisabled = () => {
    if (isCompleted) return false;
    return !uploadedFile || isUploading || !uploadUid || isInitializing;
  };

  const getButtonText = () => {
    if (isUploading) {
      if (uploadProgress) {
        return `Uploading... ${uploadProgress.percentage}%`;
      }
      return "Uploading...";
    }
    if (isCompleted) return "Continue";
    return "Upload & Continue";
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Show initialization loading
  if (isInitializing && !isInitialized) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16">
        <FormHeading
          title="PAN Document Upload"
          description="Initializing secure upload session..."
        />
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-3" />
            <span className="text-gray-600">Setting up upload session...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (!isInitialized && error && !isInitializing) {
    return (
      <div className="mx-auto -mt-28 sm:mt-16">
        <FormHeading
          title="PAN Document Upload"
          description="Failed to initialize upload session."
        />
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleRetry}
            variant="ghost"
            className="flex-1 py-6"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="flex-1 py-6"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto -mt-28 sm:mt-16">
      <FormHeading
        title="PAN Document Upload"
        description="Please upload your PAN card document for verification."
      />

      {isCompleted && initialData?.url ? (
        // Show completed state
        <div className="mb-6">
          <div className="border-2 border-dashed h-[240px] w-[80%] mx-auto border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-green-600 font-medium">PAN Document Already Uploaded</p>
              <p className="text-gray-600 text-sm">Your PAN document has been successfully submitted</p>
            </div>
          </div>
        </div>
      ) : (
        // Show upload interface
        <div className="mb-6">
          <div 
            className={`border-2 border-dashed h-[240px] w-[80%] mx-auto rounded-lg p-6 flex flex-col items-center justify-center transition-all duration-200 ${
              dragActive 
                ? 'border-teal-500 bg-teal-50 scale-102' 
                : uploadedFile 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploadedFile ? (
              // Show selected file with progress
              <div className="text-center space-y-4 w-full">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="text-green-600 font-medium truncate max-w-[200px] mx-auto">
                    {uploadedFile.name}
                  </p>
                  <p className="text-gray-600 text-sm">{formatFileSize(uploadedFile.size)}</p>
                </div>
                
                {/* Upload Progress */}
                {uploadProgress && (
                  <div className="w-full max-w-xs mx-auto">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {uploadProgress.percentage}% ({formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)})
                    </p>
                  </div>
                )}
                
                {!isUploading && (
                  <button
                    onClick={removeFile}
                    className="text-red-500 hover:text-red-700 text-sm underline transition-colors"
                    disabled={isUploading}
                  >
                    Remove file
                  </button>
                )}
              </div>
            ) : (
              // Show upload area
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-700 font-medium">
                    {dragActive ? "Drop your PAN document here" : "Drop your PAN document here"}
                  </p>
                  <p className="text-gray-500 text-sm">or click to browse files</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading || !uploadUid}
                >
                  Select PDF File
                </button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading || !uploadUid}
          />
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded border border-red-200">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isButtonDisabled()}
        variant="ghost"
        className={`w-full py-6 transition-all duration-200 ${
          isButtonDisabled() ? "opacity-50 cursor-not-allowed" : "hover:bg-teal-50"
        }`}
      >
        {isUploading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
        {getButtonText()}
      </Button>

      <div className="text-center text-sm text-gray-600 mt-4">
        <p>
          Please upload a clear copy of your PAN card document. 
          This is required for account verification purposes.
        </p>
        {uploadUid && (
          <p className="text-xs text-gray-500 mt-2">
            Upload session ID: {uploadUid.substring(0, 8)}...
          </p>
        )}
      </div>
    </div>
  );
};

export default PanUploadComponent;