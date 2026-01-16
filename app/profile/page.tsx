'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { SkillLevelSelector } from '@/app/components/ui/SkillLevelSelector';
import { RiskLevelSelector } from '@/app/components/ui/RiskLevelSelector';

type Profile = {
  id: string;
  role: 'owner' | 'crew';
  username: string | null;
  full_name: string | null;
  experience: string | null;
  certifications: string | null;
  phone: string | null;
  sailing_experience: 'Beginner' | 'Competent Crew' | 'Coastal Skipper' | 'Offshore Skipper' | null;
  risk_level: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[];
  sailing_preferences: string | null;
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

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    experience: '',
    certifications: '',
    phone: '',
    sailing_experience: null as 'Beginner' | 'Competent Crew' | 'Coastal Skipper' | 'Offshore Skipper' | null,
    risk_level: [] as ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[],
    sailing_preferences: '',
  });

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
          experience: '',
          certifications: '',
          phone: '',
          sailing_experience: null,
          risk_level: [],
          sailing_preferences: '',
        });

        // Create a temporary profile object for display
        setProfile({
          id: user.id,
          role: role,
          username: null,
          full_name: null,
          experience: null,
          certifications: null,
          phone: null,
          sailing_experience: null,
          risk_level: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        console.error('Error loading profile:', fetchError);
        setError('Failed to load profile');
      }
    } else if (data) {
      setProfile(data);
      setFormData({
        username: data.username || '',
        full_name: data.full_name || '',
        experience: data.experience || '',
        certifications: data.certifications || '',
        phone: data.phone || '',
        sailing_experience: data.sailing_experience || null,
        risk_level: data.risk_level || [],
        sailing_preferences: data.sailing_preferences || '',
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
            experience: formData.experience || null,
            certifications: formData.certifications || null,
            phone: formData.phone || null,
            sailing_experience: formData.sailing_experience || null,
            risk_level: formData.risk_level || [],
            sailing_preferences: formData.sailing_preferences || null,
          });

      error = insertError;
    } else {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('profiles')
          .update({
            username: formData.username || null,
            full_name: formData.full_name || null,
            experience: formData.experience || null,
            certifications: formData.certifications || null,
            phone: formData.phone || null,
            sailing_experience: formData.sailing_experience || null,
            risk_level: formData.risk_level || [],
            sailing_preferences: formData.sailing_preferences || null,
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
                className="flex-1 overflow-y-auto p-6 profile-sidebar-scroll"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
                }}
              >
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-card-foreground">
                    {sidebarContent.title}
                  </h3>
                </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkillLevelSelector
                value={formData.sailing_experience}
                onChange={(sailing_experience) => setFormData(prev => ({ ...prev, sailing_experience }))}
                onInfoClick={(title, content) => {
                  setSidebarContent({ title, content });
                  setShowPreferencesSidebar(true);
                }}
              />
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
                  }}
                  onClose={() => {
                    setShowPreferencesSidebar(false);
                    setSidebarContent(null);
                  }}
                />
              </div>
            )}

            {/* Sailing Preferences */}
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
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Do you have any dietary restrictions, allergies, or preferences that could affect meal planning (e.g., vegetarian, gluten-free, or aversion to canned/freeze-dried food)?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Do you have any history of motion sickness or seasickness? If so, how do you manage it, and under what conditions does it worsen (e.g., high waves, enclosed spaces)?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Are there any physical limitations or health concerns we should know about or medications that require refrigeration?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>What aspects of sailing excite you most, solitude, handling rough weather, stargazing at night, exploring ports, sightseeing or the camaraderie with the crew?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Are you looking for a more relaxed cruise and downtime, or an intense, performance-oriented sailing with watches, sail changes and/or navigation challenges?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Do you prefer structured activities like learning knots and sail trim, or more free-form time to enjoy the ocean and socialize?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Are there any strong dislikes for you that would prevent joining the trip (e.g., lack of privacy, being cold/wet, bugs at anchor, long motoring in no wind, or crowded anchorages)?</span>
                          </li>
                          {hasOffshoreSailing && (
                            <>
                              <li className="flex items-start">
                                <span className="mr-2 text-primary">•</span>
                                <span>What draws you to offshore sailing (e.g., solitude, adventure, skill-building, camraderie / team activity?)</span>
                              </li>
                              <li className="flex items-start">
                                <span className="mr-2 text-primary">•</span>
                                <span>How do you handle sleep deprivation or irregular schedules, such as night watches every few hours?</span>
                              </li>
                              <li className="flex items-start">
                                <span className="mr-2 text-primary">•</span>
                                <span>What level of risk are you comfortable with—e.g., would you prefer to avoid passages with potential for storms, or are you okay with that as part of the adventure?</span>
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

            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-foreground mb-2">
                Skills and Experience
              </label>
              <textarea
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                onFocus={() => {
                  const hasOffshoreSailing = formData.risk_level.includes('Offshore sailing');
                  const hasExtremeSailing = formData.risk_level.includes('Extreme sailing');
                  
                  setSidebarContent({
                    title: 'Skills and Experience',
                    content: (
                      <>
                        <p className="font-medium mb-3">Consider the following when describing your skills and experience:</p>
                        <ul className="space-y-3 list-none">
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>Have you trained / do you have basic first aid skills?</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>What is your sailing experience? (e.g., number of years/miles, types of boats—monohull, catamaran, dinghy and waters sailed: coastal, offshore, ocean crossings?)</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>What certifications or qualifications do you hold? (e.g., RYA Competent Crew, Day Skipper, Coastal Skipper/Yachtmaster; ASA equivalents; International Certificate of Competence (ICC); Powerboat Level 2; VHF radio license?)</span>
                          </li>
                          <li className="flex items-start">
                            <span className="mr-2 text-primary">•</span>
                            <span>What experience do you have with navigation? (e.g., reading charts, plotting courses, using GPS/chartplotter, dead reckoning, or celestial navigation basics?)</span>
                          </li>
                          {hasOffshoreSailing && (
                            <li className="flex items-start">
                              <span className="mr-2 text-primary">•</span>
                              <span>Are you familiar with night sailing or watch systems? (e.g., standing watch, collision avoidance at night, lights/shapes, or using radar/AIS?)</span>
                            </li>
                          )}
                          {hasExtremeSailing && (
                            <>
                              <li className="flex items-start">
                                <span className="mr-2 text-primary">•</span>
                                <span>Have you trained in survival skills (e.g., cold-water immersion, crevasse rescue analogs for ice sailing, first aid in remote areas)? Any gaps we should address?</span>
                              </li>
                              <li className="flex items-start">
                                <span className="mr-2 text-primary">•</span>
                                <span>Do you have firearms training and license and/or experience with polar bear deterrents? (required in places like Svalbard/Greenland)</span>
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
                className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                placeholder={
                  profile?.role === 'owner'
                    ? 'Describe your sailing experience, years of ownership, etc.'
                    : 'Describe your sailing experience, skills, previous voyages, etc.'
                }
              />
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
                className="px-4 py-2 border border-border rounded-md text-foreground hover:bg-accent font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
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
