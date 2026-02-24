'use client';

/**
 * URL Import Modal - Desktop
 *
 * Modal dialog for importing profile via URL on desktop.
 * Opens when user clicks "Paste Link" on the combo search box.
 */

import { X } from 'lucide-react';
import { URLImportForm } from './URLImportForm';

interface URLImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (content: string, metadata: any) => void;
}

export function URLImportModal({ isOpen, onClose, onSuccess }: URLImportModalProps) {
  if (!isOpen) return null;

  const handleSuccess = (content: string, metadata: any) => {
    onSuccess(content, metadata);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Import Your Profile</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Have a link to your sailing profile, Facebook post, or blog? Paste it below and we'll extract the
              information to help you get started.
            </p>

            <URLImportForm
              onSuccess={handleSuccess}
              onCancel={onClose}
            />
          </div>
        </div>
      </div>
    </>
  );
}
