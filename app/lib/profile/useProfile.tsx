'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '../supabaseClient';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

export type ProfileLocation = {
  name: string;
  lat: number;
  lng: number;
  isCruisingRegion?: boolean;
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  countryCode?: string;
  countryName?: string;
};

export type ProfileData = {
  id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  sailing_experience: number | null;
  risk_level: RiskLevel[] | null;
  skills: string[] | null;
  sailing_preferences: string[] | null;
  roles: string[] | null;
  profile_completion_percentage: number | null;
  preferred_departure_location: ProfileLocation | null;
  preferred_arrival_location: ProfileLocation | null;
  availability_start_date: string | null;
  availability_end_date: string | null;
};

type UseProfileReturn = {
  profile: ProfileData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isValidUser: boolean;
};

// Simple in-memory cache with TTL
const profileCache = new Map<string, { data: ProfileData | null; timestamp: number }>();
const CACHE_DURATION = 300000; // 5 minutes (300 seconds)

// Debounce timer for profile update events
let updateTimeout: NodeJS.Timeout | null = null;

export function useProfile(): UseProfileReturn {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isValidUser, setIsValidUser] = useState(false);

  // Check if user exists in profiles table
  const checkUserExists = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('id', userId);

      if (error) {
        logger.warn('Error checking user existence:', error);
        return false;
      }

      return !!(count && count > 0);
    } catch (err) {
      logger.warn('Error checking user existence:', err);
      return false;
    }
  }, []);

  // Fetch profile from database
  const fetchProfileFromDB = useCallback(async (userId: string): Promise<ProfileData | null> => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, phone, sailing_experience, risk_level, skills, sailing_preferences, roles, profile_completion_percentage, preferred_departure_location, preferred_arrival_location, availability_start_date, availability_end_date')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Record not found - this is expected for non-existent users
          return null;
        }
        if (error.code === 'PGRST302') {
          // Not Acceptable - malformed request
          logger.warn('Profile fetch malformed request:', error);
          return null;
        }
        throw error;
      }

      return data as ProfileData;
    } catch (err) {
      logger.warn('Error fetching profile data:', err);
      throw err;
    }
  }, []);

  // Main fetch function with caching
  const fetchProfile = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = profileCache.get(userId);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setProfile(cached.data);
        // Keep validity in sync when serving from cache.
        // Without this, isValidUser can remain stale/false and downstream UI
        // may incorrectly show "Create Profile" even when profile data exists.
        setIsValidUser(cached.data !== null);
        setLoading(false);
        return;
      }

      // Check if user exists
      const exists = await checkUserExists(userId);
      setIsValidUser(exists);

      if (!exists) {
        setProfile(null);
        profileCache.set(userId, { data: null, timestamp: now });
        setLoading(false);
        return;
      }

      // Fetch from database
      const data = await fetchProfileFromDB(userId);
      setProfile(data);
      setError(null);

      // Update cache
      profileCache.set(userId, { data, timestamp: now });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [checkUserExists, fetchProfileFromDB]);

  // Profile update handler: immediate refetch when detail.immediate (e.g. after onboarding), else debounced
  const handleProfileUpdate = useCallback((event?: Event) => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
    }
    const detail = (event as CustomEvent<{ immediate?: boolean }> | undefined)?.detail;
    const immediate = detail?.immediate === true;

    if (user) {
      profileCache.delete(user.id);
      if (immediate) {
        fetchProfile(user.id);
      } else {
        updateTimeout = setTimeout(() => {
          if (user) fetchProfile(user.id);
          updateTimeout = null;
        }, 500);
      }
    }
  }, [user, fetchProfile]);

  // Initial fetch and user change handling
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      setIsValidUser(false);
      return;
    }

    fetchProfile(user.id);
  }, [user, fetchProfile]);

  // Listen for profile updates with debouncing
  useEffect(() => {
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    };
  }, [handleProfileUpdate]);

  // Cleanup cache periodically (every 10 minutes)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [userId, cached] of profileCache.entries()) {
        if (now - cached.timestamp > CACHE_DURATION * 3) { // 15 minutes
          profileCache.delete(userId);
        }
      }
    }, 600000); // 10 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  return useMemo(() => ({
    profile,
    loading,
    error,
    refetch: () => user ? fetchProfile(user.id) : Promise.resolve(),
    isValidUser
  }), [profile, loading, error, user, fetchProfile, isValidUser]);
}