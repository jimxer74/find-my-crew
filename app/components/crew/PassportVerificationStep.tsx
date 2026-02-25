'use client';

import { useState } from 'react';
import { Button } from '@shared/ui/Button/Button';
import { PassportSelector } from './PassportSelector';
import { PhotoUploadStep } from './PhotoUploadStep';

type PassportRequirement = {
  id: string;
  require_photo_validation: boolean;
  pass_confidence_score: number;
};

interface PassportVerificationStepProps {
  journeyId: string;
  legName: string;
  requirement: PassportRequirement;
  onComplete: (data: { passport_document_id: string; photo_file?: Blob }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

type Step = 'select_passport' | 'upload_photo';

export function PassportVerificationStep({
  journeyId,
  legName,
  requirement,
  onComplete,
  onCancel,
  isLoading = false,
  error,
}: PassportVerificationStepProps) {
  const [currentStep, setCurrentStep] = useState<Step>('select_passport');
  const [selectedPassportId, setSelectedPassportId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [stepError, setStepError] = useState<string | null>(error || null);

  const handlePassportSelect = (passportId: string) => {
    setSelectedPassportId(passportId);
    setStepError(null);

    // If no photo validation required, skip to completion
    if (!requirement.require_photo_validation) {
      onComplete({
        passport_document_id: passportId,
        photo_file: undefined,
      });
    } else {
      // Move to photo upload step
      setCurrentStep('upload_photo');
    }
  };

  const handlePhotoComplete = (photo: Blob) => {
    setPhotoFile(photo);
    setStepError(null);

    // Both passport and photo are now ready
    if (selectedPassportId) {
      onComplete({
        passport_document_id: selectedPassportId,
        photo_file: photo,
      });
    }
  };

  const handlePhotoCancel = () => {
    setCurrentStep('select_passport');
    setPhotoFile(null);
  };

  const handleCancel = () => {
    setSelectedPassportId(null);
    setPhotoFile(null);
    setCurrentStep('select_passport');
    onCancel();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Verify Passport</h3>
          <p className="text-sm text-muted-foreground">
            {currentStep === 'select_passport'
              ? 'Select a passport from your document vault to proceed with registration.'
              : 'Upload a facial photo to verify your identity. This will be securely matched against your passport.'}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                currentStep === 'select_passport' || currentStep === 'upload_photo'
                  ? 'bg-primary'
                  : 'bg-secondary'
              }`}
            />
            {requirement.require_photo_validation && (
              <>
                <div
                  className={`flex-1 h-1 rounded-full transition-colors ${
                    currentStep === 'upload_photo' ? 'bg-primary' : 'bg-secondary'
                  }`}
                />
              </>
            )}
          </div>

          {/* Step labels */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span
              className={currentStep === 'select_passport' ? 'text-foreground font-medium' : ''}
            >
              1. Select Passport
            </span>
            {requirement.require_photo_validation && (
              <span
                className={currentStep === 'upload_photo' ? 'text-foreground font-medium' : ''}
              >
                2. Upload Photo
              </span>
            )}
          </div>
        </div>

        {/* Error message */}
        {stepError && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {stepError}
          </div>
        )}

        {/* Step content */}
        <div className="space-y-4">
          {currentStep === 'select_passport' ? (
            <PassportSelector
              onSelect={handlePassportSelect}
              onCancel={handleCancel}
              isLoading={isLoading}
              error={error}
            />
          ) : currentStep === 'upload_photo' && requirement.require_photo_validation ? (
            <div className="space-y-4">
              <PhotoUploadStep
                onComplete={handlePhotoComplete}
                onCancel={handlePhotoCancel}
                isLoading={isLoading}
                error={error}
              />
              <Button
                type="button"
                onClick={handlePhotoCancel}
                variant="ghost"
                className="w-full !text-muted-foreground hover:!text-foreground"
              >
                ← Back to Passport Selection
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
