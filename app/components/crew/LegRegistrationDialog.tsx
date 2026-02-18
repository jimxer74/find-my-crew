'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLegRegistration, LegRegistrationData } from '@/app/hooks/useLegRegistration';
import { RegistrationRequirementsForm } from './RegistrationRequirementsForm';
import { RegistrationSuccessModal } from './RegistrationSuccessModal';
import { PassportVerificationStep } from './PassportVerificationStep';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';

type LegRegistrationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  leg?: LegRegistrationData | null;
  legId?: string | null;
  onSuccess?: () => void;
};

export function LegRegistrationDialog({
  isOpen,
  onClose,
  leg: providedLeg,
  legId,
  onSuccess,
}: LegRegistrationDialogProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showPassportStep, setShowPassportStep] = useState(false);
  const [showRequirementsForm, setShowRequirementsForm] = useState(false);
  const [showSimpleForm, setShowSimpleForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [requirementsChecked, setRequirementsChecked] = useState(false);
  const [passportVerificationComplete, setPassportVerificationComplete] = useState(false);
  const [passportData, setPassportData] = useState<{ passport_document_id: string; photo_file?: Blob } | null>(null);
  const [leg, setLeg] = useState<LegRegistrationData | null>(providedLeg || null);
  const [loadingLeg, setLoadingLeg] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{ auto_approved: boolean } | null>(null);

  // Fetch leg data if only legId is provided
  useEffect(() => {
    if (isOpen && legId && !leg) {
      setLoadingLeg(true);
      setRegistrationError(null);
      fetch(`/api/legs/${legId}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to fetch leg');
          }
          return res.json();
        })
        .then((data) => {
          if (data.leg_id && data.journey_id) {
            setLeg({
              leg_id: data.leg_id,
              journey_id: data.journey_id,
              leg_name: data.leg_name || 'Unknown Leg',
              journey_name: data.journey_name || 'Unknown Journey',
            });
          } else {
            throw new Error('Invalid leg data received');
          }
        })
        .catch((err) => {
          console.error('Error fetching leg:', err);
          setRegistrationError('Failed to load leg information');
        })
        .finally(() => {
          setLoadingLeg(false);
        });
    } else if (providedLeg && !leg) {
      setLeg(providedLeg);
    }
    // Reset leg when dialog closes
    if (!isOpen) {
      setLeg(providedLeg || null);
    }
  }, [isOpen, legId, leg, providedLeg]);

  const {
    registrationStatus,
    registrationStatusChecked,
    hasRequirements,
    hasQuestionRequirements,
    hasPassportRequirement,
    passportRequirement,
    autoApprovalEnabled,
    isCheckingRequirements,
    isRegistering,
    registrationError: hookRegistrationError,
    hasProfileSharingConsent,
    checkRequirements,
    submitRegistration,
    setRegistrationError: setHookRegistrationError,
  } = useLegRegistration(leg);

  // Combine hook error with local error
  const displayError = registrationError || hookRegistrationError;

  // Check requirements when dialog opens
  useEffect(() => {
    if (isOpen && leg && !requirementsChecked) {
      setRequirementsChecked(true);
      checkRequirements()
        .then((result) => {
          console.log('[LegRegistrationDialog] Requirements check result:', {
            hasPassportRequirement: result.hasPassportRequirement,
            passportRequirement: result.passportRequirement,
            hasQuestionRequirements: result.hasQuestionRequirements,
            hasRequirements: result.hasRequirements,
            passportVerificationComplete,
          });

          // If passport requirement exists and not yet completed, show passport step first
          if (result.hasPassportRequirement && !passportVerificationComplete) {
            console.log('[LegRegistrationDialog] Showing passport step');
            setShowPassportStep(true);
            setShowRequirementsForm(false);
            setShowSimpleForm(false);
          } else if (result.hasQuestionRequirements) {
            // Otherwise show the requirements form only if there are question-type requirements
            console.log('[LegRegistrationDialog] Showing requirements form');
            setShowRequirementsForm(true);
            setShowSimpleForm(false);
            setShowPassportStep(false);
          } else {
            // No passport or question requirements, show simple form
            console.log('[LegRegistrationDialog] Showing simple form');
            setShowRequirementsForm(false);
            setShowSimpleForm(true);
            setShowPassportStep(false);
          }
        })
        .catch((error) => {
          console.error('[LegRegistrationDialog] Error checking requirements:', error);
          setRegistrationError('Failed to load registration requirements');
          // Show simple form as fallback
          setShowSimpleForm(true);
          setShowRequirementsForm(false);
          setShowPassportStep(false);
        });
    }
    if (!isOpen) {
      setRequirementsChecked(false);
      setShowPassportStep(false);
      setShowRequirementsForm(false);
      setShowSimpleForm(false);
      setNotes('');
      setPassportData(null);
      setPassportVerificationComplete(false);
      setRegistrationError(null);
      setHookRegistrationError(null);
    }
  }, [isOpen, leg, requirementsChecked, passportVerificationComplete, checkRequirements, setHookRegistrationError]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePassportComplete = (data: { passport_document_id: string; photo_file?: Blob }) => {
    setPassportData(data);
    setPassportVerificationComplete(true);
    setShowPassportStep(false);

    // After passport verification, check if we need to show requirements form
    if (hasQuestionRequirements) {
      setShowRequirementsForm(true);
    } else {
      // No requirements form, proceed to simple form
      setShowSimpleForm(true);
    }
  };

  const handlePassportCancel = () => {
    setShowPassportStep(false);
    onClose();
  };

  const handleRequirementsComplete = async (answers: any[], notes: string) => {
    const result = await submitRegistration(answers, notes, passportData || undefined);
    if (result.success) {
      setRegistrationResult({ auto_approved: result.auto_approved || false });
      setShowSuccessModal(true);
      // Don't call onSuccess yet - let user see the success modal first
    }
  };

  const handleSimpleSubmit = async () => {
    const result = await submitRegistration([], notes, passportData || undefined);
    if (result.success) {
      setRegistrationResult({ auto_approved: result.auto_approved || false });
      setShowSuccessModal(true);
      // Don't call onSuccess yet - let user see the success modal first
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setRegistrationResult(null);
    // Now call onSuccess after modal is closed to allow parent to update
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  if (loadingLeg) {
    return createPortal(
      <div
        className={`fixed z-50 ${
          isMobile
            ? 'top-16 left-0 right-0 bottom-0'
            : 'inset-0 flex items-center justify-center bg-black/50 p-4'
        }`}
      >
        <div
          className={`bg-card shadow-xl flex flex-col overflow-hidden ${
            isMobile
              ? 'w-full h-full'
              : 'rounded-lg w-full max-w-2xl max-h-[90vh]'
          }`}
        >
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-muted-foreground">Loading leg information...</span>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!leg) return null;

  // Mobile: Full width dialog under header
  // Desktop: Centered modal dialog
  const dialogContent = (
    <div
      className={`fixed z-50 ${
        isMobile
          ? 'top-16 left-0 right-0 bottom-0'
          : 'top-18 inset-0 flex items-center justify-center bg-black/50 p-4'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className={`bg-card shadow-xl flex flex-col overflow-hidden ${
          isMobile
            ? 'w-full h-full'
            : 'rounded-lg w-full max-w-2xl max-h-[90vh]'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="registration-dialog-title" className="text-lg font-semibold text-foreground">
            Register for {leg.leg_name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {displayError && !isCheckingRequirements && !showPassportStep && !showRequirementsForm && !showSimpleForm ? (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {displayError}
            </div>
          ) : isCheckingRequirements ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-muted-foreground">Checking requirements...</span>
            </div>
          ) : showPassportStep ? (
            passportRequirement ? (
              <PassportVerificationStep
                journeyId={leg.journey_id}
                legName={leg.leg_name}
                requirement={passportRequirement}
                onComplete={handlePassportComplete}
                onCancel={handlePassportCancel}
                isLoading={isRegistering}
                error={displayError || undefined}
              />
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-muted-foreground">Loading passport requirement...</span>
              </div>
            )
          ) : showRequirementsForm ? (
            <RegistrationRequirementsForm
              journeyId={leg.journey_id}
              legName={leg.leg_name}
              onComplete={handleRequirementsComplete}
              onCancel={onClose}
              isRegistering={isRegistering}
              registrationError={displayError}
              autoApprovalEnabled={autoApprovalEnabled}
            />
          ) : showSimpleForm ? (
            <div className="space-y-4">
              {displayError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  {displayError}
                </div>
              )}

              {hasProfileSharingConsent === false && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-700 dark:text-yellow-400 text-sm">
                  Profile sharing consent is required to register for legs. Please update your privacy settings.
                </div>
              )}

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Tell the skipper why you'd like to join this leg..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={isRegistering}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimpleSubmit}
                  disabled={isRegistering || hasProfileSharingConsent === false}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isRegistering ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          ) : hasRequirements && !hasQuestionRequirements ? (
            // Show simple form when there are requirements but no question requirements
            // (e.g., only risk_level, experience_level, skill - which are handled server-side)
            <div className="space-y-4">
              {displayError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  {displayError}
                </div>
              )}

              {hasProfileSharingConsent === false && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-700 dark:text-yellow-400 text-sm">
                  Profile sharing consent is required to register for legs. Please update your privacy settings.
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Your profile will be automatically assessed against the journey requirements. You can provide additional notes below if desired.
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Tell the skipper why you'd like to join this leg..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={isRegistering}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimpleSubmit}
                  disabled={isRegistering || hasProfileSharingConsent === false}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isRegistering ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          ) : !isCheckingRequirements && (hasRequirements || hasQuestionRequirements) ? (
            // Fallback: Show simple form when requirements check is done but no forms are active
            // This handles the case where requirements exist but forms aren't being shown
            <div className="space-y-4">
              {displayError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                  {displayError}
                </div>
              )}

              {hasProfileSharingConsent === false && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-700 dark:text-yellow-400 text-sm">
                  Profile sharing consent is required to register for legs. Please update your privacy settings.
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Your profile will be automatically assessed against the journey requirements. You can provide additional notes below if desired.
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Tell the skipper why you'd like to join this leg..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={isRegistering}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimpleSubmit}
                  disabled={isRegistering || hasProfileSharingConsent === false}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isRegistering ? 'Registering...' : 'Register'}
                </button>
              </div>
            </div>
          ) : !isCheckingRequirements && leg ? (
            // Final fallback: If we have a leg but no content, show a message
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading registration form...</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return (
    <>
      {createPortal(dialogContent, document.body)}
      {leg && (
        <RegistrationSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          autoApproved={registrationResult?.auto_approved || false}
          legName={leg.leg_name}
          journeyName={leg.journey_name}
        />
      )}
    </>
  );
}
