'use client';

import Link from 'next/link';
import Image from 'next/image';

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

  console.log("LogoWithText userRole:", userRole);

  return (
    <Link href={userRole === '' ? '/' : userRole === 'owner' ? '/owner/journeys' : '/crew/dashboard'} className={className} onClick={handleClick}>
      <Image 
        src="/sailsmart8.png" 
        alt="SailSmart" 
        width={40} 
        height={40}
        priority
        className="object-contain rounded-md"
      />
    </Link>
  );
}
