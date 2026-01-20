'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
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
  const { filters, updateFilters } = useFilters();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  
  // Temporary filter state (for editing before save)
  const [tempLocation, setTempLocation] = useState<Location | null>(null);
  const [tempLocationInput, setTempLocationInput] = useState('');
  const [tempRiskLevel, setTempRiskLevel] = useState<RiskLevel[]>([]);
  const [tempExperienceLevel, setTempExperienceLevel] = useState<ExperienceLevel | null>(null);
  
  // Profile values (from database, for indicators)
  const [profileValues, setProfileValues] = useState<{
    riskLevel: RiskLevel[];
    experienceLevel: ExperienceLevel | null;
  }>({
    riskLevel: [],
    experienceLevel: null,
  });

  // Load user profile data and initialize temp state from filters
  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user]);

  // Initialize temp state from filters when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTempLocation(filters.location);
      setTempLocationInput(filters.locationInput);
      setTempRiskLevel(filters.riskLevel);
      setTempExperienceLevel(filters.experienceLevel);
    }
  }, [isOpen, filters]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    
    try {
      // Load profile values (for indicators)
      const { data, error } = await supabase
        .from('profiles')
        .select('sailing_experience, risk_level')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        const profileRiskLevel = (data.risk_level || []) as RiskLevel[];
        const profileExperienceLevel = data.sailing_experience as ExperienceLevel | null;
        
        setProfileValues({
          riskLevel: profileRiskLevel,
          experienceLevel: profileExperienceLevel,
        });
      }
    } catch (err) {
      console.error('Error loading data:', err);
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

  const handleSave = () => {
    // Save to context (which persists to session storage)
    updateFilters({
      location: tempLocation,
      locationInput: tempLocationInput,
      riskLevel: tempRiskLevel,
      experienceLevel: tempExperienceLevel,
    });
    
    setWarningMessage(null);
    onClose();
  };

  const handleCancel = () => {
    // Revert temp state to current filters
    setTempLocation(filters.location);
    setTempLocationInput(filters.locationInput);
    setTempRiskLevel(filters.riskLevel);
    setTempExperienceLevel(filters.experienceLevel);
    setWarningMessage(null);
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
              <div className="group">
                <div className="relative">
                  <LocationAutocomplete
                    id="filter-location"
                    label="Location"
                    value={tempLocationInput}
                    onChange={(loc) => {
                      setTempLocation(loc);
                      setTempLocationInput(loc.name);
                    }}
                    onInputChange={(value) => {
                      setTempLocationInput(value);
                      if (!value) {
                        setTempLocation(null);
                      }
                    }}
                    placeholder="Search for a location..."
                  />
                  {tempLocation && (
                    <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTempLocation(null);
                      setTempLocationInput('');
                    }}
                      className="absolute right-2 top-[2.25rem] p-1 rounded-md bg-background border border-border opacity-0 group-hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-opacity shadow-sm z-10"
                      aria-label="Clear location"
                      type="button"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground"
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
                  )}
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <SkillLevelSelector
                  value={tempExperienceLevel}
                  onChange={setTempExperienceLevel}
                  profileValue={profileValues.experienceLevel}
                  showProfileIndicator={true}
                  showWarning={true}
                  onWarning={setWarningMessage}
                />
                {warningMessage && (
                  <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">{warningMessage}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk Tolerance */}
              <div>
                <RiskLevelSelector
                  value={tempRiskLevel}
                  onChange={(value) => {
                    if (Array.isArray(value)) {
                      setTempRiskLevel(value);
                    } else {
                      setTempRiskLevel(value ? [value] : []);
                    }
                  }}
                  profileValue={profileValues.riskLevel}
                  showProfileIndicator={true}
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
