'use client';

import { useRouter } from 'next/navigation';
import { NavigationMenuContent } from '@/app/components/NavigationMenu';

export default function MenuPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden flex items-center px-4 py-3 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground">Menu</h1>
      </div>
      <main className="flex-1 overflow-y-auto">
        <NavigationMenuContent onClose={() => router.back()} />
      </main>
    </div>
  );
}
