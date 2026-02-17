'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SecureDocumentViewer } from '@/app/components/vault/SecureDocumentViewer';

export default function DocumentViewPage() {
  const params = useParams();
  const documentId = params?.id as string;
  const [documentInfo, setDocumentInfo] = useState<{
    id: string;
    file_name: string;
    file_type: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchDocumentInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch document metadata
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load document');
        }

        const data = await response.json();
        setDocumentInfo({
          id: data.document.id,
          file_name: data.document.file_name,
          file_type: data.document.file_type,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentInfo();
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !documentInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || 'Document not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Use SecureDocumentViewer in modal mode */}
      <SecureDocumentViewer
        isOpen={true}
        onClose={() => window.history.back()}
        documentId={documentInfo.id}
        documentName={documentInfo.file_name}
        fileType={documentInfo.file_type}
      />
    </>
  );
}
