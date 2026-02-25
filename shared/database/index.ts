// Database module - Supabase client setup and helpers
// Note: Only export browser client and helpers here
// Server clients must be imported directly from './server' to avoid bundling next/headers in client code
export { getSupabaseBrowserClient } from './client';
export * from './helpers';
// Error response helper - only exporting sanitizeErrorResponse to avoid conflict with shared/utils/errors
export { sanitizeErrorResponse } from './errorResponseHelper';
