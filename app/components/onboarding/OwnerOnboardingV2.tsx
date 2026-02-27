'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { OnboardingChat } from './OnboardingChat';
import { ProfileCheckpoint } from './ProfileCheckpoint';
import { BoatCheckpoint } from './BoatCheckpoint';
import { EquipmentCheckpoint } from './EquipmentCheckpoint';
import { JourneyCheckpoint } from './JourneyCheckpoint';
import { SignupModal } from '@/app/components/SignupModal';
import { logger } from '@shared/logging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingPhase =
  | 'pre_chat'
  | 'awaiting_signup'
  | 'confirming_profile'
  | 'confirming_boat'
  | 'equipment_offer'
  | 'journey_offer'
  | 'done';

interface OnboardingProfile {
  displayName: string;
  experienceLevel?: number | null;
  aboutMe?: string | null;
}

interface OnboardingBoat {
  makeModel: string;
  homePort: string;
  yearBuilt?: number | null;
  loa_m?: number | null;
  type?: string | null;
}

interface OnboardingJourney {
  fromLocation?: string | null;
  toLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface OnboardingState {
  phase: OnboardingPhase;
  profile: OnboardingProfile | null;
  boat: OnboardingBoat | null;
  journey: OnboardingJourney | null;
  savedBoatId: string | null;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STORAGE_KEY = 'onboarding_v2_state';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saveState(state: OnboardingState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable in some browsers
  }
}

function loadState(): OnboardingState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingState;
  } catch {
    return null;
  }
}

function clearState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const INITIAL_STATE: OnboardingState = {
  phase: 'pre_chat',
  profile: null,
  boat: null,
  journey: null,
  savedBoatId: null,
};

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'pre_chat', label: 'Tell us about yourself' },
  { key: 'confirming_profile', label: 'Profile' },
  { key: 'confirming_boat', label: 'Boat' },
  { key: 'equipment_offer', label: 'Equipment' },
  { key: 'journey_offer', label: 'Journey' },
] as const;

function stepIndex(phase: OnboardingPhase): number {
  if (phase === 'pre_chat' || phase === 'awaiting_signup') return 0;
  if (phase === 'confirming_profile') return 1;
  if (phase === 'confirming_boat') return 2;
  if (phase === 'equipment_offer') return 3;
  if (phase === 'journey_offer' || phase === 'done') return 4;
  return 0;
}

function StepBar({ phase }: { phase: OnboardingPhase }) {
  const current = stepIndex(phase);
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                i < current
                  ? 'bg-primary border-primary text-primary-foreground'
                  : i === current
                  ? 'border-primary text-primary bg-background'
                  : 'border-muted-foreground/30 text-muted-foreground bg-background'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1 text-center leading-tight hidden sm:block ${
                i <= current ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 transition-colors ${
                i < current ? 'bg-primary' : 'bg-muted-foreground/20'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OwnerOnboardingV2() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // On mount: resolve starting state from auth + sessionStorage
  useEffect(() => {
    if (authLoading) return;

    const saved = loadState();

    if (!user) {
      // Not signed in
      if (saved?.phase === 'awaiting_signup') {
        // Chat completed but signup not finished → restore and re-show modal
        setState(saved);
        setShowSignupModal(true);
      }
      // else: fresh pre_chat (INITIAL_STATE is already correct)
      return;
    }

    // Signed in
    if (saved && saved.phase !== 'pre_chat') {
      if (saved.phase === 'awaiting_signup') {
        // Just returned from signup redirect — advance to profile checkpoint
        setState({ ...saved, phase: 'confirming_profile' });
      } else {
        // Resume from wherever they left off
        setState(saved);
      }
    } else {
      // Signed in with no meaningful saved state → skip chat, show profile checkpoint
      // Pre-fill display name from auth metadata if available
      const nameFromAuth =
        (user.user_metadata?.full_name as string) ??
        user.email?.split('@')[0] ??
        '';
      setState({
        phase: 'confirming_profile',
        profile: { displayName: nameFromAuth },
        boat: { makeModel: '', homePort: '' },
        journey: null,
        savedBoatId: null,
      });
    }
  }, [user, authLoading]);

  // Persist state to sessionStorage whenever it changes (except initial)
  useEffect(() => {
    if (state.phase !== 'pre_chat') {
      saveState(state);
    }
  }, [state]);

  const updateState = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  // Handle when pre-signup chat is complete
  const handleChatComplete = useCallback(
    async (chatExtractedData: Record<string, unknown>, messages: ChatMessage[]) => {
      // Extract structured data from full conversation
      let profile: OnboardingProfile | null = null;
      let boat: OnboardingBoat | null = null;
      let journey: OnboardingJourney | null = null;

      try {
        const transcript = messages
          .map((m) => `${m.role === 'user' ? 'Owner' : 'Assistant'}: ${m.content}`)
          .join('\n');

        const res = await fetch('/api/onboarding/v2/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        if (res.ok) {
          const extracted = await res.json();
          profile = extracted.profile ?? null;
          boat = extracted.boat ?? null;
          journey = extracted.journey ?? null;
        }
      } catch (err) {
        logger.error('[OwnerOnboardingV2] Extract failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Fallback from raw extracted data if extract API failed
      if (!profile) {
        profile = {
          displayName: (chatExtractedData.name as string) ?? '',
          experienceLevel: (chatExtractedData.experienceLevel as number) ?? null,
        };
      }
      if (!boat) {
        boat = {
          makeModel: (chatExtractedData.boatMakeModel as string) ?? '',
          homePort: (chatExtractedData.boatHomePort as string) ?? '',
          yearBuilt: (chatExtractedData.boatYearBuilt as number) ?? null,
          loa_m: (chatExtractedData.boatLoa as number) ?? null,
        };
      }

      updateState({ phase: 'awaiting_signup', profile, boat, journey });
      setShowSignupModal(true);
    },
    [updateState]
  );

  // After signup modal closes (user signed up)
  const handleSignupModalClose = useCallback(() => {
    setShowSignupModal(false);
  }, []);

  // Advance phase helpers
  const handleProfileSaved = useCallback(() => {
    updateState({ phase: 'confirming_boat' });
  }, [updateState]);

  const handleBoatSaved = useCallback(
    (boatId: string) => {
      updateState({ savedBoatId: boatId, phase: 'equipment_offer' });
    },
    [updateState]
  );

  const handleEquipmentDone = useCallback(() => {
    updateState({ phase: 'journey_offer' });
  }, [updateState]);

  const handleDone = useCallback(() => {
    clearState();
    router.push('/owner');
  }, [router]);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Done state
  // ---------------------------------------------------------------------------

  if (state.phase === 'done') {
    clearState();
    router.push('/owner');
    return null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to Find My Crew</h1>
        <p className="text-muted-foreground mt-1">
          Let&apos;s get you set up. This takes about 2 minutes.
        </p>
      </div>

      {/* Step indicator */}
      <StepBar phase={state.phase} />

      {/* Pre-signup chat */}
      {(state.phase === 'pre_chat' || state.phase === 'awaiting_signup') && !user && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-semibold text-foreground mb-4">Tell us about yourself</h2>
          <OnboardingChat
            onComplete={(data, msgs) => handleChatComplete(data as Record<string, unknown>, msgs)}
          />
        </div>
      )}

      {/* Signup modal */}
      <SignupModal
        isOpen={showSignupModal}
        onClose={handleSignupModalClose}
        onSwitchToLogin={() => setShowSignupModal(false)}
        redirectPath="/welcome/owner-v2"
        prospectPreferences={
          state.profile?.displayName
            ? { fullName: state.profile.displayName }
            : undefined
        }
      />

      {/* Profile checkpoint */}
      {state.phase === 'confirming_profile' && user && state.profile && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Step 1 of 4 — Review your profile details and save to continue.
          </div>
          <ProfileCheckpoint
            userId={user.id}
            profile={state.profile}
            onSaved={handleProfileSaved}
          />
        </div>
      )}

      {/* Boat checkpoint */}
      {state.phase === 'confirming_boat' && user && state.boat && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Step 2 of 4 — Review your boat details and save to continue.
          </div>
          <BoatCheckpoint
            userId={user.id}
            boat={state.boat}
            onSaved={handleBoatSaved}
          />
        </div>
      )}

      {/* Equipment checkpoint */}
      {state.phase === 'equipment_offer' && state.savedBoatId && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Step 3 of 4 — Optional: generate equipment &amp; maintenance tasks for your boat.
          </div>
          <EquipmentCheckpoint
            boatId={state.savedBoatId}
            makeModel={state.boat?.makeModel ?? ''}
            boatType={state.boat?.type ?? null}
            loa_m={state.boat?.loa_m ?? null}
            yearBuilt={state.boat?.yearBuilt ?? null}
            onComplete={handleEquipmentDone}
            onSkip={handleEquipmentDone}
          />
        </div>
      )}

      {/* Journey checkpoint */}
      {state.phase === 'journey_offer' && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Step 4 of 4 — Optional: create your first journey.
          </div>
          <JourneyCheckpoint journey={state.journey} onSkip={handleDone} />
        </div>
      )}

    </div>
  );
}
