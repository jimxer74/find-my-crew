'use client';

import { useRouter } from 'next/navigation';
import { FiltersPageContent } from '@/app/components/FiltersDialog';

export default function FiltersPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden flex items-center px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">Filters</h1>
      </div>
      <main className="flex-1 overflow-y-auto">
        <FiltersPageContent onClose={() => router.back()} />
      </main>
    </div>
  );
}
