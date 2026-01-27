'use client';

import { useRouter } from 'next/navigation';
import { Header } from '@/app/components/Header';
import { FiltersPageContent } from '@/app/components/FiltersDialog';

export default function FiltersPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* Mobile header with back button */}
      <div className="md:hidden flex items-center px-4 py-3 border-b border-border bg-card">
        <button
          onClick={() => router.back()}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-accent transition-colors mr-3"
          aria-label="Back"
        >
          <svg
            className="w-6 h-6 text-foreground"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-foreground">Filters</h1>
      </div>
      <main className="flex-1 overflow-y-auto">
        <FiltersPageContent onClose={() => router.back()} />
      </main>
    </div>
  );
}
