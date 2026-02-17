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
    canAccess: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchDocumentInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, try to get access via the view endpoint (which checks grants)
        // This returns a signed URL and validates access permissions
        const viewResponse = await fetch(`/api/documents/${documentId}/view`);
        
        if (viewResponse.ok) {
          // User has access via grant or ownership
          // Now fetch the document metadata
          const metadataResponse = await fetch(`/api/documents/${documentId}`);
          
          if (metadataResponse.ok) {
            const data = await metadataResponse.json();
            setDocumentInfo({
              id: data.document.id,
              file_name: data.document.file_name,
              file_type: data.document.file_type,
              canAccess: true,
            });
          } else if (metadataResponse.status === 404) {
            // User has access via grant, so fetch metadata another way
            // For now, just set minimal info based on ID
            setDocumentInfo({
              id: documentId,
              file_name: 'Document',
              file_type: 'unknown',
              canAccess: true,
            });
          } else {
            const data = await metadataResponse.json();
            throw new Error(data.error || 'Failed to load document');
          }
        } else if (viewResponse.status === 403) {
          throw new Error('You do not have permission to access this document. Ask the document owner to grant you access.');
        } else if (viewResponse.status === 401) {
          throw new Error('Please log in to view this document');
        } else {
          const data = await viewResponse.json();
          throw new Error(data.error || 'Failed to load document');
        }
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
        onClose={() => { console.log("Close triggered"); window.history.back(); setTimeout(() => window.location.href = "/owner/registrations", 100); }}
        documentId={documentInfo.id}
        documentName={documentInfo.file_name}
        fileType={documentInfo.file_type}
      />
    </>
  );
}
