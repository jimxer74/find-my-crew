'use client';

import { logger } from '@shared/logging';
import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { getCountryFlag } from '@shared/utils';
import { NewBoatWizardStep1, WizardStep1Data } from './NewBoatWizardStep1';
import { NewBoatWizardStep2, WizardStep2Data } from './NewBoatWizardStep2';
import { Button } from '@shared/ui/Button/Button';

type NewBoatWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
};

const initialStep1Data: WizardStep1Data = {
  boatName: '',
  homePort: '',
  homePortLat: null,
  homePortLng: null,
  countryCode: '',
  makeModel: '',
  selectedSailboat: null,
  isManualEntry: false,
};

const initialStep2Data: WizardStep2Data = {
  name: '',
  homePort: '',
  homePortLat: null,
  homePortLng: null,
  countryFlag: '',
  makeModel: '',
  type: null,
  capacity: null,
  loa_m: null,
  beam_m: null,
  max_draft_m: null,
  displcmt_m: null,
  average_speed_knots: null,
  link_to_specs: '',
  characteristics: '',
  capabilities: '',
  accommodations: '',
  sa_displ_ratio: null,
  ballast_displ_ratio: null,
  displ_len_ratio: null,
  comfort_ratio: null,
  capsize_screening: null,
  hull_speed_knots: null,
  ppi_pounds_per_inch: null,
  images: [],
};

export function NewBoatWizard({ isOpen, onClose, onSuccess, userId }: NewBoatWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<WizardStep1Data>(initialStep1Data);
  const [step2Data, setStep2Data] = useState<WizardStep2Data>(initialStep2Data);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wizard state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('newBoatWizardState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setCurrentStep(state.currentStep || 1);
        setStep1Data(state.step1Data || initialStep1Data);
        setStep2Data(state.step2Data || initialStep2Data);
        logger.debug('Restored wizard state from localStorage', {
          step: state.currentStep,
          hasStep1Data: !!state.step1Data,
          hasStep2Data: !!state.step2Data,
          step2DataLoa: state.step2Data?.loa_m,
        });
      } catch (err) {
        logger.debug('Failed to restore wizard state from localStorage', { error: err });
      }
    }
  }, []);

  // Save wizard state to localStorage whenever data changes
  useEffect(() => {
    const wizardState = {
      currentStep,
      step1Data,
      step2Data,
    };
    localStorage.setItem('newBoatWizardState', JSON.stringify(wizardState));
  }, [currentStep, step1Data, step2Data]);

  const resetWizard = () => {
    setCurrentStep(1);
    setStep1Data(initialStep1Data);
    setStep2Data(initialStep2Data);
    setError(null);
    localStorage.removeItem('newBoatWizardState');
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleStep1Next = async () => {
    setIsLoadingDetails(true);
    setError(null);

    // Initialize step2 data with step1 data
    const countryFlag = step1Data.countryCode ? getCountryFlag(step1Data.countryCode) : '';

    let newStep2Data: WizardStep2Data = {
      ...initialStep2Data,
      name: step1Data.boatName,
      homePort: step1Data.homePort,
      homePortLat: step1Data.homePortLat,
      homePortLng: step1Data.homePortLng,
      countryFlag: countryFlag,
      makeModel: step1Data.makeModel,
    };

    try {
      // If a sailboat was selected, fetch details from sailboatdata.com
      if (step1Data.selectedSailboat && !step1Data.isManualEntry) {
        logger.debug('=== Fetching boat details from sailboatdata.com ===');
        logger.debug('Using slug:', { slug: step1Data.selectedSailboat.slug });

        const hardDataResponse = await fetch('/api/sailboatdata/fetch-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            make_model: step1Data.selectedSailboat.name,
            slug: step1Data.selectedSailboat.slug,
          }),
        });

        if (hardDataResponse.ok) {
          const hardDataResult = await hardDataResponse.json();
          const hardData = hardDataResult.boatDetails;
          logger.debug('Hard data fetched:', {
            source: hardDataResult.source,
            hasLoa: hardData.loa_m !== null && hardData.loa_m !== undefined,
            hasBeam: hardData.beam_m !== null && hardData.beam_m !== undefined,
            loa_m: hardData.loa_m,
            beam_m: hardData.beam_m,
            type: hardData.type,
            make_model: hardData.make_model,
          });

          // Use the canonical make_model from API response (more reliable than search query)
          const canonicalMakeModel = hardData.make_model || step1Data.selectedSailboat.name;
          logger.debug('Canonical make_model for registry:', {
            canonical: canonicalMakeModel,
            fromAPI: hardData.make_model,
            fromSelection: step1Data.selectedSailboat.name
          });

          // Merge hard data
          newStep2Data = {
            ...newStep2Data,
            makeModel: canonicalMakeModel, // Update with canonical name
            capacity: hardData.capacity ?? null,
            loa_m: hardData.loa_m ?? null,
            beam_m: hardData.beam_m ?? null,
            max_draft_m: hardData.max_draft_m ?? null,
            displcmt_m: hardData.displcmt_m ?? null,
            average_speed_knots: hardData.average_speed_knots ?? null,
            link_to_specs: hardData.link_to_specs || '',
            sa_displ_ratio: hardData.sa_displ_ratio ?? null,
            ballast_displ_ratio: hardData.ballast_displ_ratio ?? null,
            displ_len_ratio: hardData.displ_len_ratio ?? null,
            comfort_ratio: hardData.comfort_ratio ?? null,
            capsize_screening: hardData.capsize_screening ?? null,
            hull_speed_knots: hardData.hull_speed_knots ?? null,
            ppi_pounds_per_inch: hardData.ppi_pounds_per_inch ?? null,
          };
          logger.debug('Merged hard data into step2:', {
            capacity: newStep2Data.capacity,
            loa_m: newStep2Data.loa_m,
            beam_m: newStep2Data.beam_m,
            displcmt_m: newStep2Data.displcmt_m,
            type: newStep2Data.type,
            makeModel: newStep2Data.makeModel,
            average_speed_knots: newStep2Data.average_speed_knots,
          });

          // If data came from boat_registry and it already has descriptive fields,
          // skip the AI call — registry is the source of truth.
          const isFromRegistry = hardDataResult.source === 'registry';
          const registryHasDescriptiveData = isFromRegistry && (
            hardData.type || hardData.characteristics || hardData.capabilities || hardData.accommodations
          );

          if (registryHasDescriptiveData) {
            logger.debug('✅ Using registry descriptive data — skipping AI call', {
              type: hardData.type,
              hasCharacteristics: !!hardData.characteristics,
            });
            const validCategories = [
              'Daysailers', 'Coastal cruisers', 'Traditional offshore cruisers',
              'Performance cruisers', 'Multihulls', 'Expedition sailboats',
            ];
            newStep2Data = {
              ...newStep2Data,
              type: hardData.type && validCategories.includes(hardData.type) ? hardData.type as any : null,
              characteristics: hardData.characteristics || '',
              capabilities: hardData.capabilities || '',
              accommodations: hardData.accommodations || '',
            };
          } else {
          // Now call AI to fill reasoned fields (external scrape or registry missing descriptive data)
          logger.debug('=== Calling AI to fill reasoned fields ===', { isFromRegistry });
          try {
            const aiResponse = await fetch('/api/ai/fill-reasoned-details', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                make_model: canonicalMakeModel, // Use canonical name
                hardData: {
                  loa_m: hardData.loa_m,
                  beam_m: hardData.beam_m,
                  max_draft_m: hardData.max_draft_m,
                  displcmt_m: hardData.displcmt_m,
                  sa_displ_ratio: hardData.sa_displ_ratio,
                  ballast_displ_ratio: hardData.ballast_displ_ratio,
                  displ_len_ratio: hardData.displ_len_ratio,
                  comfort_ratio: hardData.comfort_ratio,
                  capsize_screening: hardData.capsize_screening,
                  hull_speed_knots: hardData.hull_speed_knots,
                  ppi_pounds_per_inch: hardData.ppi_pounds_per_inch,
                },
              }),
            });

            if (aiResponse.ok) {
              const aiResult = await aiResponse.json();
              const reasonedData = aiResult.reasonedDetails || {};
              logger.debug('AI reasoned data fetched:', { reasonedData });

              // Validate category
              const validCategories = [
                'Daysailers',
                'Coastal cruisers',
                'Traditional offshore cruisers',
                'Performance cruisers',
                'Multihulls',
                'Expedition sailboats',
              ];
              const validatedType = reasonedData.type && validCategories.includes(reasonedData.type)
                ? reasonedData.type
                : null;

              newStep2Data = {
                ...newStep2Data,
                type: validatedType,
                // Only update capacity/average_speed_knots if AI has values, otherwise keep hard data values
                capacity: reasonedData.capacity ?? newStep2Data.capacity,
                average_speed_knots: reasonedData.average_speed_knots ?? newStep2Data.average_speed_knots,
                characteristics: reasonedData.characteristics || '',
                capabilities: reasonedData.capabilities || '',
                accommodations: reasonedData.accommodations || '',
              };

              logger.debug('Merged AI reasoned data into step2:', {
                type: newStep2Data.type,
                capacity: newStep2Data.capacity,
                average_speed_knots: newStep2Data.average_speed_knots,
                hasCharacteristics: !!newStep2Data.characteristics,
                hasCapabilities: !!newStep2Data.capabilities,
                hasAccommodations: !!newStep2Data.accommodations,
              });

              // Update boat registry with AI-generated descriptive fields
              // This ensures these fields are available for future lookups
              if (canonicalMakeModel && (
                reasonedData.characteristics || 
                reasonedData.capabilities || 
                reasonedData.accommodations
              )) {
                try {
                  // Call API route instead of direct service import (client component)
                  const registryResponse = await fetch('/api/boat-registry/update-descriptive-fields', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      make_model: canonicalMakeModel, // Use canonical name
                      characteristics: reasonedData.characteristics,
                      capabilities: reasonedData.capabilities,
                      accommodations: reasonedData.accommodations,
                    }),
                  });
                  
                  if (registryResponse.ok) {
                    logger.debug('✅ Updated boat registry with AI-generated descriptive fields');
                  } else {
                    logger.warn('⚠️ Failed to update registry with AI fields');
                  }
                } catch (registryError) {
                  // Non-fatal - registry update failure shouldn't block the wizard
                  logger.warn('⚠️ Failed to update registry with AI fields (non-fatal):', registryError instanceof Error ? { error: registryError.message } : { error: String(registryError) });
                }
              }
            } else {
              logger.warn('AI reasoned details failed, continuing with hard data only');
            }
          } catch (aiError) {
            logger.warn('AI fill failed, continuing without AI data:', aiError instanceof Error ? { error: aiError.message } : { error: String(aiError) });
          }
          } // end else (AI path)
        } else {
          const errorData = await hardDataResponse.json().catch(() => ({}));
          logger.error('❌ API fetch failed:', {
            status: hardDataResponse.status,
            statusText: hardDataResponse.statusText,
            error: errorData.error || errorData,
            make_model: step1Data.selectedSailboat?.name,
            slug: step1Data.selectedSailboat?.slug,
          });
          // Continue without prefilled data - user can enter manually
        }
      }
    } catch (err) {
      logger.error('Error fetching boat details:', err instanceof Error ? { error: err.message } : { error: String(err) });
      // Continue to step 2 even if fetch fails - user can enter manually
    } finally {
      setStep2Data(newStep2Data);
      setIsLoadingDetails(false);
      setCurrentStep(2);
    }
  };

  const handleStep2Back = () => {
    setCurrentStep(1);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      const boatData = {
        owner_id: userId,
        name: step2Data.name,
        type: step2Data.type,
        make_model: step2Data.makeModel || null,
        capacity: step2Data.capacity,
        home_port: step2Data.homePort || null,
        country_flag: step1Data.countryCode || null,
        loa_m: step2Data.loa_m,
        beam_m: step2Data.beam_m,
        max_draft_m: step2Data.max_draft_m,
        displcmt_m: step2Data.displcmt_m,
        average_speed_knots: step2Data.average_speed_knots,
        link_to_specs: step2Data.link_to_specs || null,
        characteristics: step2Data.characteristics || null,
        capabilities: step2Data.capabilities || null,
        accommodations: step2Data.accommodations || null,
        sa_displ_ratio: step2Data.sa_displ_ratio,
        ballast_displ_ratio: step2Data.ballast_displ_ratio,
        displ_len_ratio: step2Data.displ_len_ratio,
        comfort_ratio: step2Data.comfort_ratio,
        capsize_screening: step2Data.capsize_screening,
        hull_speed_knots: step2Data.hull_speed_knots,
        ppi_pounds_per_inch: step2Data.ppi_pounds_per_inch,
        images: step2Data.images.length > 0 ? step2Data.images : null,
      };

      const { error: insertError } = await supabase.from('boats').insert(boatData);

      if (insertError) {
        throw insertError;
      }

      // Clear wizard state from localStorage on successful save
      localStorage.removeItem('newBoatWizardState');
      onSuccess();
      handleClose();
    } catch (err: any) {
      logger.error('Error saving boat:', err instanceof Error ? { error: err.message } : { error: String(err) });
      setError(err.message || 'Failed to save boat');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-foreground">Add New Boat</h1>
            <Button
              onClick={handleClose}
              variant="ghost"
              size="sm"
              leftIcon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel and go back"
            >
              <span className="text-sm font-medium">Cancel</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentStep === 1 ? (
          <NewBoatWizardStep1
            data={step1Data}
            onDataChange={setStep1Data}
            onNext={handleStep1Next}
            onCancel={handleClose}
            isLoading={isLoadingDetails}
          />
        ) : (
          <NewBoatWizardStep2
            data={step2Data}
            onDataChange={setStep2Data}
            onBack={handleStep2Back}
            onCancel={handleClose}
            onSave={handleSave}
            isSaving={isSaving}
            error={error}
            userId={userId}
          />
        )}
      </div>
    </div>
  );
}
