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

interface SailboatSuggestion {
  name: string;
  url: string;
  slug: string;
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

  // Search state
  const [searchResults, setSearchResults] = useState<SailboatSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSailboat, setSelectedSailboat] = useState<SailboatSuggestion | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    const query = data.makeModel.trim();
    if (!query || query.length < 2) {
      setSearchError('Enter at least 2 characters to search');
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedSailboat(null);
    try {
      const res = await fetch('/api/sailboatdata/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const result = await res.json();
      setSearchResults(result.suggestions ?? []);
    } catch {
      setSearchError('Search failed. You can proceed with manual entry.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

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
      const makeModelTrimmed = data.makeModel.trim();

      // 1. Try to fetch full details from Algolia (via API route) using selected sailboat
      //    or falling back to make_model search. This handles boats not yet in local registry.
      let algoliaDetails: Record<string, any> | null = null;
      try {
        const detailsRes = await fetch('/api/sailboatdata/fetch-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            make_model: makeModelTrimmed,
            slug: selectedSailboat?.slug ?? undefined,
          }),
        });
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          if (detailsData.boatDetails) {
            algoliaDetails = detailsData.boatDetails;
            logger.debug('[BoatCheckpoint] Algolia details fetched', { make_model: algoliaDetails?.make_model });
          }
        }
      } catch (detailsErr) {
        logger.warn('[BoatCheckpoint] Algolia fetch-details failed, continuing', {
          error: detailsErr instanceof Error ? detailsErr.message : String(detailsErr),
        });
      }

      // 2. Fall back to local boat_registry if Algolia didn't find anything
      let reg: Record<string, any> | null = null;
      if (!algoliaDetails) {
        const { data: regData } = await supabase
          .from('boat_registry')
          .select('*')
          .ilike('make_model', `%${makeModelTrimmed}%`)
          .maybeSingle();
        reg = regData ?? null;
        if (reg) {
          logger.debug('[BoatCheckpoint] Registry match found', { make_model: reg.make_model });
        }
      }

      // Use Algolia details first, then registry, then user-supplied values
      const specs = algoliaDetails ?? reg ?? {};

      const { data: inserted, error: insertErr } = await supabase
        .from('boats')
        .insert({
          owner_id: userId,
          name: makeModelTrimmed,
          make_model: (selectedSailboat?.name ?? specs.make_model ?? makeModelTrimmed),
          home_port: data.homePort.trim(),
          year_built: data.yearBuilt ?? null,
          loa_m: data.loa_m ?? specs.loa_m ?? null,
          type: specs.type ?? data.type ?? null,
          ...(Object.keys(specs).length > 0 && {
            beam_m: specs.beam_m ?? null,
            capacity: specs.capacity ?? null,
            displcmt_m: specs.displcmt_m ?? null,
            average_speed_knots: specs.average_speed_knots ?? null,
            hull_speed_knots: specs.hull_speed_knots ?? null,
            link_to_specs: selectedSailboat?.url ?? specs.link_to_specs ?? null,
            characteristics: specs.characteristics ?? null,
            capabilities: specs.capabilities ?? null,
            accommodations: specs.accommodations ?? null,
            sa_displ_ratio: specs.sa_displ_ratio ?? null,
            ballast_displ_ratio: specs.ballast_displ_ratio ?? null,
            displ_len_ratio: specs.displ_len_ratio ?? null,
            comfort_ratio: specs.comfort_ratio ?? null,
            capsize_screening: specs.capsize_screening ?? null,
            ppi_pounds_per_inch: specs.ppi_pounds_per_inch ?? null,
          }),
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Your boat</h3>
          <p className="text-sm text-gray-500 mt-0.5">Edit your boat details</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Make / Model + Search */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Make / Model <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={data.makeModel}
                onChange={(e) => {
                  setData((d) => ({ ...d, makeModel: e.target.value }));
                  setSelectedSailboat(null);
                  setHasSearched(false);
                  setSearchResults([]);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. Beneteau Oceanis 46"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !data.makeModel.trim() || data.makeModel.trim().length < 2}
                className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              >
                {isSearching ? (
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
                {isSearching ? 'Searching…' : 'Search'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Search sailboatdata.com for specifications</p>

            {/* Search error */}
            {searchError && (
              <p className="mt-1 text-xs text-amber-600">{searchError}</p>
            )}

            {/* Search results */}
            {hasSearched && !isSearching && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200">
                  <p className="text-xs font-medium text-gray-500">
                    {searchResults.length > 0
                      ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`
                      : 'No results found — you can proceed with manual entry'}
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {searchResults.map((result, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        selectedSailboat?.slug === result.slug ? 'bg-blue-50' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="sailboat-checkpoint"
                        checked={selectedSailboat?.slug === result.slug}
                        onChange={() => {
                          setSelectedSailboat(result);
                          setData((d) => ({ ...d, makeModel: result.name }));
                        }}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm text-gray-900">{result.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Selected confirmation */}
            {selectedSailboat && (
              <p className="mt-1 text-xs text-green-600">✓ Selected: {selectedSailboat.name}</p>
            )}
          </div>

          {/* Home port */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Home port <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.homePort}
              onChange={(e) => setData((d) => ({ ...d, homePort: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Helsinki, Finland"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. 1995"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
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

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/80 flex justify-end gap-2">
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5"
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
