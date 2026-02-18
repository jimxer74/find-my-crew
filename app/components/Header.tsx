'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { logger } from '@/app/lib/logger';
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
import { useUserRoles } from '@/app/contexts/UserRoleContext';
import { useAssistant } from '@/app/contexts/AssistantContext';

export function Header() {
  const t = useTranslations('common');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useAuth();
  const { filters, updateFilters } = useFilters();
  const { userRoles, roleLoading, refreshRoles } = useUserRoles();
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const { isOpen: isAssistantOpen, closeAssistant } = useAssistant();

  // Close all dialogs when route changes (excluding assistant dialog)
  useEffect(() => {
    setIsLoginModalOpen(false);
    setIsSignupModalOpen(false);
    setIsFiltersDialogOpen(false);
    // Dispatch event to close other dialogs (filters, notifications, navigation)
    if (typeof window !== 'undefined') {
      logger.debug('[Header] 📊 Dispatching closeAllDialogs event for route change');
      window.dispatchEvent(new CustomEvent('closeAllDialogs'));
    }
  }, [pathname]);

  // Listen for profile updates to refresh user information
  useEffect(() => {
    const handleProfileUpdate = () => {
      // Refresh user roles when profile is updated
      if (user) {
        refreshRoles();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [user, refreshRoles]);

  // Listen for close all dialogs event (Assistant sidebar handles its own closing)
  useEffect(() => {
    const handleCloseAll = () => {
      setIsLoginModalOpen(false);
      setIsSignupModalOpen(false);
      setIsFiltersDialogOpen(false);
      // Note: Assistant dialog listens to this event separately to close when other dialogs open
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
      // Skip if click is from dialog close buttons
      if (target.closest('button[aria-label="Close"]')) {
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
          logger.debug('[Header] 📊 Dispatching closeAllDialogs event for link click');
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
    if (filters.arrivalLocation) count++;
    if (filters.riskLevel && filters.riskLevel.length > 0) count++;
    if (filters.experienceLevel) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    return count;
  };

  // userRoles is already available from the useUserRoles() destructuring above

  // No longer tracking suggestions count

  // Don't render header on homepage, welcome routes, or minimal mode
  const isMinimalMode = searchParams?.get('minimal') === '1';
  const isWelcomeRoute = pathname?.startsWith('/welcome') || false;
  if (pathname === '/' || isWelcomeRoute || isMinimalMode) {
    return null;
  }

  // Check if we're on the crew dashboard page
  const isCrewDashboard = pathname === '/crew/dashboard';
  
  // Apply transparent styles for crew dashboard
  // On desktop, start header after the left panel (400px) so it doesn't cover the panel
  // On mobile, start from left offset to leave space for back button (~100px)
  const navClassName = isCrewDashboard
    ? "fixed top-0 left-[100px] md:left-[400px] right-0 z-[110] bg-transparent leg-details-panel-open-mobile-hidden"
    : "border-b border-border bg-card fixed top-0 left-0 right-0 z-[110] shadow-sm w-full backdrop-blur-sm bg-card/95";

  return (
    <>
      <nav className={navClassName}>
        <div className={`${isCrewDashboard ? 'px-2 md:max-w-7xl md:mx-auto md:px-4 md:sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              {!isCrewDashboard && (
                <>
                  <LogoWithText userRole={userRoles?.[0] || ''}/>
                  <Link
                    href="/feedback"
                    className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-400 text-yellow-900 rounded-full hover:bg-yellow-500 transition-colors text-center"
                  >
                    ⚠ Beta 
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              {user && (userRoles?.includes('crew') || (userRoles === null && roleLoading)) && (
                <button
                  ref={filtersButtonRef}
                  onClick={() => {
                    // Close assistant dialog before toggling filters
                    if (isAssistantOpen && closeAssistant) {
                      logger.debug('[Header] 📊 Closing assistant dialog for filters toggle');
                      closeAssistant();
                    }
                    // Toggle panel on both mobile and desktop
                    setIsFiltersDialogOpen(!isFiltersDialogOpen);
                  }}
                  className="cursor-pointer flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 min-h-[44px] min-w-[44px] rounded-md bg-transparent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm"
                  aria-label={`Search${getActiveFiltersCount() > 0 ? ` (${getActiveFiltersCount()} active)` : ''}`}
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
                      {isFiltersDialogOpen ? (
                        <path d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <>
                          <circle cx="11" cy="11" r="8" />
                          <path d="M21 21l-4.35-4.35" />
                        </>
                      )}
                    </svg>
                    {/* Active filters badge - only show when closed */}
                    {!isFiltersDialogOpen && getActiveFiltersCount() > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-blue-900 rounded-full transform translate-x-1/2 -translate-y-1/2">
                        {getActiveFiltersCount() > 99 ? '99+' : getActiveFiltersCount()}
                      </span>
                    )}
                  </div>
                </button>
              )}
              {/* AI Assistant - Only show for authenticated users */}
              {user && <AssistantButton userRoles={userRoles}/>}
              {/* Notification Bell - Only show for authenticated users */}
              {user && <NotificationBell />}
              <NavigationMenu
                onOpenLogin={() => {
                  // Close assistant dialog before opening login
                  if (isAssistantOpen && closeAssistant) {
                    logger.debug('[Header] 📊 Closing assistant dialog for login');
                    closeAssistant();
                  }
                  // On mobile, navigate to login page; on desktop, open modal
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    router.push('/auth/login');
                  } else {
                    setIsLoginModalOpen(true);
                  }
                }}
                onOpenSignup={() => {
                  // Close assistant dialog before opening signup
                  if (isAssistantOpen && closeAssistant) {
                    logger.debug('[Header] 📊 Closing assistant dialog for signup');
                    closeAssistant();
                  }
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
        buttonRef={filtersButtonRef}
      />
    </>
  );
}
