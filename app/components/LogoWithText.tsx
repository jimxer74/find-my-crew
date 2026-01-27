'use client';

import Link from 'next/link';
import Image from 'next/image';

type LogoWithTextProps = {
  className?: string;
};

export function LogoWithText({ 
  className = ''
}: LogoWithTextProps) {
  return (
    <Link href="/" className={className}>
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
