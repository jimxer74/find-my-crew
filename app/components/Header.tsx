'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogoWithText } from './LogoWithText';
import { NavigationMenu } from './NavigationMenu';
import { LoginModal } from './LoginModal';
import { SignupModal } from './SignupModal';
import { FiltersDialog } from './FiltersDialog';
import { NotificationBell } from './notifications/NotificationBell';
import { AssistantButton } from './ai/AssistantButton';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

export function Header() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useAuth();
  const { filters, updateFilters } = useFilters();
  const [userRoles, setUserRoles] = useState<string[] | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);

  // Close all dialogs when route changes
  useEffect(() => {
    setIsLoginModalOpen(false);
    setIsSignupModalOpen(false);
    setIsFiltersDialogOpen(false);
    // Dispatch event to close all dialogs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('closeAllDialogs'));
    }
  }, [pathname]);

  // Listen for close all dialogs event
  useEffect(() => {
    const handleCloseAll = () => {
      setIsLoginModalOpen(false);
      setIsSignupModalOpen(false);
      setIsFiltersDialogOpen(false);
    };
    window.addEventListener('closeAllDialogs', handleCloseAll);
    return () => {
      window.removeEventListener('closeAllDialogs', handleCloseAll);
    };
  }, []);

  // Close all dialogs when any Link is clicked (global handler)
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Skip if click is from navigation menu (it handles its own navigation)
      if (target.closest('[data-navigation-menu]')) {
        return;
      }
      // Check if click is on a Link or inside a Link (Next.js Link renders as <a>)
      const link = target.closest('a[href]');
      if (link) {
        const href = link.getAttribute('href');
        // Only handle internal links (not external links or anchors)
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          // Close all dialogs immediately before navigation
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(false);
          setIsFiltersDialogOpen(false);
          window.dispatchEvent(new CustomEvent('closeAllDialogs'));
        }
      }
    };

    // Use capture phase to run before Link's onClick handlers
    document.addEventListener('click', handleLinkClick, true);
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, []);

  // Get user roles for Filters button visibility
  useEffect(() => {
    if (user) {
      setRoleLoading(true);
      // Try to get roles from user metadata first (faster, synchronous)
      const rolesFromMetadata = user.user_metadata?.roles as string[] | null;
      if (rolesFromMetadata && Array.isArray(rolesFromMetadata) && rolesFromMetadata.length > 0) {
        setUserRoles(rolesFromMetadata);
        setRoleLoading(false);
        return; // Early return if we have metadata
      }

      // Fetch from database if no metadata available
      const supabase = getSupabaseBrowserClient();
      supabase
        .from('profiles')
        .select('roles')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            // If query fails, default to crew
            setUserRoles(['crew']);
          } else if (data?.roles && data.roles.length > 0) {
            setUserRoles(data.roles);
          } else {
            // If no profile exists yet, default to crew (most common case)
            setUserRoles(['crew']);
          }
          setRoleLoading(false);
        });
    } else {
      setUserRoles(null);
      setRoleLoading(false);
    }
  }, [user]);


  const hasActiveFilters = () => {
    return !!(
      filters.location ||
      (filters.riskLevel && filters.riskLevel.length > 0) ||
      filters.experienceLevel ||
      (filters.dateRange.start || filters.dateRange.end)
    );
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.location) count++;
    if (filters.riskLevel && filters.riskLevel.length > 0) count++;
    if (filters.experienceLevel) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    return count;
  };

  return (
    <>
      <nav className="border-b border-border bg-card fixed top-0 left-0 right-0 z-[110] shadow-sm w-full backdrop-blur-sm bg-card/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LogoWithText userRole={userRoles?.[0] || ''}/>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              {user && (userRoles?.includes('crew') || (userRoles === null && roleLoading)) && (
                <button
                  onClick={() => {
                    // On mobile, navigate to filters page; on desktop, open modal
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      router.push('/filters');
                    } else {
                      setIsFiltersDialogOpen(true);
                    }
                  }}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 min-h-[44px] rounded-md bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm"
                  aria-label={`Filters${getActiveFiltersCount() > 0 ? ` (${getActiveFiltersCount()} active)` : ''}`}
                >
                  <div className="relative">
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-foreground"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <line x1="4" y1="6" x2="16" y2="6" />
                      <circle cx="19" cy="6" r="2" fill="none" />
                      <line x1="4" y1="12" x2="16" y2="12" />
                      <circle cx="5" cy="12" r="2" fill="none" />
                      <line x1="4" y1="18" x2="16" y2="18" />
                      <circle cx="19" cy="18" r="2" fill="none" />
                    </svg>
                    {/* Active filters badge */}
                    {getActiveFiltersCount() > 0 && (
                      <span className="absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-red-500 rounded-full transform translate-x-1/2 -translate-y-1/2">
                        {getActiveFiltersCount() > 99 ? '99+' : getActiveFiltersCount()}
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${
                    hasActiveFilters()
                      ? 'text-foreground'
                      : 'text-muted-foreground'
                  }`}>
                    {t('filters')}
                  </span>
                </button>
              )}
              {/* AI Assistant - Only show for authenticated users */}
              {user && <AssistantButton />}
              {/* Notification Bell - Only show for authenticated users */}
              {user && <NotificationBell />}
              <NavigationMenu
                onOpenLogin={() => {
                  // On mobile, navigate to login page; on desktop, open modal
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    router.push('/auth/login');
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                onOpenSignup={() => {
                  // On mobile, navigate to signup page; on desktop, open modal
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    router.push('/auth/signup');
                  } else {
                    setIsSignupModalOpen(true);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </nav>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitchToSignup={() => {
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(true);
        }}
      />
      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSwitchToLogin={() => {
          setIsSignupModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
      <FiltersDialog
        isOpen={isFiltersDialogOpen}
        onClose={() => setIsFiltersDialogOpen(false)}
      />
    </>
  );
}
