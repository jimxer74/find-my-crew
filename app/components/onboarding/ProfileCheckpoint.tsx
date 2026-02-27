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

interface ProfileData {
  displayName: string;
  experienceLevel?: number | null;
  aboutMe?: string | null;
}

interface ProfileCheckpointProps {
  userId: string;
  profile: ProfileData;
  onSaved: () => void;
}

export function ProfileCheckpoint({ userId, profile, onSaved }: ProfileCheckpointProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<ProfileData>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!data.displayName?.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // Derive username from display name
      const username = data.displayName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 20) + '_' + Math.floor(Math.random() * 1000);

      const { error: upsertErr } = await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: data.displayName.trim(),
          username,
          user_description: data.aboutMe?.trim() ?? null,
          sailing_experience: data.experienceLevel ?? null,
          roles: ['owner'],
        },
        { onConflict: 'id' }
      );

      if (upsertErr) throw new Error(upsertErr.message);
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
    { label: 'About', value: data.aboutMe },
  ];

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Your sailor profile</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Edit your details below</p>
        </div>

        <div className="px-5 py-4 space-y-4">
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

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              About me (optional)
            </label>
            <textarea
              value={data.aboutMe ?? ''}
              onChange={(e) => setData((d) => ({ ...d, aboutMe: e.target.value || null }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Brief description of your sailing background…"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-4 text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="px-5 py-4 border-t border-border bg-muted/20 flex justify-end gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
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
