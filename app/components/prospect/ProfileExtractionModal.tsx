'use client';

import { useState, useEffect } from 'react';
import { extractProfileFromConversation, ExtractedProfile } from '@/app/lib/prospect/profileExtraction';
import { ProspectMessage } from '@/app/lib/ai/prospect/types';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

interface ProfileExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ProspectMessage[];
  onSuccess: () => void | Promise<void>;
}

const EXPERIENCE_LEVELS = {
  1: 'Beginner',
  2: 'Competent Crew',
  3: 'Coastal Skipper',
  4: 'Offshore Skipper',
};

export function ProfileExtractionModal({
  isOpen,
  onClose,
  messages,
  onSuccess,
}: ProfileExtractionModalProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<ExtractedProfile | null>(null);
  const [formData, setFormData] = useState<ExtractedProfile & { username?: string }>({});
  const [error, setError] = useState<string | null>(null);

  // Extract profile when modal opens
  useEffect(() => {
    if (isOpen && !extractedProfile) {
      setIsExtracting(true);
      const extracted = extractProfileFromConversation(messages);
      setExtractedProfile(extracted);
      setFormData(extracted);
      setIsExtracting(false);
    }
  }, [isOpen, messages, extractedProfile]);

  const handleFieldChange = (field: keyof ExtractedProfile, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.user_description || !formData.sailing_experience) {
      setError('Please fill in at least your bio and sailing experience level');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .single();

      const profileData: Record<string, unknown> = {
        id: user.id,
        full_name: formData.full_name || user.user_metadata?.full_name || user.user_metadata?.name || null,
        user_description: formData.user_description,
        sailing_experience: formData.sailing_experience,
        risk_level: formData.risk_level || [],
        skills: formData.skills ? formData.skills.map(s => JSON.stringify(s)) : [],
        sailing_preferences: formData.sailing_preferences || null,
        certifications: formData.certifications || null,
        phone: formData.phone || null,
        email: user.email,
        roles: ['crew'],
        updated_at: new Date().toISOString(),
      };

      if (existingProfile) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id);

        if (updateError) throw updateError;
      } else {
        // Create new profile
        // Generate username if not provided
        if (!formData.username) {
          const baseUsername = (formData.full_name || user.email?.split('@')[0] || 'user')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .substring(0, 20);
          profileData.username = `${baseUsername}_${Math.random().toString(36).substr(2, 9)}`;
        } else {
          profileData.username = formData.username;
        }

        profileData.created_at = new Date().toISOString();

        const { error: insertError } = await supabase
          .from('profiles')
          .insert(profileData);

        if (insertError) {
          if (insertError.code === '23505') {
            // Username conflict, try again with different suffix
            profileData.username = `${profileData.username}_${Math.random().toString(36).substr(2, 5)}`;
            const { error: retryError } = await supabase
              .from('profiles')
              .insert(profileData);
            if (retryError) throw retryError;
          } else {
            throw insertError;
          }
        }
      }

      await onSuccess();
      onClose();
    } catch (err: any) {
      logger.error('Failed to save profile:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              Review Your Profile Information
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            I've extracted your profile information from our conversation. Please review and edit as needed, then save your profile.
          </p>

          {isExtracting ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="ml-3 text-sm text-muted-foreground">Extracting profile information...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => handleFieldChange('full_name', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground"
                  placeholder="Your full name"
                />
              </div>

              {/* Bio/Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Bio / Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={formData.user_description || ''}
                  onChange={(e) => handleFieldChange('user_description', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground"
                  placeholder="Tell us about yourself and your sailing background..."
                  rows={4}
                  required
                />
              </div>

              {/* Sailing Experience */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Sailing Experience Level <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.sailing_experience || ''}
                  onChange={(e) => handleFieldChange('sailing_experience', parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground"
                  required
                >
                  <option value="">Select experience level</option>
                  {Object.entries(EXPERIENCE_LEVELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {value}. {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Risk Level */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Comfort Zones
                </label>
                <div className="space-y-2">
                  {['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].map((level) => (
                    <label key={level} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.risk_level?.includes(level) || false}
                        onChange={(e) => {
                          const current = formData.risk_level || [];
                          if (e.target.checked) {
                            handleFieldChange('risk_level', [...current, level]);
                          } else {
                            handleFieldChange('risk_level', current.filter(l => l !== level));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-foreground">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Skills */}
              {formData.skills && formData.skills.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Skills
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {formData.skills.map((skill, index) => (
                      <div key={index} className="p-2 bg-muted rounded">
                        <div className="font-medium text-sm">{skill.skill_name}</div>
                        {skill.description && (
                          <div className="text-xs text-muted-foreground mt-1">{skill.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sailing Preferences */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Sailing Preferences
                </label>
                <textarea
                  value={formData.sailing_preferences || ''}
                  onChange={(e) => handleFieldChange('sailing_preferences', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground"
                  placeholder="Where do you want to sail? What are you looking for?"
                  rows={3}
                />
              </div>

              {/* Certifications */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Certifications
                </label>
                <input
                  type="text"
                  value={formData.certifications || ''}
                  onChange={(e) => handleFieldChange('certifications', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground"
                  placeholder="RYA, ASA, etc."
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-foreground"
                  placeholder="Your phone number"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.user_description || !formData.sailing_experience}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
