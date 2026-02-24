'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/app/components/ui/Button/Button';

interface PhotoUploadStepProps {
  onComplete: (photoFile: Blob) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const TARGET_SIZE = 200 * 1024; // 200KB target after compression
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function PhotoUploadStep({ onComplete, onCancel, isLoading = false, error }: PhotoUploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(error || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Check camera permission
  useEffect(() => {
    if (cameraMode && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' } })
        .then(() => {
          setCameraPermission('granted');
        })
        .catch(() => {
          setCameraPermission('denied');
          setCameraMode(false);
          setUploadError('Camera permission denied. Please use file upload instead.');
        });
    }
  }, [cameraMode]);

  // Handle camera stream
  useEffect(() => {
    if (!cameraMode || cameraPermission !== 'granted' || !videoRef.current) return;

    let isMounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (isMounted && videoRef.current) {
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (isMounted) {
          setUploadError('Failed to access camera');
          setCameraMode(false);
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraMode, cameraPermission]);

  const compressImage = async (imageFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions, max 1200px
          const maxDim = 1200;
          if (width > height) {
            if (width > maxDim) {
              height = (height * maxDim) / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = (width * maxDim) / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Handle EXIF rotation if needed
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to target quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.8 // 80% quality - good balance between quality and size
          );
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(imageFile);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const selectedFile = files[0];
    setUploadError(null);

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setUploadError('Invalid file type. Allowed: JPEG, PNG, WebP.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setUploadError('File too large. Maximum 5MB.');
      return;
    }

    setIsCompressing(true);
    try {
      const compressedBlob = await compressImage(selectedFile);
      const compressedSize = (compressedBlob.size / 1024).toFixed(1);

      // Create a File object from the compressed blob
      const compressedFile = new File([compressedBlob], selectedFile.name, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      setFile(compressedFile);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(compressedBlob);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to compress image');
    } finally {
      setIsCompressing(false);
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setUploadError('Failed to capture photo');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setUploadError('Failed to capture photo');
          return;
        }

        setIsCompressing(true);
        try {
          // Even though we just compressed, do minimal re-compress to ensure target size
          const compressedBlob = await compressImage(
            new File([blob], 'photo.jpg', { type: 'image/jpeg' })
          );

          const photoFile = new File([compressedBlob], 'passport-photo.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          setFile(photoFile);
          setPreview(URL.createObjectURL(compressedBlob));
          setCameraMode(false);

          // Stop camera stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : 'Failed to process photo');
        } finally {
          setIsCompressing(false);
        }
      },
      'image/jpeg',
      0.8
    );
  };

  const handleSubmit = () => {
    if (!file) return;
    onComplete(file);
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setUploadError(null);
    setCameraMode(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Facial Photo for Verification</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Upload a clear photo of your face to verify against your passport. This helps us validate your identity.
        </p>
      </div>

      {/* Error message */}
      {(uploadError || error) && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {uploadError || error}
        </div>
      )}

      {/* Camera or File Upload Mode */}
      {!file ? (
        <>
          {/* Tab switching */}
          <div className="flex gap-2 border-b border-border">
            <Button
              type="button"
              onClick={() => setCameraMode(false)}
              variant={!cameraMode ? 'primary' : 'ghost'}
              size="sm"
              className={`!border-0 border-b-2 !rounded-none !p-3 ${
                !cameraMode
                  ? 'border-primary'
                  : 'border-transparent'
              }`}
            >
              Upload File
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (cameraPermission === 'denied') {
                  setUploadError('Camera permission denied');
                } else {
                  setCameraMode(true);
                }
              }}
              disabled={cameraPermission === 'denied'}
              variant={cameraMode ? 'primary' : 'ghost'}
              size="sm"
              className={`!border-0 border-b-2 !rounded-none !p-3 ${
                cameraMode
                  ? 'border-primary'
                  : 'border-transparent'
              }`}
            >
              Take Photo
            </Button>
          </div>

          {/* Upload Mode */}
          {!cameraMode && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50 hover:bg-accent'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Drag and drop your photo</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP (max 5MB)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={isCompressing}
              />
            </div>
          )}

          {/* Camera Mode */}
          {cameraMode && cameraPermission === 'granted' && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full"
                  style={{ aspectRatio: '4/5' }}
                />
              </div>
              <Button
                type="button"
                onClick={takePhoto}
                disabled={isCompressing}
                variant="primary"
                className="w-full"
              >
                {isCompressing ? 'Processing...' : 'Take Photo'}
              </Button>
              <Button
                type="button"
                onClick={() => setCameraMode(false)}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Compression state */}
          {isCompressing && (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-sm text-muted-foreground">Compressing photo...</span>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Preview */}
          <div className="rounded-lg overflow-hidden border border-border bg-muted">
            <img src={preview!} alt="Photo preview" className="w-full" />
          </div>

          {/* File info */}
          <div className="bg-secondary/50 rounded-md p-3 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                type="button"
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="!text-xs !text-muted-foreground hover:!text-foreground !p-0"
              >
                Change
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              Choose Another
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              variant="primary"
              className="flex-1"
            >
              {isLoading ? 'Uploading...' : 'Use This Photo'}
            </Button>
          </div>
        </>
      )}

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden input for camera fallback on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
