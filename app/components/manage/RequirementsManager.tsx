'use client';

import { useEffect, useState } from 'react';
import { toDisplaySkillName, toCanonicalSkillName } from '@/app/lib/skillUtils';
import skillsConfig from '@/app/config/skills-config.json';

type RequirementType = 'risk_level' | 'experience_level' | 'skill' | 'passport' | 'question';

type Requirement = {
  id: string;
  requirement_type: RequirementType;
  question_text?: string;
  skill_name?: string;
  qualification_criteria?: string;
  weight: number;
  require_photo_validation?: boolean;
  pass_confidence_score?: number;
  is_required: boolean;
  order: number;
};

// Requirement types that can only appear once
const SINGLETON_TYPES: RequirementType[] = ['risk_level', 'experience_level', 'passport'];

const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  risk_level: 'Risk Level Check',
  experience_level: 'Experience Level Check',
  skill: 'Skill Assessment',
  passport: 'Passport Verification',
  question: 'Custom Question',
};

const REQUIREMENT_TYPE_DESCRIPTIONS: Record<RequirementType, string> = {
  risk_level: 'Checks crew comfort level matches journey risk (instant, no AI)',
  experience_level: 'Checks crew experience meets minimum level (instant, no AI)',
  skill: 'AI assesses crew skill description against your criteria',
  passport: 'Verifies crew has a valid passport document on file',
  question: 'AI assesses crew answer against your qualification criteria',
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
  const [addingType, setAddingType] = useState<RequirementType | null>(null);
  const [editingRequirement, setEditingRequirement] = useState<Partial<Requirement>>({});
  const [journeySkills, setJourneySkills] = useState<string[]>([]);

  useEffect(() => {
    if (journeyId) {
      loadRequirements();
      loadAutoApprovalSettings();
      loadJourneySkills();
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

  const loadJourneySkills = async () => {
    if (!journeyId) return;

    try {
      const response = await fetch(`/api/journeys/${journeyId}`);
      if (response.ok) {
        const data = await response.json();
        const journey = data.journey || data;
        setJourneySkills(journey.skills || []);
      }
    } catch (error) {
      console.error('Error loading journey skills:', error);
    }
  };

  const handleAutoApprovalToggle = async (enabled: boolean) => {
    if (!journeyId) return;

    if (enabled && requirements.length === 0) {
      alert('Please add at least one requirement before enabling automated approval');
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
        alert(error.error || 'Failed to update approval settings');
      }
    } catch (error) {
      console.error('Error updating approval settings:', error);
      alert('Failed to update approval settings');
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
        loadAutoApprovalSettings();
      }
    } catch (error) {
      console.error('Error updating threshold:', error);
      loadAutoApprovalSettings();
    }
  };

  const handleStartAdd = (type: RequirementType) => {
    setAddingType(type);
    setIsAdding(true);
    setIsEditing(null);

    // Set defaults based on type
    const defaults: Partial<Requirement> = {
      requirement_type: type,
      is_required: true,
      weight: 5,
    };

    if (type === 'passport') {
      defaults.require_photo_validation = false;
      defaults.pass_confidence_score = 7;
    }

    setEditingRequirement(defaults);
  };

  const handleSaveRequirement = async () => {
    if (!journeyId || !editingRequirement.requirement_type) return;

    const type = editingRequirement.requirement_type;

    // Validate based on type
    if (type === 'question') {
      if (!editingRequirement.question_text?.trim()) {
        alert('Question text is required');
        return;
      }
      if (!editingRequirement.qualification_criteria?.trim()) {
        alert('Qualification criteria is required (describes what a good answer looks like)');
        return;
      }
    }

    if (type === 'skill') {
      if (!editingRequirement.skill_name?.trim()) {
        alert('Skill name is required');
        return;
      }
      if (!editingRequirement.qualification_criteria?.trim()) {
        alert('Qualification criteria is required (describes what skill level is expected)');
        return;
      }
    }

    try {
      const url = isEditing
        ? `/api/journeys/${journeyId}/requirements/${isEditing}`
        : `/api/journeys/${journeyId}/requirements`;

      const method = isEditing ? 'PUT' : 'POST';

      // Build payload based on type
      const payload: Record<string, any> = {
        requirement_type: type,
        is_required: editingRequirement.is_required ?? true,
        order: editingRequirement.order ?? requirements.length,
      };

      if (type === 'question') {
        payload.question_text = editingRequirement.question_text;
        payload.qualification_criteria = editingRequirement.qualification_criteria;
        payload.weight = editingRequirement.weight ?? 5;
      } else if (type === 'skill') {
        payload.skill_name = editingRequirement.skill_name;
        payload.qualification_criteria = editingRequirement.qualification_criteria;
        payload.weight = editingRequirement.weight ?? 5;
      } else if (type === 'passport') {
        payload.require_photo_validation = editingRequirement.require_photo_validation ?? false;
        payload.pass_confidence_score = editingRequirement.pass_confidence_score ?? 7;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await loadRequirements();
        setIsAdding(false);
        setIsEditing(null);
        setAddingType(null);
        setEditingRequirement({});
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
    if (!confirm('Are you sure you want to delete this requirement?')) return;

    try {
      const response = await fetch(`/api/journeys/${journeyId}/requirements/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadRequirements();
        if (requirements.length === 1 && autoApprovalEnabled) {
          await handleAutoApprovalToggle(false);
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
    setIsAdding(false);
    setAddingType(null);
    setEditingRequirement({ ...requirement });
  };

  const handleCancelEdit = () => {
    setIsAdding(false);
    setIsEditing(null);
    setAddingType(null);
    setEditingRequirement({});
  };

  // Determine which singleton types are already added
  const existingSingletonTypes = requirements
    .filter(r => SINGLETON_TYPES.includes(r.requirement_type))
    .map(r => r.requirement_type);

  // Available types for "Add" menu
  const availableTypes: RequirementType[] = (['risk_level', 'experience_level', 'skill', 'passport', 'question'] as RequirementType[])
    .filter(type => !SINGLETON_TYPES.includes(type) || !existingSingletonTypes.includes(type));

  if (!journeyId) {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <p className="text-sm text-muted-foreground">Save the journey first to add requirements</p>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h3 className="text-lg font-semibold text-foreground mb-4">Registration Requirements</h3>

      {/* Approval Settings */}
      <div className="mb-4 p-4 bg-accent/50 rounded-lg">
        <div className="mb-3">
          <p className="text-sm font-medium text-foreground mb-3">Approval Method</p>
          <p className="text-xs text-muted-foreground mb-4">
            Choose how crew registrations are handled for this journey
          </p>

          <div className="space-y-3">
            {/* Manual approval */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border border-border hover:bg-accent/30 transition-colors">
              <input
                type="radio"
                name="approval_type"
                checked={!autoApprovalEnabled}
                onChange={() => handleAutoApprovalToggle(false)}
                className="mt-0.5 w-4 h-4 text-primary border-border focus:ring-ring"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">Manual Approval</div>
                <div className="text-xs text-muted-foreground mt-1">
                  You review and approve or deny each registration request manually.
                </div>
              </div>
            </label>

            {/* Automated Approval */}
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md border border-border hover:bg-accent/30 transition-colors">
              <input
                type="radio"
                name="approval_type"
                checked={autoApprovalEnabled}
                onChange={() => handleAutoApprovalToggle(true)}
                className="mt-0.5 w-4 h-4 text-primary border-border focus:ring-ring"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">Automated Approval</div>
                <div className="text-xs text-muted-foreground mt-1">
                  AI automatically approves registrations that pass all checks and meet the score threshold.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Threshold sliders - only show for automated approval */}
        {autoApprovalEnabled && (
          <div className="mt-4 pt-4 border-t border-border">
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
              Combined weighted AI score from all skill and question assessments must be above {autoApprovalThreshold}% for auto-approval
            </p>
          </div>
        )}

        {autoApprovalEnabled && requirements.length === 0 && (
          <div className="mt-4 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-sm text-yellow-800 dark:text-yellow-200">
            Add at least one requirement for automated approval to work
          </div>
        )}
      </div>

      {/* Requirements List */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-foreground">Requirements ({requirements.length})</h4>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading requirements...</div>
        ) : requirements.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">
            No requirements yet. Add checks that crew members must pass when registering.
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
                    journeySkills={journeySkills}
                  />
                ) : (
                  <RequirementDisplay
                    requirement={req}
                    onEdit={() => handleEditRequirement(req)}
                    onDelete={() => handleDeleteRequirement(req.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Requirement Buttons */}
      {!isAdding && !isEditing && availableTypes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Add Requirement:</p>
          <div className="flex flex-wrap gap-2">
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleStartAdd(type)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                {REQUIREMENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Requirement Form */}
      {isAdding && addingType && (
        <div className="p-4 border border-border rounded-lg bg-accent/30">
          <div className="mb-3">
            <span className="text-xs font-medium text-primary">{REQUIREMENT_TYPE_LABELS[addingType]}</span>
            <p className="text-xs text-muted-foreground">{REQUIREMENT_TYPE_DESCRIPTIONS[addingType]}</p>
          </div>
          <RequirementForm
            requirement={editingRequirement}
            onChange={setEditingRequirement}
            onSave={handleSaveRequirement}
            onCancel={handleCancelEdit}
            journeySkills={journeySkills}
          />
        </div>
      )}
    </div>
  );
}

// --- Display Component ---

function RequirementDisplay({
  requirement,
  onEdit,
  onDelete,
}: {
  requirement: Requirement;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const type = requirement.requirement_type;

  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium px-1.5 py-0.5 bg-primary/10 text-primary rounded">
            {REQUIREMENT_TYPE_LABELS[type]}
          </span>
          {requirement.is_required && (
            <span className="text-xs text-muted-foreground">Required</span>
          )}
          {(type === 'skill' || type === 'question') && (
            <span className="text-xs text-muted-foreground">Weight: {requirement.weight}/10</span>
          )}
        </div>

        {type === 'question' && (
          <>
            <p className="text-sm text-foreground font-medium">{requirement.question_text}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Criteria: {requirement.qualification_criteria}
            </p>
          </>
        )}

        {type === 'skill' && (
          <>
            <p className="text-sm text-foreground font-medium">
              {toDisplaySkillName(requirement.skill_name || '')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Criteria: {requirement.qualification_criteria}
            </p>
          </>
        )}

        {type === 'passport' && (
          <p className="text-sm text-muted-foreground">
            Photo validation: {requirement.require_photo_validation ? 'Required' : 'Not required'}
            {requirement.pass_confidence_score !== undefined && (
              <> | Confidence threshold: {requirement.pass_confidence_score}/10</>
            )}
          </p>
        )}

        {type === 'risk_level' && (
          <p className="text-sm text-muted-foreground">
            Crew comfort level must match journey risk level
          </p>
        )}

        {type === 'experience_level' && (
          <p className="text-sm text-muted-foreground">
            Crew experience must meet minimum journey level
          </p>
        )}
      </div>

      <div className="flex gap-2 ml-4">
        {/* Only show Edit for types with editable fields */}
        {(type === 'question' || type === 'skill' || type === 'passport') && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-destructive hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// --- Form Component ---

type RequirementFormProps = {
  requirement: Partial<Requirement>;
  onChange: (req: Partial<Requirement>) => void;
  onSave: () => void;
  onCancel: () => void;
  journeySkills: string[];
};

function RequirementForm({ requirement, onChange, onSave, onCancel, journeySkills }: RequirementFormProps) {
  const type = requirement.requirement_type;

  // Get available skills from journey or all skills
  const availableSkills = journeySkills.length > 0
    ? journeySkills
    : skillsConfig.general.map(s => s.name);

  return (
    <div className="space-y-3">
      {/* Question-specific fields */}
      {type === 'question' && (
        <>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Question Text *</label>
            <textarea
              value={requirement.question_text || ''}
              onChange={(e) => onChange({ ...requirement, question_text: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-border bg-input-background rounded"
              rows={2}
              placeholder="e.g., Describe your experience with night sailing"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Qualification Criteria *</label>
            <textarea
              value={requirement.qualification_criteria || ''}
              onChange={(e) => onChange({ ...requirement, qualification_criteria: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-border bg-input-background rounded"
              rows={2}
              placeholder="e.g., Should mention watch-keeping experience and comfort in low-visibility conditions"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Describe what constitutes a good answer. AI uses this to score responses.
            </p>
          </div>
        </>
      )}

      {/* Skill-specific fields */}
      {type === 'skill' && (
        <>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Skill *</label>
            <select
              value={requirement.skill_name || ''}
              onChange={(e) => onChange({ ...requirement, skill_name: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-border bg-input-background rounded"
            >
              <option value="">Select a skill...</option>
              {availableSkills.map((skill) => (
                <option key={skill} value={toCanonicalSkillName(skill)}>
                  {toDisplaySkillName(toCanonicalSkillName(skill))}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Qualification Criteria *</label>
            <textarea
              value={requirement.qualification_criteria || ''}
              onChange={(e) => onChange({ ...requirement, qualification_criteria: e.target.value })}
              className="w-full px-2 py-1 text-sm border border-border bg-input-background rounded"
              rows={2}
              placeholder="e.g., Must have experience with celestial navigation or GPS chartplotter"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Describe the expected skill level. AI compares crew descriptions against this.
            </p>
          </div>
        </>
      )}

      {/* Passport-specific fields */}
      {type === 'passport' && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requirement.require_photo_validation ?? false}
              onChange={(e) => onChange({ ...requirement, require_photo_validation: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-xs text-foreground">Require photo-ID validation</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Confidence Threshold: {requirement.pass_confidence_score ?? 7}/10
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={requirement.pass_confidence_score ?? 7}
              onChange={(e) => onChange({ ...requirement, pass_confidence_score: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </>
      )}

      {/* Weight slider for skill and question types */}
      {(type === 'skill' || type === 'question') && (
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
      )}

      {/* No extra fields needed for risk_level and experience_level */}
      {(type === 'risk_level' || type === 'experience_level') && (
        <p className="text-xs text-muted-foreground">
          This check uses the journey&apos;s {type === 'risk_level' ? 'risk level' : 'minimum experience level'} settings and the crew member&apos;s profile. No additional configuration needed.
        </p>
      )}

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
