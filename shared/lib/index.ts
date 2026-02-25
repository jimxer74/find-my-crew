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

// Notifications
export * from './notifications';

// Onboarding - Owner and Prospect session management
export * as ownerSession from './owner/index';
export * as prospectSession from './prospect/index';
