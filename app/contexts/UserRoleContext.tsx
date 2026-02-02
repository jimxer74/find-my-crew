// contexts/UserRolesContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
// import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type UserRolesContextType = {
  userRoles: string[] | null
  roleLoading: boolean
  hasRole: (role: string) => boolean
}

const UserRolesContext = createContext<UserRolesContextType | undefined>(undefined)

export function UserRolesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[] | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
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
    supabase
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single()
    .then(({ data, error }) => {
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
    });
    

  }, [user])

  const hasRole = (role: string) => !!userRoles?.includes(role)

  return (
    <UserRolesContext.Provider value={{ userRoles, roleLoading, hasRole }}>
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