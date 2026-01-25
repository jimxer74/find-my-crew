'use client';

import { useState, useEffect, useRef } from 'react';
import { LogoWithText } from './LogoWithText';
import { NavigationMenu } from './NavigationMenu';
import { LoginModal } from './LoginModal';
import { SignupModal } from './SignupModal';
import { FiltersDialog } from './FiltersDialog';
import { NotificationBell } from './notifications/NotificationBell';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

export function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useAuth();
  const { filters, updateFilters } = useFilters();
  const [userRole, setUserRole] = useState<'owner' | 'crew' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);

  // Get user role for Filters button visibility
  useEffect(() => {
    if (user) {
      setRoleLoading(true);
      // Try to get role from user metadata first (faster, synchronous)
      const roleFromMetadata = user.user_metadata?.role as 'owner' | 'crew' | null;
      if (roleFromMetadata) {
        setUserRole(roleFromMetadata);
        setRoleLoading(false);
        return; // Early return if we have metadata
      }
      
      // Fetch from database if no metadata available
      const supabase = getSupabaseBrowserClient();
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserRole(data.role);
          } else {
            // If no profile exists yet, default to crew (most common case)
            setUserRole('crew');
          }
          setRoleLoading(false);
        })
        .catch(() => {
          // If query fails, default to crew
          setUserRole('crew');
          setRoleLoading(false);
        });
    } else {
      setUserRole(null);
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
      <nav className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LogoWithText />
            </div>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              {user && (userRole === 'crew' || (userRole === null && roleLoading)) && (
                <button
                  onClick={() => setIsFiltersDialogOpen(true)}
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
                    Filters
                  </span>
                </button>
              )}
              {/* Notification Bell - Only show for authenticated users */}
              {user && <NotificationBell />}
              <NavigationMenu
                onOpenLogin={() => setIsLoginModalOpen(true)}
                onOpenSignup={() => setIsSignupModalOpen(true)}
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
