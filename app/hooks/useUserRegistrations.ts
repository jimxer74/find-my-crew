'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { logger } from '@shared/logging';

export interface UserRegistration {
  id: string;
  leg_id: string;
  user_id: string;
  status: 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';
  created_at: string;
  updated_at: string;
}

export interface UseUserRegistrationsReturn {
  registrations: Map<string, UserRegistration['status']>; // leg_id => status
  isLoading: boolean;
  error: string | null;
  getRegistrationStatus: (leg_id: string) => UserRegistration['status'] | null;
  isRegistered: (leg_id: string) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and cache user's registrations for all legs
 * Returns a Map for O(1) lookups instead of iterating through arrays
 *
 * Usage:
 * const { getRegistrationStatus, isRegistered } = useUserRegistrations();
 * const status = getRegistrationStatus(leg_id); // 'Approved' | 'Pending approval' | null
 * if (!isRegistered(leg_id)) { showJoinButton(); }
 */
export function useUserRegistrations(): UseUserRegistrationsReturn {
  const { user, loading: authLoading } = useAuth();
  const [registrationsMap, setRegistrationsMap] = useState<Map<string, UserRegistration['status']>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Fetch registrations from API
  const fetchRegistrations = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/registrations');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('[useUserRegistrations] API error', {
          status: response.status,
          errorData,
        });
        throw new Error(
          errorData.error || `Failed to fetch registrations (${response.status})`
        );
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      // Convert array to Map for O(1) lookups
      const newMap = new Map<string, UserRegistration['status']>();
      const registrations: UserRegistration[] = data.registrations || [];

      registrations.forEach((reg) => {
        newMap.set(reg.leg_id, reg.status);
      });

      setRegistrationsMap(newMap);
      logger.debug('[useUserRegistrations] Loaded registrations', {
        count: registrations.length,
      });
    } catch (err: any) {
      if (isMountedRef.current) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        logger.error('[useUserRegistrations] Error fetching', {
          error: errorMessage,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // Load registrations on mount or when user changes
  useEffect(() => {
    isMountedRef.current = true;

    if (!user || authLoading) {
      setRegistrationsMap(new Map());
      hasLoadedRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    // Only fetch if user changed or if we haven't loaded yet
    const shouldFetch = !hasLoadedRef.current || lastUserIdRef.current !== user.id;

    if (shouldFetch) {
      logger.debug('[useUserRegistrations] Fetching registrations for user', {
        userId: user.id,
      });
      fetchRegistrations().then(() => {
        if (isMountedRef.current) {
          hasLoadedRef.current = true;
          lastUserIdRef.current = user.id;
        }
      });
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [user, authLoading, fetchRegistrations]);

  // Memoized helper functions
  const getRegistrationStatus = useCallback(
    (leg_id: string): UserRegistration['status'] | null => {
      const status = registrationsMap.get(leg_id);
      return status || null;
    },
    [registrationsMap]
  );

  const isRegistered = useCallback(
    (leg_id: string): boolean => {
      return registrationsMap.has(leg_id);
    },
    [registrationsMap]
  );

  // Memoize return object to prevent unnecessary re-renders
  const result = useMemo(
    () => ({
      registrations: registrationsMap,
      isLoading,
      error,
      getRegistrationStatus,
      isRegistered,
      refetch: fetchRegistrations,
    }),
    [registrationsMap, isLoading, error, getRegistrationStatus, isRegistered, fetchRegistrations]
  );

  return result;
}
