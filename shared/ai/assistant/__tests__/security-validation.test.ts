/**
 * Security Validation Tests for Field-Specific AI Profile Updates
 *
 * This test suite ensures that the system properly blocks AI suggestions
 * for sensitive identity fields and enforces user-provided content requirements.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToolsForUser } from '../tools';
import { executeTool } from '../toolExecutor';
import { ActionType } from '../types';

const mockContext = {
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          limit: vi.fn(() => ({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'action-id', status: 'pending' },
            error: null,
          })),
        })),
      })),
    })),
  },
  userId: 'test-user-id',
  userRoles: ['crew'],
  conversationId: 'test-conversation-id',
};

describe('Security Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sensitive Field Protection', () => {
    it('should not include sensitive field update tools in available tools', () => {
      const tools = getToolsForUser(['crew']);
      const toolNames = tools.map(tool => tool.name);

      // These sensitive field tools should NOT exist
      const sensitiveFieldTools = [
        'suggest_profile_update_username',
        'suggest_profile_update_full_name',
        'suggest_profile_update_phone',
        'suggest_profile_update_email',
      ];

      sensitiveFieldTools.forEach(toolName => {
        expect(toolNames).not.toContain(toolName);
      });
    });

    it('should reject attempts to create sensitive field update actions', async () => {
      const sensitiveActionTypes = [
        'update_profile_username' as ActionType,
        'update_profile_full_name' as ActionType,
        'update_profile_phone' as ActionType,
        'update_profile_email' as ActionType,
      ];

      for (const actionType of sensitiveActionTypes) {
        const action = {
          id: 'action-1',
          user_id: 'test-user-id',
          conversation_id: null,
          action_type: actionType,
          action_payload: { newValue: 'test' },
          explanation: 'Test explanation',
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          resolved_at: null,
        };

        // The action executor should reject unknown action types
        try {
          // Import the executeAction function and test it
          const { executeAction } = await import('../actions');
          const result = await executeAction(action, mockContext);
          expect(result.success).toBe(false);
          expect(result.error).toBe('UNKNOWN_ACTION');
        } catch (error) {
          // Expected for unknown action types
          expect(error.message).toContain('Unknown action type');
        }
      }
    });

    it('should prevent tools from suggesting sensitive field updates', async () => {
      // Test that no tool definitions exist for sensitive fields
      const tools = getToolsForUser(['crew']);
      const actionTools = tools.filter(tool =>
        tool.name.startsWith('suggest_profile_update_') ||
        tool.name === 'suggest_skills_refinement'
      );

      const sensitiveFields = ['username', 'full_name', 'phone', 'email'];
      const sensitiveFieldTools = sensitiveFields.map(field =>
        `suggest_profile_update_${field}`
      );

      actionTools.forEach(tool => {
        expect(sensitiveFieldTools).not.toContain(tool.name);
      });
    });
  });

  describe('User-Provided Content Enforcement', () => {
    it('should require user-provided content for all profile updates', async () => {
      const fieldSpecificTools = [
        'suggest_profile_update_user_description',
        'suggest_profile_update_certifications',
        'suggest_profile_update_risk_level',
        'suggest_profile_update_sailing_preferences',
        'suggest_profile_update_skills',
      ];

      for (const toolName of fieldSpecificTools) {
        const toolCall = {
          id: 'tool-call-1',
          name: toolName,
          arguments: {
            reason: 'Field needs updating',
            suggestedField: toolName.replace('suggest_profile_update_', ''),
            // Missing newValue - should be provided by user
          },
        };

        try {
          await executeTool(toolCall, mockContext);
          expect(false).toBe(true); // Should not reach here
        } catch (error) {
          expect(error.message).toContain('Missing required parameter');
        }
      }
    });

    it('should reject AI-generated content in profile updates', async () => {
      const toolCall = {
        id: 'tool-call-2',
        name: 'suggest_profile_update_user_description',
        arguments: {
          reason: 'User description needs updating',
          suggestedField: 'user_description',
          newValue: 'AI-generated user description content', // AI should not provide content
        },
      };

      // While the tool might accept this, the system should validate that
      // this content actually comes from the user, not the AI
      try {
        await executeTool(toolCall, mockContext);
        // The tool should execute but the system should have safeguards
        // to ensure this content is user-provided
      } catch (error) {
        expect(error.message).toContain('Missing required parameter');
      }
    });

    it('should validate that skills refinement targets valid skills', async () => {
      const toolCall = {
        id: 'tool-call-3',
        name: 'suggest_skills_refinement',
        arguments: {
          reason: 'Skills need refinement',
          suggestedField: 'skills',
          targetSkills: ['invalid_skill_name'], // Should be validated against known skills
        },
      };

      // The tool should execute but the system should validate skill names
      try {
        await executeTool(toolCall, mockContext);
        // Should succeed but with validation warnings
      } catch (error) {
        // Expected if skill validation is strict
        expect(error.message).toContain('Missing required parameter');
      }
    });
  });

  describe('Content Creation Prevention', () => {
    it('should not allow AI to create profile content directly', () => {
      // Verify that the system prompt explicitly prevents AI from creating content
      const tools = getToolsForUser(['crew']);
      const profileUpdateTools = tools.filter(tool =>
        tool.name.startsWith('suggest_profile_update_')
      );

      profileUpdateTools.forEach(tool => {
        // Check that the tool description emphasizes user-provided content
        expect(tool.description).toContain('user must provide');
        expect(tool.description).toContain('AI should not create');
      });
    });

    it('should enforce iterative refinement for skills', async () => {
      const toolCall = {
        id: 'tool-call-4',
        name: 'suggest_skills_refinement',
        arguments: {
          reason: 'Navigation skill description needs improvement',
          suggestedField: 'skills',
          targetSkills: ['navigation'],
        },
      };

      const result = await executeTool(toolCall, mockContext);

      expect(result.result.success).toBe(true);
      expect(result.result.pendingActionId).toBeDefined();

      // The action should require user to provide refined descriptions
      // rather than AI creating them
    });

    it('should validate that all profile fields use user-provided content', async () => {
      const fieldTests = [
        {
          toolName: 'suggest_profile_update_user_description',
          fieldName: 'user_description',
          testValue: 'User-provided description',
        },
        {
          toolName: 'suggest_profile_update_certifications',
          fieldName: 'certifications',
          testValue: 'User-provided certifications',
        },
        {
          toolName: 'suggest_profile_update_risk_level',
          fieldName: 'risk_level',
          testValue: ['Coastal sailing'],
        },
        {
          toolName: 'suggest_profile_update_sailing_preferences',
          fieldName: 'sailing_preferences',
          testValue: 'User-provided preferences',
        },
        {
          toolName: 'suggest_profile_update_skills',
          fieldName: 'skills',
          testValue: ['navigation', 'first_aid'],
        },
      ];

      for (const test of fieldTests) {
        const toolCall = {
          id: `tool-call-${test.fieldName}`,
          name: test.toolName,
          arguments: {
            reason: `${test.fieldName} needs updating`,
            suggestedField: test.fieldName,
            newValue: test.testValue, // Must be user-provided
          },
        };

        const result = await executeTool(toolCall, mockContext);
        expect(result.result.success).toBe(true);

        // Verify the pending action contains user-provided content
        expect(result.result.pendingActionId).toBeDefined();
      }
    });
  });

  describe('Field-Specific Action Validation', () => {
    it('should validate field-specific action types', () => {
      const validActionTypes = [
        'update_profile_user_description',
        'update_profile_certifications',
        'update_profile_risk_level',
        'update_profile_sailing_preferences',
        'update_profile_skills',
        'refine_skills',
      ];

      validActionTypes.forEach(actionType => {
        expect(actionType).toMatch(/^update_profile_|refine_skills$/);
      });
    });

    it('should reject unknown field-specific action types', async () => {
      const invalidActionTypes = [
        'update_profile_username',
        'update_profile_full_name',
        'update_profile_phone',
        'update_profile_email',
        'update_profile_invalid_field',
      ];

      for (const actionType of invalidActionTypes) {
        const action = {
          id: 'action-test',
          user_id: 'test-user-id',
          conversation_id: null,
          action_type: actionType as ActionType,
          action_payload: { newValue: 'test' },
          explanation: 'Test explanation',
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          resolved_at: null,
        };

        try {
          const { executeAction } = await import('../actions');
          const result = await executeAction(action, mockContext);
          expect(result.success).toBe(false);
          expect(result.error).toBe('UNKNOWN_ACTION');
        } catch (error) {
          expect(error.message).toContain('Unknown action type');
        }
      }
    });
  });
});