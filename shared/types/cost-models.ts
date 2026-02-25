import costModelsConfig from '@/app/config/cost-models-config.json';

export type CostModel = 'Shared contribution' | 'Owner covers all costs' | 'Crew pays a fee' | 'Delivery/paid crew' | 'Not defined';

export type CostModelConfig = {
  name: CostModel;
  displayName: string;
  icon: string;
  description: string;
  details: string;
  color: string;
  abbreviation: string;
};

/**
 * Get cost model configuration by name
 */
export function getCostModelConfig(model: CostModel): CostModelConfig {
  const config = costModelsConfig.costModels.find(m => m.name === model);
  if (!config) {
    throw new Error(`Invalid cost model: ${model}`);
  }
  return config as CostModelConfig;
}

/**
 * Get all cost model configs
 */
export function getAllCostModels(): CostModelConfig[] {
  return costModelsConfig.costModels as CostModelConfig[];
}

/**
 * Get display name for a cost model
 */
export function getCostModelDisplayName(model: CostModel): string {
  return getCostModelConfig(model).displayName;
}

/**
 * Get cost model icon path
 */
export function getCostModelIcon(model: CostModel): string {
  return `/${getCostModelConfig(model).icon}`;
}

/**
 * Get cost model icon color
 */
export function getCostModelIconColor(model: CostModel): string {
  const color = getCostModelColorClass(model);
  return color.includes('blue') ? '#3b82f6' :
         color.includes('green') ? '#22c55e' :
         color.includes('orange') ? '#f97316' :
         color.includes('purple') ? '#a855f7' :
         '#9ca3af';
}

/**
 * Get cost model color class
 */
export function getCostModelColorClass(model: CostModel): string {
  const color = getCostModelConfig(model).color;
  const colorClasses: Record<string, string> = {
    'blue': 'bg-blue-100 text-blue-800 border-blue-300',
    'green': 'bg-green-100 text-green-800 border-green-300',
    'orange': 'bg-orange-100 text-orange-800 border-orange-300',
    'purple': 'bg-purple-100 text-purple-800 border-purple-300',
    'gray': 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colorClasses[color] || colorClasses['gray'];
}

/**
 * Get cost model abbreviation
 */
export function getCostModelAbbreviation(model: CostModel): string {
  return getCostModelConfig(model).abbreviation;
}