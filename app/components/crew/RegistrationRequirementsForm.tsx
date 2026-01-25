'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type QuestionType = 'text' | 'multiple_choice' | 'yes_no' | 'rating';

type Requirement = {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
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
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [hasAIConsent, setHasAIConsent] = useState<boolean | null>(null);
  const [checkingConsent, setCheckingConsent] = useState(false);

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
        console.error('Error checking AI consent:', error);
        setHasAIConsent(null);
      } else {
        setHasAIConsent(data?.ai_processing_consent === true);
      }
    } catch (err) {
      console.error('Error checking AI consent:', err);
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
        setRequirements(data.requirements || []);
        
        // Initialize answers object
        const initialAnswers: Record<string, Answer> = {};
        (data.requirements || []).forEach((req: Requirement) => {
          initialAnswers[req.id] = {
            requirement_id: req.id,
          };
        });
        setAnswers(initialAnswers);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (requirementId: string, value: string | any[] | number) => {
    const requirement = requirements.find((r) => r.id === requirementId);
    if (!requirement) return;

    const newAnswer: Answer = {
      requirement_id: requirementId,
    };

    if (requirement.question_type === 'text' || requirement.question_type === 'yes_no') {
      newAnswer.answer_text = value as string;
    } else {
      // For rating, store as number in answer_json
      newAnswer.answer_json = typeof value === 'number' ? value : value;
    }

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

    requirements.forEach((req) => {
      if (req.is_required) {
        const answer = answers[req.id];
        
        if (!answer) {
          newErrors[req.id] = 'This question is required';
          return;
        }

        if (req.question_type === 'text' || req.question_type === 'yes_no') {
          if (!answer.answer_text || answer.answer_text.trim() === '') {
            newErrors[req.id] = 'This question is required';
          }
        } else {
          if (!answer.answer_json) {
            newErrors[req.id] = 'This question is required';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateAnswers()) {
      console.error(`[RegistrationRequirementsForm] Validation failed, cannot submit`);
      return;
    }

    const answersArray = Object.values(answers).filter(
      (answer) => answer.answer_text || answer.answer_json
    );

    console.log(`[RegistrationRequirementsForm] Submitting form with ${answersArray.length} answers:`, {
      answersCount: answersArray.length,
      requirementsCount: requirements.length,
      notesLength: notes.length,
    });

    if (answersArray.length === 0 && requirements.length > 0) {
      console.error(`[RegistrationRequirementsForm] ❌ No answers provided but requirements exist!`);
      // This shouldn't happen due to validation, but add safety check
      return;
    }

    onComplete(answersArray, notes);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-sm text-muted-foreground">Loading requirements...</div>
      </div>
    );
  }

  if (requirements.length === 0) {
    // No requirements - this form shouldn't be shown
    // Parent component will show regular registration modal instead
    return null;
  }

  // Show notification if auto-approval is enabled and user hasn't given AI consent
  const showConsentNotification = autoApprovalEnabled && hasAIConsent === false && !checkingConsent;

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Registration Questions
        </h3>
        <p className="text-sm text-muted-foreground">
          Please answer the following questions for: <span className="font-medium text-foreground">{legName}</span>
        </p>
      </div>

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

      <div className="space-y-4">
        {requirements.map((requirement, index) => (
          <div key={requirement.id} className="border-b border-border pb-4 last:border-b-0">
            <label className="block text-sm font-medium text-foreground mb-2">
              {index + 1}. {requirement.question_text}
              {requirement.is_required && <span className="text-destructive ml-1">*</span>}
            </label>

            {requirement.question_type === 'text' && (
              <textarea
                value={answers[requirement.id]?.answer_text || ''}
                onChange={(e) => handleAnswerChange(requirement.id, e.target.value)}
                className={`w-full px-3 py-2 border rounded-md text-sm text-foreground bg-input-background focus:outline-none focus:ring-2 focus:ring-ring ${
                  errors[requirement.id] ? 'border-destructive' : 'border-border'
                }`}
                rows={3}
                placeholder="Your answer..."
              />
            )}

            {requirement.question_type === 'yes_no' && (
              <div className="flex gap-4">
                {['Yes', 'No'].map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`requirement-${requirement.id}`}
                      value={option}
                      checked={answers[requirement.id]?.answer_text === option}
                      onChange={(e) => handleAnswerChange(requirement.id, e.target.value)}
                      className="w-4 h-4 text-primary border-border focus:ring-ring"
                    />
                    <span className="text-sm text-foreground">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {requirement.question_type === 'multiple_choice' && requirement.options && (
              <div className="space-y-2">
                {requirement.options.map((option, optIndex) => (
                  <label key={optIndex} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`requirement-${requirement.id}`}
                      value={option}
                      checked={answers[requirement.id]?.answer_json === option}
                      onChange={(e) => handleAnswerChange(requirement.id, e.target.value)}
                      className={`w-4 h-4 text-primary border-border focus:ring-ring ${
                        errors[requirement.id] ? 'border-destructive' : ''
                      }`}
                    />
                    <span className="text-sm text-foreground">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {requirement.question_type === 'rating' && (
              <div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={answers[requirement.id]?.answer_json || 5}
                  onChange={(e) => handleAnswerChange(requirement.id, parseInt(e.target.value))}
                  className={`w-full ${errors[requirement.id] ? 'border-destructive' : ''}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1</span>
                  <span className="font-medium text-foreground">
                    {answers[requirement.id]?.answer_json || 5}
                  </span>
                  <span>10</span>
                </div>
              </div>
            )}

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

      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isRegistering}
          className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isRegistering}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRegistering ? 'Registering...' : 'Submit Registration'}
        </button>
      </div>
    </div>
  );
}
