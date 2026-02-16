'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFilters } from '@/app/contexts/FilterContext';
import { FiltersPageContent } from '@/app/components/FiltersDialog';

export default function FiltersPage() {
  const router = useRouter();
  const t = useTranslations('common');
  const { clearFilters } = useFilters();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">{t('search')}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const event = new CustomEvent('restoreProfileFilters');
              window.dispatchEvent(event);
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Use profile settings"
          >
            Use profile settings
          </button>
          <button
            onClick={clearFilters}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('clearAll')}
          >
            {t('clearAll')}
          </button>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">
        <FiltersPageContent onClose={() => router.back()} />
      </main>
    </div>
  );
}
