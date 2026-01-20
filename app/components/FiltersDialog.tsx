'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from './ui/LocationAutocomplete';
import { RiskLevelSelector } from './ui/RiskLevelSelector';
import { SkillLevelSelector } from './ui/SkillLevelSelector';
import { ExperienceLevel } from '@/app/types/experience-levels';

type FiltersDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

export function FiltersDialog({ isOpen, onClose }: FiltersDialogProps) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [location, setLocation] = useState<Location | null>(null);
  const [locationInput, setLocationInput] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  
  // Original values for cancel
  const [originalValues, setOriginalValues] = useState({
    location: null as Location | null,
    locationInput: '',
    riskLevel: [] as RiskLevel[],
    experienceLevel: null as ExperienceLevel | null,
  });

  // Load user profile data
  useEffect(() => {
    if (isOpen && user) {
      loadUserProfile();
    }
  }, [isOpen, user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('sailing_experience, risk_level')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        const loadedRiskLevel = (data.risk_level || []) as RiskLevel[];
        const loadedExperienceLevel = data.sailing_experience as ExperienceLevel | null;

        setRiskLevel(loadedRiskLevel);
        setExperienceLevel(loadedExperienceLevel);
        
        // Store original values
        setOriginalValues({
          location: null,
          locationInput: '',
          riskLevel: loadedRiskLevel,
          experienceLevel: loadedExperienceLevel,
        });
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // Close dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSave = async () => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          sailing_experience: experienceLevel,
          risk_level: riskLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving filters:', error);
        return;
      }

      // Update original values
      setOriginalValues({
        location: location,
        locationInput: locationInput,
        riskLevel: riskLevel,
        experienceLevel: experienceLevel,
      });

      onClose();
    } catch (err) {
      console.error('Error saving filters:', err);
    }
  };

  const handleCancel = () => {
    // Revert to original values
    setLocation(originalValues.location);
    setLocationInput(originalValues.locationInput);
    setRiskLevel(originalValues.riskLevel);
    setExperienceLevel(originalValues.experienceLevel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={handleCancel}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none py-4">
        <div
          ref={dialogRef}
          className="pointer-events-auto bg-card border border-border rounded-xl shadow-lg p-6 relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
        >
          {/* Close button */}
          <button
            onClick={handleCancel}
            className="absolute top-2 right-2 p-1.5 hover:bg-muted rounded-md transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-6 pr-8">Filters</h2>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Location Autocomplete */}
              <div>
                <LocationAutocomplete
                  id="filter-location"
                  label="Location"
                  value={locationInput}
                  onChange={(loc) => {
                    setLocation(loc);
                    setLocationInput(loc.name);
                  }}
                  onInputChange={(value) => {
                    setLocationInput(value);
                    if (!value) {
                      setLocation(null);
                    }
                  }}
                  placeholder="Search for a location..."
                />
              </div>

              {/* Experience Level */}
              <div>
                <SkillLevelSelector
                  value={experienceLevel}
                  onChange={setExperienceLevel}
                />
              </div>

              {/* Risk Tolerance */}
              <div>
                <RiskLevelSelector
                  value={riskLevel}
                  onChange={(value) => {
                    if (Array.isArray(value)) {
                      setRiskLevel(value);
                    } else {
                      setRiskLevel(value ? [value] : []);
                    }
                  }}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-background bg-foreground hover:opacity-90 rounded-md transition-opacity"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
