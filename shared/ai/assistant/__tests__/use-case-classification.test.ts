/**
 * Use Case Classification Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridUseCaseClassifier, UseCaseIntent } from '../use-case-classification';

// Mock AI service
class MockAIService {
  async generate(prompt: string): Promise<string> {
    // Simulate LLM response based on prompt content
    const normalized = prompt.toLowerCase();

    // Check for specific user message patterns in the prompt
    if (normalized.includes('what is sailing')) {
      return 'general_conversation';
    } else if (normalized.includes('i want to find sailing opportunities')) {
      return 'crew_search_sailing_trips';
    } else if (normalized.includes('can you help me search for sailing trips')) {
      return 'crew_search_sailing_trips';
    } else if (normalized.includes('how can i improve my profile')) {
      return 'crew_improve_profile';
    } else if (normalized.includes('i want to register for a sailing trip')) {
      return 'crew_register';
    } else {
      // Default fallback based on general keywords
      if (normalized.includes('find') || normalized.includes('search')) {
        return 'crew_search_sailing_trips';
      } else if (normalized.includes('improve') || normalized.includes('update')) {
        return 'crew_improve_profile';
      } else if (normalized.includes('register') || normalized.includes('join')) {
        return 'crew_register';
      } else {
        return 'general_conversation';
      }
    }
  }
}

describe('HybridUseCaseClassifier', () => {
  let classifier: HybridUseCaseClassifier;

  beforeEach(() => {
    classifier = new HybridUseCaseClassifier(new MockAIService() as any);
  });

  describe('classifyIntent', () => {
    it('should classify sailing search intent', async () => {
      const result = await classifier.classifyIntent('I want to find sailing opportunities in the Mediterranean');
      expect(result).toBe(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
    });

    it('should classify profile improvement intent', async () => {
      const result = await classifier.classifyIntent('How can I improve my profile to get more sailing opportunities?');
      expect(result).toBe(UseCaseIntent.CREW_IMPROVE_PROFILE);
    });

    it('should classify registration intent', async () => {
      const result = await classifier.classifyIntent('I want to register for a sailing trip to the Caribbean');
      expect(result).toBe(UseCaseIntent.CREW_REGISTER);
    });

    it('should classify general conversation', async () => {
      const result = await classifier.classifyIntent('What is sailing?');
      expect(result).toBe(UseCaseIntent.GENERAL_CONVERSATION);
    });

    it('should handle synchronous classification', () => {
      const result = classifier.classifyIntentSync('I want to find sailing opportunities');
      expect(result).toBe(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
    });
  });

  describe('pattern recognition', () => {
    it('should recognize sailing search patterns', async () => {
      const result = await classifier.classifyIntent('Can you help me search for sailing trips from Barcelona to Mallorca?');
      expect(result).toBe(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
    });

    it('should recognize profile improvement patterns', async () => {
      const result = await classifier.classifyIntent('My profile is missing certifications, how can I improve it?');
      expect(result).toBe(UseCaseIntent.CREW_IMPROVE_PROFILE);
    });

    it('should recognize registration patterns', async () => {
      const result = await classifier.classifyIntent('I want to join a sailing crew for the summer');
      expect(result).toBe(UseCaseIntent.CREW_REGISTER);
    });
  });

  describe('confidence scoring', () => {
    it('should return pattern stats', () => {
      const stats = classifier.getPatternStats();
      expect(stats).toHaveProperty(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
      expect(stats).toHaveProperty(UseCaseIntent.CREW_IMPROVE_PROFILE);
      expect(stats).toHaveProperty(UseCaseIntent.CREW_REGISTER);
      expect(stats).toHaveProperty(UseCaseIntent.GENERAL_CONVERSATION);
    });
  });

  describe('custom patterns', () => {
    it('should add custom patterns', () => {
      const pattern = {
        pattern: /\btest\b/i,
        weight: 5,
        description: 'Test pattern'
      };
      classifier.addCustomPattern(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, pattern);
      const stats = classifier.getPatternStats();
      expect(stats[UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]).toBeGreaterThan(0);
    });
  });
});