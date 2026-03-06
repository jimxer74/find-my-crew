'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { Button } from '@shared/ui/Button/Button';
import { CheckpointCard } from './CheckpointCard';
import type { SkillEntry } from './CrewOnboardingV2';

const EXPERIENCE_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Competent Crew',
  3: 'Coastal Skipper',
  4: 'Offshore Skipper',
};

interface ProfileData {
  displayName: string;
  experienceLevel?: number | null;
  aboutMe?: string | null;
  skills?: SkillEntry[] | null;
}

interface ProfileCheckpointProps {
  userId: string;
  email?: string;
  profile: ProfileData;
  onSaved: () => void;
}

export function ProfileCheckpoint({ userId, email, profile, onSaved }: ProfileCheckpointProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<ProfileData>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');

  // ---------------------------------------------------------------------------
  // Skill helpers
  // ---------------------------------------------------------------------------

  const handleAddSkill = () => {
    const skillName = newSkill.trim().toLowerCase();
    if (!skillName) return;
    if (data.skills?.some((s) => s.skill_name === skillName)) {
      setError('This skill is already added');
      return;
    }
    setData((d) => ({
      ...d,
      skills: [...(d.skills ?? []), { skill_name: skillName, description: '' }],
    }));
    setNewSkill('');
    setError(null);
  };

  const handleRemoveSkill = (skillName: string) => {
    setData((d) => ({
      ...d,
      skills: (d.skills ?? []).filter((s) => s.skill_name !== skillName),
    }));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleSave = async () => {
    if (!data.displayName?.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // Generate a collision-resistant username using a base36 timestamp suffix
      const base = data.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'sailor';
      const suffix = Date.now().toString(36).slice(-5); // 5 base36 chars ≈ 60M combinations
      const username = `${base}${suffix}`;

      // Serialize each SkillEntry to a JSON string for storage in the text[] column
      const serializedSkills = (data.skills ?? []).map((s) => JSON.stringify(s));

      const { error: upsertErr } = await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: data.displayName.trim(),
          username,
          email: email ?? null,
          user_description: data.aboutMe?.trim() ?? null,
          sailing_experience: data.experienceLevel ?? null,
          skills: serializedSkills,
          roles: ['owner'],
        },
        { onConflict: 'id' }
      );

      if (upsertErr) throw new Error(upsertErr.message);

      // Invalidate the profile cache immediately so FeatureGate and other consumers
      // see the newly created profile without waiting for the 5-minute TTL to expire.
      window.dispatchEvent(new CustomEvent('profileUpdated', { detail: { immediate: true } }));

      onSaved();
    } catch (err) {
      logger.error('[ProfileCheckpoint] Save failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const fields = [
    { label: 'Name', value: data.displayName },
    {
      label: 'Experience',
      value: data.experienceLevel
        ? EXPERIENCE_LABELS[data.experienceLevel] ?? `Level ${data.experienceLevel}`
        : null,
    },
    {
      label: 'Skills',
      value:
        data.skills && data.skills.length > 0
          ? data.skills.map((s) => s.skill_name).join(', ')
          : null,
    },
    { label: 'About', value: data.aboutMe },
  ];

  if (isEditing) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Your sailor profile</h3>
          <p className="text-sm text-gray-500 mt-0.5">Edit your details below</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.displayName}
              onChange={(e) => setData((d) => ({ ...d, displayName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Sailing experience
            </label>
            <select
              value={data.experienceLevel ?? ''}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  experienceLevel: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Not specified</option>
              {Object.entries(EXPERIENCE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Skills */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Sailing skills
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Type a skill and press Enter"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                disabled={!newSkill.trim()}
                className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {data.skills && data.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((skill) => (
                  <span
                    key={skill.skill_name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                  >
                    {skill.skill_name}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill.skill_name)}
                      className="text-primary/70 hover:text-primary leading-none"
                      aria-label={`Remove ${skill.skill_name}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              About me (optional)
            </label>
            <textarea
              value={data.aboutMe ?? ''}
              onChange={(e) => setData((d) => ({ ...d, aboutMe: e.target.value || null }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Brief description of your sailing background…"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-4 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/80 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIsEditing(false); setError(null); }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 mb-2">
          {error}
        </div>
      )}
      <CheckpointCard
        title="Your sailor profile"
        subtitle="We'll save this to get you started"
        fields={fields}
        onConfirm={handleSave}
        onEdit={() => setIsEditing(true)}
        isLoading={isSaving}
        confirmLabel="Looks good, save profile"
        variant="required"
      />
    </>
  );
}
