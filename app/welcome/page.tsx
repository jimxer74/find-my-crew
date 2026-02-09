'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Footer } from '@/app/components/Footer';
import { LoginModal } from '@/app/components/LoginModal';
import { SignupModal } from '@/app/components/SignupModal';

const STORAGE_KEY = 'prospect_session';

export default function WelcomePage() {
  const t = useTranslations('welcome');
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [sessionType, setSessionType] = useState<'crew' | 'owner' | null>(null);
  const [sessionContext, setSessionContext] = useState<string | null>(null);
  const [sessionLegs, setSessionLegs] = useState<Array<{ id: string; name: string }>>([]);

  // Check for existing conversation on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        // Check if session has messages
        if (session.conversation && session.conversation.length > 0) {
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
          // Convert to array and limit to 4 legs
          const legArray = Array.from(legs.entries()).map(([id, name]) => ({ id, name }));
          setSessionLegs(legArray.slice(0, 4));
        }
      }
    } catch (e) {
      console.error('Failed to check session:', e);
    }
  }, []);

  const handleContinueConversation = () => {
    router.push('/welcome/chat');
  };

  const handleClearSession = async () => {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
    // Clear server cookie
    try {
      await fetch('/api/prospect/session', { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to clear session cookie:', e);
    }
    // Reset state to show full welcome page
    setHasExistingSession(false);
    setSessionType(null);
    setSessionContext(null);
    setSessionLegs([]);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Navigate to chat with the initial query
    router.push(`/welcome/chat?q=${encodeURIComponent(query)}`);
  };

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
        {/* Crew Column (Right on desktop, First on mobile) */}
        <div className={`relative flex items-center justify-center p-6 md:p-12 ${
          hasExistingSession && sessionType === 'crew'
            ? 'flex-1 min-h-screen'
            : 'flex-1 order-1 md:order-2 min-h-[50vh] md:min-h-screen'
        }`}>
          {/* Blue overlay for crew side - only show when dual column */}
          {!(hasExistingSession && sessionType === 'crew') && (
            <div className="absolute inset-0 bg-blue-900/60 backdrop-blur-[2px] -z-10" />
          )}
          {/* Lighter overlay for single column mode */}
          {hasExistingSession && sessionType === 'crew' && (
            <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-[1px] -z-10" />
          )}

          <div className={`w-full text-center text-white ${
            hasExistingSession && sessionType === 'crew' ? 'max-w-full sm:max-w-md md:max-w-2xl' : 'max-w-full sm:max-w-md'
          }`}>
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
{/*}
            <p className="text-lg md:text-xl text-white/90 mb-4 drop-shadow-md">
              {t('crew.subtitle')}
            </p>
*/}      
            <p className="text-sm md:text-base text-white/80 mb-6">
              {t('crew.description')}
            </p>

            {/* Search input */}
            <form onSubmit={handleSearch} className={`w-full mx-auto ${
              hasExistingSession && sessionType === 'crew' ? 'max-w-full sm:max-w-sm md:max-w-lg' : 'max-w-full sm:max-w-sm'
            }`}>
              <div className="relative flex items-center">
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                  placeholder="Where and when do you want to sail?"
                  rows={2}
                  className="w-full px-4 py-3 pr-14 text-sm text-gray-900 bg-white/95 backdrop-blur-sm border-0 rounded-xl shadow-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  disabled={!searchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Search"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="11" cy="11" r="8" strokeWidth="2" />
                    <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
                  </svg>
                </button>
              </div>
            </form>

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
                      <p className="text-sm text-white font-medium">Continue previous conversation</p>
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
                  {/* Clear session button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearSession();
                    }}
                    className="absolute top-1 right-1 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/20 transition-colors"
                    title="Clear and start over"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Leg badges */}
                {sessionLegs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                    {sessionLegs.map((leg) => (
                      <span
                        key={leg.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white/90 bg-white/10 rounded-full border border-white/20"
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
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Owner Column (Left on desktop, Second on mobile) - Hidden when crew session exists */}
        {!(hasExistingSession && sessionType === 'crew') && (
          <div className="flex-1 relative order-2 md:order-1 min-h-[50vh] md:min-h-screen flex items-center justify-center p-6 md:p-12">
            {/* Warm/amber overlay for owner side */}
            <div className="absolute inset-0 bg-amber-900/50 backdrop-blur-[2px] -z-10" />

            <div className="max-w-md text-center text-white">
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

              <button
                disabled
                className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[52px] bg-white/30 text-white/70 rounded-lg font-semibold text-lg cursor-not-allowed border border-white/20"
              >
                {t('owner.cta')}
              </button>
            </div>
          </div>
        )}
      </main>

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
