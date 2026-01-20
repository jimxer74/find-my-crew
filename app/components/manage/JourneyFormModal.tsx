'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';
import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import { RequirementsManager } from '@/app/components/manage/RequirementsManager';
import skillsConfig from '@/app/config/skills-config.json';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { toDisplaySkillName } from '@/app/lib/skillUtils';

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

type JourneyFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  journeyId?: string | null;
  userId: string;
};

export function JourneyFormModal({ isOpen, onClose, onSuccess, journeyId, userId }: JourneyFormModalProps) {
  const [formData, setFormData] = useState<Journey>({
    boat_id: '',
    name: '',
    start_date: '',
    end_date: '',
    description: '',
    risk_level: null,
    skills: [],
    min_experience_level: 1, // Default to Beginner (1)
    state: 'In planning',
  });
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingJourney, setIsLoadingJourney] = useState(false);
  const [isLoadingBoats, setIsLoadingBoats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBoats();
      if (journeyId) {
        loadJourney();
      } else {
        // Reset form for new journey
        setFormData({
          boat_id: '',
          name: '',
          start_date: '',
          end_date: '',
          description: '',
          risk_level: null,
          skills: [],
          min_experience_level: 1, // Default to Beginner (1)
          state: 'In planning',
        });
        setError(null);
      }
    }
  }, [isOpen, journeyId]);

  const loadBoats = async () => {
    setIsLoadingBoats(true);
    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', userId)
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
    } else if (data) {
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
        skills: displaySkills, // Convert to display format for UI
        min_experience_level: (data.min_experience_level as ExperienceLevel | null) || 1, // Default to Beginner if null
        state: data.state || 'In planning',
      });
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
      if (journeyId) {
        // Check existing journey's legs
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
          // Check if any leg is missing start_date or end_date
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
          // No legs exist yet
          setError('Cannot publish journey: A journey must have at least one leg with start and end dates before it can be published.');
          setLoading(false);
          return;
        }
      } else {
        // New journey - can't publish without legs
        setError('Cannot publish journey: A journey must have at least one leg with start and end dates before it can be published. Please create the journey first, add legs with dates, then publish it.');
        setLoading(false);
        return;
      }
    }

    // Debug: Check authentication
    console.log('=== JOURNEY CREATION DEBUG ===');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    console.log('Auth user:', authUser?.id);
    console.log('Auth error:', authError);
    console.log('User ID from props:', userId);
    
    // Verify boat exists and belongs to user
    if (formData.boat_id) {
      const { data: boatData, error: boatError } = await supabase
        .from('boats')
        .select('id, name, owner_id')
        .eq('id', formData.boat_id)
        .single();
      
      console.log('Boat data:', boatData);
      console.log('Boat error:', boatError);
      console.log('Boat owner_id:', boatData?.owner_id);
      console.log('Auth user id:', authUser?.id);
      console.log('Boat belongs to user:', boatData?.owner_id === authUser?.id);
      
      // Test RLS policy by checking if we can see the boat with the same query the policy uses
      if (authUser?.id) {
        const { data: rlsTestData, error: rlsTestError } = await supabase
          .from('boats')
          .select('id, owner_id')
          .eq('id', formData.boat_id)
          .eq('owner_id', authUser.id)
          .single();
        
        console.log('RLS Policy Test - Can see boat with owner_id filter:', rlsTestData ? 'YES' : 'NO');
        console.log('RLS Policy Test result:', rlsTestData);
        console.log('RLS Policy Test error:', rlsTestError);
      }
      
      if (boatError) {
        console.error('Error fetching boat:', boatError);
      }
      if (!boatData) {
        console.error('Boat not found with id:', formData.boat_id);
      }
      if (boatData && boatData.owner_id !== authUser?.id) {
        console.error('Boat owner mismatch! Boat owner:', boatData.owner_id, 'Auth user:', authUser?.id);
        console.error('This mismatch will cause RLS policy to fail!');
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
      skills: normalizedSkills, // Store in canonical format
      min_experience_level: formData.min_experience_level || 1, // Default to Beginner if somehow null
      state: formData.state,
      updated_at: new Date().toISOString(),
    };

    console.log('Journey data to insert:', JSON.stringify(journeyData, null, 2));
    console.log('================================');

    try {
      if (journeyId) {
        // Update existing journey
        console.log('Updating journey:', journeyId);
        const { data: updateData, error: updateError } = await supabase
          .from('journeys')
          .update(journeyData)
          .eq('id', journeyId)
          .select();

        console.log('Update result data:', updateData);
        console.log('Update error:', updateError);
        if (updateError) {
          console.error('Update error details:', {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
          });
          throw updateError;
        }
      } else {
        // Create new journey
        console.log('Creating new journey...');
        const { data: insertData, error: insertError } = await supabase
          .from('journeys')
          .insert(journeyData)
          .select();

        console.log('Insert result data:', insertData);
        console.log('Insert error:', insertError);
        if (insertError) {
          console.error('Insert error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
          });
          throw insertError;
        }
        console.log('Journey created successfully:', insertData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('=== JOURNEY SAVE ERROR ===');
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error details:', err.details);
      console.error('Error hint:', err.hint);
      console.error('==========================');
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-card-foreground">
                {journeyId ? 'Edit Journey' : 'Create New Journey'}
              </h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoadingJourney || isLoadingBoats ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
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
                  <RiskLevelSelector
                    value={formData.risk_level}
                    onChange={(risk_level) => {
                      // Ensure single value (not array) since singleSelect is true
                      const singleValue = Array.isArray(risk_level) 
                        ? (risk_level.length > 0 ? risk_level[0] : null)
                        : risk_level;
                      setFormData(prev => ({ ...prev, risk_level: singleValue as 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null }));
                    }}
                    singleSelect={true}
                  />

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
                        // Extract all unique skill names from all categories
                        const allSkills = [
                          ...skillsConfig.general,
                          ...skillsConfig.offshore,
                          ...skillsConfig.extreme
                        ];
                        // Convert snake_case to Title Case for display
                        const formatSkillName = (name: string) => {
                          return name
                            .split('_')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        return allSkills.map((skill) => {
                          const displayName = formatSkillName(skill.name);
                          return (
                            <label key={skill.name} className="flex items-center gap-2 cursor-pointer">
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
                      <label className="flex items-center">
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
                      <label className="flex items-center">
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
                      <label className="flex items-center">
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

                {/* Requirements Manager - Only show when editing existing journey */}
                {journeyId && (
                  <RequirementsManager
                    journeyId={journeyId}
                    onRequirementsChange={() => {
                      // Optionally reload journey data or refresh UI
                    }}
                  />
                )}

                {/* Form Actions */}
                <div className="flex justify-end gap-4 pt-4 border-t border-border mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || boats.length === 0}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  >
                    {loading ? 'Saving...' : journeyId ? 'Update Journey' : 'Create Journey'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
