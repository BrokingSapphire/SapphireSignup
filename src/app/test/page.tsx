'use client'
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Play, Square, RotateCcw, Activity } from 'lucide-react';

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

interface Stats {
  detectionCount: number;
  frameCount: number;
  totalConfidence: number;
  lastFrameTime: number;
}

interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const FaceDetectionDemo: React.FC = () => {
  // State management
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const [faceDetector, setFaceDetector] = useState<MediaPipeFaceDetection | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<MediaPipeResults['detections']>([]);
  const [status, setStatus] = useState('Initializing...');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({
    detectionCount: 0,
    frameCount: 0,
    totalConfidence: 0,
    lastFrameTime: Date.now()
  });

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logIdCounter = useRef(0);

  // Add log entry
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: LogEntry = {
      id: logIdCounter.current++,
      timestamp,
      message,
      type
    };
    
    setLogs(prev => {
      const updated = [...prev, newLog];
      // Keep only last 50 entries
      return updated.slice(-50);
    });
  };

  // Load MediaPipe Face Detection
  useEffect(() => {
    const loadMediaPipe = async () => {
      try {
        addLog('🔧 Loading MediaPipe Face Detection...', 'info');
        
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
            addLog('❌ MediaPipe Face Detection not available', 'error');
            setStatus('MediaPipe loading failed');
          }
        }, 1000);
        
      } catch (error) {
        addLog(`❌ Error loading MediaPipe: ${error}`, 'error');
        setStatus('MediaPipe loading failed');
      }
    };

    const initializeFaceDetector = () => {
      try {
        addLog('🎯 Initializing face detector...', 'info');
        
        const detector = new window.FaceDetection!({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
          }
        });
        
        // Set options with decreased accuracy (0.3) as requested
        detector.setOptions({
          model: 'short_range',
          minDetectionConfidence: 0.3,
        });
        
        detector.onResults((results: MediaPipeResults) => {
          setStats(prev => {
            const newStats = {
              ...prev,
              frameCount: prev.frameCount + 1,
              lastFrameTime: Date.now()
            };
            return newStats;
          });

          const faces = results.detections || [];
          setDetectedFaces(faces);
          setIsFaceDetected(faces.length > 0);
          
          if (faces.length > 0) {
            setStats(prev => ({
              ...prev,
              detectionCount: prev.detectionCount + 1,
              totalConfidence: prev.totalConfidence + faces.reduce((sum, face) => sum + face.score, 0)
            }));
            
            const confidences = faces.map(face => (face.score * 100).toFixed(1)).join(', ');
            addLog(`👤 ${faces.length} face(s) detected - Confidence: ${confidences}%`, 'success');
          }
        });
        
        setFaceDetector(detector);
        setIsMediaPipeLoaded(true);
        setStatus('Ready to start camera');
        addLog('✅ MediaPipe Face Detection initialized successfully!', 'success');
        
      } catch (error) {
        addLog(`❌ Error initializing face detector: ${error}`, 'error');
        setStatus('Initialization failed');
      }
    };

    loadMediaPipe();

    return () => {
      if (faceDetector) {
        try {
          faceDetector.close();
        } catch (error) {
          console.error('Error closing face detector:', error);
        }
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      addLog('📹 Starting camera...', 'info');
      setStatus('Starting camera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setStatus('Camera started');
        addLog('📺 Camera started successfully', 'success');
        
        // Start detection after video is ready
        videoRef.current.onloadedmetadata = () => {
          addLog('📊 Video metadata loaded, starting detection...', 'info');
          startDetection();
        };
      }
      
    } catch (error) {
      addLog(`❌ Camera access failed: ${error}`, 'error');
      setStatus('Camera access failed');
    }
  };

  // Stop camera
  const stopCamera = () => {
    try {
      addLog('🛑 Stopping camera...', 'info');
      
      stopDetection();
      
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      setIsCameraActive(false);
      setIsFaceDetected(false);
      setDetectedFaces([]);
      setStatus('Camera stopped');
      addLog('✅ Camera stopped successfully', 'success');
      
    } catch (error) {
      addLog(`❌ Error stopping camera: ${error}`, 'error');
    }
  };

  // Start face detection (500ms intervals as requested)
  const startDetection = () => {
    if (isDetecting || !faceDetector) return;
    
    setIsDetecting(true);
    addLog('🎯 Starting face detection (500ms intervals)...', 'info');
    setStatus('Detecting faces...');
    
    detectionIntervalRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState >= 2 && faceDetector) {
        try {
          faceDetector.send({ image: videoRef.current });
        } catch (error) {
          addLog(`⚠️ Detection error: ${error}`, 'error');
        }
      }
    }, 500); // 500ms as requested
  };

  // Stop face detection
  const stopDetection = () => {
    setIsDetecting(false);
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  // Clear logs and reset stats
  const clearLogs = () => {
    setLogs([]);
    setStats({
      detectionCount: 0,
      frameCount: 0,
      totalConfidence: 0,
      lastFrameTime: Date.now()
    });
    addLog('📝 Logs cleared and stats reset', 'info');
  };

  // Calculate derived stats
  const avgConfidence = stats.detectionCount > 0 ? 
    (stats.totalConfidence / stats.detectionCount * 100) : 0;
  const detectionRate = stats.frameCount > 0 ? 
    (stats.detectionCount / stats.frameCount * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🎯 Face Detection Test Demo
        </h1>
        <p className="text-gray-600">
          MediaPipe Face Detection with decreased accuracy (0.3) and 500ms intervals
        </p>
      </div>

      {/* Status */}
      <div className={`text-center p-4 rounded-lg mb-6 font-semibold ${
        isFaceDetected ? 'bg-green-100 text-green-800' :
        isCameraActive ? 'bg-yellow-100 text-yellow-800' :
        isMediaPipeLoaded ? 'bg-blue-100 text-blue-800' :
        'bg-gray-100 text-gray-800'
      }`}>
        <Activity className="inline-block w-5 h-5 mr-2" />
        {isFaceDetected ? `✅ ${detectedFaces.length} face(s) detected` : status}
      </div>

      {/* Video Container */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-6" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform scale-x-[-1]"
          style={{ display: isCameraActive ? 'block' : 'none' }}
        />
        
        {/* Face Detection Overlay */}
        {isCameraActive && detectedFaces.map((face, index) => {
          const x = (1 - face.boundingBox.xCenter - face.boundingBox.width / 2) * 100;
          const y = (face.boundingBox.yCenter - face.boundingBox.height / 2) * 100;
          const width = face.boundingBox.width * 100;
          const height = face.boundingBox.height * 100;
          
          return (
            <div
              key={index}
              className="absolute border-4 border-green-400 rounded-lg bg-green-100 bg-opacity-20"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <div className="absolute -top-8 left-0 bg-green-400 text-black px-2 py-1 rounded text-sm font-bold">
                {(face.score * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
        
        {/* Placeholder when camera is off */}
        {!isCameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Camera is off</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={startCamera}
          disabled={!isMediaPipeLoaded || isCameraActive}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          Start Camera
        </button>
        
        <button
          onClick={stopCamera}
          disabled={!isCameraActive}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Square className="w-4 h-4" />
          Stop Camera
        </button>
        
        <button
          onClick={clearLogs}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <RotateCcw className="w-4 h-4" />
          Clear Logs
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.detectionCount}</div>
          <div className="text-sm text-gray-600">Faces Detected</div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{stats.frameCount}</div>
          <div className="text-sm text-gray-600">Frames Processed</div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-600">{avgConfidence.toFixed(1)}%</div>
          <div className="text-sm text-gray-600">Avg Confidence</div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-orange-600">{detectionRate.toFixed(1)}%</div>
          <div className="text-sm text-gray-600">Detection Rate</div>
        </div>
      </div>

      {/* Log Display */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Detection Log</h3>
        <div className="h-40 overflow-y-auto space-y-1 font-mono text-sm">
          {logs.map(log => (
            <div
              key={log.id}
              className={`${
                log.type === 'success' ? 'text-green-600' :
                log.type === 'error' ? 'text-red-600' :
                log.type === 'warning' ? 'text-yellow-600' :
                'text-blue-600'
              }`}
            >
              [{log.timestamp}] {log.message}
            </div>
          ))}
        </div>
      </div>

      {/* Debug Info */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <div>MediaPipe Loaded: {isMediaPipeLoaded ? '✅' : '❌'}</div>
        <div>Camera Active: {isCameraActive ? '✅' : '❌'}</div>
        <div>Detection Running: {isDetecting ? '✅' : '❌'}</div>
        <div>Face Detected: {isFaceDetected ? '✅' : '❌'}</div>
        <div>Detection Confidence Threshold: 0.3 (30%)</div>
        <div>Detection Interval: 500ms</div>
      </div>
    </div>
  );
};

export default FaceDetectionDemo;