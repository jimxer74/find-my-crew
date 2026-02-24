'use client';

import { useTranslations } from 'next-intl';
import { Card, Button } from '@/app/components/ui';
import type { DocumentVault, DocumentCategory } from '@/app/lib/documents/types';

interface DocumentCardProps {
  document: DocumentVault;
  onView: (doc: DocumentVault) => void;
  onDelete: (doc: DocumentVault) => void;
  onManageAccess: (doc: DocumentVault) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  passport: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  drivers_license: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0',
  national_id: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0',
  sailing_license: 'M13 10V3L4 14h7v7l9-11h-7z',
  certification: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  insurance: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  boat_registration: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  medical: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  other: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
};

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentCard({ document: doc, onView, onDelete, onManageAccess }: DocumentCardProps) {
  const t = useTranslations('vault');

  const categoryKey = doc.category || 'other';
  const iconPath = CATEGORY_ICONS[categoryKey] || CATEGORY_ICONS.other;
  const categoryLabel = doc.category
    ? t(`categories.${doc.category}` as any)
    : t('categories.other');
  const fileTypeLabel = FILE_TYPE_LABELS[doc.file_type] || doc.file_type.split('/')[1]?.toUpperCase() || '';

  const expiryDate = doc.metadata?.expiry_date;
  const isExpiringSoon = expiryDate && new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = expiryDate && new Date(expiryDate) < new Date();

  return (
    <Card className="hover:shadow-md transition-shadow">
      {/* Top section with icon and file type badge */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-foreground truncate" title={doc.file_name}>
                {doc.file_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {categoryLabel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fileTypeLabel}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {doc.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doc.description}</p>
        )}

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {doc.metadata?.holder_name && (
            <span className="text-xs text-muted-foreground">{doc.metadata.holder_name}</span>
          )}
          {expiryDate && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isExpired
                ? 'bg-destructive/10 text-destructive'
                : isExpiringSoon
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'bg-secondary text-secondary-foreground'
            }`}>
              {t('expiresOn')}: {new Date(expiryDate).toLocaleDateString()}
            </span>
          )}
          {doc.classification_confidence !== null && (
            <span className="text-xs text-muted-foreground">
              {t('confidence')}: {Math.round(doc.classification_confidence * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex border-t border-border divide-x divide-border">
        <Button
          onClick={() => onView(doc)}
          variant="ghost"
          className="!flex-1 !flex !items-center !justify-center !gap-1.5 !px-3 !py-2.5 !min-h-[44px] !text-xs !rounded-none !h-auto"
          leftIcon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        >
          {t('viewDocument')}
        </Button>
        <Button
          onClick={() => onManageAccess(doc)}
          variant="ghost"
          className="!flex-1 !flex !items-center !justify-center !gap-1.5 !px-3 !py-2.5 !min-h-[44px] !text-xs !rounded-none !h-auto"
          leftIcon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        >
          {t('manageAccess')}
        </Button>
        <Button
          onClick={() => onDelete(doc)}
          variant="ghost"
          className="!flex-1 !flex !items-center !justify-center !gap-1.5 !px-3 !py-2.5 !min-h-[44px] !text-xs !rounded-none !h-auto !text-destructive hover:!bg-destructive/10"
          leftIcon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
        >
          {t('delete')}
        </Button>
      </div>
    </Card>
  );
}
