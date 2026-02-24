'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LoadingButton } from '@/app/components/ui/LoadingButton';
import { Button } from '@/app/components/ui/Button/Button';
import { logger } from '@/app/lib/logger';

type RequirementType = 'risk_level' | 'experience_level' | 'skill' | 'passport' | 'question';

type Requirement = {
  id: string;
  requirement_type: RequirementType;
  question_text?: string;
  skill_name?: string;
  qualification_criteria?: string;
  is_required: boolean;
  weight: number;
  order: number;
};

type Answer = {
  requirement_id: string;
  answer_text?: string;
  answer_json?: any;
};

type RegistrationRequirementsFormProps = {
  journeyId: string;
  legName: string;
  onComplete: (answers: Answer[], notes: string) => void;
  onCancel: () => void;
  isRegistering?: boolean;
  registrationError?: string | null;
  autoApprovalEnabled?: boolean;
};

export function RegistrationRequirementsForm({
  journeyId,
  legName,
  onComplete,
  onCancel,
  isRegistering = false,
  registrationError = null,
  autoApprovalEnabled = false,
}: RegistrationRequirementsFormProps) {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [questionRequirements, setQuestionRequirements] = useState<Requirement[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [hasAIConsent, setHasAIConsent] = useState<boolean | null>(null);
  const [checkingConsent, setCheckingConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRequirements();
  }, [journeyId]);

  // Check user AI consent if auto-approval is enabled
  useEffect(() => {
    if (autoApprovalEnabled && user) {
      checkAIConsent();
    } else {
      setHasAIConsent(null);
    }
  }, [autoApprovalEnabled, user]);

  // Reset submitting state when registration completes (error or success)
  useEffect(() => {
    if (registrationError || !isRegistering) {
      setIsSubmitting(false);
    }
  }, [registrationError, isRegistering]);

  const checkAIConsent = async () => {
    if (!user) {
      setHasAIConsent(null);
      return;
    }

    setCheckingConsent(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('user_consents')
        .select('ai_processing_consent')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error checking AI consent:', { error: error?.message || String(error) });
        setHasAIConsent(null);
      } else {
        setHasAIConsent(data?.ai_processing_consent === true);
      }
    } catch (err) {
      logger.error('Error checking AI consent:', { error: err instanceof Error ? err.message : String(err) });
      setHasAIConsent(null);
    } finally {
      setCheckingConsent(false);
    }
  };

  const loadRequirements = async () => {
    try {
      const response = await fetch(`/api/journeys/${journeyId}/requirements`);
      if (response.ok) {
        const data = await response.json();
        const allReqs: Requirement[] = data.requirements || [];
        setRequirements(allReqs);

        // Only question-type requirements need user answers
        const questionReqs = allReqs.filter(r => r.requirement_type === 'question');
        setQuestionRequirements(questionReqs);

        // Initialize answers for question-type requirements only
        const initialAnswers: Record<string, Answer> = {};
        questionReqs.forEach((req) => {
          initialAnswers[req.id] = {
            requirement_id: req.id,
          };
        });
        setAnswers(initialAnswers);
      }
    } catch (error) {
      logger.error('Error loading requirements:', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (requirementId: string, value: string) => {
    const newAnswer: Answer = {
      requirement_id: requirementId,
      answer_text: value,
    };

    setAnswers((prev) => ({
      ...prev,
      [requirementId]: newAnswer,
    }));

    // Clear error for this requirement
    if (errors[requirementId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[requirementId];
        return newErrors;
      });
    }
  };

  const validateAnswers = (): boolean => {
    const newErrors: Record<string, string> = {};

    questionRequirements.forEach((req) => {
      if (req.is_required) {
        const answer = answers[req.id];

        if (!answer || !answer.answer_text || answer.answer_text.trim() === '') {
          newErrors[req.id] = 'This question is required';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateAnswers()) return;

    const answersArray = Object.values(answers).filter(
      (answer) => answer.answer_text && answer.answer_text.trim() !== ''
    );

    // Set loading state immediately for visual feedback
    setIsSubmitting(true);

    // Call parent's onComplete - will handle actual submission
    onComplete(answersArray, notes);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-sm text-muted-foreground">Loading requirements...</div>
      </div>
    );
  }

  // No question-type requirements to show
  if (questionRequirements.length === 0) {
    return null;
  }

  // Count non-question requirements for info banner
  const autoCheckTypes = requirements.filter(r => r.requirement_type !== 'question');
  const hasAutoChecks = autoCheckTypes.length > 0;

  // Show notification if auto-approval is enabled and user hasn't given AI consent
  const showConsentNotification = autoApprovalEnabled && hasAIConsent === false && !checkingConsent;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Registration Questions
            </h3>
            <p className="text-sm text-muted-foreground">
              Please answer the following questions for: <span className="font-medium text-foreground">{legName}</span>
            </p>
          </div>

          {/* Auto-check info banner */}
          {hasAutoChecks && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Your profile will also be checked for:{' '}
                {autoCheckTypes.map(r => {
                  if (r.requirement_type === 'risk_level') return 'risk level compatibility';
                  if (r.requirement_type === 'experience_level') return 'experience level';
                  if (r.requirement_type === 'skill') return 'sailing skills';
                  if (r.requirement_type === 'passport') return 'passport verification';
                  return r.requirement_type;
                }).join(', ')}
              </p>
            </div>
          )}

          {/* AI Consent Notification */}
          {showConsentNotification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-900 mb-1">
                    AI-Assisted Approval Available
                  </h4>
                  <p className="text-sm text-amber-800 mb-2">
                    This journey uses automated AI assessment for faster approval. To enable AI-assisted approval for your registration, please update your privacy settings. You can also continue without the consent and use manual approval.
                  </p>
                  <Link
                    href="/settings/privacy"
                    className="text-sm font-medium text-amber-900 hover:text-amber-700 underline inline-flex items-center gap-1"
                  >
                    Go to Privacy Settings
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
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Question Requirements */}
          <div className="space-y-4">
            {questionRequirements.map((requirement, index) => (
              <div key={requirement.id} className="border-b border-border pb-4 last:border-b-0">
                <label className="block text-sm font-medium text-foreground mb-2">
                  {index + 1}. {requirement.question_text}
                  {requirement.is_required && <span className="text-destructive ml-1">*</span>}
                </label>

                <textarea
                  value={answers[requirement.id]?.answer_text || ''}
                  onChange={(e) => handleAnswerChange(requirement.id, e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-sm text-foreground bg-input-background focus:outline-none focus:ring-2 focus:ring-ring ${
                    errors[requirement.id] ? 'border-destructive' : 'border-border'
                  }`}
                  rows={3}
                  placeholder="Your answer..."
                />

                {errors[requirement.id] && (
                  <p className="text-xs text-destructive mt-1">{errors[requirement.id]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Additional Notes Field */}
          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell the owner why you're interested in this leg..."
              className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {notes.length}/500 characters
            </p>
          </div>

          {/* Error Display */}
          {registrationError && (
            <div className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {registrationError}
            </div>
          )}
        </div>
      </div>
      {/* End of Scrollable Content */}

      {/* Sticky Footer */}
      <div className="flex-shrink-0 border-t border-border bg-card p-6 pt-4">
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isRegistering}
            variant="outline"
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            onClick={handleSubmit}
            isLoading={isSubmitting || isRegistering}
            disabled={isSubmitting || isRegistering}
            loadingText="Registering..."
            size="md"
            variant="primary"
            fullWidth={false}
          >
            Submit Registration
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}
