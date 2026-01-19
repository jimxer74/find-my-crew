'use client';

import { useEffect, useState } from 'react';
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

type RequirementsManagerProps = {
  journeyId: string | null;
  onRequirementsChange?: () => void;
};

export function RequirementsManager({ journeyId, onRequirementsChange }: RequirementsManagerProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  const [autoApprovalThreshold, setAutoApprovalThreshold] = useState(80);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState<Partial<Requirement>>({
    question_text: '',
    question_type: 'text',
    options: null,
    is_required: true,
    weight: 5,
  });

  useEffect(() => {
    if (journeyId) {
      loadRequirements();
      loadAutoApprovalSettings();
    } else {
      setRequirements([]);
      setAutoApprovalEnabled(false);
      setAutoApprovalThreshold(80);
    }
  }, [journeyId]);

  const loadRequirements = async () => {
    if (!journeyId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/journeys/${journeyId}/requirements`);
      if (response.ok) {
        const data = await response.json();
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAutoApprovalSettings = async () => {
    if (!journeyId) return;
    
    try {
      const response = await fetch(`/api/journeys/${journeyId}/auto-approval`);
      if (response.ok) {
        const data = await response.json();
        setAutoApprovalEnabled(data.auto_approval_enabled || false);
        setAutoApprovalThreshold(data.auto_approval_threshold || 80);
      }
    } catch (error) {
      console.error('Error loading auto-approval settings:', error);
    }
  };

  const handleToggleAutoApproval = async (enabled: boolean) => {
    if (!journeyId) return;
    
    if (enabled && requirements.length === 0) {
      alert('Please add at least one requirement before enabling auto-approval');
      return;
    }

    try {
      const response = await fetch(`/api/journeys/${journeyId}/auto-approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_approval_enabled: enabled,
          auto_approval_threshold: autoApprovalThreshold,
        }),
      });

      if (response.ok) {
        setAutoApprovalEnabled(enabled);
        onRequirementsChange?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update auto-approval settings');
      }
    } catch (error) {
      console.error('Error updating auto-approval:', error);
      alert('Failed to update auto-approval settings');
    }
  };

  const handleThresholdChange = async (threshold: number) => {
    if (!journeyId) return;
    
    setAutoApprovalThreshold(threshold);
    
    try {
      const response = await fetch(`/api/journeys/${journeyId}/auto-approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_approval_enabled: autoApprovalEnabled,
          auto_approval_threshold: threshold,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update threshold');
        // Revert on error
        loadAutoApprovalSettings();
      }
    } catch (error) {
      console.error('Error updating threshold:', error);
      loadAutoApprovalSettings();
    }
  };

  const handleSaveRequirement = async () => {
    if (!journeyId) return;
    
    const requirement = editingRequirement;
    if (!requirement.question_text?.trim()) {
      alert('Question text is required');
      return;
    }

    if (requirement.question_type === 'multiple_choice' && (!requirement.options || requirement.options.length === 0)) {
      alert('Multiple choice questions must have at least one option');
      return;
    }

    try {
      const url = isEditing
        ? `/api/journeys/${journeyId}/requirements/${isEditing}`
        : `/api/journeys/${journeyId}/requirements`;
      
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: requirement.question_text,
          question_type: requirement.question_type,
          options: requirement.question_type === 'multiple_choice' ? requirement.options : null,
          is_required: requirement.is_required ?? true,
          weight: requirement.weight ?? 5,
          order: requirement.order ?? requirements.length,
        }),
      });

      if (response.ok) {
        await loadRequirements();
        setIsAdding(false);
        setIsEditing(null);
        setEditingRequirement({
          question_text: '',
          question_type: 'text',
          options: null,
          is_required: true,
          weight: 5,
        });
        onRequirementsChange?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save requirement');
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
      alert('Failed to save requirement');
    }
  };

  const handleDeleteRequirement = async (id: string) => {
    if (!journeyId) return;
    if (!confirm('Are you sure you want to delete this requirement? This will also delete all answers to this question.')) {
      return;
    }

    try {
      const response = await fetch(`/api/journeys/${journeyId}/requirements/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadRequirements();
        // If no requirements left, disable auto-approval
        if (requirements.length === 1 && autoApprovalEnabled) {
          await handleToggleAutoApproval(false);
        }
        onRequirementsChange?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete requirement');
      }
    } catch (error) {
      console.error('Error deleting requirement:', error);
      alert('Failed to delete requirement');
    }
  };

  const handleEditRequirement = (requirement: Requirement) => {
    setIsEditing(requirement.id);
    setEditingRequirement({
      question_text: requirement.question_text,
      question_type: requirement.question_type,
      options: requirement.options || null,
      is_required: requirement.is_required,
      weight: requirement.weight,
      order: requirement.order,
    });
    setIsAdding(false);
  };

  const handleCancelEdit = () => {
    setIsAdding(false);
    setIsEditing(null);
    setEditingRequirement({
      question_text: '',
      question_type: 'text',
      options: null,
      is_required: true,
      weight: 5,
    });
  };

  if (!journeyId) {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <p className="text-sm text-muted-foreground">Save the journey first to add requirements</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h3 className="text-lg font-semibold text-foreground mb-4">Automated Approval Requirements</h3>

      {/* Auto-Approval Toggle */}
      <div className="mb-4 p-4 bg-accent/50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApprovalEnabled}
                onChange={(e) => handleToggleAutoApproval(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm font-medium text-foreground">Enable Automated Approval</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              AI will automatically approve registrations that meet the threshold
            </p>
          </div>
        </div>

        {autoApprovalEnabled && (
          <div className="ml-6 mt-3">
            <label className="block text-sm text-foreground mb-2">
              Auto-Approval Threshold: {autoApprovalThreshold}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={autoApprovalThreshold}
              onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Registrations with match score above {autoApprovalThreshold}% will be auto-approved
            </p>
          </div>
        )}

        {autoApprovalEnabled && requirements.length === 0 && (
          <div className="ml-6 mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Add at least one requirement for auto-approval to work
          </div>
        )}
      </div>

      {/* Requirements List */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-foreground">Requirements ({requirements.length})</h4>
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setIsEditing(null);
              setEditingRequirement({
                question_text: '',
                question_type: 'text',
                options: null,
                is_required: true,
                weight: 5,
              });
            }}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Requirement
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading requirements...</div>
        ) : requirements.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            No requirements yet. Add questions that crew members must answer when registering.
          </div>
        ) : (
          <div className="space-y-2">
            {requirements.map((req) => (
              <div key={req.id} className="p-3 border border-border rounded-lg bg-card">
                {isEditing === req.id ? (
                  <RequirementForm
                    requirement={editingRequirement}
                    onChange={setEditingRequirement}
                    onSave={handleSaveRequirement}
                    onCancel={handleCancelEdit}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {req.is_required && 'Required'} • Weight: {req.weight}/10 • {req.question_type}
                          </span>
                        </div>
                        <p className="text-sm text-foreground font-medium">{req.question_text}</p>
                        {req.question_type === 'multiple_choice' && req.options && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Options: {req.options.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          type="button"
                          onClick={() => handleEditRequirement(req)}
                          className="text-xs text-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequirement(req.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Requirement Form */}
      {isAdding && (
        <div className="p-4 border border-border rounded-lg bg-accent/30">
          <RequirementForm
            requirement={editingRequirement}
            onChange={setEditingRequirement}
            onSave={handleSaveRequirement}
            onCancel={handleCancelEdit}
          />
        </div>
      )}
    </div>
  );
}

type RequirementFormProps = {
  requirement: Partial<Requirement>;
  onChange: (req: Partial<Requirement>) => void;
  onSave: () => void;
  onCancel: () => void;
};

function RequirementForm({ requirement, onChange, onSave, onCancel }: RequirementFormProps) {
  const handleAddOption = () => {
    const options = requirement.options || [];
    onChange({ ...requirement, options: [...options, ''] });
  };

  const handleOptionChange = (index: number, value: string) => {
    const options = requirement.options || [];
    options[index] = value;
    onChange({ ...requirement, options: [...options] });
  };

  const handleRemoveOption = (index: number) => {
    const options = requirement.options || [];
    onChange({ ...requirement, options: options.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Question Text *</label>
        <textarea
          value={requirement.question_text || ''}
          onChange={(e) => onChange({ ...requirement, question_text: e.target.value })}
          className="w-full px-2 py-1 text-sm border border-border bg-input-background rounded"
          rows={2}
          placeholder="e.g., Do you have experience with night sailing?"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Question Type *</label>
        <select
          value={requirement.question_type || 'text'}
          onChange={(e) => {
            const newType = e.target.value as QuestionType;
            onChange({
              ...requirement,
              question_type: newType,
              options: newType === 'multiple_choice' ? [''] : null,
            });
          }}
          className="w-full px-2 py-1 text-sm border border-border bg-input-background rounded"
        >
          <option value="text">Text</option>
          <option value="yes_no">Yes/No</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="rating">Rating (1-10)</option>
        </select>
      </div>

      {requirement.question_type === 'multiple_choice' && (
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Options *</label>
          <div className="space-y-2">
            {(requirement.options || []).map((option, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-border bg-input-background rounded"
                  placeholder={`Option ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOption}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Option
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requirement.is_required ?? true}
              onChange={(e) => onChange({ ...requirement, is_required: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-xs text-foreground">Required</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Weight: {requirement.weight ?? 5}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={requirement.weight ?? 5}
            onChange={(e) => onChange({ ...requirement, weight: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-sm border border-border rounded hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  );
}
