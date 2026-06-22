import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, Loader2 } from 'lucide-react';
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  
  // Face Detection State
  const [faceDetector, setFaceDetector] = useState<FaceDetector | null>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Initialize MediaPipe Face Detector
  useEffect(() => {
    const initializeFaceDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        });
        setFaceDetector(detector);
        setIsModelLoading(false);
      } catch (err) {
        console.error("Failed to load face detector model", err);
        setIsModelLoading(false);
      }
    };

    initializeFaceDetector();
  }, []);

  // Camera Setup
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detection Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastVideoTime = -1;

    const detectFace = () => {
      if (faceDetector && videoRef.current && videoRef.current.readyState === 4) {
        const video = videoRef.current;
        const currentTime = video.currentTime;

        if (currentTime !== lastVideoTime) {
          lastVideoTime = currentTime;
          const detections = faceDetector.detectForVideo(video, startTimeMs());
          
          if (detections.detections.length > 0) {
             // Check if the FIRST detected face is within the ellipse (Center Alignment)
             const face = detections.detections[0].boundingBox;
             if (!face) {
               setIsFaceDetected(false);
               return;
             }
             const videoW = video.videoWidth;
             const videoH = video.videoHeight;
             
             // Calculate Face Center
             const faceCX = face.originX + (face.width / 2);
             const faceCY = face.originY + (face.height / 2);
             
             // Calculate Screen Center
             const screenCX = videoW / 2;
             const screenCY = videoH / 2;

             // Alignment Thresholds (Face must be within 20% of center)
             const toleranceX = videoW * 0.15; 
             const toleranceY = videoH * 0.2;

             // Size Threshold (Face must be reasonably large, e.g., > 15% of screen width)
             const minFaceSize = videoW * 0.2;

             const isCenteredX = Math.abs(faceCX - screenCX) < toleranceX;
             const isCenteredY = Math.abs(faceCY - screenCY) < toleranceY;
             const isLargeEnough = face.width > minFaceSize;

             if (isCenteredX && isCenteredY && isLargeEnough) {
               setIsFaceDetected(true);
             } else {
               setIsFaceDetected(false);
             }

          } else {
             setIsFaceDetected(false);
          }
        }
      }
      animationFrameId = requestAnimationFrame(detectFace);
    };

    detectFace();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [faceDetector]);

  const startTimeMs = () => performance.now();

  const startCamera = async () => {
    try {
      setError('');
      // Request HD resolution
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Auto-capture countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    if (isFaceDetected) {
      setCountdown(3);
      
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null;
          return prev > 1 ? prev - 1 : 1;
        });
      }, 1000);

      timer = setTimeout(() => {
        handleCapture();
      }, 2000);
    } else {
      setCountdown(null);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFaceDetected]);

  const handleCapture = () => {
    if (!isFaceDetected) return; 

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // Define Crop Area (Center 3:4 aspect ratio)
      // If video is 1280x720 (landscape), we want a portrait crop from center.
      // Target aspect ratio 3:4 (0.75)
      let cropHeight = vHeight; 
      let cropWidth = vHeight * 0.75; // 720 * 0.75 = 540

      // If by chance the video is portrait (mobile), adjust
      if (cropWidth > vWidth) {
        cropWidth = vWidth;
        cropHeight = vWidth / 0.75;
      }

      const startX = (vWidth - cropWidth) / 2;
      const startY = (vHeight - cropHeight) / 2;

      // Set canvas to the cropped size
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 1. Clear Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Setup Mirror Transform (for user friendliness)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        // 3. Create Clipping Path (Ellipse)
        // Since we transformed coordinate system, we need to draw the ellipse carefully.
        // We draw an ellipse in the center of the canvas that matches the visual guide.
        // The visual guide in CSS is roughly a vertical ellipse.
        ctx.beginPath();
        // Center X, Center Y, Radius X, Radius Y, Rotation, Start Angle, End Angle
        ctx.ellipse(
          canvas.width / 2, 
          canvas.height / 2, 
          canvas.width * 0.5, // Width radius (full width)
          canvas.height * 0.45, // Height radius (slightly smaller than full height to match CSS oval)
          0, 0, 2 * Math.PI
        );
        ctx.clip(); // Everything drawn after this will be confined to the ellipse

        // 4. Draw the cropped video
        ctx.drawImage(
          video, 
          startX, startY, cropWidth, cropHeight, // Source (Crop from video)
          0, 0, canvas.width, canvas.height      // Destination (Full canvas)
        );
        
        // 5. Export to JPEG (Transparent/Clipped areas will turn Black in JPEG)
        // This effectively removes the background context for the AI.
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(imageData);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-800">
      {error ? (
        <div className="text-red-400 p-8 text-center">
          <p className="mb-4">{error}</p>
          <button 
            onClick={startCamera}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute bottom-8 flex gap-6 z-20">
            <button 
              onClick={onCancel}
              className="bg-gray-600/80 hover:bg-gray-500/80 text-white p-4 rounded-full backdrop-blur-sm transition-all"
              title="뒤로가기"
            >
              <RefreshCw size={24} />
            </button>
            <button 
              onClick={handleCapture}
              disabled={!isFaceDetected || isModelLoading}
              className={`p-5 rounded-full transition-all duration-300 shadow-lg border-4 ${
                isFaceDetected 
                  ? "bg-white text-black hover:scale-110 border-green-500 cursor-pointer shadow-[0_0_20px_rgba(74,222,128,0.5)]" 
                  : "bg-gray-500/50 text-gray-400 border-gray-600 cursor-not-allowed opacity-50"
              }`}
              title={isFaceDetected ? "촬영하기" : "타원 안에 얼굴을 맞춰주세요"}
            >
              {isModelLoading ? <Loader2 className="animate-spin" size={32}/> : <Camera size={32} />}
            </button>
          </div>

          {/* Face Guide Overlay with visual feedback */}
          <div 
            className={`absolute inset-0 border-[4px] rounded-[45%] w-64 h-80 m-auto pointer-events-none z-10 transition-all duration-300 ${
              isFaceDetected 
                ? "border-green-400 shadow-[0_0_50px_rgba(74,222,128,0.4)] scale-105" 
                : "border-white/30"
            }`}
          >
            <div className={`w-full text-center mt-[-40px] font-bold text-shadow transition-colors duration-300 ${
              isFaceDetected ? "text-green-400" : "text-white/80"
            }`}>
              {isModelLoading ? "준비 중..." : (isFaceDetected ? (countdown !== null ? `${countdown}초 후 촬영됩니다` : "얼굴 인식됨") : "타원 안에 얼굴을 맞춰주세요")}
            </div>

            {/* Large Countdown Number */}
            {isFaceDetected && countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(74,222,128,0.8)] animate-pulse">
                  {countdown}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CameraCapture;