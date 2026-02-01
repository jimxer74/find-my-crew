'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { BoatFormModal } from '@/app/components/manage/BoatFormModal';
import { NewBoatWizard } from '@/app/components/manage/NewBoatWizard';
import { FeatureGate } from '@/app/components/auth/FeatureGate';
import { checkProfile } from '@/app/lib/profile/checkProfile';
import { Footer } from '@/app/components/Footer';

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      checkOwnerRole();
      loadBoats();
    }
  }, [user, authLoading, router]);

  const checkOwnerRole = async () => {
    if (!user) {
      setHasOwnerRole(false);
      return;
    }
    const status = await checkProfile(user.id);
    setHasOwnerRole(status.exists && status.roles.includes('owner'));
  };

  const loadBoats = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('boats')
      .select('*')
      .eq('owner_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading boats:', error);
    } else {
      setBoats(data || []);
    }
    setLoading(false);
  };

  if (authLoading || loading || hasOwnerRole === null) {
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

              <div className="mb-4 sm:mb-6">
                <button
                  onClick={() => setIsWizardOpen(true)}
                  className="bg-primary text-primary-foreground px-4 sm:px-6 py-2 sm:py-3 min-h-[44px] rounded-lg transition-opacity font-medium inline-flex items-center justify-center hover:opacity-90"
                >
                  {t('addNew')}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {boats.length === 0 ? (
                  <div className="bg-card rounded-lg shadow p-6 sm:p-8 text-center">
                    <p className="text-muted-foreground mb-4 text-sm sm:text-base">{t('noBoatsYet')}</p>
                    <button
                      onClick={() => setIsWizardOpen(true)}
                      className="font-medium text-sm sm:text-base text-primary hover:opacity-80 min-h-[44px] inline-flex items-center justify-center"
                    >
                      {t('addFirstBoat')}
                    </button>
                  </div>
                ) : (
                  boats.map((boat) => (
                    <div key={boat.id} className="bg-card rounded-lg shadow-md p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Boat Image */}
                        {boat.images && boat.images.length > 0 && (
                          <div className="flex-shrink-0 w-full sm:w-32">
                            <Image
                              src={boat.images[0]}
                              alt={boat.name}
                              width={128}
                              height={128}
                              className="w-full sm:w-32 h-32 object-cover rounded-lg border border-border"
                              unoptimized
                            />
                          </div>
                        )}

                        {/* Boat Details */}
                        <div className="flex-1 min-h-[128px] sm:h-32 flex flex-col justify-between">
                          <div>
                            <h3 className="text-lg sm:text-xl font-semibold text-card-foreground mb-2">{boat.name}</h3>
                            <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                              <p>{boat.type}</p>
                              {boat.make && <p>{boat.make} {boat.model}</p>}
                              {boat.home_port && <p>{t('homePort')}: {boat.home_port}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                        <button
                          onClick={() => {
                            setEditingBoatId(boat.id);
                            setIsModalOpen(true);
                          }}
                          className="font-medium text-sm text-primary hover:opacity-80 min-h-[44px] px-2 py-2 sm:py-0"
                        >
                          {t('editBoat')}
                        </button>
                        <span className="hidden sm:inline text-border">|</span>
                        <Link
                          href={`/owner/boats/${boat.id}/journeys`}
                          className="font-medium text-sm text-primary hover:opacity-80 min-h-[44px] flex items-center px-2 py-2 sm:py-0"
                        >
                          {t('viewJourneys')}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </main>
            <Footer />
          </>
        )}
      </div>
    </FeatureGate>
  );
}

