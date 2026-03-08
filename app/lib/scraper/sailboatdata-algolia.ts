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

import type { SailboatSearchResult, SailboatDetails } from '../sailboatdata_queries';

// ---------------------------------------------------------------------------
// Algolia credentials — override via env vars if needed
// ---------------------------------------------------------------------------
const ALGOLIA_APP_ID = process.env.SAILBOATDATA_ALGOLIA_APP_ID ?? 'RR3D63YHAQ';
const ALGOLIA_SEARCH_KEY =
  process.env.SAILBOATDATA_ALGOLIA_KEY ?? '96f9765c6b9d7c0587cca6d57a862b3d';
const ALGOLIA_INDEX = process.env.SAILBOATDATA_ALGOLIA_INDEX ?? 'wp_posts_sailboat';

const ALGOLIA_ENDPOINT = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;

// ---------------------------------------------------------------------------
// Algolia hit shape
// ---------------------------------------------------------------------------
interface AlgoliaHit {
  post_title?: string;
  permalink?: string;
  objectID?: string;
  builder_name?: string;
  loa_metric?: string;    // meters, stored as string e.g. "11.57"
  beam?: number;          // feet (imperial)
  max_draft?: number;     // feet (imperial)
  displacement?: number;  // lbs (imperial)
  sa_disp_ratio?: number;
  bal_disp_ratio?: number;
  disp_len_ratio?: number;
  comfort_ratio?: number;
  capsize_ratio?: number; // maps to capsize_screening
  first_built?: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
}

/** Return type from algoliaFetchSailboatDetails */
export interface AlgoliaBoatData {
  searchResult: SailboatSearchResult;
  details: SailboatDetails;
}

// ---------------------------------------------------------------------------
// Attribute lists
// ---------------------------------------------------------------------------
const SEARCH_ATTRIBUTES = ['post_title', 'permalink'];

const DETAIL_ATTRIBUTES = [
  'post_title', 'permalink', 'builder_name',
  'loa_metric', 'beam', 'max_draft', 'displacement',
  'sa_disp_ratio', 'bal_disp_ratio', 'disp_len_ratio',
  'comfort_ratio', 'capsize_ratio', 'first_built',
];

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------
const FT_TO_M = 0.3048;
const LB_TO_KG = 0.453592;

// ---------------------------------------------------------------------------
// Core Algolia query (shared by search and details)
// ---------------------------------------------------------------------------
async function algoliaQuery(
  query: string,
  hitsPerPage: number,
  attributesToRetrieve: string[],
): Promise<AlgoliaHit[]> {
  const response = await fetch(ALGOLIA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_SEARCH_KEY,
    },
    body: JSON.stringify({ query: query.trim(), hitsPerPage, attributesToRetrieve }),
  });

  if (!response.ok) {
    throw new Error(`Algolia query failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AlgoliaResponse;
  return data.hits ?? [];
}

// ---------------------------------------------------------------------------
// Hit → SailboatSearchResult
// ---------------------------------------------------------------------------
function hitToSearchResult(hit: AlgoliaHit): SailboatSearchResult | null {
  const name = hit.post_title?.trim();
  const permalink = hit.permalink?.trim();
  if (!name || !permalink) return null;

  const slugMatch = permalink.match(/\/sailboat\/([^/]+)\/?$/);
  const slug = slugMatch?.[1];
  if (!slug) return null;

  return { name, url: permalink.replace(/\/$/, ''), slug };
}

// ---------------------------------------------------------------------------
// Hit → SailboatDetails
// ---------------------------------------------------------------------------
function hitToDetails(hit: AlgoliaHit, url: string): SailboatDetails {
  const fullName = hit.post_title?.trim() ?? '';
  const builderName = hit.builder_name?.trim() ?? '';

  // Derive make / model
  let make = builderName;
  let model = '';
  if (builderName && fullName.toUpperCase().startsWith(builderName.toUpperCase())) {
    model = fullName.slice(builderName.length).trim();
  } else {
    const parts = fullName.split(/\s+/);
    if (!make) make = parts[0] ?? '';
    model = parts.slice(1).join(' ');
  }

  const loa_m = hit.loa_metric ? parseFloat(hit.loa_metric) || null : null;
  const beam_m = hit.beam != null ? parseFloat((hit.beam * FT_TO_M).toFixed(3)) : null;
  const max_draft_m = hit.max_draft != null ? parseFloat((hit.max_draft * FT_TO_M).toFixed(3)) : null;
  const displcmt_m = hit.displacement != null ? Math.round(hit.displacement * LB_TO_KG) : null;

  return {
    make: make || undefined,
    model: model || undefined,
    make_model: fullName || undefined,
    loa_m,
    beam_m,
    max_draft_m,
    displcmt_m,
    sa_displ_ratio: hit.sa_disp_ratio ?? null,
    ballast_displ_ratio: hit.bal_disp_ratio ?? null,
    displ_len_ratio: hit.disp_len_ratio ?? null,
    comfort_ratio: hit.comfort_ratio ?? null,
    capsize_screening: hit.capsize_ratio ?? null,
    link_to_specs: url,
    // Not available from Algolia index:
    // type, capacity, average_speed_knots, hull_speed_knots,
    // ppi_pounds_per_inch, characteristics, capabilities, accommodations
  };
}

// ---------------------------------------------------------------------------
// Public: search (name + URL only)
// ---------------------------------------------------------------------------

/**
 * Search sailboatdata.com via Algolia REST API.
 *
 * @param query - Search string (e.g., "hallberg rassy 38")
 * @param hitsPerPage - Max results (default 20)
 */
export async function algoliaSearchSailboats(
  query: string,
  hitsPerPage = 20,
): Promise<SailboatSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const hits = await algoliaQuery(query, hitsPerPage, SEARCH_ATTRIBUTES);

  const results: SailboatSearchResult[] = [];
  for (const hit of hits) {
    const result = hitToSearchResult(hit);
    if (result) results.push(result);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public: fetch specs (search + extract in one round-trip)
// ---------------------------------------------------------------------------

/**
 * Fetch sailboat specifications from Algolia in a single API call.
 * Returns both the search result (slug/URL) and the mapped SailboatDetails.
 * Returns null if no match is found or spec data is insufficient.
 *
 * @param query - Boat name or search string (e.g., "ALLURES 44", "hallberg rassy 38")
 */
export async function algoliaFetchSailboatDetails(query: string): Promise<AlgoliaBoatData | null> {
  if (!query || query.trim().length < 2) return null;

  const hits = await algoliaQuery(query, 3, DETAIL_ATTRIBUTES);
  if (!hits.length) return null;

  const hit = hits[0];
  const searchResult = hitToSearchResult(hit);
  if (!searchResult) return null;

  const details = hitToDetails(hit, searchResult.url);

  // Require at least one dimensional spec before returning
  if (!details.loa_m && !details.beam_m && !details.displcmt_m) return null;

  return { searchResult, details };
}
