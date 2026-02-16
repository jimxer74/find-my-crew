'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Footer } from '@/app/components/Footer';
import { ProspectChatProvider, useProspectChat } from '@/app/contexts/ProspectChatContext';
import { CrewOnboardingSteps } from '@/app/components/onboarding/OnboardingSteps';
import { OnboardingStickyBar } from '@/app/components/onboarding/OnboardingStickyBar';
import { ProspectChat } from '@/app/components/prospect/ProspectChat';

/**
 * Crew onboarding layout: sticky steps bar + chat
 */
function CrewOnboardingContent() {
  const router = useRouter();
  const {
    isAuthenticated,
    hasExistingProfile,
    onboardingState,
    clearSession,
    isLoading,
    messages,
  } = useProspectChat();
  const [isNavigatingToJourneys, setIsNavigatingToJourneys] = useState(false);

  const handleStartFresh = () => {
    if (window.confirm('Start a new conversation? Your current chat history will be cleared.')) {
      clearSession();
    }
  };

  const handleViewJourneys = async () => {
    setIsNavigatingToJourneys(true);
    try {
      await clearSession();
      router.push('/crew');
    } catch (e) {
      console.error('Failed to navigate to journeys:', e);
      setIsNavigatingToJourneys(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OnboardingStickyBar
        title="Crew Onboarding Assistant"
        onStartFresh={handleStartFresh}
        isLoading={isLoading}
        showViewJourneys={hasExistingProfile && isAuthenticated}
        onViewJourneys={handleViewJourneys}
        isNavigatingToJourneys={isNavigatingToJourneys}
      >
        <CrewOnboardingSteps
          isAuthenticated={isAuthenticated}
          hasExistingProfile={hasExistingProfile}
          onboardingState={onboardingState}
          messagesLength={messages.length}
          hasActiveSession={messages.length > 0}
        />
      </OnboardingStickyBar>

      {/* Chat area - padding clears the sticky onboarding bar */}
      <main className="flex-1 overflow-y-auto pt-28">
        <ProspectChat />
      </main>

      <Footer />
    </div>
  );
}

/**
 * Prospect AI Chat Page (Crew onboarding)
 *
 * A chat interface for crew to explore sailing opportunities before signing up.
 * App header (from layout) provides profile menu when logged in.
 */
export default function ProspectChatPage() {
  return (
    <ProspectChatProvider>
      <CrewOnboardingContent />
    </ProspectChatProvider>
  );
}
