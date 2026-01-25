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
        src="/sailsmart.png" 
        alt="SailSmart" 
        width={50} 
        height={50}
        priority
        className="object-contain rounded-lg"
      />
    </Link>
  );
}
