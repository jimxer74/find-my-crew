'use client';

import { logger } from '@shared/logging';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { BoatFormModal } from '@/app/components/manage/BoatFormModal';
import { NewBoatWizard } from '@/app/components/manage/NewBoatWizard';
import { FeatureGate } from '@shared/components/auth/FeatureGate';
import { Footer } from '@/app/components/Footer';
import { useProfile } from '@shared/lib/profile/useProfile';
import { checkProfile } from '@shared/lib/profile/checkProfile';
import { getSupabaseBrowserClient } from '@shared/database/client';

export default function BoatsPage() {
  const t = useTranslations('boats');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [boats, setBoats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null);
  const [hasOwnerRole, setHasOwnerRole] = useState<boolean | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  const loadBoats = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('boats')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (error) logger.error('Error loading boats:', { errorCode: error.code, errorMessage: error.message });
    else setBoats(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      let cancelled = false;
      setLoading(true);
      const timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setLoadingTimeout(true);
        setLoading(false);
        setHasOwnerRole((prev) => (prev === null ? false : prev));
      }, 8000);

      Promise.all([
        checkProfile(user.id)
          .then((status) => {
            if (!cancelled) setHasOwnerRole(status.exists && status.roles.includes('owner'));
          })
          .catch((error) => {
            logger.error('Error checking profile:', { error: error instanceof Error ? error.message : String(error) });
            if (!cancelled) setHasOwnerRole(false);
          }),
        loadBoats(),
      ]).finally(() => {
        if (!cancelled) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      });

      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }
  }, [user, authLoading, router, loadBoats]);

  if (!loadingTimeout && (authLoading || loading || hasOwnerRole === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <FeatureGate feature="create_boat">
      <div className="min-h-screen bg-background">

        {/* Conditionally render wizard, boat form, or boats list */}
        {isWizardOpen && user ? (
          <NewBoatWizard
            isOpen={isWizardOpen}
            onClose={() => setIsWizardOpen(false)}
            onSuccess={() => {
              loadBoats();
            }}
            userId={user.id}
          />
        ) : isModalOpen && user ? (
          <BoatFormModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingBoatId(null);
            }}
            onSuccess={() => {
              loadBoats();
            }}
            boatId={editingBoatId}
            userId={user.id}
          />
        ) : (
          <>
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
  <div className="mb-6 sm:mb-8">
    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
    <p className="text-sm sm:text-base text-muted-foreground">{t('subtitle')}</p>
  </div>

  <div className="mb-6 sm:mb-8">
    <button
      onClick={() => setIsWizardOpen(true)}
      className="bg-primary text-primary-foreground px-5 sm:px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity min-h-[44px] inline-flex items-center justify-center"
    >
      {t('addNew')}
    </button>
  </div>

  {boats.length === 0 ? (
    <div className="bg-card rounded-lg shadow p-6 sm:p-8 text-center">
      <p className="text-muted-foreground mb-4 text-sm sm:text-base">{t('noBoatsYet')}</p>
      <button
        onClick={() => setIsWizardOpen(true)}
        className="text-primary hover:text-primary/90 font-medium text-sm sm:text-base"
      >
        {t('addFirstBoat')}
      </button>
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
      {boats.map((boat) => (
        <div
          key={boat.id}
          className="bg-card rounded-lg shadow-md overflow-hidden flex flex-col h-full min-h-[180px]"
        >
          <div className="flex flex-row flex-1">
            {/* Image – always on left */}
            {boat.images && boat.images.length > 0 ? (
              <div className="flex-shrink-0 w-32 sm:w-36 md:w-40">
                <Image
                  src={boat.images[0]}
                  alt={boat.name}
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex-shrink-0 w-32 sm:w-36 md:w-40 bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-xl font-medium">
                  {boat.name?.slice(0, 2).toUpperCase() || '?'}
                </span>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 flex flex-col p-4 sm:p-5">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-card-foreground mb-1.5 line-clamp-1">
                  {boat.name}
                </h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="line-clamp-1">{boat.type}</p>
                  {boat.make_model && (
                    <p className="line-clamp-1">
                      {boat.make_model}
                    </p>
                  )}
                  {boat.home_port && (
                    <p className="line-clamp-1">
                      {t('homePort')}: {boat.home_port}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions – bottom */}
              <div className="pt-3 mt-auto border-t border-border flex items-center justify-between">
                <Link
                  href={`/owner/boats/${boat.id}`}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-4.655 4.655a2.121 2.121 0 01-3-3l4.655-4.655m3-3l1.586-1.586a2 2 0 012.828 0L19.8 9.98a2 2 0 010 2.828l-1.586 1.586m-3-3l3 3" />
                  </svg>
                  <span>Manage</span>
                </Link>
                <button
                  onClick={() => {
                    setEditingBoatId(boat.id);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  title="Edit boat"
                  aria-label="Edit boat"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <span>{t('edit')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</main>
            <Footer />
          </>
        )}
      </div>
    </FeatureGate>
  );
}

