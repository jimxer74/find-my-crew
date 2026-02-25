/**
 * URL Import Type Definitions
 *
 * Shared types for URL detection and content fetching
 */

export type ResourceType = 'facebook' | 'twitter' | 'generic';
export type AuthProvider = 'facebook' | 'twitter' | null;

export interface DetectionResult {
  resourceType: ResourceType;
  authProvider: AuthProvider;
  resourceId?: string;
  domain: string;
  metadata: Record<string, any>;
}

export interface FetchOptions {
  url: string;
  resourceType: ResourceType;
  authProvider?: AuthProvider;
  accessToken?: string;
  userId?: string;
}

export interface FetchResult {
  content: string;
  title?: string;
  author?: string;
  url: string;
  fetchedAt: string;
  source: 'api' | 'scraper';
  metadata: Record<string, any>;
}

export interface ImportedProfile {
  url: string;
  source: ResourceType;
  content: string;
  metadata: Record<string, any>;
}
