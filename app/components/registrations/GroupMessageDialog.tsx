'use client';

import { useEffect, useRef, useState } from 'react';

interface VaultDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  description: string | null;
  category: string | null;
}

interface Attachment {
  type: 'vault_document' | 'local_file';
  name: string;
  url: string;
  vault_document_id?: string;
}

interface GroupMessageDialogProps {
  isOpen: boolean;
  recipientCount: number;
  registrationIds: string[];
  onClose: () => void;
  onSent: (sentCount: number) => void;
}

export function GroupMessageDialog({
  isOpen,
  recipientCount,
  registrationIds,
  onClose,
  onSent,
}: GroupMessageDialogProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vault picker state
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [vaultDocuments, setVaultDocuments] = useState<VaultDocument[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');

  // Local file upload
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load vault documents when picker opens
  useEffect(() => {
    if (showVaultPicker && vaultDocuments.length === 0) {
      loadVaultDocuments();
    }
  }, [showVaultPicker]);

  const loadVaultDocuments = async (search?: string) => {
    setVaultLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/documents?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVaultDocuments(data.documents || []);
      }
    } finally {
      setVaultLoading(false);
    }
  };

  const handleVaultSearch = (value: string) => {
    setVaultSearch(value);
    loadVaultDocuments(value || undefined);
  };

  const handleAddVaultDocument = (doc: VaultDocument) => {
    if (attachments.some((a) => a.vault_document_id === doc.id)) return;
    setAttachments((prev) => [
      ...prev,
      { type: 'vault_document', name: doc.file_name, url: '', vault_document_id: doc.id },
    ]);
    setShowVaultPicker(false);
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to upload file');
        return;
      }

      const doc = data.document;
      setAttachments((prev) => [
        ...prev,
        { type: 'local_file', name: doc.file_name, url: '', vault_document_id: doc.id },
      ]);
    } catch {
      setError('Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!content.trim()) {
      setError('Please enter a message');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/messages/group-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationIds, content, attachments }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send messages');
        return;
      }
      onSent(data.sent ?? 0);
      handleClose();
    } catch {
      setError('Failed to send messages. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setContent('');
    setAttachments([]);
    setError(null);
    setShowVaultPicker(false);
    setVaultSearch('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={handleClose}>
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Send Group Message</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {recipientCount} {recipientCount === 1 ? 'recipient' : 'recipients'}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={sending}
            className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={sending}
              placeholder="Type your message here..."
              rows={5}
              maxLength={10000}
              className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{content.length}/10000</p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Attachments</p>
              <ul className="space-y-1.5">
                {attachments.map((att, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm"
                  >
                    <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="flex-1 truncate text-foreground">{att.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {att.type === 'vault_document' ? 'Vault' : 'Uploaded'}
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(i)}
                      disabled={sending}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove attachment"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Attach buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowVaultPicker((prev) => !prev)}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              Attach from Vault
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadingFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            >
              {uploadingFile ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              {uploadingFile ? 'Uploading...' : 'Upload File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleLocalFileChange}
            />
          </div>

          {/* Vault picker */}
          {showVaultPicker && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-muted">
                <input
                  type="text"
                  value={vaultSearch}
                  onChange={(e) => handleVaultSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {vaultLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
                ) : vaultDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No documents found</p>
                ) : (
                  <ul>
                    {vaultDocuments.map((doc) => {
                      const isAdded = attachments.some((a) => a.vault_document_id === doc.id);
                      return (
                        <li key={doc.id}>
                          <button
                            onClick={() => handleAddVaultDocument(doc)}
                            disabled={isAdded}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                              isAdded
                                ? 'opacity-40 cursor-default'
                                : 'hover:bg-accent'
                            }`}
                          >
                            <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="flex-1 truncate">{doc.file_name}</span>
                            {isAdded && <span className="text-xs text-muted-foreground">Added</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={sending}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : (
              `Send to ${recipientCount}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
