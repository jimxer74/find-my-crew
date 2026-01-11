'use client';

import { LogoWithText } from './LogoWithText';
import { NavigationMenu } from './NavigationMenu';

export function Header() {
  return (
    <nav className="border-b border-border bg-card sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <LogoWithText />
          </div>
          <div className="flex items-center">
            <NavigationMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
