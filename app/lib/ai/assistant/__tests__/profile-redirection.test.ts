import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseProfileAction, redirectToProfile } from '@/app/contexts/AssistantContext';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Profile Redirection', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('parseProfileAction', () => {
    it('should return correct section and field for suggest_profile_update_user_description', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'suggest_profile_update_user_description',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'personal',
        field: 'user_description'
      });
    });

    it('should return correct section and field for update_profile_certifications', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'update_profile_certifications',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'experience',
        field: 'certifications'
      });
    });

    it('should return correct section and field for update_profile_risk_level', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'update_profile_risk_level',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'preferences',
        field: 'risk_level'
      });
    });

    it('should return correct section and field for update_profile_skills', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'update_profile_skills',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'experience',
        field: 'skills'
      });
    });

    it('should return correct section and field for refine_skills', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'refine_skills',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'experience',
        field: 'skills'
      });
    });

    it('should return default fallback for unknown action type', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'unknown_action',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'personal',
        field: 'user_description'
      });
    });

    it('should use metadata from action if available', () => {
      const action = {
        id: 'test-id',
        user_id: 'user-123',
        action_type: 'suggest_profile_update_user_description',
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
        profile_section: 'preferences',
        profile_field: 'sailing_preferences',
      };

      const result = parseProfileAction(action);
      expect(result).toEqual({
        section: 'preferences',
        field: 'sailing_preferences'
      });
    });
  });

  describe('PROFILE_UPDATE_ACTIONS', () => {
    it('should include all expected profile update action types', () => {
      const expectedActions = [
        'suggest_profile_update_user_description',
        'update_profile_user_description',
        'update_profile_certifications',
        'update_profile_risk_level',
        'update_profile_sailing_preferences',
        'update_profile_skills',
        'refine_skills'
      ];

      // Check if all expected actions are included
      expectedActions.forEach(action => {
        expect(PROFILE_UPDATE_ACTIONS).toContain(action);
      });

      // Check that we have the expected number of actions
      expect(PROFILE_UPDATE_ACTIONS).toHaveLength(expectedActions.length);
    });
  });

  describe('ACTION_TO_PROFILE_MAPPING', () => {
    it('should have highlight text for all profile update actions', () => {
      const expectedActions = [
        'suggest_profile_update_user_description',
        'update_profile_user_description',
        'update_profile_certifications',
        'update_profile_risk_level',
        'update_profile_sailing_preferences',
        'update_profile_skills',
        'refine_skills'
      ];

      expectedActions.forEach(action => {
        expect(ACTION_TO_PROFILE_MAPPING).toHaveProperty(action);
        expect(ACTION_TO_PROFILE_MAPPING[action]).toHaveProperty('highlightText');
        expect(typeof ACTION_TO_PROFILE_MAPPING[action].highlightText).toBe('string');
        expect(ACTION_TO_PROFILE_MAPPING[action].highlightText.length).toBeGreaterThan(0);
      });
    });
  });
});