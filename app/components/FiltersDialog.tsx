'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { useFilters } from '@/app/contexts/FilterContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { LocationAutocomplete, Location } from './ui/LocationAutocomplete';
import { RiskLevelSelector } from './ui/RiskLevelSelector';
import { SkillLevelSelector } from './ui/SkillLevelSelector';
import { DateRangePicker, DateRange } from './ui/DateRangePicker';
import { ExperienceLevel } from '@/app/types/experience-levels';

type FiltersDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
};

type FiltersPageContentProps = {
  onClose: () => void;
};

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

export function FiltersDialog({ isOpen, onClose, buttonRef }: FiltersDialogProps) {
  const t = useTranslations('common');
  const dialogRef = useRef<HTMLDivElement>(null);
  const { clearFilters } = useFilters();

  // Close dialog when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Don't close if clicking on the button or the dialog
      if (buttonRef?.current?.contains(target) || dialogRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCancel = () => {
    onClose();
  };

  // Don't render at all if not open - this prevents blocking
  if (!isOpen) return null;

  // Use portal to render outside Header DOM
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed top-16 bottom-0 right-0 w-full md:w-96 lg:w-[28rem] bg-card border-l border-border shadow-xl z-[120] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center">
          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-2 -ml-2 mr-2 hover:bg-accent rounded-md transition-colors"
            aria-label={t('close')}
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-foreground">{t('search')}</h2>
        </div>
        <button
          onClick={clearFilters}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('clearAll')}
        >
          {t('clearAll')}
        </button>
      </div>

      {/* Content - FiltersPageContent handles its own scrolling */}
      <FiltersPageContent onClose={handleCancel} />
    </div>,
    document.body
  );
}

// Content component that can be used in both modal and page modes
export function FiltersPageContent({ onClose }: FiltersPageContentProps) {
  const t = useTranslations('common');
  const tFilters = useTranslations('journeys.browse.filters');
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { filters, updateFilters } = useFilters();
  const datePickerDialogRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Temporary filter state (for editing before save)
  const [tempLocation, setTempLocation] = useState<Location | null>(null);
  const [tempLocationInput, setTempLocationInput] = useState('');
  const [tempArrivalLocation, setTempArrivalLocation] = useState<Location | null>(null);
  const [tempArrivalLocationInput, setTempArrivalLocationInput] = useState('');
  const [tempRiskLevel, setTempRiskLevel] = useState<RiskLevel[]>([]);
  const [tempExperienceLevel, setTempExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [tempDateRange, setTempDateRange] = useState<DateRange>(filters.dateRange);
  
  // Profile values (from database, for indicators)
  const [profileValues, setProfileValues] = useState<{
    riskLevel: RiskLevel[];
    experienceLevel: ExperienceLevel | null;
  }>({
    riskLevel: [],
    experienceLevel: null,
  });

  // Load user profile data and initialize temp state from filters
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Initialize temp state from filters when component mounts or filters change
  useEffect(() => {
    setTempLocation(filters.location);
    setTempLocationInput(filters.locationInput);
    setTempArrivalLocation(filters.arrivalLocation);
    setTempArrivalLocationInput(filters.arrivalLocationInput);
    setTempRiskLevel(filters.riskLevel);
    setTempExperienceLevel(filters.experienceLevel);
    setTempDateRange(filters.dateRange);
  }, [filters]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    
    try {
      // Load profile values (for indicators)
      const { data, error } = await supabase
        .from('profiles')
        .select('sailing_experience, risk_level')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        const profileRiskLevel = (data.risk_level || []) as RiskLevel[];
        const profileExperienceLevel = data.sailing_experience as ExperienceLevel | null;
        
        setProfileValues({
          riskLevel: profileRiskLevel,
          experienceLevel: profileExperienceLevel,
        });
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerDialogRef.current && 
        !datePickerDialogRef.current.contains(event.target as Node)
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
    if (!tempDateRange.start && !tempDateRange.end) {
      return tFilters('availability');
    }
    if (tempDateRange.start && tempDateRange.end) {
      const startStr = tempDateRange.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endStr = tempDateRange.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    if (tempDateRange.start) {
      return tempDateRange.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return tFilters('availability');
  };

  const handleSave = () => {
    // Save to context (which persists to session storage)
    updateFilters({
      location: tempLocation,
      locationInput: tempLocationInput,
      arrivalLocation: tempArrivalLocation,
      arrivalLocationInput: tempArrivalLocationInput,
      riskLevel: tempRiskLevel,
      experienceLevel: tempExperienceLevel,
      dateRange: tempDateRange,
    });
    
    setWarningMessage(null);
    onClose();
    
    // Dispatch custom event to trigger reload in CrewBrowseMap
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('filtersUpdated'));
    }
    
    // Navigate to crew dashboard if not already there
    if (pathname !== '/crew/dashboard') {
      router.push('/crew/dashboard');
    }
  };

  const handleCancel = () => {
    // Revert temp state to current filters
    setTempLocation(filters.location);
    setTempLocationInput(filters.locationInput);
    setTempRiskLevel(filters.riskLevel);
    setTempExperienceLevel(filters.experienceLevel);
    setTempDateRange(filters.dateRange);
    setWarningMessage(null);
    onClose();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">{t('loading')}</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Card 1: When, Where from, Where to */}
              <div className="bg-card rounded-lg border border-border shadow-sm p-4 space-y-4">
                {/* Date Range Picker */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {tFilters('availability')}
                  </label>
                  <div className="relative group">
                    <button
                      onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                      className="flex items-center gap-2 w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm"
                      aria-label={tFilters('selectDateRange')}
                    >
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${
                          tempDateRange.start || tempDateRange.end
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
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
                      <span className={`text-sm font-medium flex-1 text-left ${
                        tempDateRange.start || tempDateRange.end
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}>
                        {formatDateRange()}
                      </span>
                    </button>
                    {(tempDateRange.start || tempDateRange.end) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempDateRange({ start: null, end: null });
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-background border border-border opacity-0 group-hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-opacity shadow-sm"
                        aria-label={tFilters('clearDateRange')}
                      >
                        <svg
                          className="w-4 h-4 text-muted-foreground hover:text-foreground"
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
                    )}
                  </div>
                  {isDatePickerOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 bg-black/20 z-[9998]"
                        onClick={() => setIsDatePickerOpen(false)}
                      />
                      {/* Centered DateRangePicker */}
                      <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-2 sm:py-4">
                        <div
                          ref={datePickerDialogRef}
                          className="relative z-[9999] pointer-events-auto my-auto max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto w-full max-w-sm lg:max-w-4xl"
                        >
                          <DateRangePicker
                            value={tempDateRange}
                            onChange={(newRange) => {
                              setTempDateRange(newRange);
                            }}
                            onClose={() => setIsDatePickerOpen(false)}
                            disableClickOutside={true}
                            isInDialog={true}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Departure Location Autocomplete */}
                <div className="group">
                  <div className="relative">
                    <LocationAutocomplete
                      id="filter-departure-location"
                      label={tFilters('departureLocation')}
                      value={tempLocationInput}
                      onChange={(loc) => {
                        setTempLocation(loc);
                        setTempLocationInput(loc.name);
                      }}
                      onInputChange={(value) => {
                        setTempLocationInput(value);
                        if (!value) {
                          setTempLocation(null);
                        }
                      }}
                      placeholder={tFilters('departureLocationPlaceholder')}
                    />
                    {tempLocation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempLocation(null);
                          setTempLocationInput('');
                        }}
                        className="absolute right-2 top-[2.25rem] p-1 rounded-md bg-background border border-border opacity-0 group-hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-opacity shadow-sm z-10"
                        aria-label={tFilters('clearLocation')}
                        type="button"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground"
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
                    )}
                  </div>
                </div>

                {/* Arrival Location Autocomplete */}
                <div className="group">
                  <div className="relative">
                    <LocationAutocomplete
                      id="filter-arrival-location"
                      label={tFilters('arrivalLocation')}
                      value={tempArrivalLocationInput}
                      onChange={(loc) => {
                        setTempArrivalLocation(loc);
                        setTempArrivalLocationInput(loc.name);
                      }}
                      onInputChange={(value) => {
                        setTempArrivalLocationInput(value);
                        if (!value) {
                          setTempArrivalLocation(null);
                        }
                      }}
                      placeholder={tFilters('arrivalLocationPlaceholder')}
                    />
                    {tempArrivalLocation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempArrivalLocation(null);
                          setTempArrivalLocationInput('');
                        }}
                        className="absolute right-2 top-[2.25rem] p-1 rounded-md bg-background border border-border opacity-0 group-hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-opacity shadow-sm z-10"
                        aria-label={tFilters('clearArrivalLocation')}
                        type="button"
                      >
                        <svg
                          className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground"
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
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Experience Level */}
              <div className="bg-card rounded-lg border border-border shadow-sm p-4">
                <SkillLevelSelector
                  value={tempExperienceLevel}
                  onChange={setTempExperienceLevel}
                  profileValue={profileValues.experienceLevel}
                  showProfileIndicator={true}
                  showWarning={true}
                  onWarning={setWarningMessage}
                />
                {warningMessage && (
                  <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">{warningMessage}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Risk Level */}
              <div className="bg-card rounded-lg border border-border shadow-sm p-4">
                <RiskLevelSelector
                  value={tempRiskLevel}
                  onChange={(value) => {
                    if (Array.isArray(value)) {
                      setTempRiskLevel(value);
                    } else {
                      setTempRiskLevel(value ? [value] : []);
                    }
                  }}
                  profileValue={profileValues.riskLevel}
                  showProfileIndicator={true}
                />
              </div>

            </div>
          )}
        </div>

      {/* Action button - sticky footer */}
      <div className="flex-shrink-0 flex items-center justify-center p-4 border-t border-border bg-card">
        <button
          onClick={handleSave}
          className="px-6 py-3 min-h-[44px] text-sm font-medium text-background bg-foreground hover:opacity-90 rounded-md transition-opacity"
        >
          {tFilters('saveAndSearch')}
        </button>
      </div>
    </div>
  );
}
