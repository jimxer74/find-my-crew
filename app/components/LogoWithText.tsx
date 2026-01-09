'use client';

import Link from 'next/link';

type LogoWithTextProps = {
  className?: string;
};

export function LogoWithText({ 
  className = ''
}: LogoWithTextProps) {
  return (
    <Link href="/" className={className}>
      <div 
        className="px-4 py-2 rounded-lg text-white uppercase font-bold"
        style={{ 
          backgroundColor: '#22276E',
          fontFamily: 'Cascadia Code, monospace',
          fontWeight: 600
        }}
      >
        CREW.
      </div>
    </Link>
  );
}
