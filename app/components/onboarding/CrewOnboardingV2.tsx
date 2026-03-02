'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { CrewOnboardingChat } from './CrewOnboardingChat';
import { CrewProfileCheckpoint } from './CrewProfileCheckpoint';
import { SignupModal } from '@/app/components/SignupModal';
import { logger } from '@shared/logging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingPhase = 'signup' | 'chatting' | 'confirming_profile' | 'done';

export interface SkillEntry {
  skill_name: string;
  description: string;
}

interface OnboardingProfile {
  displayName: string;
  experienceLevel?: number | null;
  bio?: string | null;
  motivation?: string | null;
  sailingPreferences?: string | null;
  skills?: SkillEntry[] | null;
  riskLevels?: string[] | null;
  preferredDepartureLocation?: string | null;
  preferredArrivalLocation?: string | null;
  availabilityStartDate?: string | null;
  availabilityEndDate?: string | null;
}

interface OnboardingState {
  phase: OnboardingPhase;
  profile: OnboardingProfile | null;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const STORAGE_KEY = 'onboarding_crew_v2_state';

// ---------------------------------------------------------------------------
// sessionStorage helpers
// ---------------------------------------------------------------------------

function saveState(state: OnboardingState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // unavailable in some environments
  }
}

function loadState(): OnboardingState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingState) : null;
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

const INITIAL_STATE: OnboardingState = { phase: 'signup', profile: null };

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'signup', label: 'Account' },
  { key: 'chatting', label: 'Profile' },
  { key: 'confirming_profile', label: 'Review' },
] as const;

function stepIndex(phase: OnboardingPhase): number {
  if (phase === 'signup') return 0;
  if (phase === 'chatting') return 1;
  return 2; // confirming_profile | done
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
                  ? 'bg-white border-white text-blue-900'
                  : i === current
                  ? 'border-white text-white bg-white/20'
                  : 'border-white/30 text-white/50 bg-transparent'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1 text-center leading-tight hidden sm:block ${
                i <= current ? 'text-white' : 'text-white/50'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 transition-colors ${
                i < current ? 'bg-white/60' : 'bg-white/20'
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

export function CrewOnboardingV2() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // Resolve starting phase on mount
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      clearState();
      setState(INITIAL_STATE);
      return;
    }

    const saved = loadState();
    if (saved && saved.phase !== 'signup') {
      const isValid = !(saved.phase === 'confirming_profile' && !saved.profile);
      setState(isValid ? saved : { ...INITIAL_STATE, phase: 'chatting' });
    } else {
      setState({ ...INITIAL_STATE, phase: 'chatting' });
    }
  }, [user, authLoading]);

  // Persist non-signup state
  useEffect(() => {
    if (state.phase !== 'signup') saveState(state);
  }, [state]);

  const updateState = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  // Handle AI chat completion
  const handleChatComplete = useCallback(
    async (chatExtractedData: Record<string, unknown>, messages: ChatMessage[]) => {
      setIsExtracting(true);
      let profile: OnboardingProfile | null = null;

      try {
        const transcript = messages
          .map((m) => `${m.role === 'user' ? 'Crew member' : 'Assistant'}: ${m.content}`)
          .join('\n');

        const res = await fetch('/api/onboarding/v2/crew/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        if (res.ok) {
          const extracted = await res.json();
          const p = extracted.profile ?? {};
          const loc = extracted.locationPreferences ?? {};
          const avail = extracted.availability ?? {};

          // Extract API now returns skills as [{skill_name, description}]
          const rawSkills: unknown = extracted.skills;
          const skills: SkillEntry[] | null = Array.isArray(rawSkills)
            ? (rawSkills as Array<{ skill_name?: string; description?: string } | string>)
                .map((s) =>
                  typeof s === 'string'
                    ? { skill_name: s, description: '' }
                    : { skill_name: s.skill_name ?? '', description: s.description ?? '' }
                )
                .filter((s) => s.skill_name.length > 0)
            : null;

          profile = {
            displayName: p.displayName ?? '',
            experienceLevel: p.experienceLevel ?? null,
            bio: p.bio ?? null,
            motivation: p.motivation ?? null,
            sailingPreferences: extracted.sailingPreferences ?? null,
            skills,
            riskLevels: extracted.riskLevels ?? null,
            preferredDepartureLocation: loc.preferredDepartureLocation ?? null,
            preferredArrivalLocation: loc.preferredArrivalLocation ?? null,
            availabilityStartDate: avail.startDate ?? null,
            availabilityEndDate: avail.endDate ?? null,
          };
        } else {
          logger.warn('[CrewOnboardingV2] Extract API returned non-ok status');
        }
      } catch (err) {
        logger.error('[CrewOnboardingV2] Extract failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Fallback from auth metadata and chat extractedData
      if (!profile || !profile.displayName) {
        const fallbackName =
          (user?.user_metadata?.full_name as string | undefined) ??
          user?.email?.split('@')[0] ??
          (chatExtractedData.name as string | undefined) ??
          '';

        // Chat extractedData returns skills as plain strings — wrap them
        const fallbackSkills: SkillEntry[] | null =
          (chatExtractedData.skills as string[] | undefined)?.map((s) => ({
            skill_name: s,
            description: '',
          })) ?? null;

        profile = profile
          ? { ...profile, displayName: profile.displayName || fallbackName }
          : {
              displayName: fallbackName,
              experienceLevel: (chatExtractedData.experienceLevel as number | undefined) ?? null,
              bio: (chatExtractedData.bio as string | undefined) ?? null,
              motivation: (chatExtractedData.motivation as string | undefined) ?? null,
              skills: fallbackSkills,
              riskLevels: (chatExtractedData.riskLevels as string[] | undefined) ?? null,
              sailingPreferences:
                (chatExtractedData.sailingPreferences as string | undefined) ?? null,
              preferredDepartureLocation:
                (chatExtractedData.preferredDepartureLocation as string | undefined) ?? null,
              preferredArrivalLocation:
                (chatExtractedData.preferredArrivalLocation as string | undefined) ?? null,
              availabilityStartDate:
                (chatExtractedData.availabilityStartDate as string | undefined) ?? null,
              availabilityEndDate:
                (chatExtractedData.availabilityEndDate as string | undefined) ?? null,
            };
      }

      setIsExtracting(false);
      updateState({ phase: 'confirming_profile', profile });
    },
    [updateState, user]
  );

  const handleProfileSaved = useCallback(() => {
    clearState();
    router.push('/crew');
  }, [router]);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state.phase === 'done') {
    clearState();
    router.push('/crew');
    return null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative min-h-screen">
      {/* Background image */}
      <div
        className="fixed inset-0 bg-cover bg-center -z-20"
        style={{ backgroundImage: 'url(/homepage-2.jpg)' }}
      />
      {/* Blue overlay */}
      <div className="fixed inset-0 bg-blue-900/65 backdrop-blur-[2px] -z-10" />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">Build your crew profile</h1>
          <p className="text-white/80 mt-1">
            A complete profile helps boat owners choose you over other applicants.
          </p>
        </div>

        <StepBar phase={state.phase} />

        {/* Step 1 — signup */}
        {state.phase === 'signup' && !user && (
          <>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl shadow-xl p-6">
              <h2 className="font-semibold text-white text-lg mb-2">Create your account</h2>
              <p className="text-sm text-white/70 mb-5">
                Join Find My Crew and start applying for sailing positions with boat owners around the world.
              </p>
              <button
                onClick={() => setShowSignupModal(true)}
                className="w-full bg-white text-blue-900 font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-white/90 transition-colors"
              >
                Create account
              </button>
            </div>

            <SignupModal
              isOpen={showSignupModal}
              onClose={() => setShowSignupModal(false)}
              onSwitchToLogin={() => setShowSignupModal(false)}
              redirectPath="/welcome/crew-v2"
            />
          </>
        )}

        {/* Step 2 — AI chat */}
        {state.phase === 'chatting' && user && (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl shadow-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-white">Tell us about your sailing</h2>
                <p className="text-xs text-white/60 mt-0.5">
                  Our assistant will guide you through building your profile
                </p>
              </div>
            </div>
            <CrewOnboardingChat
              onComplete={(data, msgs) =>
                handleChatComplete(data as Record<string, unknown>, msgs)
              }
              isProcessing={isExtracting}
            />
          </div>
        )}

        {/* Step 3 — profile review */}
        {state.phase === 'confirming_profile' && user && state.profile && (
          <div className="space-y-3">
            <div className="text-sm text-white/70">
              Review your profile details, fill in any gaps, then save to complete setup.
            </div>
            <CrewProfileCheckpoint
              userId={user.id}
              email={user.email ?? undefined}
              profile={state.profile}
              onSaved={handleProfileSaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
