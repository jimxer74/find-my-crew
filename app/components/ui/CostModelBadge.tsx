'use client';

import { getCostModelConfig, getCostModelColorClass, getCostModelAbbreviation, CostModel } from '@shared/types/cost-models';

interface CostModelBadgeProps {
  costModel: CostModel;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CostModelBadge({
  costModel,
  showLabel = true,
  size = 'md',
  className = ''
}: CostModelBadgeProps) {
  const config = getCostModelConfig(costModel);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border-2 ${
        getCostModelColorClass(costModel)
      } ${sizeClasses[size]} ${className}`}
      title={`${config.displayName}: ${config.description}`}
    >
      {showLabel && (
        <span className="mr-1">
          {config.displayName}
        </span>
      )}
      <span className="text-xs font-medium opacity-80">
        {getCostModelAbbreviation(costModel)}
      </span>
    </span>
  );
}