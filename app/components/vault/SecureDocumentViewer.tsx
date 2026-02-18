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

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '64px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          width: '95vw',
          maxWidth: '1200px',
          height: '85vh',
          maxHeight: 'calc(100vh - 150px)'
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={handleContextMenu}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {documentName}
            </h2>
            {timeRemaining > 0 && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                backgroundColor: timeRemaining < 60 ? '#fee2e2' : '#f0f9ff',
                color: timeRemaining < 60 ? '#dc2626' : '#0284c7',
                whiteSpace: 'nowrap'
              }}>
                {t('expiresIn')}: {formatTime(timeRemaining)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflow: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}>
          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '2px solid #3b82f6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#dc2626', marginBottom: '0.5rem' }}>{error}</p>
              <button
                onClick={fetchSignedUrl}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#fff',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                {t('refreshLink')}
              </button>
            </div>
          )}

          {isExpired && !error && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#6b7280', marginBottom: '0.5rem' }}>{t('expired')}</p>
              <button
                onClick={fetchSignedUrl}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#fff',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                {t('refreshLink')}
              </button>
            </div>
          )}

          {signedUrl && !loading && (
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%'
            }}>
              {/* Watermark overlay */}
              {viewerName && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.1
                }}>
                  <div style={{
                    transform: 'rotate(-30deg)',
                    fontSize: '2.25rem',
                    fontWeight: 'bold',
                    color: '#000',
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                  }}>
                    {t('watermark')} - {viewerName}
                  </div>
                </div>
              )}

              {isImage ? (
                <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f8fafc', // optional: light background
                  overflow: 'hidden',    // safety
                }}
              >
                <img
                  src={signedUrl}
                  alt={documentName}
                  draggable={false}
                  style={{
                    pointerEvents: 'none',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                  }}
                />
                </div>
              ) : (
                <iframe
                  src={signedUrl}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    margin: 0,
                    padding: 0
                  }}
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
      </div>
    </div>
  );
}
