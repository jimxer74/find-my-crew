'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
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
  aiProcessingConsent?: boolean;
}

interface ComboSearchBoxProps {
  onSubmit: (data: ComboSearchData) => void;
  className?: string;
  onFocusChange?: (isFocused: boolean) => void;
  isFocusedControlled?: boolean; // If true, parent controls focus state
  /** When true, show only a single search input (no segments). Used when both owner/crew columns visible on desktop. */
  compactMode?: boolean;
}

// Availability Dialog Component
function AvailabilityDialog({
  isOpen,
  onClose,
  value,
  onSave,
  dateRange,
  onDateRangeChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onSave: (availabilityText: string) => void;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}) {
  const [availabilityText, setAvailabilityText] = useState(value);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [localDateRange, setLocalDateRange] = useState<DateRange>(dateRange || { start: null, end: null });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvailabilityText(value);
  }, [value]);

  useEffect(() => {
    if (dateRange) {
      setLocalDateRange(dateRange);
    }
  }, [dateRange]);

  useEffect(() => {
    if (isOpen && inputRef.current && !isDatePickerOpen) {
      inputRef.current.focus();
    }
  }, [isOpen, isDatePickerOpen]);

  const handleSave = () => {
    onSave(availabilityText);
    if (onDateRangeChange) {
      onDateRangeChange(localDateRange);
    }
    onClose();
  };

  const handleDateRangeChange = (range: DateRange) => {
    setLocalDateRange(range);
    if (onDateRangeChange) {
      onDateRangeChange(range);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isDatePickerOpen) {
            onClose();
          }
        }}
      >
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="availability-dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 id="availability-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Availability
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <input
                ref={inputRef}
                type="text"
                value={availabilityText}
                onChange={(e) => setAvailabilityText(e.target.value)}
                placeholder="Describe your availability, e.g. 'next summer', 'starting from June', 'flexible dates' etc."
                className="w-full px-4 py-3 text-base text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
            
            {/* Select specific dates button */}
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Select specific dates</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  {localDateRange.start && localDateRange.end
                    ? `${localDateRange.start.toLocaleDateString()} - ${localDateRange.end.toLocaleDateString()}`
                    : localDateRange.start
                    ? `Starting from: ${localDateRange.start.toLocaleDateString()}`
                    : 'Choose start and end dates'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(true)}
                className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {localDateRange.start || localDateRange.end ? 'Change dates' : 'Select dates'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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

      {/* Date Range Picker Dialog */}
      {isDatePickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDatePickerOpen(false);
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <DateRangePicker
              value={localDateRange}
              onChange={handleDateRangeChange}
              onClose={() => setIsDatePickerOpen(false)}
              isInDialog={true}
              disableClickOutside={true}
              allowSingleDate={true}
            />
          </div>
        </div>
      )}
    </>
  );
}

// Profile Dialog Component
function ProfileDialog({
  isOpen,
  onClose,
  value,
  onSave,
  aiProcessingLabel,
  aiProcessingDesc,
}: {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onSave: (profile: string, aiProcessingConsent: boolean) => void;
  aiProcessingLabel: string;
  aiProcessingDesc: string;
}) {
  const [profileText, setProfileText] = useState(value);
  const [aiConsent, setAiConsent] = useState(false);
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
    onSave(profileText, aiConsent);
    onClose();
  };

  const canSave = profileText.trim().length > 0 && aiConsent;

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
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="profile-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Profile Information
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              What to include:
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Your sailing experience and skill level</li>
              <li>Relevant certifications and qualifications</li>
              <li>Preferences for trip types and destinations</li>
              <li>Availability and any special requirements</li>
            </ul>
          </div>

          <textarea
            ref={textareaRef}
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder="Describe your sailing experience, skills, and preferences. Our AI will use this to match you with sailing trips and help create your profile."
            maxLength={2000}
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-4 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* AI Consent */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAiConsent(!aiConsent)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                aiConsent ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                  aiConsent ? 'right-1' : 'left-1'
                }`}
              />
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">Allow AI to process the data that you provide</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Desktop ComboSearchBox Component
function DesktopComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled, compactMode = false }: ComboSearchBoxProps) {
  const tPrivacy = useTranslations('settings.privacy');
  const [whereFrom, setWhereFrom] = useState<Location | null>(null);
  const [whereTo, setWhereTo] = useState<Location | null>(null);
  const [availabilityFreeText, setAvailabilityFreeText] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [profile, setProfile] = useState('');
  const [profileAiConsent, setProfileAiConsent] = useState(false);
  const [focusedSegment, setFocusedSegment] = useState<'whereFrom' | 'whereTo' | 'availability' | 'profile' | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [whereFromInputValue, setWhereFromInputValue] = useState('');
  const [whereToInputValue, setWhereToInputValue] = useState('');
  const whereFromInputRef = useRef<HTMLInputElement>(null);
  const whereToInputRef = useRef<HTMLInputElement>(null);
  const availabilityInputRef = useRef<HTMLInputElement>(null);

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
    if (focusedSegment === 'availability' && availabilityInputRef.current) {
      // Focus the input when availability segment is clicked
      requestAnimationFrame(() => {
        setTimeout(() => {
          availabilityInputRef.current?.focus();
        }, 0);
      });
    }
  }, [focusedSegment]);


  // Notify parent when focus state changes
  useEffect(() => {
    const isFocused = focusedSegment !== null || isProfileDialogOpen || isAvailabilityDialogOpen || isDatePickerOpen;
    if (!isFocusedControlled) {
      onFocusChange?.(isFocused);
    }
  }, [focusedSegment, isProfileDialogOpen, isAvailabilityDialogOpen, isDatePickerOpen, onFocusChange, isFocusedControlled]);

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
      // Check if it's a single date (start and end are the same day)
      const isSameDay = dateRange.start.getTime() === dateRange.end.getTime() ||
        (dateRange.start.getDate() === dateRange.end.getDate() &&
         dateRange.start.getMonth() === dateRange.end.getMonth() &&
         dateRange.start.getFullYear() === dateRange.end.getFullYear());
      if (isSameDay) {
        parts.push(`Starting from: ${startStr}`);
      } else {
        parts.push(`${startStr} - ${endStr}`);
      }
    } else if (dateRange.start) {
      // Only start date selected
      const startStr = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      parts.push(`Starting from: ${startStr}`);
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
      aiProcessingConsent: profile.trim().length > 0 ? profileAiConsent : undefined,
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
        setProfileAiConsent(false);
        break;
    }
  };

  // Compact mode: single search input when both owner/crew columns visible (front page crew column)
  if (compactMode) {
    return (
      <div className={`w-full max-w-full ${className}`}>
        <button
          type="button"
          onClick={() => onFocusChange?.(true)}
          className="w-full h-14 px-4 text-left text-sm text-gray-900 bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg hover:bg-white/90 transition-colors flex items-center gap-3 cursor-pointer"
        >
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-gray-500 truncate">Search sailing trips by location and your preferences...</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg overflow-hidden">
        <div className="flex divide-x divide-gray-200 dark:divide-gray-700">
          {/* Where From Segment */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {focusedSegment === 'whereFrom' ? (
              <div className="w-full h-14 px-4 flex items-center relative bg-blue-50 dark:bg-blue-900/20 rounded-l-xl">
                <LocationAutocomplete
                  value={whereFromInputValue}
                  onChange={(location) => {
                    setWhereFrom(location);
                    setWhereFromInputValue(location.name);
                    setFocusedSegment(null);
                  }}
                  onInputChange={(value) => {
                    setWhereFromInputValue(value);
                    if (whereFrom && value !== whereFrom.name) {
                      setWhereFrom(null);
                    }
                  }}
                  placeholder="Where from"
                  className="border-0 w-full [&_input]:py-2 [&_input]:h-full [&_input]:text-sm [&_input]:bg-transparent [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_input]:placeholder:text-gray-400 dark:[&_input]:placeholder:text-gray-500 [&>div]:z-50"
                  autoFocus={true}
                  inputRef={whereFromInputRef}
                />
              </div>
            ) : (
              <div
                onClick={() => {
                  const currentValue = whereFrom?.name || '';
                  setWhereFromInputValue(currentValue);
                  setFocusedSegment('whereFrom');
                }}
                className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative overflow-hidden"
              >
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="flex-1 min-w-0 overflow-hidden">
                  {whereFrom ? (
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{whereFrom.name}</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Where from</span>
                  )}
                </div>
                {whereFrom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSegment('whereFrom');
                    }}
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
                    aria-label="Clear"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Where To Segment */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {focusedSegment === 'whereTo' ? (
              <div className="w-full h-14 px-4 flex items-center relative bg-blue-50 dark:bg-blue-900/20">
                <LocationAutocomplete
                  value={whereToInputValue}
                  onChange={(location) => {
                    setWhereTo(location);
                    setWhereToInputValue(location.name);
                    setFocusedSegment(null);
                  }}
                  onInputChange={(value) => {
                    setWhereToInputValue(value);
                    if (whereTo && value !== whereTo.name) {
                      setWhereTo(null);
                    }
                  }}
                  placeholder="Where to"
                  className="border-0 w-full [&_input]:py-2 [&_input]:h-full [&_input]:text-sm [&_input]:bg-transparent [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_input]:placeholder:text-gray-400 dark:[&_input]:placeholder:text-gray-500 [&>div]:z-50"
                  autoFocus={true}
                  inputRef={whereToInputRef}
                />
              </div>
            ) : (
              <div
                onClick={() => {
                  const currentValue = whereTo?.name || '';
                  setWhereToInputValue(currentValue);
                  setFocusedSegment('whereTo');
                }}
                className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative overflow-hidden"
              >
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="flex-1 min-w-0 overflow-hidden">
                  {whereTo ? (
                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{whereTo.name}</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Where to</span>
                  )}
                </div>
                {whereTo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSegment('whereTo');
                    }}
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
                    aria-label="Clear"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Availability Segment */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div
              onClick={() => {
                setFocusedSegment('availability');
                setIsAvailabilityDialogOpen(true);
              }}
              className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative overflow-hidden"
            >
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1 min-w-0 overflow-hidden">
                {availabilityFreeText || dateRange.start ? (
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{formatAvailabilityDisplay()}</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Availability</span>
                )}
              </div>
              {(availabilityFreeText || dateRange.start) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSegment('availability');
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
                  aria-label="Clear"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Profile Segment */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div
              onClick={() => {
                setFocusedSegment('profile');
                setIsProfileDialogOpen(true);
              }}
              className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative overflow-hidden"
            >
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="flex-1 min-w-0 overflow-hidden">
                {profile ? (
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{truncateText(profile, 30)}</span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Sailing profile</span>
                )}
              </div>
              {profile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSegment('profile');
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 ml-2"
                  aria-label="Clear"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Post Button */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!hasAnyValue}
              className="h-14 px-6 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 rounded-r-xl"
              aria-label="Post"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Post</span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Dialog */}
      <AvailabilityDialog
        isOpen={isAvailabilityDialogOpen}
        onClose={() => {
          setIsAvailabilityDialogOpen(false);
          setFocusedSegment(null);
        }}
        value={availabilityFreeText}
        onSave={(newAvailabilityText) => {
          setAvailabilityFreeText(newAvailabilityText);
          setIsAvailabilityDialogOpen(false);
          setFocusedSegment(null);
        }}
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
        }}
      />
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => {
          setIsProfileDialogOpen(false);
          setFocusedSegment(null);
        }}
        value={profile}
        onSave={(newProfile, aiConsent) => {
          setProfile(newProfile);
          setProfileAiConsent(aiConsent);
          setIsProfileDialogOpen(false);
          setFocusedSegment(null);
        }}
        aiProcessingLabel={tPrivacy('aiProcessing')}
        aiProcessingDesc={tPrivacy('aiProcessingDesc')}
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

    </div>
  );
}

// Mobile Wizard Component
function MobileComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled, compactMode = false }: ComboSearchBoxProps) {
  const tPrivacy = useTranslations('settings.privacy');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [whereFrom, setWhereFrom] = useState<Location | null>(null);
  const [whereTo, setWhereTo] = useState<Location | null>(null);
  const [availabilityFreeText, setAvailabilityFreeText] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [profile, setProfile] = useState('');
  const [profileAiConsent, setProfileAiConsent] = useState(false);
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
      aiProcessingConsent: profile.trim().length > 0 ? profileAiConsent : undefined,
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
    setProfileAiConsent(false);
  };

  const canGoToNextPage = () => {
    // Allow navigation forward regardless of values - all fields are optional
    return true;
  };

  const handleNext = () => {
    if (currentPage < 2 && canGoToNextPage()) {
      setCurrentPage((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // Blur any focused elements
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (currentPage > 1) {
      setCurrentPage((prev) => (prev - 1) as 1 | 2);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile Search Input - matches desktop/owner box: pencil icon on left, no magnifying glass */}
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        className="w-full h-14 px-4 text-left text-sm text-gray-900 bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-3 cursor-pointer transition-colors"
      >
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="text-gray-500 truncate">Search sailing trips by location and your preferences...</span>
      </button>

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
          <div className="flex-1 bg-card flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {currentPage === 1 && 'Where do you want to sail'}
                {currentPage === 2 && 'Tell us about you and your sailing preferences'}
              </h2>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-900 dark:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Page 1: Locations and Availability */}
              {currentPage === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 text-left">
                      Where from
                    </label>
                    <div className="relative">
                      <LocationAutocomplete
                        value={whereFromInputValue}
                        onChange={(location) => {
                          setWhereFrom(location);
                          setWhereFromInputValue(location.name);
                        }}
                        onInputChange={setWhereFromInputValue}
                        placeholder="Where from"
                        className="[&_input]:text-gray-900 [&_input]:dark:text-gray-100 [&_input]:bg-white [&_input]:dark:bg-gray-800 [&_input]:border-gray-300 [&_input]:dark:border-gray-600"
                      />
                      {whereFromInputValue && (
                        <button
                          onClick={() => {
                            setWhereFrom(null);
                            setWhereFromInputValue('');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label="Clear"
                        >
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 text-left">
                      Where to
                    </label>
                    <div className="relative">
                      <LocationAutocomplete
                        value={whereToInputValue}
                        onChange={(location) => {
                          setWhereTo(location);
                          setWhereToInputValue(location.name);
                        }}
                        onInputChange={setWhereToInputValue}
                        placeholder="Where to"
                        className="[&_input]:text-gray-900 [&_input]:dark:text-gray-100 [&_input]:bg-white [&_input]:dark:bg-gray-800 [&_input]:border-gray-300 [&_input]:dark:border-gray-600"
                      />
                      {whereToInputValue && (
                        <button
                          onClick={() => {
                            setWhereTo(null);
                            setWhereToInputValue('');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          aria-label="Clear"
                        >
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 text-left">
                      Availability
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={(() => {
                            // Combine free text and date range in the input value
                            const parts: string[] = [];
                            if (availabilityFreeText) {
                              parts.push(availabilityFreeText);
                            }
                            if (dateRange.start && dateRange.end) {
                              // Check if it's a single date
                              const isSameDay = dateRange.start.getTime() === dateRange.end.getTime() ||
                                (dateRange.start.getDate() === dateRange.end.getDate() &&
                                 dateRange.start.getMonth() === dateRange.end.getMonth() &&
                                 dateRange.start.getFullYear() === dateRange.end.getFullYear());
                              if (isSameDay) {
                                parts.push(`Starting from: ${dateRange.start.toLocaleDateString()}`);
                              } else {
                                parts.push(`${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`);
                              }
                            } else if (dateRange.start) {
                              parts.push(`Starting from: ${dateRange.start.toLocaleDateString()}`);
                            }
                            return parts.join(', ');
                          })()}
                          onChange={(e) => {
                            // Only update free text, preserve date range
                            setAvailabilityFreeText(e.target.value);
                          }}
                          placeholder="Describe your availability, e.g. 'next summer', 'starting from June', 'flexible dates' etc."
                          className="w-full px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {(dateRange.start || dateRange.end) && (
                          <button
                            onClick={() => {
                              setDateRange({ start: null, end: null });
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Clear date"
                          >
                            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setIsDatePickerOpen(true)}
                        className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                        aria-label="Select dates"
                      >
                        <svg className="w-5 h-5 text-gray-900 dark:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Page 2: Profile */}
              {currentPage === 2 && (
                <div className="space-y-4">
                  {/* Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      What to include:
                    </h3>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                      <li>Your sailing experience and skill level</li>
                      <li>Relevant certifications and qualifications</li>
                      <li>Preferences for trip types and destinations</li>
                      <li>Availability and any special requirements</li>
                    </ul>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 text-left">
                      Profile
                    </label>
                    <textarea
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                      placeholder="Describe your sailing experience, skills, and preferences. Our AI will use this to match you with sailing trips and help create your profile."
                      maxLength={2000}
                      className="w-full min-h-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-500 dark:placeholder:text-gray-400 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="sticky bottom-0 flex flex-col gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-card flex-shrink-0">
              {/* AI Consent - only show on page 2 */}
              {currentPage === 2 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProfileAiConsent(!profileAiConsent)}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${
                      profileAiConsent ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                        profileAiConsent ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Allow AI to process the data that you provide</p>
                </div>
              )}
              
              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-2">
              {currentPage > 1 ? (
                <button
                  type="button"
                  onClick={(e) => handleBack(e)}
                  className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-50"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              {currentPage < 2 ? (
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
                  disabled={profile.trim().length > 0 && !profileAiConsent}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Post</span>
                </button>
              )}
              </div>
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
export function ComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled, compactMode = false }: ComboSearchBoxProps) {
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
    return <MobileComboSearchBox onSubmit={onSubmit} className={className} onFocusChange={onFocusChange} isFocusedControlled={isFocusedControlled} compactMode={compactMode} />;
  }

  return <DesktopComboSearchBox onSubmit={onSubmit} className={className} onFocusChange={onFocusChange} isFocusedControlled={isFocusedControlled} compactMode={compactMode} />;
}
