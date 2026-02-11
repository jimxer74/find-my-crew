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
import { ProspectSession } from '@/app/lib/ai/prospect/types';
import { ComboSearchBox, type ComboSearchData } from '@/app/components/ui/ComboSearchBox';

const AI_SIGNUP_FLAG = 'ai_assistant_signup_pending';

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
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none"
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
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                aiConsent ? 'bg-primary' : 'bg-muted'
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
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  const [sessionContext, setSessionContext] = useState<string | null>(null);
  const [sessionLegs, setSessionLegs] = useState<Array<{ id: string; name: string }>>([]);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  const [isComboSearchMode, setIsComboSearchMode] = useState(false);
  const [isOwnerPostMode, setIsOwnerPostMode] = useState(false);

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

      // Check for AI signup flag first (don't redirect if signup is pending)
      const signupPending = localStorage.getItem(AI_SIGNUP_FLAG);
      if (signupPending) {
        setIsCheckingRole(false);
        return; // Let the consent handler deal with this
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

  // Check if user just signed up from AI assistant and redirect after consent is completed.
  // Flow A (email signup): User clicks email link → lands here → consent modal appears → user completes → redirect
  // Flow B (OAuth signup): Handled in ProspectChatContext (no page reload needed)
  useEffect(() => {
    const signupPending = localStorage.getItem(AI_SIGNUP_FLAG);
    if (!signupPending) return;

    const handleConsentCompleted = async (event: Event) => {
      const customEvent = event as CustomEvent<{ aiProcessingConsent: boolean }>;
      const aiConsent = customEvent.detail?.aiProcessingConsent ?? false;

      // Consent is done - clear the signup flag
      localStorage.removeItem(AI_SIGNUP_FLAG);

      if (aiConsent) {
        // AI consent granted → redirect to assistant for AI-powered profile completion
        console.log('AI signup + AI consent granted → redirecting to assistant for profile completion');
        router.push('/welcome/crew?profile_completion=true');
      } else {
        // AI consent NOT granted → redirect to manual profile setup page
        console.log('AI signup + AI consent NOT granted → redirecting to profile setup page');
        router.push('/profile-setup');
      }
    };

    window.addEventListener('consentSetupCompleted', handleConsentCompleted);
    return () => {
      window.removeEventListener('consentSetupCompleted', handleConsentCompleted);
    };
  }, [router]);

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
          // For now, all prospect sessions are 'crew' type
          // Future: detect owner sessions from a different storage key
          setSessionType('crew');

          // Extract context from first user message or preferences
          const firstUserMessage = session.conversation.find(
            (msg: { role: string; content: string }) => msg.role === 'user'
          );
          if (firstUserMessage) {
            // Truncate if too long
            const content = firstUserMessage.content;
            setSessionContext(content.length > 60 ? content.substring(0, 60) + '...' : content);
          }

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

  const handleContinueConversation = () => {
    router.push('/welcome/crew');
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
    setSessionContext(null);
    setSessionLegs([]);
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
        {/* Crew Column (Right on desktop, First on mobile) - Hidden when owner post mode */}
        {!isOwnerPostMode && (
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

            {/* Continue conversation link */}
            {hasExistingSession && (
              <div className={`w-full mx-auto mt-4 ${
                sessionType === 'crew' ? 'max-w-full sm:max-w-sm md:max-w-lg' : 'max-w-full sm:max-w-sm'
              }`}>
                <div className="relative">
                  <button
                    onClick={handleContinueConversation}
                    className="w-full px-4 py-3 pr-12 flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/25 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">You are allmost there - continue your journey</p>
                      {sessionContext && (
                        <p className="text-xs text-white/70 truncate">&quot;{sessionContext}&quot;</p>
                      )}
                    </div>
                    <svg
                      className="w-4 h-4 text-white/50 flex-shrink-0"
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
                </div>

                {/* Leg badges */}
                {sessionLegs.length > 0 && (
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
                            // Desktop: open in new tab
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
            )}
          </div>
        </div>
        )}

        {/* Owner Column (Left on desktop, Second on mobile) - Hidden when crew session exists or combo search mode, shown when owner post mode */}
        {(isOwnerPostMode || (!(hasExistingSession && sessionType === 'crew') && !isComboSearchMode)) && (
          <div className="relative flex items-start justify-center pt-16 md:pt-20 pb-6 md:pb-12 px-6 md:px-12 flex-1 order-2 md:order-1 min-h-[50vh] md:min-h-screen min-w-0">
            {/* Warm/amber overlay for owner side */}
            <div className="absolute inset-0 bg-amber-900/50 backdrop-blur-[2px] -z-10" />

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

              <p className="text-sm md:text-base text-white/80 mb-8">
                {t('owner.description')}
              </p>

              <div className="w-full max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={() => setIsOwnerPostMode(true)}
                  className="w-full h-14 px-4 text-left text-sm text-gray-900 bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg hover:bg-white/90 transition-colors flex items-center gap-3 cursor-pointer"
                >
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-gray-500 truncate">{t('owner.postPlaceholder')}</span>
                </button>
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
