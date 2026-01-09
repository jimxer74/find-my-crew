'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type LogoWithTextProps = {
  logoWidth?: number;
  logoHeight?: number;
  className?: string;
  forceRole?: 'owner' | 'crew' | null;
};

export function LogoWithText({ 
  logoWidth = 200, 
  logoHeight = 67, 
  className = 'h-10 w-auto object-contain',
  forceRole = null
}: LogoWithTextProps) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<'owner' | 'crew' | null>(null);

  useEffect(() => {
    if (user && !forceRole) {
      const supabase = getSupabaseBrowserClient();
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserRole(data.role);
          }
        });
    } else if (forceRole) {
      setUserRole(forceRole);
    }
  }, [user, forceRole]);

  const displayRole = forceRole || userRole;
  
  // Determine logo source based on role
  let logoSrc = '/logo_find_my_crew.png'; // default logo for non-logged-in users
  if (user && displayRole) {
    logoSrc = displayRole === 'owner' ? '/logo_find_my_crew.png' : '/logo_find_my_boat.png';
  }

  return (
    <Link href="/">
      <Image
        src={logoSrc}
        alt={displayRole === 'owner' ? 'Find My Crew' : displayRole === 'crew' ? 'Find My Boat' : 'Find My Crew'}
        width={logoWidth}
        height={logoHeight}
        className={`${className} rounded-lg`}
        priority
      />
    </Link>
  );
}
