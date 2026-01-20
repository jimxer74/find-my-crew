'use client';

import { useState, useEffect, useRef } from 'react';
import { LogoWithText } from './LogoWithText';
import { NavigationMenu } from './NavigationMenu';
import { LoginModal } from './LoginModal';
import { SignupModal } from './SignupModal';
import { DateRangePicker, DateRange } from './ui/DateRangePicker';
import { FiltersDialog } from './FiltersDialog';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

export function Header() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<'owner' | 'crew' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const datePickerDialogRef = useRef<HTMLDivElement>(null);

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

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerDialogRef.current && 
        !datePickerDialogRef.current.contains(event.target as Node) &&
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);

  const formatDateRange = () => {
    if (!dateRange.start && !dateRange.end) {
      return 'When?';
    }
    if (dateRange.start && dateRange.end) {
      const startStr = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    if (dateRange.start) {
      return dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return 'When?';
  };

  return (
    <>
      <nav className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LogoWithText />
            </div>
            <div className="flex items-center gap-2">
              {/* Date Range Picker - icon only on mobile, full button on md+ */}
              <div className="relative" ref={datePickerRef}>
                <button
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-md border border-border bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm"
                  aria-label="Select date range"
                >
                  <svg
                    className="w-4 h-4 text-foreground"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap hidden md:inline">
                    {formatDateRange()}
                  </span>
                </button>
                {isDatePickerOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 bg-black/20 z-40"
                      onClick={() => setIsDatePickerOpen(false)}
                    />
                    {/* Centered DateRangePicker */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none py-4">
                      <div 
                        ref={datePickerDialogRef}
                        className="pointer-events-auto my-auto max-h-[calc(100vh-2rem)] overflow-y-auto"
                      >
                        <DateRangePicker
                          value={dateRange}
                          onChange={setDateRange}
                          onClose={() => setIsDatePickerOpen(false)}
                          disableClickOutside={true}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {user && (userRole === 'crew' || (userRole === null && roleLoading)) && (
                <button
                  onClick={() => setIsFiltersDialogOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  aria-label="Filters"
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
                    <line x1="4" y1="6" x2="16" y2="6" />
                    <circle cx="19" cy="6" r="2" fill="none" />
                    <line x1="4" y1="12" x2="16" y2="12" />
                    <circle cx="5" cy="12" r="2" fill="none" />
                    <line x1="4" y1="18" x2="16" y2="18" />
                    <circle cx="19" cy="18" r="2" fill="none" />
                  </svg>
                  <span className="text-sm font-medium text-foreground hidden sm:inline">Filters</span>
                </button>
              )}
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
