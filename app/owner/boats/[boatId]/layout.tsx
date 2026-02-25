'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { BoatDetailNav } from '@boat-management/components/dashboard';

interface BoatDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ boatId: string }>;
}

interface BoatInfo {
  id: string;
  name: string;
  make_model: string | null;
  type: string | null;
  home_port: string | null;
  owner_id: string;
  images: string[];
}

export default function BoatDetailLayout({ children, params }: BoatDetailLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [boat, setBoat] = useState<BoatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [boatId, setBoatId] = useState<string>('');

  // Resolve params
  useEffect(() => {
    params.then(p => setBoatId(p.boatId));
  }, [params]);

  const loadBoat = useCallback(async () => {
    if (!boatId || !user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('boats')
      .select('id, name, make_model, type, home_port, owner_id, images')
      .eq('id', boatId)
      .single();

    if (error || !data) {
      logger.error('Failed to load boat', { boatId, error: error?.message });
      router.push('/owner/boats');
      return;
    }

    setBoat(data as BoatInfo);
    setLoading(false);
  }, [boatId, user?.id, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (boatId && user) {
      loadBoat();
    }
  }, [user, authLoading, boatId, loadBoat, router]);

  if (authLoading || loading || !boat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isOwner = user?.id === boat.owner_id;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Back link */}
        <Link
          href="/owner/boats"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Boats
        </Link>

        {/* Boat header */}
        <div className="flex items-start gap-4 mb-6">
          {boat.images && boat.images.length > 0 ? (
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden">
              <Image
                src={boat.images[0]}
                alt={boat.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-lg font-medium">
                {boat.name?.slice(0, 2).toUpperCase() || '?'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{boat.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              {boat.make_model && <span>{boat.make_model}</span>}
              {boat.type && <span>{boat.type}</span>}
              {boat.home_port && <span>{boat.home_port}</span>}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <BoatDetailNav boatId={boat.id} />

        {/* Page content - pass boat context via data attributes for child pages to read */}
        <div data-boat-id={boat.id} data-is-owner={isOwner}>
          {children}
        </div>
      </main>
    </div>
  );
}
