'use client';

import { useState, useEffect } from 'react';

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
  onComplete: (answers: Answer[]) => void;
  onCancel: () => void;
};

export function RegistrationRequirementsForm({
  journeyId,
  legName,
  onComplete,
  onCancel,
}: RegistrationRequirementsFormProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRequirements();
  }, [journeyId]);

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

  const handleAnswerChange = (requirementId: string, value: string | any[]) => {
    const requirement = requirements.find((r) => r.id === requirementId);
    if (!requirement) return;

    const newAnswer: Answer = {
      requirement_id: requirementId,
    };

    if (requirement.question_type === 'text' || requirement.question_type === 'yes_no') {
      newAnswer.answer_text = value as string;
    } else {
      newAnswer.answer_json = value;
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
      return;
    }

    const answersArray = Object.values(answers).filter(
      (answer) => answer.answer_text || answer.answer_json
    );

    onComplete(answersArray);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="text-sm text-muted-foreground">Loading requirements...</div>
      </div>
    );
  }

  if (requirements.length === 0) {
    // No requirements, proceed directly
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Registration Requirements
        </h3>
        <p className="text-sm text-muted-foreground">
          Please answer the following questions for: <span className="font-medium text-foreground">{legName}</span>
        </p>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
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

      <div className="flex gap-3 justify-end pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Continue Registration
        </button>
      </div>
    </div>
  );
}
