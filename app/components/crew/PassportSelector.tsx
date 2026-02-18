'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import Link from 'next/link';
import type { DocumentVault } from '@/app/lib/documents/types';
import { logger } from '@/app/lib/logger';

interface PassportSelectorProps {
  onSelect: (passportId: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

type DocumentGrant = {
  id: string;
  purpose: string;
  expires_at: string;
  is_revoked: boolean;
};

export function PassportSelector({ onSelect, onCancel, isLoading = false, error }: PassportSelectorProps) {
  const { user } = useAuth();
  const [passports, setPassports] = useState<DocumentVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(error || null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grantStatus, setGrantStatus] = useState<Record<string, { hasGrant: boolean; loading: boolean }>>({});
  const [selectedGrant, setSelectedGrant] = useState<DocumentGrant | null>(null);

  useEffect(() => {
    loadPassports();
  }, [user?.id]);

  const loadPassports = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const response = await fetch('/api/documents?category=passport');

      if (!response.ok) {
        throw new Error('Failed to load passports');
      }

      const data = await response.json();
      const docs = data.documents || [];

      // Filter out expired passports and sort by expiry date (soonest first)
      const validPassports = docs
        .filter((doc: DocumentVault) => {
          if (!doc.metadata?.expiry_date) return true; // Include if no expiry info
          const expiryDate = new Date(doc.metadata.expiry_date);
          return expiryDate > new Date();
        })
        .sort((a: DocumentVault, b: DocumentVault) => {
          const dateA = a.metadata?.expiry_date ? new Date(a.metadata.expiry_date) : new Date('2099-12-31');
          const dateB = b.metadata?.expiry_date ? new Date(b.metadata.expiry_date) : new Date('2099-12-31');
          return dateA.getTime() - dateB.getTime();
        });

      setPassports(validPassports);
      if (validPassports.length === 0) {
        setLoadError('No valid passports found in your document vault');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load passports';
      setLoadError(message);
      logger.error('Error loading passports:', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const checkPassportGrant = async (passportId: string) => {
    if (grantStatus[passportId]?.loading) return; // Already checking

    setGrantStatus(prev => ({
      ...prev,
      [passportId]: { hasGrant: false, loading: true }
    }));

    try {
      const response = await fetch(`/api/documents/${passportId}/grants`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        logger.error(`[PassportSelector] Grant check failed - Status: ${response.status} ${response.statusText}`);
        logger.error(`[PassportSelector] Passport ID:`, { passportId });
        logger.error(`[PassportSelector] Error response:`, { errorData });
        logger.error(`[PassportSelector] Full response headers:`, {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length')
        });

        // Gracefully degrade: treat missing grants as no grant exists
        // but don't block the user - they might not have created a grant yet
        setGrantStatus(prev => ({
          ...prev,
          [passportId]: { hasGrant: false, loading: false }
        }));
        return;
      }

      const data = await response.json();
      const grants = data.grants || [];

      logger.debug(`[PassportSelector] Grants fetched for passport ${passportId}:`, {
        count: grants.length,
        grants: grants.map((g: DocumentGrant) => ({
          purpose: g.purpose,
          expired: new Date(g.expires_at) <= new Date(),
          revoked: g.is_revoked
        }))
      });

      // Check for active grant with purpose='identity_verification'
      const now = new Date();
      const hasValidGrant = grants.some((grant: DocumentGrant) =>
        grant.purpose === 'identity_verification' &&
        !grant.is_revoked &&
        new Date(grant.expires_at) > now
      );

      // Find the valid grant if it exists
      const validGrant = grants.find((grant: DocumentGrant) =>
        grant.purpose === 'identity_verification' &&
        !grant.is_revoked &&
        new Date(grant.expires_at) > now
      );

      setGrantStatus(prev => ({
        ...prev,
        [passportId]: { hasGrant: hasValidGrant, loading: false }
      }));

      if (selectedId === passportId && hasValidGrant) {
        setSelectedGrant(validGrant);
      }
    } catch (err) {
      logger.error('[PassportSelector] Error checking grants:', {
        error: err instanceof Error ? err.message : String(err),
        passportId
      });
      setGrantStatus(prev => ({
        ...prev,
        [passportId]: { hasGrant: false, loading: false }
      }));
    }
  };

  const handleSelect = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Invalid date';
    }
  };

  const isExpiringSoon = (dateString: string | undefined): boolean => {
    if (!dateString) return false;
    const expiryDate = new Date(dateString);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return expiryDate < thirtyDaysFromNow && expiryDate > new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3"></div>
        <span className="text-sm text-muted-foreground">Loading your passports...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Select Your Passport</h3>
        <p className="text-xs text-muted-foreground">
          Choose a valid passport to verify against. Expired passports are filtered out.
        </p>
      </div>

      {/* Error message */}
      {(loadError || error) && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {loadError || error}
        </div>
      )}

      {/* No passports case */}
      {passports.length === 0 && !loadError && (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm text-foreground font-medium mb-1">No passports in your vault</p>
          <p className="text-xs text-muted-foreground mb-3">
            Upload a passport to your document vault first, then return here to select it.
          </p>
          <Link
            href="/crew/vault"
            className="inline-block px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Go to Document Vault →
          </Link>
        </div>
      )}

      {/* Passport list */}
      {passports.length > 0 && (
        <div className="space-y-2">
          {passports.map((passport) => {
            const expiryDate = passport.metadata?.expiry_date;
            const isSoon = isExpiringSoon(expiryDate);
            const grantCheck = grantStatus[passport.id];

            return (
              <div
                key={passport.id}
                onClick={() => {
                  setSelectedId(passport.id);
                  checkPassportGrant(passport.id);
                }}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedId === passport.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio button */}
                  <div className="mt-1 flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedId === passport.id
                          ? 'border-primary bg-primary'
                          : 'border-border'
                      }`}
                    >
                      {selectedId === passport.id && (
                        <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                      )}
                    </div>
                  </div>

                  {/* Passport info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {passport.metadata?.holder_name || passport.file_name}
                    </p>

                    {passport.metadata?.document_number && (
                      <p className="text-xs text-muted-foreground">
                        Document #: {passport.metadata.document_number}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      {passport.metadata?.issuing_country && (
                        <span className="text-xs text-muted-foreground">
                          {passport.metadata.issuing_country}
                        </span>
                      )}

                      {expiryDate && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            isSoon
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          Expires: {formatDate(expiryDate)}
                        </span>
                      )}

                      {!expiryDate && (
                        <span className="text-xs text-muted-foreground">
                          Expiry date not extracted
                        </span>
                      )}
                    </div>

                    {isSoon && (
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                        ⚠️ This passport expires soon
                      </p>
                    )}
                  </div>

                  {/* Grant Status Indicator */}
                  {selectedId === passport.id && (
                    <div className="ml-4 flex-shrink-0">
                      {grantCheck?.loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-muted-foreground">Checking...</span>
                        </div>
                      ) : grantCheck?.hasGrant ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded text-xs font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Access Granted
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded text-xs font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 2.697m8.368 12.192a6 6 0 01-8.368-8.368m1.414-1.414a8 8 0 1111.314 11.314" clipRule="evenodd" />
                          </svg>
                          No Access
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grant Warning */}
      {selectedId && grantStatus[selectedId] && !grantStatus[selectedId].loading && !grantStatus[selectedId].hasGrant && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2m0-12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-400 mb-1">
                Access Not Granted
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
                To proceed with registration, you must grant access to this passport in your Document Vault. This allows the skipper to verify your identity.
              </p>
              <Link
                href="/crew/vault"
                className="inline-block px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded transition-colors"
              >
                Go to Document Vault →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSelect}
          disabled={!selectedId || isLoading || (selectedId && grantStatus[selectedId] ? !grantStatus[selectedId].hasGrant : false)}
          className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          title={selectedId && grantStatus[selectedId] && !grantStatus[selectedId].hasGrant ? 'Must grant access in Document Vault first' : undefined}
        >
          {isLoading ? 'Verifying...' : 'Select Passport'}
        </button>
      </div>
    </div>
  );
}
