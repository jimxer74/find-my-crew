// Shared Libraries - Core platform services used across all modules

// Boat registry
export * from './boat-registry/service';

// Documents/Vault
export * from './documents';

// Facebook Integration
export * from './facebook';

// Feedback
export * from './feedback/service';
export * from './feedback/types';

// Geocoding
export * from './geocoding';

// Notifications
export * from './notifications';

// Async AI jobs — background execution + progress tracking
export type {
  AsyncJob,
  JobProgress,
  JobStatus,
  JobType,
  SubmitJobOptions,
  SubmitJobResult,
  GenerateJourneyPayload,
} from './async-jobs';
export { submitJob, useJobProgress, useJobResult } from './async-jobs';

// Onboarding - Owner and Prospect session management
export * as ownerSession from './owner/index';
export * as prospectSession from './prospect/index';
