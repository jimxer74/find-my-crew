'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useProfileRedirect } from '@shared/lib/profile/redirectHelper';

type LimitedAccessIndicatorProps = {
  message?: string;
  showCompleteProfileCTA?: boolean;
};

export function LimitedAccessIndicator({
  message = "Complete your profile to see full leg details and register",
  showCompleteProfileCTA = true
}: LimitedAccessIndicatorProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { handleRedirect } = useProfileRedirect();

  const handleProfileClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      await handleRedirect(user.id, router);
    }
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium mb-1">{message}</p>
          {showCompleteProfileCTA && (
            <Link
              href="#"
              onClick={handleProfileClick}
              className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              Complete your profile
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
