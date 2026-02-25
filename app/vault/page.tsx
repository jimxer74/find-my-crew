'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { Footer } from '@/app/components/Footer';
import { DocumentCard } from '@shared/components/vault/DocumentCard';
import { DocumentUploadModal } from '@shared/components/vault/DocumentUploadModal';
import { SecureDocumentViewer } from '@shared/components/vault/SecureDocumentViewer';
import { GrantManagementModal } from '@shared/components/vault/GrantManagementModal';
import type { DocumentVault, DocumentCategory } from '@shared/lib/documents/types';

const CATEGORY_FILTERS: (DocumentCategory | 'all')[] = [
  'all',
  'passport',
  'drivers_license',
  'national_id',
  'sailing_license',
  'certification',
  'insurance',
  'boat_registration',
  'medical',
  'other',
];

export default function VaultPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('vault');
  const tCommon = useTranslations('common');

  const [documents, setDocuments] = useState<DocumentVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentVault | null>(null);
  const [grantDoc, setGrantDoc] = useState<DocumentVault | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (search) params.set('search', search);
      params.set('limit', '50');

      const response = await fetch(`/api/documents?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        setTotal(data.total || 0);
      } else {
        setError('Failed to load documents');
      }
    } catch {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [user, categoryFilter, search]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => fetchDocuments(), 300));
  };

  // Delete handler
  const handleDelete = async (doc: DocumentVault) => {
    if (!confirm(t('deleteConfirm'))) return;

    try {
      const response = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      if (response.ok) {
        setSuccess(t('deleteSuccess'));
        fetchDocuments();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Delete failed');
      }
    } catch {
      setError('Delete failed');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">{tCommon('loading')}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('uploadDocument')}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search input */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 min-h-[44px] border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors min-h-[32px] ${
                categoryFilter === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {cat === 'all' ? t('allCategories') : t(`categories.${cat}` as any)}
            </button>
          ))}
        </div>

        {/* Document grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">{t('noDocuments')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t('noDocumentsDescription')}</p>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="mt-4 px-4 py-2 min-h-[44px] text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 transition-opacity"
            >
              {t('uploadDocument')}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {total} document{total !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={setViewerDoc}
                  onDelete={handleDelete}
                  onManageAccess={setGrantDoc}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <Footer />

      {/* Modals */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadComplete={() => {
          setSuccess(t('uploadSuccess'));
          fetchDocuments();
          setTimeout(() => setSuccess(null), 3000);
        }}
      />

      {viewerDoc && (
        <SecureDocumentViewer
          isOpen={!!viewerDoc}
          onClose={() => setViewerDoc(null)}
          documentId={viewerDoc.id}
          documentName={viewerDoc.file_name}
          fileType={viewerDoc.file_type}
        />
      )}

      {grantDoc && (
        <GrantManagementModal
          isOpen={!!grantDoc}
          onClose={() => setGrantDoc(null)}
          documentId={grantDoc.id}
          documentName={grantDoc.file_name}
        />
      )}
    </div>
  );
}
