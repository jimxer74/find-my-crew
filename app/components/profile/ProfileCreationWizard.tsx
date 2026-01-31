'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { FacebookUserData, ProfileSuggestion } from '@/app/lib/facebook/types';
import { ExperienceLevel } from '@/app/types/experience-levels';
import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';

type WizardStep = 'loading' | 'consent' | 'fetching' | 'analyzing' | 'review' | 'saving' | 'complete' | 'error';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type SkillEntry = {
  skill_name: string;
  description: string;
};

interface ProfileFormData {
  username: string;
  full_name: string;
  profile_image_url: string;
  sailing_experience: ExperienceLevel | null;
  user_description: string;
  certifications: string;
  sailing_preferences: string;
  skills: SkillEntry[];
  risk_level: RiskLevel[];
  roles: ('owner' | 'crew')[];
}

export function ProfileCreationWizard() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [facebookData, setFacebookData] = useState<FacebookUserData | null>(null);
  const [suggestion, setSuggestion] = useState<ProfileSuggestion | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    username: '',
    full_name: '',
    profile_image_url: '',
    sailing_experience: null,
    user_description: '',
    certifications: '',
    sailing_preferences: '',
    skills: [],
    risk_level: [],
    roles: [],
  });
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [aiConsent, setAiConsent] = useState(false);

  // Check if user has given AI consent and fetch Facebook data
  useEffect(() => {
    const init = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Check existing consents
      const { data: consents } = await supabase
        .from('user_consents')
        .select('ai_processing_consent, consent_setup_completed_at')
        .eq('user_id', user.id)
        .single();

      if (consents?.ai_processing_consent) {
        setAiConsent(true);
        setStep('fetching');
        fetchFacebookData();
      } else {
        setStep('consent');
      }
    };

    init();
  }, [router]);

  const fetchFacebookData = useCallback(async () => {
    try {
      setStep('fetching');
      const response = await fetch('/api/facebook/fetch-data');
      const result = await response.json();

      if (!response.ok) {
        // If no Facebook token, proceed with manual entry
        if (response.status === 401) {
          setStep('review');
          return;
        }
        throw new Error(result.error || 'Failed to fetch Facebook data');
      }

      setFacebookData(result.data);

      // If we have Facebook data and AI consent, generate suggestions
      if (result.data && aiConsent) {
        await generateProfileSuggestions(result.data);
      } else {
        // Apply basic data from Facebook
        if (result.data?.profile) {
          setFormData(prev => ({
            ...prev,
            full_name: result.data.profile.name || '',
            profile_image_url: result.data.profilePictureUrl || '',
          }));
        }
        setStep('review');
      }
    } catch (err: any) {
      console.error('Error fetching Facebook data:', err);
      // Continue to review with manual entry
      setStep('review');
    }
  }, [aiConsent]);

  const generateProfileSuggestions = async (fbData: FacebookUserData) => {
    try {
      setStep('analyzing');
      const response = await fetch('/api/ai/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebookData: fbData }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Continue without AI suggestions
        if (fbData.profile) {
          setFormData(prev => ({
            ...prev,
            full_name: fbData.profile?.name || '',
            profile_image_url: fbData.profilePictureUrl || '',
          }));
        }
        setStep('review');
        return;
      }

      setSuggestion(result.suggestion);

      // Apply suggestions to form
      const sugg = result.suggestion as ProfileSuggestion;
      // Convert skills from string[] to SkillEntry[]
      const skillEntries: SkillEntry[] = (sugg.skills || []).map((skill: string) => ({
        skill_name: skill,
        description: '',
      }));
      setFormData({
        username: sugg.username || '',
        full_name: sugg.fullName || '',
        profile_image_url: sugg.profileImageUrl || '',
        sailing_experience: sugg.sailingExperience as ExperienceLevel | null,
        user_description: sugg.userDescription || '',
        certifications: sugg.certifications || '',
        sailing_preferences: sugg.sailingPreferences || '',
        skills: skillEntries,
        risk_level: (sugg.riskLevel || []).filter((r): r is RiskLevel =>
          ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].includes(r)
        ),
        roles: [],
      });

      setStep('review');
    } catch (err) {
      console.error('Error generating profile suggestions:', err);
      // Continue without AI suggestions
      if (fbData.profile) {
        setFormData(prev => ({
          ...prev,
          full_name: fbData.profile?.name || '',
          profile_image_url: fbData.profilePictureUrl || '',
        }));
      }
      setStep('review');
    }
  };

  const handleConsentSubmit = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    // Save AI consent
    await supabase.from('user_consents').upsert({
      user_id: user.id,
      ai_processing_consent: aiConsent,
      ai_processing_consent_at: aiConsent ? new Date().toISOString() : null,
    });

    if (aiConsent) {
      fetchFacebookData();
    } else {
      setStep('review');
    }
  };

  const handleUsernameChange = async (username: string) => {
    setFormData(prev => ({ ...prev, username }));
    setUsernameError(null);

    if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    // Check if username is available
    const supabase = getSupabaseBrowserClient();
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      setUsernameError('Username is already taken');
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameError('Username is required (min 3 characters)');
      return;
    }

    if (formData.roles.length === 0) {
      setError('Please select at least one role');
      return;
    }

    setStep('saving');
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Create the profile - serialize skills to JSON strings
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        username: formData.username,
        full_name: formData.full_name,
        profile_image_url: formData.profile_image_url,
        sailing_experience: formData.sailing_experience,
        user_description: formData.user_description || null,
        certifications: formData.certifications || null,
        sailing_preferences: formData.sailing_preferences || null,
        skills: formData.skills.map(skill => JSON.stringify(skill)),
        risk_level: formData.risk_level,
        roles: formData.roles,
        email: user.email,
      });

      if (profileError) {
        if (profileError.code === '23505') {
          setUsernameError('Username is already taken');
          setStep('review');
          return;
        }
        throw profileError;
      }

      setStep('complete');

      // Redirect after a moment
      setTimeout(() => {
        if (formData.roles.includes('owner')) {
          router.push('/owner/boats');
        } else {
          router.push('/crew/dashboard');
        }
      }, 2000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
      setStep('review');
    }
  };

  const handleSkipToManual = () => {
    if (facebookData?.profile) {
      setFormData(prev => ({
        ...prev,
        full_name: facebookData.profile?.name || '',
        profile_image_url: facebookData.profilePictureUrl || '',
      }));
    }
    setStep('review');
  };

  // Render different steps
  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (step === 'consent') {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Welcome to Find My Crew!</h2>
          <p className="mt-2 text-muted-foreground">
            Let&apos;s set up your profile. We can use AI to help fill in your sailing profile based on your Facebook data.
          </p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aiConsent}
              onChange={(e) => setAiConsent(e.target.checked)}
              className="mt-1 w-5 h-5"
            />
            <div>
              <span className="font-medium text-foreground">Enable AI-powered profile suggestions</span>
              <p className="text-sm text-muted-foreground mt-1">
                We&apos;ll analyze your Facebook posts and interests to suggest relevant sailing experience and skills.
                You can review and edit all suggestions before saving.
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setAiConsent(false);
              setStep('review');
            }}
            className="flex-1 px-4 py-3 border border-border rounded-md text-foreground hover:bg-accent transition-colors"
          >
            Skip, I&apos;ll fill manually
          </button>
          <button
            onClick={handleConsentSubmit}
            className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === 'fetching') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-foreground font-medium">Fetching your Facebook data...</p>
        <p className="text-muted-foreground text-sm">This may take a moment</p>
      </div>
    );
  }

  if (step === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-foreground font-medium">Analyzing your profile with AI...</p>
        <p className="text-muted-foreground text-sm">Looking for sailing-related content</p>
        <button
          onClick={handleSkipToManual}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Skip and fill manually
        </button>
      </div>
    );
  }

  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-foreground font-medium">Saving your profile...</p>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Profile Created!</h2>
        <p className="text-muted-foreground">Redirecting you to your dashboard...</p>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => setStep('review')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
        >
          Try again
        </button>
      </div>
    );
  }

  // Review step - the main form
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">Review Your Profile</h2>
        {suggestion && suggestion.confidence.overall !== 'none' && (
          <p className="mt-2 text-muted-foreground">
            We&apos;ve suggested some fields based on your Facebook data. Feel free to edit anything.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* AI Reasoning */}
      {suggestion && suggestion.reasoning && suggestion.confidence.overall !== 'none' && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-foreground text-sm">AI Analysis</p>
              <p className="text-sm text-muted-foreground mt-1">{suggestion.reasoning}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card p-6 rounded-lg border border-border space-y-6">
        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            I am a... <span className="text-destructive">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors flex-1">
              <input
                type="checkbox"
                checked={formData.roles.includes('owner')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, roles: [...prev.roles, 'owner'] }));
                  } else {
                    setFormData(prev => ({ ...prev, roles: prev.roles.filter(r => r !== 'owner') }));
                  }
                }}
                className="mr-3 w-5 h-5"
              />
              <span className="text-sm font-medium">Boat Owner/Skipper</span>
            </label>
            <label className="flex items-center min-h-[44px] cursor-pointer p-3 border border-border rounded-md hover:bg-accent transition-colors flex-1">
              <input
                type="checkbox"
                checked={formData.roles.includes('crew')}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({ ...prev, roles: [...prev.roles, 'crew'] }));
                  } else {
                    setFormData(prev => ({ ...prev, roles: prev.roles.filter(r => r !== 'crew') }));
                  }
                }}
                className="mr-3 w-5 h-5"
              />
              <span className="text-sm font-medium">Crew Member</span>
            </label>
          </div>
        </div>

        {/* Profile Image */}
        {formData.profile_image_url && (
          <div className="flex items-center gap-4">
            <img
              src={formData.profile_image_url}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
            />
            <div>
              <p className="text-sm font-medium text-foreground">Profile Picture</p>
              <p className="text-xs text-muted-foreground">From Facebook</p>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
              Username <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => handleUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className={`w-full px-3 py-3 min-h-[44px] text-base border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                usernameError ? 'border-destructive' : 'border-border'
              } bg-input-background`}
              placeholder="johndoe"
            />
            {usernameError && (
              <p className="mt-1 text-sm text-destructive">{usernameError}</p>
            )}
            {suggestion?.usernameAlternatives && suggestion.usernameAlternatives.length > 0 && !usernameError && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Alternatives:</span>
                {suggestion.usernameAlternatives.map((alt) => (
                  <button
                    key={alt}
                    type="button"
                    onClick={() => handleUsernameChange(alt)}
                    className="text-xs px-2 py-1 bg-muted rounded hover:bg-accent transition-colors"
                  >
                    {alt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3 py-3 min-h-[44px] text-base border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="John Doe"
            />
          </div>
        </div>

        {/* Sailing Experience - using common SkillLevelSelector */}
        <div>
          {suggestion?.confidence.sailingExperience && suggestion.confidence.sailingExperience !== 'none' && (
            <div className="mb-2">
              <span className={`text-xs px-2 py-0.5 rounded ${
                suggestion.confidence.sailingExperience === 'high' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                suggestion.confidence.sailingExperience === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                AI confidence: {suggestion.confidence.sailingExperience}
              </span>
            </div>
          )}
          <SkillLevelSelector
            value={formData.sailing_experience}
            onChange={(value) => setFormData(prev => ({ ...prev, sailing_experience: value }))}
          />
        </div>

        {/* User Description */}
        <div>
          <label htmlFor="user_description" className="block text-sm font-medium text-foreground mb-2">
            About You
          </label>
          <textarea
            id="user_description"
            value={formData.user_description}
            onChange={(e) => setFormData(prev => ({ ...prev, user_description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-3 text-base border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Tell us about yourself - your background, interests, and what brings you to sailing..."
          />
        </div>

        {/* Certifications */}
        <div>
          <label htmlFor="certifications" className="block text-sm font-medium text-foreground mb-2">
            Certifications
          </label>
          <input
            type="text"
            id="certifications"
            value={formData.certifications}
            onChange={(e) => setFormData(prev => ({ ...prev, certifications: e.target.value }))}
            className="w-full px-3 py-3 min-h-[44px] text-base border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g., RYA Day Skipper, ASA 101"
          />
        </div>

        {/* Risk Level - using common RiskLevelSelector */}
        <div>
          <RiskLevelSelector
            value={formData.risk_level}
            onChange={(value) => {
              const normalizedRiskLevel: RiskLevel[] =
                value === null ? [] :
                Array.isArray(value) ? value :
                [value];
              setFormData(prev => ({ ...prev, risk_level: normalizedRiskLevel }));
            }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="flex-1 px-4 py-3 border border-border rounded-md text-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveProfile}
          disabled={!formData.username || formData.roles.length === 0}
          className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Profile
        </button>
      </div>
    </div>
  );
}
