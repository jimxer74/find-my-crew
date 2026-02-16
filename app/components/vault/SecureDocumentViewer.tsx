'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';

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
      setError(err instanceof Error ? err.message : 'Failed to load document');
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

  const isImage = fileType.startsWith('image/');
  const isExpired = timeRemaining <= 0 && signedUrl === null && !loading;

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={handleContextMenu}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">{documentName}</h2>
            {timeRemaining > 0 && (
              <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                timeRemaining < 60
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {t('expiresIn')}: {formatTime(timeRemaining)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-accent rounded-md transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto relative" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-destructive mb-2">{error}</p>
                <button
                  onClick={fetchSignedUrl}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90"
                >
                  {t('refreshLink')}
                </button>
              </div>
            </div>
          )}

          {isExpired && !error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">{t('expired')}</p>
                <button
                  onClick={fetchSignedUrl}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90"
                >
                  {t('refreshLink')}
                </button>
              </div>
            </div>
          )}

          {signedUrl && !loading && (
            <div className="relative">
              {/* Watermark overlay */}
              {viewerName && (
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-10">
                  <div className="rotate-[-30deg] text-4xl font-bold text-foreground whitespace-nowrap select-none">
                    {t('watermark')} - {viewerName}
                  </div>
                </div>
              )}

              {isImage ? (
                <img
                  src={signedUrl}
                  alt={documentName}
                  className="max-w-full h-auto mx-auto"
                  draggable={false}
                  style={{ pointerEvents: 'none' }}
                />
              ) : (
                <iframe
                  src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-[70vh]"
                  title={documentName}
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
