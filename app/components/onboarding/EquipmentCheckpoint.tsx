'use client';

import { useState } from 'react';
import { NewBoatWizardStep3 } from '@/app/components/manage/NewBoatWizardStep3';
import { Button } from '@shared/ui/Button/Button';

type Phase = 'offer' | 'generating';

interface EquipmentCheckpointProps {
  boatId: string;
  makeModel: string;
  boatType?: string | null;
  loa_m?: number | null;
  yearBuilt?: number | null;
  onComplete: () => void;
  onSkip: () => void;
}

export function EquipmentCheckpoint({
  boatId,
  makeModel,
  boatType,
  loa_m,
  yearBuilt,
  onComplete,
  onSkip,
}: EquipmentCheckpointProps) {
  const [phase, setPhase] = useState<Phase>('offer');

  if (phase === 'offer') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            Generate equipment list &amp; maintenance tasks?
          </h3>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-500">
            AI will search manufacturer specs for{' '}
            <span className="font-medium text-gray-900">{makeModel || 'your boat'}</span> and
            build a verified equipment hierarchy with maintenance schedules.
          </p>
          <p className="text-sm text-gray-500">
            This runs in the background and takes 30–90 seconds. You can review and adjust the
            results before saving.
          </p>
          {yearBuilt && (
            <p className="text-sm text-amber-700">
              Built in {yearBuilt} — AI will flag equipment commonly replaced at this age for your
              review.
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/80 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
          <Button size="sm" onClick={() => setPhase('generating')}>
            Yes, generate
          </Button>
        </div>
      </div>
    );
  }

  // Delegate to NewBoatWizardStep3 for category selection → generation → review → save
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
      <NewBoatWizardStep3
        boatId={boatId}
        makeModel={makeModel}
        boatType={boatType ?? null}
        loa_m={loa_m ?? null}
        yearBuilt={yearBuilt ?? null}
        onComplete={onComplete}
        onSkip={onSkip}
      />
    </div>
  );
}
