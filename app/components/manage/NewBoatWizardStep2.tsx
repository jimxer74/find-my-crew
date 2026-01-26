'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

// Sailboat category information (duplicated from BoatFormModal to keep independence)
const sailboatCategories = {
  'Daysailers': {
    description: 'These are small, agile sailboats optimized for short, recreational outings in protected waters like lakes, bays, or calm coastal areas. They prioritize ease of handling, fun, and minimal maintenance over long-term comfort or seaworthiness.',
    characteristics: 'Lightweight construction (often fiberglass or composite), simple rigging (sloop or cat rig), open cockpits, minimal or no cabin, lengths typically 15-30 feet. Shallow draft for easy trailering and launching.',
    capabilities: 'Excellent for day trips, teaching sailing, or racing in light winds. Quick to rig/de-rig, responsive helm, but limited storage and no offshore potential. Top speeds around 5-8 knots.',
    examples: 'Laser, Sunfish, J/22, or Beneteau First 27.',
    prosCons: 'Pros include affordability, portability, and pure sailing joy; cons are exposure to elements and unsuitability for overnights or rough weather.'
  },
  'Coastal cruisers': {
    description: 'Designed for weekend getaways or short hops along the coast, these boats offer basic liveaboard amenities while remaining manageable for small crews or families. They\'re versatile for inshore and near-offshore use but not built for extended ocean passages.',
    characteristics: 'Moderate displacement, fin or wing keels for stability, comfortable cabins with berths, galley, and head. Lengths 25-40 feet, often with inboard engines for motoring in calms.',
    capabilities: 'Good for 1-3 day trips in moderate conditions (up to Force 6 winds). Balanced sail plans for easy single-handing, with some weather resistance but limited tankage for water/fuel. Average speeds 6-8 knots.',
    examples: 'Catalina 30, Hunter 33, or Jeanneau Sun Odyssey 349.',
    prosCons: 'Pros are value for money, spacious interiors for their size, and user-friendly; cons include less robustness in heavy seas and potential for quicker wear in demanding use.'
  },
  'Traditional offshore cruisers': {
    description: 'These are robust, bluewater-capable boats emphasizing safety, comfort, and endurance for long-distance ocean voyages. They draw from classic designs, focusing on seaworthiness over speed.',
    characteristics: 'Heavy displacement hulls (often full or long keels), solid fiberglass or steel construction, deep cockpits for protection, extensive storage. Lengths 35-50 feet, with high ballast ratios for stability.',
    capabilities: 'Ideal for transoceanic crossings or circumnavigations in varied weather. Self-righting in knockdowns, comfortable motion in waves, but slower (5-7 knots average). Large tanks for autonomy (weeks at sea).',
    examples: 'Hallberg-Rassy 38 (as discussed previously), Swan 43, or Amel Super Maramu.',
    prosCons: 'Pros include proven reliability, luxurious wood interiors, and storm-handling; cons are higher cost, slower performance, and more effort to maneuver in tight spaces.'
  },
  'Performance cruisers': {
    description: 'A hybrid category blending cruising comforts with racing-inspired speed and agility. These are for sailors who want efficient passage-making without sacrificing excitement, suitable for both coastal and offshore use.',
    characteristics: 'Lighter displacement, deep fin keels with bulb ballast, fractional rigs for better upwind performance, carbon or advanced composites. Lengths 30-50 feet, with sleek lines and modern sail controls.',
    capabilities: 'Fast passages (8-12 knots), responsive in light airs, and capable of club racing or bluewater rallies. Good for short-handed crews with autopilots and furling systems, but may pound more in heavy seas.',
    examples: 'J/Boats J/121, X-Yachts X4, or Dehler 42.',
    prosCons: 'Pros are thrilling sail handling, efficiency, and modern tech (e.g., electric winches); cons include less interior volume and higher maintenance for high-tech components.'
  },
  'Multihulls': {
    description: 'These feature multiple hulls for enhanced stability, speed, and living space, making them popular for tropical charters or family cruising. They\'re distinct due to their wide beam and shallow draft.',
    characteristics: 'Twin (cat) or three (tri) hulls, often in lightweight composites, bridgedeck cabins, no ballast (relies on form stability). Lengths 30-60 feet, with nets or trampolines for lounging.',
    capabilities: 'Excellent for warm-water cruising or fast ocean transits (10-15+ knots). Minimal heeling for comfort, beachable in shallows, but can be prone to capsize in extremes (though rare in modern designs). Spacious for liveaboards.',
    examples: 'Lagoon 42 (catamaran), Corsair 37 (trimaran), or Fountaine Pajot Isla 40.',
    prosCons: 'Pros include vast deck space, stability at anchor, and fuel efficiency; cons are higher purchase price, wider berthing needs, and less traditional sailing feel.'
  },
  'Expedition sailboats': {
    description: 'Expedition Class Sailboats represent the most rugged and self-sufficient subcategory within offshore sailboats. They are specifically engineered for extreme environments, remote exploration, and prolonged autonomy in challenging or isolated regions.',
    characteristics: 'Typically built with reinforced aluminum or steel hulls, watertight bulkheads, crash boxes, and often ice-class reinforcements. Heavy displacement with full or modified full keels. Lengths usually 45-65 feet.',
    capabilities: 'Extreme self-sufficiency with massive tankage (fuel, water, provisions for 30-60+ days), redundant systems, watermakers, solar/wind power. Excellent in severe conditions. Average speeds 5-8 knots.',
    examples: 'Garcia Exploration series, Bestevaer range, Ovni series, Allures, or Boreal.',
    prosCons: 'Pros include unmatched durability and peace of mind in remote/extreme areas; cons are higher cost, heavier/slower sailing in light winds.'
  }
};

type SailboatCategory = 'Daysailers' | 'Coastal cruisers' | 'Traditional offshore cruisers' | 'Performance cruisers' | 'Multihulls' | 'Expedition sailboats';

export type WizardStep2Data = {
  // From Step 1
  name: string;
  homePort: string;
  homePortLat: number | null;
  homePortLng: number | null;
  countryFlag: string;
  makeModel: string;

  // Form fields
  type: SailboatCategory | null;
  capacity: number | null;
  loa_m: number | null;
  beam_m: number | null;
  max_draft_m: number | null;
  displcmt_m: number | null;
  average_speed_knots: number | null;
  link_to_specs: string;
  characteristics: string;
  capabilities: string;
  accommodations: string;

  // Performance calculations
  sa_displ_ratio: number | null;
  ballast_displ_ratio: number | null;
  displ_len_ratio: number | null;
  comfort_ratio: number | null;
  capsize_screening: number | null;
  hull_speed_knots: number | null;
  ppi_pounds_per_inch: number | null;

  // Images
  images: string[];
};

type NewBoatWizardStep2Props = {
  data: WizardStep2Data;
  onDataChange: (data: WizardStep2Data) => void;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
  userId: string;
};

export function NewBoatWizardStep2({
  data,
  onDataChange,
  onBack,
  onCancel,
  onSave,
  isSaving,
  error,
  userId,
}: NewBoatWizardStep2Props) {
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['capacity', 'loa_m', 'beam_m', 'max_draft_m', 'displcmt_m', 'average_speed_knots'];

    onDataChange({
      ...data,
      [name]: numericFields.includes(name)
        ? value === '' ? null : Number(value)
        : name === 'type'
        ? value === '' ? null : value
        : value,
    });
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setUploadError(null);
    const supabase = getSupabaseBrowserClient();
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          setUploadError('Please upload only image files');
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          setUploadError('Image size must be less than 5MB');
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('boat-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          console.error('Upload error:', uploadErr);
          setUploadError(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('boat-images')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(publicUrl);
      }

      onDataChange({
        ...data,
        images: [...data.images, ...uploadedUrls],
      });
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    onDataChange({
      ...data,
      images: data.images.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="text-muted-foreground">Basic Info</span>
        </div>
        <div className="w-8 h-px bg-primary" />
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            2
          </span>
          <span className="font-medium text-foreground">Details</span>
        </div>
      </div>

      {/* Error Display */}
      {(error || uploadError) && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
          {error || uploadError}
        </div>
      )}

      {/* Summary from Step 1 */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <h4 className="text-sm font-medium text-foreground mb-2">Boat Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span>
            <span className="ml-2 font-medium text-foreground">{data.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Make/Model:</span>
            <span className="ml-2 font-medium text-foreground">{data.makeModel || 'Not specified'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Home Port:</span>
            <span className="ml-2 font-medium text-foreground">{data.homePort || 'Not specified'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Flag:</span>
            <span className="ml-2 font-medium text-foreground">{data.countryFlag || 'Not specified'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Boat Category */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label htmlFor="type" className="block text-sm font-medium text-foreground">
              Sailboat Category
            </label>
            <button
              type="button"
              onClick={() => setShowCategoryInfo(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Show category information"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
          <select
            id="type"
            name="type"
            value={data.type || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select category...</option>
            <option value="Daysailers">Daysailers</option>
            <option value="Coastal cruisers">Coastal cruisers</option>
            <option value="Traditional offshore cruisers">Traditional offshore cruisers</option>
            <option value="Performance cruisers">Performance cruisers</option>
            <option value="Multihulls">Multihulls</option>
            <option value="Expedition sailboats">Expedition sailboats</option>
          </select>
        </div>

        {/* Capacity */}
        <div>
          <label htmlFor="capacity" className="block text-sm font-medium text-foreground mb-1">
            Capacity (people)
          </label>
          <input
            type="number"
            id="capacity"
            name="capacity"
            min="1"
            value={data.capacity || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="e.g., 6"
          />
        </div>

        {/* Length Overall */}
        <div>
          <label htmlFor="loa_m" className="block text-sm font-medium text-foreground mb-1">
            Length Overall (m)
          </label>
          <input
            type="number"
            id="loa_m"
            name="loa_m"
            step="0.01"
            min="0"
            value={data.loa_m || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="e.g., 13.50"
          />
        </div>

        {/* Beam */}
        <div>
          <label htmlFor="beam_m" className="block text-sm font-medium text-foreground mb-1">
            Beam (m)
          </label>
          <input
            type="number"
            id="beam_m"
            name="beam_m"
            step="0.01"
            min="0"
            value={data.beam_m || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="e.g., 4.05"
          />
        </div>

        {/* Max Draft */}
        <div>
          <label htmlFor="max_draft_m" className="block text-sm font-medium text-foreground mb-1">
            Max Draft (m)
          </label>
          <input
            type="number"
            id="max_draft_m"
            name="max_draft_m"
            step="0.01"
            min="0"
            value={data.max_draft_m || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="e.g., 2.00"
          />
        </div>

        {/* Displacement */}
        <div>
          <label htmlFor="displcmt_m" className="block text-sm font-medium text-foreground mb-1">
            Displacement (kg)
          </label>
          <input
            type="number"
            id="displcmt_m"
            name="displcmt_m"
            step="0.1"
            min="0"
            value={data.displcmt_m || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="e.g., 8500"
          />
        </div>

        {/* Average Speed */}
        <div>
          <label htmlFor="average_speed_knots" className="block text-sm font-medium text-foreground mb-1">
            Average Speed (knots)
          </label>
          <input
            type="number"
            id="average_speed_knots"
            name="average_speed_knots"
            step="0.1"
            min="0"
            value={data.average_speed_knots || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="e.g., 6.5"
          />
        </div>

        {/* Link to Specs */}
        <div>
          <label htmlFor="link_to_specs" className="block text-sm font-medium text-foreground mb-1">
            Link to Specifications
          </label>
          <input
            type="url"
            id="link_to_specs"
            name="link_to_specs"
            value={data.link_to_specs}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="https://sailboatdata.com/..."
          />
        </div>

        {/* Characteristics */}
        <div className="md:col-span-2">
          <label htmlFor="characteristics" className="block text-sm font-medium text-foreground mb-1">
            Characteristics
          </label>
          <textarea
            id="characteristics"
            name="characteristics"
            rows={3}
            value={data.characteristics}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
            placeholder="Describe the boat's characteristics..."
          />
        </div>

        {/* Capabilities */}
        <div className="md:col-span-2">
          <label htmlFor="capabilities" className="block text-sm font-medium text-foreground mb-1">
            Capabilities
          </label>
          <textarea
            id="capabilities"
            name="capabilities"
            rows={3}
            value={data.capabilities}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
            placeholder="Describe the boat's capabilities..."
          />
        </div>

        {/* Accommodations */}
        <div className="md:col-span-2">
          <label htmlFor="accommodations" className="block text-sm font-medium text-foreground mb-1">
            Accommodations
          </label>
          <textarea
            id="accommodations"
            name="accommodations"
            rows={3}
            value={data.accommodations}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
            placeholder="Describe the boat's accommodations..."
          />
        </div>

        {/* Performance Calculations - Read Only */}
        {(data.sa_displ_ratio || data.ballast_displ_ratio || data.comfort_ratio || data.hull_speed_knots) && (
          <div className="md:col-span-2 border-t border-border pt-4 mt-2">
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Calculations</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.sa_displ_ratio && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">S.A. / Displ.</div>
                  <div className="text-lg font-medium text-foreground">{data.sa_displ_ratio}</div>
                </div>
              )}
              {data.ballast_displ_ratio && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Bal. / Displ.</div>
                  <div className="text-lg font-medium text-foreground">{data.ballast_displ_ratio}%</div>
                </div>
              )}
              {data.displ_len_ratio && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Disp. / Len.</div>
                  <div className="text-lg font-medium text-foreground">{data.displ_len_ratio}</div>
                </div>
              )}
              {data.comfort_ratio && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Comfort Ratio</div>
                  <div className="text-lg font-medium text-foreground">{data.comfort_ratio}</div>
                </div>
              )}
              {data.capsize_screening && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Capsize Screen.</div>
                  <div className="text-lg font-medium text-foreground">{data.capsize_screening}</div>
                </div>
              )}
              {data.hull_speed_knots && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">Hull Speed</div>
                  <div className="text-lg font-medium text-foreground">{data.hull_speed_knots} kts</div>
                </div>
              )}
              {data.ppi_pounds_per_inch && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">PPI</div>
                  <div className="text-lg font-medium text-foreground">{data.ppi_pounds_per_inch}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image Upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1">
            Boat Images
          </label>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-10 h-10 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e.target.files)}
                  disabled={uploadingImages}
                />
              </label>
            </div>

            {data.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {data.images.map((url, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={url}
                      alt={`Boat image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadingImages && (
              <p className="text-sm text-muted-foreground">Uploading images...</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !data.name.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Save Boat
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Info Modal */}
      {showCategoryInfo && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowCategoryInfo(false)}
        >
          <div
            className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-card-foreground">
                  Sailboat Categories Information
                </h2>
                <button
                  onClick={() => setShowCategoryInfo(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {Object.entries(sailboatCategories).map(([category, info]) => (
                  <div
                    key={category}
                    className={`border border-border rounded-lg p-4 cursor-pointer transition-all hover:bg-accent hover:border-ring ${
                      data.type === category ? 'bg-accent border-ring ring-2 ring-ring' : ''
                    }`}
                    onClick={() => {
                      onDataChange({ ...data, type: category as SailboatCategory });
                      setShowCategoryInfo(false);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-foreground">{category}</h3>
                      {data.type !== category && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDataChange({ ...data, type: category as SailboatCategory });
                            setShowCategoryInfo(false);
                          }}
                          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                        >
                          Select
                        </button>
                      )}
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p className="text-foreground">{info.description}</p>
                      <div>
                        <span className="font-medium text-foreground">Characteristics: </span>
                        <span>{info.characteristics}</span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Capabilities: </span>
                        <span>{info.capabilities}</span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Examples: </span>
                        <span>{info.examples}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => setShowCategoryInfo(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
