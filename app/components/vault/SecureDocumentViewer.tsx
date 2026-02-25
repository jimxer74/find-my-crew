'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@shared/ui/Modal/Modal';
import { Button } from '@shared/ui/Button/Button';

interface SecureDocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  fileType: string;
  viewerName?: string;
}

export function SecureDocumentViewer({
  isOpen,
  onClose,
  documentId,
  documentName,
  fileType,
  viewerName,
}: SecureDocumentViewerProps) {
  const t = useTranslations('vault.viewer');
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const fetchSignedUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/view`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load document');
      }
      const data = await response.json();
      setSignedUrl(data.signedUrl);
      setExpiresIn(data.expiresIn);
      setTimeRemaining(data.expiresIn);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Fetch signed URL when opening
  useEffect(() => {
    if (isOpen && documentId) {
      fetchSignedUrl();
    }
    return () => {
      setSignedUrl(null);
      setTimeRemaining(0);
    };
  }, [isOpen, documentId, fetchSignedUrl]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setSignedUrl(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeRemaining]);

  // Prevent right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isImage = fileType.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(documentName);
  const isExpired = timeRemaining <= 0 && signedUrl === null && !loading;

  const headerContent = (
    <div className="flex items-center gap-3">
      <h2 className="text-lg font-semibold truncate">
        {documentName}
      </h2>
      {timeRemaining > 0 && (
        <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
          timeRemaining < 60 ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'
        }`}>
          {t('expiresIn')}: {formatTime(timeRemaining)}
        </span>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={headerContent}
      size="xl"
      showCloseButton
      closeOnBackdropClick
      closeOnEscape
      className="!max-w-5xl !max-h-[85vh]"
      onContextMenu={handleContextMenu}
    >

      <div className="relative flex items-center justify-center w-full h-full select-none overflow-auto">
        {loading && (
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-destructive mb-2">{error}</p>
            <Button
              onClick={fetchSignedUrl}
              variant="primary"
              size="sm"
            >
              {t('refreshLink')}
            </Button>
          </div>
        )}

        {isExpired && !error && (
          <div className="text-center">
            <p className="text-muted-foreground mb-2">{t('expired')}</p>
            <Button
              onClick={fetchSignedUrl}
              variant="primary"
              size="sm"
            >
              {t('refreshLink')}
            </Button>
          </div>
        )}

        {signedUrl && !loading && (
          <div className="relative flex items-center justify-center w-full h-full">
            {/* Watermark overlay */}
            {viewerName && (
              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-10">
                <div className="transform -rotate-30 text-4xl font-bold text-black whitespace-nowrap select-none">
                  {t('watermark')} - {viewerName}
                </div>
              </div>
            )}

            {isImage ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 overflow-hidden">
                <img
                  src={signedUrl}
                  alt={documentName}
                  draggable={false}
                  className="pointer-events-none max-w-full max-h-full w-auto h-auto object-contain"
                />
              </div>
            ) : (
              <iframe
                src={signedUrl}
                className="w-full h-full border-none"
                title={documentName}
                sandbox="allow-same-origin allow-scripts"
                scrolling="yes"
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  );
}
