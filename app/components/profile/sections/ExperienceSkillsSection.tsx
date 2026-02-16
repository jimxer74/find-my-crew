'use client';

import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import { useTheme } from '@/app/contexts/ThemeContext';
import { ExperienceLevel } from '@/app/types/experience-levels';
import skillsConfig from '@/app/config/skills-config.json';
import { useEffect } from 'react';
import { type Location } from '@/app/components/ui/LocationAutocomplete';

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

type ExperienceSkillsSectionProps = {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  isFieldMissing: (fieldName: string) => boolean;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  onShowSkillsSidebar?: () => void;
  aiTargetSkills?: string[] | null;
};

export function ExperienceSkillsSection({
  formData,
  setFormData,
  isFieldMissing,
  onInfoClick,
  onShowSkillsSidebar,
  aiTargetSkills,
}: ExperienceSkillsSectionProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Process AI target skills on mount
  useEffect(() => {
    if (aiTargetSkills && aiTargetSkills.length > 0) {
      // Get existing skill names for duplicate checking
      const existingSkillNames = new Set(formData.skills.map(s => s.skill_name));

      // Process target skills: filter valid ones and add with default descriptions
      const newSkills: SkillEntry[] = [];
      aiTargetSkills.forEach(skillName => {
        // Skip if skill already exists
        if (existingSkillNames.has(skillName)) {
          return;
        }

        // Find skill config to get starting sentence
        const skillConfig = skillsConfig.general.find(config => config.name === skillName);
        if (skillConfig) {
          newSkills.push({
            skill_name: skillName,
            description: skillConfig.startingSentence || '',
          });
        }
      });

      // Add new skills if any
      if (newSkills.length > 0) {
        setFormData((prev) => ({
          ...prev,
          skills: [...prev.skills, ...newSkills],
        }));
      }
    }
  }, [aiTargetSkills, formData.skills, setFormData]);

  // Remove skill from form
  const removeSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  // Update skill description
  const updateSkillDescription = (index: number, description: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) =>
        i === index ? { ...s, description } : s
      ),
    }));
  };

  // Convert snake_case to Title Case for display
  const formatSkillName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };



  return (
    <div className="space-y-6">
      {/* Sailing Experience Level */}
      <div className={isFieldMissing('sailing_experience') ? 'p-3 border border-primary/50 bg-primary/5 rounded-md' : ''}>
        <SkillLevelSelector
          value={formData.sailing_experience}
          onChange={(sailing_experience) => setFormData(prev => ({ ...prev, sailing_experience }))}
          showRequiredBadge={isFieldMissing('sailing_experience')}
          onInfoClick={onInfoClick}
        />
      </div>

      {/* Skills Selection */}
      <div className={`space-y-4 ${isFieldMissing('skills') ? 'p-3 border border-primary/50 bg-primary/5 rounded-md' : ''}`}>
        <div className="flex items-center mb-2">
          <label className="block text-sm font-medium text-foreground">
            Skills
            {isFieldMissing('skills') && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded">
                Please complete
              </span>
            )}
          </label>
        </div>

        {/* Display selected skills with editable descriptions */}
        {formData.skills.length > 0 && (
          <div className="space-y-3 mb-3">
            {formData.skills.map((skill, index) => {
              const displayName = formatSkillName(skill.skill_name);

              return (
                <div key={`${skill.skill_name}-${index}`} className="flex items-start gap-2 p-3 border border-border rounded-md bg-card">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">
                        {displayName}
                      </label>
                      <button
                        type="button"
                        onClick={() => removeSkill(index)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                        title="Remove skill"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      id={`skill-${skill.skill_name}-${index}`}
                      value={skill.description}
                      onChange={(e) => updateSkillDescription(index, e.target.value)}
                      placeholder={`Describe your ${displayName.toLowerCase()} experience...`}
                      rows={2}
                      className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Skills button */}
        <button
          id="skill-add-button"
          type="button"
          onClick={onShowSkillsSidebar}
          className="w-full px-4 py-3 min-h-[44px] border-2 border-dashed border-border rounded-md bg-card hover:bg-accent hover:border-primary transition-colors text-sm font-medium text-foreground flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Skills
        </button>
      </div>

      {/* Certifications */}
      <div>
        <label htmlFor="certifications" className="block text-sm font-medium text-foreground mb-2">
          Certifications & Qualifications
        </label>
        <textarea
          id="certifications"
          name="certifications"
          value={formData.certifications}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-3 min-h-[100px] text-base sm:text-sm border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
          placeholder={
            formData.roles.includes('owner')
              ? 'List any relevant certifications, licenses, or qualifications'
              : 'List your sailing certifications, licenses, or qualifications (e.g., RYA, ASA, etc.)'
          }
        />
      </div>
    </div>
  );
}
