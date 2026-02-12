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
  const noHeaderExactRoutes = ['/'];
  const noHeaderPrefixRoutes: string[] = ['/welcome'];
  const isMinimalMode = searchParams?.get('minimal') === '1';
  const isNoHeaderRoute =
    noHeaderExactRoutes.includes(pathname || '') ||
    noHeaderPrefixRoutes.some(route => pathname?.startsWith(route));
  const hasHeader = !isNoHeaderRoute && !isMinimalMode;

  return (
    <div className={hasHeader ? 'min-h-screen pt-16' : 'min-h-screen'}>
      {children}
    </div>
  );
}
