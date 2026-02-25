// @shared - Shared modules for all SailSmart applications
// This is the main entry point for the shared module

// Re-export all shared modules for convenience
export * from './types';
export * from './logging';
export * from './utils';
export * from './database';
export * from './auth';
export * from './ai';
export * from './ui';
export * from './hooks';
export * from './contexts';
export * from './lib';

// Version info
export const SHARED_VERSION = '0.1.0';
