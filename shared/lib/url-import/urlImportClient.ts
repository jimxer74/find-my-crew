'use client';

/**
 * Client-side URL Import Helper
 *
 * Utilities for detecting URLs in user input and fetching their content
 * via the /api/url-import/fetch-content endpoint. Handles sessionStorage
 * for persisting pending imports across Facebook OAuth redirects.
 */

export { isValidUrl } from './detectResourceType';

export function isFacebookUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes('facebook.com');
  } catch {
    return false;
  }
}

export interface UrlImportResult {
  content: string;
  resourceType: string;
  title?: string;
  author?: string;
  source: string;
  metadata: Record<string, unknown>;
}

/**
 * Fetch content from a URL via the server-side import API.
 * Throws an error with message 'AUTH_REQUIRED' for 401 responses.
 */
export async function fetchUrlContent(url: string): Promise<UrlImportResult> {
  const res = await fetch('/api/url-import/fetch-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (res.status === 403) {
      // Facebook (or other OAuth provider) auth required
      throw new Error('FACEBOOK_AUTH_REQUIRED');
    }
    let message = `Failed to fetch content (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      // ignore JSON parse failure
    }
    throw new Error(message);
  }

  return res.json() as Promise<UrlImportResult>;
}

// ─── SessionStorage helpers for persisting pending URL import across OAuth ────

const PENDING_KEY = 'fmc_pending_url_import';
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface PendingUrlImport {
  url: string;
  context: 'crew' | 'owner';
}

export function savePendingUrlImport(url: string, context: 'crew' | 'owner'): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ url, context, ts: Date.now() }));
  } catch {
    // sessionStorage may be unavailable (SSR, privacy mode)
  }
}

export function getPendingUrlImport(): PendingUrlImport | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { url: string; context: 'crew' | 'owner'; ts: number };
    if (Date.now() - data.ts > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return { url: data.url, context: data.context };
  } catch {
    return null;
  }
}

export function clearPendingUrlImport(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
