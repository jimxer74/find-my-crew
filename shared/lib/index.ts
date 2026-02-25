// Shared Libraries - Core platform services used across all modules

// Boat registry
export * from './boat-registry/service';

// Documents/Vault
export * from './documents/types';
export * from './documents/audit';

// Feedback
export * from './feedback/service';
export * from './feedback/types';

// Onboarding - Owner and Prospect session management
export * as ownerSession from './owner/index';
export * as prospectSession from './prospect/index';
