// contexts/UserRolesContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/app/contexts/AuthContext';
import { useProfile } from '@shared/lib/profile/useProfile';

type UserRolesContextType = {
  userRoles: string[] | null
  roleLoading: boolean
  hasRole: (role: string) => boolean
  refreshRoles: () => Promise<void>
}

const UserRolesContext = createContext<UserRolesContextType | undefined>(undefined)

export function UserRolesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [userRoles, setUserRoles] = useState<string[] | null>(null)

  const loadUserRoles = () => {
    if (!user) {
      setUserRoles(null);
      return;
    }

    const rolesFromMetadata = user.user_metadata?.roles as string[] | null;
    if (rolesFromMetadata && Array.isArray(rolesFromMetadata) && rolesFromMetadata.length > 0) {
      setUserRoles(rolesFromMetadata);
      return;
    }

    // Use profile data from shared hook
    if (profile?.roles && profile.roles.length > 0) {
      setUserRoles(profile.roles);
    } else {
      // If no roles set, keep userRoles as null
      setUserRoles(null);
    }
  }

  const refreshRoles = () => {
    loadUserRoles();
    return Promise.resolve();
  }

  useEffect(() => {
    loadUserRoles()
  }, [user, profile]);

  // No need for separate profile update listener - useProfile handles this

  const hasRole = (role: string) => !!userRoles?.includes(role)

  return (
    <UserRolesContext.Provider value={{ userRoles, roleLoading: profileLoading, hasRole, refreshRoles }}>
      {children}
    </UserRolesContext.Provider>
  )
}

export function useUserRoles() {
  const context = useContext(UserRolesContext)
  if (!context) {
    throw new Error('useUserRoles must be used within UserRolesProvider')
  }
  return context
}