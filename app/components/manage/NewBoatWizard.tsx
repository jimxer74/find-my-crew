'use client';

import { logger } from '@shared/logging';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
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

  const resetWizard = () => {
    setCurrentStep(1);
    setStep1Data(initialStep1Data);
    setStep2Data(initialStep2Data);
    setError(null);
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
          logger.debug('Hard data fetched:', { hardData });

          // Use the canonical make_model from parsed HTML (more reliable than search query)
          const canonicalMakeModel = hardData.make_model || step1Data.selectedSailboat.name;
          logger.debug('Canonical make_model for registry:', { canonicalMakeModel });

          // Merge hard data
          newStep2Data = {
            ...newStep2Data,
            makeModel: canonicalMakeModel, // Update with canonical name
            loa_m: hardData.loa_m ?? null,
            beam_m: hardData.beam_m ?? null,
            max_draft_m: hardData.max_draft_m ?? null,
            displcmt_m: hardData.displcmt_m ?? null,
            link_to_specs: hardData.link_to_specs || '',
            sa_displ_ratio: hardData.sa_displ_ratio ?? null,
            ballast_displ_ratio: hardData.ballast_displ_ratio ?? null,
            displ_len_ratio: hardData.displ_len_ratio ?? null,
            comfort_ratio: hardData.comfort_ratio ?? null,
            capsize_screening: hardData.capsize_screening ?? null,
            hull_speed_knots: hardData.hull_speed_knots ?? null,
            ppi_pounds_per_inch: hardData.ppi_pounds_per_inch ?? null,
          };

          // Now call AI to fill reasoned fields
          logger.debug('=== Calling AI to fill reasoned fields ===');
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
                capacity: reasonedData.capacity ?? null,
                average_speed_knots: reasonedData.average_speed_knots ?? null,
                characteristics: reasonedData.characteristics || '',
                capabilities: reasonedData.capabilities || '',
                accommodations: reasonedData.accommodations || '',
              };

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
        } else {
          const errorData = await hardDataResponse.json().catch(() => ({}));
          logger.warn('Failed to fetch sailboat details:', errorData.error);
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
