'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import Link from 'next/link';
import type { DocumentVault } from '@/app/lib/documents/types';

interface PassportSelectorProps {
  onSelect: (passportId: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export function PassportSelector({ onSelect, onCancel, isLoading = false, error }: PassportSelectorProps) {
  const { user } = useAuth();
  const [passports, setPassports] = useState<DocumentVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(error || null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
      console.error('Error loading passports:', err);
    } finally {
      setLoading(false);
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

            return (
              <div
                key={passport.id}
                onClick={() => setSelectedId(passport.id)}
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
                </div>
              </div>
            );
          })}
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
          disabled={!selectedId || isLoading}
          className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Verifying...' : 'Select Passport'}
        </button>
      </div>
    </div>
  );
}
