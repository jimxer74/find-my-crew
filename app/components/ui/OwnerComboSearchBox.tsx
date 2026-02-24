'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { LocationAutocomplete, type Location } from './LocationAutocomplete';
import { DateRangePicker, type DateRange } from './DateRangePicker';
import { URLImportModal } from '@/app/components/onboarding/URLImportModal';
import { URLImportWizardPage } from '@/app/components/onboarding/URLImportWizardPage';

export interface OwnerComboSearchData {
  journeyDetails: {
    startLocation: Location | null;
    endLocation: Location | null;
    startDate: string | null;
    endDate: string | null;
    waypoints: Location[];
    waypointDensity?: 'minimal' | 'moderate' | 'detailed';
  };
  skipperProfile: {
    text: string;
    aiProcessingConsent: boolean;
  };
  crewRequirements: {
    text: string;
    aiProcessingConsent: boolean;
  };
  importedProfile?: {
    url: string;
    source: string;
    content: string;
  };
}

interface OwnerComboSearchBoxProps {
  onSubmit: (data: OwnerComboSearchData) => void;
  className?: string;
  onFocusChange?: (isFocused: boolean) => void;
  isFocusedControlled?: boolean;
  /** When true, show only a single search input (no segments). Used when both owner/crew columns visible on desktop. */
  compactMode?: boolean;
}

// Journey Details Dialog Component
function JourneyDetailsDialog({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    startLocation: Location | null;
    endLocation: Location | null;
    startDate: string;
    endDate: string;
    waypoints: Location[];
    waypointDensity: 'minimal' | 'moderate' | 'detailed';
  }) => void;
  initialData?: {
    startLocation: Location | null;
    endLocation: Location | null;
    startDate: string;
    endDate: string;
    waypoints: Location[];
    waypointDensity?: 'minimal' | 'moderate' | 'detailed';
  };
}) {
  const [startLocation, setStartLocation] = useState<Location | null>(initialData?.startLocation || null);
  const [endLocation, setEndLocation] = useState<Location | null>(initialData?.endLocation || null);
  const [startDate, setStartDate] = useState<string>(initialData?.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialData?.endDate || '');
  const [waypoints, setWaypoints] = useState<Location[]>(initialData?.waypoints || []);
  const [waypointDensity, setWaypointDensity] = useState<'minimal' | 'moderate' | 'detailed'>(initialData?.waypointDensity || 'moderate');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const dateRangeFromStrings: DateRange = {
    start: startDate ? new Date(startDate) : null,
    end: endDate ? new Date(endDate) : null,
  };
  const applyDateRange = (range: DateRange) => {
    setStartDate(range.start ? range.start.toISOString().slice(0, 10) : '');
    setEndDate(range.end ? range.end.toISOString().slice(0, 10) : '');
  };

  useEffect(() => {
    if (isOpen && initialData) {
      setStartLocation(initialData.startLocation || null);
      setEndLocation(initialData.endLocation || null);
      setStartDate(initialData.startDate || '');
      setEndDate(initialData.endDate || '');
      setWaypoints(initialData.waypoints || []);
      setWaypointDensity(initialData.waypointDensity || 'moderate');
    }
  }, [isOpen, initialData]);

  const handleSave = () => {
    // Validate required fields
    if (!startLocation || !startLocation.name || startLocation.lat === 0 || startLocation.lng === 0) {
      return;
    }
    if (!endLocation || !endLocation.name || endLocation.lat === 0 || endLocation.lng === 0) {
      return;
    }
    // Validate waypoints
    const invalidWaypoint = waypoints.some((wp) => wp.lat === 0 || wp.lng === 0);
    if (invalidWaypoint) {
      return;
    }
    onSave({
      startLocation,
      endLocation,
      startDate,
      endDate,
      waypoints,
      waypointDensity,
    });
  };

  const canSave = startLocation && startLocation.lat !== 0 && startLocation.lng !== 0 &&
                  endLocation && endLocation.lat !== 0 && endLocation.lng !== 0 &&
                  !waypoints.some((wp) => wp.lat === 0 || wp.lng === 0);

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
        aria-labelledby="journey-details-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="journey-details-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Journey Details
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

        {/* Content - Date range first, then locations, then waypoints */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-gray-800 dark:text-gray-400 text-left">
            You can enter exact departure and arrival details if you already know where and when you going to sail. You can also include the Journey information as part of your profile description and SailSmart AI will pick it up from there. Don't know your exact plans yet? No worries, you can skip this step and add details later.
          </p>
          {/* Date range - first, same pattern as crew Availability dialog (owner amber theme) */}
          <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Estimated journey dates</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                {startDate && endDate
                  ? `${dateRangeFromStrings.start?.toLocaleDateString()} - ${dateRangeFromStrings.end?.toLocaleDateString()}`
                  : startDate
                  ? `Starting from: ${dateRangeFromStrings.start?.toLocaleDateString()}`
                  : 'Choose start and end dates'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {startDate || endDate ? 'Change dates' : 'Select dates'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <LocationAutocomplete
              id="journey_start_location"
              label="Start Location *"
              value={startLocation?.name || ''}
              onChange={(location) => {
                setStartLocation(location);
              }}
              onInputChange={(value) => {
                setStartLocation({ name: value, lat: 0, lng: 0 });
              }}
              placeholder="e.g., Barcelona, Spain"
              required
              excludeCruisingRegions={true}
              className="[&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_label]:text-left"
            />
            <LocationAutocomplete
              id="journey_end_location"
              label="End Location *"
              value={endLocation?.name || ''}
              onChange={(location) => {
                setEndLocation(location);
              }}
              onInputChange={(value) => {
                setEndLocation({ name: value, lat: 0, lng: 0 });
              }}
              placeholder="e.g., Palma, Mallorca"
              required
              excludeCruisingRegions={true}
              className="[&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_label]:text-left"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Intermediate Waypoints</label>
              <button
                type="button"
                onClick={() => {
                  setWaypoints([...waypoints, { name: '', lat: 0, lng: 0 }]);
                }}
                className="text-sm text-amber-600 dark:text-amber-400 hover:opacity-80 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Waypoint
              </button>
            </div>
            {waypoints.length === 0 ? (
              <p className="text-sm text-gray-800 dark:text-gray-400">Optional: Add stops along the route.</p>
            ) : (
              <div className="space-y-3">
                {waypoints.map((waypoint, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      <LocationAutocomplete
                        id={`journey_waypoint_${index}`}
                        label={`Waypoint ${index + 1}`}
                        value={waypoint.name}
                        onChange={(location) => {
                          const updated = [...waypoints];
                          updated[index] = location;
                          setWaypoints(updated);
                        }}
                        onInputChange={(value) => {
                          const updated = [...waypoints];
                          updated[index] = { name: value, lat: 0, lng: 0 };
                          setWaypoints(updated);
                        }}
                        placeholder="e.g., Ibiza, Spain"
                        excludeCruisingRegions={true}
                        className="[&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_label]:text-left"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = waypoints.filter((_, idx) => idx !== index);
                        setWaypoints(updated);
                      }}
                      className="mt-6 text-red-600 dark:text-red-400 hover:opacity-80 p-2"
                      title="Remove waypoint"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        
          {/* Waypoint Density Control */}
          {/*
          <div className="space-y-2">
            <label htmlFor="waypoint-density" className="block text-sm font-medium text-gray-900 dark:text-gray-100 text-left">
              Waypoint Density
            </label>
            <select
              id="waypoint-density"
              value={waypointDensity}
              onChange={(e) => setWaypointDensity(e.target.value as 'minimal' | 'moderate' | 'detailed')}
              className="w-full px-3 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
            >
              <option value="minimal">Minimal - High-level planning (2 waypoints/leg, crew exchange points only)</option>
              <option value="moderate">Moderate - Balanced planning (max 4 waypoints/leg, recommended)</option>
              <option value="detailed">Detailed - Comprehensive routing (max 8 waypoints/leg, full navigation planning)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
              Controls how many waypoints are created per leg. Use "Minimal" for crew exchange planning, "Moderate" for most journeys, or "Detailed" for full navigation planning.
            </p>
          </div>
          */}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    {/* Date Range Picker - portaled so it stays on top */}
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
            value={dateRangeFromStrings}
            onChange={(range) => {
              applyDateRange(range);
            }}
            onClose={() => setIsDatePickerOpen(false)}
            isInDialog={true}
            disableClickOutside={true}
            allowSingleDate={false}
          />
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

// Reusable profile/requirements dialog (used for both skipper profile and crew requirements)
function ProfileTextDialog({
  isOpen,
  onClose,
  onSave,
  dialogId,
  title,
  instructions,
  placeholder,
  initialText,
  initialAiConsent,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string, aiProcessingConsent: boolean) => void;
  dialogId: string;
  title: string;
  instructions: React.ReactNode;
  placeholder: string;
  initialText?: string;
  initialAiConsent?: boolean;
}) {
  const [text, setText] = useState(initialText || '');
  const [aiConsent, setAiConsent] = useState(initialAiConsent || false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setAiConsent(initialAiConsent || false);
    }
  }, [isOpen, initialText, initialAiConsent]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(text.trim(), aiConsent);
  };

  const canSave = text.trim().length > 0 && aiConsent;

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
        aria-labelledby={`${dialogId}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id={`${dialogId}-title`} className="text-lg font-semibold text-gray-950 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Instructions */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100 mb-2">What to include:</h3>
            {instructions}
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={2000}
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-950 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-700 dark:placeholder:text-gray-400 resize-none"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-gray-200 dark:border-gray-700">
          {/* AI Consent */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAiConsent(!aiConsent)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                aiConsent ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                  aiConsent ? 'right-1' : 'left-1'
                }`}
              />
            </button>
            <p className="text-sm text-gray-800 dark:text-gray-400">Allow AI to process the data that you provide</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-amber-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SKIPPER_PROFILE_INSTRUCTIONS = (
  <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1 list-disc list-inside text-left">
    <li>Your sailing experience and certifications (RYA, ASA, etc.)</li>
    <li>Boat details: name, make/model, type, home port</li>
    <li>Equipment, navigation systems, safety gear</li>
    <li>Your availability and preferred sailing areas</li>
    <li><b>Hint:</b> You can copy-paste your existing profile from Facebook or sailing forums.</li>
  </ul>
);

const CREW_REQUIREMENTS_INSTRUCTIONS = (
  <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-1 list-disc list-inside text-left">
    <li>Positions needed (e.g. watch keeper, navigator, cook)</li>
    <li>Required experience level and skills</li>
    <li>Physical requirements and any restrictions</li>
    <li>Cost sharing, compensation, or contribution model</li>
    <li>Timeline and commitment expected from crew</li>
  </ul>
);

// Desktop OwnerComboSearchBox Component
function DesktopOwnerComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled, compactMode = false }: OwnerComboSearchBoxProps) {
  const t = useTranslations('welcome.owner');
  const [journeyDetails, setJourneyDetails] = useState<{
    startLocation: Location | null;
    endLocation: Location | null;
    startDate: string;
    endDate: string;
    waypoints: Location[];
    waypointDensity: 'minimal' | 'moderate' | 'detailed';
  }>({
    startLocation: null,
    endLocation: null,
    startDate: '',
    endDate: '',
    waypoints: [],
    waypointDensity: 'moderate',
  });
  const [skipperProfileText, setSkipperProfileText] = useState('');
  const [skipperProfileAiConsent, setSkipperProfileAiConsent] = useState(false);
  const [crewRequirementsText, setCrewRequirementsText] = useState('');
  const [crewRequirementsAiConsent, setCrewRequirementsAiConsent] = useState(false);
  const [isJourneyDialogOpen, setIsJourneyDialogOpen] = useState(false);
  const [isSkipperProfileDialogOpen, setIsSkipperProfileDialogOpen] = useState(false);
  const [isCrewRequirementsDialogOpen, setIsCrewRequirementsDialogOpen] = useState(false);
  const [focusedSegment, setFocusedSegment] = useState<'journey' | 'skipperProfile' | 'crewRequirements' | 'importProfile' | null>(null);
  const [showURLImportModal, setShowURLImportModal] = useState(false);
  const [importedProfile, setImportedProfile] = useState<{
    url: string;
    source: string;
    content: string;
    metadata: any;
  } | null>(null);

  // Notify parent when focus state changes
  useEffect(() => {
    const isFocused = focusedSegment !== null || isJourneyDialogOpen || isSkipperProfileDialogOpen || isCrewRequirementsDialogOpen || showURLImportModal;
    if (!isFocusedControlled) {
      onFocusChange?.(isFocused);
    }
  }, [focusedSegment, isJourneyDialogOpen, isSkipperProfileDialogOpen, isCrewRequirementsDialogOpen, showURLImportModal, onFocusChange, isFocusedControlled]);

  // Clear focus when parent requests it
  useEffect(() => {
    if (isFocusedControlled && focusedSegment !== null) {
      setFocusedSegment(null);
      setIsJourneyDialogOpen(false);
      setIsSkipperProfileDialogOpen(false);
      setIsCrewRequirementsDialogOpen(false);
    }
  }, [isFocusedControlled, focusedSegment]);

  const hasAnyValue = journeyDetails.startLocation || journeyDetails.endLocation || journeyDetails.startDate || journeyDetails.endDate || journeyDetails.waypoints.length > 0 || skipperProfileText || crewRequirementsText;

  const formatJourneyDisplay = (): string => {
    const parts: string[] = [];
    if (journeyDetails.startLocation) {
      parts.push(`From: ${journeyDetails.startLocation.name}`);
    }
    if (journeyDetails.endLocation) {
      parts.push(`To: ${journeyDetails.endLocation.name}`);
    }
    if (journeyDetails.startDate) {
      parts.push(`Start: ${new Date(journeyDetails.startDate).toLocaleDateString()}`);
    }
    if (journeyDetails.endDate) {
      parts.push(`End: ${new Date(journeyDetails.endDate).toLocaleDateString()}`);
    }
    if (journeyDetails.waypoints.length > 0) {
      parts.push(`${journeyDetails.waypoints.length} waypoint${journeyDetails.waypoints.length !== 1 ? 's' : ''}`);
    }
    return parts.join(', ') || '';
  };

  const truncateText = (text: string, maxLength: number): string => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleSubmit = () => {
    // Require at least one of skipper profile or crew requirements
    if (!skipperProfileText.trim() && !crewRequirementsText.trim()) {
      return;
    }
    const data: OwnerComboSearchData = {
      journeyDetails: {
        startLocation: journeyDetails.startLocation,
        endLocation: journeyDetails.endLocation,
        startDate: journeyDetails.startDate || null,
        endDate: journeyDetails.endDate || null,
        waypoints: journeyDetails.waypoints,
        waypointDensity: journeyDetails.waypointDensity,
      },
      skipperProfile: {
        text: skipperProfileText,
        aiProcessingConsent: skipperProfileAiConsent,
      },
      crewRequirements: {
        text: crewRequirementsText,
        aiProcessingConsent: crewRequirementsAiConsent,
      },
      importedProfile: importedProfile ? {
        url: importedProfile.url,
        source: importedProfile.source,
        content: importedProfile.content,
      } : undefined,
    };
    onSubmit(data);
  };

  const clearSegment = (segment: 'journey' | 'skipperProfile' | 'crewRequirements') => {
    if (segment === 'journey') {
      setJourneyDetails({
        startLocation: null,
        endLocation: null,
        startDate: '',
        endDate: '',
        waypoints: [],
        waypointDensity: 'moderate',
      });
    } else if (segment === 'skipperProfile') {
      setSkipperProfileText('');
      setSkipperProfileAiConsent(false);
    } else {
      setCrewRequirementsText('');
      setCrewRequirementsAiConsent(false);
    }
  };

  if (compactMode) {
    return (
      <div className={`w-full ${className}`}>
        <button
          type="button"
          onClick={() => {
            // Just notify parent to enter combo search mode (hide crew side)
            // Don't open dialog by default
            onFocusChange?.(true);
          }}
          className="w-full h-14 px-4 text-left text-sm text-gray-900 bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center gap-3 cursor-pointer transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-gray-500 truncate">{t('postPlaceholder')}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-0 rounded-xl shadow-lg overflow-hidden">
        <div className="flex divide-x divide-gray-200 dark:divide-gray-700">
          {/* Journey Details Segment */}
          <div className="flex-1 min-w-0">
            <div
              onClick={() => {
                setFocusedSegment('journey');
                setIsJourneyDialogOpen(true);
              }}
              className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative"
            >
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <div className="flex-1 min-w-0">
                {hasAnyValue && journeyDetails.startLocation ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{formatJourneyDisplay()}</div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Journey details</span>
                )}
              </div>
              {hasAnyValue && journeyDetails.startLocation && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSegment('journey');
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  aria-label="Clear"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Skipper Profile Segment */}
          <div className="flex-1 min-w-0">
            <div
              onClick={() => {
                setFocusedSegment('skipperProfile');
                setIsSkipperProfileDialogOpen(true);
              }}
              className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative"
            >
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="flex-1 min-w-0">
                {hasAnyValue && skipperProfileText ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{truncateText(skipperProfileText, 30)}</div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">About you as skipper</span>
                )}
              </div>
              {hasAnyValue && skipperProfileText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSegment('skipperProfile');
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  aria-label="Clear"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Crew Requirements Segment */}
          <div className="flex-1 min-w-0">
            <div
              onClick={() => {
                setFocusedSegment('crewRequirements');
                setIsCrewRequirementsDialogOpen(true);
              }}
              className="w-full h-14 px-4 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-colors flex items-center gap-3 cursor-pointer relative"
            >
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                {hasAnyValue && crewRequirementsText ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{truncateText(crewRequirementsText, 30)}</div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Crew requirements</span>
                )}
              </div>
              {hasAnyValue && crewRequirementsText && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSegment('crewRequirements');
                  }}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
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
              disabled={!skipperProfileText.trim() && !crewRequirementsText.trim()}
              className="h-14 px-6 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 rounded-r-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Post</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <URLImportModal
        isOpen={showURLImportModal}
        onClose={() => setShowURLImportModal(false)}
        onSuccess={(content, metadata) => {
          setImportedProfile({
            url: metadata.url || '',
            source: metadata.platform || 'unknown',
            content,
            metadata,
          });
          setShowURLImportModal(false);
        }}
      />

      <JourneyDetailsDialog
        isOpen={isJourneyDialogOpen}
        onClose={() => {
          setIsJourneyDialogOpen(false);
          setFocusedSegment(null);
        }}
        onSave={(data) => {
          setJourneyDetails(data);
          setIsJourneyDialogOpen(false);
          setFocusedSegment(null);
        }}
        initialData={journeyDetails}
      />

      <ProfileTextDialog
        isOpen={isSkipperProfileDialogOpen}
        onClose={() => {
          setIsSkipperProfileDialogOpen(false);
          setFocusedSegment(null);
        }}
        onSave={(text, consent) => {
          setSkipperProfileText(text);
          setSkipperProfileAiConsent(consent);
          setIsSkipperProfileDialogOpen(false);
          setFocusedSegment(null);
        }}
        dialogId="skipper-profile-dialog"
        title="About You (Skipper Profile)"
        instructions={SKIPPER_PROFILE_INSTRUCTIONS}
        placeholder="Describe your sailing experience, certifications, boat details, home port, availability..."
        initialText={skipperProfileText}
        initialAiConsent={skipperProfileAiConsent}
      />

      <ProfileTextDialog
        isOpen={isCrewRequirementsDialogOpen}
        onClose={() => {
          setIsCrewRequirementsDialogOpen(false);
          setFocusedSegment(null);
        }}
        onSave={(text, consent) => {
          setCrewRequirementsText(text);
          setCrewRequirementsAiConsent(consent);
          setIsCrewRequirementsDialogOpen(false);
          setFocusedSegment(null);
        }}
        dialogId="crew-requirements-dialog"
        title="Crew Requirements"
        instructions={CREW_REQUIREMENTS_INSTRUCTIONS}
        placeholder="Describe the crew you're looking for: positions, skills, experience level, cost sharing, timeline..."
        initialText={crewRequirementsText}
        initialAiConsent={crewRequirementsAiConsent}
      />
    </div>
  );
}

// Mobile Wizard Component
function MobileOwnerComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled, compactMode = false }: OwnerComboSearchBoxProps) {
  const t = useTranslations('welcome.owner');
  const tPrivacy = useTranslations('settings.privacy');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<1 | 2 | 3>(1);
  const [journeyDetails, setJourneyDetails] = useState<{
    startLocation: Location | null;
    endLocation: Location | null;
    startDate: string;
    endDate: string;
    waypoints: Location[];
    waypointDensity: 'minimal' | 'moderate' | 'detailed';
  }>({
    startLocation: null,
    endLocation: null,
    startDate: '',
    endDate: '',
    waypoints: [],
    waypointDensity: 'moderate',
  });
  const [skipperProfileText, setSkipperProfileText] = useState('');
  const [skipperProfileAiConsent, setSkipperProfileAiConsent] = useState(false);
  const [crewRequirementsText, setCrewRequirementsText] = useState('');
  const [crewRequirementsAiConsent, setCrewRequirementsAiConsent] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [importedProfile, setImportedProfile] = useState<{
    url: string;
    source: string;
    content: string;
    metadata: any;
  } | null>(null);

  const mobileDateRange: DateRange = {
    start: journeyDetails.startDate ? new Date(journeyDetails.startDate) : null,
    end: journeyDetails.endDate ? new Date(journeyDetails.endDate) : null,
  };

  // Notify parent when wizard opens/closes
  useEffect(() => {
    if (!isFocusedControlled) {
      onFocusChange?.(isWizardOpen);
    }
  }, [isWizardOpen, onFocusChange, isFocusedControlled]);

  // Close wizard when parent requests it
  useEffect(() => {
    if (isFocusedControlled && isWizardOpen) {
      setIsWizardOpen(false);
    }
  }, [isFocusedControlled, isWizardOpen]);

  const handleWizardSubmit = () => {
    // Require at least one of skipper profile or crew requirements
    if (!skipperProfileText.trim() && !crewRequirementsText.trim()) {
      return;
    }
    const data: OwnerComboSearchData = {
      journeyDetails: {
        startLocation: journeyDetails.startLocation,
        endLocation: journeyDetails.endLocation,
        startDate: journeyDetails.startDate || null,
        endDate: journeyDetails.endDate || null,
        waypoints: journeyDetails.waypoints,
        waypointDensity: journeyDetails.waypointDensity,
      },
      skipperProfile: {
        text: skipperProfileText,
        aiProcessingConsent: skipperProfileAiConsent,
      },
      crewRequirements: {
        text: crewRequirementsText,
        aiProcessingConsent: crewRequirementsAiConsent,
      },
      importedProfile: importedProfile ? {
        url: importedProfile.url,
        source: importedProfile.source,
        content: importedProfile.content,
      } : undefined,
    };
    onSubmit(data);
    setIsWizardOpen(false);
    // Reset wizard state
    setCurrentPage(1);
    setJourneyDetails({
      startLocation: null,
      endLocation: null,
      startDate: '',
      endDate: '',
      waypoints: [],
      waypointDensity: 'moderate',
    });
    setSkipperProfileText('');
    setSkipperProfileAiConsent(false);
    setCrewRequirementsText('');
    setCrewRequirementsAiConsent(false);
    setImportedProfile(null);
  };

  const canGoToNextPage = () => {
    // All pages allow proceeding (content is optional per page)
    return true;
  };

  const handleNext = () => {
    if (currentPage < 3 && canGoToNextPage()) {
      setCurrentPage((prev) => (prev + 1) as 1 | 2 | 3);
    }
  };

  const handleBack = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (currentPage > 1) {
      setCurrentPage((prev) => (prev - 1) as 1 | 2 | 3);
    } else {
      setIsWizardOpen(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Mobile Search Input */}
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        className="w-full h-14 px-4 text-left text-sm text-gray-900 bg-white/80 backdrop-blur-sm border-0 rounded-xl shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-amber-400 flex items-center gap-3 cursor-pointer transition-colors"
      >
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="text-gray-500 truncate">{t('postPlaceholder')}</span>
      </button>

      {/* Mobile Wizard Dialog */}
      {isWizardOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex flex-col"
          onClick={(e) => {
            if (e.target === e.currentTarget && currentPage === 1) {
              setIsWizardOpen(false);
            }
          }}
        >
          <div className="flex-1 bg-white dark:bg-card flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border flex-shrink-0">
              <button
                onClick={handleBack}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Back"
              >
                <svg className="w-6 h-6 text-gray-900 dark:text-gray-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {currentPage === 1 && 'Journey Details'}
                {currentPage === 2 && 'About You (Skipper Profile)'}
                {currentPage === 3 && 'Crew Requirements'}
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
              {/* Page 1: Journey Details */}
              {currentPage === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-800 dark:text-gray-400 text-left">
                  You can enter exact departure and arrival details if you already know where and when you going to sail. You can also include the Journey information as part of your profile description and SailSmart AI will pick it up from there. Don't know your exact plans yet? No worries, you can skip this step and add details later.
                  </p>
                  {/* Date range first - same pattern as desktop (owner amber theme) */}
                  <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Estimated journey dates</p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        {journeyDetails.startDate && journeyDetails.endDate
                          ? `${mobileDateRange.start?.toLocaleDateString()} - ${mobileDateRange.end?.toLocaleDateString()}`
                          : journeyDetails.startDate
                          ? `Starting from: ${mobileDateRange.start?.toLocaleDateString()}`
                          : 'Choose start and end dates'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(true)}
                      className="px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {journeyDetails.startDate || journeyDetails.endDate ? 'Change dates' : 'Select dates'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <LocationAutocomplete
                      id="mobile_journey_start_location"
                      label="Start Location"
                      value={journeyDetails.startLocation?.name || ''}
                      onChange={(location) => {
                        setJourneyDetails({ ...journeyDetails, startLocation: location });
                      }}
                      onInputChange={(value) => {
                        setJourneyDetails({ ...journeyDetails, startLocation: { name: value, lat: 0, lng: 0 } });
                      }}
                      placeholder="e.g., Barcelona, Spain"
                      excludeCruisingRegions={true}
                      className="[&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_label]:text-left"
                    />
                    <LocationAutocomplete
                      id="mobile_journey_end_location"
                      label="End Location"
                      value={journeyDetails.endLocation?.name || ''}
                      onChange={(location) => {
                        setJourneyDetails({ ...journeyDetails, endLocation: location });
                      }}
                      onInputChange={(value) => {
                        setJourneyDetails({ ...journeyDetails, endLocation: { name: value, lat: 0, lng: 0 } });
                      }}
                      placeholder="e.g., Palma, Mallorca"
                      excludeCruisingRegions={true}
                      className="[&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_label]:text-left"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Intermediate Waypoints</label>
                      <button
                        type="button"
                        onClick={() => {
                          setJourneyDetails({ ...journeyDetails, waypoints: [...journeyDetails.waypoints, { name: '', lat: 0, lng: 0 }] });
                        }}
                        className="text-sm text-amber-900 dark:text-amber-400 hover:opacity-80 flex items-center gap-1 font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Waypoint
                      </button>
                    </div>
                    {journeyDetails.waypoints.length === 0 ? (
                      <p className="text-sm text-gray-800 dark:text-gray-400">Optional: Add stops along the route.</p>
                    ) : (
                      <div className="space-y-3">
                        {journeyDetails.waypoints.map((waypoint, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="flex-1">
                              <LocationAutocomplete
                                id={`mobile_journey_waypoint_${index}`}
                                label={`Waypoint ${index + 1}`}
                                value={waypoint.name}
                                onChange={(location) => {
                                  const updated = [...journeyDetails.waypoints];
                                  updated[index] = location;
                                  setJourneyDetails({ ...journeyDetails, waypoints: updated });
                                }}
                                onInputChange={(value) => {
                                  const updated = [...journeyDetails.waypoints];
                                  updated[index] = { name: value, lat: 0, lng: 0 };
                                  setJourneyDetails({ ...journeyDetails, waypoints: updated });
                                }}
                                placeholder="e.g., Ibiza, Spain"
                                excludeCruisingRegions={true}
                                className="[&_input]:text-gray-900 dark:[&_input]:text-gray-100 [&_label]:text-left"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = journeyDetails.waypoints.filter((_, idx) => idx !== index);
                                setJourneyDetails({ ...journeyDetails, waypoints: updated });
                              }}
                              className="mt-6 text-red-600 dark:text-red-400 hover:opacity-80 p-2"
                              title="Remove waypoint"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Waypoint Density Control */}
                  {/*
                  <div className="space-y-2">
                    <label htmlFor="mobile_waypoint-density" className="block text-sm font-medium text-gray-900 dark:text-gray-100 text-left">
                      Waypoint Density
                    </label>
                    <select
                      id="mobile_waypoint-density"
                      value={journeyDetails.waypointDensity}
                      onChange={(e) => setJourneyDetails({ ...journeyDetails, waypointDensity: e.target.value as 'minimal' | 'moderate' | 'detailed' })}
                      className="w-full px-3 py-2 min-h-[44px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm"
                    >
                      <option value="minimal">Minimal - High-level planning (2 waypoints/leg, crew exchange points only)</option>
                      <option value="moderate">Moderate - Balanced planning (max 4 waypoints/leg, recommended)</option>
                      <option value="detailed">Detailed - Comprehensive routing (max 8 waypoints/leg, full navigation planning)</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
                      Controls how many waypoints are created per leg. Use "Minimal" for crew exchange planning, "Moderate" for most journeys, or "Detailed" for full navigation planning.
                    </p>
                  </div>
                  */}
                </div>
              )}

              {/* Page 2: Skipper Profile */}
              {currentPage === 2 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100 mb-2">What to include:</h3>
                    {SKIPPER_PROFILE_INSTRUCTIONS}
                  </div>

                  <textarea
                    value={skipperProfileText}
                    onChange={(e) => setSkipperProfileText(e.target.value)}
                    placeholder="Describe your sailing experience, certifications, boat details, home port, availability..."
                    className="w-full min-h-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-700 dark:placeholder:text-gray-400 resize-none"
                  />

                  {/* AI Consent */}
                  <div className="flex items-start justify-between gap-4 pt-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-foreground">{tPrivacy('aiProcessing')}</p>
                      <p className="text-sm text-gray-800 dark:text-muted-foreground mt-0.5">{tPrivacy('aiProcessingDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSkipperProfileAiConsent(!skipperProfileAiConsent)}
                      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                        skipperProfileAiConsent ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          skipperProfileAiConsent ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* Page 3: Crew Requirements */}
              {currentPage === 3 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100 mb-2">What to include:</h3>
                    {CREW_REQUIREMENTS_INSTRUCTIONS}
                  </div>

                  <textarea
                    value={crewRequirementsText}
                    onChange={(e) => setCrewRequirementsText(e.target.value)}
                    placeholder="Describe the crew you're looking for: positions, skills, experience level, cost sharing, timeline..."
                    className="w-full min-h-[200px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-gray-700 dark:placeholder:text-gray-400 resize-none"
                  />

                  {/* AI Consent */}
                  <div className="flex items-start justify-between gap-4 pt-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-foreground">{tPrivacy('aiProcessing')}</p>
                      <p className="text-sm text-gray-800 dark:text-muted-foreground mt-0.5">{tPrivacy('aiProcessingDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrewRequirementsAiConsent(!crewRequirementsAiConsent)}
                      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                        crewRequirementsAiConsent ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                          crewRequirementsAiConsent ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-border flex-shrink-0">
              {currentPage === 1 ? (
                <>
                  <button
                    onClick={() => setIsWizardOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canGoToNextPage()}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </>
              ) : currentPage === 2 ? (
                <>
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleWizardSubmit}
                    disabled={!skipperProfileText.trim() && !crewRequirementsText.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Post</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Date Range Picker - portaled so it is on top of wizard */}
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
                  value={mobileDateRange}
                  onChange={(range) => {
                    setJourneyDetails({
                      ...journeyDetails,
                      startDate: range.start ? range.start.toISOString().slice(0, 10) : '',
                      endDate: range.end ? range.end.toISOString().slice(0, 10) : '',
                    });
                  }}
                  onClose={() => setIsDatePickerOpen(false)}
                  isInDialog={true}
                  disableClickOutside={true}
                  allowSingleDate={false}
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

// Main Export Component
export function OwnerComboSearchBox({ onSubmit, className = '', onFocusChange, isFocusedControlled, compactMode = false }: OwnerComboSearchBoxProps) {
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
    return <MobileOwnerComboSearchBox onSubmit={onSubmit} className={className} onFocusChange={onFocusChange} isFocusedControlled={isFocusedControlled} compactMode={compactMode} />;
  }

  return <DesktopOwnerComboSearchBox onSubmit={onSubmit} className={className} onFocusChange={onFocusChange} isFocusedControlled={isFocusedControlled} compactMode={compactMode} />;
}
