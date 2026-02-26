import type { ProductRegion, SparePartsLink } from './types';

/**
 * Maps ISO 3166-1 alpha-2 country codes to product regions.
 * Countries not listed default to 'global'.
 */
const COUNTRY_TO_REGION: Record<string, ProductRegion> = {
  // EU member states
  AT: 'eu', BE: 'eu', BG: 'eu', HR: 'eu', CY: 'eu', CZ: 'eu',
  DK: 'eu', EE: 'eu', FI: 'eu', FR: 'eu', DE: 'eu', GR: 'eu',
  HU: 'eu', IE: 'eu', IT: 'eu', LV: 'eu', LT: 'eu', LU: 'eu',
  MT: 'eu', NL: 'eu', PL: 'eu', PT: 'eu', RO: 'eu', SK: 'eu',
  SI: 'eu', ES: 'eu', SE: 'eu',
  // EEA / closely aligned
  NO: 'eu', IS: 'eu', LI: 'eu', CH: 'eu',
  // United Kingdom (post-Brexit separate region)
  GB: 'uk',
  // United States & territories
  US: 'us',
  // Asia-Pacific
  JP: 'asia', CN: 'asia', KR: 'asia', AU: 'asia', NZ: 'asia',
  SG: 'asia', HK: 'asia', TW: 'asia', TH: 'asia', MY: 'asia',
  PH: 'asia', IN: 'asia', ID: 'asia',
};

/**
 * Maps a 2-letter country code to a product region.
 * Returns 'global' if the country is not mapped.
 */
export function countryToRegion(country: string | null | undefined): ProductRegion | null {
  if (!country) return null;
  return COUNTRY_TO_REGION[country.toUpperCase()] ?? null;
}

/**
 * Infers a region from the browser's navigator.language string.
 * Examples: 'en-GB' → 'uk', 'en-US' → 'us', 'de-DE' → 'eu'
 */
export function localeToRegion(locale: string | null | undefined): ProductRegion | null {
  if (!locale) return null;
  const parts = locale.split('-');
  const country = parts.length > 1 ? parts[parts.length - 1] : null;
  return country ? countryToRegion(country) : null;
}

/**
 * Filters spare parts links by region.
 * Always includes 'global' links; additionally includes links matching the provided region.
 * If region is null, returns all links.
 */
export function filterSparePartsByRegion(
  links: SparePartsLink[],
  region: ProductRegion | null
): SparePartsLink[] {
  if (!region) return links;
  return links.filter(link => link.region === 'global' || link.region === region);
}
