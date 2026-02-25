'use client';

import { logger } from '@shared/logging';
import { useState } from 'react';
import { LocationAutocomplete, Location } from '@shared/ui/LocationAutocomplete';
import { getCountryFlag, COUNTRY_CODES } from '@shared/utils';
import { Button } from '@shared/ui/Button/Button';

export type WizardStep1Data = {
  boatName: string;
  homePort: string;
  homePortLat: number | null;
  homePortLng: number | null;
  countryCode: string;
  makeModel: string;
  selectedSailboat: { name: string; url: string; slug: string } | null;
  isManualEntry: boolean;
};

type NewBoatWizardStep1Props = {
  data: WizardStep1Data;
  onDataChange: (data: WizardStep1Data) => void;
  onNext: () => void;
  onCancel: () => void;
  isLoading: boolean;
};

export function NewBoatWizardStep1({
  data,
  onDataChange,
  onNext,
  onCancel,
  isLoading,
}: NewBoatWizardStep1Props) {
  const [makeModelInput, setMakeModelInput] = useState(data.makeModel);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; url: string; slug: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleHomePortChange = (location: Location) => {
    onDataChange({
      ...data,
      homePort: location.name,
      homePortLat: location.lat,
      homePortLng: location.lng,
      countryCode: location.countryCode || data.countryCode,
    });
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onDataChange({
      ...data,
      countryCode: e.target.value,
    });
  };

  const handleSearch = async () => {
    if (!makeModelInput || makeModelInput.trim().length < 2) {
      setSearchError('Please enter at least 2 characters to search');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await fetch('/api/sailboatdata/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: makeModelInput.trim() }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const result = await response.json();
      setSearchResults(result.suggestions || []);

      // If no results found, default to manual entry
      if (!result.suggestions || result.suggestions.length === 0) {
        onDataChange({
          ...data,
          makeModel: makeModelInput.trim(),
          selectedSailboat: null,
          isManualEntry: true,
        });
      }
    } catch (error) {
      logger.error('Search error:', error instanceof Error ? { error: error.message } : { error: String(error) });
      setSearchError('Failed to search. You can proceed with manual entry.');
      onDataChange({
        ...data,
        makeModel: makeModelInput.trim(),
        selectedSailboat: null,
        isManualEntry: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSailboat = (sailboat: { name: string; url: string; slug: string }) => {
    onDataChange({
      ...data,
      makeModel: sailboat.name,
      selectedSailboat: sailboat,
      isManualEntry: false,
    });
    setMakeModelInput(sailboat.name);
  };

  const handleManualEntry = () => {
    onDataChange({
      ...data,
      makeModel: makeModelInput.trim(),
      selectedSailboat: null,
      isManualEntry: true,
    });
  };

  const canProceed = data.boatName.trim().length > 0 && (data.selectedSailboat || data.isManualEntry);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            1
          </span>
          <span className="font-medium text-foreground">Basic Info</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            2
          </span>
          <span>Details</span>
        </div>
      </div>

      {/* Row 1: Boat Name */}
      <div>
        <label htmlFor="boatName" className="block text-sm font-medium text-foreground mb-1">
          Boat Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          id="boatName"
          value={data.boatName}
          onChange={(e) => onDataChange({ ...data, boatName: e.target.value })}
          placeholder="e.g., Sea Breeze"
          className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
        />
      </div>

      {/* Row 2: Home Port + Country Flag */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <LocationAutocomplete
            id="homePort"
            label="Home Port"
            value={data.homePort}
            onChange={handleHomePortChange}
            onInputChange={(value) => onDataChange({ ...data, homePort: value })}
            placeholder="e.g., Barcelona, Spain"
            types="place,region,locality"
          />
        </div>

        <div>
          <label htmlFor="countryFlag" className="block text-sm font-medium text-foreground mb-1">
            Country Flag
          </label>
          <select
            id="countryFlag"
            value={data.countryCode}
            onChange={handleCountryChange}
            className="w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          >
            <option value="">Select country...</option>
            {COUNTRY_CODES.map((country) => (
              <option key={country.code} value={country.code}>
                {getCountryFlag(country.code)} {country.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-detected from port or select manually
          </p>
        </div>
      </div>

      {/* Row 3: Make/Model Search */}
      <div>
        <label htmlFor="makeModel" className="block text-sm font-medium text-foreground mb-1">
          Make and Model
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="makeModel"
            value={makeModelInput}
            onChange={(e) => {
              setMakeModelInput(e.target.value);
              // Clear selection when user types
              if (data.selectedSailboat || data.isManualEntry) {
                onDataChange({
                  ...data,
                  makeModel: e.target.value,
                  selectedSailboat: null,
                  isManualEntry: false,
                });
                setHasSearched(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="e.g., Hallberg-Rassy 38"
            className="flex-1 px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
          />
          <Button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !makeModelInput || makeModelInput.trim().length < 2}
            variant="primary"
            size="sm"
            leftIcon={
              isSearching ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              )
            }
          >
            {isSearching ? (
              <span className="hidden sm:inline">Searching...</span>
            ) : (
              <span className="hidden sm:inline">Search</span>
            )}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Search sailboatdata.com for your boat's specifications
        </p>
      </div>

      {/* Search Error */}
      {searchError && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded text-sm">
          {searchError}
        </div>
      )}

      {/* Search Results */}
      {hasSearched && !isSearching && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b border-border">
            <h4 className="text-sm font-medium text-foreground">
              {searchResults.length > 0
                ? `Found ${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`
                : 'No results found'}
            </h4>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <label
                key={index}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${
                  data.selectedSailboat?.slug === result.slug ? 'bg-accent' : ''
                }`}
              >
                <input
                  type="radio"
                  name="sailboat"
                  checked={data.selectedSailboat?.slug === result.slug}
                  onChange={() => handleSelectSailboat(result)}
                  className="w-4 h-4 text-primary focus:ring-ring"
                />
                <span className="text-sm text-foreground">{result.name}</span>
              </label>
            ))}
            {/* Manual Entry Option */}
            <label
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${
                data.isManualEntry ? 'bg-accent' : ''
              }`}
            >
              <input
                type="radio"
                name="sailboat"
                checked={data.isManualEntry}
                onChange={handleManualEntry}
                className="w-4 h-4 text-primary focus:ring-ring"
              />
              <span className="text-sm text-foreground">
                {searchResults.length > 0
                  ? "My boat is not listed - I'll enter details manually"
                  : "Enter details manually"}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Selection Status */}
      {(data.selectedSailboat || data.isManualEntry) && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
            data.selectedSailboat
              ? 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400'
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-sm font-medium">
            {data.selectedSailboat
              ? `Selected: ${data.selectedSailboat.name}`
              : `Manual entry: ${data.makeModel || 'Will enter details next'}`}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-border">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="!text-sm"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!canProceed || isLoading}
          variant="primary"
          size="sm"
          className="!text-sm"
          leftIcon={
            isLoading ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : undefined
          }
        >
          {isLoading ? 'Loading...' : 'Next'}
          {!isLoading && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}
