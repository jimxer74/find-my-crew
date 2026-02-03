'use client';

import React from 'react';
import { getCostModelConfig, getAllCostModels, getCostModelColorClass, CostModel } from '@/app/types/cost-models';
import { CostModelIcon } from './CostModelIcon';
import { useTheme } from '@/app/contexts/ThemeContext';

type CostModelSelectorProps = {
  value: CostModel | null;
  onChange: (value: CostModel | null) => void;
  onInfoClick?: (title: string, content: React.ReactNode) => void;
  onClose?: () => void;
  showRequiredBadge?: boolean;
};

const getCostModelInfo = (model: CostModel): { title: string; content: React.ReactNode } => {
  const config = getCostModelConfig(model);
  return {
    title: config.displayName,
    content: (
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">Description</h4>
          <p className="mb-2">{config.description}</p>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Details</h4>
          <p className="mb-2">{config.details}</p>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <h5 className="font-medium mb-1">Cost Model: {config.displayName}</h5>
          <p className="text-sm text-muted-foreground">{config.details}</p>
        </div>
      </div>
    ),
  };
};

export function CostModelSelector({
  value,
  onChange,
  onInfoClick,
  onClose,
  showRequiredBadge = false
}: CostModelSelectorProps) {
  const costModels = getAllCostModels();
  const theme = useTheme();

  const isSelected = (model: CostModel) => value === model;

  const handleClick = (model: CostModel) => {
    const newValue = value === model ? null : model;
    onChange(newValue);

    // Show info for selected cost model
    if (onInfoClick) {
      if (newValue) {
        const info = getCostModelInfo(newValue);
        onInfoClick(info.title, info.content);
      } else if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-foreground mb-2 md:mb-3">
        Cost Model
        {showRequiredBadge && !value && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded">
            Please select
          </span>
        )}
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 auto-rows-fr items-start">
        {costModels.map((modelConfig) => (
          <button
            key={modelConfig.name}
            type="button"
            onClick={() => handleClick(modelConfig.name as CostModel)}
            className={`relative p-3 md:p-4 border-2 rounded-lg bg-card transition-all flex flex-col items-start ${
              isSelected(modelConfig.name as CostModel)
                ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                : 'border-border hover:border-primary/50 hover:bg-accent/50'
            }`}
          >
            {/* Icon */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {/*<div className="w-12 h-12 flex-shrink-0 relative">
                <CostModelIcon model={modelConfig.name as CostModel} size="lg" />
              </div>*/}
              <div className="flex flex-col flex-1">
                <h3 className={`font-semibold text-sm md:text-base ${
                  isSelected(modelConfig.name as CostModel) ? 'text-primary font-bold' : 'text-card-foreground'
                }`}>
                  {modelConfig.displayName}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                  {modelConfig.description}
                </p>
              </div>
            </div>

            {/* Badge */}

            {/*
            <div className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
              getCostModelColorClass(modelConfig.name as CostModel)
            }`}>
              {modelConfig.abbreviation}
            </div>
            */}
            {/* Selection indicator */}
            {isSelected(modelConfig.name as CostModel) && (
              <div className="absolute top-2 right-2">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}