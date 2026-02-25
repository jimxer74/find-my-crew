'use client';

import { useState, useRef } from 'react';
import { logger } from '@shared/logging';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

interface ImageUploadProps {
  onUpload: (urls: string[]) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  accept?: string;
  className?: string;
  userId: string;
  bucketName?: string;
}

export function ImageUpload({
  onUpload,
  onError,
  maxFiles = 10,
  maxSize = 5, // 5MB default
  accept = 'image/*',
  className = '',
  userId,
  bucketName = 'journey-images'
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Validate files
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of Array.from(files)) {
      // Check file type
      if (!file.type.startsWith('image/')) {
        errors.push(`'${file.name}' is not an image file`);
        continue;
      }

      // Check file size
      const sizeInMB = file.size / (1024 * 1024);
      if (sizeInMB > maxSize) {
        errors.push(`'${file.name}' is too large (max ${maxSize}MB)`);
        continue;
      }

      validFiles.push(file);
    }

    // Show validation errors
    if (errors.length > 0) {
      onError?.(errors.join(', '));
      return;
    }

    // Check total files limit
    if (validFiles.length > maxFiles) {
      onError?.(`Too many files selected (max ${maxFiles})`);
      return;
    }

    await uploadFiles(validFiles);
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    const supabase = getSupabaseBrowserClient();
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        // Create unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Reset progress for this file
        setUploadProgress(prev => ({ ...prev, [fileName]: 0 }));

        // Upload to Supabase Storage with progress tracking
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            // Note: Supabase JS client doesn't support progress events directly
            // This is a placeholder for when progress tracking is available
          });

        if (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(publicUrl);
        setUploadProgress(prev => ({ ...prev, [fileName]: 100 }));
      }

      onUpload(uploadedUrls);
    } catch (err: any) {
      logger.error('Upload error:', err instanceof Error ? { error: err.message } : { error: String(err) });
      onError?.(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset file input to allow same file selection
    e.target.value = '';
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-primary bg-primary/10'
            : uploading
            ? 'border-muted bg-muted'
            : 'border-border hover:border-primary/50 hover:bg-accent'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">
              Drag and drop images here, or click to select files
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {accept === 'image/*' ? 'PNG, JPG, GIF' : accept} up to {maxSize}MB each
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum {maxFiles} files
            </p>
          </div>

          {uploading && (
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full w-full animate-pulse" />
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground">
        <p>Tip: Use high-quality images for the best display experience</p>
      </div>
    </div>
  );
}