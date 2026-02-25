'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { ExperienceLevel, getAllExperienceLevels } from '@shared/types/experience-levels';
import { UserConsents } from '@shared/types/consents';
import { CollapsibleSection } from '@shared/ui/CollapsibleSection';
import {
  PersonalInfoSection,
  SailingPreferencesSection,
  ExperienceSkillsSection,
  NotificationsConsentsSection,
} from '@/app/components/profile/sections';
import skillsConfig from '@/app/config/skills-config.json';
import {
  calculateProfileCompletion,
  isProfileFieldMissing,
  type ProfileDataForCompletion,
} from '@/app/lib/profile/completionCalculator';
import { type Location } from '@shared/ui/LocationAutocomplete';

type SkillEntry = {
  skill_name: string;
  description: string;
};

type Profile = {
  id: string;
  roles: string[];
  username: string | null;
  full_name: string | null;
  user_description: string | null;
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
  // Add CSS-in-JS styles for AI-focused fields
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .ai-focused-field {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
        background-color:#3b82f620;
        border-color: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        animation: pulse 2s infinite;
      }

      .ai-focused-section {
        outline: 3px solid #3b82f6;
        outline-offset: 2px;
        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.2);
        animation: pulse 4s infinite;
      }

      .ai-highlighted-section h2 {
        animation: highlightPulse 3s ease-in-out;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
        70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
        100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
      }

      @keyframes highlightPulse {
        0% { transform: scaleX(1); }
        50% { transform: scaleX(1.05); }
        100% { transform: scaleX(1); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
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

  // AI assistant redirect support - new state
  const [aiTargetSection, setAiTargetSection] = useState<string | null>(null);
  const [aiTargetField, setAiTargetField] = useState<string | null>(null);
  const [aiActionId, setAiActionId] = useState<string | null>(null);
  const [aiFocusedField, setAiFocusedField] = useState<string | null>(null);
  const [aiTargetSkills, setAiTargetSkills] = useState<string[] | null>(null);

  // Section control state for AI redirect
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({
    personal: false,
    preferences: false,
    experience: false,
    notifications: false,
  });

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
    user_description: '',
    certifications: '',
    phone: '',
    email: user?.email || '',
    sailing_experience: null as ExperienceLevel | null,
    risk_level: [] as ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[],
    skills: [] as SkillEntry[],
    sailing_preferences: '',
    profile_image_url: '',
    roles: [] as ('owner' | 'crew')[],
    preferred_departure_location: null as Location | null,
    preferred_arrival_location: null as Location | null,
    availability_start_date: '' as string,
    availability_end_date: '' as string,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Helper: build the minimal shape the shared calculator expects
  const getCompletionData = (): ProfileDataForCompletion => ({
    username: formData.username || null,
    full_name: formData.full_name || null,
    phone: formData.phone || null,
    sailing_experience: formData.sailing_experience,
    risk_level: formData.risk_level,
    skills: formData.skills,
    sailing_preferences: formData.sailing_preferences || null,
    roles: formData.roles,
  });

  // Helper function to check if a field is missing (delegates to shared utility)
  const isFieldMissing = (fieldName: string): boolean => {
    return isProfileFieldMissing(fieldName, getCompletionData());
  };

  // Calculate profile completion percentage (delegates to shared utility)
  const calculateCompletionPercentage = (): number => {
    return calculateProfileCompletion(getCompletionData()).percentage;
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

  // Handle AI assistant redirect query parameters
  useEffect(() => {
    if (searchParams && user) {
      const section = searchParams.get('section');
      const field = searchParams.get('field');
      const aiActionIdParam = searchParams.get('aiActionId');
      const targetSkillsParam = searchParams.get('targetSkills');

      logger.debug(' 📊 Processing parameters:', {
        section,
        field,
        aiActionIdParam,
        targetSkillsParam,
        hasTargetSkills: !!targetSkillsParam
      });

      if (section && field) {
        setAiTargetSection(section);
        setAiTargetField(field);
        setAiActionId(aiActionIdParam);

        let showSimpleFocus = true;

        // Process targetSkills parameter
        if (targetSkillsParam) {
          try {
            const parsedSkills = JSON.parse(decodeURIComponent(targetSkillsParam));
            logger.debug('Parsed targetSkills', { count: parsedSkills.length }, true);

            if (Array.isArray(parsedSkills) && parsedSkills.length > 0) {
              // Validate skills against config
              const validSkills = parsedSkills.filter((skill: any) =>
                typeof skill === 'string' &&
                skillsConfig.general.some(configSkill => configSkill.name === skill)
              );
              logger.debug('Valid skills', { count: validSkills.length }, true);

              if (validSkills.length > 0) {                
                setAiTargetSkills(validSkills);                
                showSimpleFocus = false;
                // Auto-expand the target section
                setSectionStates(prev => ({
                  ...prev,
                  [section]: true
                }));

                validSkills.forEach(skill => {
                  setTimeout(() => {
                    logger.debug('Skill field focus', { skill }, true);
                      focusTargetField(skill);
                    }, 2000);
                  });

              }
            }
          } catch (error) {
            logger.warn('Invalid targetSkills parameter', { message: error instanceof Error ? error.message : String(error) });
          }
        }

        // Show simple focus on the target field
        if(showSimpleFocus) {
        // Auto-expand the target section
          setSectionStates(prev => ({
            ...prev,
            [section]: true
          }));

          // Focus the target field
          logger.debug('Scheduling field focus', { field }, true);

          setTimeout(() => {
            logger.debug('Executing field focus', { field }, true);
              focusTargetField(field);
            }, 600);
          }

        // Clean up URL parameters after processing (delayed to ensure highlighting works)
        /*
        setTimeout(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('section');
          url.searchParams.delete('field');
          url.searchParams.delete('aiActionId');
          url.searchParams.delete('targetSkills');
          logger.debug(' 📊 Cleaning up URL parameters');
          router.replace(url.toString());
        }, 600); // Increased delay to 500ms to ensure highlighting has time to work
        */
      }
    }
  }, [searchParams, user]);

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
          user_description: '',
          certifications: '',
          phone: '',
          email: user.email || '',
          sailing_experience: null,
          risk_level: [],
          skills: [],
          sailing_preferences: '',
          profile_image_url: '',
          roles: initialRoles,
          preferred_departure_location: null,
          preferred_arrival_location: null,
          availability_start_date: '',
          availability_end_date: '',
        });

        setProfile({
          id: user.id,
          roles: initialRoles,
          username: null,
          full_name: null,
          user_description: null,
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
        logger.error('Error loading profile', { error: fetchError?.message || String(fetchError) });
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
        : [];

      setFormData({
        username: data.username || '',
        full_name: data.full_name || '',
        user_description: data.user_description || '',
        certifications: data.certifications || '',
        phone: data.phone || '',
        email: user?.email || '',
        sailing_experience: (data.sailing_experience as ExperienceLevel | null) || null,
        risk_level: data.risk_level || [],
        skills: parsedSkills,
        sailing_preferences: data.sailing_preferences || '',
        profile_image_url: data.profile_image_url || '',
        roles: roles,
        preferred_departure_location: (data.preferred_departure_location as Location | null) || null,
        preferred_arrival_location: (data.preferred_arrival_location as Location | null) || null,
        availability_start_date: data.availability_start_date || '',
        availability_end_date: data.availability_end_date || '',
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
          user_description: formData.user_description || null,
          certifications: formData.certifications || null,
          phone: formData.phone || null,
          email: formData.email || null,
          sailing_experience: formData.sailing_experience || null,
          risk_level: formData.risk_level || [],
          skills: formData.skills.map(skill => JSON.stringify(skill)),
          sailing_preferences: formData.sailing_preferences || null,
          profile_image_url: formData.profile_image_url || null,
          preferred_departure_location: formData.preferred_departure_location || null,
          preferred_arrival_location: formData.preferred_arrival_location || null,
          availability_start_date: formData.availability_start_date || null,
          availability_end_date: formData.availability_end_date || null,
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
          user_description: formData.user_description || null,
          certifications: formData.certifications || null,
          phone: formData.phone || null,
          email: formData.email || null,
          sailing_experience: formData.sailing_experience || null,
          risk_level: formData.risk_level || [],
          skills: formData.skills.map(skill => JSON.stringify(skill)),
          sailing_preferences: formData.sailing_preferences || null,
          profile_image_url: formData.profile_image_url || null,
          preferred_departure_location: formData.preferred_departure_location || null,
          preferred_arrival_location: formData.preferred_arrival_location || null,
          availability_start_date: formData.availability_start_date || null,
          availability_end_date: formData.availability_end_date || null,
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

      // Dispatch event to notify other components (like NavigationMenu) that profile was updated
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      }

      const calculatedCompletion = calculateCompletionPercentage();

      if (profile) {
        setProfile({
          ...profile,
          profile_completion_percentage: calculatedCompletion,
          username: formData.username || null,
          full_name: formData.full_name || null,
          user_description: formData.user_description || null,
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

      router.refresh();

      // Dispatch profile updated event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: {
            updatedFields: Object.keys(formData).filter(key =>
              formData[key as keyof typeof formData] !== undefined &&
              formData[key as keyof typeof formData] !== null
            ),
            timestamp: Date.now()
          }
        }));
      }

      if (isNewProfile) {
        setTimeout(() => {
          if (roles.includes('owner')) {
            router.push('/owner/boats');
          } else if (roles.includes('crew')) {
            router.push('/crew');
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

  // Handle AI-focused field highlighting
  const focusTargetField = (fieldId: string) => {
    logger.debug('Called with fieldId', { fieldId }, true);

    // Map profile field names to actual HTML element IDs
    const fieldIdMap: Record<string, string> = {
      'user_description': 'user_description',
      'certifications': 'certifications',
      'risk_level': 'risk_level', // This might be a checkbox group
      'sailing_preferences': 'sailing_preferences',
      'skills': 'skills', // This might be a list of skill inputs
      'full_name': 'full_name',
      'username': 'username',
      'phone': 'phone',
      'sailing_experience': 'sailing_experience'
    };

    const actualFieldId = fieldIdMap[fieldId] || fieldId;
    logger.debug('Mapped fieldId', { fieldId, actualFieldId }, true);

    let element = document.getElementById(actualFieldId);
    logger.debug('Found element by ID', { hasElement: !!element }, true);

    // For skills, try to find the first skill input or the "Add Skills" button
    if (fieldId === 'skills') {
      element = document.getElementById('skill-add-button') || document.querySelector('[id^="skill-"]') as HTMLElement;
      logger.debug('Skills element found', { hasElement: !!element }, true);
    }

    // For risk level, find the first risk level button
    if (fieldId === 'risk_level') {
      element = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.textContent?.includes('Coastal sailing') ||
        btn.textContent?.includes('Offshore sailing') ||
        btn.textContent?.includes('Extreme sailing')
      ) as HTMLElement;

      // Fallback: find by label
      if (!element) {
        const label = document.querySelector('label') as HTMLElement;
        if (label && label.textContent?.includes('Risk Level')) {
          element = label.nextElementSibling as HTMLElement || label.parentElement?.querySelector('button') as HTMLElement;
        }
      }
      logger.debug('Risk level element found', { hasElement: !!element }, true);
    }

    if (element) {
      logger.debug('Element found, applying highlight', {}, true);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (element.focus) element.focus();
      setAiFocusedField(actualFieldId);

      // Add highlight class to the element
      element.classList.add('ai-focused-field');

      // Also highlight the parent section/card if it exists
      let parentSection = element.closest('.bg-card.rounded-lg.shadow');
      if (!parentSection) {
        parentSection = element.closest('.space-y-6') || element.closest('form');
      }
      if (parentSection) {
        parentSection.classList.add('ai-focused-section');
      }

      // Remove highlights after 5 seconds
      setTimeout(() => {
        element.classList.remove('ai-focused-field');
        if (parentSection) {
          parentSection.classList.remove('ai-focused-section');
        }
        setAiFocusedField(null);
      }, 5000);
    } else {
      logger.debug('Element not found, trying alternative selectors', {}, true);
      // Try to find the field by name or other selectors
      const elements = document.querySelectorAll(`[name="${fieldId}"], [data-field="${fieldId}"], [id*="${fieldId}"]`);
      logger.debug('Alternative elements found', { count: elements.length }, true);

      if (elements.length > 0) {
        const firstElement = elements[0] as HTMLElement;
        logger.debug('Using alternative element', { hasElement: !!firstElement }, true);
        firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (firstElement.focus) firstElement.focus();
        setAiFocusedField(fieldId);

        // Add highlight class
        firstElement.classList.add('ai-focused-field');

        // Also highlight the parent section/card
        let parentSection = firstElement.closest('.bg-card.rounded-lg.shadow');
        if (!parentSection) {
          parentSection = firstElement.closest('.space-y-6') || firstElement.closest('form');
        }
        if (parentSection) {
          parentSection.classList.add('ai-focused-section');
        }

        // Remove highlights after 5 seconds
        setTimeout(() => {
          firstElement.classList.remove('ai-focused-field');
          if (parentSection) {
            parentSection.classList.remove('ai-focused-section');
          }
          setAiFocusedField(null);
        }, 5000);
      } else {
        logger.warn('No element found for field', { fieldId });
      }
    }

    // Open the section that contains this field
    if (fieldId === 'username' || fieldId === 'full_name' || fieldId === 'user_description' || fieldId === 'certifications' || fieldId === 'phone') {
      setSectionStates(prev => ({ ...prev, personal: true }));
    } else if (fieldId === 'sailing_preferences' || fieldId === 'risk_level') {
      setSectionStates(prev => ({ ...prev, preferences: true }));
    } else if (fieldId === 'sailing_experience' || fieldId === 'skills') {
      setSectionStates(prev => ({ ...prev, experience: true }));
    } else if (fieldId === 'email' || fieldId === 'registration_updates' || fieldId === 'journey_updates' || fieldId === 'profile_reminders') {
      setSectionStates(prev => ({ ...prev, notifications: true }));
    }
  };

  // Clear AI target skills after processing
  useEffect(() => {
    if (aiTargetSkills) {
      // Clear the target skills after they've been processed by the component
      const timer = setTimeout(() => {
        setAiTargetSkills(null);
      }, 1000); // Wait 1 second to allow component to process
      return () => clearTimeout(timer);
    }
  }, [aiTargetSkills]);

  // Handle profile image upload
  const handleImageUpload = async (file: File | null): Promise<void> => {
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
          logger.warn('Failed to delete old image', { error: String(deleteError) });
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
        logger.error('Upload error', { message: uploadError?.message || String(uploadError) });
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
          logger.error('Failed to delete image', { message: deleteError?.message || String(deleteError) });
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
      logger.error('Error removing image', { message: err?.message || String(err) });
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

    const handleAddSkill = () => {
      addSkillToForm(skill);
      // Close sidebar on mobile after adding a skill
      if (window.innerWidth < 768) {
        setShowPreferencesSidebar(false);
      }
    };

    const handleEditSkill = () => {
      // Close sidebar on mobile first
      if (window.innerWidth < 768) {
        setShowPreferencesSidebar(false);
      }
      const skillTextareaId = `skill-${skill.name}`;
      const textarea = document.getElementById(skillTextareaId) as HTMLTextAreaElement;
      if (textarea) {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          textarea.focus();
        }, 300);
      }
    };

    return (
      <li key={skill.name} className="relative group flex items-start gap-3">
        <div className="flex-1 flex items-start">
          <span className="mr-2 text-primary">•</span>
          <span className="flex-1 md:group-hover:opacity-70 transition-opacity">{skill.infoText}</span>
        </div>
        {/* Button - always visible on mobile, hover on desktop */}
        {!isAdded ? (
          <button
            type="button"
            onClick={handleAddSkill}
            className="flex-shrink-0 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity rounded"
            title="Add skill to profile"
          >
            <div className="bg-white text-gray-900 rounded-full p-2 shadow-lg border border-primary">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEditSkill}
            className="flex-shrink-0 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity rounded"
            title="Edit skill description"
          >
            <div className="bg-green-100 text-green-700 rounded-full p-2 shadow-lg border border-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
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

      {/* Backdrop for mobile sidebar */}
      {showPreferencesSidebar && sidebarContent && (
        <div
          className="fixed inset-0 top-[4rem] bg-black/50 z-40 md:hidden"
          onClick={() => setShowPreferencesSidebar(false)}
        />
      )}

      {/* Sidebar - positioned below header */}
      {sidebarContent && showPreferencesSidebar && (
        <div
          className="fixed top-[4rem] left-0 w-full md:w-80 h-[calc(100vh-4rem)] bg-card border-r border-border z-50 md:z-30 overflow-hidden"
        >
          <div
            ref={sidebarScrollRef}
            className="h-full overflow-y-auto p-4 sm:p-6"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
            }}
          >
            <button
              onClick={() => setShowPreferencesSidebar(false)}
              className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-card border border-border rounded-md shadow-sm hover:bg-accent transition-all z-10"
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
              <div className="mb-4 pr-12">
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
              {isNewProfile ? t('completeYourProfile') : t('profile')}
            </h1>
            <Link
              href={formData.roles.includes('owner') ? '/owner/boats' : formData.roles.includes('crew') ? '/crew' : '/'}
              className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {tCommon('cancel')}
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Completion - only if < 100% */}
      {completionPercentage < 100 && (
        <div className="border-b border-border bg-muted/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{t('profileCompletion')}</span>
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

      {/* AI Assistant Redirect Banner */}
      {aiTargetSection && aiTargetField && (
        <div className="border-b border-border bg-blue-500/10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 text-white rounded-full p-2">
              <svg
        className="w-5 h-5 text-foreground"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="white"
      >
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />  
      </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground">AI Assistant Suggestion</h3>
                <p className="text-sm text-muted-foreground">
                  Update your {aiTargetField.replace('_', ' ')} in the {aiTargetSection} section to improve your profile.
                </p>
              </div>
              <button
                onClick={() => {
                  setAiTargetSection(null);
                  setAiTargetField(null);
                  setAiActionId(null);
                  setAiFocusedField(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
            {isNewProfile ? t('profileCreatedSuccess') : t('profileUpdatedSuccess')}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Personal Information */}
          <CollapsibleSection
            title={t('sections.personal')}
            defaultOpen={false}
            isOpen={sectionStates.personal}
            onOpenChange={(isOpen) => setSectionStates(prev => ({ ...prev, personal: isOpen }))}
            highlighted={aiTargetSection === 'personal'}
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
              title={t('sections.preferences')}
              defaultOpen={false}
              isOpen={sectionStates.preferences}
              onOpenChange={(isOpen) => setSectionStates(prev => ({ ...prev, preferences: isOpen }))}
              highlighted={aiTargetSection === 'preferences'}
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
            title={t('sections.sailingExperience')}
            defaultOpen={false}
            isOpen={sectionStates.experience}
            onOpenChange={(isOpen) => setSectionStates(prev => ({ ...prev, experience: isOpen }))}
            highlighted={aiTargetSection === 'experience'}
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
              aiTargetSkills={aiTargetSkills}
            />
          </CollapsibleSection>

          {/* Section 4: Notifications and Consents */}
          <CollapsibleSection
            title={t('sections.notifications')}
            defaultOpen={false}
            isOpen={sectionStates.notifications}
            onOpenChange={(isOpen) => setSectionStates(prev => ({ ...prev, notifications: isOpen }))}
            highlighted={aiTargetSection === 'notifications'}
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
              href={formData.roles.includes('owner') ? '/owner/boats' : formData.roles.includes('crew') ? '/crew' : '/'}
              className="px-4 py-3 min-h-[44px] flex items-center justify-center border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {tCommon('cancel')}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-3 min-h-[44px] bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProfilePageFallback() {
  return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfilePageContent />
    </Suspense>
  );
}
