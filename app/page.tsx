'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Footer } from '@/app/components/Footer';
import { LoginModal } from '@/app/components/LoginModal';
import { SignupModal } from '@/app/components/SignupModal';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';
import * as sessionService from '@/app/lib/prospect/sessionService';
import * as ownerSessionService from '@/app/lib/owner/sessionService';
import { ProspectSession } from '@/app/lib/ai/prospect/types';
import { ComboSearchBox, type ComboSearchData } from '@/app/components/ui/ComboSearchBox';
import { OwnerComboSearchBox, type OwnerComboSearchData } from '@/app/components/ui/OwnerComboSearchBox';
import { CrewOnboardingStepsInline, OwnerOnboardingStepsInline } from '@/app/components/onboarding/OnboardingSteps';
import type { OwnerPreferences } from '@/app/lib/ai/owner/types';

function OwnerPostDialog({
  isOpen,
  onClose,
  onSave,
  title,
  placeholder,
  aiProcessingLabel,
  aiProcessingDesc,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (crewDemand: string, aiProcessingConsent: boolean) => void;
  title: string;
  placeholder: string;
  aiProcessingLabel: string;
  aiProcessingDesc: string;
}) {
  const [crewDemand, setCrewDemand] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(crewDemand.trim(), aiConsent);
  };

  const canSave = crewDemand.trim().length > 0 && aiConsent;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-post-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="owner-post-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <textarea
            ref={textareaRef}
            value={crewDemand}
            onChange={(e) => setCrewDemand(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none"
          />
          {/* AI Consent - same layout as crew Profile Dialog */}
          <div className="flex items-start justify-between gap-4 pt-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{aiProcessingLabel}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{aiProcessingDesc}</p>
            </div>
            <button
              type="button"
              onClick={() => setAiConsent(!aiConsent)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                aiConsent ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                  aiConsent ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const t = useTranslations('welcome');
  const tPrivacy = useTranslations('settings.privacy');
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [sessionType, setSessionType] = useState<'crew' | 'owner' | null>(null);
  const [sessionLegs, setSessionLegs] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [ownerSessionMessages, setOwnerSessionMessages] = useState<any[]>([]);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [isComboSearchMode, setIsComboSearchMode] = useState(false);
  const [isOwnerComboSearchMode, setIsOwnerComboSearchMode] = useState(false);
  const [isOwnerPostMode, setIsOwnerPostMode] = useState(false);
  const [hasOwnerSession, setHasOwnerSession] = useState(false);
  const [ownerSessionPreferences, setOwnerSessionPreferences] = useState<OwnerPreferences>({});
  const [crewHasProfile, setCrewHasProfile] = useState(false);
  const [ownerHasProfile, setOwnerHasProfile] = useState(false);
  const [ownerHasBoat, setOwnerHasBoat] = useState(false);
  const [ownerHasJourney, setOwnerHasJourney] = useState(false);
  const [onboardingState, setOnboardingState] = useState<string>('signup_pending');
  const [ownerOnboardingState, setOwnerOnboardingState] = useState<string>('signup_pending');

  // Check if user is logged in and redirect to role-specific homepage
  useEffect(() => {
    async function checkUserAndRedirect() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // If user is not logged in, continue showing welcome page
      if (!user) {
        setIsCheckingRole(false);
        return;
      }

      // User is logged in - check their roles
      const supabase = getSupabaseBrowserClient();
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('roles')
          .eq('id', user.id)
          .maybeSingle();

        if (profile && profile.roles && profile.roles.length > 0) {
          // Keep user on frontpage if they have a pending owner onboarding session.
          // This prevents redirecting to dashboard when onboarding should continue.
          if (profile.roles.includes('owner')) {
            const { data: pendingOwnerSession, error: pendingOwnerSessionError } = await supabase
              .from('owner_sessions')
              .select('session_id')
              .eq('user_id', user.id)
              .in('onboarding_state', ['signup_pending', 'consent_pending', 'profile_pending', 'boat_pending', 'journey_pending'])
              .limit(1)
              .maybeSingle();

            if (pendingOwnerSessionError) {
              console.error('Failed to check pending owner session:', pendingOwnerSessionError);
            }

            if (pendingOwnerSession) {
              setIsCheckingRole(false);
              return;
            }
          }

          // User has roles - redirect based on primary role
          // Priority: owner > crew (if user has both roles)
          if (profile.roles.includes('owner')) {
            router.push('/owner/dashboard');
            return;
          } else if (profile.roles.includes('crew')) {
            router.push('/crew');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check user profile:', error);
      }

      setIsCheckingRole(false);
    }

    checkUserAndRedirect();
  }, [user, authLoading, router]);

  // Check for existing conversation on mount - load from API instead of localStorage
  useEffect(() => {
    async function checkExistingSession() {
      try {
        // Get session ID from cookie
        const response = await fetch('/api/prospect/session', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          return; // No session cookie
        }
        
        const cookieData = await response.json();
        const sessionId = cookieData.sessionId;
        
        if (!sessionId || cookieData.isNewSession) {
          return; // New session, no existing conversation
        }
        
        // Load session data from API
        const session: ProspectSession | null = await sessionService.loadSession(sessionId);
        
        if (session && session.conversation && session.conversation.length > 0) {
          setHasExistingSession(true);
          setSessionType('crew');

          // Store session messages for use in steps indicator
          setSessionMessages(session.conversation);

          // Extract onboarding state
          setOnboardingState(session.onboardingState || 'signup_pending');

          // Extract unique leg references from all messages
          const legs = new Map<string, string>();
          for (const msg of session.conversation) {
            if (msg.metadata?.legReferences) {
              for (const leg of msg.metadata.legReferences) {
                if (leg.id && leg.name && !legs.has(leg.id)) {
                  legs.set(leg.id, leg.name);
                }
              }
            }
          }

          // Also check viewedLegs from session
          if (session.viewedLegs && session.viewedLegs.length > 0) {
            // If we have viewed leg IDs but not names, we could fetch them
            // For now, we'll rely on legReferences from messages
          }

          // Convert to array and limit to 4 legs
          const legArray = Array.from(legs.entries()).map(([id, name]) => ({ id, name }));
          setSessionLegs(legArray.slice(0, 4));
        }
      } catch (e) {
        console.error('Failed to check session:', e);
      }
    }
    
    checkExistingSession();
  }, []);

  // Check for existing owner onboarding session on mount
  useEffect(() => {
    async function checkExistingOwnerSession() {
      try {
        const response = await fetch('/api/owner/session', {
          credentials: 'include',
        });

        if (!response.ok) return;

        const cookieData = await response.json();
        const sessionId = cookieData.sessionId;

        if (!sessionId || cookieData.isNewSession) {
          return;
        }

        const session = await ownerSessionService.loadSession(sessionId);

        if (session && session.conversation && session.conversation.length > 0) {
          setHasOwnerSession(true);
          setOwnerSessionMessages(session.conversation);
          setOwnerSessionPreferences(session.gatheredPreferences || {});

          // Extract owner onboarding state
          setOwnerOnboardingState(session.onboardingState || 'signup_pending');
        }
      } catch (e) {
        console.error('Failed to check owner session:', e);
      }
    }

    checkExistingOwnerSession();
  }, []);

  // Reset onboarding state when user logs out
  useEffect(() => {
    if (!user) {
      setCrewHasProfile(false);
      setOwnerHasProfile(false);
      setOwnerHasBoat(false);
      setOwnerHasJourney(false);
    }
  }, [user]);

  // Fetch crew profile when user is logged in and has crew session
  useEffect(() => {
    if (!user || !hasExistingSession || sessionType !== 'crew') return;

    const supabase = getSupabaseBrowserClient();
    supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setCrewHasProfile(!!data));
  }, [user, hasExistingSession, sessionType]);

  // Fetch owner profile/boats/journeys when user is logged in and has owner session
  useEffect(() => {
    if (!user || !hasOwnerSession) return;

    const supabase = getSupabaseBrowserClient();
    Promise.all([
      supabase.from('profiles').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('boats').select('id').eq('owner_id', user.id).limit(1),
    ]).then(([profileRes, boatsRes]) => {
      setOwnerHasProfile(!!profileRes.data);
      const boatIds = boatsRes.data?.map((b) => b.id) ?? [];
      if (boatIds.length > 0) {
        supabase
          .from('journeys')
          .select('id')
          .in('boat_id', boatIds)
          .limit(1)
          .then(({ data }) => setOwnerHasJourney((data?.length ?? 0) > 0));
      } else {
        setOwnerHasJourney(false);
      }
      setOwnerHasBoat(boatIds.length > 0);
    });
  }, [user, hasOwnerSession]);

  const handleContinueConversation = () => {
    router.push('/welcome/crew');
  };

  const handleContinueOwnerConversation = () => {
    router.push('/welcome/owner');
  };

  const handleClearOwnerSession = async () => {
    try {
      const response = await fetch('/api/owner/session', {
        credentials: 'include',
      });

      if (response.ok) {
        const cookieData = await response.json();
        const sessionId = cookieData.sessionId;

        if (sessionId) {
          try {
            await ownerSessionService.deleteSession(sessionId);
            console.log('[Frontpage] ✅ Deleted owner session from database');
          } catch (error) {
            console.error('[Frontpage] Error deleting owner session:', error);
          }
        }
      }

      await fetch('/api/owner/session', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to clear owner session:', e);
    }

    setHasOwnerSession(false);
    setOwnerSessionPreferences({});
    setOwnerHasProfile(false);
    setOwnerHasBoat(false);
    setOwnerHasJourney(false);
  };

  const handleClearSession = async () => {
    try {
      // Get session ID from cookie before clearing
      const response = await fetch('/api/prospect/session', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const cookieData = await response.json();
        const sessionId = cookieData.sessionId;
        
        // Delete session from database if it exists
        if (sessionId) {
          try {
            await sessionService.deleteSession(sessionId);
            console.log('[Frontpage] ✅ Deleted session from database');
          } catch (error) {
            console.error('[Frontpage] Error deleting session:', error);
          }
        }
      }
      
      // Clear server cookie
      await fetch('/api/prospect/session', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
    
    // Reset state to show full welcome page
    setHasExistingSession(false);
    setSessionType(null);
    setSessionLegs([]);
    setCrewHasProfile(false);
  };

  const handleComboSearch = (data: ComboSearchData) => {
    const params = new URLSearchParams();
    
    if (data.whereFrom) {
      params.set('whereFrom', JSON.stringify(data.whereFrom));
    }
    if (data.whereTo) {
      params.set('whereTo', JSON.stringify(data.whereTo));
    }
    if (data.availability.freeText) {
      params.set('availabilityText', data.availability.freeText);
    }
    if (data.availability.dateRange?.start) {
      params.set('availabilityStart', data.availability.dateRange.start.toISOString());
    }
    if (data.availability.dateRange?.end) {
      params.set('availabilityEnd', data.availability.dateRange.end.toISOString());
    }
    if (data.profile) {
      params.set('profile', data.profile);
    }
    if (data.aiProcessingConsent === true) {
      params.set('aiProcessingConsent', 'true');
    }
    
    router.push(`/welcome/crew?${params.toString()}`);
  };

  const handleOwnerPost = (crewDemand: string, aiProcessingConsent: boolean) => {
    const params = new URLSearchParams();
    params.set('crewDemand', crewDemand);
    if (aiProcessingConsent) {
      params.set('aiProcessingConsent', 'true');
    }
    router.push(`/welcome/owner?${params.toString()}`);
  };

  const handleOwnerComboSearch = (data: OwnerComboSearchData) => {
    const params = new URLSearchParams();
    
    // Journey details
    if (data.journeyDetails.startLocation) {
      params.set('startLocation', JSON.stringify(data.journeyDetails.startLocation));
    }
    if (data.journeyDetails.endLocation) {
      params.set('endLocation', JSON.stringify(data.journeyDetails.endLocation));
    }
    if (data.journeyDetails.startDate) {
      params.set('startDate', data.journeyDetails.startDate);
    }
    if (data.journeyDetails.endDate) {
      params.set('endDate', data.journeyDetails.endDate);
    }
    if (data.journeyDetails.waypoints.length > 0) {
      params.set('waypoints', JSON.stringify(data.journeyDetails.waypoints));
    }
    
    // Skipper/Crew profiles
    if (data.skipperCrewProfiles.text) {
      params.set('crewDemand', data.skipperCrewProfiles.text);
    }
    if (data.skipperCrewProfiles.aiProcessingConsent) {
      params.set('aiProcessingConsent', 'true');
    }
    
    router.push(`/welcome/owner?${params.toString()}`);
  };

  // Show loading state while checking authentication and roles
  if (authLoading || isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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

      {/* Logo - top left */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/">
          <Image
            src="/sailsmart_new_tp_dark.png"
            alt="SailSmart"
            width={80}
            height={80}
            className="object-contain drop-shadow-2xl w-[50px] h-[50px] md:w-[80px] md:h-[80px]"
          />
        </Link>
      </div>


      {/* Main content - dual column layout or single column when session exists */}
      <main className="flex-1 flex flex-col md:flex-row min-h-screen">
        {/* Crew Column (Right on desktop, First on mobile) - Hidden when owner post mode, owner combo search mode, or owner session exists */}
        {!isOwnerPostMode && !isOwnerComboSearchMode && !hasOwnerSession && (
        <div className={`relative flex items-start justify-center pt-16 md:pt-20 pb-6 md:pb-12 px-6 md:px-12 min-w-0 ${
          hasExistingSession && sessionType === 'crew' || isComboSearchMode
            ? 'flex-1 min-h-screen'
            : 'flex-1 order-1 md:order-2 min-h-[50vh] md:min-h-screen'
        }`}>
          {/* Blue overlay for crew side - only show when dual column */}
          {!(hasExistingSession && sessionType === 'crew') && !isComboSearchMode && (
            <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-[2px] -z-10" />
          )}
          {/* Lighter overlay for single column mode */}
          {(hasExistingSession && sessionType === 'crew') || isComboSearchMode ? (
            <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px] -z-10" />
          ) : null}

          {/* Use consistent max-width to prevent header shift when ComboSearchBox is focused */}
          <div className="w-full text-center text-white max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl">
            <div className="mb-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <svg
                  className="w-7 h-7 text-white"
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
      
            <p className="text-sm md:text-base text-white/80 mb-6">
              {t('crew.description')}
            </p>

            {/* Combo Search Box */}
            {!hasExistingSession && (
              <div className={`w-full mx-auto ${
                (hasExistingSession && sessionType === 'crew') || isComboSearchMode ? 'max-w-sm sm:max-w-2xl md:max-w-4xl' : 'max-w-sm'
              }`}>
                <div className="flex items-center gap-3">
                  {/* Back button - shown when combo search mode is active */}
                  {isComboSearchMode && (
                    <button
                      onClick={() => {
                        setIsComboSearchMode(false);
                        // Blur any active inputs
                        const activeElement = document.activeElement as HTMLElement;
                        if (activeElement && activeElement.blur) {
                          activeElement.blur();
                        }
                      }}
                      className="flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center"
                      aria-label="Back"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                    <ComboSearchBox 
                      onSubmit={handleComboSearch} 
                      compactMode={!isComboSearchMode}
                      onFocusChange={(isFocused) => {
                        // Only enter combo search mode when focus is gained, don't exit when focus is lost
                        if (isFocused && !isComboSearchMode) {
                          setIsComboSearchMode(true);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Onboarding steps - always shown; header + link only when session exists */}
            <div className="w-full mt-6 md:mt-8">
              {hasExistingSession && sessionType === 'crew' && (
                <button
                  onClick={handleContinueConversation}
                  className="inline-flex items-center gap-1.5 text-sm text-white font-medium hover:text-white/90 hover:underline transition-colors mb-2"
                >
                  You are almost there – continue your journey
                  <svg
                    className="w-4 h-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}
              <div className="w-full">
                <CrewOnboardingStepsInline
                  layout="homepage"
                  isAuthenticated={!!user}
                  hasExistingProfile={crewHasProfile}
                  onboardingState={onboardingState}
                  messagesLength={sessionMessages?.length || 0}
                />
              </div>
              {hasExistingSession && sessionType === 'crew' && sessionLegs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                  {sessionLegs.map((leg) => (
                    <button
                      key={leg.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `/crew/dashboard?legId=${leg.id}`;
                        const isMobileScreen = window.innerWidth < 768;
                        if (isMobileScreen) {
                          window.location.href = url;
                        } else {
                          const anchor = document.createElement('a');
                          anchor.href = url;
                          anchor.target = '_blank';
                          anchor.rel = 'noopener noreferrer';
                          document.body.appendChild(anchor);
                          anchor.click();
                          document.body.removeChild(anchor);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white/90 bg-white/10 rounded-full border border-white/20 hover:bg-white/20 hover:border-white/30 transition-colors cursor-pointer"
                      title={`View ${leg.name}`}
                    >
                      <svg
                        className="w-3 h-3 text-white/70"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {leg.name.length > 20 ? leg.name.substring(0, 20) + '...' : leg.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Owner Column (Left on desktop, Second on mobile) - Hidden when crew session exists or combo search mode, shown when owner post mode, owner combo search mode, or owner session exists */}
        {(isOwnerPostMode || isOwnerComboSearchMode || hasOwnerSession || (!(hasExistingSession && sessionType === 'crew') && !isComboSearchMode)) && (
          <div className={`relative flex items-start justify-center pt-16 md:pt-20 pb-6 md:pb-12 px-6 md:px-12 flex-1 order-2 md:order-1 min-w-0 ${
            isOwnerComboSearchMode || hasOwnerSession
              ? 'min-h-screen'
              : 'min-h-[50vh] md:min-h-screen'
          }`}>
            {/* Warm/amber overlay for owner side */}
            {!(isOwnerComboSearchMode || hasOwnerSession) && (
              <div className="absolute inset-0 bg-amber-900/50 backdrop-blur-[2px] -z-10" />
            )}
            {/* Lighter overlay for combo search mode */}
            {(isOwnerComboSearchMode || hasOwnerSession) && (
              <div className="absolute inset-0 bg-amber-900/40 backdrop-blur-[1px] -z-10" />
            )}

            <div className="w-full text-center text-white max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl">
              <div className="mb-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <svg
                    className="w-7 h-7 text-white"
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

              <p className="text-sm md:text-base text-white/80 mb-6">
                {t('owner.description')}
              </p>

              {!hasOwnerSession && (
                <div className={`w-full mx-auto ${
                  isOwnerComboSearchMode ? 'max-w-sm sm:max-w-2xl md:max-w-4xl' : 'max-w-sm'
                }`}>
                  <div className="flex items-center gap-3">
                    {/* Back button - shown when combo search mode is active */}
                    {isOwnerComboSearchMode && (
                      <button
                        onClick={() => {
                          setIsOwnerComboSearchMode(false);
                          // Blur any active inputs
                          const activeElement = document.activeElement as HTMLElement;
                          if (activeElement && activeElement.blur) {
                            activeElement.blur();
                          }
                        }}
                        className="flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg hover:bg-white/30 transition-colors flex items-center justify-center"
                        aria-label="Back"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}
                    <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                      <OwnerComboSearchBox 
                        onSubmit={handleOwnerComboSearch} 
                        compactMode={!isOwnerComboSearchMode}
                        onFocusChange={(isFocused) => {
                          // Only enter combo search mode when focus is gained, don't exit when focus is lost
                          if (isFocused && !isOwnerComboSearchMode) {
                            setIsOwnerComboSearchMode(true);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Onboarding steps - always shown; header + link only when session exists */}
              <div className="w-full mt-6 md:mt-8">
                {hasOwnerSession && (
                  <button
                    onClick={handleContinueOwnerConversation}
                    className="inline-flex items-center gap-1.5 text-sm text-amber-100 font-medium hover:text-amber-200 hover:underline transition-colors mb-2"
                  >
                    {t('owner.continueJourney')}
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
                <div className="w-full">
                  <OwnerOnboardingStepsInline
                    layout="homepage"
                    isAuthenticated={!!user}
                    hasExistingProfile={ownerHasProfile}
                    hasBoat={ownerHasBoat}
                    hasJourney={ownerHasJourney}
                    onboardingState={ownerOnboardingState}
                    messagesLength={ownerSessionMessages?.length || 0}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Owner Post Dialog - shown when user clicks owner input */}
      {isOwnerPostMode && (
        <OwnerPostDialog
          isOpen={isOwnerPostMode}
          onClose={() => setIsOwnerPostMode(false)}
          onSave={(crewDemand, aiProcessingConsent) => {
            handleOwnerPost(crewDemand, aiProcessingConsent);
            setIsOwnerPostMode(false);
          }}
          title={t('owner.postDialogTitle')}
          placeholder={t('owner.postDialogPlaceholder')}
          aiProcessingLabel={tPrivacy('aiProcessing')}
          aiProcessingDesc={tPrivacy('aiProcessingDesc')}
        />
      )}

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
