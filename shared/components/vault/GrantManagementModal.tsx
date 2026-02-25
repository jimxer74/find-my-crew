'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, Button } from '@shared/ui';
import type { DocumentAccessGrant, GrantPurpose } from '@shared/lib/documents/types';

interface GrantManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

interface GrantWithProfile extends DocumentAccessGrant {
  grantee?: {
    id: string;
    full_name: string | null;
    username: string;
    profile_image_url: string | null;
  } | null;
}

const PURPOSES: GrantPurpose[] = [
  'journey_registration',
  'identity_verification',
  'insurance_proof',
  'certification_check',
  'other',
];

export function GrantManagementModal({ isOpen, onClose, documentId, documentName }: GrantManagementModalProps) {
  const t = useTranslations('vault.grants');
  const [grants, setGrants] = useState<GrantWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form state
  const [granteeSearch, setGranteeSearch] = useState('');
  const [granteeId, setGranteeId] = useState('');
  const [granteeName, setGranteeName] = useState('');
  const [purpose, setPurpose] = useState<GrantPurpose>('other');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [maxViews, setMaxViews] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const fetchGrants = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/grants`);
      if (response.ok) {
        const data = await response.json();
        setGrants(data.grants || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      fetchGrants();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, fetchGrants]);

  const handleRevoke = async (grantId: string) => {
    if (!confirm(t('revokeConfirm'))) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/grants/${grantId}`, { method: 'DELETE' });
      if (response.ok) {
        setSuccess(t('revokeSuccess'));
        fetchGrants();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to revoke');
      }
    } catch {
      setError('Failed to revoke grant');
    }
  };

  const handleSearchUser = async () => {
    if (!granteeSearch.trim()) return;
    try {
      // Search by username or email - we'll search profiles
      const response = await fetch(`/api/documents/shared?search=${encodeURIComponent(granteeSearch)}`);
      // For simplicity, we set the grantee ID directly - in production you'd have a user search API
      // For now, the user needs to paste the user ID or username
      setError(null);
    } catch {
      setError('User search failed');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!granteeId.trim()) {
      setError('Please enter a user ID');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/documents/${documentId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantee_id: granteeId.trim(),
          purpose,
          expires_at: expiresAt,
          max_views: maxViews ? parseInt(maxViews, 10) : null,
        }),
      });

      if (response.ok) {
        setSuccess(t('grantSuccess'));
        setShowCreateForm(false);
        setGranteeId('');
        setGranteeName('');
        setMaxViews('');
        fetchGrants();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create grant');
      }
    } catch {
      setError('Failed to create grant');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      size="md"
      footer={
        !showCreateForm ? (
          <Button
            variant="primary"
            onClick={() => { setShowCreateForm(true); setError(null); setSuccess(null); }}
            className="w-full"
          >
            {t('grantAccess')}
          </Button>
        ) : (
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setShowCreateForm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const formEvent = new Event('submit', { bubbles: true }) as any;
                const form = document.querySelector('form');
                if (form) form.dispatchEvent(formEvent);
              }}
              disabled={creating}
              className="flex-1"
            >
              {creating ? '...' : t('grantAccess')}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {/* Subtitle with document name */}
        <p className="text-xs text-muted-foreground">{documentName}</p>

        {/* Messages */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">{success}</div>
        )}

        {/* Create grant form */}
        {showCreateForm && (
          <form onSubmit={handleCreate} className="space-y-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t('selectUser')}</label>
              <input
                type="text"
                value={granteeId}
                onChange={(e) => setGranteeId(e.target.value)}
                placeholder="User ID"
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">{t('purpose')}</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as GrantPurpose)}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[44px]"
              >
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>{t(`purposes.${p}` as any)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t('expiresAt')}</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-[44px]"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">{t('maxViews')}</label>
                <input
                  type="number"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  placeholder="Unlimited"
                  min="1"
                  className="w-full px-3 py-2 border border-border bg-input-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>
          </form>
        )}

        {/* Existing grants list */}
        <div className="space-y-2">
          {loading && (
            <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
          )}

          {!loading && grants.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('noGrants')}</p>
          )}

          {grants.map((grant) => {
            const now = new Date();
            const expired = new Date(grant.expires_at) < now;
            const viewLimitReached = grant.max_views !== null && grant.view_count >= grant.max_views;
            const isActive = !grant.is_revoked && !expired && !viewLimitReached;

            return (
              <div key={grant.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {grant.grantee?.full_name || grant.grantee?.username || grant.grantee_id.slice(0, 8) + '...'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`purposes.${grant.purpose}` as any)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : grant.is_revoked
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {grant.is_revoked ? t('revoked') : expired ? t('expired') : t('active')}
                    </span>
                    {grant.max_views !== null && (
                      <span className="text-xs text-muted-foreground">
                        {grant.view_count}/{grant.max_views} {t('viewsUsed')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(grant.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <Button
                    onClick={() => handleRevoke(grant.id)}
                    variant="destructive"
                    size="sm"
                    className="!px-3 !py-1.5 !text-xs flex-shrink-0 ml-2"
                  >
                    {t('revoke')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
