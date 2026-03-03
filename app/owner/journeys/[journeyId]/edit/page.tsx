'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { RequirementsManager } from '@/app/components/manage/RequirementsManager';
import { ImageUpload } from '@shared/ui/ImageUpload';
import { ImageCarousel } from '@shared/ui/ImageCarousel';
import { CollapsibleSection } from '@shared/ui/CollapsibleSection';
import { CostModel } from '@shared/types/cost-models';
import costModelsConfig from '@/app/config/cost-models-config.json';
import skillsConfig from '@/app/config/skills-config.json';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import { ExperienceLevel, getAllExperienceLevels, getExperienceLevelConfig } from '@shared/types/experience-levels';
import { toDisplaySkillName } from '@shared/utils';
import { Footer } from '@/app/components/Footer';
import Image from 'next/image';
import { X } from 'lucide-react';

type JourneyState = 'In planning' | 'Published' | 'Archived';

type Journey = {
  id?: string;
  boat_id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  risk_level: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  cost_model: CostModel | null;
  cost_info: string;
  skills: string[];
  min_experience_level: ExperienceLevel | null;
  state: JourneyState;
};

type Boat = {
  id: string;
  name: string;
};

export default function EditJourneyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const journeyId = params?.journeyId as string;

  const [formData, setFormData] = useState<Journey>({
    boat_id: '',
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    risk_level: null,
    cost_model: null,
    cost_info: '',
    skills: [],
    min_experience_level: 1,
    state: 'In planning',
  });
  const [journeyImages, setJourneyImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingJourney, setIsLoadingJourney] = useState(true);
  const [isLoadingBoats, setIsLoadingBoats] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [boatSafetyEquipment, setBoatSafetyEquipment] = useState<Array<{
    name: string;
    subcategory: string | null;
    status: string;
    expiry_date: string | null;
    next_service_date: string | null;
  }>>([]);
  const [boatSystemsReadiness, setBoatSystemsReadiness] = useState<{
    engine: { lastDate: string | null; nextDate: string | null; hasRecords: boolean; isOverdue: boolean };
    steering: { lastDate: string | null; nextDate: string | null; hasRecords: boolean; isOverdue: boolean };
    rigging: { lastDate: string | null; nextDate: string | null; hasRecords: boolean; isOverdue: boolean };
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && journeyId) {
      loadBoats();
      loadJourney();
    }
  }, [user, authLoading, journeyId, router]);

  const loadBoats = async () => {
    if (!user) return;
    setIsLoadingBoats(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('name', { ascending: true });

    if (fetchError) {
      setError('Failed to load boats');
    } else {
      setBoats(data || []);
    }
    setIsLoadingBoats(false);
  };

  const loadJourney = async () => {
    if (!journeyId) return;
    
    setIsLoadingJourney(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('journeys')
      .select('*')
      .eq('id', journeyId)
      .single();

    if (fetchError) {
      setError('Failed to load journey details');
      setIsLoadingJourney(false);
      return;
    }

    if (data) {
      // Convert skills from canonical format (snake_case) to display format (Title Case) for UI
      const displaySkills = (data.skills || []).map(toDisplaySkillName);

      // Handle risk_level: if it's an array (old format), take the first value; if single value, use it; otherwise null
      let riskLevel: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null = null;
      if (data.risk_level) {
        if (Array.isArray(data.risk_level) && data.risk_level.length > 0) {
          riskLevel = data.risk_level[0] as 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';
        } else if (typeof data.risk_level === 'string') {
          riskLevel = data.risk_level as 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';
        }
      }

      setFormData({
        boat_id: data.boat_id || '',
        name: data.name || '',
        start_date: data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '',
        end_date: data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '',
        description: data.description || '',
        risk_level: riskLevel,
        cost_model: data.cost_model || null,
        cost_info: data.cost_info || '',
        skills: displaySkills,
        min_experience_level: (data.min_experience_level as ExperienceLevel | null) || 1,
        state: data.state || 'In planning',
      });

      // Set journey images
      setJourneyImages(data.images || []);
    }
    setIsLoadingJourney(false);
  };

  // Fetch boat safety equipment + systems maintenance status for the offshore readiness advisory
  useEffect(() => {
    if (!formData.boat_id) {
      setBoatSafetyEquipment([]);
      setBoatSystemsReadiness(null);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      // Safety equipment (life raft, EPIRB, etc.)
      supabase
        .from('boat_equipment')
        .select('name, subcategory, status, expiry_date, next_service_date')
        .eq('boat_id', formData.boat_id)
        .eq('category', 'safety'),
      // Equipment service dates for engine, rigging, hull_deck (steering)
      supabase
        .from('boat_equipment')
        .select('category, subcategory, service_date, next_service_date')
        .eq('boat_id', formData.boat_id)
        .in('category', ['engine', 'rigging', 'hull_deck']),
      // Completed maintenance tasks
      supabase
        .from('boat_maintenance_tasks')
        .select('title, completed_at')
        .eq('boat_id', formData.boat_id)
        .eq('status', 'completed')
        .eq('is_template', false)
        .order('completed_at', { ascending: false }),
    ]).then(([safetyRes, equipRes, tasksRes]) => {
      setBoatSafetyEquipment(safetyRes.data || []);

      const equipment = equipRes.data || [];
      const tasks = tasksRes.data || [];

      const pickLatest = (...dates: (string | null | undefined)[]): string | null =>
        dates.filter(Boolean).map(d => d!.split('T')[0]).sort().pop() ?? null;

      // Engine
      const engineEquip = equipment.filter(e => e.category === 'engine');
      const engineTasks = tasks.filter(t =>
        ['engine', 'motor', 'oil change', 'impeller', 'fuel filter', 'raw water'].some(k =>
          t.title.toLowerCase().includes(k)
        )
      );
      const engineLast = pickLatest(...engineEquip.map(e => e.service_date), ...engineTasks.map(t => t.completed_at));
      const engineNext = engineEquip.map(e => e.next_service_date).filter(Boolean).sort()[0] ?? null;

      // Steering
      const steeringEquip = equipment.filter(e =>
        e.subcategory === 'rudder' || e.subcategory === 'steering' || e.subcategory === 'helm'
      );
      const steeringTasks = tasks.filter(t =>
        ['steering', 'rudder', 'helm', 'tiller', 'wheel'].some(k => t.title.toLowerCase().includes(k))
      );
      const steeringLast = pickLatest(...steeringEquip.map(e => e.service_date), ...steeringTasks.map(t => t.completed_at));
      const steeringNext = steeringEquip.map(e => e.next_service_date).filter(Boolean).sort()[0] ?? null;

      // Mast & Rigging
      const riggingEquip = equipment.filter(e => e.category === 'rigging');
      const riggingTasks = tasks.filter(t =>
        ['rigging', 'mast', 'shroud', 'forestay', 'backstay', 'standing rigging', 'running rigging'].some(k =>
          t.title.toLowerCase().includes(k)
        )
      );
      const riggingLast = pickLatest(...riggingEquip.map(e => e.service_date), ...riggingTasks.map(t => t.completed_at));
      const riggingNext = riggingEquip.map(e => e.next_service_date).filter(Boolean).sort()[0] ?? null;

      setBoatSystemsReadiness({
        engine: {
          lastDate: engineLast,
          nextDate: engineNext,
          hasRecords: engineEquip.length > 0 || engineTasks.length > 0,
          isOverdue: !!engineNext && engineNext < today,
        },
        steering: {
          lastDate: steeringLast,
          nextDate: steeringNext,
          hasRecords: steeringEquip.length > 0 || steeringTasks.length > 0,
          isOverdue: !!steeringNext && steeringNext < today,
        },
        rigging: {
          lastDate: riggingLast,
          nextDate: riggingNext,
          hasRecords: riggingEquip.length > 0 || riggingTasks.length > 0,
          isOverdue: !!riggingNext && riggingNext < today,
        },
      });
    });
  }, [formData.boat_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Validation 1: Date logic - end_date must be >= start_date
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        setError('End date must be on or after start date.');
        setLoading(false);
        return;
      }
    }

    // Validation 2: Risk level - must be selected
    if (!formData.risk_level) {
      setError('Please select a risk level.');
      setLoading(false);
      return;
    }

    // Validation 3: Experience level - must be set
    if (!formData.min_experience_level) {
      setError('Please select a minimum required experience level.');
      setLoading(false);
      return;
    }

    // Validate: If state is "Published", check that all legs have start_date and end_date
    if (formData.state === 'Published') {
      const { data: legsData, error: legsError } = await supabase
        .from('legs')
        .select('id, name, start_date, end_date')
        .eq('journey_id', journeyId);

      if (legsError) {
        setError('Failed to validate legs: ' + legsError.message);
        setLoading(false);
        return;
      }

      if (legsData && legsData.length > 0) {
        const legsWithMissingDates = legsData.filter(
          leg => !leg.start_date || !leg.end_date
        );

        if (legsWithMissingDates.length > 0) {
          const legNames = legsWithMissingDates.map(leg => leg.name || 'Unnamed leg').join(', ');
          setError(
            `Cannot publish journey: The following leg(s) are missing start or end dates: ${legNames}. ` +
            `Please ensure all legs have both start and end dates before publishing.`
          );
          setLoading(false);
          return;
        }
      } else {
        setError('Cannot publish journey: A journey must have at least one leg with start and end dates before it can be published.');
        setLoading(false);
        return;
      }
    }

    // Normalize skills to canonical format (snake_case) for storage
    const { normalizeSkillNames } = require('@shared/utils');
    const normalizedSkills = normalizeSkillNames(formData.skills || []);

    const journeyData = {
      boat_id: formData.boat_id,
      name: formData.name,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      description: formData.description || null,
      risk_level: formData.risk_level || [],
      cost_model: formData.cost_model || 'Not defined',
      cost_info: formData.cost_info || null,
      skills: normalizedSkills,
      min_experience_level: formData.min_experience_level || 1,
      state: formData.state,
      images: journeyImages,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: updateError } = await supabase
        .from('journeys')
        .update(journeyData)
        .eq('id', journeyId);

      if (updateError) {
        throw updateError;
      }

      // Navigate back to journeys list
      router.push('/owner/journeys');
    } catch (err: any) {
      setError(err.message || 'Failed to save journey');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'radio' ? value : value,
    }));
  };

  const handleDeleteJourney = async () => {
    if (!journeyId) return;

    setIsDeleting(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    try {
      // First, delete all legs associated with this journey (and their waypoints via cascade)
      const { error: legsError } = await supabase
        .from('legs')
        .delete()
        .eq('journey_id', journeyId);

      if (legsError) {
        throw new Error('Failed to delete journey legs: ' + legsError.message);
      }

      // Then delete the journey itself
      const { error: journeyError } = await supabase
        .from('journeys')
        .delete()
        .eq('id', journeyId);

      if (journeyError) {
        throw new Error('Failed to delete journey: ' + journeyError.message);
      }

      // Navigate back to journeys list
      router.push('/owner/journeys');
    } catch (err: any) {
      setError(err.message || 'Failed to delete journey');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleImageUpload = async (urls: string[]) => {
    setUploadingImages(true);
    try {
      const currentImages = journeyImages || [];
      const newImages = [...currentImages, ...urls];

      setJourneyImages(newImages);

      // Update journey with new images
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('journeys')
        .update({
          images: newImages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

      if (updateError) {
        throw updateError;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    const supabase = getSupabaseBrowserClient();

    const newImages = journeyImages.filter((_, i) => i !== index);
    setJourneyImages(newImages);

    try {
      const { error: updateError } = await supabase
        .from('journeys')
        .update({
          images: newImages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', journeyId);

      if (updateError) {
        throw updateError;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove image');
      // Revert state on error
      setJourneyImages(journeyImages);
    }
  };

  if (authLoading || isLoadingJourney || isLoadingBoats) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/owner/journeys"
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
          >
            ← Back to Journeys
          </Link>
          <h1 className="text-2xl font-bold text-card-foreground">Edit Journey</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information Section */}
          <CollapsibleSection title="Basic Information" sectionNumber={1}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Journey Name */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                  Journey Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="e.g., Mediterranean Adventure 2024"
                />
              </div>

              {/* Boat Selection */}
              <div>
                <label htmlFor="boat_id" className="block text-sm font-medium text-foreground mb-1">
                  Boat *
                </label>
                <select
                  id="boat_id"
                  name="boat_id"
                  required
                  value={formData.boat_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="">Select a boat</option>
                  {boats.map((boat) => (
                    <option key={boat.id} value={boat.id}>
                      {boat.name}
                    </option>
                  ))}
                </select>
                {boats.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    You need to create a boat first before creating a journey.
                  </p>
                )}
              </div>

              {/* Start Date */}
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-foreground mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                />
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-foreground mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-3">
                <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="Describe your journey..."
                />
              </div>

              {/* Journey State */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Journey State *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                    <input
                      type="radio"
                      name="state"
                      value="In planning"
                      checked={formData.state === 'In planning'}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-border focus:ring-ring"
                    />
                    <span className="ml-2 text-sm text-foreground">In planning</span>
                  </label>
                  <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                    <input
                      type="radio"
                      name="state"
                      value="Published"
                      checked={formData.state === 'Published'}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-border focus:ring-ring"
                    />
                    <span className="ml-2 text-sm text-foreground">Published</span>
                  </label>
                  <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                    <input
                      type="radio"
                      name="state"
                      value="Archived"
                      checked={formData.state === 'Archived'}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-border focus:ring-ring"
                    />
                    <span className="ml-2 text-sm text-foreground">Archived</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Published journeys are visible to everyone. In planning and archived journeys are only visible to you.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Cost Management Section */}
          <CollapsibleSection title="Cost Management" sectionNumber={2}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Cost Model
              </label>
              <div className="space-y-2">
                {costModelsConfig.costModels.map((model) => (
                  <label key={model.name} className="flex items-start min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-3">
                    <input
                      type="radio"
                      name="cost_model"
                      value={model.name}
                      checked={formData.cost_model === model.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost_model: e.target.value as CostModel }))}
                      className="rounded-full border-border mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground block">{model.displayName}</span>
                      <span className="text-xs text-muted-foreground block">{model.details}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="cost_info" className="block text-sm font-medium text-foreground mb-1">
                Cost Information
              </label>
              <textarea
                id="cost_info"
                name="cost_info"
                rows={2}
                value={formData.cost_info}
                onChange={(e) => setFormData(prev => ({ ...prev, cost_info: e.target.value }))}
                className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                placeholder="e.g. Shared food, fuel split, crew fee..."
              />
              <p className="text-xs text-muted-foreground mt-1">Free text for crew about costs. No strict format.</p>
            </div>
          </CollapsibleSection>

          {/* Skills & Experience Section */}
          <CollapsibleSection title="Skills & Experience" sectionNumber={3}>
            <div className="space-y-6">
              {/* Risk Level Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Risk Level
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                    <input
                      type="radio"
                      name="risk-level"
                      value="Coastal sailing"
                      checked={formData.risk_level === 'Coastal sailing'}
                      onChange={() => setFormData(prev => ({ ...prev, risk_level: 'Coastal sailing' }))}
                      className="w-4 h-4 text-primary border-border focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{riskLevelsConfig.coastal_sailing.title}</span>
                  </label>
                  <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                    <input
                      type="radio"
                      name="risk-level"
                      value="Offshore sailing"
                      checked={formData.risk_level === 'Offshore sailing'}
                      onChange={() => setFormData(prev => ({ ...prev, risk_level: 'Offshore sailing' }))}
                      className="w-4 h-4 text-primary border-border focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{riskLevelsConfig.offshore_sailing.title}</span>
                  </label>
                  <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                    <input
                      type="radio"
                      name="risk-level"
                      value="Extreme sailing"
                      checked={formData.risk_level === 'Extreme sailing'}
                      onChange={() => setFormData(prev => ({ ...prev, risk_level: 'Extreme sailing' }))}
                      className="w-4 h-4 text-primary border-border focus:ring-primary"
                    />
                    <span className="text-sm text-foreground">{riskLevelsConfig.extreme_sailing.title}</span>
                  </label>
                </div>

                {/* Safety and Offshore Readiness advisory */}
                {(() => {
                  const isOffshore = formData.risk_level === 'Offshore sailing' || formData.risk_level === 'Extreme sailing';
                  if (!isOffshore || !formData.boat_id) return null;

                  const today = new Date().toISOString().split('T')[0];
                  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : null;

                  const issues: { message: string }[] = [];

                  // Safety equipment checks
                  const hasLifeRaft = boatSafetyEquipment.some(e => e.subcategory === 'life_raft');
                  const hasEpirb = boatSafetyEquipment.some(e => e.subcategory === 'epirb');
                  if (!hasLifeRaft) issues.push({ message: 'Life raft not registered in equipment list — add it under Boat Equipment' });
                  if (!hasEpirb) issues.push({ message: 'EPIRB not registered in equipment list — add it under Boat Equipment' });
                  boatSafetyEquipment
                    .filter(e => (e.expiry_date && e.expiry_date < today) || (e.next_service_date && e.next_service_date < today))
                    .forEach(e => issues.push({ message: `${e.name}: service or expiry date is overdue` }));

                  // Systems readiness checks
                  if (boatSystemsReadiness) {
                    if (!boatSystemsReadiness.engine.hasRecords) {
                      issues.push({ message: 'No engine service records — add equipment or a completed maintenance task for the engine' });
                    } else if (boatSystemsReadiness.engine.isOverdue) {
                      issues.push({ message: `Engine service overdue (due: ${fmt(boatSystemsReadiness.engine.nextDate)})` });
                    }
                    if (!boatSystemsReadiness.steering.hasRecords) {
                      issues.push({ message: 'No steering service records — add equipment or a completed maintenance task for the steering system' });
                    } else if (boatSystemsReadiness.steering.isOverdue) {
                      issues.push({ message: `Steering service overdue (due: ${fmt(boatSystemsReadiness.steering.nextDate)})` });
                    }
                    if (!boatSystemsReadiness.rigging.hasRecords) {
                      issues.push({ message: 'No mast & rigging inspection records — add equipment or a completed inspection task' });
                    } else if (boatSystemsReadiness.rigging.isOverdue) {
                      issues.push({ message: `Mast & rigging inspection overdue (due: ${fmt(boatSystemsReadiness.rigging.nextDate)})` });
                    }
                  }

                  if (issues.length === 0) return null;

                  return (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-950/20 dark:border-amber-800">
                      <div className="flex gap-2">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Safety and Offshore Readiness</p>
                          <ul className="mt-1 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                            {issues.map((issue, i) => (
                              <li key={i}>• {issue.message}</li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                            Complete all safety equipment and maintenance records before embarking on an offshore or extreme sailing passage.
                            Manage records in{' '}
                            <Link href={`/owner/boats/${formData.boat_id}/equipment`} className="underline font-medium">boat equipment & maintenance</Link>.{' '}
                            Advisory only — does not prevent publishing.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Required Experience Level */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Required Sailing Experience Level
                </label>
                <div className="flex flex-wrap gap-3">
                  {getAllExperienceLevels().map((levelConfig) => (
                    <label key={levelConfig.value} className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                      <input
                        type="radio"
                        name="experience-level"
                        value={levelConfig.value}
                        checked={formData.min_experience_level === levelConfig.value}
                        onChange={() => setFormData(prev => ({ ...prev, min_experience_level: levelConfig.value }))}
                        className="w-4 h-4 text-primary border-border focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{levelConfig.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Required Skills
                </label>
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const allSkills = [
                      ...skillsConfig.general,
                    ];
                    const formatSkillName = (name: string) => {
                      return name
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    };
                    return allSkills.map((skill) => {
                      const displayName = formatSkillName(skill.name);
                      return (
                        <label key={skill.name} className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors gap-2">
                          <input
                            type="checkbox"
                            checked={formData.skills.includes(displayName)}
                            onChange={(e) => {
                              const newSkills = e.target.checked
                                ? [...formData.skills, displayName]
                                : formData.skills.filter(s => s !== displayName);
                              setFormData(prev => ({ ...prev, skills: newSkills }));
                            }}
                            className="rounded border-border"
                          />
                          <span className="text-sm text-foreground">{displayName}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Media Section */}
          <CollapsibleSection title="Media" sectionNumber={4}>
            {/* Journey Images Section */}
            {journeyId && (
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">Journey Images</h3>

                {/* Image Upload */}
                <div className="mb-4">
                  <ImageUpload
                    onUpload={handleImageUpload}
                    onError={(error) => setError(error)}
                    maxFiles={10}
                    maxSize={5}
                    userId={user?.id || ''}
                    bucketName="journey-images"
                  />
                </div>

                {/* Image Preview */}
                {journeyImages.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {journeyImages.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <Image
                            src={imageUrl}
                            alt={`Journey image ${index + 1}`}
                            width={80}
                            height={80}
                            className="w-32 h-24 object-cover rounded-md border border-border"
                          />
                          <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={`Remove image ${index + 1}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {journeyImages.length} image(s) uploaded
                    </p>
                  </div>
                )}

                {journeyImages.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">
                    No images uploaded yet. Add images to showcase your journey.
                  </p>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Requirements Manager Section */}
          <CollapsibleSection title="Registration settings" sectionNumber={5}>
            {journeyId && (
              <RequirementsManager
                journeyId={journeyId}
                journeySkills={formData.skills}
                onRequirementsChange={() => {
                  // Optionally reload journey data or refresh UI
                }}
              />
            )}
          </CollapsibleSection>

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || isDeleting}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Delete Journey
            </button>
            <div className="flex gap-4 ml-auto">
              <Link
                href="/owner/journeys"
                className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || boats.length === 0}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {loading ? 'Saving...' : 'Update Journey'}
              </button>
            </div>
          </div>
        </form>
      </main>
      <Footer />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">
                Delete Journey?
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete this journey? This will permanently delete the journey and all its legs. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteJourney}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
