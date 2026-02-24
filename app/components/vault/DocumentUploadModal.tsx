'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Button, Checkbox } from '@/app/components/ui';
import type { DocumentCategory } from '@/app/lib/documents/types';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const CATEGORIES: { value: DocumentCategory; key: string }[] = [
  { value: 'passport', key: 'passport' },
  { value: 'drivers_license', key: 'drivers_license' },
  { value: 'national_id', key: 'national_id' },
  { value: 'sailing_license', key: 'sailing_license' },
  { value: 'certification', key: 'certification' },
  { value: 'insurance', key: 'insurance' },
  { value: 'boat_registration', key: 'boat_registration' },
  { value: 'medical', key: 'medical' },
  { value: 'other', key: 'other' },
];

export function DocumentUploadModal({ isOpen, onClose, onUploadComplete }: DocumentUploadModalProps) {
  const t = useTranslations('vault');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [autoClassify, setAutoClassify] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = files[0];

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selected.type)) {
      setError('Invalid file type. Allowed: PDF, JPG, PNG, WEBP.');
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum 10MB.');
      return;
    }

    setError(null);
    setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (description) formData.append('description', description);
      if (category) formData.append('category', category);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const { document: uploadedDoc } = await response.json();

      // Auto-classify if enabled
      if (autoClassify && uploadedDoc?.id) {
        setUploading(false);
        setClassifying(true);
        try {
          await fetch(`/api/documents/${uploadedDoc.id}/classify`, { method: 'POST' });
        } catch {
          // Classification failure is non-critical
        }
        setClassifying(false);
      }

      // Reset form and close
      setFile(null);
      setDescription('');
      setCategory('');
      onUploadComplete();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setClassifying(false);
    }
  };

  const resetAndClose = () => {
    setFile(null);
    setDescription('');
    setCategory('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={t('upload.title')}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            onClick={resetAndClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const formEvent = new Event('submit', { bubbles: true }) as any;
              handleSubmit(formEvent);
            }}
            disabled={!file || uploading || classifying}
            className="flex-1"
          >
            {classifying ? t('classifying') : uploading ? t('uploading') : t('upload.submit')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {/* Dropzone */}
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 hover:bg-accent'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">{t('upload.dropzone')}</p>
              <p className="text-xs text-muted-foreground">{t('upload.allowedTypes')}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-8 h-8 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setFile(null)}
              variant="ghost"
              size="sm"
              className="!p-1.5 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('upload.descriptionLabel')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('upload.descriptionPlaceholder')}
            rows={2}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('upload.categoryLabel')}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[44px]"
          >
            <option value="">{t('upload.categoryPlaceholder')}</option>
            {CATEGORIES.map(({ value, key }) => (
              <option key={value} value={value}>
                {t(`categories.${key}` as any)}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-classify toggle */}
        <Checkbox
          checked={autoClassify}
          onChange={(e) => setAutoClassify(e.target.checked)}
          label={t('upload.autoClassify')}
        />
      </form>
    </Modal>
  );
}
