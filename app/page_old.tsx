'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuth } from './contexts/AuthContext';
import { LoginModal } from './components/LoginModal';
import { SignupModal } from './components/SignupModal';
import { Footer } from './components/Footer';
import { getSupabaseBrowserClient } from './lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Home() {
  const t = useTranslations('home');
  const tNav = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const { user } = useAuth();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const loadUserRoles = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      return;
    }
    
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();
    
    if (data && data.roles) {
      setUserRoles(data.roles);
    } else {
      setUserRoles([]);
    }
  }, [user]);

  useEffect(() => {
    loadUserRoles();
  }, [loadUserRoles]);

  return (
    <div className="min-h-screen">
      {/* Background image with zoom effect */}
      <div 
        className="fixed inset-0 bg-cover bg-center homepage-bg-zoom -z-10"
        style={{
          backgroundImage: 'url(/homepage-2.jpg)',
        }}
      />
      {/* Overlay for better text readability */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] -z-10"></div>
      
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 md:py-14">
          <div className="text-center items-center justify-center flex flex-col">
          <Image
                src="/sailsmart_new_tp_dark.png"
                alt="SailSmart"
                width={220}
                height={220}
                className="object-contain drop-shadow-lg mb-4"
              />

            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 sm:mb-6 drop-shadow-lg px-2">
              {userRoles.includes('owner') ? t('hero.titleOwner') : t('hero.titleCrew')}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white/95 mb-6 sm:mb-8 max-w-2xl mx-auto drop-shadow-md px-2">
              {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2">
            {user ? (
              <>

                <Link
                  href={userRoles.includes('owner') ? '/owner/journeys' : '/crew'}
                  className="bg-primary text-primary-foreground px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
                >
                  {userRoles.includes('owner') ? t('hero.myJourneys') : t('hero.searchJourneys')}
                </Link>

                {user && (
                  <Link
                    href={userRoles.includes('owner') ? '/owner/registrations' : '/crew/registrations'  }
                    className="border border-primary text-primary px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-colors font-medium text-base sm:text-lg hover:bg-primary/10"
                  >
                    {userRoles.includes('owner') ? t('hero.myCrew') : t('hero.myRegistrations')}
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/crew"
                  className="border border-primary text-primary px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-colors font-medium text-base sm:text-lg hover:bg-primary/10"
                >
                  {t('hero.browseJourneys')}
                </Link>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-primary text-primary-foreground px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
                >
                  {t('hero.login')}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid md:grid-cols-2 gap-6 sm:gap-12 lg:gap-16">
          {/* For Owners */}
          <div className="bg-card/90 backdrop-blur-sm rounded-xl shadow-xl p-6 sm:p-8 border border-border/20">
            <div className="w-16 h-16 mb-4 relative">
              <Image
                src="/sailsmart_new_logo_blue.png"
                alt="Boat Owner"
                fill
                className="object-contain"
              />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-4">{t('forOwners.title')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('forOwners.description')}
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>{t('forOwners.feature1')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>{t('forOwners.feature2')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>{t('forOwners.feature3')}</span>
              </li>
            </ul>
          </div>

          {/* For Crew */}
          <div className="bg-card/90 backdrop-blur-sm rounded-xl shadow-xl p-6 sm:p-8 border border-border/20">
            <div className="w-16 h-16 mb-4 relative">
              <Image
                src="/sailor_transparent.png"
                alt="Crew Member"
                fill
                className="object-contain"
              />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-4">{t('forCrew.title')}</h3>
            <p className="text-muted-foreground mb-6">
              {t('forCrew.description')}
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>{t('forCrew.feature1')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>{t('forCrew.feature2')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>{t('forCrew.feature3')}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <h3 className="text-2xl sm:text-3xl font-bold text-center text-white mb-8 sm:mb-12 drop-shadow-lg px-2">{t('howItWorks.title')}</h3>
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <span className="text-2xl font-bold text-white">1</span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2 drop-shadow-md">{t('howItWorks.step1.title')}</h4>
            <p className="text-white/90 drop-shadow-sm">
              {t('howItWorks.step1.description')}
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <span className="text-2xl font-bold text-white">2</span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2 drop-shadow-md">{t('howItWorks.step2.title')}</h4>
            <p className="text-white/90 drop-shadow-sm">
              {t('howItWorks.step2.description')}
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <span className="text-2xl font-bold text-white">3</span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2 drop-shadow-md">{t('howItWorks.step3.title')}</h4>
            <p className="text-white/90 drop-shadow-sm">
              {t('howItWorks.step3.description')}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="rounded-2xl p-6 sm:p-12 text-center bg-primary/80">
          <h3 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3 sm:mb-4 px-2">
            {t('cta.title')}
          </h3>
          <p className="text-primary-foreground/90 mb-6 sm:mb-8 text-base sm:text-lg max-w-2xl mx-auto px-2">
            {userRoles.includes('owner') ? t('cta.descriptionOwner') : t('cta.descriptionCrew')}
          </p>
          {user ? (
            <Link
              href={userRoles.includes('owner') ? '/owner/journeys' : '/crew'}
              className="bg-card text-primary px-6 sm:px-8 py-3 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
            >
              {userRoles.includes('owner') ? t('hero.myJourneys') : t('hero.searchJourneys')}
            </Link>
          ) : (
            <button
              onClick={() => {
                // On mobile, navigate to signup page; on desktop, open modal
                  setIsSignupModalOpen(true);
              }}
              className="bg-card text-primary px-6 sm:px-8 py-3 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
            >
              {t('hero.signUp')}
            </button>
          )}
        </div>
      </section>

        {/* Footer */}
        <Footer />
      </div>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitchToSignup={() => {
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(true);
        }}
      />
      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSwitchToLogin={() => {
          setIsSignupModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </div>
  );
}
