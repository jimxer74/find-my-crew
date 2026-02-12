'use client';

import React from 'react';
import { Footer } from '@/app/components/Footer';
import { OwnerChatProvider, useOwnerChat } from '@/app/contexts/OwnerChatContext';
import { OwnerOnboardingSteps } from '@/app/components/onboarding/OnboardingSteps';
import { OnboardingStickyBar } from '@/app/components/onboarding/OnboardingStickyBar';
import OwnerChat from '@/app/components/owner/OwnerChat';

/**
 * Owner onboarding layout: sticky steps bar + chat
 */
function OwnerOnboardingContent() {
  const {
    isAuthenticated,
    hasExistingProfile,
    hasBoat,
    hasJourney,
    onboardingState,
    preferences,
    clearSession,
    isLoading,
    messages,
  } = useOwnerChat();

  const handleStartFresh = () => {
    if (window.confirm('Start a new conversation? Your current chat history will be cleared.')) {
      clearSession();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
        />
      </OnboardingStickyBar>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto pt-14">
        <OwnerChat />
      </main>

      <Footer />
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
