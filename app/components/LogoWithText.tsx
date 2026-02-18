'use client';

import Link from 'next/link';
import Image from 'next/image';
import { logger } from '@/app/lib/logger';
import { useTheme } from '../contexts/ThemeContext';

type LogoWithTextProps = {
  className?: string;
  userRole?: string;
};

export function LogoWithText({ className = '', userRole = ''
}: LogoWithTextProps ) {
  
  const handleClick = (e: React.MouseEvent) => {
    // Close all dialogs immediately when logo is clicked
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('closeAllDialogs'));
    }
  };

  logger.debug("LogoWithText userRole", { userRole });
  const theme = useTheme();

  return (
    <Link href={userRole === 'crew' ? '/crew' : '/'} className={className} onClick={handleClick}>
    <Image 
        src={theme.resolvedTheme === 'dark' ? "/sailsmart_new_tp_dark.png" : "/sailsmart_new_tp.png"} 
        alt="SailSmart" 
        width={58} 
        height={58}
        priority
        className="object-contain rounded-md"
      />
    </Link>
  );
}
