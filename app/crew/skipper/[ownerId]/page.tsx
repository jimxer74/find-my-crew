'use client';

import { logger } from '@shared/logging';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';

interface SkipperProfile {
  id: string;
  full_name: string | null;
  username: string;
  profile_image_url: string | null;
  user_description: string | null;
  certifications: string | null;
  sailing_preferences: string | null;
  skills: string[];
  sailing_experience: number | null;
  risk_level: string[];
}

interface BoatSummary {
  id: string;
  name: string;
  type: string | null;
  make_model: string | null;
  year_built: number | null;
  loa_m: number | null;
  capacity: number | null;
  home_port: string | null;
  country_flag: string | null;
  images: string[];
  miles_on_vessel: number | null;
  offshore_passage_experience: boolean | null;
  characteristics: string | null;
  capabilities: string | null;
  accommodations: string | null;
}

interface SafetyEquipment {
  id: string;
  name: string;
  subcategory: string | null;
  status: string;
  service_date: string | null;
  next_service_date: string | null;
  expiry_date: string | null;
}

interface MaintenanceSummary {
  open_count: number;
  overdue_count: number;
  last_completed_date: string | null;
  upcoming_by_category: Record<string, number>;
}

const EXPERIENCE_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Competent Crew',
  3: 'Coastal Skipper',
  4: 'Offshore Skipper',
};

export default function SkipperProfilePage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<SkipperProfile | null>(null);
  const [boat, setBoat] = useState<BoatSummary | null>(null);
  const [safetyEquipment, setSafetyEquipment] = useState<SafetyEquipment[]>([]);
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/skipper/${ownerId}/profile`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403) {
            setError('Access denied. You must have an approved registration with this skipper to view their profile.');
          } else if (res.status === 404) {
            setError('Skipper not found.');
          } else {
            setError(data.error || 'Failed to load skipper profile.');
          }
          return;
        }
        const data = await res.json();
        setProfile(data.profile);
        setBoat(data.boat);
        setSafetyEquipment(data.safety_equipment ?? []);
        setMaintenanceSummary(data.maintenance_summary ?? null);
      } catch (err) {
        logger.error('[SkipperProfile] Fetch error:', err instanceof Error ? { error: err.message } : { error: String(err) });
        setError('Failed to load skipper profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, ownerId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Could not load profile</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link
            href="/crew/registrations"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            ← Back to My Registrations
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.full_name || profile.username;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href="/crew/registrations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Registrations
        </Link>

        {/* Page header */}
        <h1 className="text-2xl font-bold text-foreground mb-6">Skipper Profile</h1>

        {/* Profile card */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex gap-5 items-start">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.profile_image_url ? (
                <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                  <Image src={profile.profile_image_url} alt={displayName} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            {/* Name + description */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
              {profile.user_description && (
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{profile.user_description}</p>
              )}
            </div>
          </div>

          {/* Sailing background */}
          <div className="mt-5 pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profile.sailing_experience !== null && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Experience Level</h3>
                <p className="text-sm text-foreground">
                  {EXPERIENCE_LABELS[profile.sailing_experience] ?? `Level ${profile.sailing_experience}`}
                </p>
              </div>
            )}
            {profile.risk_level.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sailing Style</h3>
                <p className="text-sm text-foreground">{profile.risk_level.join(', ')}</p>
              </div>
            )}
            {profile.certifications && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Certifications</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{profile.certifications}</p>
              </div>
            )}
            {profile.sailing_preferences && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sailing Preferences</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{profile.sailing_preferences}</p>
              </div>
            )}
          </div>

          {profile.skills.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="px-2 py-0.5 bg-accent text-accent-foreground rounded-full text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Boat section */}
        {boat && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">The Boat</h2>
            <div className="flex gap-4 items-start">
              {boat.images.length > 0 && (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={boat.images[0]} alt={boat.name} fill className="object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">{boat.name}</h3>
                {boat.make_model && <p className="text-sm text-muted-foreground">{boat.make_model}</p>}
                {boat.type && <p className="text-sm text-muted-foreground">{boat.type}</p>}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {boat.year_built && (
                <div>
                  <p className="text-xs text-muted-foreground">Year Built</p>
                  <p className="text-sm font-medium">{boat.year_built}</p>
                </div>
              )}
              {boat.loa_m && (
                <div>
                  <p className="text-xs text-muted-foreground">Length Overall</p>
                  <p className="text-sm font-medium">{boat.loa_m} m</p>
                </div>
              )}
              {boat.capacity && (
                <div>
                  <p className="text-xs text-muted-foreground">Capacity</p>
                  <p className="text-sm font-medium">{boat.capacity} persons</p>
                </div>
              )}
              {boat.home_port && (
                <div>
                  <p className="text-xs text-muted-foreground">Home Port</p>
                  <p className="text-sm font-medium">{boat.home_port}</p>
                </div>
              )}
              {boat.miles_on_vessel !== null && boat.miles_on_vessel !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Nautical Miles</p>
                  <p className="text-sm font-medium">{boat.miles_on_vessel.toLocaleString()} nm</p>
                </div>
              )}
              {boat.offshore_passage_experience && (
                <div>
                  <p className="text-xs text-muted-foreground">Offshore Experience</p>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">✓ Yes</p>
                </div>
              )}
            </div>

            {boat.characteristics && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-1">Characteristics</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{boat.characteristics}</p>
              </div>
            )}
            {boat.capabilities && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Capabilities</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{boat.capabilities}</p>
              </div>
            )}
            {boat.accommodations && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Accommodations</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{boat.accommodations}</p>
              </div>
            )}
          </div>
        )}

        {/* Safety Equipment */}
        {safetyEquipment.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Safety Equipment</h2>
            <div className="space-y-2">
              {safetyEquipment.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.subcategory && <p className="text-xs text-muted-foreground">{item.subcategory}</p>}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {item.expiry_date && (
                      <p>Expires: {new Date(item.expiry_date).toLocaleDateString()}</p>
                    )}
                    {item.next_service_date && (
                      <p>Next service: {new Date(item.next_service_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Maintenance Summary */}
        {maintenanceSummary && (maintenanceSummary.open_count > 0 || maintenanceSummary.last_completed_date) && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Maintenance Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Open Tasks</p>
                <p className={`text-2xl font-bold ${maintenanceSummary.open_count > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                  {maintenanceSummary.open_count}
                </p>
              </div>
              {maintenanceSummary.overdue_count > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{maintenanceSummary.overdue_count}</p>
                </div>
              )}
              {maintenanceSummary.last_completed_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Last Completed</p>
                  <p className="text-sm font-medium">{new Date(maintenanceSummary.last_completed_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {Object.keys(maintenanceSummary.upcoming_by_category).length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Upcoming by Category</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(maintenanceSummary.upcoming_by_category).map(([cat, count]) => (
                    <span key={cat} className="px-2 py-1 bg-accent rounded-full text-xs">
                      {cat}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
