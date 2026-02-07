// contexts/UserRolesContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

type UserRolesContextType = {
  userRoles: string[] | null
  roleLoading: boolean
  hasRole: (role: string) => boolean
  refreshRoles: () => Promise<void>
}

const UserRolesContext = createContext<UserRolesContextType | undefined>(undefined)

export function UserRolesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[] | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  const loadUserRoles = async () => {
    if (!user) {
      setUserRoles(null)
      setRoleLoading(false)
      return
    }

    setRoleLoading(true)

    const rolesFromMetadata = user.user_metadata?.roles as string[] | null;
    if (rolesFromMetadata && Array.isArray(rolesFromMetadata) && rolesFromMetadata.length > 0) {
      setUserRoles(rolesFromMetadata)
      setRoleLoading(false)
      return
    }

    // Fetch from database if no metadata available
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (error) {
      // If query fails, default to crew
      setUserRoles(['crew']);
    } else if (data?.roles && data.roles.length > 0) {
      setUserRoles(data.roles);
    } else {
      // If no profile exists yet, default to crew (most common case)
      setUserRoles(['crew']);
    }
    setRoleLoading(false);
  }

  const refreshRoles = loadUserRoles

  useEffect(() => {
    loadUserRoles()
  }, [user])

  // Listen for profile update events
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadUserRoles()
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [loadUserRoles]);

  const hasRole = (role: string) => !!userRoles?.includes(role)

  return (
    <UserRolesContext.Provider value={{ userRoles, roleLoading, hasRole, refreshRoles }}>
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