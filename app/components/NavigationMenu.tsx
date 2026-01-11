'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export function NavigationMenu() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/');
    router.refresh();
  };

  // Get user role for dashboard link
  const [userRole, setUserRole] = useState<'owner' | 'crew' | null>(null);

  useEffect(() => {
    if (user) {
      const supabase = getSupabaseBrowserClient();
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserRole(data.role);
          }
        });
    }
  }, [user]);

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
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

      {/* Overlay Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 top-12 w-64 bg-card rounded-lg shadow-xl z-50 border border-border overflow-hidden">
            <div className="py-2">
              {loading ? (
                <div className="px-4 py-3 text-sm text-muted-foreground">Loading...</div>
              ) : user ? (
                <>
                  {/* My Profile */}
                  <Link
                    href="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center px-4 py-3 text-card-foreground hover:bg-accent transition-colors"
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

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-1" />

                  {/* Owner-specific menu items */}
                  {userRole === 'owner' ? (
                    <>
                      {/* My Boats */}
                      <Link
                        href="/owner/boats"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center px-4 py-3 text-card-foreground hover:bg-accent transition-colors"
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

                      {/* My Journeys */}
                      <Link
                        href="/owner/journeys"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center px-4 py-3 text-card-foreground hover:bg-accent transition-colors"
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
                        <span className="font-medium">My Journeys & Legs</span>
                      </Link>
                    </>
                  ) : (
                    /* Crew Dashboard */
                    <Link
                      href="/crew/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center px-4 py-3 text-card-foreground hover:bg-accent transition-colors"
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
                      <span className="font-medium">My Dashboard</span>
                    </Link>
                  )}

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-1" />

                  {/* Sign out */}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-3 text-card-foreground hover:bg-accent transition-colors text-left"
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
                  {/* Sign in */}
                  <Link
                    href="/auth/login"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center px-4 py-3 text-card-foreground hover:bg-accent transition-colors"
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
                    <span className="font-medium">Sign in</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
