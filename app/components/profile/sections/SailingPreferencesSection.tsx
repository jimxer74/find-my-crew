'use client';

import { useState } from 'react';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';
import { LocationAutocomplete, type Location } from '@/app/components/ui/LocationAutocomplete';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { Button } from '@/app/components/ui/Button/Button';

type SkillEntry = {
  skill_name: string;
  description: string;
};

type FormData = {
  username: string;
  full_name: string;
  user_description: string;
  certifications: string;
  phone: string;
  email: string;
  sailing_experience: ExperienceLevel | null;
  risk_level: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[];
  skills: SkillEntry[];
  sailing_preferences: string;
  profile_image_url: string;
  roles: ('owner' | 'crew')[];
  preferred_departure_location: Location | null;
  preferred_arrival_location: Location | null;
  availability_start_date: string;
  availability_end_date: string;
};

type SailingPreferencesSectionProps = {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isFieldMissing: (fieldName: string) => boolean;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  onClose?: () => void;
};

export function SailingPreferencesSection({
  formData,
  setFormData,
  isFieldMissing,
  onInfoClick,
  onClose,
}: SailingPreferencesSectionProps) {
  const [departureInput, setDepartureInput] = useState(formData.preferred_departure_location?.name || '');
  const [arrivalInput, setArrivalInput] = useState(formData.preferred_arrival_location?.name || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Risk Level */}
      <div className={isFieldMissing('risk_level') ? 'p-3 border border-primary/50 bg-primary/5 rounded-md' : ''}>
        <RiskLevelSelector
          value={formData.risk_level}
          onChange={(risk_level) => {
            const normalizedRiskLevel: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[] =
              risk_level === null ? [] :
              Array.isArray(risk_level) ? risk_level :
              [risk_level];
            setFormData(prev => ({ ...prev, risk_level: normalizedRiskLevel }));
          }}
          showRequiredBadge={isFieldMissing('risk_level')}
          onInfoClick={onInfoClick}
          onClose={onClose}
        />
      </div>

      {/* Sailing Preferences */}
      <div>
        <label htmlFor="sailing_preferences" className="block text-sm font-medium text-foreground mb-2">
          Motivation and Sailing Preferences
          {isFieldMissing('sailing_preferences') && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded">
              Please complete
            </span>
          )}
        </label>
        <textarea
          id="sailing_preferences"
          name="sailing_preferences"
          value={formData.sailing_preferences}
          onChange={handleChange}
          className={`w-full px-3 py-3 min-h-[120px] text-base sm:text-sm border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y ${
            isFieldMissing('sailing_preferences') ? 'border-primary/50 bg-primary/5' : 'border-border'
          }`}
          placeholder="Describe your sailing goals, what kind of sailing excites you, any dietary restrictions, health considerations..."
        />
      </div>

      {/* Location & Availability Preferences */}
      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Location & Availability Preferences</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Set your preferred sailing locations and when you are available. These are used to personalize your search results and help skippers find matching crew.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Preferred Departure Location */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-foreground">
                Preferred Departure
              </label>
              {formData.preferred_departure_location && (
                <Button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, preferred_departure_location: null }));
                    setDepartureInput('');
                  }}
                  variant="ghost"
                  size="sm"
                  className="!text-xs !h-auto !p-0 text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <LocationAutocomplete
              id="preferred_departure_location"
              value={departureInput}
              onChange={(location) => {
                setFormData(prev => ({ ...prev, preferred_departure_location: location }));
                setDepartureInput(location.name);
              }}
              onInputChange={setDepartureInput}
              placeholder="e.g., Western Mediterranean, Barcelona..."
            />
            {formData.preferred_departure_location?.isCruisingRegion && (
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
                Cruising region selected
              </p>
            )}
          </div>

          {/* Preferred Arrival Location */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-foreground">
                Preferred Arrival
              </label>
              {formData.preferred_arrival_location && (
                <Button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, preferred_arrival_location: null }));
                    setArrivalInput('');
                  }}
                  variant="ghost"
                  size="sm"
                  className="!text-xs !h-auto !p-0 text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              )}
            </div>
            <LocationAutocomplete
              id="preferred_arrival_location"
              value={arrivalInput}
              onChange={(location) => {
                setFormData(prev => ({ ...prev, preferred_arrival_location: location }));
                setArrivalInput(location.name);
              }}
              onInputChange={setArrivalInput}
              placeholder="e.g., Caribbean, Canary Islands..."
            />
            {formData.preferred_arrival_location?.isCruisingRegion && (
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
                Cruising region selected
              </p>
            )}
          </div>
        </div>

        {/* Availability Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="availability_start_date" className="block text-sm font-medium text-foreground mb-1">
              Available From
            </label>
            <input
              type="date"
              id="availability_start_date"
              name="availability_start_date"
              value={formData.availability_start_date}
              onChange={handleChange}
              className="w-full px-3 py-2 text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
          <div>
            <label htmlFor="availability_end_date" className="block text-sm font-medium text-foreground mb-1">
              Available Until
            </label>
            <input
              type="date"
              id="availability_end_date"
              name="availability_end_date"
              value={formData.availability_end_date}
              onChange={handleChange}
              min={formData.availability_start_date || undefined}
              className="w-full px-3 py-2 text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
