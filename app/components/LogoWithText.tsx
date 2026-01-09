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
  showText?: boolean;
  forceRole?: 'owner' | 'crew' | null;
};

export function LogoWithText({ 
  logoWidth = 200, 
  logoHeight = 67, 
  className = 'h-10 w-auto object-contain',
  showText = true,
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
  const shouldShowText = showText && user && displayRole;

  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/logo3.png"
        alt="Find My Crew"
        width={logoWidth}
        height={logoHeight}
        className={className}
        priority
      />
      {shouldShowText && (
        <span className="text-lg font-semibold">
          <span style={{ color: '#1B345E' }}>Find</span>{' '}
          <span style={{ color: '#2C4969' }}>
            {displayRole === 'owner' ? 'My Crew' : 'My Boat'}
          </span>
        </span>
      )}
    </Link>
  );
}
