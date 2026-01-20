'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';
import skillsConfig from '@/app/config/skills-config.json';
import { ExperienceLevel, getAllExperienceLevels } from '@/app/types/experience-levels';

type SkillEntry = {
  skill_name: string;
  description: string;
};

type Profile = {
  id: string;
  role: 'owner' | 'crew';
  username: string | null;
  full_name: string | null;
  certifications: string | null;
  phone: string | null;
  sailing_experience: ExperienceLevel | null;
  risk_level: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[];
  skills: string[]; // Array of JSON strings: ['{"skill_name": "first_aid", "description": "..."}', ...]
  sailing_preferences: string | null;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export default function ProfilePage() {
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

  // Scroll to top when sidebar content changes (for Skill Level and Risk Level selections)
  useEffect(() => {
    if (showPreferencesSidebar && sidebarContent && sidebarScrollRef.current) {
      // Scroll for Skill Level and Risk Level selections
      // Get experience level display names dynamically from config to ensure consistency
      const skillLevelTitles = getAllExperienceLevels().map(level => level.displayName);
      const riskLevelTitles = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
      if (skillLevelTitles.includes(sidebarContent.title) || riskLevelTitles.includes(sidebarContent.title)) {
        // Small delay to ensure sidebar is fully rendered
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
    skills: [] as SkillEntry[], // Array of skill objects with skill_name and description
    sailing_preferences: '',
    profile_image_url: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      loadProfile();
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
      // Profile doesn't exist - this is a new signup
      if (fetchError.code === 'PGRST116') {
        setIsNewProfile(true);
        // Get role from URL query params or user metadata
        const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
        const roleFromMetadata = user.user_metadata?.role as 'owner' | 'crew' | null;
        const role = roleFromUrl || roleFromMetadata || 'crew';
        
        // Pre-fill form with data from signup if available
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
        });

        // Create a temporary profile object for display
        setProfile({
          id: user.id,
          role: role,
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
      // Parse skills from JSON strings to SkillEntry objects
      const parsedSkills: SkillEntry[] = (data.skills || []).map((skillJson: string) => {
        try {
          return JSON.parse(skillJson);
        } catch {
          // Fallback: if it's not valid JSON, treat as old format (just skill name)
          return { skill_name: skillJson, description: '' };
        }
      });

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
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const supabase = getSupabaseBrowserClient();

    // Get role from existing profile, URL params, or user metadata
    const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
    const roleFromMetadata = user.user_metadata?.role as 'owner' | 'crew' | null;
    const role = profile.role || roleFromUrl || roleFromMetadata || 'crew';

    let error: any = null;

    if (isNewProfile) {
      // Create new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            role: role,
            username: formData.username || null,
            full_name: formData.full_name || null,
            certifications: formData.certifications || null,
            phone: formData.phone || null,
            sailing_experience: formData.sailing_experience || null,
            risk_level: formData.risk_level || [],
            skills: formData.skills.map(skill => JSON.stringify(skill)), // Convert SkillEntry objects to JSON strings
            sailing_preferences: formData.sailing_preferences || null,
            profile_image_url: formData.profile_image_url || null,
          });

      error = insertError;
    } else {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('profiles')
          .update({
            username: formData.username || null,
            full_name: formData.full_name || null,
            certifications: formData.certifications || null,
            phone: formData.phone || null,
            sailing_experience: formData.sailing_experience || null,
            risk_level: formData.risk_level || [],
            skills: formData.skills.map(skill => JSON.stringify(skill)), // Convert SkillEntry objects to JSON strings
            sailing_preferences: formData.sailing_preferences || null,
            profile_image_url: formData.profile_image_url || null,
            updated_at: new Date().toISOString(),
          })
        .eq('id', user.id);

      error = updateError;
    }

    if (error) {
      setError(error.message || 'Failed to save profile');
    } else {
      setSuccess(true);
      setIsNewProfile(false);
      // Reload profile to get updated data
      await loadProfile();
      setTimeout(() => setSuccess(false), 3000);
      
      // If this was a new profile, redirect to dashboard after a moment
      if (isNewProfile) {
        setTimeout(() => {
          router.push(role === 'owner' ? '/owner/boats' : '/crew/dashboard');
        }, 1500);
      }
    }

    setSaving(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const appendToSailingPreferences = (text: string) => {
    setFormData((prev) => {
      const currentValue = prev.sailing_preferences || '';
      const separator = currentValue.trim() && !currentValue.endsWith('\n') ? '\n\n' : '';
      const newValue = currentValue + separator + text;
      
      // Focus the textarea and set cursor position after state update
      setTimeout(() => {
        const textarea = document.getElementById('sailing_preferences') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          // Move cursor to end of appended text
          textarea.setSelectionRange(newValue.length, newValue.length);
        }
      }, 0);
      
      return {
        ...prev,
        sailing_preferences: newValue,
      };
    });
  };

  // Add skill to form when user clicks "+" button
  const addSkillToForm = (skill: { name: string; infoText: string; startingSentence: string }) => {
    setFormData((prev) => {
      // Check if skill already exists
      const skillExists = prev.skills.some(s => s.skill_name === skill.name);
      if (skillExists) {
        return prev; // Don't add duplicate
      }
      
      // Add new skill with empty description
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

  // Remove skill from form
  const removeSkill = (skillName: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter(s => s.skill_name !== skillName),
    }));
  };

  // Handle profile image upload
  const handleImageUpload = async (file: File | null) => {
    if (!file || !user) return;

    setUploadingImage(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload only image files');
        setUploadingImage(false);
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        setUploadingImage(false);
        return;
      }

      // Delete old image if exists
      if (formData.profile_image_url) {
        try {
          // Extract path from URL (format: https://...supabase.co/storage/v1/object/public/profile-images/userId/filename)
          const urlParts = formData.profile_image_url.split('/profile-images/');
          if (urlParts.length > 1) {
            const oldImagePath = urlParts[1];
            await supabase.storage
              .from('profile-images')
              .remove([oldImagePath]);
          }
        } catch (deleteError) {
          console.warn('Failed to delete old image:', deleteError);
          // Continue with upload even if deletion fails
        }
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
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

      // Get public URL
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
      // Extract path from URL (format: https://...supabase.co/storage/v1/object/public/profile-images/userId/filename)
      const urlParts = formData.profile_image_url.split('/profile-images/');
      if (urlParts.length > 1) {
        const imagePath = urlParts[1];
        
        // Delete from storage
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
        // If path extraction fails, just clear the URL
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

  // Update skill description
  const updateSkillDescription = (skillName: string, description: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.map(s => 
        s.skill_name === skillName ? { ...s, description } : s
      ),
    }));
  };

  // Reusable styles for bullet point items with add button
  const bulletPointTextClass = "flex-1 group-hover:opacity-70 transition-opacity";
  const addButtonClass = "bg-white text-gray-900 rounded-full p-2 shadow-lg border border-black";
  const addButtonIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  );
  const editButtonIcon = (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );

  // Helper function to render a skill bullet point with "+" button to add to form
  const renderSkillItem = (skill: { name: string; infoText: string; startingSentence: string }) => {
    const isAdded = formData.skills.some(s => s.skill_name === skill.name);
    
    return (
      <li key={skill.name} className="relative group">
        <div className="flex items-start">
          <span className="mr-2 text-primary">•</span>
          <span className={bulletPointTextClass}>{skill.infoText}</span>
        </div>
        {!isAdded && (
          <button
            type="button"
            onClick={() => addSkillToForm(skill)}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
            title="Add skill to profile"
          >
            <div className={addButtonClass}>
              {addButtonIcon}
            </div>
          </button>
        )}
        {isAdded && (
          <button
            type="button"
            onClick={() => {
              // Scroll to and focus the skill's textarea
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
            <div className={addButtonClass}>
              {editButtonIcon}
            </div>
          </button>
        )}
      </li>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header />

      <main className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Sidebar - Info Panel */}
        {sidebarContent && (
          <div
            className={`${
              showPreferencesSidebar ? 'w-80' : 'w-0'
            } border-r border-border bg-card flex flex-col transition-all duration-300 overflow-hidden h-full`}
          >
            {showPreferencesSidebar && (
              <div
                ref={sidebarScrollRef}
                className="flex-1 overflow-y-auto p-6 profile-sidebar-scroll"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
                }}
              >
                {/* Header - only show for non-Risk Level content */}
                {sidebarContent.title !== 'Coastal sailing' && 
                 sidebarContent.title !== 'Offshore sailing' && 
                 sidebarContent.title !== 'Extreme sailing' && (
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-card-foreground">
                      {sidebarContent.title}
                    </h3>
                  </div>
                )}

                {/* Content */}
                <div className="space-y-3 text-sm text-foreground">
                  {sidebarContent.content}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toggle Button */}
        {sidebarContent && (
          <button
            onClick={() => setShowPreferencesSidebar(!showPreferencesSidebar)}
            className={`absolute top-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all ${
              showPreferencesSidebar ? 'left-[320px]' : 'left-4'
            }`}
            title={showPreferencesSidebar ? 'Close panel' : 'Open panel'}
            aria-label={showPreferencesSidebar ? 'Close panel' : 'Open panel'}
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              {showPreferencesSidebar ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              )}
            </svg>
          </button>
        )}

        {/* Main Content */}
        <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isNewProfile ? 'Complete Your Profile' : 'My Profile'}
          </h1>
          <p className="text-muted-foreground">
            {isNewProfile 
              ? 'Please complete your profile information to get started'
              : profile?.role === 'owner' 
                ? 'Manage your profile information as a boat owner/skipper'
                : 'Manage your profile information as a crew member'}
          </p>
        </div>

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

        <div className="bg-card rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    <button
                      type="button"
                      onClick={removeProfileImage}
                      className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      aria-label="Remove profile image"
                      title="Remove profile image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full border-4 border-dashed border-border flex items-center justify-center bg-muted">
                    <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <label className="flex flex-col items-center justify-center w-full border-2 border-border border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors px-4 py-3">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="johndoe"
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
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Role
                </label>
                <div className="px-3 py-2 bg-muted border border-border rounded-md text-foreground">
                  {(() => {
                    const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
                    const roleFromMetadata = user?.user_metadata?.role as 'owner' | 'crew' | null;
                    const role = profile?.role || roleFromUrl || roleFromMetadata || 'crew';
                    return role === 'owner' ? 'Boat Owner/Skipper' : 'Crew Member';
                  })()}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Role cannot be changed</p>
              </div>
            </div>

            {/* Risk Level - Only visible for crew members */}
            {(profile?.role === 'crew' || (isNewProfile && (searchParams.get('role') === 'crew' || user?.user_metadata?.role === 'crew'))) && (
              <div className="grid grid-cols-1 gap-4">
                <RiskLevelSelector
                  value={formData.risk_level}
                  onChange={(risk_level) => setFormData(prev => ({ ...prev, risk_level }))}
                  onInfoClick={(title, content) => {
                    setSidebarContent({ title, content });
                    setShowPreferencesSidebar(true);
                    // Scroll to top of sidebar after opening
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
              </div>
            )}

            {/* Sailing Preferences - Only visible for crew members */}
            {(() => {
              const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
              const roleFromMetadata = user?.user_metadata?.role as 'owner' | 'crew' | null;
              const role = profile?.role || roleFromUrl || roleFromMetadata || 'crew';
              return role === 'crew';
            })() && (
            <div>
              <label htmlFor="sailing_preferences" className="block text-sm font-medium text-foreground mb-2">
                Motivation and Sailing Preferences
              </label>
              <textarea
                id="sailing_preferences"
                name="sailing_preferences"
                value={formData.sailing_preferences}
                onChange={handleChange}
                onFocus={() => {
                  const hasOffshoreSailing = formData.risk_level.includes('Offshore sailing');
                  
                  setSidebarContent({
                    title: 'Motivation and Sailing Preferences',
                    content: (
                      <>
                        <p className="font-medium mb-3">Consider the following when describing your motivation and sailing preferences:</p>
                        <ul className="space-y-3 list-none">
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>Do you have any dietary restrictions, allergies, or preferences that could affect meal planning (e.g., vegetarian, gluten-free, or aversion to canned/freeze-dried food)?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('I have dietary restrictions or allergies: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>Do you have any history of motion sickness or seasickness? If so, how do you manage it, and under what conditions does it worsen (e.g., high waves, enclosed spaces)?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('Regarding motion sickness: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>Are there any physical limitations or health concerns we should know about or medications that require refrigeration?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('I have the following physical limitations or health concerns: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>What aspects of sailing excite you most, solitude, handling rough weather, stargazing at night, exploring ports, sightseeing or the camaraderie with the crew?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('What excites me most about sailing: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>Are you looking for a more relaxed cruise and downtime, or an intense, performance-oriented sailing with watches, sail changes and/or navigation challenges?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('I prefer: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>Do you prefer structured activities like learning knots and sail trim, or more free-form time to enjoy the ocean and socialize?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('Regarding activities, I prefer: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          <li className="relative group">
                            <div className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span className={bulletPointTextClass}>Are there any strong dislikes for you that would prevent joining the trip (e.g., lack of privacy, being cold/wet, bugs at anchor, long motoring in no wind, or crowded anchorages)?</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => appendToSailingPreferences('I would prefer to avoid: ')}
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Add to text field"
                            >
                              <div className={addButtonClass}>
                                {addButtonIcon}
                              </div>
                            </button>
                          </li>
                          {hasOffshoreSailing && (
                            <>
                              <li className="relative group">
                                <div className="flex items-start">
                                  <span className="mr-2 text-primary">•</span>
                                  <span className={bulletPointTextClass}>What draws you to offshore sailing (e.g., solitude, adventure, skill-building, camraderie / team activity?)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => appendToSailingPreferences('What draws me to offshore sailing: ')}
                                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                  title="Add to text field"
                                >
                                  <div className={addButtonClass}>
                                    {addButtonIcon}
                                  </div>
                                </button>
                              </li>
                              <li className="relative group">
                                <div className="flex items-start">
                                  <span className="mr-2 text-primary">•</span>
                                  <span className={bulletPointTextClass}>How do you handle sleep deprivation or irregular schedules, such as night watches every few hours?</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => appendToSailingPreferences('Regarding sleep and watch schedules: ')}
                                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                  title="Add to text field"
                                >
                                  <div className={addButtonClass}>
                                    {addButtonIcon}
                                  </div>
                                </button>
                              </li>
                              <li className="relative group">
                                <div className="flex items-start">
                                  <span className="mr-2 text-primary">•</span>
                                  <span className={bulletPointTextClass}>What level of risk are you comfortable with—e.g., would you prefer to avoid passages with potential for storms, or are you okay with that as part of the adventure?</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => appendToSailingPreferences('My comfort level with risk: ')}
                                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                  title="Add to text field"
                                >
                                  <div className={addButtonClass}>
                                    {addButtonIcon}
                                  </div>
                                </button>
                              </li>
                            </>
                          )}
                        </ul>
                      </>
                    ),
                  });
                  setShowPreferencesSidebar(true);
                }}
                rows={4}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-y"
                placeholder="Describe your motivation and preferences, what draws you to the sailing and what do you like?"
              />
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkillLevelSelector
                value={formData.sailing_experience}
                onChange={(sailing_experience) => setFormData(prev => ({ ...prev, sailing_experience }))}
                onInfoClick={(title, content) => {
                  setSidebarContent({ title, content });
                  setShowPreferencesSidebar(true);
                  // Scroll to top of sidebar after opening
                  setTimeout(() => {
                    if (sidebarScrollRef.current) {
                      sidebarScrollRef.current.scrollTop = 0;
                    }
                  }, 100);
                }}
              />
            </div>

            {/* Skills Selection */}
            <div className="grid grid-cols-1 gap-4">
              <label 
                htmlFor="skills-section" 
                className="block text-sm font-medium text-foreground mb-2"
                onFocus={() => {
                  // Determine user role
                  const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
                  const roleFromMetadata = user?.user_metadata?.role as 'owner' | 'crew' | null;
                  const role = profile?.role || roleFromUrl || roleFromMetadata || 'crew';
                  
                  // For owners, show all skills. For crew, show based on selected risk levels
                  const isOwner = role === 'owner';
                  const hasOffshoreSailing = isOwner || formData.risk_level.includes('Offshore sailing');
                  const hasExtremeSailing = isOwner || formData.risk_level.includes('Extreme sailing');
                  
                  setSidebarContent({
                    title: 'Skills',
                    content: (
                      <>
                        <p className="font-medium mb-3">Click the "+" button to add skills to your profile:</p>
                        <ul className="space-y-3 list-none">
                          {/* General skills - always shown */}
                          {skillsConfig.general.map(skill => renderSkillItem(skill))}
                          
                          {/* Offshore sailing skills */}
                          {hasOffshoreSailing && skillsConfig.offshore.map(skill => renderSkillItem(skill))}
                          
                          {/* Extreme sailing skills */}
                          {hasExtremeSailing && skillsConfig.extreme.map(skill => renderSkillItem(skill))}
                        </ul>
                      </>
                    ),
                  });
                  setShowPreferencesSidebar(true);
                }}
              >
                Skills
              </label>
              
              {/* Display selected skills with editable descriptions */}
              {formData.skills.length > 0 && (
                <div className="space-y-3 mb-3">
                  {formData.skills.map((skill) => {
                    // Convert snake_case to Title Case for display
                    const formatSkillName = (name: string) => {
                      return name
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    };
                    const displayName = formatSkillName(skill.skill_name);
                    
                    return (
                      <div key={skill.skill_name} className="flex items-start gap-2 p-3 border border-border rounded-md bg-card">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-foreground">
                              {displayName}
                            </label>
                            <button
                              type="button"
                              onClick={() => removeSkill(skill.skill_name)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                              title="Remove skill"
                            >
                              Remove
                            </button>
                          </div>
                          <textarea
                            id={`skill-${skill.skill_name}`}
                            value={skill.description}
                            onChange={(e) => updateSkillDescription(skill.skill_name, e.target.value)}
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
              
              {/* Add Skills button - always shown */}
              <button
                type="button"
                onClick={() => {
                  // Determine user role
                  const roleFromUrl = searchParams.get('role') as 'owner' | 'crew' | null;
                  const roleFromMetadata = user?.user_metadata?.role as 'owner' | 'crew' | null;
                  const role = profile?.role || roleFromUrl || roleFromMetadata || 'crew';
                  
                  // For owners, show all skills. For crew, show based on selected risk levels
                  const isOwner = role === 'owner';
                  const hasOffshoreSailing = isOwner || formData.risk_level.includes('Offshore sailing');
                  const hasExtremeSailing = isOwner || formData.risk_level.includes('Extreme sailing');
                  
                  setSidebarContent({
                    title: 'Skills',
                    content: (
                      <>
                        <p className="font-medium mb-3">Click the "+" button to add skills to your profile:</p>
                        <ul className="space-y-3 list-none">
                          {/* General skills - always shown */}
                          {skillsConfig.general.map(skill => renderSkillItem(skill))}
                          
                          {/* Offshore sailing skills */}
                          {hasOffshoreSailing && skillsConfig.offshore.map(skill => renderSkillItem(skill))}
                          
                          {/* Extreme sailing skills */}
                          {hasExtremeSailing && skillsConfig.extreme.map(skill => renderSkillItem(skill))}
                        </ul>
                      </>
                    ),
                  });
                  setShowPreferencesSidebar(true);
                }}
                className="w-full px-4 py-3 border-2 border-dashed border-border rounded-md bg-card hover:bg-accent hover:border-primary transition-colors text-sm font-medium text-foreground flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Skills
              </button>
            </div>

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
                className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                placeholder={
                  profile?.role === 'owner'
                    ? 'List any relevant certifications, licenses, or qualifications'
                    : 'List your sailing certifications, licenses, or qualifications (e.g., RYA, ASA, etc.)'
                }
              />
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link
                href={profile?.role === 'owner' ? '/owner/boats' : '/crew/dashboard'}
                className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
        </div>
      </main>
    </div>
  );
}
