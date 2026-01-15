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

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    experience: '',
    certifications: '',
    phone: '',
    sailing_experience: null as 'Beginner' | 'Competent Crew' | 'Coastal Skipper' | 'Offshore Skipper' | null,
    risk_level: [] as ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[],
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              />
            </div>

            {/* Risk Level - Only visible for crew members */}
            {(profile?.role === 'crew' || (isNewProfile && (searchParams.get('role') === 'crew' || user?.user_metadata?.role === 'crew'))) && (
              <div className="grid grid-cols-1 gap-4">
                <RiskLevelSelector
                  value={formData.risk_level}
                  onChange={(risk_level) => setFormData(prev => ({ ...prev, risk_level }))}
                />
              </div>
            )}

            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-foreground mb-2">
                Experience
              </label>
              <textarea
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
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
      </main>
    </div>
  );
}
