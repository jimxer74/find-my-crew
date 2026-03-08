/**
 * sailboatdata-algolia.ts
 *
 * Direct Algolia search client for sailboatdata.com.
 * Sailboatdata uses Algolia for its search — credentials are public (read-only search key)
 * embedded in the site's JavaScript.
 *
 * Credentials (read-only, safe to embed):
 *   App ID:     RR3D63YHAQ
 *   Search Key: 96f9765c6b9d7c0587cca6d57a862b3d
 *   Index:      wp_posts_sailboat
 */

import type { SailboatSearchResult } from '../sailboatdata_queries';

// ---------------------------------------------------------------------------
// Algolia credentials — override via env vars if needed
// ---------------------------------------------------------------------------
const ALGOLIA_APP_ID = process.env.SAILBOATDATA_ALGOLIA_APP_ID ?? 'RR3D63YHAQ';
const ALGOLIA_SEARCH_KEY =
  process.env.SAILBOATDATA_ALGOLIA_KEY ?? '96f9765c6b9d7c0587cca6d57a862b3d';
const ALGOLIA_INDEX = process.env.SAILBOATDATA_ALGOLIA_INDEX ?? 'wp_posts_sailboat';

// Algolia DSN endpoint (low-latency read path)
const ALGOLIA_ENDPOINT = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

// ---------------------------------------------------------------------------
// Algolia hit shape (only fields we use)
// ---------------------------------------------------------------------------
interface AlgoliaHit {
  post_title?: string;
  permalink?: string;
  objectID?: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Search sailboatdata.com via Algolia REST API.
 *
 * @param query - Search string (e.g., "hallberg rassy 38")
 * @param hitsPerPage - Max results to return (default 20)
 * @returns Array of SailboatSearchResult mapped from Algolia hits
 */
export async function algoliaSearchSailboats(
  query: string,
  hitsPerPage = 20,
): Promise<SailboatSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const response = await fetch(ALGOLIA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
    },
    body: JSON.stringify({
      query: query.trim(),
      hitsPerPage,
      attributesToRetrieve: ['post_title', 'permalink'],
    }),
  });

  if (!response.ok) {
    throw new Error(`Algolia search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AlgoliaResponse;

  const results: SailboatSearchResult[] = [];

  for (const hit of data.hits ?? []) {
    const name = hit.post_title?.trim();
    const permalink = hit.permalink?.trim();

    if (!name || !permalink) continue;

    // Extract slug from permalink, e.g. "https://sailboatdata.com/sailboat/hallberg-rassy-38/"
    const slugMatch = permalink.match(/\/sailboat\/([^/]+)\/?$/);
    const slug = slugMatch?.[1];

    if (!slug) continue;

    // Normalize URL (strip trailing slash)
    const url = permalink.replace(/\/$/, '');

    results.push({ name, url, slug });
  }

  return results;
}
