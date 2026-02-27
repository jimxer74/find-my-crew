'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { CheckpointCard } from './CheckpointCard';

interface BoatData {
  makeModel: string;
  homePort: string;
  yearBuilt?: number | null;
  loa_m?: number | null;
  type?: string | null;
}

interface BoatCheckpointProps {
  userId: string;
  boat: BoatData;
  onSaved: (boatId: string) => void;
}

export function BoatCheckpoint({ userId, boat, onSaved }: BoatCheckpointProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState<BoatData>(boat);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!data.makeModel?.trim()) {
      setError('Boat make/model is required');
      return;
    }
    if (!data.homePort?.trim()) {
      setError('Home port is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data: inserted, error: insertErr } = await supabase
        .from('boats')
        .insert({
          owner_id: userId,
          name: data.makeModel.trim(),
          make_model: data.makeModel.trim(),
          home_port: data.homePort.trim(),
          year_built: data.yearBuilt ?? null,
          loa_m: data.loa_m ?? null,
          type: data.type ?? null,
          status: 'active',
        })
        .select('id')
        .single();

      if (insertErr) throw new Error(insertErr.message);
      if (!inserted?.id) throw new Error('No boat ID returned');

      onSaved(inserted.id);
    } catch (err) {
      logger.error('[BoatCheckpoint] Save failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to save boat');
    } finally {
      setIsSaving(false);
    }
  };

  const fields = [
    { label: 'Make / Model', value: data.makeModel },
    { label: 'Home port', value: data.homePort },
    { label: 'Built', value: data.yearBuilt },
    { label: 'LOA', value: data.loa_m ? `${data.loa_m} m` : null },
  ];

  if (isEditing) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Your boat</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Edit your boat details</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Make / Model <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.makeModel}
              onChange={(e) => setData((d) => ({ ...d, makeModel: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Beneteau Oceanis 46"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Home port <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.homePort}
              onChange={(e) => setData((d) => ({ ...d, homePort: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Helsinki, Finland"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Year built (optional)
              </label>
              <input
                type="number"
                value={data.yearBuilt ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    yearBuilt: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                min={1900}
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 1995"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                LOA in metres (optional)
              </label>
              <input
                type="number"
                value={data.loa_m ?? ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    loa_m: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                step="0.1"
                min={0}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 14.2"
              />
            </div>
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
        title="Your boat"
        subtitle="We'll register this boat on your behalf"
        fields={fields}
        onConfirm={handleSave}
        onEdit={() => setIsEditing(true)}
        isLoading={isSaving}
        confirmLabel="Looks good, save boat"
        variant="required"
      />
    </>
  );
}
