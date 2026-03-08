'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BoatEquipment, ProductRegistryEntry, ProductRegion } from '@boat-management/lib/types';
import { filterSparePartsByRegion, countryToRegion, localeToRegion } from '@boat-management/lib/region-utils';
import { submitJob } from '@shared/lib/async-jobs/submitJob';
import { JobProgressPanel } from '@shared/components/async-jobs/JobProgressPanel';

interface ProductLinksProps {
  product: ProductRegistryEntry;
  /** User's country code from their profile (ISO 3166-1 alpha-2, e.g. 'DE', 'US') */
  userCountry?: string | null;
  /** Equipment info and context for fetching documentation */
  equipment?: BoatEquipment & { boat_id?: string; boat_make_model?: string };
  /** Callback to refresh product data after fetching */
  onRefresh?: () => Promise<void>;
}

export function ProductLinks({ product, userCountry, equipment, onRefresh }: ProductLinksProps) {
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [detectedRegion, setDetectedRegion] = useState<ProductRegion | null>(null);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (userCountry) {
      setDetectedRegion(countryToRegion(userCountry));
    } else if (typeof navigator !== 'undefined') {
      setDetectedRegion(localeToRegion(navigator.language));
    }
  }, [userCountry]);

  const handleFetchDocumentation = async () => {
    if (!equipment) return;
    setFetchingDocs(true);
    setJobId(null);
    setFetchError('');
    try {
      const result = await submitJob({
        job_type: 'generate-equipment-documentation',
        payload: {
          boatId: equipment.boat_id || '',
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          category: equipment.category,
          manufacturer: equipment.manufacturer ?? null,
          model: equipment.model ?? null,
          productRegistryId: equipment.product_registry_id ?? null,
          boatMakeModel: equipment.boat_make_model || '',
        },
      });
      setJobId(result.jobId);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to start fetch job');
      setFetchingDocs(false);
    }
  };

  const handleJobComplete = useCallback(async () => {
    setFetchingDocs(false);
    setJobId(null);
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const handleJobError = useCallback((err: string) => {
    setFetchError(err);
    setFetchingDocs(false);
  }, []);

  const visibleSpareParts = showAllRegions
    ? product.spare_parts_links
    : filterSparePartsByRegion(product.spare_parts_links, detectedRegion);

  const regionLabel: Record<string, string> = {
    eu: 'EU', us: 'US', uk: 'UK', asia: 'Asia', global: 'Global',
  };

  // Show job progress
  if (jobId) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Fetching documentation…</p>
        <JobProgressPanel
          jobId={jobId}
          onComplete={handleJobComplete}
          onError={handleJobError}
        />
      </div>
    );
  }

  // Show error
  if (fetchError) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-destructive">{fetchError}</p>
        <button
          onClick={() => {
            setFetchError('');
            setFetchingDocs(false);
          }}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Show fetch button if nothing is cached yet and equipment info is available
  if (!product.documentation_links?.length && !product.spare_parts_links?.length && !product.manufacturer_url && equipment) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">No documentation or spare parts cached.</p>
        <button
          onClick={handleFetchDocumentation}
          className="text-xs font-medium text-primary hover:underline"
        >
          ✦ Fetch documentation
        </button>
      </div>
    );
  }

  // If no links to show at all, return null
  if (!product.documentation_links?.length && !product.spare_parts_links?.length && !product.manufacturer_url) {
    return null;
  }

  return (
    <div className="space-y-3 pt-1">
      {product.manufacturer_url && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Manufacturer
          </p>
          <a
            href={product.manufacturer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Visit Website
          </a>
        </div>
      )}

      {product.documentation_links && product.documentation_links.length > 0 && (
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
