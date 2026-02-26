/**
 * Type definitions for the centralized AI prompt management system
 */

// Use case identifiers - these should match the current use cases in the codebase
export type UseCase =
  | 'assistant-system'
  | 'boat-suggestions'
  | 'boat-details'
  | 'profile-generation'
  | 'assess-registration'
  | 'generate-journey'
  | 'generate-profile'
  | 'suggest-sailboats'
  | 'assistant-chat'
  | 'prospect-chat'
  | 'owner-chat'
  | 'general-conversation'
  | 'suggest-makers'
  | 'suggest-models'
  | 'document-classification'
  | 'product-search';

// Prompt format types
export type PromptFormat = 'template' | 'builder' | 'constant';

// Prompt content can be a string template, a builder function, or a static constant
export type PromptContent =
  | string
  | ((context?: any) => string)
  | ((...args: any[]) => string);

// Re-export constants
export const PROMPT_FORMATS = {
  TEMPLATE: 'template' as PromptFormat,
  BUILDER: 'builder' as PromptFormat,
  CONSTANT: 'constant' as PromptFormat
} as const;

export const USE_CASES = {
  ASSISTANT_SYSTEM: 'assistant-system' as UseCase,
  BOAT_SUGGESTIONS: 'boat-suggestions' as UseCase,
  BOAT_DETAILS: 'boat-details' as UseCase,
  PROFILE_GENERATION: 'profile-generation' as UseCase,
  ASSESS_REGISTRATION: 'assess-registration' as UseCase,
  GENERATE_JOURNEY: 'generate-journey' as UseCase,
  GENERATE_PROFILE: 'generate-profile' as UseCase,
  SUGGEST_SAILBOATS: 'suggest-sailboats' as UseCase,
  ASSISTANT_CHAT: 'assistant-chat' as UseCase,
  PROSPECT_CHAT: 'prospect-chat' as UseCase,
  OWNER_CHAT: 'owner-chat' as UseCase,
  GENERAL_CONVERSATION: 'general-conversation' as UseCase,
  SUGGEST_MAKERS: 'suggest-makers' as UseCase,
  SUGGEST_MODELS: 'suggest-models' as UseCase,
  DOCUMENT_CLASSIFICATION: 'document-classification' as UseCase
} as const;

// Test case structure for validating prompts
export interface TestCase {
  name: string;
  input: any;
  expectedOutput: string;
  description?: string;
}

// Test suite for comprehensive prompt validation
export interface TestSuite {
  name: string;
  cases: TestCase[];
  thresholds: {
    accuracy: number; // 0.0 to 1.0
    performance: number; // max execution time in ms
    formatCompliance: number; // 0.0 to 1.0
  };
}

// Metadata for prompt definitions
export interface PromptMetadata {
  description: string;
  created: Date;
  lastModified: Date;
  author: string;
  tags: string[];
  version: string;
  changelog: string[];
  tests: TestSuite[];
  dependencies?: string[]; // other prompts this prompt depends on
}

// Prompt definition structure
export interface PromptDefinition {
  id: string;
  useCase: UseCase;
  content: PromptContent;
  format: PromptFormat;
  metadata: PromptMetadata;
}

// Prompt version for version control
export interface PromptVersion {
  version: string;
  content: PromptContent;
  reason: string;
  date: Date;
  tests: TestSuite[];
  isActive: boolean;
}

// Registry metadata for listing prompts
export interface PromptMeta {
  id: string;
  useCase: UseCase;
  version: string;
  description: string;
  format: PromptFormat;
  tags: string[];
  lastModified: Date;
  testCount: number;
}

// Validation result for prompts
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  performance?: {
    executionTime: number;
    memoryUsage: number;
  };
}

// Registry configuration
export interface RegistryConfig {
  enableVersioning: boolean;
  enableTesting: boolean;
  enableCaching: boolean;
  cacheTTL: number; // Time to live in milliseconds
  maxVersionsPerPrompt: number;
}

// Search parameters for finding prompts
export interface PromptSearch {
  useCase?: UseCase;
  tags?: string[];
  format?: PromptFormat;
  author?: string;
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  text?: string; // Search in description or content
}

// Migration record for tracking prompt migrations
export interface MigrationRecord {
  id: string;
  fromLocation: string;
  toLocation: string;
  migrationDate: Date;
  status: 'success' | 'failed' | 'pending';
  notes?: string;
}

// Performance metrics for prompt usage
export interface PromptMetrics {
  promptId: string;
  useCase: UseCase;
  timestamp: Date;
  executionTime: number;
  success: boolean;
  error?: string;
  contextSize?: number;
}

// A/B testing configuration
export interface ABTestConfig {
  promptId: string;
  variants: {
    id: string;
    version: string;
    weight: number; // 0.0 to 1.0, sum should be 1.0
  }[];
  startDate: Date;
  endDate: Date;
  metrics: string[]; // metrics to track for comparison
}

// Registry statistics
export interface RegistryStats {
  totalPrompts: number;
  totalVersions: number;
  totalTests: number;
  averageTestCoverage: number;
  lastUpdated: Date;
  mostUsedPrompts: { id: string; count: number }[];
  performanceMetrics: {
    averageRetrievalTime: number;
    cacheHitRate: number;
  };
}

// Builder context for dynamic prompts
export interface BuilderContext {
  userContext?: any;
  inputData?: any;
  systemInfo?: {
    timestamp: Date;
    environment: string;
    version: string;
  };
  [key: string]: any;
}

// Template interpolation context
export interface TemplateContext {
  [key: string]: string | number | boolean | object;
}

// Error types for prompt registry
export enum PromptErrorType {
  PROMPT_NOT_FOUND = 'PROMPT_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  INVALID_PROMPT = 'INVALID_PROMPT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  VERSION_LIMIT_EXCEEDED = 'VERSION_LIMIT_EXCEEDED',
  CACHE_ERROR = 'CACHE_ERROR'
}

// Custom error class for prompt registry
export class PromptRegistryError extends Error {
  constructor(
    public type: PromptErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PromptRegistryError';
  }
}

// Configuration for the prompt management system
export const DEFAULT_REGISTRY_CONFIG: RegistryConfig = {
  enableVersioning: true,
  enableTesting: true,
  enableCaching: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxVersionsPerPrompt: 10
};

// Default metadata template
export const DEFAULT_METADATA: Partial<PromptMetadata> = {
  created: new Date(),
  lastModified: new Date(),
  author: 'system',
  tags: [],
  version: '1.0.0',
  changelog: ['Initial version'],
  tests: []
};