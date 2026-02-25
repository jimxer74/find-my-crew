'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@shared/logging';
import { Footer } from '@/app/components/Footer';
import { ProspectChatProvider, useProspectChat } from '@/app/contexts/ProspectChatContext';
import { CrewOnboardingSteps } from '@shared/components/onboarding/OnboardingSteps';
import { OnboardingStickyBar } from '@shared/components/onboarding/OnboardingStickyBar';
import { ProspectChat } from '@shared/components/prospect/ProspectChat';
import { ProfileExtractionModal } from '@shared/components/prospect/ProfileExtractionModal';

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
    userMessageCountAfterSignup,
  } = useProspectChat();
  const [isNavigatingToJourneys, setIsNavigatingToJourneys] = useState(false);
  const [showProfileExtractionModal, setShowProfileExtractionModal] = useState(false);

  // Determine when to show Exit Assistant button (same logic as in ProspectChat)
  const showExitAssistant = isAuthenticated && !hasExistingProfile && typeof userMessageCountAfterSignup === 'number' && userMessageCountAfterSignup >= 3;

  const handleStartFresh = async () => {
    if (window.confirm('Start a new conversation? Your current chat history will be cleared.')) {
      await clearSession();
      router.push('/');
    }
  };

  const handleViewJourneys = async () => {
    setIsNavigatingToJourneys(true);
    try {
      await clearSession();
      router.push('/crew');
    } catch (e) {
      logger.error('Failed to navigate to journeys:', e instanceof Error ? { error: e.message } : { error: String(e) });
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
        showExitAssistant={showExitAssistant}
        onExitAssistant={() => setShowProfileExtractionModal(true)}
      >
        <CrewOnboardingSteps
          isAuthenticated={isAuthenticated}
          hasExistingProfile={hasExistingProfile}
          onboardingState={onboardingState}
          messagesLength={messages.length}
          hasActiveSession={messages.length > 0}
          showNumbersOnly={true}
        />
      </OnboardingStickyBar>

      {/* Chat area - padding clears the sticky onboarding bar */}
      <main className="flex-1 overflow-y-auto pt-20">
        <ProspectChat />
      </main>

      <Footer />

      {/* Profile Extraction Modal */}
      <ProfileExtractionModal
        isOpen={showProfileExtractionModal}
        onClose={() => setShowProfileExtractionModal(false)}
        messages={messages}
        onSuccess={() => {
          setShowProfileExtractionModal(false);
          // Profile extraction will trigger the completion flow
        }}
      />
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
