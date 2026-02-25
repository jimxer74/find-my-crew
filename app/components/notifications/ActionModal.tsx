'use client';

import { logger } from '@shared/logging';
import { useState } from 'react';
import { Modal, Button } from '@/app/components/ui';
import { Notification } from '@/app/lib/notifications';
import { ActionInputModal } from './ActionInputModal';
import { ActionConfirmation } from './ActionConfirmation';

interface ActionModalProps {
  notification: Notification;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  onRedirectToProfile: (actionId: string, section: string, field: string) => void;
}

export function ActionModal({ notification, onApprove, onReject, onRedirectToProfile }: ActionModalProps) {
  const [showInputModal, setShowInputModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  const handleApprove = () => {
    const metadata = notification.metadata as any;
    if (metadata.input_required) {
      setShowInputModal(true);
    } else {
      setShowConfirmationModal(true);
    }
  };

  const handleInputSubmit = (value: string | string[]) => {
    logger.debug('Input submitted for action:', { actionId: notification.metadata?.action_id, value });
    // For now, we'll just approve the action with the input value
    // The actual input submission will be handled by the parent component
    if (notification.metadata?.action_id && typeof onApprove === 'function') {
      try {
        onApprove(notification.metadata.action_id);
      } catch (error) {
        logger.error('Error calling onApprove in ActionModal:', error instanceof Error ? { error: error.message } : { error: String(error) });
      }
    } else {
      logger.warn('onApprove is not available or action_id is missing');
    }
    setShowInputModal(false);
  };

  const handleConfirmationSubmit = () => {
    if (notification.metadata?.action_id && typeof onApprove === 'function') {
      try {
        onApprove(notification.metadata.action_id);
      } catch (error) {
        logger.error('Error calling onApprove in ActionModal confirmation:', error instanceof Error ? { error: error.message } : { error: String(error) });
      }
    } else {
      logger.warn('onApprove is not available or action_id is missing in confirmation');
    }
    setShowConfirmationModal(false);
  };

  return (
    <>
      {/* Action Confirmation Modal */}
      <Modal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        title="Confirm Action"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmationModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmationSubmit}
              className="flex-1"
            >
              Confirm
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to proceed with this action?
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-foreground font-medium">{notification.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
          </div>
        </div>
      </Modal>

      {/* Input Modal */}
      {showInputModal && (
        <ActionInputModal
          notification={notification}
          onSubmit={handleInputSubmit}
          onCancel={() => setShowInputModal(false)}
        />
      )}

      {/* Inline Action Confirmation (when not using modals) */}
      <ActionConfirmation
        notification={notification}
        onApprove={(actionId) => {
          // Check if input is required
          const metadata = notification.metadata as any;
          if (metadata.input_required) {
            setShowInputModal(true);
          } else {
            if (typeof onApprove === 'function') {
              try {
                onApprove(actionId);
              } catch (error) {
                logger.error('Error calling onApprove in ActionModal inline:', error instanceof Error ? { error: error.message } : { error: String(error) });
              }
            } else {
              logger.warn('onApprove is not available in ActionModal inline');
            }
          }
        }}
        onReject={(actionId) => {
          if (typeof onReject === 'function') {
            try {
              onReject(actionId);
            } catch (error) {
              logger.error('Error calling onReject in ActionModal:', error instanceof Error ? { error: error.message } : { error: String(error) });
            }
          } else {
            logger.warn('onReject is not available in ActionModal');
          }
        }}
        onRedirectToProfile={(actionId, section, field) => {
          if (typeof onRedirectToProfile === 'function') {
            try {
              onRedirectToProfile(actionId, section, field);
            } catch (error) {
              logger.error('Error calling onRedirectToProfile in ActionModal:', error instanceof Error ? { error: error.message } : { error: String(error) });
            }
          } else {
            logger.warn('onRedirectToProfile is not available in ActionModal');
          }
        }}
      />
    </>
  );
}