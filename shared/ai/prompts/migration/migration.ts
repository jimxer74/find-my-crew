/**
 * Migration utilities for transitioning from inline prompts to the centralized prompt registry
 */

import { logger } from '@shared/logging';
import { promptRegistry, PromptUtils } from '../index';
import { MigrationRecord } from '../types';
import { boatSuggestionsMigration } from '../use-cases/boat-suggestions';
import { boatDetailsMigration } from '../use-cases/boat-details';
import { profileGenerationMigration } from '../use-cases/profile-generation';

/**
 * Migration manager for handling prompt migrations
 */
export class PromptMigrationManager {
  private migrations: MigrationRecord[] = [];

  /**
   * Migrate all registered migration records
   */
  async migrateAll(): Promise<MigrationRecord[]> {
    const migrations = [
      boatSuggestionsMigration,
      boatDetailsMigration,
      profileGenerationMigration
    ];

    const results: MigrationRecord[] = [];

    for (const migration of migrations) {
      try {
        const result = promptRegistry.migratePrompt(
          migration.prompt,
          migration.fromLocation,
          migration.toLocation
        );
        results.push(result);
        this.migrations.push(result);
      } catch (error) {
        logger.error(`[PromptMigrationManager] Migration failed for ${migration.prompt.id}:`, error instanceof Error ? { error: error.message } : { error: String(error) });
        const failedResult: MigrationRecord = {
          id: `${migration.prompt.id}_${Date.now()}`,
          fromLocation: migration.fromLocation,
          toLocation: migration.toLocation,
          migrationDate: new Date(),
          status: 'failed',
          notes: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        results.push(failedResult);
        this.migrations.push(failedResult);
      }
    }

    return results;
  }

  /**
   * Migrate a specific prompt
   */
  async migratePrompt(
    promptId: string,
    fromLocation: string,
    toLocation: string,
    prompt: any
  ): Promise<MigrationRecord> {
    try {
      const result = promptRegistry.migratePrompt(prompt, fromLocation, toLocation);
      this.migrations.push(result);
      return result;
    } catch (error) {
      const failedResult: MigrationRecord = {
        id: `${promptId}_${Date.now()}`,
        fromLocation,
        toLocation,
        migrationDate: new Date(),
        status: 'failed',
        notes: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      this.migrations.push(failedResult);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus(): {
    total: number;
    successful: number;
    failed: number;
    migrations: MigrationRecord[];
  } {
    const successful = this.migrations.filter(m => m.status === 'success').length;
    const failed = this.migrations.filter(m => m.status === 'failed').length;

    return {
      total: this.migrations.length,
      successful,
      failed,
      migrations: this.migrations
    };
  }

  /**
   * Validate migration results
   */
  validateMigrations(): {
    isValid: boolean;
    issues: string[];
    summary: string;
  } {
    const issues: string[] = [];
    let isValid = true;

    // Check for failed migrations
    const failedMigrations = this.migrations.filter(m => m.status === 'failed');
    if (failedMigrations.length > 0) {
      isValid = false;
      issues.push(`${failedMigrations.length} migrations failed`);
    }

    // Check for duplicate prompt IDs
    const promptIds = this.migrations.map(m => m.id.split('_')[0]);
    const uniqueIds = new Set(promptIds);
    if (promptIds.length !== uniqueIds.size) {
      isValid = false;
      issues.push('Duplicate prompt IDs detected');
    }

    // Generate summary
    const summary = `Migration Status: ${this.migrations.length} total, ${this.migrations.filter(m => m.status === 'success').length} successful, ${failedMigrations.length} failed`;

    return {
      isValid,
      issues,
      summary
    };
  }

  /**
   * Export migration report
   */
  exportMigrationReport(): string {
    const status = this.getMigrationStatus();
    const validation = this.validateMigrations();

    return `# Prompt Migration Report

## Summary
${validation.summary}

## Migration Status
- Total Migrations: ${status.total}
- Successful: ${status.successful}
- Failed: ${status.failed}

## Migrations
${status.migrations.map(m => `
### ${m.id}
- **From**: ${m.fromLocation}
- **To**: ${m.toLocation}
- **Status**: ${m.status}
- **Date**: ${m.migrationDate.toISOString()}
- **Notes**: ${m.notes}
`).join('')}

## Validation
- **Valid**: ${validation.isValid ? 'Yes' : 'No'}
- **Issues**: ${validation.issues.length > 0 ? validation.issues.join(', ') : 'None'}

## Recommendations
${validation.isValid ? 'All migrations completed successfully. Ready to use the new prompt registry.' : 'Please review failed migrations and resolve any issues before proceeding.'}
`;
  }

  /**
   * Rollback a migration (placeholder for future implementation)
   */
  async rollbackMigration(migrationId: string): Promise<boolean> {
    // This would implement rollback logic for failed migrations
    // For now, it's a placeholder
    logger.debug(`Rollback for migration ${migrationId} would be implemented here`);
    return true;
  }
}

/**
 * Backward compatibility wrapper for existing API routes
 */
export class BackwardCompatibilityAdapter {
  private useOldPrompts: boolean = true;

  /**
   * Toggle between old and new prompt systems
   */
  setUseOldPrompts(useOld: boolean): void {
    this.useOldPrompts = useOld;
  }

  /**
   * Get prompt for boat suggestions (backward compatible)
   */
  getBoatSuggestionsPrompt(boatType: string, preferences: string[]): string {
    if (this.useOldPrompts) {
      // Return inline prompt (original implementation)
      return `Suggest 5 names for a ${boatType} boat based on the following preferences: ${preferences.join(', ')}.

The names should be:
- Memorable and easy to pronounce
- Related to sailing, the ocean, or nautical themes
- Not longer than 2 words
- Professional and appropriate for a crew boat

Return the names in this exact JSON format:
{
  "names": ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"]
}`;
    } else {
      // Use new registry system
      return promptRegistry.getPrompt('boat-suggestions').content as string;
    }
  }

  /**
   * Get prompt for boat details extraction (backward compatible)
   */
  getBoatDetailsPrompt(text: string): string {
    if (this.useOldPrompts) {
      // Return inline prompt (original implementation)
      return `Extract the following boat specifications from the text below:

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
    } else {
      // Use new registry system
      return promptRegistry.getPrompt('boat-details').content as string;
    }
  }

  /**
   * Get prompt for profile generation (backward compatible)
   */
  getProfileGenerationPrompt(facebookData: any): string {
    if (this.useOldPrompts) {
      // Return inline prompt (original implementation)
      return `Based on the following Facebook profile information, generate a comprehensive sailing profile:

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
    } else {
      // Use new registry system
      return promptRegistry.getPrompt('profile-generation').content as string;
    }
  }
}

// Global migration manager instance
export const migrationManager = new PromptMigrationManager();

// Global compatibility adapter instance
export const compatibilityAdapter = new BackwardCompatibilityAdapter();