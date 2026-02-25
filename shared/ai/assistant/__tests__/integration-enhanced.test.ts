/**
 * Enhanced System Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enhancedChat } from '../enhanced-service';
import { UseCaseIntent } from '../use-case-classification';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => ({ data: { ai_processing_consent: true } }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { id: 'conv-123', user_id: 'user-123', title: null }
        }))
      }))
    })),
    eq: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({ data: [] }))
      }))
    }))
  }))
};

// Mock request and options
const mockRequest = {
  message: 'I want to find sailing opportunities in the Mediterranean',
  conversationId: 'conv-123'
};

const mockOptions = {
  userId: 'user-123',
  conversationId: 'conv-123'
};

describe('Enhanced System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enhancedChat', () => {
    it('should process a complete chat flow with intent classification', async () => {
      const result = await enhancedChat(
        mockSupabase as any,
        mockRequest,
        mockOptions
      );

      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('message');
      expect(result.message).toHaveProperty('role', 'assistant');
      expect(result.message).toHaveProperty('content');
    });

    it('should classify sailing search intent correctly', async () => {
      const searchRequest = {
        message: 'Can you help me find sailing trips from Barcelona to Mallorca?',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        searchRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // The response should be focused on sailing search functionality
      expect(result.message.content.toLowerCase()).toContain('sailing');
    });

    it('should classify profile improvement intent correctly', async () => {
      const profileRequest = {
        message: 'How can I improve my profile to get more sailing opportunities?',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        profileRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // The response should focus on profile improvement
      expect(result.message.content.toLowerCase()).toContain('profile');
    });

    it('should classify registration intent correctly', async () => {
      const registerRequest = {
        message: 'I want to register for a sailing trip to the Caribbean',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        registerRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // The response should focus on registration
      expect(result.message.content.toLowerCase()).toContain('register');
    });

    it('should sanitize user messages', async () => {
      const emailRequest = {
        message: 'Contact me at test@example.com for sailing opportunities',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        emailRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Email should be sanitized in the system processing
      expect(result.message.content.toLowerCase()).not.toContain('test@example.com');
    });

    it('should handle general conversation intent', async () => {
      const generalRequest = {
        message: 'What is sailing?',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        generalRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Should provide general information about sailing
      expect(result.message.content.toLowerCase()).toContain('sailing');
    });
  });

  describe('data sanitization', () => {
    it('should remove PII from user messages', async () => {
      const piiRequest = {
        message: 'My email is captain@example.com and phone is 555-123-4567',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        piiRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Should not contain the actual PII
      expect(result.message.content).not.toContain('captain@example.com');
      expect(result.message.content).not.toContain('555-123-4567');
    });
  });

  describe('context filtering', () => {
    it('should filter context based on use case', async () => {
      const searchRequest = {
        message: 'I want to find sailing opportunities in the Mediterranean',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        searchRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Should focus on sailing search, not profile management
      expect(result.message.content.toLowerCase()).toContain('sailing');
      expect(result.message.content.toLowerCase()).not.toContain('profile');
    });
  });

  describe('tool selection', () => {
    it('should prioritize appropriate tools for sailing search', async () => {
      const searchRequest = {
        message: 'Find me sailing opportunities in the Mediterranean',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        searchRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Should mention sailing search capabilities
      expect(result.message.content.toLowerCase()).toContain('search');
    });

    it('should prioritize profile tools for profile improvement', async () => {
      const profileRequest = {
        message: 'How can I improve my profile?',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        profileRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Should focus on profile improvement
      expect(result.message.content.toLowerCase()).toContain('improve');
    });
  });

  describe('response formatting', () => {
    it('should format responses for specific use cases', async () => {
      const searchRequest = {
        message: 'Show me sailing opportunities',
        conversationId: 'conv-123'
      };

      const result = await enhancedChat(
        mockSupabase as any,
        searchRequest,
        mockOptions
      );

      expect(result.message.content).toBeDefined();
      // Response should be formatted for sailing search use case
      expect(typeof result.message.content).toBe('string');
      expect(result.message.content.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle AI consent denial', async () => {
      const mockSupabaseNoConsent = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { ai_processing_consent: false } }))
            }))
          }))
        }))
      };

      await expect(enhancedChat(
        mockSupabaseNoConsent as any,
        mockRequest,
        mockOptions
      )).rejects.toThrow('AI processing consent not granted');
    });

    it('should handle missing conversation ID', async () => {
      const requestWithoutConversationId = {
        message: 'I want to find sailing opportunities',
        conversationId: undefined
      };

      const result = await enhancedChat(
        mockSupabase as any,
        requestWithoutConversationId,
        mockOptions
      );

      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('message');
    });
  });
});