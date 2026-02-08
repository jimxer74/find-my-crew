'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Footer } from '@/app/components/Footer';
import { LoginModal } from '@/app/components/LoginModal';
import { SignupModal } from '@/app/components/SignupModal';

export default function WelcomePage() {
  const t = useTranslations('welcome');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background image - shared across both columns */}
      <div
        className="fixed inset-0 bg-cover bg-center -z-20"
        style={{
          backgroundImage: 'url(/homepage-2.jpg)',
        }}
      />

      {/* Login button - fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsLoginModalOpen(true)}
          className="px-4 py-2 min-h-[44px] bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg hover:bg-white/30 transition-colors font-medium"
        >
          {t('login')}
        </button>
      </div>

      {/* Logo - top left on mobile, centered on desktop */}
      <div className="absolute top-4 left-4 md:top-8 md:left-1/2 md:-translate-x-1/2 z-50">
        <Link href="/">
          <Image
            src="/sailsmart_new_tp_dark.png"
            alt="SailSmart"
            width={140}
            height={140}
            className="object-contain drop-shadow-2xl w-[60px] h-[60px] md:w-[140px] md:h-[140px]"
          />
        </Link>
      </div>

      {/* Main content - dual column layout */}
      <main className="flex-1 flex flex-col md:flex-row min-h-screen">
        {/* Crew Column (Right on desktop, First on mobile) */}
        <div className="flex-1 relative order-1 md:order-2 min-h-[50vh] md:min-h-screen flex items-center justify-center p-6 md:p-12">
          {/* Blue overlay for crew side */}
          <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-[2px] -z-10" />

          <div className="max-w-md text-center text-white">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 drop-shadow-lg">
              {t('crew.title')}
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-4 drop-shadow-md">
              {t('crew.subtitle')}
            </p>

            <p className="text-sm md:text-base text-white/80 mb-8">
              {t('crew.description')}
            </p>

            <Link
              href="/welcome/chat"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[52px] bg-white text-blue-900 rounded-lg font-semibold text-lg hover:bg-white/90 transition-colors shadow-lg"
            >
              {t('crew.cta')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Owner Column (Left on desktop, Second on mobile) */}
        <div className="flex-1 relative order-2 md:order-1 min-h-[50vh] md:min-h-screen flex items-center justify-center p-6 md:p-12">
          {/* Warm/amber overlay for owner side */}
          <div className="absolute inset-0 bg-amber-900/50 backdrop-blur-[2px] -z-10" />

          <div className="max-w-md text-center text-white">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 drop-shadow-lg">
              {t('owner.title')}
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-4 drop-shadow-md">
              {t('owner.subtitle')}
            </p>

            <p className="text-sm md:text-base text-white/80 mb-8">
              {t('owner.description')}
            </p>

            <button
              disabled
              className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[52px] bg-white/30 text-white/70 rounded-lg font-semibold text-lg cursor-not-allowed border border-white/20"
            >
              {t('owner.cta')}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals */}
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
