'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { LocationAutocomplete, type Location } from './LocationAutocomplete';
import { DateRangePicker, type DateRange } from './DateRangePicker';
import { Modal } from '@/app/components/ui/Modal/Modal';
import { Button } from '@/app/components/ui/Button/Button';

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

// Where & When to sail - combined dialog (crew blue theme, Journey Details–style layout)
function WhereAndWhenDialog({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { whereFrom: Location | null; whereTo: Location | null; dateRange: DateRange }) => void;
  initialData: {
    whereFrom: Location | null;
    whereTo: Location | null;
    dateRange: DateRange;
  };
}) {
  const [whereFrom, setWhereFrom] = useState<Location | null>(initialData.whereFrom);
  const [whereTo, setWhereTo] = useState<Location | null>(initialData.whereTo);
  const [localDateRange, setLocalDateRange] = useState<DateRange>(initialData.dateRange);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWhereFrom(initialData.whereFrom);
      setWhereTo(initialData.whereTo);
      setLocalDateRange(initialData.dateRange);
    }
  }, [isOpen, initialData]);

  const handleSave = () => {
    onSave({
      whereFrom,
      whereTo,
      dateRange: localDateRange,
    });
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Where & When to sail"
        size="lg"
        showCloseButton
        closeOnBackdropClick={!isDatePickerOpen}
        closeOnEscape={!isDatePickerOpen}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="primary"
              size="sm"
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All fields are optional. Add locations and dates if you like, or tap Save to continue.
          </p>

          {/* Date range - first (crew blue theme) */}
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">When you are available</p>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                {localDateRange.start && localDateRange.end
                  ? `${localDateRange.start.toLocaleDateString()} - ${localDateRange.end.toLocaleDateString()}`
                  : localDateRange.start
                  ? `Starting from: ${localDateRange.start.toLocaleDateString()}`
                  : 'Choose start and end dates'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDatePickerOpen(true)}
              className="flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {localDateRange.start || localDateRange.end ? 'Change dates' : 'Select dates'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationAutocomplete
              id="where_when_from"
              label="Where from"
              value={whereFrom?.name || ''}
              onChange={setWhereFrom}
              onInputChange={(value) => setWhereFrom({ name: value, lat: 0, lng: 0 })}
              placeholder="e.g., Barcelona, Spain"
              className="[&_input]:text-foreground [&_label]:text-left"
            />
            <LocationAutocomplete
              id="where_when_to"
              label="Where to"
              value={whereTo?.name || ''}
              onChange={setWhereTo}
              onInputChange={(value) => setWhereTo({ name: value, lat: 0, lng: 0 })}
              placeholder="e.g., Palma, Mallorca"
              className="[&_input]:text-foreground [&_label]:text-left"
            />
          </div>
        </div>
      </Modal>

      {isDatePickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
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
              onChange={setLocalDateRange}
              onClose={() => setIsDatePickerOpen(false)}
              isInDialog={true}
              disableClickOutside={true}
              allowSingleDate={true}
            />
          </div>
        </div>,
        document.body
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

  const canSave = aiConsent;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Profile Information"
      size="md"
      showCloseButton
      closeOnBackdropClick
      closeOnEscape
      footer={
        <div className="flex items-center justify-between gap-4">
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
            <p className="text-sm text-muted-foreground">Allow AI to process the data that you provide</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              variant="primary"
              size="sm"
            >
              Save
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100 mb-2">
            What to include:
          </h3>
          <ul className="text-xs text-blue-900 dark:text-blue-200 space-y-1 list-disc list-inside text-left">
            <li>Your sailing experience and skills: sailing experience, navigation, heavy weather, night sailing, watch keeping, technical skills, first aid, etc.</li>
            <li>Relevant certifications and qualifications</li>
            <li>Preferences for trip types and destinations</li>
            <li>Availability and any special requirements</li>
            <li><b>Hint:</b> You can copy-paste your existing post for example from Facebook</li>
          </ul>
        </div>

        <textarea
          ref={textareaRef}
          value={profileText}
          onChange={(e) => setProfileText(e.target.value)}
          placeholder="Copy-paste your existing post for example from Facebook or start from scratch..."
          maxLength={2000}
          className="w-full min-h-[200px] px-3 py-2 text-sm text-foreground bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-muted-foreground resize-none"
        />
      </div>
    </Modal>
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
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isWhereAndWhenDialogOpen, setIsWhereAndWhenDialogOpen] = useState(false);

  // Notify parent when focus state changes
  useEffect(() => {
    const isFocused = isProfileDialogOpen || isWhereAndWhenDialogOpen;
    if (!isFocusedControlled) {
      onFocusChange?.(isFocused);
    }
  }, [isProfileDialogOpen, isWhereAndWhenDialogOpen, onFocusChange, isFocusedControlled]);

  // Clear when parent requests it
  useEffect(() => {
    if (isFocusedControlled) {
      setIsProfileDialogOpen(false);
      setIsWhereAndWhenDialogOpen(false);
    }
  }, [isFocusedControlled]);

  const hasAnyValue = whereFrom || whereTo || dateRange.start || profile;
  const canPost = hasAnyValue && profileAiConsent;

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

  const clearWhereAndWhen = () => {
    setWhereFrom(null);
    setWhereTo(null);
    setAvailabilityFreeText('');
    setDateRange({ start: null, end: null });
  };

  const clearProfile = () => {
    setProfile('');
    setProfileAiConsent(false);
  };

  const formatWhereWhenSummary = (): string => {
    const parts: string[] = [];
    if (whereFrom?.name) parts.push(whereFrom.name);
    if (whereTo?.name) parts.push(whereTo.name);
    if (dateRange.start && dateRange.end) {
      const s = dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const e = dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      parts.push(`${s} – ${e}`);
    } else     if (dateRange.start) {
      parts.push(`From ${dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    }
    return parts.join(' · ') || '';
  };

  // Compact mode: single search input when both owner/crew columns visible (front page crew column)
  if (compactMode) {
    return (
      <div className={`w-full max-w-full ${className}`}>
        <button
          type="button"
          onClick={() => onFocusChange?.(true)}
          className="w-full h-14 px-4 text-left text-sm text-foreground bg-white/80 dark:bg-card/80 backdrop-blur-sm border border-border rounded-xl shadow-lg hover:bg-white/90 dark:hover:bg-card/90 transition-colors flex items-center gap-3 cursor-pointer"
        >
          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-muted-foreground truncate">Search sailing trips by location and your preferences...</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden">
        <div className="flex divide-x divide-border">
          {/* Where & When to sail */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div
              onClick={() => setIsWhereAndWhenDialogOpen(true)}
              className="w-full h-14 px-4 text-left text-sm text-foreground hover:bg-white/90 dark:hover:bg-card/90 transition-colors flex items-center gap-3 cursor-pointer relative overflow-hidden rounded-l-xl"
            >
              <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <div className="flex-1 min-w-0 overflow-hidden">
                {formatWhereWhenSummary() ? (
                  <span className="block text-xs text-muted-foreground truncate">{formatWhereWhenSummary()}</span>
                ) : (
                  <span className="text-muted-foreground">Where & When to sail</span>
                )}
              </div>
              {formatWhereWhenSummary() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearWhereAndWhen();
                  }}
                  className="p-1 rounded-full hover:bg-accent transition-colors flex-shrink-0 ml-2"
                  aria-label="Clear"
                >
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Sailing profile */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div
              onClick={() => setIsProfileDialogOpen(true)}
              className="w-full h-14 px-4 text-left text-sm text-foreground hover:bg-white/90 dark:hover:bg-card/90 transition-colors flex items-center gap-3 cursor-pointer relative overflow-hidden"
            >
              <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="flex-1 min-w-0 overflow-hidden">
                {profile ? (
                  <span className="block text-xs text-muted-foreground truncate">{truncateText(profile, 30)}</span>
                ) : (
                  <span className="text-muted-foreground">Sailing profile</span>
                )}
              </div>
              {profile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearProfile();
                  }}
                  className="p-1 rounded-full hover:bg-accent transition-colors flex-shrink-0 ml-2"
                  aria-label="Clear"
                >
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Post Button - requires some input and AI consent */}
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canPost}
              className="h-14 px-6 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 rounded-r-xl"
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

      <WhereAndWhenDialog
        isOpen={isWhereAndWhenDialogOpen}
        onClose={() => setIsWhereAndWhenDialogOpen(false)}
        initialData={{
          whereFrom,
          whereTo,
          dateRange,
        }}
        onSave={(data) => {
          setWhereFrom(data.whereFrom);
          setWhereTo(data.whereTo);
          setDateRange(data.dateRange);
          setIsWhereAndWhenDialogOpen(false);
        }}
      />
      <ProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        value={profile}
        onSave={(newProfile, aiConsent) => {
          setProfile(newProfile);
          setProfileAiConsent(aiConsent);
          setIsProfileDialogOpen(false);
        }}
        aiProcessingLabel={tPrivacy('aiProcessing')}
        aiProcessingDesc={tPrivacy('aiProcessingDesc')}
      />
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

  const hasAnyValue = whereFrom || whereTo || dateRange.start || dateRange.end || profile.trim().length > 0;
  const canPost = hasAnyValue && profileAiConsent;

  const handleNext = () => {
    if (currentPage < 2) {
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
        className="w-full h-14 px-4 text-left text-sm text-foreground bg-white/80 dark:bg-card/80 backdrop-blur-sm border border-border rounded-xl shadow-lg hover:bg-white/90 dark:hover:bg-card/90 focus:outline-none focus:ring-2 focus:ring-blue-400 flex items-center gap-3 cursor-pointer transition-colors"
      >
        <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="text-muted-foreground truncate">Search sailing trips by location and your preferences...</span>
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
          <div className="flex-1 bg-background dark:bg-card flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">
                {currentPage === 1 && 'Where & When to sail'}
                {currentPage === 2 && 'Sailing profile'}
              </h2>
              <button
                onClick={() => setIsWizardOpen(false)}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Page 1: Where & When to sail - same layout as desktop dialog (crew blue theme) */}
              {currentPage === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-left">
                    All fields are optional. Add locations and dates if you like, or tap Next to continue.
                  </p>
                  {/* Date range first */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">When you are available</p>
                      <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5">
                        {dateRange.start && dateRange.end
                          ? `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
                          : dateRange.start
                          ? `Starting from: ${dateRange.start.toLocaleDateString()}`
                          : 'Choose start and end dates'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDatePickerOpen(true)}
                      className="flex items-center gap-2 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {dateRange.start || dateRange.end ? 'Change dates' : 'Select dates'}
                    </Button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 text-left">
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
                        placeholder="e.g., Barcelona, Spain"
                        className="[&_input]:text-foreground [&_input]:bg-background [&_input]:border-input"
                      />
                      {whereFromInputValue && (
                        <button
                          onClick={() => {
                            setWhereFrom(null);
                            setWhereFromInputValue('');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent transition-colors"
                          aria-label="Clear"
                        >
                          <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 text-left">
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
                        placeholder="e.g., Palma, Mallorca"
                        className="[&_input]:text-foreground [&_input]:bg-background [&_input]:border-input"
                      />
                      {whereToInputValue && (
                        <button
                          onClick={() => {
                            setWhereTo(null);
                            setWhereToInputValue('');
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent transition-colors"
                          aria-label="Clear"
                        >
                          <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Page 2: Profile */}
              {currentPage === 2 && (
                <div className="space-y-4">
                  {/* Instructions */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100 mb-2">
                      What to include:
                    </h3>
                    <ul className="text-xs text-blue-900 dark:text-blue-200 space-y-1 list-disc list-inside text-left">
                      <li>Your sailing experience and skills: sailing experience, navigation, heavy weather, night sailing, watch keeping, technical skills, first aid, etc.</li>
                      <li>Relevant certifications and qualifications</li>
                      <li>Preferences for trip types and destinations</li>
                      <li>Availability and any special requirements</li>
                      <li><b>Hint:</b> You can copy-paste your existing post for example from Facebook.</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2 text-left">
                      Profile
                    </label>
                    <textarea
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                      placeholder="Copy-paste your existing post for example from Facebook or start from scratch..."
                      maxLength={2000}
                      className="w-full min-h-[200px] px-3 py-2 text-sm text-foreground bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-muted-foreground resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="sticky bottom-0 flex flex-col gap-3 px-4 py-3 border-t border-border bg-background dark:bg-card flex-shrink-0">
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
                  <p className="text-sm text-muted-foreground">Allow AI to process the data that you provide</p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-2">
              {currentPage > 1 ? (
                <Button
                  type="button"
                  onClick={(e) => handleBack(e)}
                  variant="outline"
                  size="sm"
                  className="z-50"
                >
                  Back
                </Button>
              ) : (
                <div />
              )}
              {currentPage < 2 ? (
                <Button
                  onClick={handleNext}
                  variant="primary"
                  size="sm"
                  className="ml-auto"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleWizardSubmit}
                  disabled={!canPost}
                  variant="primary"
                  size="sm"
                  className="ml-auto flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Post</span>
                </Button>
              )}
              </div>
            </div>
          </div>

          {/* Date Range Picker Dialog - portaled to body so it is on top of wizard and other content */}
          {isDatePickerOpen && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
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
            </div>,
            document.body
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
