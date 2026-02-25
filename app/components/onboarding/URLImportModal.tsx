'use client';

/**
 * URL Import Modal - Desktop
 *
 * Modal dialog for importing profile via URL on desktop.
 * Opens when user clicks "Paste Link" on the combo search box.
 */

import { Button } from '@shared/ui/Button/Button';
import { Modal } from '@shared/ui/Modal/Modal';
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Your Profile"
      size="md"
      showCloseButton
      closeOnBackdropClick
      closeOnEscape
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Have a link to your sailing profile, Facebook post, or blog? Paste it below and we'll extract the
          information to help you get started.
        </p>

        <URLImportForm
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}
