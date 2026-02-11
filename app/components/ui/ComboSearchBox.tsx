'use client';

import { useState, useEffect, useRef } from 'react';
import { LocationAutocomplete, type Location } from './LocationAutocomplete';
import { DateRangePicker, type DateRange } from './DateRangePicker';

export interface ComboSearchData {
  whereFrom: {
    name: string;
    lat: number;
    lng: number;
    isCruisingRegion?: boolean;
    bbox?: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  } | null;
  whereTo: {
    name: string;
    lat: number;
    lng: number;
    isCruisingRegion?: boolean;
    bbox?: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  } | null;
  availability: {
    freeText: string;
    dateRange: DateRange | null;
  };
  profile: string;
}

interface ComboSearchBoxProps {
  onSubmit: (data: ComboSearchData) => void;
  className?: string;
  onFocusChange?: (isFocused: boolean) => void;
  isFocusedControlled?: boolean; // If true, parent controls focus state
}

// Profile Dialog Component
function ProfileDialog({
  isOpen,
  onClose,
  value,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onSave: (profile: string) => void;
}) {
  const [profileText, setProfileText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setProfileText(value);
  }, [value]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(profileText);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="profile-dialog-title" className="text-lg font-semibold text-gray-900">
            Add Profile Information
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            ref={textareaRef}
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder="Paste your profile or describe your sailing experience..."
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Desktop ComboSearchBox Component
function DesktopComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled }: ComboSearchBoxProps) {
  const [whereFrom, setWhereFrom] = useState<Location | null>(null);
  const [whereTo, setWhereTo] = useState<Location | null>(null);
  const [availabilityFreeText, setAvailabilityFreeText] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [profile, setProfile] = useState('');
  const [focusedSegment, setFocusedSegment] = useState<'whereFrom' | 'whereTo' | 'availability' | 'profile' | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [whereFromInputValue, setWhereFromInputValue] = useState('');
  const [whereToInputValue, setWhereToInputValue] = useState('');
  const whereFromInputRef = useRef<HTMLInputElement>(null);
  const whereToInputRef = useRef<HTMLInputElement>(null);

  // Initialize input values when segments are focused
  useEffect(() => {
    if (focusedSegment === 'whereFrom' && !whereFromInputValue) {
      setWhereFromInputValue(whereFrom?.name || '');
    }
    if (focusedSegment === 'whereTo' && !whereToInputValue) {
      setWhereToInputValue(whereTo?.name || '');
    }
  }, [focusedSegment]);

  // Focus input when segment becomes focused
  useEffect(() => {
    if (focusedSegment === 'whereFrom' && whereFromInputRef.current) {
      // Use requestAnimationFrame and setTimeout to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          whereFromInputRef.current?.focus();
        }, 0);
      });
    }
    if (focusedSegment === 'whereTo' && whereToInputRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          whereToInputRef.current?.focus();
        }, 0);
      });
    }
  }, [focusedSegment]);

  // Notify parent when focus state changes
  useEffect(() => {
    const isFocused = focusedSegment !== null || isProfileDialogOpen || isDatePickerOpen;
    if (!isFocusedControlled) {
      onFocusChange?.(isFocused);
    }
  }, [focusedSegment, isProfileDialogOpen, isDatePickerOpen, onFocusChange, isFocusedControlled]);

  // Clear focus when parent requests it (via isFocusedControlled)
  useEffect(() => {
    if (isFocusedControlled && focusedSegment !== null) {
      setFocusedSegment(null);
      setIsProfileDialogOpen(false);
      setIsDatePickerOpen(false);
    }
  }, [isFocusedControlled, focusedSegment]);

  const hasAnyValue = whereFrom || whereTo || availabilityFreeText || dateRange.start || profile;

  const formatAvailabilityDisplay = (): string => {
    const parts: string[] = [];
    if (dateRange.start && dateRange.end) {
      const startStr = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const endStr = dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      parts.push(`${startStr} - ${endStr}`);
    }
    if (availabilityFreeText) {
      parts.push(availabilityFreeText);
    }
    return parts.join(', ') || '';
  };

  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleSubmit = () => {
    const data: ComboSearchData = {
      whereFrom: whereFrom
        ? {
            name: whereFrom.name,
            lat: whereFrom.lat,
            lng: whereFrom.lng,
            isCruisingRegion: whereFrom.isCruisingRegion,
            bbox: whereFrom.bbox,
          }
        : null,
      whereTo: whereTo
        ? {
            name: whereTo.name,
            lat: whereTo.lat,
            lng: whereTo.lng,
            isCruisingRegion: whereTo.isCruisingRegion,
            bbox: whereTo.bbox,
          }
        : null,
      availability: {
        freeText: availabilityFreeText,
        dateRange: dateRange.start || dateRange.end ? dateRange : null,
      },
      profile,
    };
    onSubmit(data);
  };

  const clearSegment = (segment: 'whereFrom' | 'whereTo' | 'availability' | 'profile') => {
    switch (segment) {
      case 'whereFrom':
        setWhereFrom(null);
        setWhereFromInputValue('');
        break;
      case 'whereTo':
        setWhereTo(null);
        setWhereToInputValue('');
        break;
      case 'availability':
        setAvailabilityFreeText('');
        setDateRange({ start: null, end: null });
        break;
      case 'profile':
        setProfile('');
        break;
    }
  };

  return (
    <div className={`w-full max-w-full ${className}`}>
      <div className="relative flex items-stretch bg-white/95 backdrop-blur-sm border-0 rounded-xl shadow-lg overflow-visible h-[64px] w-full max-w-full">
        {/* Where From Segment */}
        <div
          className={`flex-1 relative h-[64px] flex flex-col min-w-0 overflow-visible ${focusedSegment === 'whereFrom' ? 'bg-blue-50 z-20' : ''}`}
        >
          {/* Divider with white space */}
          <div className="absolute right-0 top-2 bottom-2 w-px bg-gray-200" />
          {focusedSegment === 'whereFrom' ? (
            <div className="w-full px-3 pt-1.5 pb-0.5 flex flex-col h-full overflow-visible">
              <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Where from</label>
              <div className="flex-1 flex items-center -mt-0.5 min-w-0 relative overflow-visible">
                <LocationAutocomplete
                  value={whereFromInputValue}
                  onChange={(location) => {
                    setWhereFrom(location);
                    setWhereFromInputValue(location.name);
                    setFocusedSegment(null);
                  }}
                  onInputChange={(value) => {
                    setWhereFromInputValue(value);
                    // Clear location if user is typing something different
                    if (whereFrom && value !== whereFrom.name) {
                      setWhereFrom(null);
                    }
                  }}
                  placeholder="Where from"
                  className="border-0 w-full min-w-0 [&_input]:py-2 [&_input]:h-[40px] [&_input]:text-sm [&_input]:min-w-0 [&_input]:bg-transparent [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:text-gray-900 [&_input]:placeholder:text-gray-400 [&>div]:z-50"
                  autoFocus={true}
                  inputRef={whereFromInputRef}
                />
              </div>
            </div>
          ) : (
            <div
              className="w-full px-3 pt-1.5 pb-0.5 h-[64px] flex flex-col cursor-pointer overflow-hidden"
              onClick={() => {
                const currentValue = whereFrom?.name || '';
                setWhereFromInputValue(currentValue);
                setFocusedSegment('whereFrom');
              }}
            >
              <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Where from</label>
              <div className="flex-1 flex items-center min-w-0 -mt-0.5 overflow-hidden">
                {whereFrom ? (
                  <div className="flex items-center justify-between w-full group min-w-0 max-w-full overflow-hidden">
                    <span className="text-sm text-gray-900 block truncate flex-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {whereFrom.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSegment('whereFrom');
                      }}
                      className="ml-2 p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      aria-label="Clear"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Where To Segment */}
        <div
          className={`flex-1 relative h-[64px] flex flex-col min-w-0 overflow-visible ${focusedSegment === 'whereTo' ? 'bg-blue-50 z-20' : ''}`}
        >
          {/* Divider with white space */}
          <div className="absolute right-0 top-2 bottom-2 w-px bg-gray-200" />
          {focusedSegment === 'whereTo' ? (
            <div className="w-full px-3 pt-1.5 pb-0.5 flex flex-col h-full overflow-visible">
              <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Where to</label>
              <div className="flex-1 flex items-center -mt-0.5 min-w-0 relative overflow-visible">
                <LocationAutocomplete
                  value={whereToInputValue}
                  onChange={(location) => {
                    setWhereTo(location);
                    setWhereToInputValue(location.name);
                    setFocusedSegment(null);
                  }}
                  onInputChange={(value) => {
                    setWhereToInputValue(value);
                    // Clear location if user is typing something different
                    if (whereTo && value !== whereTo.name) {
                      setWhereTo(null);
                    }
                  }}
                  placeholder="Where to"
                  className="border-0 w-full min-w-0 [&_input]:py-2 [&_input]:h-[40px] [&_input]:text-sm [&_input]:min-w-0 [&_input]:bg-transparent [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:text-gray-900 [&_input]:placeholder:text-gray-400 [&>div]:z-50"
                  autoFocus={true}
                  inputRef={whereToInputRef}
                />
              </div>
            </div>
          ) : (
            <div
              className="w-full px-3 pt-1.5 pb-0.5 h-[64px] flex flex-col cursor-pointer overflow-hidden"
              onClick={() => {
                const currentValue = whereTo?.name || '';
                setWhereToInputValue(currentValue);
                setFocusedSegment('whereTo');
              }}
            >
              <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Where to</label>
              <div className="flex-1 flex items-center min-w-0 -mt-0.5 overflow-hidden">
                {whereTo ? (
                  <div className="flex items-center justify-between w-full group min-w-0 max-w-full overflow-hidden">
                    <span className="text-sm text-gray-900 block truncate flex-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {whereTo.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSegment('whereTo');
                      }}
                      className="ml-2 p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      aria-label="Clear"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Availability Segment */}
        <div
          className={`flex-1 relative h-[64px] flex flex-col min-w-0 overflow-hidden ${focusedSegment === 'availability' ? 'bg-blue-50' : ''}`}
        >
          {/* Divider with white space */}
          <div className="absolute right-0 top-2 bottom-2 w-px bg-gray-200" />
          {focusedSegment === 'availability' ? (
            <div className="w-full px-3 pt-1.5 pb-0.5 flex flex-col h-full overflow-hidden">
              <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Availability</label>
              <div className="flex-1 flex items-center -mt-0.5 min-w-0 overflow-hidden">
                <input
                  type="text"
                  value={availabilityFreeText}
                  onChange={(e) => setAvailabilityFreeText(e.target.value)}
                  onFocus={() => {
                    // Open date picker when text field is focused
                    setIsDatePickerOpen(true);
                  }}
                  placeholder="e.g., next summer, June to August"
                  className="w-full min-w-0 px-3 py-2 h-[40px] text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                  onBlur={() => {
                    // Delay to allow date picker interactions
                    setTimeout(() => {
                      if (!isDatePickerOpen) {
                        setFocusedSegment(null);
                      }
                    }, 200);
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              className="w-full px-3 pt-1.5 pb-0.5 h-[64px] flex flex-col cursor-pointer overflow-hidden"
              onClick={() => setFocusedSegment('availability')}
            >
              <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Availability</label>
              <div className="flex-1 flex items-center min-w-0 -mt-0.5 overflow-hidden">
                {availabilityFreeText || dateRange.start ? (
                  <div className="flex items-center justify-between w-full group min-w-0 max-w-full overflow-hidden">
                    <span className="text-sm text-gray-900 block truncate flex-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                      {formatAvailabilityDisplay()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSegment('availability');
                      }}
                      className="ml-2 p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      aria-label="Clear"
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Profile Segment */}
        <div
          className={`flex-1 relative h-[64px] flex flex-col min-w-0 overflow-hidden ${focusedSegment === 'profile' ? 'bg-blue-50' : ''}`}
        >
          {/* Divider with white space */}
          <div className="absolute right-0 top-2 bottom-2 w-px bg-gray-200" />
          <div
            className="w-full px-3 pt-1.5 pb-0.5 h-[64px] flex flex-col cursor-pointer overflow-hidden"
            onClick={() => {
              setFocusedSegment('profile');
              setIsProfileDialogOpen(true);
            }}
          >
            <label className="text-xs font-medium text-gray-500 mb-0 flex-shrink-0 text-left leading-tight">Profile</label>
            <div className="flex-1 flex items-center min-w-0 -mt-0.5 overflow-hidden">
              {profile ? (
                <div className="flex items-center w-full group min-w-0 overflow-hidden">
                  <span className="text-sm text-gray-900 truncate flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    {profile}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSegment('profile');
                    }}
                    className="ml-2 p-1 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    aria-label="Clear"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSubmit}
          disabled={!hasAnyValue}
          className="p-2.5 bg-blue-600 text-white rounded-r-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-[64px] min-w-[60px] flex items-center justify-center border border-white"
          aria-label="Search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* Profile Dialog */}
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => {
          setIsProfileDialogOpen(false);
          setFocusedSegment(null);
        }}
        value={profile}
        onSave={(newProfile) => {
          setProfile(newProfile);
          setFocusedSegment(null);
        }}
      />

      {/* Date Range Picker Dialog */}
      {isDatePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDatePickerOpen(false);
              setFocusedSegment(null);
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
              }}
              onClose={() => {
                setIsDatePickerOpen(false);
                setFocusedSegment(null);
              }}
              isInDialog={true}
              disableClickOutside={true}
              allowSingleDate={true}
            />
          </div>
        </div>
      )}

      {/* Click outside to close focused segments - but don't block input interactions */}
      {focusedSegment && focusedSegment !== 'profile' && (
        <div
          className="fixed inset-0 z-[5] pointer-events-none"
          onClick={(e) => {
            // Only close if clicking on the backdrop itself, not on any child elements
            if (e.target === e.currentTarget) {
              setFocusedSegment(null);
            }
          }}
        />
      )}
    </div>
  );
}

// Mobile Wizard Component
function MobileComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled }: ComboSearchBoxProps) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<1 | 2 | 3>(1);
  const [whereFrom, setWhereFrom] = useState<Location | null>(null);
  const [whereTo, setWhereTo] = useState<Location | null>(null);
  const [availabilityFreeText, setAvailabilityFreeText] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [profile, setProfile] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [whereFromInputValue, setWhereFromInputValue] = useState('');
  const [whereToInputValue, setWhereToInputValue] = useState('');

  // Notify parent when wizard opens/closes
  useEffect(() => {
    if (!isFocusedControlled) {
      onFocusChange?.(isWizardOpen);
    }
  }, [isWizardOpen, onFocusChange, isFocusedControlled]);

  // Close wizard when parent requests it (via isFocusedControlled)
  useEffect(() => {
    if (isFocusedControlled && isWizardOpen) {
      setIsWizardOpen(false);
    }
  }, [isFocusedControlled, isWizardOpen]);

  const handleWizardSubmit = () => {
    const data: ComboSearchData = {
      whereFrom: whereFrom
        ? {
            name: whereFrom.name,
            lat: whereFrom.lat,
            lng: whereFrom.lng,
            isCruisingRegion: whereFrom.isCruisingRegion,
            bbox: whereFrom.bbox,
          }
        : null,
      whereTo: whereTo
        ? {
            name: whereTo.name,
            lat: whereTo.lat,
            lng: whereTo.lng,
            isCruisingRegion: whereTo.isCruisingRegion,
            bbox: whereTo.bbox,
          }
        : null,
      availability: {
        freeText: availabilityFreeText,
        dateRange: dateRange.start || dateRange.end ? dateRange : null,
      },
      profile,
    };
    onSubmit(data);
    setIsWizardOpen(false);
    // Reset wizard state
    setCurrentPage(1);
    setWhereFrom(null);
    setWhereTo(null);
    setAvailabilityFreeText('');
    setDateRange({ start: null, end: null });
    setProfile('');
  };

  const canGoToNextPage = () => {
    switch (currentPage) {
      case 1:
        return whereFrom || whereTo;
      case 2:
        return true; // Availability is optional
      case 3:
        return true; // Profile is optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentPage < 3 && canGoToNextPage()) {
      setCurrentPage((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile Search Input */}
      <div className="relative">
        <input
          type="text"
          readOnly
          placeholder="Search for sailing opportunities..."
          className="w-full px-4 py-3 pr-14 text-sm text-gray-900 bg-white/95 backdrop-blur-sm border-0 rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 cursor-pointer"
          onClick={() => setIsWizardOpen(true)}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Search"
          onClick={() => setIsWizardOpen(true)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* Mobile Wizard Dialog */}
      {isWizardOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsWizardOpen(false);
            }
          }}
        >
          <div className="flex-1 bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                Step {currentPage} of 3
              </h2>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Page 1: Locations */}
              {currentPage === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Where from
                    </label>
                    <LocationAutocomplete
                      value={whereFromInputValue}
                      onChange={(location) => {
                        setWhereFrom(location);
                        setWhereFromInputValue(location.name);
                      }}
                      onInputChange={setWhereFromInputValue}
                      placeholder="Where from"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Where to
                    </label>
                    <LocationAutocomplete
                      value={whereToInputValue}
                      onChange={(location) => {
                        setWhereTo(location);
                        setWhereToInputValue(location.name);
                      }}
                      onInputChange={setWhereToInputValue}
                      placeholder="Where to"
                    />
                  </div>
                </div>
              )}

              {/* Page 2: Availability */}
              {currentPage === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Availability
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={availabilityFreeText}
                        onChange={(e) => setAvailabilityFreeText(e.target.value)}
                        placeholder="e.g., next summer, June to August"
                        className="flex-1 px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <button
                        onClick={() => setIsDatePickerOpen(true)}
                        className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        aria-label="Select dates"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    {(dateRange.start || dateRange.end) && (
                      <div className="text-sm text-gray-600">
                        {dateRange.start && dateRange.end
                          ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                          : dateRange.start
                          ? `From: ${dateRange.start.toLocaleDateString()}`
                          : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Page 3: Profile */}
              {currentPage === 3 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile
                  </label>
                  <textarea
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    placeholder="Paste your profile or describe your sailing experience..."
                    className="w-full min-h-[200px] px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 flex-shrink-0 gap-2">
              {currentPage > 1 ? (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              {currentPage < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={!canGoToNextPage()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleWizardSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ml-auto"
                >
                  Search
                </button>
              )}
            </div>
          </div>

          {/* Date Range Picker Dialog (nested) */}
          {isDatePickerOpen && (
            <div
              className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsDatePickerOpen(false);
                }
              }}
            >
              <div
                className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <DateRangePicker
                  value={dateRange}
                  onChange={(range) => {
                    setDateRange(range);
                  }}
                  onClose={() => setIsDatePickerOpen(false)}
                  isInDialog={true}
                  disableClickOutside={true}
                  allowSingleDate={true}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Component with Responsive Detection
export function ComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled }: ComboSearchBoxProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return <MobileComboSearchBox onSubmit={onSubmit} className={className} onFocusChange={onFocusChange} isFocusedControlled={isFocusedControlled} />;
  }

  return <DesktopComboSearchBox onSubmit={onSubmit} className={className} onFocusChange={onFocusChange} isFocusedControlled={isFocusedControlled} />;
}
