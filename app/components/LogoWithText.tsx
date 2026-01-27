'use client';

import Link from 'next/link';
import Image from 'next/image';

type LogoWithTextProps = {
  className?: string;
};

export function LogoWithText({ 
  className = ''
}: LogoWithTextProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Close all dialogs immediately when logo is clicked
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('closeAllDialogs'));
    }
  };

  return (
    <Link href="/" className={className} onClick={handleClick}>
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
