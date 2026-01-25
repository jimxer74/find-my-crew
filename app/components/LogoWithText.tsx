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
        src="/sailsmart7.png" 
        alt="SailSmart" 
        width={55} 
        height={55}
        priority
        className="object-contain rounded-md"
      />
    </Link>
  );
}
