'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';
import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import skillsConfig from '@/app/config/skills-config.json';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { normalizeSkillNames } from '@/app/lib/skillUtils';
import { canCreateJourney } from '@/app/lib/limits';
import { Footer } from '@/app/components/Footer';
import { FeatureGate } from '@/app/components/auth/FeatureGate';

type JourneyState = 'In planning' | 'Published' | 'Archived';

type JourneyFormData = {
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

const initialFormData: JourneyFormData = {
  boat_id: '',
  name: '',
  start_date: '',
  end_date: '',
  description: '',
  risk_level: null,
  skills: [],
  min_experience_level: 1,
  state: 'In planning',
};

export default function CreateJourneyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<JourneyFormData>(initialFormData);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [isLoadingBoats, setIsLoadingBoats] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [currentJourneyCount, setCurrentJourneyCount] = useState(0);
  const [limit, setLimit] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadBoats();
      checkJourneyLimit();
    }
  }, [user]);

  const loadBoats = async () => {
    setIsLoadingBoats(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: boatsError } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', user?.id)
      .order('name', { ascending: true });

    if (boatsError) {
      console.error('Failed to load boats:', boatsError);
      setError('Failed to load boats');
    } else {
      setBoats(data || []);
    }
    setIsLoadingBoats(false);
  };

  const checkJourneyLimit = async () => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    const result = await canCreateJourney(supabase, user.id);
    setCurrentJourneyCount(result.current);
    setLimit(result.limit || null);
    setLimitReached(!result.allowed);
    if (!result.allowed) {
      setError(result.message || `Journey limit reached (${result.current}/${result.limit})`);
    } else {
      setError(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to create a journey');
      return;
    }

    if (!formData.boat_id) {
      setError('Please select a boat');
      return;
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (endDate < startDate) {
        setError('End date must be on or after start date.');
        return;
      }
    }

    if (!formData.risk_level) {
      setError('Please select a risk level');
      return;
    }

    if (!formData.min_experience_level) {
      setError('Please select a minimum experience level');
      return;
    }

    if (limitReached) {
      setError('Journey limit reached. Please archive existing journeys before creating a new one.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const normalizedSkills = normalizeSkillNames(formData.skills || []);

    const journeyData = {
      boat_id: formData.boat_id,
      name: formData.name,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      description: formData.description || null,
      risk_level: formData.risk_level ? [formData.risk_level] : [],
      skills: normalizedSkills,
      min_experience_level: formData.min_experience_level || 1,
      state: formData.state,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_ai_generated: false,
    };

    try {
      const { data, error: insertError } = await supabase
        .from('journeys')
        .insert(journeyData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      router.push('/owner/journeys');
    } catch (err: any) {
      console.error('Failed to create journey:', err);
      setError(err.message || 'Failed to create journey');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (user && isLoadingBoats)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <FeatureGate feature="create_journey">
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
          <div>
            <Link
              href="/owner/journeys"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
            >
              ← Back to Journeys
            </Link>
            <h1 className="text-3xl font-semibold text-foreground mt-2">Create Journey</h1>
            <p className="text-sm text-muted-foreground">
              Plan a new itinerary and configure the journey metadata before adding legs.
            </p>
            {(currentJourneyCount > 0 || limit !== null) && (
              <p className="text-xs text-muted-foreground mt-1">
                Journeys used: {currentJourneyCount}
                {typeof limit === 'number' ? ` / ${limit}` : ''}.
                {limitReached ? ' Limit reached.' : ''}
              </p>
            )}
          </div>

          <div className="bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {!boats.length && (
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                  You need to add a boat before creating a journey.{' '}
                  <Link href="/owner/boats" className="text-primary underline">
                    Add boat
                  </Link>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                    Journey Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                    placeholder="Mediterranean Adventure 2026"
                  />
                </div>

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
                    className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  >
                    <option value="">Select a boat</option>
                    {boats.map((boat) => (
                      <option key={boat.id} value={boat.id}>
                        {boat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="start_date" className="block text-sm font-medium text-foreground mb-1">
                    Start Date
                  </label>
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  />
                </div>

                <div>
                  <label htmlFor="end_date" className="block text-sm font-medium text-foreground mb-1">
                    End Date
                  </label>
                  <input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={handleChange}
                    min={formData.start_date || undefined}
                    className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full rounded-md border border-border px-3 py-2 bg-input-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
                  placeholder="Describe what makes this journey special..."
                />
              </div>

              <div>
                <RiskLevelSelector
                  value={formData.risk_level}
                  onChange={(risk_level) => {
                    const singleValue = Array.isArray(risk_level)
                      ? (risk_level.length > 0 ? risk_level[0] : null)
                      : risk_level;
                    setFormData((prev) => ({
                      ...prev,
                      risk_level: singleValue as 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null,
                    }));
                  }}
                  singleSelect
                />
              </div>

              <div>
                <SkillLevelSelector
                  value={formData.min_experience_level}
                  onChange={(level) => setFormData((prev) => ({ ...prev, min_experience_level: level }))}
                />
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const allSkills = [
                      ...skillsConfig.general,
                      ...skillsConfig.offshore,
                      ...skillsConfig.extreme,
                    ];
                    const displaySkill = (name: string) =>
                      name
                        .split('_')
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    return allSkills.map((skill) => {
                      const label = displaySkill(skill.name);
                      return (
                        <label key={skill.name} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={formData.skills.includes(label)}
                            onChange={() => handleSkillToggle(label)}
                            className="rounded border-border"
                          />
                          <span>{label}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Journey State *</p>
                <div className="flex flex-wrap gap-4">
                  {(['In planning', 'Published', 'Archived'] as JourneyState[]).map((stateOption) => (
                    <label key={stateOption} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="state"
                        value={stateOption}
                        checked={formData.state === stateOption}
                        onChange={handleChange}
                        className="rounded border-border text-primary focus-visible:ring-ring"
                      />
                      <span className="text-sm text-foreground">{stateOption}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-3 border-t border-border">
                <Link
                  href="/owner/journeys"
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting || !boats.length || limitReached}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
                >
                  {isSubmitting ? 'Creating...' : 'Create Journey'}
                </button>
              </div>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    </FeatureGate>
  );
}
