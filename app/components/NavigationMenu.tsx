'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';

type NavigationMenuProps = {
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
};

type NavigationMenuContentProps = {
  onClose?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
};

export function NavigationMenu({ onOpenLogin, onOpenSignup }: NavigationMenuProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Listen for close all dialogs event
  useEffect(() => {
    const handleCloseAll = () => {
      setIsOpen(false);
    };
    window.addEventListener('closeAllDialogs', handleCloseAll);
    return () => {
      window.removeEventListener('closeAllDialogs', handleCloseAll);
    };
  }, []);

  // Close menu when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only handle click-outside on desktop (md breakpoint = 768px)
      if (window.innerWidth < 768) return;

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/');
    router.refresh();
  };

  // Get user roles for dashboard link
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const loadUserRoles = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (data && data.roles) {
      setUserRoles(data.roles);
    } else {
      setUserRoles([]);
    }
  }, [user]);

  useEffect(() => {
    loadUserRoles();
  }, [loadUserRoles]);

  // Listen for profile update events
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadUserRoles();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [loadUserRoles]);

  // Refresh roles when menu opens
  useEffect(() => {
    if (isOpen && user) {
      loadUserRoles();
    }
  }, [isOpen, loadUserRoles]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => {
          // On mobile, navigate to menu page; on desktop, toggle modal
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            router.push('/menu');
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6 text-foreground"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Menu Panel - only render when open */}
      {isOpen && (
        <>
          {/* Backdrop - desktop only */}
          <div
            className="hidden md:block fixed inset-0 top-[4rem] bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu - full page on mobile (like normal page), dropdown dialog on desktop */}
          <div className="fixed left-0 right-0 md:left-auto md:right-4 top-[4rem] md:top-[5rem] w-full md:w-[280px] h-[calc(100vh-4rem)] md:h-auto md:max-h-[calc(100vh-6rem)] bg-background md:bg-card md:border md:border-border md:rounded-lg md:shadow-lg z-[105] overflow-hidden flex flex-col pointer-events-auto">
            {/* Header - only visible on desktop */}
            <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <h2 className="text-lg font-semibold text-foreground">Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-accent rounded-md transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5 text-foreground"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu content */}
            <NavigationMenuContent
              onClose={() => setIsOpen(false)}
              onOpenLogin={onOpenLogin}
              onOpenSignup={onOpenSignup}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Content component that can be used in both modal and page modes
export function NavigationMenuContent({ onClose, onOpenLogin, onOpenSignup }: NavigationMenuContentProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMenuPage = pathname === '/menu';
  
  // Get user roles for dashboard link
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const loadUserRoles = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (data && data.roles) {
      setUserRoles(data.roles);
    } else {
      setUserRoles([]);
    }
  }, [user]);

  useEffect(() => {
    loadUserRoles();
  }, [loadUserRoles]);

  // Listen for profile update events
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadUserRoles();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [loadUserRoles]);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    onClose?.();
    router.push('/');
    router.refresh();
  };

  // Helper function to handle navigation on mobile menu page
  const handleNavClick = (href: string, e?: React.MouseEvent) => {
    // Prevent default if event is provided (for Link components)
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Close dialog first
    onClose?.();
    // Dispatch event to close all dialogs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('closeAllDialogs'));
    }
    // Navigate immediately - router.push will handle the navigation
    // Use setTimeout to ensure dialogs are closed before navigation
    setTimeout(() => {
      router.push(href);
    }, 50);
  };

  return (
    <div className="flex-1 overflow-y-auto py-2" data-navigation-menu>
      {loading ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
      ) : user ? (
        <>
          {/* My Profile */}
          {isMenuPage ? (
            <button
              onClick={() => handleNavClick('/profile')}
              className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
            >
              <svg
                className="w-5 h-5 mr-3 text-muted-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">My Profile</span>
            </button>
          ) : (
            <Link
              href="/profile"
              onClick={(e) => handleNavClick('/profile', e)}
              className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
            >
              <svg
                className="w-5 h-5 mr-3 text-muted-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">My Profile</span>
            </Link>
          )}

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Owner-specific menu items */}
          {userRoles.includes('owner') && (
            <>
              {/* For Skipper header */}
              <div className="px-4 py-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">For Skipper</span>
              </div>
              {/* My Boats */}
              {isMenuPage ? (
                <button
                  onClick={() => handleNavClick('/owner/boats')}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span className="font-medium">My Boats</span>
                </button>
              ) : (
                <Link
                  href="/owner/boats"
                  onClick={(e) => handleNavClick('/owner/boats', e)}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span className="font-medium">My Boats</span>
                </Link>
              )}

              {/* My Journeys */}
              {isMenuPage ? (
                <button
                  onClick={() => handleNavClick('/owner/journeys')}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span className="font-medium">My Journeys</span>
                </button>
              ) : (
                <Link
                  href="/owner/journeys"
                  onClick={(e) => handleNavClick('/owner/journeys', e)}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span className="font-medium">My Journeys</span>
                </Link>
              )}

              {/* My Crew */}
              {isMenuPage ? (
                <button
                  onClick={() => handleNavClick('/owner/registrations')}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">My Crew</span>
                </button>
              ) : (
                <Link
                  href="/owner/registrations"
                  onClick={(e) => handleNavClick('/owner/registrations', e)}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">My Crew</span>
                </Link>
              )}
            </>
          )}

          {/* Crew-specific menu items */}
          {userRoles.includes('crew') && (
            <>
              {/* For Crew header */}
              <div className="px-4 py-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">For Crew</span>
              </div>
              {/* Browse Journeys */}
              {isMenuPage ? (
                <button
                  onClick={() => handleNavClick('/crew/dashboard')}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span className="font-medium">Browse Journeys</span>
                </button>
              ) : (
                <Link
                  href="/crew/dashboard"
                  onClick={(e) => handleNavClick('/crew/dashboard', e)}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  <span className="font-medium">Browse Journeys</span>
                </Link>
              )}
              {/* My Registrations */}
              {isMenuPage ? (
                <button
                  onClick={() => handleNavClick('/crew/registrations')}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">My Registrations</span>
                </button>
              ) : (
                <Link
                  href="/crew/registrations"
                  onClick={(e) => handleNavClick('/crew/registrations', e)}
                  className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-3 text-muted-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium">My Registrations</span>
                </Link>
              )}
            </>
          )}

          {/* Show message if user has no roles */}
          {userRoles.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Complete your profile and select roles to access features.
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors text-left"
          >
            <svg
              className="w-5 h-5 mr-3 text-muted-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Sign out</span>
          </button>
        </>
      ) : (
        <>
          {/* Browse Journeys - Available to non-signed-in users */}
          {isMenuPage ? (
            <button
              onClick={() => handleNavClick('/crew/dashboard')}
              className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors w-full text-left"
            >
              <svg
                className="w-5 h-5 mr-3 text-muted-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span className="font-medium">Browse Journeys</span>
            </button>
          ) : (
            <Link
              href="/crew/dashboard"
              onClick={(e) => handleNavClick('/crew/dashboard', e)}
              className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
            >
              <svg
                className="w-5 h-5 mr-3 text-muted-foreground"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span className="font-medium">Browse Journeys</span>
            </Link>
          )}

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Log in */}
          <Link
            href="/auth/login"
            onClick={(e) => {
              // On mobile (menu overlay or menu page), always navigate
              // On desktop (dropdown menu), open modal instead
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobile || isMenuPage) {
                // Let Link handle navigation naturally, but close menu first
                //onClose?.();
                //if (typeof window !== 'undefined') {
                //  window.dispatchEvent(new CustomEvent('closeAllDialogs'));
                //}
                router.push('/auth/login');
              } else {
                // Desktop: prevent navigation and open modal
                e.preventDefault();
                onClose?.();
                onOpenLogin?.();
              }
            }}
            className="w-full flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
          >
            <svg
              className="w-5 h-5 mr-3 text-muted-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span className="font-medium">Log in</span>
          </Link>
          
          {/* Sign up */}
          <Link
            href="/auth/signup"
            onClick={(e) => {
              // On mobile (menu overlay or menu page), always navigate
              // On desktop (dropdown menu), open modal instead
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobile || isMenuPage) {
                // Let Link handle navigation naturally, but close menu first
                //onClose?.();
                //if (typeof window !== 'undefined') {
                //  window.dispatchEvent(new CustomEvent('closeAllDialogs'));
                //}
                router.push('/auth/signup');
              } else {
                // Desktop: prevent navigation and open modal
                e.preventDefault();
                onClose?.();
                onOpenSignup?.();
              }
            }}
            className="w-full flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
          >
            <svg
              className="w-5 h-5 mr-3 text-muted-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="font-medium">Sign up</span>
          </Link>
        </>
      )}
    </div>
  );
}
