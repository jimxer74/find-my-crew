/**
 * Utility functions to query sailboatdata.com and parse results
 */

import { logger } from './logger';

/**
 * Normalize Scandinavian characters to ASCII equivalents for URL query strings
 * @param text - Text that may contain Scandinavian characters
 * @returns Text with Scandinavian characters replaced (ö->o, ä->a, å->a, and uppercase versions)
 */
function normalizeScandinavianChars(text: string): string {
  return text
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ä/g, 'a')
    .replace(/Ä/g, 'A')
    .replace(/å/g, 'a')
    .replace(/Å/g, 'A');
}

/**
 * Fetch a URL using ScraperAPI if configured, otherwise use direct fetch
 * @param url - The target URL to fetch
 * @param options - Optional fetch options (headers, etc.)
 * @param render - Whether to enable JavaScript rendering (default: false)
 * @returns Response object
 */
async function fetchWithScraperAPI(url: string, options: RequestInit = {}, render: boolean = false): Promise<Response> {
  const scraperApiKey = process.env.SCRAPERAPI_API_KEY;
  
  if (scraperApiKey && scraperApiKey.trim() !== '' && scraperApiKey !== 'your_scraperapi_api_key_here') {
    // Use ScraperAPI
    const renderParam = render ? '&render=true' : '&render=false';
    const scraperApiUrl = `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}${renderParam}`;

    logger.debug('Using ScraperAPI for fetch', { targetUrl: url, render }, true);

    // ScraperAPI handles headers and browser simulation, so we use minimal headers
    const response = await fetch(scraperApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    return response;
  } else {
    // Fallback to direct fetch with browser headers
    logger.debug('Using direct fetch (ScraperAPI not configured)', { url }, true);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.google.com/',
        'Origin': 'https://www.google.com',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Sec-CH-UA': '"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge";v="131"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        ...options.headers,
      },
      redirect: 'follow',
      ...options,
    });
    
    return response;
  }
}

export interface SailboatResult {
  make: string;
  model: string;
  fullName: string; // "Make Model" format
}

export interface SailboatSearchResult {
  name: string; // "Make Model" format
  url: string; // Full URL like "https://sailboatdata.com/sailboat/hallberg-rassy-38"
  slug: string; // URL slug like "hallberg-rassy-38"
}

export interface SailboatDetails {
  make?: string;
  model?: string;
  make_model?: string;
  type?: 'Daysailers' | 'Coastal cruisers' | 'Traditional offshore cruisers' | 'Performance cruisers' | 'Multihulls' | 'Expedition sailboats' | null;
  capacity?: number | null;
  loa_m?: number | null;
  beam_m?: number | null;
  max_draft_m?: number | null;
  displcmt_m?: number | null;
  average_speed_knots?: number | null;
  link_to_specs?: string;
  characteristics?: string;
  capabilities?: string;
  accommodations?: string;
  sa_displ_ratio?: number | null;
  ballast_displ_ratio?: number | null;
  displ_len_ratio?: number | null;
  comfort_ratio?: number | null;
  capsize_screening?: number | null;
  hull_speed_knots?: number | null;
  ppi_pounds_per_inch?: number | null;
}

/**
 * Search sailboatdata.com and parse results with URLs
 * @param keyword - Search keyword (what user typed)
 * @returns Array of sailboat search results with names and URLs
 */
export async function searchSailboatData(keyword: string): Promise<SailboatSearchResult[]> {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }

  // Normalize Scandinavian characters before creating URL
  const normalizedKeyword = normalizeScandinavianChars(keyword.trim());
  const searchUrl = `https://sailboatdata.com/?keyword=${encodeURIComponent(normalizedKeyword)}&sort-select&sailboats_per_page=50`;

  logger.debug('Searching sailboatdata', { keyword, normalizedKeyword }, true);

  try {
    // Fetch the HTML page using ScraperAPI if configured, otherwise direct fetch
    // Enable JavaScript rendering since search results are loaded dynamically via Algolia
    const response = await fetchWithScraperAPI(searchUrl, {}, true);

    if (!response.ok) {
      logger.error('Fetch error from sailboatdata', { status: response.status, statusText: response.statusText, url: searchUrl });

      return [];
    }

    const html = await response.text();

    // Parse HTML to extract sailboat names and URLs
    const sailboats = parseSailboatSearchHTML(html, keyword);

    logger.debug('Sailboats found in search', { count: sailboats.length }, true);

    return sailboats;
  } catch (error) {
    logger.error('Error searching sailboatdata.com', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * Query sailboatdata.com and parse sailboat results (legacy function, returns strings only)
 * @param keyword - Search keyword (what user typed)
 * @returns Array of sailboat results in "Make Model" format
 */
export async function querySailboatData(keyword: string): Promise<string[]> {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }

  // Normalize Scandinavian characters before creating URL
  const normalizedKeyword = normalizeScandinavianChars(keyword.trim());
  const searchUrl = `https://sailboatdata.com/?keyword=${encodeURIComponent(normalizedKeyword)}&sort-select&sailboats_per_page=50`;

  logger.debug('Querying sailboatdata', { keyword, normalizedKeyword }, true);

  try {
    // Fetch the HTML page with realistic browser headers to avoid 403 errors
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://www.google.com/',
        'Origin': 'https://www.google.com',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Sec-CH-UA': '"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge";v="131"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
      },
      // Add redirect handling
      redirect: 'follow',
    });

    if (!response.ok) {
      logger.error('Fetch error from sailboatdata', { status: response.status, statusText: response.statusText, url: searchUrl });

      return [];
    }

    const html = await response.text();

    // Parse HTML to extract MODEL column data
    const sailboats = parseSailboatDataHTML(html, keyword);

    logger.debug('Sailboats found in query', { count: sailboats.length }, true);

    return sailboats;
  } catch (error) {
    logger.error('Error querying sailboatdata.com', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * Fetch detailed sailboat data from a specific sailboat page
 * @param sailboatQueryStr - The sailboat identifier/slug (e.g., "hallberg-rassy-38") or make/model string
 * @param slug - Optional: Direct slug from search results (more reliable than converting make_model)
 * @returns Parsed sailboat details or null if not found
 */
export async function fetchSailboatDetails(sailboatQueryStr: string, slug?: string): Promise<SailboatDetails | null> {
  if (!sailboatQueryStr || sailboatQueryStr.trim().length === 0) {
    return null;
  }

  // Check boat registry first (cache layer)
  try {
    const { lookupBoatRegistry, registryToSailboatDetails, incrementRegistryFetchCount } =
      await import('@shared/lib/boat-registry/service');

    const registryEntry = await lookupBoatRegistry(sailboatQueryStr.trim(), slug);
    if (registryEntry) {
      logger.debug('Found boat in registry', { makeModel: registryEntry.make_model }, true);

      // Only use registry entry if it has at least some spec data
      // If all spec fields are null, fall through to fetch fresh data from external API
      const hasSpecData = registryEntry.loa_m !== null
        || registryEntry.beam_m !== null
        || registryEntry.displcmt_m !== null
        || registryEntry.max_draft_m !== null
        || registryEntry.sa_displ_ratio !== null;

      if (hasSpecData) {
        // Increment fetch count asynchronously (don't wait for it)
        incrementRegistryFetchCount(registryEntry.id).catch(err =>
          logger.warn('Failed to increment registry fetch count', { error: err instanceof Error ? err.message : String(err) })
        );

        return registryToSailboatDetails(registryEntry);
      }

      logger.debug('Registry entry has no spec data - fetching from external source', { makeModel: registryEntry.make_model }, true);
    }

    logger.debug('Registry miss - fetching from external source', { query: sailboatQueryStr }, true);
  } catch (error) {
    // If registry lookup fails, continue with external fetch (non-fatal)
    logger.warn('Registry lookup failed - continuing with external fetch', { error: error instanceof Error ? error.message : String(error) });
  }

  // Use provided slug if available, otherwise discover it via search
  let cleanQuery: string;
  if (slug && slug.trim().length > 0) {
    cleanQuery = slug.trim();
  } else {
    // Try to find the correct slug by searching sailboatdata.com first.
    // This avoids guessing the URL structure from the make_model string
    // (e.g. "EXPLORATION 60 (GARCIA)" → search finds slug "garcia-exploration-60").
    const searchKeyword = sailboatQueryStr
      .trim()
      .replace(/\s*\([^)]*\)\s*/g, ' ')  // strip parentheticals for search keyword
      .replace(/\s+/g, ' ')
      .trim();
    try {
      const searchResults = await searchSailboatData(searchKeyword);
      if (searchResults.length > 0) {
        cleanQuery = searchResults[0].slug;
        logger.debug('Discovered slug via search', { keyword: searchKeyword, slug: cleanQuery }, true);
      } else {
        // Fallback: slugify the original string as-is (no reordering)
        const normalizedQuery = normalizeScandinavianChars(sailboatQueryStr.trim());
        cleanQuery = normalizedQuery
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        logger.debug('No search results — falling back to direct slug', { slug: cleanQuery }, true);
      }
    } catch {
      // Fallback: slugify the original string as-is
      const normalizedQuery = normalizeScandinavianChars(sailboatQueryStr.trim());
      cleanQuery = normalizedQuery
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }
  }

  const sailboatUrl = `https://sailboatdata.com/sailboat/${cleanQuery}`;

  logger.debug('Fetching sailboat details', { queryString: sailboatQueryStr, cleanedQuery: cleanQuery }, true);

  try {
    // Add a small delay to avoid rate limiting (only for direct fetch, ScraperAPI handles this)
    const scraperApiKey = process.env.SCRAPERAPI_API_KEY;
    if (!scraperApiKey || scraperApiKey.trim() === '' || scraperApiKey === 'your_scraperapi_api_key_here') {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    }

    // Fetch the HTML page using ScraperAPI if configured, otherwise direct fetch
    const response = await fetchWithScraperAPI(sailboatUrl);

    if (!response.ok) {
      logger.error('Fetch error for sailboat details', { status: response.status, statusText: response.statusText, url: sailboatUrl });
      return null;
    }

    const html = await response.text();

    // Parse HTML to extract boat details
    const details = parseSailboatDetailsHTML(html, sailboatUrl);

    logger.debug('Sailboat details parsed', { makeModel: details.make_model }, true);

    // Save to registry before returning (non-blocking)
    if (details && details.make_model) {
      try {
        const { saveBoatRegistry } = await import('@shared/lib/boat-registry/service');
        // Use details.make_model (from parsed HTML) as the canonical name for registry.
        // Use cleanQuery as slug — it is the discovered slug from search, more reliable than the caller-supplied slug param.
        await saveBoatRegistry(details.make_model, details, cleanQuery || slug);
        logger.debug('Saved to boat registry', { makeModel: details.make_model }, true);
      } catch (error) {
        // Registry save failure is non-fatal - continue with returning details
        logger.warn('Failed to save to registry (non-fatal)', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return details;
  } catch (error) {
    logger.error('Error fetching sailboat details', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Parse HTML from sailboatdata.com sailboat detail page to extract boat specifications
 * @param html - HTML content from sailboatdata.com sailboat page
 * @param url - The URL of the page (for link_to_specs)
 * @returns Parsed sailboat details
 */
function parseSailboatDetailsHTML(html: string, url: string): SailboatDetails {
  const details: SailboatDetails = {
    link_to_specs: url,
  };

  try {
    // Extract Make and Model from H1 heading (most reliable)
    // Pattern: <h1>NAJAD 450 CC</h1>
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      const title = h1Match[1].trim();
      const parsed = parseSailboatName(title);
      if (parsed.make) details.make = parsed.make;
      if (parsed.model) details.model = parsed.model;
      if (parsed.make && parsed.model) {
        details.make_model = `${parsed.make} ${parsed.model}`;
      }
    }

    // Extract data from "Sailboat Specifications" table
    // The table structure is: <table class="table"><tbody class="table-light"><tr><td>Label</td><td>Value</td></tr>
    const specTableMatch = html.match(/<h4>Sailboat Specifications<\/h4>[\s\S]*?<table[^>]*class=["']table["'][^>]*>([\s\S]*?)<\/table>/i);
    if (specTableMatch) {
      const tableContent = specTableMatch[1];

      // Extract LOA - Pattern: <td>LOA:</td><td>44.29 ft / 13.50 m</td>
      const loaMatch = tableContent.match(/<td[^>]*>LOA:<\/td>\s*<td[^>]*>[\d.]+[\s\w\/]*\/\s*([\d.]+)\s*m/i);
      if (loaMatch) {
        details.loa_m = parseFloat(loaMatch[1]);
      }

      // Extract Beam - Pattern: <td>Beam:</td><td>13.29 ft / 4.05 m</td>
      // Allow two decimals in metric value: [\d.]+ matches x.xx format
      const beamMatch = tableContent.match(/<td[^>]*>Beam:<\/td>\s*<td[^>]*>[\d.]+[\s\w\/]*\/\s*([\d.]+)\s*m/i);
      if (beamMatch) {
        details.beam_m = parseFloat(beamMatch[1]);
      }

      // Extract Max Draft - Pattern: <td>Max Draft:</td><td>6.56 ft / 2.00 m</td>
      const maxDraftMatch = tableContent.match(/<td[^>]*>Max\s+Draft:<\/td>\s*<td[^>]*>[\d.]+[\s\w\/]*\/\s*([\d.]+)\s*m/i);
      if (maxDraftMatch) {
        details.max_draft_m = parseFloat(maxDraftMatch[1]);
        logger.debug('Parsed max draft', { draftM: details.max_draft_m }, true);
      }

      // Extract Displacement - Pattern: <td>Displacement:</td><td>31,967.00 lb / 14,500 kg</td>
      // Note: Pounds value may have decimals (31,967.00), but we extract the kg value (14,500)
      // Pattern allows for decimal points in pounds value: [\d,.]+
      const displMatch = tableContent.match(/<td[^>]*>Displacement:<\/td>\s*<td[^>]*>[\d,.]+[\s\w\/]*\/\s*([\d,]+)\s*kg/i);
      if (displMatch && displMatch[1]) {
        details.displcmt_m = parseFloat(displMatch[1].replace(/,/g, ''));
        logger.debug('Parsed displacement', { displacementKg: details.displcmt_m }, true);
      } else {
        // Fallback: extract the entire cell content and parse kg value manually
        const displCellMatch = tableContent.match(/<td[^>]*>Displacement:<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
        if (displCellMatch) {
          const cellContent = displCellMatch[1].trim();
          logger.debug('Parsing displacement from cell content', {}, true);
          // Try to extract kg value - look for pattern: "X / Y kg" or "X lb / Y kg"
          const kgMatch = cellContent.match(/\/([\s\S]*?)([\d,]+)\s*kg/i);
          if (kgMatch && kgMatch[2]) {
            details.displcmt_m = parseFloat(kgMatch[2].replace(/,/g, ''));
            logger.debug('Extracted displacement from fallback pattern', { displacementKg: details.displcmt_m }, true);
          } else {
            logger.debug('Could not extract kg value from displacement cell', {}, true);
          }
        }
      }

      // Extract Ballast - Pattern: <td>Ballast:</td><td>10,582.00 lb / 4,800 kg</td>
      const ballastMatch = tableContent.match(/<td[^>]*>Ballast:<\/td>\s*<td[^>]*>[\d,]+[\s\w\/]*\/\s*([\d,]+)\s*kg/i);
      // Note: We don't calculate ballast/displacement ratio here - use the value from Calculations table instead

      // Extract LWL (for hull speed calculation if needed)
      const lwlMatch = tableContent.match(/<td[^>]*>LWL:<\/td>\s*<td[^>]*>[\d.]+[\s\w\/]*\/\s*([\d.]+)\s*m/i);
      // Store LWL if needed for calculations, but not in details object as it's not in our schema
    }

    // Extract data from "Sailboat Calculations" table
    // Pattern: <h4>Sailboat Calculations</h4>...<table>...<tr><td>S.A. / Displ.:</td><td>17.76</td></tr>
    const calcTableMatch = html.match(/<h4>Sailboat Calculations<\/h4>[\s\S]*?<table[^>]*class=["']table["'][^>]*>([\s\S]*?)<\/table>/i);
    if (calcTableMatch) {
      const calcTableContent = calcTableMatch[1];

      // S.A. / Displ. - Pattern: <td>S.A. / Displ.:</td><td>17.76</td>
      const saDisplMatch = calcTableContent.match(/<td[^>]*>S\.A\.\s*\/\s*Displ\.?:<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      if (saDisplMatch) {
        details.sa_displ_ratio = parseFloat(saDisplMatch[1]);
      }

      // Bal. / Displ. - Pattern: <td>Bal. / Displ.:</td><td>33.80</td> (keep as-is, no conversion)
      const balDisplMatch = calcTableContent.match(/<td[^>]*>Bal\.\s*\/\s*Displ\.?:<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      if (balDisplMatch) {
        details.ballast_displ_ratio = parseFloat(balDisplMatch[1]); // Keep as percentage (e.g., 33.80)
      }

      // Disp: / Len - Pattern: <td>Disp: / Len:</td><td>262.35</td>
      // Note: The actual HTML has a colon after "Len:" as well
      // Try multiple patterns to handle variations in HTML formatting
      let displLenMatch = calcTableContent.match(/<td[^>]*>Disp\.?\s*:\s*\/\s*Len\s*:?<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      if (!displLenMatch) {
        // Try with trailing colon: "Disp: / Len:"
        displLenMatch = calcTableContent.match(/<td[^>]*>Disp\s*:\s*\/\s*Len\s*:<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      }
      if (!displLenMatch) {
        // Try without colon after Len: "Disp: / Len"
        displLenMatch = calcTableContent.match(/<td[^>]*>Disp\.?\s*:\s*\/\s*Len<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      }
      if (!displLenMatch) {
        // Try without colon: "Disp. / Len" or "Disp / Len"
        displLenMatch = calcTableContent.match(/<td[^>]*>Disp\.?\s*\/\s*Len\s*:?<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      }
      if (!displLenMatch) {
        // Try more flexible pattern: any variation of Disp/Disp./Disp: followed by / Len (with optional trailing colon)
        displLenMatch = calcTableContent.match(/<td[^>]*>Disp[\.:]?\s*\/\s*Len\s*:?<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      }
      if (!displLenMatch) {
        // Try finding the row first, then extracting the value (with optional trailing colon after Len)
        const dispLenRowMatch = calcTableContent.match(/<tr[^>]*>[\s\S]*?<td[^>]*>Disp[\.:]?\s*\/\s*Len\s*:?<\/td>\s*<td[^>]*>([\d.]+)<\/td>[\s\S]*?<\/tr>/i);
        if (dispLenRowMatch) {
          displLenMatch = dispLenRowMatch;
        }
      }
      if (!displLenMatch) {
        // Last resort: find any row containing both "Disp" and "Len", then extract the number from the next cell
        const rows = calcTableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (const row of rows) {
          if (/Disp/i.test(row) && /Len/i.test(row)) {
            // Try multiple patterns to extract the value
            let valueMatch = row.match(/<td[^>]*>Disp[^<]*<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
            if (!valueMatch) {
              // Try with whitespace variations
              valueMatch = row.match(/<td[^>]*>Disp[^<]*<\/td>[\s\S]*?<td[^>]*>([\d.]+)<\/td>/i);
            }
            if (!valueMatch) {
              // Try extracting any number after the label cell
              const cells = row.match(/<td[^>]*>([^<]+)<\/td>/gi) || [];
              for (let i = 0; i < cells.length - 1; i++) {
                if (/Disp/i.test(cells[i]) && /Len/i.test(cells[i])) {
                  const nextCell = cells[i + 1];
                  const numMatch = nextCell.match(/([\d.]+)/);
                  if (numMatch && numMatch[1]) {
                    // Create a match-like structure
                    displLenMatch = [row, numMatch[1]] as RegExpMatchArray;
                    break;
                  }
                }
              }
            }
            if (valueMatch) {
              displLenMatch = valueMatch;
              break;
            }
          }
        }
      }
      if (!displLenMatch) {
        // Debug: log a snippet of the calculations table to see what's actually there
        logger.debug('Disp/Len pattern not found - debugging', { tableSnippetLength: calcTableContent.substring(0, 2000).length }, true);
      }
      if (displLenMatch) {
        details.displ_len_ratio = parseFloat(displLenMatch[1]);
        logger.debug('Successfully parsed Disp/Len ratio', { ratio: details.displ_len_ratio }, true);
      }

      // Comfort Ratio - Pattern: <td>Comfort Ratio:</td><td>37.36</td>
      const comfortMatch = calcTableContent.match(/<td[^>]*>Comfort\s+Ratio:<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      if (comfortMatch) {
        details.comfort_ratio = parseFloat(comfortMatch[1]);
      }

      // Capsize Screening Formula - Pattern: <td>Capsize Screening Formula:</td><td>1.69</td>
      const capsizeMatch = calcTableContent.match(/<td[^>]*>Capsize\s+Screening\s+Formula:<\/td>\s*<td[^>]*>([\d.]+)<\/td>/i);
      if (capsizeMatch) {
        details.capsize_screening = parseFloat(capsizeMatch[1]);
      }

      // Hull Speed - Pattern: <td>Hull Speed:</td><td>8.48 kn</td>
      const hullSpeedMatch = calcTableContent.match(/<td[^>]*>Hull\s+Speed:<\/td>\s*<td[^>]*>([\d.]+)\s*kn/i);
      if (hullSpeedMatch) {
        details.hull_speed_knots = parseFloat(hullSpeedMatch[1]);
      }

      // Pounds/Inch Immersion - Pattern: <td>Pounds/Inch Immersion:</td><td>1,900.89 pounds/inch</td>
      const ppiMatch = calcTableContent.match(/<td[^>]*>Pounds\/Inch\s+Immersion:<\/td>\s*<td[^>]*>([\d,]+)\s*pounds\/inch/i);
      if (ppiMatch) {
        details.ppi_pounds_per_inch = parseFloat(ppiMatch[1].replace(/,/g, ''));
      }
    }

    // Extract Notes section for characteristics/description
    // Pattern: <h4>Notes</h4>...<div class="spec-notes">Shallow draft keel: 2.1m / 6.89ft.<br />Updated version of the 440 CC</div>
    const notesMatch = html.match(/<h4>Notes<\/h4>[\s\S]*?<div[^>]*class=["'][^"']*spec-notes[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (notesMatch) {
      const notesText = notesMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      if (notesText && notesText.length > 10) {
        details.characteristics = notesText;
      }
    }

    // Try to extract capacity from Accommodations section if available
    // Pattern: <h4>Accommodations</h4>...<td>Water:</td><td>145 gals / 550 L</td>
    // Note: Capacity might be in berths or sleeps, but not always present in this section
    // We'll look for it in the main specs table too
    const accommodationsMatch = html.match(/<h4>Accommodations<\/h4>[\s\S]*?<table[^>]*class=["']table["'][^>]*>([\s\S]*?)<\/table>/i);
    if (accommodationsMatch) {
      const accTableContent = accommodationsMatch[1];
      // Look for berths or sleeps
      const berthsMatch = accTableContent.match(/<td[^>]*>(?:Berths|Sleeps|Sleeping)[^<]*:<\/td>\s*<td[^>]*>(\d+)/i);
      if (berthsMatch) {
        details.capacity = parseInt(berthsMatch[1], 10);
      }
    }

    // Also check main specs table for capacity/berths
    if (!details.capacity && specTableMatch) {
      const berthsMatch = specTableMatch[1].match(/<td[^>]*>(?:Berths|Sleeps|Sleeping|Capacity)[^<]*:<\/td>\s*<td[^>]*>(\d+)/i);
      if (berthsMatch) {
        details.capacity = parseInt(berthsMatch[1], 10);
      }
    }

    // Calculate average speed estimate based on hull speed if available
    // Typical cruising speed is 60-80% of hull speed
    if (details.hull_speed_knots && !details.average_speed_knots) {
      details.average_speed_knots = details.hull_speed_knots * 0.7; // 70% of hull speed as estimate
    }

    return details;
  } catch (error) {
    logger.error('Error parsing sailboat details HTML', { error: error instanceof Error ? error.message : String(error) });
    return details; // Return partial details if parsing fails
  }
}

/**
 * Parse HTML from sailboatdata.com search results to extract sailboat names and URLs
 * @param html - HTML content from sailboatdata.com search results
 * @param keyword - Original search keyword for filtering
 * @returns Array of sailboat search results with names and URLs
 */
function parseSailboatSearchHTML(html: string, keyword: string): SailboatSearchResult[] {
  const results: SailboatSearchResult[] = [];
  const keywordLower = keyword.toLowerCase();

  try {
    // Debug: Log HTML snippet for inspection
    logger.debug('Parsing sailboat search HTML', { htmlLength: html.length }, true);

    // Strategy 1: Look for links in the results table (sailboats-table)
    // Pattern: <table class="sailboats-table"> ... <tbody> ... <tr> ... <td data-title="MODEL"> ... <a href="/sailboat/[slug]">Name</a>
    const tableBodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;
    const tbodyMatch = html.match(tableBodyRegex);
    
    if (tbodyMatch && tbodyMatch[1]) {
      const tbodyContent = tbodyMatch[1];
      // Extract all table rows from tbody
      const rowRegex = /<tr[^>]*data-sailboat=["']([^"']+)["'][^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      
      while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
        const rowContent = rowMatch[2];
        // Look for MODEL cell with link
        const modelCellRegex = /<td[^>]*data-title=["']MODEL["'][^>]*>([\s\S]*?)<\/td>/i;
        const modelCellMatch = rowContent.match(modelCellRegex);
        
        if (modelCellMatch && modelCellMatch[1]) {
          // Extract link from MODEL cell
          const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i;
          const linkMatch = modelCellMatch[1].match(linkRegex);
          
          if (linkMatch) {
            const urlPath = linkMatch[1].trim();
            const sailboatName = linkMatch[2]
              .replace(/<[^>]+>/g, '') // Remove any nested HTML tags
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (sailboatName && sailboatName.length > 2 && urlPath) {
              // Extract slug from URL path (could be /sailboat/slug or full URL)
              let slug = '';
              let fullUrl = '';
              
              if (urlPath.startsWith('http')) {
                fullUrl = urlPath;
                const slugMatch = urlPath.match(/\/sailboat\/([^\/\?]+)/);
                slug = slugMatch ? slugMatch[1] : '';
              } else if (urlPath.startsWith('/sailboat/')) {
                const slugMatch = urlPath.match(/\/sailboat\/([^\/\?]+)/);
                slug = slugMatch ? slugMatch[1] : '';
                fullUrl = `https://sailboatdata.com${urlPath}`;
              } else if (urlPath.startsWith('/')) {
                // Handle other relative paths
                fullUrl = `https://sailboatdata.com${urlPath}`;
                slug = urlPath.replace(/^\//, '').split('/')[0];
              }
              
              // Filter by keyword match
              if (slug && fullUrl && sailboatName.toLowerCase().includes(keywordLower)) {
                if (!results.find(r => r.url === fullUrl || r.slug === slug)) {
                  results.push({
                    name: sailboatName,
                    url: fullUrl,
                    slug: slug,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Strategy 2: Look for any links to sailboat pages (fallback - catches links outside table)
    // Pattern: <a href="/sailboat/[slug]">Make Model</a>
    const sailboatLinkRegex = /<a[^>]*href=["'](\/sailboat\/[^"'\?]+)[^"']*["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = sailboatLinkRegex.exec(html)) !== null) {
      const urlPath = match[1].trim();
      const sailboatName = match[2].trim();
      
      // Clean up HTML entities and extra whitespace
      const cleaned = sailboatName
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned && cleaned.length > 2 && urlPath) {
        // Extract slug from URL path
        const slugMatch = urlPath.match(/\/sailboat\/([^\/\?]+)/);
        const slug = slugMatch ? slugMatch[1] : '';
        const fullUrl = `https://sailboatdata.com${urlPath}`;
        
        // Filter by keyword match and avoid duplicates
        if (slug && cleaned.toLowerCase().includes(keywordLower)) {
          if (!results.find(r => r.url === fullUrl || r.slug === slug)) {
            results.push({
              name: cleaned,
              url: fullUrl,
              slug: slug,
            });
          }
        }
      }
    }

    // Strategy 3: Look for links in table rows (additional fallback)
    const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = html.match(tableRowRegex) || [];

    for (const row of rows) {
      // Look for links in table rows that point to sailboat pages
      const rowLinkRegex = /<a[^>]*href=["'](\/sailboat\/[^"'\?]+)[^"']*["'][^>]*>([^<]+)<\/a>/gi;
      let linkMatch;
      
      while ((linkMatch = rowLinkRegex.exec(row)) !== null) {
        const urlPath = linkMatch[1].trim();
        const linkText = linkMatch[2].trim();
        const cleaned = linkText
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Check if it looks like a sailboat name
        if (cleaned && 
            cleaned.length > 2 && 
            cleaned.length < 100 &&
            /^[A-Z]/.test(cleaned) &&
            /[a-zA-Z]/.test(cleaned) &&
            cleaned.toLowerCase().includes(keywordLower)) {
          
          const slugMatch = urlPath.match(/\/sailboat\/([^\/\?]+)/);
          const slug = slugMatch ? slugMatch[1] : '';
          const fullUrl = `https://sailboatdata.com${urlPath}`;
          
          if (slug && !results.find(r => r.url === fullUrl || r.slug === slug)) {
            results.push({
              name: cleaned,
              url: fullUrl,
              slug: slug,
            });
          }
        }
      }
    }

    // Sort results by relevance (exact matches first, then alphabetical)
    const sorted = results
      .filter(result => {
        const nameLower = result.name.toLowerCase();
        return nameLower.includes(keywordLower);
      })
      .sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const aStarts = aLower.startsWith(keywordLower);
        const bStarts = bLower.startsWith(keywordLower);
        
        // Exact start matches first
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Then by length (shorter/more specific first)
        if (a.name.length !== b.name.length) {
          return a.name.length - b.name.length;
        }
        
        // Finally alphabetical
        return aLower.localeCompare(bLower);
      })
      .slice(0, 10); // Limit to 10 results

    return sorted;
  } catch (error) {
    logger.error('Error parsing sailboatdata.com search HTML', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * Parse HTML from sailboatdata.com to extract sailboat make and model (legacy function)
 * @param html - HTML content from sailboatdata.com search results
 * @param keyword - Original search keyword for filtering
 * @returns Array of sailboat names in "Make Model" format
 */
function parseSailboatDataHTML(html: string, keyword: string): string[] {
  const results: string[] = [];
  const keywordLower = keyword.toLowerCase();

  try {
    // Debug: Log HTML snippet for inspection
    logger.debug('Parsing sailboatdata HTML for keyword', { keyword, htmlLength: html.length }, true);

    // Strategy 1: Look for links to sailboat pages (most reliable)
    // Pattern: <a href="/sailboat/[slug]">Make Model</a>
    const sailboatLinkRegex = /<a[^>]*href=["']\/sailboat\/[^"']*["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = sailboatLinkRegex.exec(html)) !== null) {
      const sailboatName = match[1].trim();
      // Clean up HTML entities and extra whitespace
      const cleaned = sailboatName
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (cleaned && cleaned.length > 2) {
        // Filter by keyword match
        if (cleaned.toLowerCase().includes(keywordLower)) {
          if (!results.includes(cleaned)) {
            results.push(cleaned);
          }
        }
      }
    }

    // Strategy 2: Look for table cells with MODEL class or containing model data
    // Pattern: <td class="model"> or <td> containing sailboat names
    const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = html.match(tableRowRegex) || [];

    for (const row of rows) {
      // Look for table cells - try multiple patterns
      // Pattern A: Cells with class containing "model"
      const modelCellRegex = /<td[^>]*class=["'][^"']*model[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      
      while ((cellMatch = modelCellRegex.exec(row)) !== null) {
        const cellContent = cellMatch[1];
        // Extract text from cell (remove HTML tags)
        const textContent = cellContent
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (textContent && textContent.length > 2 && textContent.length < 100) {
          // Check if it looks like a sailboat name
          if (/^[A-Z][a-zA-Z\s\-0-9]+$/.test(textContent) && textContent.toLowerCase().includes(keywordLower)) {
            if (!results.includes(textContent)) {
              results.push(textContent);
            }
          }
        }
      }

      // Pattern B: Look for any links in table rows that might be sailboat names
      const rowLinkRegex = /<a[^>]*>([^<]+)<\/a>/gi;
      let linkMatch;
      
      while ((linkMatch = rowLinkRegex.exec(row)) !== null) {
        const linkText = linkMatch[1].trim();
        const cleaned = linkText
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Check if it looks like a sailboat name (starts with capital, contains letters)
        if (cleaned && 
            cleaned.length > 2 && 
            cleaned.length < 100 &&
            /^[A-Z]/.test(cleaned) &&
            /[a-zA-Z]/.test(cleaned) &&
            cleaned.toLowerCase().includes(keywordLower)) {
          if (!results.includes(cleaned)) {
            results.push(cleaned);
          }
        }
      }
    }

    // Strategy 3: Look for data attributes or specific sailboatdata.com patterns
    // Sometimes they use data-model or similar attributes
    const dataModelRegex = /data-model=["']([^"']+)["']/gi;
    let dataMatch;
    
    while ((dataMatch = dataModelRegex.exec(html)) !== null) {
      const modelName = dataMatch[1].trim();
      if (modelName && modelName.toLowerCase().includes(keywordLower)) {
        if (!results.includes(modelName)) {
          results.push(modelName);
        }
      }
    }

    // Sort results by relevance (exact matches first, then alphabetical)
    const sorted = results
      .filter(name => {
        const nameLower = name.toLowerCase();
        return nameLower.includes(keywordLower);
      })
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const aStarts = aLower.startsWith(keywordLower);
        const bStarts = bLower.startsWith(keywordLower);
        
        // Exact start matches first
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Then by length (shorter/more specific first)
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        
        // Finally alphabetical
        return aLower.localeCompare(bLower);
      })
      .slice(0, 10); // Limit to 10 results

    return sorted;
  } catch (error) {
    logger.error('Error parsing sailboatdata.com HTML', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

/**
 * Extract sailboat make and model from a full name string
 * @param fullName - Full sailboat name like "Hallberg-Rassy 38"
 * @returns Object with make and model separated
 */
export function parseSailboatName(fullName: string): { make: string; model: string } {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { make: '', model: '' };
  }
  
  // First word is typically the make
  const make = parts[0];
  // Rest is the model
  const model = parts.slice(1).join(' ');
  
  return { make, model };
}
