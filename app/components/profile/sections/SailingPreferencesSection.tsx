'use client';

import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';
import { ExperienceLevel } from '@/app/types/experience-levels';

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
    </div>
  );
}
