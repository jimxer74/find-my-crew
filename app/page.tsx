'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { logger } from '@shared/logging';
import { Footer } from '@/app/components/Footer';
import { LoginModal } from '@/app/components/LoginModal';
import { SignupModal } from '@/app/components/SignupModal';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useAuth } from '@/app/contexts/AuthContext';
import * as sessionService from '@/app/lib/prospect/sessionService';
import * as ownerSessionService from '@/app/lib/owner/sessionService';
import { shouldStayOnHomepage, redirectAfterAuth, getRedirectPath } from '@/app/lib/routing/redirectHelpers.client';
import { ProspectSession } from '@/app/lib/ai/prospect/types';
import { ComboSearchBox, type ComboSearchData } from '@shared/ui/ComboSearchBox';
import { OwnerComboSearchBox, type OwnerComboSearchData } from '@shared/ui/OwnerComboSearchBox';
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
          <h2 id="owner-post-dialog-title" className="text-lg font-semibold text-gray-950 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-950 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-600 dark:placeholder:text-gray-400 resize-none"
          />
          {/* AI Consent - same layout as crew Profile Dialog */}
          <div className="flex items-start justify-between gap-4 pt-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-950 dark:text-gray-100">{aiProcessingLabel}</p>
              <p className="text-sm text-gray-700 dark:text-gray-400 mt-0.5">{aiProcessingDesc}</p>
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
            className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-amber-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
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

// Inner component that uses translations (must be called within NextIntlClientProvider)
function WelcomePageContent() {
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

  // Client-side redirect check (fallback for cases where middleware didn't catch it)
  // Middleware handles most redirects server-side, but this ensures consistency
  // This runs quickly and doesn't block page render unnecessarily
  useEffect(() => {
    let cancelled = false;

    async function checkUserAndRedirect() {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      // If no user, allow page to render immediately
      if (!user) {
        setIsCheckingRole(false);
        return;
      }

      // User is authenticated - quick check if they should stay or redirect
      try {
        const shouldStay = await shouldStayOnHomepage(user.id);
        if (cancelled) return;

        if (shouldStay) {
          // User has pending onboarding - allow page to render
          setIsCheckingRole(false);
          return;
        }

        // User should be redirected - get path and redirect immediately
        const redirectPath = await getRedirectPath(user.id, 'root');
        if (cancelled) return;

        if (redirectPath && redirectPath !== '/') {
          // Immediate redirect (no delay) - middleware should have caught this
          // but if not, redirect now to prevent content flash
          router.replace(redirectPath);
          // Don't set isCheckingRole to false - let redirect happen
        } else {
          setIsCheckingRole(false);
        }
      } catch (error) {
        logger.error('[RootRoute] Failed to determine redirect', { error: error instanceof Error ? error.message : String(error) });
        // On error, allow page to render (fallback)
        setIsCheckingRole(false);
      }
    }

    // Only check if we have a user (middleware handles most cases)
    if (user && !authLoading) {
      checkUserAndRedirect();
    } else if (!authLoading) {
      // No user and auth is loaded - allow page to render
      setIsCheckingRole(false);
    }

    return () => {
      cancelled = true;
    };
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
        logger.error('Failed to check session', { error: e instanceof Error ? e.message : String(e) });
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
        logger.error('Failed to check owner session', { error: e instanceof Error ? e.message : String(e) });
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

    const loadCrewProfile = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        setCrewHasProfile(!!data);
      } catch (error) {
        logger.error('Error fetching crew profile', { error: error instanceof Error ? error.message : String(error) });
        setCrewHasProfile(false);
      }
    };

    loadCrewProfile();
  }, [user, hasExistingSession, sessionType]);

  // Fetch owner profile/boats/journeys when user is logged in and has owner session
  useEffect(() => {
    if (!user || !hasOwnerSession) return;

    const loadOwnerData = async () => {
      try {
        const supabase = getSupabaseBrowserClient();

        const [profileRes, boatsRes] = await Promise.all([
          supabase.from('profiles').select('id').eq('id', user.id).maybeSingle(),
          supabase.from('boats').select('id').eq('owner_id', user.id).limit(1),
        ]);

        setOwnerHasProfile(!!profileRes.data);
        const boatIds = boatsRes.data?.map((b: any) => b.id) ?? [];
        setOwnerHasBoat(boatIds.length > 0);

        if (boatIds.length > 0) {
          try {
            const { data } = await supabase
              .from('journeys')
              .select('id')
              .in('boat_id', boatIds)
              .limit(1);
            setOwnerHasJourney((data?.length ?? 0) > 0);
          } catch (error) {
            logger.error('Error fetching owner journeys', { error: error instanceof Error ? error.message : String(error) });
            setOwnerHasJourney(false);
          }
        } else {
          setOwnerHasJourney(false);
        }
      } catch (error) {
        logger.error('Error fetching owner profile and boats', { error: error instanceof Error ? error.message : String(error) });
        setOwnerHasProfile(false);
        setOwnerHasBoat(false);
        setOwnerHasJourney(false);
      }
    };

    loadOwnerData();
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
            logger.info('[Frontpage] Deleted owner session from database');
          } catch (error) {
            logger.error('[Frontpage] Error deleting owner session', { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }

      await fetch('/api/owner/session', { method: 'DELETE' });
    } catch (e) {
      logger.error('Failed to clear owner session', { error: e instanceof Error ? e.message : String(e) });
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
            logger.info('[Frontpage] Deleted session from database');
          } catch (error) {
            logger.error('[Frontpage] Error deleting session', { error: error instanceof Error ? error.message : String(error) });
          }
        }
      }
      
      // Clear server cookie
      await fetch('/api/prospect/session', { method: 'DELETE' });
    } catch (e) {
      logger.error('Failed to clear session', { error: e instanceof Error ? e.message : String(e) });
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

  const handleOwnerPost = (text: string, aiProcessingConsent: boolean) => {
    const params = new URLSearchParams();
    // Legacy single-textarea dialog: treat the whole text as skipper profile
    params.set('skipperProfile', text);
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
    if (data.journeyDetails.waypointDensity) {
      params.set('waypointDensity', data.journeyDetails.waypointDensity);
    }
    
    // Skipper profile + crew requirements (separate fields)
    if (data.skipperProfile.text) {
      params.set('skipperProfile', data.skipperProfile.text);
    }
    if (data.crewRequirements.text) {
      params.set('crewRequirements', data.crewRequirements.text);
    }
    if (data.skipperProfile.aiProcessingConsent || data.crewRequirements.aiProcessingConsent) {
      params.set('aiProcessingConsent', 'true');
    }

    // Imported profile (from URL import feature)
    if (data.importedProfile) {
      params.set('importedProfile', JSON.stringify(data.importedProfile));
    }

    router.push(`/welcome/owner?${params.toString()}`);
  };

  // Show loading state while checking authentication and roles
  // Show loading state while checking auth or redirect
  // This prevents flash of content before redirect
  if (authLoading || (user && isCheckingRole)) {
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

      {/* View map + Login - fixed top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Link
          href="/crew/dashboard"
          className="px-4 py-2 min-h-[44px] bg-white/20 backdrop-blur-sm text-white border border-white/30 rounded-lg hover:bg-white/30 transition-colors font-medium inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          View map
        </Link>
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
        <div className={`relative flex items-start justify-center pt-24 md:pt-28 pb-6 md:pb-12 px-6 md:px-12 min-w-0 ${
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


              {hasExistingSession && sessionType === 'crew' ? (
                <button
                  onClick={handleContinueConversation}
                  className="inline-flex items-center gap-1.5 text-lg md:text-xl text-white/90 mb-4 drop-shadow-md mb-6 hover:text-white/80 hover:underline transition-colors mb-2"
                >
                  {t('crew.'+onboardingState)}

                </button>
              ) : (
                <div>
                <p className="text-lg md:text-xl text-white/90 mb-4 drop-shadow-md">
                {t('crew.subtitle')}
                </p>
                  <p className="text-sm md:text-base text-white/80 mb-6">
                {(hasExistingSession && sessionType === 'crew') || isComboSearchMode
                  ? t('crew.descriptionSingle')
                  : t('crew.description')}
                </p>
              </div>

              )}
  

          
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
              <div className="w-full">
                <CrewOnboardingStepsInline
                  layout="homepage"
                  isAuthenticated={!!user}
                  hasExistingProfile={crewHasProfile}
                  onboardingState={onboardingState}
                  messagesLength={sessionMessages?.length || 0}
                  hasActiveSession={hasExistingSession && sessionType === 'crew'}
                  onCurrentStepClick={handleContinueConversation}
                />
              </div>
              {hasExistingSession && sessionType === 'crew' && sessionLegs.length > 0 && (
                <div className="mt-2 pt-4 flex flex-wrap gap-1.5 justify-center">
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
          <div className={`relative flex items-start justify-center pt-24 md:pt-28 pb-6 md:pb-12 px-6 md:px-12 flex-1 order-2 md:order-1 min-w-0 ${
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
                {isOwnerComboSearchMode || hasOwnerSession
                  ? t('owner.descriptionSingle')
                  : t('owner.description')}
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
                    hasActiveSession={hasOwnerSession}
                    onCurrentStepClick={handleContinueOwnerConversation}
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

// Export wrapper that ensures the content component is properly wrapped
export default function WelcomePage() {
  try {
    return <WelcomePageContent />;
  } catch (error) {
    logger.error('[WelcomePage] Failed to render welcome page:', { error: error instanceof Error ? error.message : String(error) });
    // Fallback: render minimal welcome page without translations
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Welcome</h1>
          <p className="text-muted-foreground mb-8">Unable to load page. Please refresh.</p>
          <button
            onClick={() => typeof window !== 'undefined' && window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
}
