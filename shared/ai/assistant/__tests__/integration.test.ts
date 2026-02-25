/**
 * Integration Tests for Field-Specific AI Profile Updates
 *
 * This test validates the complete workflow from tool execution to action creation
 * and execution, ensuring the new field-specific approach works correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeTool } from '../toolExecutor';
import { executeAction } from '../actions';
import { ActionType } from '../types';

// Mock Supabase client with more realistic responses
const createMockSupabase = () => ({
  from: vi.fn((table) => {
    if (table === 'ai_pending_actions') {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'pending-action-id',
                user_id: 'test-user-id',
                action_type: 'update_profile_user_description',
                action_payload: { newValue: 'Test description' },
                explanation: 'Test explanation',
                status: 'pending',
                created_at: new Date().toISOString(),
                resolved_at: null,
              },
              error: null,
            })),
          })),
        }),
      };
    }

    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'test-user-id',
                user_description: 'old description',
                skills: ['basic_sailing'],
                risk_level: ['Coastal sailing'],
                certifications: 'old certs',
                sailing_preferences: 'old prefs',
              },
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      };
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          limit: vi.fn(() => ({ data: [], error: null })),
        })),
      })),
    };
  }),
});

const mockContext = {
  supabase: createMockSupabase(),
  userId: 'test-user-id',
  userRoles: ['crew'],
  conversationId: 'test-conversation-id',
};

describe('Field-Specific Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Tool Execution Workflow', () => {
    it('should execute suggest_profile_update_user_description tool end-to-end', async () => {
      const toolCall = {
        id: 'tool-call-1',
        name: 'suggest_profile_update_user_description',
        arguments: {
          reason: 'User description is too brief and should be more detailed',
          suggestedField: 'user_description',
          newValue: 'Experienced sailor with 5 years of offshore cruising',
        },
      };

      const result = await executeTool(toolCall, mockContext);

      expect(result.toolCallId).toBe('tool-call-1');
      expect(result.name).toBe('suggest_profile_update_user_description');
      expect(result.result.success).toBe(true);
      expect(result.result.message).toContain('Action suggested and pending user approval');
      expect(result.result.pendingActionId).toBe('pending-action-id');
    });

    it('should execute suggest_profile_update_skills tool end-to-end', async () => {
      const toolCall = {
        id: 'tool-call-2',
        name: 'suggest_profile_update_skills',
        arguments: {
          reason: 'Adding navigation skills will help qualify for more opportunities',
          suggestedField: 'skills',
          newValue: ['navigation', 'first_aid'],
        },
      };

      const result = await executeTool(toolCall, mockContext);

      expect(result.toolCallId).toBe('tool-call-2');
      expect(result.name).toBe('suggest_profile_update_skills');
      expect(result.result.success).toBe(true);
      expect(result.result.pendingActionId).toBe('pending-action-id');
    });

    it('should execute suggest_skills_refinement tool end-to-end', async () => {
      const toolCall = {
        id: 'tool-call-3',
        name: 'suggest_skills_refinement',
        arguments: {
          reason: 'Navigation skill description could be more detailed',
          suggestedField: 'skills',
          targetSkills: ['navigation', 'piloting'],
        },
      };

      const result = await executeTool(toolCall, mockContext);

      expect(result.toolCallId).toBe('tool-call-3');
      expect(result.name).toBe('suggest_skills_refinement');
      expect(result.result.success).toBe(true);
      expect(result.result.pendingActionId).toBe('pending-action-id');
    });
  });

  describe('Action Execution Integration', () => {
    it('should execute approved user_description update action', async () => {
      const action = {
        id: 'action-1',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: {
          newValue: 'Experienced sailor with 5 years of offshore cruising experience'
        },
        explanation: 'User description updated based on user input',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('User description updated successfully');
      expect(result.data.field).toBe('user_description');
      expect(result.data.value).toBe('Experienced sailor with 5 years of offshore cruising experience');
    });

    it('should execute approved skills update action', async () => {
      const action = {
        id: 'action-2',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_skills' as ActionType,
        action_payload: {
          newValue: ['navigation', 'first_aid', 'engine_repair']
        },
        explanation: 'Skills updated based on user input',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Skills updated successfully');
      expect(result.data.field).toBe('skills');
      expect(result.data.value).toEqual(['navigation', 'first_aid', 'engine_repair']);
    });

    it('should execute skills refinement with user descriptions', async () => {
      const action = {
        id: 'action-3',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'refine_skills' as ActionType,
        action_payload: {
          targetSkills: ['navigation'],
          userProvidedDescriptions: {
            navigation: 'Advanced navigation skills including celestial navigation, GPS navigation, and chart plotting'
          }
        },
        explanation: 'Navigation skill refined with detailed description',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Skills refined successfully');
      expect(result.data.updatedSkills).toContain('navigation');
      expect(result.data.refinedSkills).toContain('navigation');
    });
  });

  describe('Validation and Error Handling', () => {
    it('should reject tool calls with missing required parameters', async () => {
      const toolCall = {
        id: 'tool-call-4',
        name: 'suggest_profile_update_user_description',
        arguments: {
          // Missing reason and suggestedField
          newValue: 'Test description',
        },
      };

      try {
        await executeTool(toolCall, mockContext);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Missing required parameter');
      }
    });

    it('should reject action execution with invalid payload', async () => {
      const action = {
        id: 'action-4',
        user_id: 'test-user-id',
        conversation_id: null,
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: {
          // Missing newValue
        },
        explanation: 'Test explanation',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INVALID_VALUE');
    });

    it('should handle authorization errors correctly', async () => {
      const action = {
        id: 'action-5',
        user_id: 'different-user-id', // Different from mockContext.userId
        conversation_id: null,
        action_type: 'update_profile_user_description' as ActionType,
        action_payload: {
          newValue: 'Test description'
        },
        explanation: 'Test explanation',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        resolved_at: null,
      };

      const result = await executeAction(action, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Database Schema Integration', () => {
    it('should create pending actions with field-specific metadata', async () => {
      const mockSupabase = createMockSupabase();
      const insertSpy = vi.spyOn(mockSupabase.from('ai_pending_actions'), 'insert');

      const toolCall = {
        id: 'tool-call-5',
        name: 'suggest_profile_update_user_description',
        arguments: {
          reason: 'User description needs improvement',
          suggestedField: 'user_description',
          newValue: 'Improved user description',
        },
      };

      await executeTool(toolCall, { ...mockContext, supabase: mockSupabase });

      expect(insertSpy).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        conversation_id: 'test-conversation-id',
        action_type: 'update_profile_user_description',
        action_payload: {
          newValue: 'Improved user description',
        },
        explanation: 'User description needs improvement',
        status: 'pending',
        field_type: 'user_description',
        suggested_value: 'Improved user description',
      });
    });

    it('should handle skills refinement metadata correctly', async () => {
      const mockSupabase = createMockSupabase();
      const insertSpy = vi.spyOn(mockSupabase.from('ai_pending_actions'), 'insert');

      const toolCall = {
        id: 'tool-call-6',
        name: 'suggest_skills_refinement',
        arguments: {
          reason: 'Skills need refinement',
          suggestedField: 'skills',
          targetSkills: ['navigation', 'piloting'],
        },
      };

      await executeTool(toolCall, { ...mockContext, supabase: mockSupabase });

      expect(insertSpy).toHaveBeenCalledWith({
        user_id: 'test-user-id',
        conversation_id: 'test-conversation-id',
        action_type: 'refine_skills',
        action_payload: {
          targetSkills: ['navigation', 'piloting'],
        },
        explanation: 'Skills need refinement',
        status: 'pending',
        field_type: 'skills',
        suggested_value: 'navigation, piloting',
      });
    });
  });
});