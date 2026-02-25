/**
 * Core Prompt Registry Implementation
 * Centralized management system for AI prompts with versioning, testing, and caching
 */

import {
  UseCase,
  PromptDefinition,
  PromptVersion,
  PromptMetadata,
  TestSuite,
  ValidationResult,
  PromptMeta,
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

export class PromptRegistry {
  private prompts: Map<string, PromptDefinition> = new Map();
  private versions: Map<string, PromptVersion[]> = new Map();
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private metrics: PromptMetrics[] = [];
  private migrations: MigrationRecord[] = [];
  private config: RegistryConfig;

  constructor(config?: Partial<RegistryConfig>) {
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };
  }

  /**
   * Register a new prompt or update an existing one
   */
  registerPrompt(prompt: PromptDefinition): void {
    // Validate the prompt
    const validation = this.validatePrompt(prompt);
    if (!validation.isValid) {
      throw new PromptRegistryError(
        PromptErrorType.INVALID_PROMPT,
        'Prompt validation failed',
        validation.errors
      );
    }

    // Check if prompt already exists
    const existing = this.prompts.get(prompt.id);
    if (existing) {
      // Update existing prompt
      this.updatePrompt(prompt);
    } else {
      // Create new prompt
      this.createPrompt(prompt);
    }
  }

  /**
   * Get a prompt by use case and optional version
   */
  getPrompt(useCase: UseCase, version?: string): PromptDefinition {
    // First try to find by use case
    const prompt = Array.from(this.prompts.values())
      .find(p => p.useCase === useCase);

    if (!prompt) {
      throw new PromptRegistryError(
        PromptErrorType.PROMPT_NOT_FOUND,
        `No prompt found for use case: ${useCase}`
      );
    }

    // If version specified, get specific version
    if (version) {
      return this.getPromptByVersion(prompt.id, version);
    }

    return prompt;
  }

  /**
   * Get a specific version of a prompt
   */
  getPromptByVersion(promptId: string, version: string): PromptDefinition {
    const versions = this.versions.get(promptId);
    if (!versions) {
      throw new PromptRegistryError(
        PromptErrorType.VERSION_NOT_FOUND,
        `No versions found for prompt: ${promptId}`
      );
    }

    const versionData = versions.find(v => v.version === version);
    if (!versionData) {
      throw new PromptRegistryError(
        PromptErrorType.VERSION_NOT_FOUND,
        `Version ${version} not found for prompt: ${promptId}`
      );
    }

    // Return a prompt definition with the specific version content
    const currentPrompt = this.prompts.get(promptId);
    if (!currentPrompt) {
      throw new PromptRegistryError(
        PromptErrorType.PROMPT_NOT_FOUND,
        `Prompt not found: ${promptId}`
      );
    }

    return {
      ...currentPrompt,
      metadata: {
        ...currentPrompt.metadata,
        version
      },
      content: versionData.content
    };
  }

  /**
   * Execute a prompt with context
   */
  async executePrompt(
    useCase: UseCase,
    context?: BuilderContext,
    version?: string
  ): Promise<string> {
    const startTime = performance.now();

    try {
      const prompt = this.getPrompt(useCase, version);
      const result = this.executePromptContent(prompt.content, context);

      // Record metrics
      this.recordMetrics({
        promptId: prompt.id,
        useCase,
        timestamp: new Date(),
        executionTime: performance.now() - startTime,
        success: true
      });

      return result;
    } catch (error) {
      // Record failed metrics
      this.recordMetrics({
        promptId: '',
        useCase,
        timestamp: new Date(),
        executionTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * List all prompts with metadata
   */
  listPrompts(search?: PromptSearch): PromptMeta[] {
    let prompts = Array.from(this.prompts.values());

    // Apply filters
    if (search) {
      if (search.useCase) {
        prompts = prompts.filter(p => p.useCase === search.useCase);
      }
      if (search.tags && search.tags.length > 0) {
        prompts = prompts.filter(p =>
          search.tags?.every(tag => p.metadata.tags.includes(tag))
        );
      }
      if (search.format) {
        prompts = prompts.filter(p => p.format === search.format);
      }
      if (search.author) {
        prompts = prompts.filter(p => p.metadata.author === search.author);
      }
      if (search.dateRange) {
        const { start, end } = search.dateRange;
        prompts = prompts.filter(p => {
          const date = p.metadata.lastModified;
          return (!start || date >= start) && (!end || date <= end);
        });
      }
      if (search.text) {
        const text = search.text.toLowerCase();
        prompts = prompts.filter(p =>
          p.metadata.description.toLowerCase().includes(text) ||
          this.getPromptContentAsString(p.content).toLowerCase().includes(text)
        );
      }
    }

    // Convert to meta format
    return prompts.map(p => ({
      id: p.id,
      useCase: p.useCase,
      version: p.metadata.version,
      description: p.metadata.description,
      format: p.format,
      tags: p.metadata.tags,
      lastModified: p.metadata.lastModified,
      testCount: p.metadata.tests.length
    }));
  }

  /**
   * Create a new version of an existing prompt
   */
  createVersion(useCase: UseCase, prompt: PromptDefinition, reason: string): void {
    const existing = Array.from(this.prompts.values())
      .find(p => p.useCase === useCase);

    if (!existing) {
      throw new PromptRegistryError(
        PromptErrorType.PROMPT_NOT_FOUND,
        `No existing prompt found for use case: ${useCase}`
      );
    }

    // Get existing versions
    let versions = this.versions.get(existing.id) || [];

    // Check version limit
    if (versions.length >= this.config.maxVersionsPerPrompt) {
      // Remove oldest version
      versions.shift();
    }

    // Add new version
    const newVersion: PromptVersion = {
      version: this.getNextVersion(existing.metadata.version),
      content: prompt.content,
      reason,
      date: new Date(),
      tests: prompt.metadata.tests || [],
      isActive: true
    };

    versions.push(newVersion);
    this.versions.set(existing.id, versions);

    // Update current prompt metadata
    existing.metadata.version = newVersion.version;
    existing.metadata.lastModified = new Date();
    existing.metadata.changelog.push(reason);

    this.clearCache(existing.id);
  }

  /**
   * Run tests for a specific prompt
   */
  async runTests(useCase: UseCase, version?: string): Promise<ValidationResult> {
    const prompt = this.getPrompt(useCase, version);
    const testResults: ValidationResult[] = [];

    for (const testSuite of prompt.metadata.tests) {
      for (const testCase of testSuite.cases) {
        try {
          const result = await this.executePrompt(useCase, testCase.input, version);
          const testResult = this.validateTestCase(result, testCase, testSuite.thresholds);
          testResults.push(testResult);
        } catch (error) {
          testResults.push({
            isValid: false,
            errors: [`Test case failed: ${error}`],
            warnings: []
          });
        }
      }
    }

    // Aggregate results
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.isValid).length;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;

    return {
      isValid: successRate >= 0.8, // 80% success rate required
      errors: testResults.flatMap(r => r.errors),
      warnings: testResults.flatMap(r => r.warnings)
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): any {
    const totalPrompts = this.prompts.size;
    const totalVersions = Array.from(this.versions.values())
      .reduce((sum, versions) => sum + versions.length, 0);
    const totalTests = Array.from(this.prompts.values())
      .reduce((sum, prompt) => sum + prompt.metadata.tests.length, 0);

    const mostUsed = this.getMostUsedPrompts(5);

    return {
      totalPrompts,
      totalVersions,
      totalTests,
      averageTestCoverage: totalPrompts > 0 ? totalTests / totalPrompts : 0,
      lastUpdated: new Date(),
      mostUsedPrompts: mostUsed,
      performanceMetrics: {
        averageRetrievalTime: this.getAverageRetrievalTime(),
        cacheHitRate: this.getCacheHitRate()
      }
    };
  }

  /**
   * Migrate a prompt from inline to registry
   */
  migratePrompt(
    prompt: PromptDefinition,
    fromLocation: string,
    toLocation: string
  ): MigrationRecord {
    try {
      this.registerPrompt(prompt);

      const record: MigrationRecord = {
        id: `${prompt.id}_${Date.now()}`,
        fromLocation,
        toLocation,
        migrationDate: new Date(),
        status: 'success',
        notes: `Migrated ${prompt.useCase} prompt from ${fromLocation} to ${toLocation}`
      };

      this.migrations.push(record);
      return record;
    } catch (error) {
      const record: MigrationRecord = {
        id: `${prompt.id}_${Date.now()}`,
        fromLocation,
        toLocation,
        migrationDate: new Date(),
        status: 'failed',
        notes: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      this.migrations.push(record);
      throw error;
    }
  }

  // Private methods

  private createPrompt(prompt: PromptDefinition): void {
    // Set default metadata
    prompt.metadata = { ...DEFAULT_METADATA, ...prompt.metadata };

    this.prompts.set(prompt.id, prompt);

    // Initialize versions
    this.versions.set(prompt.id, []);

    // Create initial version
    this.createVersion(
      prompt.useCase,
      { ...prompt },
      'Initial version'
    );

    this.clearCache(prompt.id);
  }

  private updatePrompt(prompt: PromptDefinition): void {
    const existing = this.prompts.get(prompt.id);
    if (!existing) {
      throw new PromptRegistryError(
        PromptErrorType.PROMPT_NOT_FOUND,
        `Prompt not found: ${prompt.id}`
      );
    }

    // Update metadata
    existing.metadata.lastModified = new Date();
    if (prompt.metadata.description) {
      existing.metadata.description = prompt.metadata.description;
    }
    if (prompt.metadata.tags) {
      existing.metadata.tags = prompt.metadata.tags;
    }
    if (prompt.metadata.tests) {
      existing.metadata.tests = prompt.metadata.tests;
    }

    // Update content
    existing.content = prompt.content;

    this.clearCache(prompt.id);
  }

  private executePromptContent(content: any, context?: BuilderContext): string {
    if (typeof content === 'string') {
      return this.interpolateTemplate(content, context);
    } else if (typeof content === 'function') {
      return content(context);
    } else {
      throw new Error('Invalid prompt content type');
    }
  }

  private interpolateTemplate(template: string, context?: BuilderContext): string {
    if (!context) return template;

    return template.replace(/\$\{(\w+)\}/g, (match, key) => {
      return context[key] ?? match;
    });
  }

  private validatePrompt(prompt: PromptDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!prompt.id) errors.push('Prompt ID is required');
    if (!prompt.useCase) errors.push('Use case is required');
    if (!prompt.content) errors.push('Prompt content is required');
    if (!prompt.format) errors.push('Prompt format is required');

    // Validate format
    const validFormats = ['template', 'builder', 'constant'] as const;
    if (!validFormats.includes(prompt.format as any)) {
      errors.push(`Invalid format: ${prompt.format}`);
    }

    // Validate content based on format
    const format = prompt.format as string;
    if (format === 'template' && typeof prompt.content !== 'string') {
      errors.push('Template format requires string content');
    } else if (format === 'builder' && typeof prompt.content !== 'function') {
      errors.push('Builder format requires function content');
    }

    // Validate metadata
    if (prompt.metadata.tests && !Array.isArray(prompt.metadata.tests)) {
      errors.push('Tests must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateTestCase(actual: string, expected: any, thresholds: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Simple string comparison for now
    if (actual !== expected.expectedOutput) {
      errors.push(`Output mismatch. Expected: ${expected.expectedOutput}, Got: ${actual}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private getNextVersion(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number);
    parts[parts.length - 1]++;
    return parts.join('.');
  }

  private getPromptContentAsString(content: any): string {
    if (typeof content === 'string') {
      return content;
    } else if (typeof content === 'function') {
      return content.toString();
    }
    return '';
  }

  private recordMetrics(metrics: PromptMetrics): void {
    this.metrics.push(metrics);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private getMostUsedPrompts(limit: number): { id: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const metric of this.metrics) {
      const count = counts.get(metric.promptId) || 0;
      counts.set(metric.promptId, count + 1);
    }

    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getAverageRetrievalTime(): number {
    if (this.metrics.length === 0) return 0;
    const totalTime = this.metrics.reduce((sum, metric) => sum + metric.executionTime, 0);
    return totalTime / this.metrics.length;
  }

  private getCacheHitRate(): number {
    // Simple cache hit rate calculation based on cache operations
    // This is a simplified implementation
    return 0.8; // Placeholder
  }

  private clearCache(promptId?: string): void {
    if (promptId) {
      this.cache.delete(promptId);
    } else {
      this.cache.clear();
    }
  }
}