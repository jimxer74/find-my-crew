'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { CheckpointCard } from './CheckpointCard';

const EXPERIENCE_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Competent Crew',
  3: 'Coastal Skipper',
  4: 'Offshore Skipper',
};

const RISK_LEVELS = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'] as const;

interface ProfileData {
  displayName: string;
  experienceLevel?: number | null;
  bio?: string | null;
  motivation?: string | null;
  sailingPreferences?: string | null;
  skills?: string[] | null;
  riskLevels?: string[] | null;
  preferredDepartureLocation?: string | null;
  preferredArrivalLocation?: string | null;
  availabilityStartDate?: string | null;
  availabilityEndDate?: string | null;
}

interface CrewProfileCheckpointProps {
  userId: string;
  email?: string;
  profile: ProfileData;
  onSaved: () => void;
}

export function CrewProfileCheckpoint({
  userId,
  email,
  profile,
  onSaved,
}: CrewProfileCheckpointProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<ProfileData>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSkill, setNewSkill] = useState('');

  // ---------------------------------------------------------------------------
  // Skill helpers
  // ---------------------------------------------------------------------------

  const handleAddSkill = () => {
    const skill = newSkill.trim().toLowerCase();
    if (!skill) return;
    if (data.skills?.map((s) => s.toLowerCase()).includes(skill)) {
      setError('This skill is already added');
      return;
    }
    setData((d) => ({ ...d, skills: [...(d.skills ?? []), skill] }));
    setNewSkill('');
    setError(null);
  };

  const handleRemoveSkill = (skill: string) => {
    setData((d) => ({ ...d, skills: (d.skills ?? []).filter((s) => s !== skill) }));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  // ---------------------------------------------------------------------------
  // Risk level helpers
  // ---------------------------------------------------------------------------

  const toggleRisk = (risk: string) => {
    setData((d) => {
      const current = d.riskLevels ?? [];
      return {
        ...d,
        riskLevels: current.includes(risk)
          ? current.filter((r) => r !== risk)
          : [...current, risk],
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    setError(null);

    if (!data.displayName?.trim()) {
      setError('Name is required');
      return;
    }
    if (!data.bio?.trim()) {
      setError('Bio is required — it helps owners understand who you are');
      return;
    }
    if (!data.skills || data.skills.length === 0) {
      setError('Please add at least one skill');
      return;
    }

    setIsSaving(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Collision-resistant username
      const base =
        data.displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'sailor';
      const suffix = Date.now().toString(36).slice(-5);
      const username = `${base}${suffix}`;

      // Combine bio + motivation into user_description
      const userDescription = [
        data.bio?.trim(),
        data.motivation?.trim()
          ? `What I love about sailing: ${data.motivation.trim()}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const { error: upsertErr } = await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: data.displayName.trim(),
          username,
          email: email ?? null,
          user_description: userDescription || null,
          sailing_experience: data.experienceLevel ?? null,
          skills: data.skills ?? [],
          sailing_preferences: data.sailingPreferences?.trim() ?? null,
          risk_level: data.riskLevels ?? [],
          preferred_departure_location: data.preferredDepartureLocation
            ? { name: data.preferredDepartureLocation.trim() }
            : null,
          preferred_arrival_location: data.preferredArrivalLocation
            ? { name: data.preferredArrivalLocation.trim() }
            : null,
          availability_start_date: data.availabilityStartDate ?? null,
          availability_end_date: data.availabilityEndDate ?? null,
          roles: ['crew'],
        },
        { onConflict: 'id' }
      );

      if (upsertErr) throw new Error(upsertErr.message);

      // Invalidate profile cache
      window.dispatchEvent(new CustomEvent('profileUpdated', { detail: { immediate: true } }));

      onSaved();
    } catch (err) {
      logger.error('[CrewProfileCheckpoint] Save failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values for preview
  // ---------------------------------------------------------------------------

  const availabilityText =
    data.availabilityStartDate && data.availabilityEndDate
      ? `${data.availabilityStartDate} → ${data.availabilityEndDate}`
      : data.availabilityStartDate
      ? `From ${data.availabilityStartDate}`
      : data.availabilityEndDate
      ? `Until ${data.availabilityEndDate}`
      : null;

  const previewFields = [
    { label: 'Name', value: data.displayName },
    {
      label: 'Experience',
      value: data.experienceLevel
        ? EXPERIENCE_LABELS[data.experienceLevel] ?? `Level ${data.experienceLevel}`
        : null,
    },
    {
      label: 'Skills',
      value: data.skills && data.skills.length > 0 ? data.skills.join(', ') : null,
    },
    { label: 'About me', value: data.bio },
    { label: 'Available', value: availabilityText },
  ];

  // ---------------------------------------------------------------------------
  // Edit mode
  // ---------------------------------------------------------------------------

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Your sailing profile</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete every section — owners read this carefully before approving applications
          </p>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.displayName}
              onChange={(e) => setData((d) => ({ ...d, displayName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Your name"
            />
          </div>

          {/* Experience */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
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
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Skills <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Add sailing, technical, and non-technical skills (e.g. navigation, cooking, first aid)
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Type a skill and press Enter"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                    key={skill}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-primary/70 hover:text-primary leading-none"
                      aria-label={`Remove ${skill}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              About me <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Your sailing background — how you got into sailing, your most memorable voyage, and what makes you a great crew member
            </p>
            <textarea
              value={data.bio ?? ''}
              onChange={(e) => setData((d) => ({ ...d, bio: e.target.value || null }))}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="I've been sailing since… My most memorable voyage was…"
            />
          </div>

          {/* Motivation */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              What excites you most about sailing?
            </label>
            <textarea
              value={data.motivation ?? ''}
              onChange={(e) => setData((d) => ({ ...d, motivation: e.target.value || null }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="e.g. blue-water offshore passages, exploring remote anchorages, racing…"
            />
          </div>

          {/* Risk levels */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              I&apos;m comfortable with:
            </label>
            <div className="space-y-2">
              {RISK_LEVELS.map((risk) => (
                <label key={risk} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={data.riskLevels?.includes(risk) ?? false}
                    onChange={() => toggleRisk(risk)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                    {risk}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Location preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Preferred departure region
              </label>
              <input
                type="text"
                value={data.preferredDepartureLocation ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    preferredDepartureLocation: e.target.value || null,
                  }))
                }
                placeholder="e.g. Mediterranean, Helsinki"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Preferred destination region
              </label>
              <input
                type="text"
                value={data.preferredArrivalLocation ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    preferredArrivalLocation: e.target.value || null,
                  }))
                }
                placeholder="e.g. Caribbean, Canary Islands"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Availability */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">
              Availability for sailing
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">From</span>
                <input
                  type="date"
                  value={data.availabilityStartDate ?? ''}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      availabilityStartDate: e.target.value || null,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Until</span>
                <input
                  type="date"
                  value={data.availabilityEndDate ?? ''}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      availabilityEndDate: e.target.value || null,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="px-5 py-4 border-t border-border bg-muted/20 flex justify-end gap-2">
          <button
            onClick={() => { setIsEditing(false); setError(null); }}
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Review mode (CheckpointCard)
  // ---------------------------------------------------------------------------

  return (
    <>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3 mb-2">
          {error}
        </div>
      )}
      <CheckpointCard
        title="Your sailing profile"
        subtitle="Review your details — owners read this when considering your application"
        fields={previewFields}
        onConfirm={handleSave}
        onEdit={() => { setIsEditing(true); setError(null); }}
        isLoading={isSaving}
        confirmLabel="Looks good, save &amp; continue"
        variant="required"
      />
    </>
  );
}
