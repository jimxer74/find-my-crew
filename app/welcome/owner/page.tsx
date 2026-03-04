'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Footer } from '@/app/components/Footer';
import { OwnerChatProvider, useOwnerChat } from '@/app/contexts/OwnerChatContext';
import { OwnerOnboardingSteps } from '@shared/components/onboarding/OnboardingSteps';
import { OnboardingStickyBar } from '@shared/components/onboarding/OnboardingStickyBar';
import OwnerChat from '@shared/components/owner/OwnerChat';
import { ConsentSetupModal } from '@shared/components/auth';
import { useConsentSetup } from '@shared/contexts';
import { useAuth } from '@/app/contexts/AuthContext';

/**
 * Owner onboarding layout: sticky steps bar + chat
 */
function OwnerOnboardingContent() {
  const router = useRouter();
  const {
    isAuthenticated,
    hasExistingProfile,
    hasBoat,
    hasJourney,
    onboardingState,
    clearSession,
    isLoading,
    messages,
  } = useOwnerChat();
  const { user } = useAuth();
  const { needsConsentSetup, isLoading: consentLoading } = useConsentSetup();
  const [consentDone, setConsentDone] = useState(false);

  const handleStartFresh = async () => {
    if (window.confirm('Start a new conversation? Your current chat history will be cleared.')) {
      await clearSession();
      router.push('/');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background image */}
      <div className="fixed inset-0 bg-cover bg-center -z-20" style={{ backgroundImage: 'url(/background-skipper2.jpg)' }} />
      {/* Amber overlay */}
      <div className="fixed inset-0 bg-amber-900/60 backdrop-blur-[2px] -z-10" />

      <OnboardingStickyBar
        title="Owner Onboarding Assistant"
        onStartFresh={handleStartFresh}
        isLoading={isLoading}
      >
        <OwnerOnboardingSteps
          isAuthenticated={isAuthenticated}
          hasExistingProfile={hasExistingProfile}
          hasBoat={hasBoat}
          hasJourney={hasJourney}
          onboardingState={onboardingState}
          messagesLength={messages.length}
          hasActiveSession={messages.length > 0}
          showNumbersOnly={true}
        />
      </OnboardingStickyBar>

      {/* Chat area - padding clears the sticky onboarding bar */}
      <main className="flex-1 overflow-y-auto pt-20">
        <OwnerChat />
      </main>

      <Footer />

      {/* Consent modal — shown after signup if consent has not been set up */}
      {user && !consentLoading && needsConsentSetup && !consentDone && (
        <ConsentSetupModal
          userId={user.id}
          onComplete={() => setConsentDone(true)}
        />
      )}
    </div>
  );
}

/**
 * Owner AI Chat Page
 *
 * A chat interface for owner onboarding (profile, boat, journey creation).
 * App header (from layout) provides profile menu, etc.
 */
export default function OwnerChatPage() {
  return (
    <OwnerChatProvider>
      <OwnerOnboardingContent />
    </OwnerChatProvider>
  );
}
