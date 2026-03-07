'use client';

import { useEffect } from 'react';
import { useUserRoles } from '@/app/contexts/UserRoleContext';

export function RoleThemeApplicator() {
  const { userRoles } = useUserRoles();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('role-crew', 'role-owner');

    if (userRoles?.includes('owner')) {
      root.classList.add('role-owner');
    } else if (userRoles?.includes('crew')) {
      root.classList.add('role-crew');
    }
  }, [userRoles]);

  return null;
}
