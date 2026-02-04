'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { canCreateBoat, getLimits, getUserUsage } from '@/app/lib/limits';

// Sailboat category information
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
    examples: 'J/Boats J/121, X-Yachts X4³, or Dehler 42.',
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
    description: 'Expedition Class Sailboats (also called expedition cruisers, explorer sailboats, or high-latitude/exploration yachts) represent the most rugged and self-sufficient subcategory within offshore sailboats. They go beyond standard bluewater or traditional offshore cruisers by being specifically engineered for extreme environments, remote exploration, and prolonged autonomy in challenging or isolated regions—such as high latitudes (Arctic/Antarctic), the Southern Ocean, polar passages (e.g., Northwest Passage), or other areas with minimal infrastructure, ice risks, or unpredictable weather.',
    characteristics: 'Typically built with reinforced aluminum or steel hulls (for impact resistance against ice, grounding, or debris), watertight bulkheads, crash boxes, skeg-protected or protected rudders, and often ice-class or polar-capable reinforcements. Heavy displacement with full or modified full keels for stability and shallow draft options in some designs. Robust deck structures, pilothouse/doghouse options for enclosed steering in cold/wet weather, insulated hulls and superstructures, and non-magnetic construction (aluminum) to avoid compass interference in high latitudes. Lengths usually 45-65 feet for optimal balance of autonomy, stability, and short-handed manageability.',
    capabilities: 'Extreme self-sufficiency with massive tankage (fuel, water, and provisions for 30-60+ days off-grid), redundant systems (twin generators, backup steering, etc.), extensive storage for spares/tools/gear, watermakers, solar/wind power, and often specialized equipment like reinforced chainplates, heavy ground tackle, and scientific/research fittings. Excellent in severe conditions (high winds, breaking seas, ice navigation), with comfortable (though sometimes slower) motion due to weight and form stability. Suitable for high-latitude voyages, remote anchorages, and expeditions where rescue or resupply is unreliable. Average speeds 5-8 knots, prioritizing safety and reliability over performance.',
    examples: 'Garcia Exploration series (e.g., Exploration 45, 52, 60—pioneered with Jimmy Cornell for Northwest Passage), Bestevaer range (e.g., Bestevaer 53/56—designed by Gerard Dijkstra for adventure cruising), Ovni series (aluminum lift-keel designs proven in extreme areas), Allures (e.g., Allures 51.9—adventure-focused with high-latitude features), or custom aluminum/steel builds like those from Boréal or Meta.',
    prosCons: 'Pros include unmatched durability, peace of mind in remote/extreme areas, low maintenance in harsh environments (aluminum resists corrosion), and proven track records in polar/Southern Ocean voyages; cons are higher cost, heavier/slower sailing in light winds, wider maintenance needs for metal hulls (though often simpler long-term), and less interior volume or "cruising comfort" compared to fiberglass production boats. Not ideal for casual coastal or trade-wind-only sailing due to weight and expense.'
  }
};

type Boat = {
  id?: string;
  name: string;
  type: 'Daysailers' | 'Coastal cruisers' | 'Traditional offshore cruisers' | 'Performance cruisers' | 'Multihulls' | 'Expedition sailboats' | null;
  make_model: string; // Combined Make and Model field
  capacity: number | null;
  home_port: string;
  loa_m: number | null;
  beam_m: number | null;
  max_draft_m: number | null;
  displcmt_m: number | null;
  average_speed_knots: number | null;
  link_to_specs: string;
  characteristics: string;
  capabilities: string;
  accommodations: string;
  // Sailboat performance calculations (read-only, fetched from external source)
  sa_displ_ratio: number | null;
  ballast_displ_ratio: number | null;
  displ_len_ratio: number | null;
  comfort_ratio: number | null;
  capsize_screening: number | null;
  hull_speed_knots: number | null;
  ppi_pounds_per_inch: number | null;
};

type BoatFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  boatId?: string | null;
  userId: string;
};

export function BoatFormModal({ isOpen, onClose, onSuccess, boatId, userId }: BoatFormModalProps) {
  const [formData, setFormData] = useState<Boat>({
    name: '',
    type: null,
    make_model: '',
    capacity: null,
    home_port: '',
    loa_m: null,
    beam_m: null,
    max_draft_m: null,
    displcmt_m: null,
    average_speed_knots: null,
    link_to_specs: '',
    characteristics: '',
    capabilities: '',
    accommodations: '',
    sa_displ_ratio: null,
    ballast_displ_ratio: null,
    displ_len_ratio: null,
    comfort_ratio: null,
    capsize_screening: null,
    hull_speed_knots: null,
    ppi_pounds_per_inch: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingBoat, setIsLoadingBoat] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [currentBoatCount, setCurrentBoatCount] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showCategoryInfo, setShowCategoryInfo] = useState(false);

  useEffect(() => {
    if (isOpen && boatId) {
      loadBoat();
      setLimitReached(false);
    } else if (isOpen && !boatId) {
      // Reset form for new boat
      setFormData({
        name: '',
        type: null,
        make_model: '',
        capacity: null,
        home_port: '',
        loa_m: null,
        beam_m: null,
        max_draft_m: null,
        displcmt_m: null,
        average_speed_knots: null,
        link_to_specs: '',
        characteristics: '',
        capabilities: '',
        accommodations: '',
        sa_displ_ratio: null,
        ballast_displ_ratio: null,
        displ_len_ratio: null,
        comfort_ratio: null,
        capsize_screening: null,
        hull_speed_knots: null,
        ppi_pounds_per_inch: null,
      });
      setImages([]);
      setError(null);

      // Check boat creation limit for new boats
      checkBoatLimit();
    }
  }, [isOpen, boatId]);

  const checkBoatLimit = async () => {
    const supabase = getSupabaseBrowserClient();
    const result = await canCreateBoat(supabase, userId);
    setCurrentBoatCount(result.current);
    if (!result.allowed) {
      setLimitReached(true);
      setError(result.message || `Boat limit reached (${result.current}/${result.limit})`);
    } else {
      setLimitReached(false);
    }
  };

  const loadBoat = async () => {
    if (!boatId) return;
    
    setIsLoadingBoat(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('*')
      .eq('id', boatId)
      .single();

    if (fetchError) {
      setError('Failed to load boat details');
    } else if (data) {
      setFormData({
        name: data.name || '',
        type: data.type || null,
        make_model: data.make_model || '',
        capacity: data.capacity || null,
        home_port: data.home_port || '',
        loa_m: data.loa_m || null,
        beam_m: data.beam_m || null,
        max_draft_m: data.max_draft_m || null,
        displcmt_m: data.displcmt_m || null,
        average_speed_knots: data.average_speed_knots || null,
        link_to_specs: data.link_to_specs || '',
        characteristics: data.characteristics || '',
        capabilities: data.capabilities || '',
        accommodations: data.accommodations || '',
        sa_displ_ratio: data.sa_displ_ratio || null,
        ballast_displ_ratio: data.ballast_displ_ratio || null,
        displ_len_ratio: data.displ_len_ratio || null,
        comfort_ratio: data.comfort_ratio || null,
        capsize_screening: data.capsize_screening || null,
        hull_speed_knots: data.hull_speed_knots || null,
        ppi_pounds_per_inch: data.ppi_pounds_per_inch || null,
      });
      setImages(data.images || []);
    }
    setIsLoadingBoat(false);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    const supabase = getSupabaseBrowserClient();
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Please upload only image files');
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          setError('Image size must be less than 5MB');
          continue;
        }

        // Create unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('boat-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('boat-images')
          .getPublicUrl(uploadData.path);

        uploadedUrls.push(publicUrl);
      }

      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Parse make_model into make and model for database storage
    const makeModelParts = formData.make_model.trim().split(/\s+/);
    const make = makeModelParts.length > 0 ? makeModelParts[0] : null;
    const model = makeModelParts.length > 1 ? makeModelParts.slice(1).join(' ') : null;

    const boatData = {
      name: formData.name,
      type: formData.type,
      make_model: formData.make_model || null,
      capacity: formData.capacity || null,
      home_port: formData.home_port || null,
      loa_m: formData.loa_m || null,
      beam_m: formData.beam_m || null,
      max_draft_m: formData.max_draft_m || null,
      displcmt_m: formData.displcmt_m || null,
      average_speed_knots: formData.average_speed_knots || null,
      link_to_specs: formData.link_to_specs || null,
      characteristics: formData.characteristics || null,
      capabilities: formData.capabilities || null,
      accommodations: formData.accommodations || null,
      // Sailboat Performance Calculations
      sa_displ_ratio: formData.sa_displ_ratio || null,
      ballast_displ_ratio: formData.ballast_displ_ratio || null,
      displ_len_ratio: formData.displ_len_ratio || null,
      comfort_ratio: formData.comfort_ratio || null,
      capsize_screening: formData.capsize_screening || null,
      hull_speed_knots: formData.hull_speed_knots || null,
      ppi_pounds_per_inch: formData.ppi_pounds_per_inch || null,
      images: images.length > 0 ? images : null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (boatId) {
        // Update existing boat
        const { error: updateError } = await supabase
          .from('boats')
          .update(boatData)
          .eq('id', boatId)
          .eq('owner_id', userId);

        if (updateError) throw updateError;
      } else {
        // Create new boat
        const { error: insertError } = await supabase
          .from('boats')
          .insert({
            ...boatData,
            owner_id: userId,
          });

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save boat');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'capacity' || name === 'loa_m' || name === 'beam_m' || name === 'max_draft_m' || name === 'displcmt_m' || name === 'average_speed_knots' || name === 'sa_displ_ratio' || name === 'ballast_displ_ratio' || name === 'displ_len_ratio' || name === 'comfort_ratio' || name === 'capsize_screening' || name === 'hull_speed_knots' || name === 'ppi_pounds_per_inch'
        ? value === '' ? null : Number(value)
        : name === 'type'
        ? value === '' ? null : value
        : value,
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="min-h-[calc(100vh-4rem)]">
        {/* Page Header */}
        <div className="border-b border-border bg-background">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-foreground">
                {boatId ? 'Edit Boat' : 'Add New Boat'}
              </h1>
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cancel and go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm font-medium">Cancel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoadingBoat ? (
            <div className="text-center py-8">Loading boat details...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Boat Name */}
                  <div className="md:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                      Boat Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Sea Breeze"
                    />
                  </div>

                  {/* Boat Type */}
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
                      value={formData.type || ''}
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
                      value={formData.capacity || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., 6"
                    />
                  </div>

                  {/* Make and Model (Combined) */}
                  <div className="md:col-span-2">
                    <label htmlFor="make_model" className="block text-sm font-medium text-foreground mb-1">
                      Make and Model
                    </label>
                    <input
                      type="text"
                      id="make_model"
                      name="make_model"
                      value={formData.make_model}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Hallberg-Rassy 38"
                    />
                  </div>

                  {/* Home Port */}
                  <div>
                    <label htmlFor="home_port" className="block text-sm font-medium text-foreground mb-1">
                      Home Port
                    </label>
                    <input
                      type="text"
                      id="home_port"
                      name="home_port"
                      value={formData.home_port}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., Marina del Rey, CA"
                    />
                  </div>

                  {/* Length Overall (LOA) */}
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
                      value={formData.loa_m || ''}
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
                      value={formData.beam_m || ''}
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
                      value={formData.max_draft_m || ''}
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
                      value={formData.displcmt_m || ''}
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
                      value={formData.average_speed_knots || ''}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="e.g., 6.5"
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
                      value={formData.characteristics}
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
                      value={formData.capabilities}
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
                      value={formData.accommodations}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
                      placeholder="Describe the boat's accommodations..."
                    />
                  </div>

                  {/* Link to Specs */}
                  <div className="md:col-span-2">
                    <label htmlFor="link_to_specs" className="block text-sm font-medium text-foreground mb-1">
                      Link to Specifications
                    </label>
                    <input
                      type="url"
                      id="link_to_specs"
                      name="link_to_specs"
                      value={formData.link_to_specs}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      placeholder="https://sailboatdata.com/..."
                    />
                  </div>

                  {/* Sailboat Performance Calculations - Editable */}
                  <div className="md:col-span-2 border-t border-border pt-4 mt-4">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Sailboat Performance Calculations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="sa_displ_ratio" className="block text-sm font-medium text-foreground mb-1">
                          S.A. / Displ.
                        </label>
                        <input
                          type="number"
                          id="sa_displ_ratio"
                          name="sa_displ_ratio"
                          step="0.01"
                          min="0"
                          value={formData.sa_displ_ratio || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 15.5"
                        />
                      </div>
                      <div>
                        <label htmlFor="ballast_displ_ratio" className="block text-sm font-medium text-foreground mb-1">
                          Bal. / Displ.
                        </label>
                        <input
                          type="number"
                          id="ballast_displ_ratio"
                          name="ballast_displ_ratio"
                          step="0.01"
                          min="0"
                          value={formData.ballast_displ_ratio || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 33.80"
                        />
                      </div>
                      <div>
                        <label htmlFor="displ_len_ratio" className="block text-sm font-medium text-foreground mb-1">
                          Disp: / Len
                        </label>
                        <input
                          type="number"
                          id="displ_len_ratio"
                          name="displ_len_ratio"
                          step="0.01"
                          min="0"
                          value={formData.displ_len_ratio || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 250"
                        />
                      </div>
                      <div>
                        <label htmlFor="comfort_ratio" className="block text-sm font-medium text-foreground mb-1">
                          Comfort Ratio
                        </label>
                        <input
                          type="number"
                          id="comfort_ratio"
                          name="comfort_ratio"
                          step="0.01"
                          min="0"
                          value={formData.comfort_ratio || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 35.5"
                        />
                      </div>
                      <div>
                        <label htmlFor="capsize_screening" className="block text-sm font-medium text-foreground mb-1">
                          Capsize Screening
                        </label>
                        <input
                          type="number"
                          id="capsize_screening"
                          name="capsize_screening"
                          step="0.01"
                          min="0"
                          value={formData.capsize_screening || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 1.85"
                        />
                      </div>
                      <div>
                        <label htmlFor="hull_speed_knots" className="block text-sm font-medium text-foreground mb-1">
                          Hull Speed (knots)
                        </label>
                        <input
                          type="number"
                          id="hull_speed_knots"
                          name="hull_speed_knots"
                          step="0.01"
                          min="0"
                          value={formData.hull_speed_knots || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 7.5"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="ppi_pounds_per_inch" className="block text-sm font-medium text-foreground mb-1">
                          Pounds/Inch Immersion (PPI)
                        </label>
                        <input
                          type="number"
                          id="ppi_pounds_per_inch"
                          name="ppi_pounds_per_inch"
                          step="0.01"
                          min="0"
                          value={formData.ppi_pounds_per_inch || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                          placeholder="e.g., 1200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Boat Images
                    </label>
                    <div className="space-y-4">
                      {/* Upload Input */}
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

                      {/* Image Preview Grid */}
                      {images.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {images.map((url, index) => (
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

                {/* Form Actions */}
                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || (limitReached && !boatId)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                  >
                    {loading ? 'Saving...' : boatId ? 'Update Boat' : 'Create Boat'}
                  </button>
                </div>
              </form>
            )}
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
              {/* Header */}
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

              {/* Categories List */}
              <div className="space-y-4">
                {Object.entries(sailboatCategories).map(([category, info]) => (
                  <div
                    key={category}
                    className={`border border-border rounded-lg p-4 cursor-pointer transition-all hover:bg-accent hover:border-ring ${
                      formData.type === category ? 'bg-accent border-ring ring-2 ring-ring' : ''
                    }`}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, type: category as Boat['type'] }));
                      setShowCategoryInfo(false);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-foreground">{category}</h3>
                      {formData.type !== category && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData((prev) => ({ ...prev, type: category as Boat['type'] }));
                            setShowCategoryInfo(false);
                          }}
                          className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                        >
                          Select
                        </button>
                      )}
                    </div>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>
                        <p className="text-foreground">{info.description}</p>
                      </div>
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
                      <div>
                        <span className="font-medium text-foreground">Pros/Cons: </span>
                        <span>{info.prosCons}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Close Button */}
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
    </>
  );
}
