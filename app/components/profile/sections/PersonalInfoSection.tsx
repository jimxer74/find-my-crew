'use client';

import { ExperienceLevel } from '@shared/types/experience-levels';
import { type Location } from '@shared/ui/LocationAutocomplete';
import { Button } from '@shared/ui/Button/Button';

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

type PersonalInfoSectionProps = {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  userEmail?: string;
  uploadingImage: boolean;
  handleImageUpload: (file: File | null) => Promise<void>;
  removeProfileImage: () => Promise<void>;
  isFieldMissing: (fieldName: string) => boolean;
};

export function PersonalInfoSection({
  formData,
  setFormData,
  userEmail,
  uploadingImage,
  handleImageUpload,
  removeProfileImage,
  isFieldMissing,
}: PersonalInfoSectionProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Role Management */}
      <div className="pb-6 border-b border-border">
        <label className="block text-sm font-medium text-foreground mb-3">
          I am a... <span className="text-muted-foreground">(select all that apply)</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors">
            <input
              type="checkbox"
              checked={formData.roles.includes('owner')}
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData(prev => ({
                    ...prev,
                    roles: [...prev.roles.filter(r => r !== 'owner'), 'owner'] as ('owner' | 'crew')[]
                  }));
                } else {
                  setFormData(prev => ({
                    ...prev,
                    roles: prev.roles.filter(r => r !== 'owner') as ('owner' | 'crew')[]
                  }));
                }
              }}
              className="mr-3 w-5 h-5"
            />
            <span className="text-sm font-medium">Boat Owner/Skipper</span>
          </label>
          <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors">
            <input
              type="checkbox"
              checked={formData.roles.includes('crew')}
              onChange={(e) => {
                if (e.target.checked) {
                  setFormData(prev => ({
                    ...prev,
                    roles: [...prev.roles.filter(r => r !== 'crew'), 'crew'] as ('owner' | 'crew')[]
                  }));
                } else {
                  setFormData(prev => ({
                    ...prev,
                    roles: prev.roles.filter(r => r !== 'crew') as ('owner' | 'crew')[]
                  }));
                }
              }}
              className="mr-3 w-5 h-5"
            />
            <span className="text-sm font-medium">Crew Member</span>
          </label>
        </div>
        {formData.roles.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Select at least one role to unlock features. You can be both an owner and crew member!
          </p>
        )}
        {formData.roles.length > 0 && (
          <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-md">
            <p className="text-sm text-foreground">
              <strong>Selected roles:</strong> {formData.roles.join(' and ')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.roles.includes('owner') && '• Create and manage boats and journeys'}
              {formData.roles.includes('owner') && formData.roles.includes('crew') && ' • '}
              {formData.roles.includes('crew') && '• Register for crew positions'}
            </p>
          </div>
        )}
      </div>

      {/* Profile Image Upload */}
      <div className="flex flex-col items-center gap-4 pb-6 border-b border-border">
        <label className="block text-sm font-medium text-foreground mb-2">
          Profile Image
        </label>
        <div className="relative">
          {formData.profile_image_url ? (
            <div className="relative group">
              <img
                src={formData.profile_image_url}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-border"
              />
              <Button
                type="button"
                onClick={removeProfileImage}
                variant="destructive"
                size="sm"
                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg !p-2 !min-w-[44px] !min-h-[44px]"
                aria-label="Remove profile image"
                title="Remove profile image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          ) : (
            <div className="w-32 h-32 rounded-full border-4 border-dashed border-border flex items-center justify-center bg-muted">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
        <label className="flex flex-col items-center justify-center w-full border-2 border-border border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors px-4 py-4 min-h-[120px] sm:min-h-[100px]">
          <div className="flex flex-col items-center justify-center">
            <svg className="w-6 h-6 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              if (file) {
                handleImageUpload(file);
              }
            }}
            disabled={uploadingImage}
          />
        </label>
        {uploadingImage && (
          <p className="text-sm text-muted-foreground">Uploading image...</p>
        )}
      </div>

      {/* Basic Info Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-2">
            Full Name *
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            className={`w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              isFieldMissing('full_name') ? 'border-primary/50 bg-primary/5' : 'border-border'
            }`}
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
            Username
            {isFieldMissing('username') && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded">
                Please complete
              </span>
            )}
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className={`w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
              isFieldMissing('username') ? 'border-primary/50 bg-primary/5' : 'border-border'
            }`}
            placeholder="johndoe"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={userEmail || ''}
            readOnly
            className="w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border border-border bg-muted rounded-md shadow-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
            placeholder="+1 234 567 8900"
          />
        </div>
      </div>

      {/* About You / User Description */}
      <div className="pt-6 border-t border-border">
        <label htmlFor="user_description" className="block text-sm font-medium text-foreground mb-2">
          About You
        </label>
        <textarea
          id="user_description"
          name="user_description"
          value={formData.user_description}
          onChange={handleChange}
          rows={4}
          className="w-full px-3 py-3 min-h-[120px] text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
          placeholder="Tell us about yourself - your background, interests, and what brings you to sailing..."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          This helps boat owners and crew members get to know you better.
        </p>
      </div>
    </div>
  );
}
