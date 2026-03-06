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
import { getSupabaseBrowserClient } from '@shared/database/client';
import { useAuth } from '@/app/contexts/AuthContext';
import * as sessionService from '@shared/lib/prospect/sessionService';
import * as ownerSessionService from '@shared/lib/owner/sessionService';
import { shouldStayOnHomepage, getRedirectPath } from '@shared/lib/routing/redirectHelpers.client';
import { ProspectSession } from '@shared/ai/prospect/types';
import { CrewOnboardingStepsInline, OwnerOnboardingStepsInline } from '@shared/components/onboarding/OnboardingSteps';
import type { OwnerPreferences } from '@shared/ai/owner/types';
import { QuickPostBox } from '@/app/components/QuickPostBox';

// ---------------------------------------------------------------------------
// Rotating hero headline
// ---------------------------------------------------------------------------

const HERO_PHRASES = [
  { lines: ['Find Your Perfect', 'Sailing Crew with'], accent: 'AI Precision' },
  { lines: ['Find Your Sailing', 'Adventure using'], accent: 'AI Matching' },
  { lines: ['Automate Boat', 'Management with'], accent: 'AI insights' },
  { lines: ['Plan Your Routes', 'with'], accent: 'AI Knowledge' },
];

function RotatingHeadline() {
  const [index, setIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % HERO_PHRASES.length);
        setVisible(true);
      }, 350);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const { lines, accent } = HERO_PHRASES[index];

  return (
    <h1
      className={`text-3xl md:text-4xl xl:text-[2.6rem] font-extrabold text-[#0c1f35] leading-[1.1] tracking-tight mb-4 min-h-[8rem] md:min-h-[9rem] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      {lines.map((line, i) => (
        <React.Fragment key={i}>{line}<br /></React.Fragment>
      ))}
      <span className="text-blue-600">{accent}</span>
    </h1>
  );
}

// ---------------------------------------------------------------------------
// Owner post dialog (legacy flow)
// ---------------------------------------------------------------------------

function OwnerPostDialog({
  isOpen, onClose, onSave, title, placeholder,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (crewDemand: string) => void;
  title: string;
  placeholder: string;
}) {
  const [crewDemand, setCrewDemand] = useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => { if (isOpen && textareaRef.current) textareaRef.current.focus(); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/40">
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <textarea ref={textareaRef} value={crewDemand} onChange={(e) => setCrewDemand(e.target.value)} placeholder={placeholder} className="w-full min-h-[200px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none bg-white dark:bg-gray-800 text-gray-950 dark:text-gray-100" />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By submitting, you confirm that AI may process your input to help match crew to your needs.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-amber-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-amber-50">Cancel</button>
          <button onClick={() => onSave(crewDemand.trim())} disabled={!crewDemand.trim()} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature card data for hero
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    title: 'Smart Matching',
    description: 'AI analyzes your experience, skills, risk tolerance, and availability to connect the right crew with the perfect journey. Thousands of compatibility signals — one precise match.',
    accent: 'blue',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: 'Smart Management',
    description: 'AI generates your boat\'s complete equipment inventory and maintenance schedule by model and age. Automated task scheduling, intelligent replacement suggestions, and product sourcing.',
    accent: 'amber',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
    title: 'Smart Routing',
    description: 'AI plans multi-leg routes with precise waypoints, weather-aware timing, and date calculations based on your boat\'s speed. Browse open legs worldwide and join as crew — or post your adventure.',
    accent: 'emerald',
  },
] as const;

const accentMap = {
  blue:    { icon: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-500'    },
  amber:   { icon: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500'   },
  emerald: { icon: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function WelcomePageContent() {
  const t = useTranslations('welcome');
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

  // Auth / redirect check
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (authLoading) return;
      if (!user) { setIsCheckingRole(false); return; }
      try {
        const shouldStay = await shouldStayOnHomepage(user.id);
        if (cancelled) return;
        if (shouldStay) { setIsCheckingRole(false); return; }
        const redirectPath = await getRedirectPath(user.id, 'root');
        if (cancelled) return;
        if (redirectPath && redirectPath !== '/') { router.replace(redirectPath); } else { setIsCheckingRole(false); }
      } catch (error) {
        logger.error('[RootRoute] Failed to determine redirect', { error: error instanceof Error ? error.message : String(error) });
        setIsCheckingRole(false);
      }
    }
    if (user && !authLoading) { check(); } else if (!authLoading) { setIsCheckingRole(false); }
    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  // Crew session
  useEffect(() => {
    async function checkCrewSession() {
      try {
        const res = await fetch('/api/prospect/session', { credentials: 'include' });
        if (!res.ok) return;
        const cookie = await res.json();
        if (!cookie.sessionId || cookie.isNewSession) return;
        const session: ProspectSession | null = await sessionService.loadSession(cookie.sessionId);
        if (session?.conversation?.length) {
          setHasExistingSession(true);
          setSessionType('crew');
          setSessionMessages(session.conversation);
          setOnboardingState(session.onboardingState || 'signup_pending');
          const legs = new Map<string, string>();
          for (const msg of session.conversation) {
            for (const leg of msg.metadata?.legReferences ?? []) {
              if (leg.id && leg.name && !legs.has(leg.id)) legs.set(leg.id, leg.name);
            }
          }
          setSessionLegs(Array.from(legs.entries()).map(([id, name]) => ({ id, name })).slice(0, 4));
        }
      } catch (e) { logger.error('Failed to check crew session', { error: e instanceof Error ? e.message : String(e) }); }
    }
    checkCrewSession();
  }, []);

  // Owner session
  useEffect(() => {
    async function checkOwnerSession() {
      try {
        const res = await fetch('/api/owner/session', { credentials: 'include' });
        if (!res.ok) return;
        const cookie = await res.json();
        if (!cookie.sessionId || cookie.isNewSession) return;
        const session = await ownerSessionService.loadSession(cookie.sessionId);
        if (session?.conversation?.length) {
          setHasOwnerSession(true);
          setOwnerSessionMessages(session.conversation);
          setOwnerSessionPreferences(session.gatheredPreferences || {});
          setOwnerOnboardingState(session.onboardingState || 'signup_pending');
        }
      } catch (e) { logger.error('Failed to check owner session', { error: e instanceof Error ? e.message : String(e) }); }
    }
    checkOwnerSession();
  }, []);

  useEffect(() => {
    if (!user) { setCrewHasProfile(false); setOwnerHasProfile(false); setOwnerHasBoat(false); setOwnerHasJourney(false); }
  }, [user]);

  useEffect(() => {
    if (!user || !hasExistingSession || sessionType !== 'crew') return;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
        setCrewHasProfile(!!data);
      } catch (e) {}
    })();
  }, [user, hasExistingSession, sessionType]);

  useEffect(() => {
    if (!user || !hasOwnerSession) return;
    (async () => {
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
          const { data } = await supabase.from('journeys').select('id').in('boat_id', boatIds).limit(1);
          setOwnerHasJourney((data?.length ?? 0) > 0);
        }
      } catch (e) {}
    })();
  }, [user, hasOwnerSession]);

  const handleCrewPost = (text: string) => {
    const p = new URLSearchParams();
    p.set('profile', text);
    p.set('aiProcessingConsent', 'true');
    router.push(`/welcome/crew?${p.toString()}`);
  };

  const handleOwnerPost = (text: string) => {
    const p = new URLSearchParams();
    p.set('skipperProfile', text);
    p.set('aiProcessingConsent', 'true');
    router.push(`/welcome/owner?${p.toString()}`);
  };

  // Loading spinner
  if (authLoading || (user && isCheckingRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1f35]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  const showCrewColumn = !isOwnerPostMode && !isOwnerComboSearchMode && !hasOwnerSession;
  const showOwnerColumn = isOwnerPostMode || isOwnerComboSearchMode || hasOwnerSession ||
    (!(hasExistingSession && sessionType === 'crew') && !isComboSearchMode);

  return (
    <div data-force-light className="min-h-screen flex flex-col">

      {/* Ocean background — fixed so it covers the full page height */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-20" style={{ backgroundImage: 'url(/homepage-32.jpg)' }} />

      {/* ================================================================
          HERO SECTION
          ================================================================ */}
      <section className="relative min-h-screen flex flex-col">

        {/* Gradient overlay: very light at top, gradually darkens toward bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c1f35]/10 via-[#0c1f35]/10 via-60% to-[#0c1f35]/70" />
        {/* Soft fade into the dark action section below */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-b from-transparent to-[#0c1f35]" />

        {/* Top nav */}
        <nav className="relative z-20 flex items-center justify-between px-5 md:px-10 py-4">
          <div />
          <div className="flex items-center gap-2">
            <Link href="/crew/dashboard" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/25 rounded-lg hover:bg-white/20 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Map
            </Link>
            <Link href="/auth/login" className="px-4 py-2 text-sm font-medium text-[#0c1f35] bg-white rounded-lg shadow hover:bg-white/90 transition-colors">
              Log in
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-8 pt-4">

          {/* Large logo — floats in sky area */}
          <div className="mb-6 md:mb-8">
            <Image
              src="/sailsmart_new_tp.png"
              alt="SailSmart"
              width={188}
              height={188}
              priority
              className="object-contain brightness-0 invert drop-shadow-2xl"
            />
          </div>

          {/* White hero card */}
          <div className="w-full max-w-5xl bg-white md:bg-white backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/60">

            {/* Card body: headline + photo */}
            <div className="grid md:grid-cols-2">
              {/* Left: headline */}
              <div className="flex flex-col justify-center items-center md:items-start text-center md:text-left px-7 md:px-10 py-9 md:py-12">
                <RotatingHeadline />
                <p className="text-gray-500 text-sm md:text-[0.95rem] leading-relaxed max-w-xs">
                  Intelligent matching for sailors and skippers. Plan routes, manage your boat, and connect with the right people — all powered by AI.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-7">
                  <Link href="/welcome/crew-v2" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md">
                    Join as Crew
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  </Link>
                  <Link href="/welcome/owner-v2" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-md">
                    Join as Skipper
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  </Link>
                </div>
              </div>

              {/* Right: sailing photo */}
              <div className="relative hidden md:block overflow-hidden" style={{ minHeight: 280 }}>
                <Image src="/boat-sailing2.gif" alt="Sailing" fill className="object-cover object-center" sizes="(max-width: 768px) 0px, 50vw" priority />
                {/* Fade on left edge to blend */}
                <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white/96 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Feature cards */}
            <div id="features" className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-6 border-t border-gray-100 bg-gray-50/60">
              {FEATURES.map((feature) => {
                const accent = accentMap[feature.accent];
                return (
                  <div key={feature.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center gap-3">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${accent.icon}`}>
                      {feature.icon}
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-1.5">
                        {/*<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${accent.dot}`} /> */}
                        <h3 className="text-sm font-bold text-[#0c1f35]">{feature.title}</h3>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scroll hint */}
          <a href="#action" className="mt-7 flex flex-col items-center gap-1 text-white/55 hover:text-white/85 transition-colors group">
            <span className="text-[11px] font-medium uppercase tracking-widest">Do you have an existing profile?</span>
            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </section>

      {/* ================================================================
          ACTION SECTION — crew & owner search / session panels
          ================================================================ */}
      <section id="action" className="relative flex-1 flex flex-col md:flex-row bg-[#0c1f35]">

        {/* Subtle depth texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Crew column */}
        {showCrewColumn && (
          <div className={`relative z-10 flex items-start justify-center pt-12 md:pt-16 pb-12 px-6 md:px-12 flex-1 min-w-0 ${
            (hasExistingSession && sessionType === 'crew') || isComboSearchMode ? '' : 'order-1 md:order-2'
          }`}>
            {/* Blue top accent */}
            <div className="absolute top-0 left-6 right-6 md:left-12 md:right-12 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

            <div className="w-full text-center text-white max-w-lg">
              {/* Pill label */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/15 border border-blue-400/25 rounded-full text-xs font-semibold text-blue-200 mb-4 tracking-wide">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                For Crew
              </div>

              {/*<h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('crew.title')}</h2>*/}

              {hasExistingSession && sessionType === 'crew' ? (
                <button onClick={() => router.push('/welcome/crew')} className="text-blue-200 hover:text-blue-100 hover:underline text-sm mb-4 transition-colors">
                  {t('crew.' + onboardingState)}
                </button>
              ) : (
                <div className="mb-5">
                  <p className="text-white/75 text-sm md:text-base">{t('crew.subtitle')}</p>
                  <p className="text-white/45 text-xs md:text-sm mt-1">{t('crew.description')}</p>
                </div>
              )}

              {/* Quick post */}
              {!hasExistingSession && (
                <div className={`w-full mx-auto transition-all duration-300 ${isComboSearchMode ? 'max-w-md md:max-w-lg' : 'max-w-[220px] md:max-w-xs'}`}>
                  <QuickPostBox
                    placeholder="Post your sailing profile..."
                    expandedPlaceholder="Tell us about your sailing experience, skills, availability, and what kind of journey you're looking for..."
                    isExpanded={isComboSearchMode}
                    onExpand={() => setIsComboSearchMode(true)}
                    onCancel={() => setIsComboSearchMode(false)}
                    onPost={handleCrewPost}
                    accentColor="blue"
                  />
                </div>
              )}

              {/* Onboarding steps */}
              <div className="w-full mt-6 md:mt-8">
                <CrewOnboardingStepsInline
                  layout="homepage"
                  isAuthenticated={!!user}
                  hasExistingProfile={crewHasProfile}
                  onboardingState={onboardingState}
                  messagesLength={sessionMessages?.length || 0}
                  hasActiveSession={hasExistingSession && sessionType === 'crew'}
                  onCurrentStepClick={() => router.push('/welcome/crew')}
                />
                {hasExistingSession && sessionType === 'crew' && sessionLegs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                    {sessionLegs.map((leg) => (
                      <button key={leg.id} onClick={(e) => {
                        e.stopPropagation();
                        const url = `/crew/dashboard?legId=${leg.id}`;
                        if (window.innerWidth < 768) { window.location.href = url; } else { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                      }} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-white/75 bg-white/[0.08] rounded-full border border-white/10 hover:bg-white/15 transition-colors">
                        <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {leg.name.length > 20 ? leg.name.substring(0, 20) + '…' : leg.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Column divider */}
        {showCrewColumn && showOwnerColumn && !(hasExistingSession && sessionType === 'crew') && !isComboSearchMode && (
          <div className="hidden md:block relative z-10 w-px self-stretch my-14">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          </div>
        )}

        {/* Owner column */}
        {showOwnerColumn && (
          <div className={`relative z-10 flex items-start justify-center pt-12 md:pt-16 pb-12 px-6 md:px-12 flex-1 min-w-0 ${
            isOwnerComboSearchMode || hasOwnerSession ? '' : 'order-2 md:order-1'
          }`}>
            {/* Amber top accent */}
            <div className="absolute top-0 left-6 right-6 md:left-12 md:right-12 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

            <div className="w-full text-center text-white max-w-lg">
              {/* Pill label */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-400/25 rounded-full text-xs font-semibold text-amber-200 mb-4 tracking-wide">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" /></svg>
                For Skippers
              </div>

              {/*<h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('owner.title')}</h2>*/}
              <p className="text-white/75 text-sm md:text-base mb-1">{t('owner.subtitle')}</p>
              <p className="text-white/45 text-xs md:text-sm mb-5">{t('owner.description')}</p>

              {/* Quick post */}
              {!hasOwnerSession && (
                <div className={`w-full mx-auto transition-all duration-300 ${isOwnerComboSearchMode ? 'max-w-md md:max-w-lg' : 'max-w-[220px] md:max-w-xs'}`}>
                  <QuickPostBox
                    placeholder="Post your profile, boat and journey..."
                    expandedPlaceholder="Describe your boat, planned journey, dates, the crew you're looking for, required skills, and any other details..."
                    isExpanded={isOwnerComboSearchMode}
                    onExpand={() => setIsOwnerComboSearchMode(true)}
                    onCancel={() => setIsOwnerComboSearchMode(false)}
                    onPost={handleOwnerPost}
                    accentColor="amber"
                  />
                </div>
              )}

              {/* Onboarding steps */}
              <div className="w-full mt-6 md:mt-8">
                {hasOwnerSession && (
                  <button onClick={() => router.push('/welcome/owner')} className="inline-flex items-center gap-1.5 text-sm text-amber-100 font-medium hover:text-amber-200 hover:underline transition-colors mb-2">
                    {t('owner.continueJourney')}
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                )}
                <OwnerOnboardingStepsInline
                  layout="homepage"
                  isAuthenticated={!!user}
                  hasExistingProfile={ownerHasProfile}
                  hasBoat={ownerHasBoat}
                  hasJourney={ownerHasJourney}
                  onboardingState={ownerOnboardingState}
                  messagesLength={ownerSessionMessages?.length || 0}
                  hasActiveSession={hasOwnerSession}
                  onCurrentStepClick={() => router.push('/welcome/owner')}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <Footer />

      {/* Owner post dialog */}
      {isOwnerPostMode && (
        <OwnerPostDialog
          isOpen={isOwnerPostMode}
          onClose={() => setIsOwnerPostMode(false)}
          onSave={(text) => { handleOwnerPost(text); setIsOwnerPostMode(false); }}
          title={t('owner.postDialogTitle')}
          placeholder={t('owner.postDialogPlaceholder')}
        />
      )}

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} onSwitchToSignup={() => { setIsLoginModalOpen(false); setIsSignupModalOpen(true); }} />
      <SignupModal isOpen={isSignupModalOpen} onClose={() => setIsSignupModalOpen(false)} onSwitchToLogin={() => { setIsSignupModalOpen(false); setIsLoginModalOpen(true); }} />
    </div>
  );
}

export default function WelcomePage() {
  try {
    return <WelcomePageContent />;
  } catch (error) {
    logger.error('[WelcomePage] Failed to render:', { error: error instanceof Error ? error.message : String(error) });
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Welcome</h1>
          <p className="text-muted-foreground mb-8">Unable to load page. Please refresh.</p>
          <button onClick={() => typeof window !== 'undefined' && window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">Refresh</button>
        </div>
      </div>
    );
  }
}
