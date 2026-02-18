/**
 * Integration Examples for the AI Prompt Management System
 * Demonstrates how to migrate existing API routes to use the new prompt registry
 */

import { logger } from '@/app/lib/logger';
import { promptRegistry, PromptUtils, USE_CASES, UseCase } from '../index';
import { compatibilityAdapter } from '../migration/migration';

/**
 * Example: Migrating suggest-sailboats API route
 */
export class SuggestSailboatsIntegration {
  /**
   * Old implementation (inline prompt)
   */
  static async oldImplementation(boatType: string, preferences: string[]): Promise<string> {
    const prompt = `Suggest 5 names for a ${boatType} boat based on the following preferences: ${preferences.join(', ')}.

The names should be:
- Memorable and easy to pronounce
- Related to sailing, the ocean, or nautical themes
- Not longer than 2 words
- Professional and appropriate for a crew boat

Return the names in this exact JSON format:
{
  "names": ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"]
}`;

    // Call AI service with inline prompt
    const result = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useCase: 'boat-suggestions',
        prompt: prompt
      })
    });

    return await result.json();
  }

  /**
   * New implementation (using prompt registry)
   */
  static async newImplementation(boatType: string, preferences: string[]): Promise<string> {
    // Get prompt from registry and execute with context
    const result = await promptRegistry.executePrompt(
      USE_CASES.BOAT_SUGGESTIONS,
      {
        boatType,
        preferences
      }
    );

    return result;
  }

  /**
   * Hybrid implementation (backward compatible)
   */
  static async hybridImplementation(boatType: string, preferences: string[], useNewSystem: boolean = true): Promise<string> {
    if (useNewSystem) {
      return this.newImplementation(boatType, preferences);
    } else {
      return this.oldImplementation(boatType, preferences);
    }
  }
}

/**
 * Example: Migrating fill-boat-details API route
 */
export class FillBoatDetailsIntegration {
  /**
   * Old implementation (inline prompt)
   */
  static async oldImplementation(text: string): Promise<string> {
    const prompt = `Extract the following boat specifications from the text below:

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON with NO text before the JSON, and NO explanation after
- Ensure all required fields are present in the output
- If a value is not mentioned, use "Not specified" for that field
- Do not include any extra fields beyond those listed below

REQUIRED FIELDS:
- name: The boat name (if provided)
- make_model: The make and model in format "Make Model" (e.g., "Beneteau Oceanis 46")
- year: The year the boat was built (e.g., "2020")
- length: The length in feet (e.g., "46 ft")
- beam: The beam (width) in feet (e.g., "14 ft")
- draft: The draft (depth) in feet (e.g., "6 ft")
- displacement: The displacement in pounds (e.g., "25000 lbs")
- engine: The engine type and horsepower (e.g., "Yanmar 75 HP")

Return the boat specifications in this exact JSON format:
{
  "name": "string",
  "make_model": "string",
  "year": "string",
  "length": "string",
  "beam": "string",
  "draft": "string",
  "displacement": "string",
  "engine": "string"
}

TEXT TO ANALYZE:
"${text}"`;

    // Call AI service with inline prompt
    const result = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useCase: 'boat-details',
        prompt: prompt
      })
    });

    return await result.json();
  }

  /**
   * New implementation (using prompt registry)
   */
  static async newImplementation(text: string): Promise<string> {
    // Get prompt from registry and execute with context
    const result = await promptRegistry.executePrompt(
      USE_CASES.BOAT_DETAILS,
      { text }
    );

    return result;
  }
}

/**
 * Example: Migrating generate-profile API route
 */
export class GenerateProfileIntegration {
  /**
   * Old implementation (inline prompt)
   */
  static async oldImplementation(facebookData: any): Promise<string> {
    const prompt = `Based on the following Facebook profile information, generate a comprehensive sailing profile:

${JSON.stringify(facebookData, null, 2)}

Please extract and organize the following information:

1. Personal Information:
   - Name
   - Location
   - Contact information (if available)

2. Professional Background:
   - Current occupation
   - Relevant skills and experience
   - Education

3. Sailing Experience:
   - Years of sailing experience
   - Types of boats sailed
   - Certifications or training
   - Notable sailing achievements

4. Interests and Hobbies:
   - Sailing-related interests
   - Other hobbies that might be relevant
   - Travel experiences

5. Personal Characteristics:
   - Personality traits that would be relevant for crew compatibility
   - Communication style
   - Teamwork preferences

Format your response as a JSON object with the structure above. If information is not available, use "Not specified" for that field.`;

    // Call AI service with inline prompt
    const result = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useCase: 'profile-generation',
        prompt: prompt
      })
    });

    return await result.json();
  }

  /**
   * New implementation (using prompt registry)
   */
  static async newImplementation(facebookData: any): Promise<string> {
    // Get prompt from registry and execute with context
    const result = await promptRegistry.executePrompt(
      USE_CASES.PROFILE_GENERATION,
      { facebookData }
    );

    return result;
  }
}

/**
 * Example: Creating new prompts for the assistant system
 */
export class AssistantSystemIntegration {
  /**
   * Create a dynamic system prompt for the AI assistant
   */
  static async createSystemPrompt(userContext: any): Promise<string> {
    // Use the system prompt builder for dynamic content
    const builder = new (await import('../builders/system-prompt-builder')).AssistantSystemPromptBuilder();

    const systemPrompt = builder.buildAssistantSystemPrompt({
      userContext,
      availableTools: ['search_journeys', 'search_legs', 'search_legs_by_location', 'get_journey_details', 'get_leg_details'],
      instructions: [
        'Prioritize user safety and accurate information',
        'Use available tools when appropriate',
        'Provide clear, actionable sailing advice',
        'Maintain professional sailing terminology'
      ],
      responseFormat: `
Use this JSON structure for your responses:
{
  "type": "text|tool_call|error",
  "content": "Your response here",
  "toolName": "name_of_tool_if_applicable",
  "toolArgs": "arguments_if_applicable"
}`,
      validationRules: [
        'Always validate user input for completeness',
        'Check for potential safety concerns in sailing advice',
        'Ensure all tool calls have proper parameters',
        'Return JSON responses when specified'
      ]
    });

    return systemPrompt;
  }
}

/**
 * Example: Version management and A/B testing
 */
export class VersionManagementIntegration {
  /**
   * Create multiple versions of a prompt for A/B testing
   */
  static async setupABTesting(): Promise<void> {
    // Register base prompt
    const basePrompt = PromptUtils.createTemplatePrompt(
      'boat-suggestions',
      USE_CASES.BOAT_SUGGESTIONS,
      'Original prompt template...',
      'Base boat suggestions prompt',
      ['boat', 'suggestions']
    );

    promptRegistry.registerPrompt(basePrompt);

    // Create version 2 with different approach
    const version2 = {
      ...basePrompt,
      metadata: {
        ...basePrompt.metadata,
        version: '2.0.0'
      },
      content: 'Alternative prompt template with different style...'
    };

    promptRegistry.createVersion(
      USE_CASES.BOAT_SUGGESTIONS,
      version2,
      'A/B testing: Alternative prompt style'
    );

    // Test both versions
    const result1 = await promptRegistry.executePrompt(USE_CASES.BOAT_SUGGESTIONS, {}, '1.0.0');
    const result2 = await promptRegistry.executePrompt(USE_CASES.BOAT_SUGGESTIONS, {}, '2.0.0');

    logger.debug('Version 1 result:', { result1 });
    logger.debug('Version 2 result:', { result2 });
  }
}

/**
 * Example: Backward compatibility during migration
 */
export class BackwardCompatibilityIntegration {
  /**
   * Gradual migration strategy
   */
  static async gradualMigration(useCase: string, context: any, useNewSystem: boolean = true): Promise<string> {
    if (useNewSystem) {
      // Use new prompt registry
      return await promptRegistry.executePrompt(useCase as UseCase, context);
    } else {
      // Use old compatibility adapter
      return compatibilityAdapter.getBoatSuggestionsPrompt(
        context.boatType,
        context.preferences
      );
    }
  }

  /**
   * Feature flag implementation for prompt system
   */
  static async featureFlaggedImplementation(useCase: string, context: any): Promise<string> {
    const useNewSystem = process.env.USE_PROMPT_REGISTRY === 'true';

    if (useNewSystem) {
      return await promptRegistry.executePrompt(useCase as UseCase, context);
    } else {
      // Fall back to old inline prompts
      return this.getInlinePrompt(useCase, context);
    }
  }

  private static getInlinePrompt(useCase: string, context: any): string {
    switch (useCase) {
      case 'boat-suggestions':
        return `Suggest 5 names for a ${context.boatType} boat based on the following preferences: ${context.preferences.join(', ')}. ...`;
      case 'boat-details':
        return `Extract the following boat specifications from the text below: ...`;
      case 'profile-generation':
        return `Based on the following Facebook profile information, generate a comprehensive sailing profile: ...`;
      default:
        throw new Error(`Unknown use case: ${useCase}`);
    }
  }
}

/**
 * Example: Performance monitoring and analytics
 */
export class MonitoringIntegration {
  /**
   * Track prompt performance and usage
   */
  static async trackPromptPerformance(useCase: string, context: any): Promise<any> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await promptRegistry.executePrompt(useCase as UseCase, context);

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const executionTime = endTime - startTime;

      // Log performance metrics
      logger.debug(`Prompt execution metrics for ${useCase}:`, {
        executionTime: `${executionTime}ms`,
        memoryDelta: `${endMemory.heapUsed - startMemory.heapUsed} bytes`,
        success: true
      });

      return result;
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      logger.error(`Prompt execution failed for ${useCase}:`, {
        executionTime: `${executionTime}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }
}