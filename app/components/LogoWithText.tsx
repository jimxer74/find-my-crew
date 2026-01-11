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
        className="px-4 py-2 text-white uppercase font-bold"
        style={{ 
          backgroundColor: '#22276E',
          fontFamily: 'Cascadia Code, monospace',
          fontWeight: 600,
          borderRadius: '50% 0% 50% 50% / 120%'
        }}
      >
        CREW.
      </div>
    </Link>
  );
}
