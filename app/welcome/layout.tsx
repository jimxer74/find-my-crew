import type { ReactNode } from 'react';

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return <div data-force-light className="min-h-screen">{children}</div>;
}
