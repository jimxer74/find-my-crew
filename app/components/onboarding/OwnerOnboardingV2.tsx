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
  | 'signup'
  | 'chatting'
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
  intermediateWaypoints?: string[] | null;
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
  phase: 'signup',
  profile: null,
  boat: null,
  journey: null,
  savedBoatId: null,
};

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'signup', label: 'Account' },
  { key: 'chatting', label: 'About you' },
  { key: 'confirming_profile', label: 'Profile' },
  { key: 'confirming_boat', label: 'Boat' },
  { key: 'equipment_offer', label: 'Equipment' },
  { key: 'journey_offer', label: 'Journey' },
] as const;

function stepIndex(phase: OnboardingPhase): number {
  if (phase === 'signup') return 0;
  if (phase === 'chatting') return 1;
  if (phase === 'confirming_profile') return 2;
  if (phase === 'confirming_boat') return 3;
  if (phase === 'equipment_offer') return 4;
  if (phase === 'journey_offer' || phase === 'done') return 5;
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

    if (!user) {
      // Not authenticated — clear any stale state and show signup
      clearState();
      setState(INITIAL_STATE);
      return;
    }

    // Authenticated — check for saved progress
    const saved = loadState();
    if (saved && saved.phase !== 'signup') {
      // Validate saved state has required data for its phase before restoring
      const isValid =
        !(saved.phase === 'confirming_profile' && !saved.profile) &&
        !(saved.phase === 'confirming_boat' && !saved.boat);

      if (isValid) {
        setState(saved);
      } else {
        // Corrupted/incomplete saved state — restart from chat
        setState({ ...INITIAL_STATE, phase: 'chatting' });
      }
    } else {
      // No saved progress — start the AI chat (user just signed up)
      setState({ ...INITIAL_STATE, phase: 'chatting' });
    }
  }, [user, authLoading]);

  // Persist state to sessionStorage (only when past signup phase)
  useEffect(() => {
    if (state.phase !== 'signup') {
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

  // Handle when AI chat is complete (user is already authenticated at this point)
  const handleChatComplete = useCallback(
    async (chatExtractedData: Record<string, unknown>, messages: ChatMessage[]) => {
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
          // Merge intermediateWaypoints from chat extractedData if extract didn't capture them
          journey = extracted.journey
            ? {
                ...extracted.journey,
                intermediateWaypoints:
                  extracted.journey.intermediateWaypoints ??
                  (chatExtractedData.journeyWaypoints as string[] | null) ??
                  null,
              }
            : null;
        }
      } catch (err) {
        logger.error('[OwnerOnboardingV2] Extract failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Fallbacks using auth user data (user is signed in at this point)
      if (!profile) {
        const nameFromAuth =
          (user?.user_metadata?.full_name as string) ??
          user?.email?.split('@')[0] ??
          (chatExtractedData.name as string) ??
          '';
        profile = {
          displayName: nameFromAuth,
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

      // User is authenticated — go directly to profile checkpoint
      updateState({ phase: 'confirming_profile', profile, boat, journey });
    },
    [updateState, user]
  );

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

      {/* Signup phase — user not yet authenticated */}
      {state.phase === 'signup' && !user && (
        <>
          <div className="rounded-xl border border-border bg-card shadow-sm p-6">
            <h2 className="font-semibold text-foreground text-lg mb-2">First, create your account</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Set up your account to start building your boat owner profile. It only takes a minute.
            </p>
            <button
              onClick={() => setShowSignupModal(true)}
              className="w-full bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create account
            </button>
          </div>

          <SignupModal
            isOpen={showSignupModal}
            onClose={() => setShowSignupModal(false)}
            onSwitchToLogin={() => setShowSignupModal(false)}
            redirectPath="/welcome/owner-v2"
          />
        </>
      )}

      {/* AI Chat phase — user is authenticated */}
      {state.phase === 'chatting' && user && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-5">
          <h2 className="font-semibold text-foreground mb-4">Tell us about yourself</h2>
          <OnboardingChat
            onComplete={(data, msgs) => handleChatComplete(data as Record<string, unknown>, msgs)}
          />
        </div>
      )}

      {/* Profile checkpoint */}
      {state.phase === 'confirming_profile' && user && state.profile && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Step 1 of 4 — Review your profile details and save to continue.
          </div>
          <ProfileCheckpoint
            userId={user.id}
            email={user.email ?? undefined}
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
          <JourneyCheckpoint journey={state.journey} boatId={state.savedBoatId} onSkip={handleDone} />
        </div>
      )}
    </div>
  );
}
