'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';
import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import { RequirementsManager } from '@/app/components/manage/RequirementsManager';
import { ImageUpload } from '@/app/components/ui/ImageUpload';
import { ImageCarousel } from '@/app/components/ui/ImageCarousel';
import skillsConfig from '@/app/config/skills-config.json';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { toDisplaySkillName } from '@/app/lib/skillUtils';
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
        skills: displaySkills,
        min_experience_level: (data.min_experience_level as ExperienceLevel | null) || 1,
        state: data.state || 'In planning',
      });

      // Set journey images
      setJourneyImages(data.images || []);
    }
    setIsLoadingJourney(false);
  };

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
    const { normalizeSkillNames } = require('@/app/lib/skillUtils');
    const normalizedSkills = normalizeSkillNames(formData.skills || []);

    const journeyData = {
      boat_id: formData.boat_id,
      name: formData.name,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      description: formData.description || null,
      risk_level: formData.risk_level || [],
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Journey Name */}
            <div className="md:col-span-2 md:grid md:grid-cols-3 md:gap-4">
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
              <div className="md:col-span-1">
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
            </div>

            {/* Risk Level Selection */}
            <div className="md:col-span-2">
              <RiskLevelSelector
                value={formData.risk_level}
                onChange={(risk_level) => {
                  const singleValue = Array.isArray(risk_level) 
                    ? (risk_level.length > 0 ? risk_level[0] : null)
                    : risk_level;
                  setFormData(prev => ({ ...prev, risk_level: singleValue as 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null }));
                }}
                singleSelect={true}
              />
            </div>

            {/* Minimum Required Experience Level */}
            <div className="md:col-span-2">
              <SkillLevelSelector
                value={formData.min_experience_level}
                onChange={(min_experience_level) => setFormData(prev => ({ ...prev, min_experience_level }))}
              />
            </div>

            {/* Skills */}
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
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

          {/* Requirements Manager */}
          {journeyId && (
            <RequirementsManager
              journeyId={journeyId}
              onRequirementsChange={() => {
                // Optionally reload journey data or refresh UI
              }}
            />
          )}

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

              {/* Image Carousel Preview */}
              {journeyImages.length > 0 && (
                <div className="space-y-4">
                  <ImageCarousel
                    images={journeyImages}
                    alt="Journey"
                    className="w-full"
                    showThumbnails={true}
                    autoPlay={false}
                  />
                  <div className="flex flex-wrap gap-2">
                    {journeyImages.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={imageUrl}
                          alt={`Journey image ${index + 1}`}
                          width={80}
                          height={64}
                          className="w-20 h-16 object-cover rounded-md border border-border"
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
