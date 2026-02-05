/**
 * Main exports for the AI Prompt Management System
 * Provides the central registry and utility functions for prompt management
 */

// Import types and constants directly from types.ts
import {
  UseCase,
  PromptFormat,
  PromptContent,
  TestCase,
  TestSuite,
  PromptMetadata,
  PromptDefinition,
  PromptVersion,
  PromptMeta,
  ValidationResult,
  PromptSearch,
  RegistryConfig,
  MigrationRecord,
  PromptMetrics,
  BuilderContext,
  TemplateContext,
  RegistryStats,
  PromptRegistryError,
  PromptErrorType,
  DEFAULT_REGISTRY_CONFIG,
  DEFAULT_METADATA,
  PROMPT_FORMATS,
  USE_CASES
} from './types';

export type {
  UseCase,
  PromptFormat,
  PromptContent,
  TestCase,
  TestSuite,
  PromptMetadata,
  PromptDefinition,
  PromptVersion,
  PromptMeta,
  ValidationResult,
  PromptSearch,
  RegistryConfig,
  MigrationRecord,
  PromptMetrics,
  BuilderContext,
  TemplateContext,
  RegistryStats,
  PromptRegistryError,
  PromptErrorType
};

export {
  DEFAULT_REGISTRY_CONFIG,
  DEFAULT_METADATA,
  PROMPT_FORMATS,
  USE_CASES
} from './types';

// Import the registry class from registry.ts
import { PromptRegistry as RegistryClass } from './registry';

// Export the registry class
export { PromptRegistry } from './registry';

// Create and export the default registry instance
export const promptRegistry = new RegistryClass();

// Utility functions for common operations
export class PromptUtils {
  /**
   * Create a prompt definition with proper metadata
   */
  static createPromptDefinition(
    id: string,
    useCase: UseCase,
    content: any,
    format: PromptFormat,
    description: string,
    tags: string[] = [],
    tests: TestSuite[] = []
  ): PromptDefinition {
    return {
      id,
      useCase,
      content,
      format,
      metadata: {
        description,
        created: new Date(),
        lastModified: new Date(),
        author: 'system',
        tags,
        version: '1.0.0',
        changelog: ['Initial version'],
        tests
      }
    };
  }

  /**
   * Create a test case for prompt validation
   */
  static createTestCase(
    name: string,
    input: any,
    expectedOutput: string,
    description?: string
  ): TestCase {
    return {
      name,
      input,
      expectedOutput,
      description
    };
  }

  /**
   * Create a test suite for comprehensive prompt testing
   */
  static createTestSuite(
    name: string,
    cases: TestCase[],
    accuracyThreshold = 0.9,
    performanceThreshold = 1000,
    formatThreshold = 0.95
  ): TestSuite {
    return {
      name,
      cases,
      thresholds: {
        accuracy: accuracyThreshold,
        performance: performanceThreshold,
        formatCompliance: formatThreshold
      }
    };
  }

  /**
   * Create a template prompt with interpolation support
   */
  static createTemplatePrompt(
    id: string,
    useCase: UseCase,
    template: string,
    description: string,
    tags: string[] = []
  ): PromptDefinition {
    return this.createPromptDefinition(
      id,
      useCase,
      template,
      'template',
      description,
      tags
    );
  }

  /**
   * Create a builder prompt with dynamic content generation
   */
  static createBuilderPrompt(
    id: string,
    useCase: UseCase,
    builder: (context: BuilderContext) => string,
    description: string,
    tags: string[] = []
  ): PromptDefinition {
    return this.createPromptDefinition(
      id,
      useCase,
      builder,
      'builder',
      description,
      tags
    );
  }

  /**
   * Create a constant prompt with static content
   */
  static createConstantPrompt(
    id: string,
    useCase: UseCase,
    content: string,
    description: string,
    tags: string[] = []
  ): PromptDefinition {
    return this.createPromptDefinition(
      id,
      useCase,
      content,
      'constant',
      description,
      tags
    );
  }

  /**
   * Validate prompt content against expected format
   */
  static validatePromptContent(
    content: string,
    expectedFormat: 'json' | 'markdown' | 'text' = 'text'
  ): boolean {
    try {
      switch (expectedFormat) {
        case 'json':
          JSON.parse(content);
          return true;
        case 'markdown':
          // Basic markdown validation
          return content.includes('#') || content.includes('**') || content.includes('*');
        case 'text':
          return typeof content === 'string' && content.length > 0;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Get prompt statistics and usage information
   */
  static async getPromptStats(registry: RegistryClass): Promise<RegistryStats> {
    return registry.getStats();
  }

  /**
   * Export prompts to JSON format for backup or sharing
   */
  static exportPrompts(registry: RegistryClass): string {
    const prompts = Array.from(registry['prompts'].values());
    return JSON.stringify(prompts, null, 2);
  }

  /**
   * Import prompts from JSON format
   */
  static importPrompts(registry: RegistryClass, json: string): void {
    const prompts = JSON.parse(json);
    for (const prompt of prompts) {
      registry.registerPrompt(prompt);
    }
  }

  /**
   * Compare two prompt versions
   */
  static compareVersions(
    promptA: PromptDefinition,
    promptB: PromptDefinition
  ): {
    contentDiff: string[];
    metadataDiff: string[];
    versionDiff: string;
  } {
    const contentDiff: string[] = [];
    const metadataDiff: string[] = [];

    // Compare content
    if (typeof promptA.content === 'string' && typeof promptB.content === 'string') {
      if (promptA.content !== promptB.content) {
        contentDiff.push('Content differs');
      }
    }

    // Compare metadata
    if (promptA.metadata.description !== promptB.metadata.description) {
      metadataDiff.push('Description differs');
    }
    if (promptA.metadata.version !== promptB.metadata.version) {
      metadataDiff.push('Version differs');
    }

    return {
      contentDiff,
      metadataDiff,
      versionDiff: `${promptA.metadata.version} vs ${promptB.metadata.version}`
    };
  }

  /**
   * Generate prompt documentation
   */
  static generateDocumentation(registry: RegistryClass): string {
    const prompts = registry.listPrompts();
    let docs = '# AI Prompt Documentation\\n\\n';

    for (const prompt of prompts) {
      docs += `## ${prompt.id}\\n`;
      docs += `**Use Case:** ${prompt.useCase}\\n`;
      docs += `**Format:** ${prompt.format}\\n`;
      docs += `**Version:** ${prompt.version}\\n`;
      docs += `**Tags:** ${prompt.tags.join(', ')}\\n`;
      docs += `**Tests:** ${prompt.testCount}\\n\\n`;
    }

    return docs;
  }
}