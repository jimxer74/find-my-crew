'use client';

import { Header } from '@/app/components/Header';
import { BrowseJourneys } from '@/app/components/browse/BrowseJourneys';

export default function JourneysBrowsePage() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 relative min-h-0">
        <BrowseJourneys />
      </main>
    </div>
  );
}
