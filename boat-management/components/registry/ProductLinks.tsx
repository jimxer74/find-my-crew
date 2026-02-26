'use client';

import { useState, useEffect } from 'react';
import type { ProductRegistryEntry, ProductRegion } from '@boat-management/lib/types';
import { filterSparePartsByRegion, countryToRegion, localeToRegion } from '@boat-management/lib/region-utils';

interface ProductLinksProps {
  product: ProductRegistryEntry;
  /** User's country code from their profile (ISO 3166-1 alpha-2, e.g. 'DE', 'US') */
  userCountry?: string | null;
}

export function ProductLinks({ product, userCountry }: ProductLinksProps) {
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<ProductRegion | null>(null);

  useEffect(() => {
    if (userCountry) {
      setDetectedRegion(countryToRegion(userCountry));
    } else if (typeof navigator !== 'undefined') {
      setDetectedRegion(localeToRegion(navigator.language));
    }
  }, [userCountry]);

  if (!product.documentation_links?.length && !product.spare_parts_links?.length) {
    return null;
  }

  const visibleSpareParts = showAllRegions
    ? product.spare_parts_links
    : filterSparePartsByRegion(product.spare_parts_links, detectedRegion);

  const regionLabel: Record<string, string> = {
    eu: 'EU', us: 'US', uk: 'UK', asia: 'Asia', global: 'Global',
  };

  return (
    <div className="space-y-3 pt-1">
      {product.documentation_links.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Documentation
          </h4>
          <ul className="space-y-1">
            {product.documentation_links.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.spare_parts_links.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Spare Parts
            </h4>
            {product.spare_parts_links.length > visibleSpareParts.length && (
              <button
                onClick={() => setShowAllRegions(v => !v)}
                className="text-xs text-primary hover:underline"
              >
                {showAllRegions ? 'Show local only' : 'Show all regions'}
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {visibleSpareParts.map((link, i) => (
              <li key={i} className="flex items-center gap-2">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {link.title}
                </a>
                <span className="text-xs px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {regionLabel[link.region] ?? link.region}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
