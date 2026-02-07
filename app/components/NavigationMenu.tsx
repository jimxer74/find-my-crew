'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/app/components/ui/ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';

type NavigationMenuProps = {
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
};

type NavigationMenuContentProps = {
  onClose?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
};
// Helper function to get initials from full name
function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};


export function NavigationMenu({ onOpenLogin, onOpenSignup }: NavigationMenuProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking on the button or the panel
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
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
    <div>
      {/* Hamburger Menu Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          // Toggle panel on both mobile and desktop
          setIsOpen(!isOpen);
        }}
        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md focus:outline-none cursor-pointer"
        aria-label="Toggle menu"
      >

        {user ? (           
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary hover:bg-primary/80 text-primary-foreground font-semibold text-sm mr-3 flex-shrink-0">
            {getInitials(user.user_metadata.full_name)}
          </div>
        
      ) : (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
           <circle cx="12" cy="12" r="11" fill="white" stroke="currentColor" strokeWidth="2"/>
           <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
           <path d="M 6 18 Q 6 14 12 14 Q 18 14 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}

      </button>

      {/* Menu Panel - only render when open, use portal to render outside Header DOM */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="fixed top-16 bottom-0 right-0 w-full md:w-60 lg:w-80 bg-card border-l border-border shadow-xl z-[120] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center px-4 py-3 border-b border-border bg-card">
            {/* Close button - mobile only */}
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-2 -ml-2 mr-2 hover:bg-accent rounded-md transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-foreground">Menu</h2>
          </div>

          {/* Menu content - scrollable */}
          <div className="flex-1 overflow-y-auto">
            <NavigationMenuContent
              onClose={() => setIsOpen(false)}
              onOpenLogin={onOpenLogin}
              onOpenSignup={onOpenSignup}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Content component that can be used in both modal and page modes
export function NavigationMenuContent({ onClose, onOpenLogin, onOpenSignup }: NavigationMenuContentProps) {
  const t = useTranslations('navigation');
  const tAuth = useTranslations('auth');
  const tSettings = useTranslations('settings');
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMenuPage = pathname === '/menu';

  // Get user roles and profile data
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [fullName, setFullName] = useState<string>('');

  const loadUserRoles = useCallback(async () => {
    if (!user) {
      setUserRoles([]);
      setFullName('');
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from('profiles')
      .select('roles, full_name')
      .eq('id', user.id)
      .single();

    if (data) {
      setUserRoles(data.roles || []);
      setFullName(data.full_name || '');
    } else {
      setUserRoles([]);
      setFullName('');
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
    <div className="bg-card py-2" data-navigation-menu>


      {loading ? (
        <div className="px-4 py-3 text-sm text-muted-foreground">{t('loading') || 'Loading...'}</div>
      ) : user ? (
        <>
     
          {/* My Profile */}
            <Link
              href="/profile"
              onClick={(e) => handleNavClick('/profile', e)}
              className="flex items-center px-4 py-3 min-h-[44px] text-card-foreground hover:bg-accent transition-colors"
            >
                <div className="flex items-center gap-3">
                <div>
                   <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                
  
                {/* Name + Email stacked vertically */}
                <div className="flex flex-col min-w-0">
                <span className="font-medium">{t('myProfile')}</span>  
                <span className="text-xs text-muted-foreground truncate">
                {fullName || t('myProfile')}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                {user.email}
                </span>
                </div>
                </div>
            </Link>

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Owner-specific menu items */}
          {userRoles.includes('owner') && (
            <>
              {/* For Skipper header */}
              <div className="px-4 py-2">
                <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">{t('forSkipper')}</span>
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
                  <span className="font-medium">{t('myBoats')}</span>
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
                  <span className="font-medium">{t('myBoats')}</span>
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
                  <span className="font-medium">{t('myJourneys')}</span>
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
                  <span className="font-medium">{t('myJourneys')}</span>
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
                  <span className="font-medium">{t('myCrew')}</span>
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
                  <span className="font-medium">{t('myCrew')}</span>
                </Link>
              )}
            </>
          )}

          {/* Crew-specific menu items */}
          {userRoles.includes('crew') && (
            <>
              {/* For Crew header */}
              <div className="px-4 py-2">
                <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">{t('forCrew')}</span>
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
                  <span className="font-medium">{t('browseJourneys')}</span>
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
                  <span className="font-medium">{t('browseJourneys')}</span>
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
                  <span className="font-medium">{t('myRegistrations')}</span>
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
                  <span className="font-medium">{t('myRegistrations')}</span>
                </Link>
              )}
            </>
          )}

          {/* Show message if user has no roles */}
          {userRoles.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {t('completeProfile')}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border my-1" />

          {/* Feedback */}
          { user && isMenuPage ? (
            <button
              onClick={() => handleNavClick('/feedback')}
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
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{t('feedback')}</span>
            </button>
          ) : user && (
            <Link
              href="/feedback"
              onClick={(e) => handleNavClick('/feedback', e)}
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
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{t('feedback')}</span>
            </Link>
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
            <span className="font-medium">{t('signOut')}</span>
          </button>

          {/* Divider */}
          <div className="border-t border-border my-1" />
          {/* Language Switcher - LAst item */}
          <div className="px-4 py-2">
            <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">{tSettings('language.title')}</span>
          </div>
          <div className="px-4">
            <LanguageSwitcher variant="menu-item" onClose={onClose} />
          </div>

          {/* Appearance / Theme */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">{t('appearance')}</span>
            </div>
            <div className="flex items-center justify-between">
              <ThemeToggle variant="segmented" />
            </div>
          </div>

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
              <span className="font-medium">{t('browseJourneys')}</span>
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
              <span className="font-medium">{t('browseJourneys')}</span>
            </Link>
          )}

          {/* Feedback - Available to non-signed-in users */}
          { user && isMenuPage ? (
            <button
              onClick={() => handleNavClick('/feedback')}
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
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{t('feedback')}</span>
            </button>
          ) : user && (
            <Link
              href="/feedback"
              onClick={(e) => handleNavClick('/feedback', e)}
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
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{t('feedback')}</span>
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
            <span className="font-medium">{t('login')}</span>
          </Link>

          {/* Sign up */}
          <Link
            href="/auth/signup"
            onClick={(e) => {
              // On mobile (menu overlay or menu page), always navigate
              // On desktop (dropdown menu), open modal instead
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobile || isMenuPage) {
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
            <span className="font-medium">{t('signUp')}</span>
          </Link>

          {/* Divider */}
          <div className="border-t border-border my-1" />
          {/* Language Switcher - LAst item */}
          <div className="px-4 py-2">
            <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">{tSettings('language.title')}</span>
          </div>
          <div className="px-4">
            <LanguageSwitcher variant="menu-item" onClose={onClose} />
          </div>

          {/* Appearance / Theme */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between pb-2">
            <span className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider">{t('appearance')}</span>
            </div>
            <div className="flex items-center justify-between">
              <ThemeToggle variant="segmented"/>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
