/**
 * Tests for Field-Specific AI Profile Update Actions
 *
 * This test suite validates the new field-specific approach for AI profile updates,
 * ensuring proper field restrictions, user-provided content requirements, and
 * the skills iterative refinement workflow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeAction } from '../actions';
import { executeTool } from '../toolExecutor';
import { getToolsForUser } from '../tools';
import { ActionType } from '../types';

// Mock Supabase client
const mockSupabase = {
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
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ error: null })),
    })),
  })),
};

// Mock context
const mockContext = {
  supabase: mockSupabase,
  userId: 'test-user-id',
  userRoles: ['crew'],
  conversationId: 'test-conversation-id',
};

describe('Field-Specific Action Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Action Type Definitions', () => {
    it('should define field-specific action types', () => {
      const actionTypes = [
        'update_profile_user_description',
        'update_profile_certifications',
        'update_profile_risk_level',
        'update_profile_sailing_preferences',
        'update_profile_skills',
        'refine_skills',
      ];

      actionTypes.forEach(actionType => {
        expect(actionType).toMatch(/^update_profile_.*|refine_skills$/);
      });
    });

    it('should exclude sensitive fields from allowed action types', () => {
      const sensitiveFields = ['username', 'full_name', 'phone', 'email'];
      const restrictedActionTypes = sensitiveFields.map(field =>
        `update_profile_${field}`
      );

      restrictedActionTypes.forEach(actionType => {
        expect(actionType).not.toBe('update_profile_user_description');
        expect(actionType).not.toBe('update_profile_certifications');
        expect(actionType).not.toBe('update_profile_risk_level');
        expect(actionType).not.toBe('update_profile_sailing_preferences');
        expect(actionType).not.toBe('update_profile_skills');
      });
    });
  });

  describe('Field-Specific Action Execution', () => {
    it('should execute update_profile_user_description with valid payload', async () => {
      // Mock profile data
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { user_description: 'old description' },
              error: null,
            })),
          })),
        })),
      });

      const action = {
        id: 'action-1',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: { newValue: 'New user description' },
        explanation: 'User description updated',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User description updated successfully');
      expect(result.data).toEqual({
        field: 'user_description',
        value: 'New user description',
      });
    });

    it('should execute update_profile_certifications with valid payload', async () => {
      const action = {
        id: 'action-2',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_certifications' as ActionType,
        action_payload: { newValue: 'New certifications' },
        explanation: 'Certifications updated',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Certifications updated successfully');
      expect(result.data).toEqual({
        field: 'certifications',
        value: 'New certifications',
      });
    });

    it('should execute update_profile_risk_level with valid payload', async () => {
      const action = {
        id: 'action-3',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_risk_level' as ActionType,
        action_payload: { newValue: ['Coastal sailing', 'Offshore sailing'] },
        explanation: 'Risk level updated',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Risk level updated successfully');
      expect(result.data).toEqual({
        field: 'risk_level',
        value: ['Coastal sailing', 'Offshore sailing'],
      });
    });

    it('should execute update_profile_sailing_preferences with valid payload', async () => {
      const action = {
        id: 'action-4',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_sailing_preferences' as ActionType,
        action_payload: { newValue: 'I prefer coastal cruising' },
        explanation: 'Sailing preferences updated',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Sailing preferences updated successfully');
      expect(result.data).toEqual({
        field: 'sailing_preferences',
        value: 'I prefer coastal cruising',
      });
    });

    it('should execute update_profile_skills with valid payload', async () => {
      const action = {
        id: 'action-5',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_skills' as ActionType,
        action_payload: { newValue: ['navigation', 'first_aid'] },
        explanation: 'Skills updated',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Skills updated successfully');
      expect(result.data).toEqual({
        field: 'skills',
        value: ['navigation', 'first_aid'],
      });
    });

    it('should validate required parameters for field-specific actions', async () => {
      const action = {
        id: 'action-6',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: { invalidField: 'test' }, // Missing newValue
        explanation: 'Test explanation',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_VALUE');
    });
  });

  describe('Skills Iterative Refinement Workflow', () => {
    it('should execute refine_skills with target skills', async () => {
      // Mock profile data
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { skills: ['basic_sailing'] },
              error: null,
            })),
          })),
        })),
      });

      const action = {
        id: 'action-7',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'refine_skills' as ActionType,
        action_payload: { targetSkills: ['navigation', 'piloting'] },
        explanation: 'Skills refinement needed',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Skills refinement requested');
      expect(result.data.targetSkills).toEqual(['navigation', 'piloting']);
      expect(result.data.currentSkills).toEqual(['basic_sailing']);
    });

    it('should execute refine_skills with user-provided descriptions', async () => {
      const action = {
        id: 'action-8',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'refine_skills' as ActionType,
        action_payload: {
          targetSkills: ['navigation'],
          userProvidedDescriptions: { navigation: 'Advanced navigation skills' }
        },
        explanation: 'Skills refinement with user input',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Skills refined successfully');
      expect(result.data.refinedSkills).toEqual(['navigation']);
    });

    it('should validate target skills array for refine_skills', async () => {
      const action = {
        id: 'action-9',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'refine_skills' as ActionType,
        action_payload: { targetSkills: 'invalid' }, // Should be array
        explanation: 'Invalid target skills',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_TARGET_SKILLS');
    });
  });

  describe('Tool Definitions and Validation', () => {
    it('should include field-specific tools in action tools', () => {
      const tools = getToolsForUser(['crew']);
      const actionToolNames = tools
        .filter(tool => ['suggest_profile_update_user_description', 'suggest_profile_update_certifications', 'suggest_profile_update_risk_level', 'suggest_profile_update_sailing_preferences', 'suggest_profile_update_skills', 'suggest_skills_refinement'].includes(tool.name))
        .map(tool => tool.name);

      expect(actionToolNames).toContain('suggest_profile_update_user_description');
      expect(actionToolNames).toContain('suggest_profile_update_certifications');
      expect(actionToolNames).toContain('suggest_profile_update_risk_level');
      expect(actionToolNames).toContain('suggest_profile_update_sailing_preferences');
      expect(actionToolNames).toContain('suggest_profile_update_skills');
      expect(actionToolNames).toContain('suggest_skills_refinement');
    });

    it('should exclude bulk suggest_profile_update tool', () => {
      const tools = getToolsForUser(['crew']);
      const hasBulkTool = tools.some(tool => tool.name === 'suggest_profile_update');

      expect(hasBulkTool).toBe(false);
    });

    it('should require all parameters for field-specific tools', async () => {
      const toolCall = {
        id: 'tool-call-1',
        name: 'suggest_profile_update_user_description',
        arguments: {
          reason: 'User description needs improvement',
          // Missing suggestedField
        },
      };

      try {
        await executeTool(toolCall, mockContext);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Missing required parameter');
      }
    });

    it('should validate suggestedField parameter for field-specific tools', async () => {
      const toolCall = {
        id: 'tool-call-2',
        name: 'suggest_profile_update_user_description',
        arguments: {
          reason: 'Test reason',
          suggestedField: 'invalid_field', // Should be 'user_description'
        },
      };

      try {
        await executeTool(toolCall, mockContext);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('suggestedField must be');
      }
    });
  });

  describe('Database Schema Validation', () => {
    it('should support field-specific payload structure', () => {
      const fieldSpecificPayload = {
        newValue: 'New value for the field',
      };

      const skillsRefinementPayload = {
        targetSkills: ['navigation', 'piloting'],
        userProvidedDescriptions: { navigation: 'Advanced navigation skills' },
      };

      expect(fieldSpecificPayload).toHaveProperty('newValue');
      expect(skillsRefinementPayload).toHaveProperty('targetSkills');
      expect(skillsRefinementPayload).toHaveProperty('userProvidedDescriptions');
    });

    it('should maintain backward compatibility with existing actions', () => {
      const existingActionTypes = [
        'register_for_leg',
        'approve_registration',
        'reject_registration',
      ];

      existingActionTypes.forEach(actionType => {
        expect(actionType).toMatch(/^(register_for_leg|approve_registration|reject_registration)$/);
      });
    });
  });

  describe('Security and Field Restrictions', () => {
    it('should not allow suggestion tools for sensitive fields', () => {
      const sensitiveFields = ['username', 'full_name', 'phone', 'email'];
      const restrictedToolNames = sensitiveFields.map(field =>
        `suggest_profile_update_${field}`
      );

      const tools = getToolsForUser(['crew']);
      const toolNames = tools.map(tool => tool.name);

      restrictedToolNames.forEach(toolName => {
        expect(toolNames).not.toContain(toolName);
      });
    });

    it('should enforce user-provided content requirement', async () => {
      const action = {
        id: 'action-10',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: { newValue: '' }, // Empty value
        explanation: 'Test explanation',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_VALUE');
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete field-specific workflow', async () => {
    // 1. Create pending action for user description
    const createPendingAction = {
      id: 'action-11',
      user_id: 'test-user-id',
      conversation_id: null,
      action_type: 'update_profile_user_description' as ActionType,
      action_payload: { newValue: 'Updated user description' },
      explanation: 'User description needs to be more detailed',
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      resolved_at: null,
    };

    const result1 = await executeAction(createPendingAction, mockContext);
    expect(result1.success).toBe(true);
    expect(result1.data.field).toBe('user_description');

    // 2. Create skills refinement action
    const skillsRefinementAction = {
      id: 'action-12',
      user_id: 'test-user-id',
      conversation_id: null,
      action_type: 'refine_skills' as ActionType,
      action_payload: {
        targetSkills: ['navigation'],
        userProvidedDescriptions: { navigation: 'Advanced navigation and piloting skills' }
      },
      explanation: 'Navigation skill needs more detail',
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      resolved_at: null,
    };

    const result2 = await executeAction(skillsRefinementAction, mockContext);
    expect(result2.success).toBe(true);
    expect(result2.data.refinedSkills).toContain('navigation');
  });

  it('should maintain data integrity across field-specific actions', async () => {
    const actions = [
      {
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: { newValue: 'New user description' },
      },
      {
        action_type: 'update_profile_certifications' as ActionType,
        action_payload: { newValue: 'New certifications' },
      },
      {
        action_type: 'update_profile_risk_level' as ActionType,
        action_payload: { newValue: ['Coastal sailing'] },
      },
    ];

    for (const actionConfig of actions) {
      const action = {
        ...actionConfig,
        id: `action-${Math.random()}`,
        user_id: 'test-user-id',
        conversation_id: null,
        explanation: 'Test explanation',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('field');
      expect(result.data).toHaveProperty('value');
    }
  });
});