'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/ui/Button/Button';
import type { OwnerPreferences } from '@/app/lib/ai/owner/types';

export type OnboardingStepStatus = 'completed' | 'current' | 'upcoming';

export interface CrewOnboardingStepsProps {
  isAuthenticated: boolean;
  hasExistingProfile: boolean;
  onboardingState?: string;
  showNumbersOnly?: boolean;
}

export function CrewOnboardingSteps({
  isAuthenticated,
  hasExistingProfile,
  onboardingState,
  messagesLength = 0,
  hasActiveSession = false,
  onCurrentStepClick,
  showNumbersOnly = false,
}: CrewOnboardingStepsProps & { messagesLength?: number; hasActiveSession?: boolean; onCurrentStepClick?: () => void }) {
  const t = useTranslations('onboarding');

  // Consider signup completed if user is authenticated OR has previous interactions
  // BUT respect onboarding_state: if state says signup_pending, don't override to completed
  const hasAccount = isAuthenticated || messagesLength > 0;

  // Determine step completion based on onboardingState
  const onboardingStateMap: Record<string, { signup: boolean; profile: boolean }> = {
    'signup_pending': { signup: false, profile: false },
    'consent_pending': { signup: true, profile: false },
    'profile_pending': { signup: true, profile: false },
    'completed': { signup: true, profile: true },
  };

  const stateCompletion = onboardingStateMap[onboardingState || 'signup_pending'];

  // For signup step: only mark as completed if onboarding state says so OR user is authenticated
  // Don't override signup_pending just because user has session messages
  const signupCompleted = stateCompletion.signup || isAuthenticated;

  const steps = [
    { id: 'signup', label: t('completeSignup'), completed: signupCompleted },
    { id: 'profile', label: t('createProfile'), completed: stateCompletion.profile || hasExistingProfile },
  ];

  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : steps.length - 1;

  return (
    <OnboardingStepsBar
      steps={steps.map((s, i) => ({
        label: s.label,
        status:
          s.completed ? 'completed' : i === activeIndex ? 'current' : 'upcoming',
      }))}
      hasActiveSession={hasActiveSession}
      onCurrentStepClick={onCurrentStepClick}
      userRole="crew"
      showNumbersOnly={showNumbersOnly}
    />
  );
}

export interface OwnerOnboardingStepsProps {
  isAuthenticated: boolean;
  hasExistingProfile: boolean;
  hasBoat: boolean;
  hasJourney: boolean;
  onboardingState?: string;
  preferences?: OwnerPreferences;
  showNumbersOnly?: boolean;
}

export function OwnerOnboardingSteps({
  isAuthenticated,
  hasExistingProfile,
  hasBoat,
  hasJourney,
  onboardingState,
  messagesLength = 0,
  hasActiveSession = false,
  onCurrentStepClick,
  showNumbersOnly = false,
}: OwnerOnboardingStepsProps & { messagesLength?: number; hasActiveSession?: boolean; onCurrentStepClick?: () => void }) {
  const t = useTranslations('onboarding');

  // Consider signup completed if user is authenticated OR has previous interactions
  // BUT respect onboarding_state: if state says signup_pending, don't override to completed
  const hasAccount = isAuthenticated || messagesLength > 0;

  // Determine step completion based on onboardingState
  const onboardingStateMap: Record<string, { signup: boolean; profile: boolean; boat: boolean; journey: boolean }> = {
    'signup_pending': { signup: false, profile: false, boat: false, journey: false },
    'consent_pending': { signup: true, profile: false, boat: false, journey: false },
    'profile_pending': { signup: true, profile: false, boat: false, journey: false },
    'boat_pending': { signup: true, profile: true, boat: false, journey: false },
    'journey_pending': { signup: true, profile: true, boat: true, journey: false },
    'completed': { signup: true, profile: true, boat: true, journey: true },
  };

  const stateCompletion = onboardingStateMap[onboardingState || 'signup_pending'];

  // For signup step: only mark as completed if onboarding state says so OR user is authenticated
  // Don't override signup_pending just because user has session messages
  const signupCompleted = stateCompletion.signup || isAuthenticated;

  const steps = [
    { id: 'signup', label: t('completeSignup'), completed: signupCompleted },
    { id: 'profile', label: t('createProfile'), completed: stateCompletion.profile || hasExistingProfile },
    { id: 'boat', label: t('createBoat'), completed: stateCompletion.boat || hasBoat },
    { id: 'journey', label: t('createFirstJourney'), completed: stateCompletion.journey || hasJourney },
  ];

  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : steps.length - 1;

  return (
    <OnboardingStepsBar
      steps={steps.map((s, i) => ({
        label: s.label,
        status:
          s.completed ? 'completed' : i === activeIndex ? 'current' : 'upcoming',
      }))}
      hasActiveSession={hasActiveSession}
      onCurrentStepClick={onCurrentStepClick}
      userRole="owner"
      showNumbersOnly={showNumbersOnly}
    />
  );
}

export interface OnboardingStepsBarProps {
  steps: Array<{ label: string; status: OnboardingStepStatus }>;
  /** Compact variant for homepage banner (light-on-dark) */
  variant?: 'default' | 'banner';
  /** Homepage: full width, vertical on small screens, horizontal on larger */
  layout?: 'inline' | 'homepage';
  /** Whether there's an active onboarding session */
  hasActiveSession?: boolean;
  /** Callback when current step is clicked */
  onCurrentStepClick?: () => void;
  /** User role to determine navigation route */
  userRole?: 'owner' | 'crew';
  /** Show numbers as text (e.g. "1. Sign-up") instead of circles */
  showNumbersOnly?: boolean;
}

function OnboardingStepsBar({ 
  steps, 
  variant = 'default', 
  layout = 'inline',
  hasActiveSession = false,
  onCurrentStepClick,
  userRole,
  showNumbersOnly = false,
}: OnboardingStepsBarProps) {
  if (steps.length === 0) return null;

  const isBanner = variant === 'banner';
  const isHomepage = layout === 'homepage';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [isStacked, setIsStacked] = React.useState(false);

  React.useEffect(() => {
    if (!isHomepage) {
      setIsStacked(false);
      return;
    }

    const evaluateLayout = () => {
      const container = containerRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;

      const availableWidth = container.clientWidth;
      const requiredWidth = measure.scrollWidth;
      setIsStacked(requiredWidth > availableWidth);
    };

    evaluateLayout();

    const observer = new ResizeObserver(() => {
      evaluateLayout();
    });

    if (containerRef.current) observer.observe(containerRef.current);
    if (measureRef.current) observer.observe(measureRef.current);

    const fontsReady = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
    if (fontsReady) {
      fontsReady.then(() => evaluateLayout()).catch(() => {});
    }

    window.addEventListener('resize', evaluateLayout);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', evaluateLayout);
    };
  }, [isHomepage, steps]);

  return (
    <div
      ref={containerRef}
      className={
        isHomepage
          ? `relative flex items-center justify-center gap-1 sm:gap-2 md:gap-3 w-full py-0.5 min-h-[1.5rem] ${
              isStacked ? 'flex-col' : 'flex-row'
            }`
          : isBanner
            ? 'relative flex items-center justify-center gap-1 sm:gap-2 flex-wrap py-0.5 min-h-[1.5rem] overflow-visible'
            : showNumbersOnly
              ? 'relative flex items-center gap-2 flex-wrap overflow-x-auto overflow-y-visible py-0'
              : 'relative flex items-center gap-1 sm:gap-3 flex-wrap overflow-x-auto overflow-y-visible py-1.5 min-h-[2.5rem]'
      }
      role="progressbar"
      aria-valuenow={
        steps.filter((s) => s.status === 'completed').length + 1
      }
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-label="Onboarding progress"
    >
      {isHomepage && (
        <div
          ref={measureRef}
          className="pointer-events-none absolute left-0 top-0 invisible flex flex-row items-center gap-1 sm:gap-2 md:gap-3 whitespace-nowrap"
          aria-hidden
        >
          {steps.map((step, index) => (
            <React.Fragment key={`measure-${index}`}>
              <div className="flex flex-col items-center gap-1 shrink-0 justify-center">
                <span
                  className={`flex shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isBanner
                      ? step.status === 'completed'
                        ? 'h-9 w-9 bg-white/30 text-white'
                        : step.status === 'current'
                          ? 'h-9 w-9 bg-white/30 text-white ring-2 ring-white border border-white/35'
                          : 'h-9 w-9 bg-white/10 text-white/60 border border-white/25'
                      : step.status === 'completed'
                        ? 'h-8 w-8 bg-primary text-primary-foreground'
                        : step.status === 'current'
                          ? 'h-8 w-8 bg-primary/20 text-primary ring-2 ring-primary'
                          : 'h-8 w-8 bg-muted text-muted-foreground'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <svg
                      className={isBanner ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`text-sm font-medium whitespace-nowrap text-center ${
                    isBanner
                      ? step.status === 'completed'
                        ? 'text-white/60 line-through'
                        : step.status === 'current'
                          ? 'text-white'
                          : 'text-white/60'
                      : step.status === 'completed'
                        ? 'text-muted-foreground line-through'
                        : step.status === 'current'
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-4 md:w-6 rounded shrink-0 ${
                    step.status === 'completed' ? 'bg-white/30' : 'bg-white/10'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      {steps.map((step, index) => {
        const isCurrentStep = step.status === 'current';
        const isClickable = isCurrentStep && hasActiveSession && onCurrentStepClick;
        
        // When showNumbersOnly is true, render as "1. Sign-up" text instead of circles
        if (showNumbersOnly) {
          const stepText = `${index + 1}. ${step.label}`;
          const textClassName = `text-sm font-medium whitespace-nowrap ${
            step.status === 'completed'
              ? 'text-muted-foreground line-through'
              : step.status === 'current'
                ? 'text-foreground font-semibold'
                : 'text-muted-foreground'
          }`;
          
          return (
            <React.Fragment key={index}>
              {isClickable ? (
                <Button
                  onClick={onCurrentStepClick}
                  variant="ghost"
                  className={`!p-0 !h-auto ${textClassName} hover:!underline`}
                  rightIcon={
                    <svg
                      className="inline-block ml-1 h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  }
                  aria-label={`Continue ${step.label}`}
                >
                  {stepText}
                </Button>
              ) : (
                <span className={textClassName}>
                  {stepText}
                </span>
              )}
              {index < steps.length - 1 && (
                <span className="text-muted-foreground mx-2" aria-hidden>•</span>
              )}
            </React.Fragment>
          );
        }
        
        // Original circle rendering for homepage/banner variants
        const wrapperClassName = `!flex !shrink-0 ${isHomepage ? '!flex-col items-center gap-1 justify-center' : 'items-center gap-1.5 sm:gap-2'} ${isClickable ? 'cursor-pointer group' : ''}`;

        return (
        <React.Fragment key={index}>
          {isClickable ? (
            <Button
              className={`!p-0 !h-auto ${wrapperClassName}`}
              onClick={onCurrentStepClick}
              aria-label={`Continue ${step.label}`}
              variant="ghost"
            >
            <span
              className={`flex shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all ${
                isBanner
                  ? step.status === 'completed'
                    ? 'h-9 w-9 bg-white/30 text-white'
                    : step.status === 'current'
                      ? hasActiveSession
                        ? 'h-9 w-9 bg-white/40 text-white ring-2 ring-white border-2 border-white/50 shadow-lg shadow-white/20 animate-pulse'
                        : 'h-9 w-9 bg-white/30 text-white ring-2 ring-white border border-white/35'
                      : 'h-9 w-9 bg-white/10 text-white/60 border border-white/25'
                  : step.status === 'completed'
                    ? 'h-8 w-8 bg-primary text-primary-foreground'
                    : step.status === 'current'
                      ? hasActiveSession
                        ? 'h-8 w-8 bg-primary/30 text-primary ring-2 ring-primary ring-offset-2 shadow-lg shadow-primary/20 animate-pulse'
                        : 'h-8 w-8 bg-primary/20 text-primary ring-2 ring-primary'
                      : 'h-8 w-8 bg-muted text-muted-foreground'
              } hover:scale-110 hover:shadow-xl`}
              aria-hidden
            >
              {step.status === 'completed' ? (
                <svg
                  className={isBanner ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span
              className={`text-sm font-medium whitespace-nowrap ${isHomepage ? 'text-center' : ''} ${
                isBanner
                  ? step.status === 'completed'
                    ? 'text-white/60 line-through'
                    : step.status === 'current'
                      ? hasActiveSession
                        ? 'text-white font-semibold'
                        : 'text-white'
                      : 'text-white/60'
                  : step.status === 'completed'
                    ? 'text-muted-foreground line-through'
                    : step.status === 'current'
                      ? hasActiveSession
                        ? 'text-foreground font-semibold'
                        : 'text-foreground'
                      : 'text-muted-foreground'
              } group-hover:underline`}
            >
              {step.label}
              <svg
                className="inline-block ml-1 h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </Button>
          ) : (
            <div className={wrapperClassName}>
              <span
                className={`flex shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all ${
                  isBanner
                    ? step.status === 'completed'
                      ? 'h-9 w-9 bg-white/30 text-white'
                      : step.status === 'current'
                        ? 'h-9 w-9 bg-white/30 text-white ring-2 ring-white border border-white/35'
                        : 'h-9 w-9 bg-white/10 text-white/60 border border-white/25'
                    : step.status === 'completed'
                      ? 'h-8 w-8 bg-primary text-primary-foreground'
                      : step.status === 'current'
                        ? 'h-8 w-8 bg-primary/20 text-primary ring-2 ring-primary'
                        : 'h-8 w-8 bg-muted text-muted-foreground'
                }`}
                aria-hidden
              >
                {step.status === 'completed' ? (
                  <svg
                    className={isBanner ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`text-sm font-medium whitespace-nowrap ${isHomepage ? 'text-center' : ''} ${
                  isBanner
                    ? step.status === 'completed'
                      ? 'text-white/60 line-through'
                      : step.status === 'current'
                        ? 'text-white'
                        : 'text-white/60'
                    : step.status === 'completed'
                      ? 'text-muted-foreground line-through'
                      : step.status === 'current'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
          )}
          {index < steps.length - 1 && (
            <div
              className={`rounded shrink-0 ${
                isHomepage
                  ? isStacked
                    ? `h-2 w-0.5 ${step.status === 'completed' ? 'bg-white/30' : 'bg-white/10'}`
                    : `h-0.5 w-4 md:w-6 self-start mt-4 ${step.status === 'completed' ? 'bg-white/30' : 'bg-white/10'}`
                  : isBanner
                    ? `h-0.5 w-2 sm:w-3 ${step.status === 'completed' ? 'bg-white/30' : 'bg-white/10'}`
                    : `h-0.5 w-2 sm:w-4 md:w-8 ${step.status === 'completed' ? 'bg-primary' : 'bg-muted'}`
              }`}
              aria-hidden
            />
          )}
        </React.Fragment>
        );
      })}
    </div>
  );
}

export interface OnboardingStepsInlineProps {
  layout?: 'inline' | 'homepage';
}

/** Compact inline steps for homepage banner - same steps/status, different styling */
export function CrewOnboardingStepsInline(
  props: CrewOnboardingStepsProps & OnboardingStepsInlineProps & { messagesLength?: number; hasActiveSession?: boolean; onCurrentStepClick?: () => void }
) {
  const t = useTranslations('onboarding');
  const { layout = 'inline', messagesLength = 0, hasActiveSession = false, onCurrentStepClick, ...stepProps } = props;

  // Consider signup completed if user is authenticated OR has previous interactions
  const hasAccount = stepProps.isAuthenticated || messagesLength > 0;

  // Determine step completion based on onboardingState
  const onboardingStateMap: Record<string, { signup: boolean; profile: boolean }> = {
    'signup_pending': { signup: false, profile: false },
    'consent_pending': { signup: true, profile: false },
    'profile_pending': { signup: true, profile: false },
    'completed': { signup: true, profile: true },
  };

  const stateCompletion = onboardingStateMap[stepProps.onboardingState || 'signup_pending'];

  // For signup step: only mark as completed if onboarding state says so OR user is authenticated
  // Don't override signup_pending just because user has session messages
  const signupCompleted = stateCompletion.signup || stepProps.isAuthenticated;

  const steps = [
    { id: 'signup', label: t('completeSignup'), completed: signupCompleted },
    { id: 'profile', label: t('createProfile'), completed: stateCompletion.profile || stepProps.hasExistingProfile },
  ];
  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : steps.length - 1;

  return (
    <OnboardingStepsBar
      variant="banner"
      layout={layout}
      steps={steps.map((s, i) => ({
        label: s.label,
        status:
          s.completed ? 'completed' : i === activeIndex ? 'current' : 'upcoming',
      }))}
      hasActiveSession={hasActiveSession}
      onCurrentStepClick={onCurrentStepClick}
      userRole="crew"
    />
  );
}

/** Compact inline steps for homepage banner - same steps/status, different styling */
export function OwnerOnboardingStepsInline(
  props: OwnerOnboardingStepsProps & OnboardingStepsInlineProps & { messagesLength?: number; hasActiveSession?: boolean; onCurrentStepClick?: () => void }
) {
  const t = useTranslations('onboarding');
  const { layout = 'inline', messagesLength = 0, hasActiveSession = false, onCurrentStepClick, ...stepProps } = props;

  // Consider signup completed if user is authenticated OR has previous interactions
  const hasAccount = stepProps.isAuthenticated || messagesLength > 0;

  // Determine step completion based on onboardingState
  const onboardingStateMap: Record<string, { signup: boolean; profile: boolean; boat: boolean; journey: boolean }> = {
    'signup_pending': { signup: false, profile: false, boat: false, journey: false },
    'consent_pending': { signup: true, profile: false, boat: false, journey: false },
    'profile_pending': { signup: true, profile: false, boat: false, journey: false },
    'boat_pending': { signup: true, profile: true, boat: false, journey: false },
    'journey_pending': { signup: true, profile: true, boat: true, journey: false },
    'completed': { signup: true, profile: true, boat: true, journey: true },
  };

  const stateCompletion = onboardingStateMap[stepProps.onboardingState || 'signup_pending'];

  // For signup step: only mark as completed if onboarding state says so OR user is authenticated
  // Don't override signup_pending just because user has session messages
  const signupCompleted = stateCompletion.signup || stepProps.isAuthenticated;

  const steps = [
    { id: 'signup', label: t('completeSignup'), completed: signupCompleted },
    { id: 'profile', label: t('createProfile'), completed: stateCompletion.profile || stepProps.hasExistingProfile },
    { id: 'boat', label: t('createBoat'), completed: stateCompletion.boat || stepProps.hasBoat },
    { id: 'journey', label: t('createFirstJourney'), completed: stateCompletion.journey || stepProps.hasJourney },
  ];

  const currentStepIndex = steps.findIndex((s) => !s.completed);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : steps.length - 1;

  return (
    <OnboardingStepsBar
      variant="banner"
      layout={layout}
      steps={steps.map((s, i) => ({
        label: s.label,
        status:
          s.completed ? 'completed' : i === activeIndex ? 'current' : 'upcoming',
      }))}
      hasActiveSession={hasActiveSession}
      onCurrentStepClick={onCurrentStepClick}
      userRole="owner"
    />
  );
}
