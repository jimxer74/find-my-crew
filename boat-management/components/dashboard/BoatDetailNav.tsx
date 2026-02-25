'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BoatDetailNavProps {
  boatId: string;
}

const tabs = [
  { href: '', label: 'Equipment', icon: WrenchIcon },
  { href: '/inventory', label: 'Inventory', icon: BoxIcon },
  { href: '/maintenance', label: 'Maintenance', icon: ClipboardIcon },
];

export function BoatDetailNav({ boatId }: BoatDetailNavProps) {
  const pathname = usePathname();
  const basePath = `/owner/boats/${boatId}`;

  return (
    <nav className="border-b border-border mb-6">
      <div className="flex gap-0 overflow-x-auto -mb-px">
        {tabs.map((tab) => {
          const fullPath = `${basePath}${tab.href}`;
          // Match exact for equipment (base path), or starts with for others
          const isActive = tab.href === ''
            ? pathname === basePath || pathname === `${basePath}/`
            : pathname.startsWith(fullPath);

          return (
            <Link
              key={tab.href}
              href={fullPath}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-4.655 4.655a2.121 2.121 0 01-3-3l4.655-4.655m3-3l1.586-1.586a2 2 0 012.828 0L19.8 9.98a2 2 0 010 2.828l-1.586 1.586m-3-3l3 3" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
