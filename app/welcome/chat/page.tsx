'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Footer } from '@/app/components/Footer';
import { ProspectChatProvider } from '@/app/contexts/ProspectChatContext';
import { ProspectChat } from '@/app/components/prospect/ProspectChat';

/**
 * Prospect AI Chat Page
 *
 * A simplified chat interface for unauthenticated users to explore
 * sailing opportunities before signing up.
 */
export default function ProspectChatPage() {
  const t = useTranslations('common');

  return (
    <ProspectChatProvider>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Header bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 -ml-2 hover:bg-accent rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t('back')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <Image
                src="/sailsmart_new_logo_blue.png"
                alt="SailSmart"
                width={28}
                height={28}
                className="object-contain"
              />
              <span className="font-semibold text-foreground">SailSmart Onboarding Assistant</span>
            </div>
          </div>
        </header>

        {/* Chat area - takes remaining height */}
        <main className="flex-1 overflow-hidden">
          <ProspectChat />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </ProspectChatProvider>
  );
}
