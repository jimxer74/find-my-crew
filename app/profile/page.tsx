'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { ExperienceLevel, getAllExperienceLevels } from '@/app/types/experience-levels';
import { UserConsents } from '@/app/types/consents';
import { CollapsibleSection } from '@/app/components/ui/CollapsibleSection';
import {
  PersonalInfoSection,
  SailingPreferencesSection,
  ExperienceSkillsSection,
  NotificationsConsentsSection,
} from '@/app/components/profile/sections';
import skillsConfig from '@/app/config/skills-config.json';

type SkillEntry = {
  skill_name: string;
  description: string;
};

type Profile = {
  id: string;
  role?: 'owner' | 'crew';
  roles?: string[];
  username: string | null;
  full_name: string | null;
  certifications: string | null;
  phone: string | null;
  sailing_experience: ExperienceLevel | null;
  risk_level: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[];
  skills: string[];
  sailing_preferences: string | null;
  profile_image_url: string | null;
  profile_completion_percentage?: number | null;
  created_at: string;
  updated_at: string;
};

type EmailPreferences = {
  registration_updates: boolean;
  journey_updates: boolean;
  profile_reminders: boolean;
};

function ProfilePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [showPreferencesSidebar, setShowPreferencesSidebar] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<{
    title: string;
    content: React.ReactNode;
  } | null>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Consent and email preferences state
  const [consents, setConsents] = useState<UserConsents | null>(null);
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences | null>(null);
  const [isUpdatingConsents, setIsUpdatingConsents] = useState(false);

  // Scroll to top when sidebar content changes
  useEffect(() => {
    if (showPreferencesSidebar && sidebarContent && sidebarScrollRef.current) {
      const skillLevelTitles = getAllExperienceLevels().map(level => level.displayName);
      const riskLevelTitles = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
      if (skillLevelTitles.includes(sidebarContent.title) || riskLevelTitles.includes(sidebarContent.title)) {
        const timer = setTimeout(() => {
          if (sidebarScrollRef.current) {
            sidebarScrollRef.current.scrollTop = 0;
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [showPreferencesSidebar, sidebarContent]);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    certifications: '',
    phone: '',
    sailing_experience: null as ExperienceLevel | null,
    risk_level: [] as ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[],
    skills: [] as SkillEntry[],
    sailing_preferences: '',
    profile_image_url: '',
    roles: [] as ('owner' | 'crew')[],
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Helper function to check if a field is missing
  const isFieldMissing = (fieldName: string): boolean => {
    switch (fieldName) {
      case 'username':
        return !formData.username || formData.username.trim() === '';
      case 'full_name':
        return !formData.full_name || formData.full_name.trim() === '';
      case 'phone':
        return !formData.phone || formData.phone.trim() === '';
      case 'sailing_experience':
        return formData.sailing_experience === null;
      case 'risk_level':
        return !formData.risk_level || formData.risk_level.length === 0;
      case 'skills':
        return !formData.skills || formData.skills.length === 0;
      case 'sailing_preferences':
        return !formData.sailing_preferences || formData.sailing_preferences.trim() === '';
      case 'roles':
        return !formData.roles || formData.roles.length === 0;
      default:
        return false;
    }
  };

  // Calculate profile completion percentage
  const calculateCompletionPercentage = (): number => {
    const totalFields = 8;
    let completionScore = 0;

    if (formData.username && formData.username.trim() !== '') completionScore++;
    if (formData.full_name && formData.full_name.trim() !== '') completionScore++;
    if (formData.phone && formData.phone.trim() !== '') completionScore++;
    if (formData.sailing_experience !== null) completionScore++;
    if (formData.risk_level && formData.risk_level.length > 0) completionScore++;
    if (formData.skills && formData.skills.length > 0) completionScore++;
    if (formData.sailing_preferences && formData.sailing_preferences.trim() !== '') completionScore++;
    if (formData.roles && formData.roles.length > 0) completionScore++;

    return Math.round((completionScore / totalFields) * 100);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      loadProfile();
      loadConsentsAndPreferences();
    }
  }, [user, authLoading, router]);

  const loadProfile = async () => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        setIsNewProfile(true);
        const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
        const roleFromMetadata = user.user_metadata?.role as 'owner' | 'crew' | null;
        const initialRoles: ('owner' | 'crew')[] = roleFromUrl ? [roleFromUrl] : roleFromMetadata ? [roleFromMetadata] : [];

        const fullNameFromMetadata = user.user_metadata?.full_name || '';
        const usernameFromEmail = user.email?.split('@')[0] || '';

        setFormData({
          username: usernameFromEmail,
          full_name: fullNameFromMetadata,
          certifications: '',
          phone: '',
          sailing_experience: null,
          risk_level: [],
          skills: [],
          sailing_preferences: '',
          profile_image_url: '',
          roles: initialRoles,
        });

        setProfile({
          id: user.id,
          roles: initialRoles,
          username: null,
          full_name: null,
          certifications: null,
          phone: null,
          sailing_experience: null,
          risk_level: [],
          skills: [],
          sailing_preferences: null,
          profile_image_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        console.error('Error loading profile:', fetchError);
        setError('Failed to load profile');
      }
    } else if (data) {
      setProfile(data);
      const parsedSkills: SkillEntry[] = (data.skills || []).map((skillJson: string) => {
        try {
          return JSON.parse(skillJson);
        } catch {
          return { skill_name: skillJson, description: '' };
        }
      });

      const roles: ('owner' | 'crew')[] = data.roles && data.roles.length > 0
        ? (data.roles as ('owner' | 'crew')[])
        : data.role
          ? [data.role]
          : [];

      setFormData({
        username: data.username || '',
        full_name: data.full_name || '',
        certifications: data.certifications || '',
        phone: data.phone || '',
        sailing_experience: (data.sailing_experience as ExperienceLevel | null) || null,
        risk_level: data.risk_level || [],
        skills: parsedSkills,
        sailing_preferences: data.sailing_preferences || '',
        profile_image_url: data.profile_image_url || '',
        roles: roles,
      });
    }
    setLoading(false);
  };

  const loadConsentsAndPreferences = async () => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();

    const [consentsRes, emailPrefsRes] = await Promise.all([
      supabase.from('user_consents').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('email_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    setConsents(consentsRes.data);
    setEmailPrefs(emailPrefsRes.data || {
      registration_updates: true,
      journey_updates: true,
      profile_reminders: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const supabase = getSupabaseBrowserClient();
    const roles = formData.roles || [];

    let error: any = null;

    if (isNewProfile) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          roles: roles,
          username: formData.username || null,
          full_name: formData.full_name || null,
          certifications: formData.certifications || null,
          phone: formData.phone || null,
          sailing_experience: formData.sailing_experience || null,
          risk_level: formData.risk_level || [],
          skills: formData.skills.map(skill => JSON.stringify(skill)),
          sailing_preferences: formData.sailing_preferences || null,
          profile_image_url: formData.profile_image_url || null,
        })
        .select()
        .single();

      error = insertError;
    } else {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          roles: roles,
          username: formData.username || null,
          full_name: formData.full_name || null,
          certifications: formData.certifications || null,
          phone: formData.phone || null,
          sailing_experience: formData.sailing_experience || null,
          risk_level: formData.risk_level || [],
          skills: formData.skills.map(skill => JSON.stringify(skill)),
          sailing_preferences: formData.sailing_preferences || null,
          profile_image_url: formData.profile_image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      error = updateError;
    }

    if (error) {
      setError(error.message || 'Failed to save profile');
      setSaving(false);
    } else {
      setSuccess(true);
      setIsNewProfile(false);

      const calculatedCompletion = calculateCompletionPercentage();

      if (profile) {
        setProfile({
          ...profile,
          profile_completion_percentage: calculatedCompletion,
          username: formData.username || null,
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          sailing_experience: formData.sailing_experience,
          risk_level: formData.risk_level,
          skills: formData.skills.map(skill => JSON.stringify(skill)),
          sailing_preferences: formData.sailing_preferences || null,
          roles: formData.roles,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      await loadProfile();

      setTimeout(() => setSuccess(false), 3000);
      setSaving(false);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      }

      router.refresh();

      if (isNewProfile) {
        setTimeout(() => {
          if (roles.includes('owner')) {
            router.push('/owner/boats');
          } else if (roles.includes('crew')) {
            router.push('/crew/dashboard');
          } else {
            router.push('/');
          }
        }, 1500);
      }
    }
  };

  // Handle consent toggle
  const handleConsentToggle = async (consentType: 'ai_processing' | 'profile_sharing' | 'marketing') => {
    setIsUpdatingConsents(true);
    setError(null);

    const currentValue = consents?.[`${consentType}_consent` as keyof UserConsents] as boolean ?? false;
    const newValue = !currentValue;

    try {
      const response = await fetch('/api/user/consents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent_type: consentType,
          value: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      const data = await response.json();
      setConsents(data.consents);
    } catch (err) {
      setError('Failed to update consent. Please try again.');
    } finally {
      setIsUpdatingConsents(false);
    }
  };

  // Handle email preference toggle
  const handleEmailPrefToggle = async (prefType: 'registration_updates' | 'journey_updates' | 'profile_reminders') => {
    if (!emailPrefs) return;

    setIsUpdatingConsents(true);
    setError(null);

    const newValue = !emailPrefs[prefType];

    try {
      const response = await fetch('/api/user/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [prefType]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update email preference');
      }

      const data = await response.json();
      setEmailPrefs(data.preferences);
    } catch (err) {
      setError('Failed to update email preference. Please try again.');
    } finally {
      setIsUpdatingConsents(false);
    }
  };

  // Handle profile image upload
  const handleImageUpload = async (file: File | null) => {
    if (!file || !user) return;

    setUploadingImage(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    try {
      if (!file.type.startsWith('image/')) {
        setError('Please upload only image files');
        setUploadingImage(false);
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        setUploadingImage(false);
        return;
      }

      if (formData.profile_image_url) {
        try {
          const urlParts = formData.profile_image_url.split('/profile-images/');
          if (urlParts.length > 1) {
            const oldImagePath = urlParts[1];
            await supabase.storage
              .from('profile-images')
              .remove([oldImagePath]);
          }
        } catch (deleteError) {
          console.warn('Failed to delete old image:', deleteError);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(`Failed to upload image: ${uploadError.message}`);
        setUploadingImage(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(uploadData.path);

      setFormData((prev) => ({
        ...prev,
        profile_image_url: publicUrl,
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove profile image
  const removeProfileImage = async () => {
    if (!formData.profile_image_url || !user) return;

    const supabase = getSupabaseBrowserClient();

    try {
      const urlParts = formData.profile_image_url.split('/profile-images/');
      if (urlParts.length > 1) {
        const imagePath = urlParts[1];

        const { error: deleteError } = await supabase.storage
          .from('profile-images')
          .remove([imagePath]);

        if (deleteError) {
          console.error('Failed to delete image:', deleteError);
          setError('Failed to delete image');
        } else {
          setFormData((prev) => ({
            ...prev,
            profile_image_url: '',
          }));
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          profile_image_url: '',
        }));
      }
    } catch (err: any) {
      console.error('Error removing image:', err);
      setError('Failed to remove image');
    }
  };

  // Add skill to form
  const addSkillToForm = (skill: { name: string; infoText: string; startingSentence: string }) => {
    setFormData((prev) => {
      const skillExists = prev.skills.some(s => s.skill_name === skill.name);
      if (skillExists) {
        return prev;
      }

      const newSkill: SkillEntry = {
        skill_name: skill.name,
        description: '',
      };

      return {
        ...prev,
        skills: [...prev.skills, newSkill],
      };
    });
  };

  // Helper function to render a skill bullet point
  const renderSkillItem = (skill: { name: string; infoText: string; startingSentence: string }) => {
    const isAdded = formData.skills.some(s => s.skill_name === skill.name);

    return (
      <li key={skill.name} className="relative group">
        <div className="flex items-start">
          <span className="mr-2 text-primary">•</span>
          <span className="flex-1 group-hover:opacity-70 transition-opacity">{skill.infoText}</span>
        </div>
        {!isAdded && (
          <button
            type="button"
            onClick={() => addSkillToForm(skill)}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
            title="Add skill to profile"
          >
            <div className="bg-white text-gray-900 rounded-full p-2 shadow-lg border border-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>
        )}
        {isAdded && (
          <button
            type="button"
            onClick={() => {
              const skillTextareaId = `skill-${skill.name}`;
              const textarea = document.getElementById(skillTextareaId) as HTMLTextAreaElement;
              if (textarea) {
                textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  textarea.focus();
                }, 300);
              }
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
            title="Edit skill description"
          >
            <div className="bg-white text-gray-900 rounded-full p-2 shadow-lg border border-black">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
          </button>
        )}
      </li>
    );
  };

  // Show skills sidebar
  const showSkillsSidebar = () => {
    const isOwner = formData.roles.includes('owner');
    const hasOffshoreSailing = isOwner || formData.risk_level.includes('Offshore sailing');
    const hasExtremeSailing = isOwner || formData.risk_level.includes('Extreme sailing');

    setSidebarContent({
      title: 'Skills',
      content: (
        <>
          <p className="font-medium mb-3">Click the "+" button to add skills to your profile:</p>
          <ul className="space-y-3 list-none">
            {skillsConfig.general.map(skill => renderSkillItem(skill))}
            {hasOffshoreSailing && skillsConfig.offshore.map(skill => renderSkillItem(skill))}
            {hasExtremeSailing && skillsConfig.extreme.map(skill => renderSkillItem(skill))}
          </ul>
        </>
      ),
    });
    setShowPreferencesSidebar(true);
  };

  const completionPercentage = profile?.profile_completion_percentage ?? calculateCompletionPercentage();
  const displayName = formData.full_name || formData.username || 'Your';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Backdrop for mobile sidebar */}
      {showPreferencesSidebar && sidebarContent && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowPreferencesSidebar(false)}
        />
      )}

      {/* Sidebar */}
      {sidebarContent && showPreferencesSidebar && (
        <div
          className="fixed top-0 left-0 w-full md:w-80 h-full bg-card border-r border-border z-50 md:z-30 overflow-hidden"
        >
          <div
            ref={sidebarScrollRef}
            className="h-full overflow-y-auto p-4 sm:p-6 pt-20"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
            }}
          >
            <button
              onClick={() => setShowPreferencesSidebar(false)}
              className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card border border-border rounded-md shadow-sm hover:bg-accent transition-all"
              aria-label="Close panel"
            >
              <svg
                className="w-6 h-6 text-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {sidebarContent.title !== 'Coastal sailing' &&
             sidebarContent.title !== 'Offshore sailing' &&
             sidebarContent.title !== 'Extreme sailing' && (
              <div className="mb-4">
                <h3 className="text-lg font-bold text-card-foreground">
                  {sidebarContent.title}
                </h3>
              </div>
            )}

            <div className="space-y-3 text-sm text-foreground">
              {sidebarContent.content}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-foreground">
              {isNewProfile ? 'Complete Your Profile' : 'Profile'}
            </h1>
            <Link
              href={formData.roles.includes('owner') ? '/owner/boats' : formData.roles.includes('crew') ? '/crew/dashboard' : '/'}
              className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Completion - only if < 100% */}
      {completionPercentage < 100 && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Profile Completion</span>
              <span>{completionPercentage}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 ${showPreferencesSidebar ? 'md:ml-80' : ''}`}>
        {error && (
          <div className="mb-6 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500 text-green-700 px-4 py-3 rounded">
            {isNewProfile ? 'Profile created successfully! Redirecting to dashboard...' : 'Profile updated successfully!'}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Personal Information */}
          <CollapsibleSection
            title={`Personal Information`}
            defaultOpen={true}
          >
            <PersonalInfoSection
              formData={formData}
              setFormData={setFormData}
              userEmail={user?.email}
              uploadingImage={uploadingImage}
              handleImageUpload={handleImageUpload}
              removeProfileImage={removeProfileImage}
              isFieldMissing={isFieldMissing}
            />
          </CollapsibleSection>

          {/* Section 2: Sailing Preferences - CREW ROLE ONLY */}
          {formData.roles.includes('crew') && (
            <CollapsibleSection
              title="Sailing Preferences"
              defaultOpen={true}
            >
              <SailingPreferencesSection
                formData={formData}
                setFormData={setFormData}
                isFieldMissing={isFieldMissing}
                onInfoClick={(title, content) => {
                  setSidebarContent({ title, content });
                  setShowPreferencesSidebar(true);
                  setTimeout(() => {
                    if (sidebarScrollRef.current) {
                      sidebarScrollRef.current.scrollTop = 0;
                    }
                  }, 100);
                }}
                onClose={() => {
                  setShowPreferencesSidebar(false);
                  setSidebarContent(null);
                }}
              />
            </CollapsibleSection>
          )}

          {/* Section 3: Experience and Skills */}
          <CollapsibleSection
            title="Sailing Experience and Skills"
            defaultOpen={true}
          >
            <ExperienceSkillsSection
              formData={formData}
              setFormData={setFormData}
              isFieldMissing={isFieldMissing}
              onInfoClick={(title, content) => {
                setSidebarContent({ title, content });
                setShowPreferencesSidebar(true);
                setTimeout(() => {
                  if (sidebarScrollRef.current) {
                    sidebarScrollRef.current.scrollTop = 0;
                  }
                }, 100);
              }}
              onShowSkillsSidebar={showSkillsSidebar}
            />
          </CollapsibleSection>

          {/* Section 4: Notifications and Consents */}
          <CollapsibleSection
            title="Notifications and Consents"
            defaultOpen={false}
          >
            <NotificationsConsentsSection
              consents={consents}
              emailPrefs={emailPrefs}
              isUpdating={isUpdatingConsents}
              onConsentToggle={handleConsentToggle}
              onEmailPrefToggle={handleEmailPrefToggle}
            />
          </CollapsibleSection>

          {/* Save/Cancel buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 mt-6 border-t border-border">
            <Link
              href={formData.roles.includes('owner') ? '/owner/boats' : formData.roles.includes('crew') ? '/crew/dashboard' : '/'}
              className="px-4 py-3 min-h-[44px] flex items-center justify-center border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ProfilePageContent />
    </Suspense>
  );
}
