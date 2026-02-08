'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

/**
 * Main content wrapper that conditionally applies padding based on route.
 * Routes like /welcome don't have a header, so they don't need top padding.
 * Also handles minimal mode (via ?minimal=1 query param) for welcome flow links.
 */
export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Routes that don't have a header and shouldn't have top padding
  const noHeaderRoutes = ['/welcome'];
  const isMinimalMode = searchParams?.get('minimal') === '1';
  const hasHeader = !noHeaderRoutes.some(route => pathname?.startsWith(route)) && !isMinimalMode;

  return (
    <div className={hasHeader ? 'min-h-screen pt-16' : 'min-h-screen'}>
      {children}
    </div>
  );
}
