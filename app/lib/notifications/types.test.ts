import { describe, it, expect } from 'vitest';
import { NotificationType, isAIPendingAction, hasAIPendingActionMetadata, requiresInput } from './types';

describe('Notification Types', () => {
  it('should include AI pending action types', () => {
    expect(NotificationType.AI_PENDING_ACTION).toBe('ai_pending_action');
    expect(NotificationType.AI_ACTION_APPROVED).toBe('ai_action_approved');
  });

  it('should include all expected notification types', () => {
    const expectedTypes = [
      'registration_approved',
      'registration_denied',
      'new_registration',
      'journey_updated',
      'leg_updated',
      'profile_reminder',
      'ai_auto_approved',
      'ai_review_needed',
      'ai_pending_action',
      'ai_action_approved',
      'feedback_status_changed',
      'feedback_milestone'
    ];

    expectedTypes.forEach(type => {
      expect(Object.values(NotificationType)).toContain(type);
    });
  });

  describe('isAIPendingAction', () => {
    it('should return true for AI pending action notifications', () => {
      const notification = {
        type: 'ai_pending_action',
        metadata: { action_id: 'test' }
      };

      expect(isAIPendingAction(notification)).toBe(true);
    });

    it('should return false for non-AI pending action notifications', () => {
      const notification = {
        type: 'registration_approved',
        metadata: {}
      };

      expect(isAIPendingAction(notification)).toBe(false);
    });
  });

  describe('hasAIPendingActionMetadata', () => {
    it('should return true when action_id and action_type are present', () => {
      const metadata = {
        action_id: 'test-action-1',
        action_type: 'update_profile_user_description',
        action_explanation: 'Test explanation'
      };

      expect(hasAIPendingActionMetadata(metadata)).toBe(true);
    });

    it('should return false when action_id is missing', () => {
      const metadata = {
        action_type: 'update_profile_user_description',
        action_explanation: 'Test explanation'
      };

      expect(hasAIPendingActionMetadata(metadata)).toBe(false);
    });

    it('should return false when action_type is missing', () => {
      const metadata = {
        action_id: 'test-action-1',
        action_explanation: 'Test explanation'
      };

      expect(hasAIPendingActionMetadata(metadata)).toBe(false);
    });
  });

  describe('requiresInput', () => {
    it('should return true when input_required is true', () => {
      const metadata = {
        action_id: 'test-action-1',
        action_type: 'update_profile_user_description',
        input_required: true,
        input_type: 'text'
      };

      expect(requiresInput(metadata)).toBe(true);
    });

    it('should return false when input_required is false', () => {
      const metadata = {
        action_id: 'test-action-1',
        action_type: 'update_profile_user_description',
        input_required: false
      };

      expect(requiresInput(metadata)).toBe(false);
    });

    it('should return false when input_required is undefined', () => {
      const metadata = {
        action_id: 'test-action-1',
        action_type: 'update_profile_user_description'
      };

      expect(requiresInput(metadata)).toBe(false);
    });
  });
});