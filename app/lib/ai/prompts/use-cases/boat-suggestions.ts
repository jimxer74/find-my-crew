/**
 * Boat Suggestions Prompt
 * Inline prompt template for generating boat name suggestions
 */

import { PromptUtils, USE_CASES, PROMPT_FORMATS } from '../index';

/**
 * Boat suggestions prompt definition
 * Migrated from: app/api/ai/suggest-sailboats/route.ts (lines 20-36)
 */
export const boatSuggestionsPrompt = PromptUtils.createTemplatePrompt(
  'boat-suggestions',
  USE_CASES.BOAT_SUGGESTIONS,
  `Suggest 5 names for a boat based on the following preferences: {preferences}.

The names should be:
- Memorable and easy to pronounce
- Related to sailing, the ocean, or nautical themes
- Not longer than 2 words
- Professional and appropriate for a crew boat

Return the names in this exact JSON format:
{
  "names": ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"]
}`,
  'Generate boat name suggestions based on boat type and user preferences',
  ['boat', 'naming', 'suggestions', 'creative']
);

/**
 * Alternative boat suggestions prompt with different style
 */
export const boatSuggestionsPromptV2 = PromptUtils.createTemplatePrompt(
  'boat-suggestions-v2',
  USE_CASES.BOAT_SUGGESTIONS,
  `Create 5 unique and memorable names for a boat. Consider the following preferences: {preferences}.

NAMES REQUIREMENTS:
- Must be 1-2 words maximum
- Should evoke sailing, ocean, or nautical imagery
- Should be easy to pronounce and remember
- Should be appropriate for a professional crew boat setting
- Avoid generic names like "Sailor" or "Boat"

CREATIVE INSPIRATION:
- Think about the boat's purpose and characteristics
- Consider the owner's personality and preferences
- Draw from maritime history, mythology, or nature
- Use wordplay or alliteration when appropriate

Return the names in this JSON format:
{
  "names": ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"],
  "reasoning": "Brief explanation for the naming theme"
}`,
  'Enhanced boat name suggestions with creative inspiration and reasoning',
  ['boat', 'naming', 'creative', 'themed']
);

/**
 * Function to create a boat suggestions prompt with specific parameters
 */
export function createBoatSuggestionsPrompt(
  boatType: string,
  preferences: string[]
): string {
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
}

/**
 * Function to create an enhanced boat suggestions prompt
 */
export function createEnhancedBoatSuggestionsPrompt(
  boatType: string,
  preferences: string[]
): string {
  return `Create 5 unique and memorable names for a ${boatType} boat. Consider the following preferences: ${preferences.join(', ')}.

NAMES REQUIREMENTS:
- Must be 1-2 words maximum
- Should evoke sailing, ocean, or nautical imagery
- Should be easy to pronounce and remember
- Should be appropriate for a professional crew boat setting
- Avoid generic names like "Sailor" or "Boat"

CREATIVE INSPIRATION:
- Think about the boat's purpose and characteristics
- Consider the owner's personality and preferences
- Draw from maritime history, mythology, or nature
- Use wordplay or alliteration when appropriate

Return the names in this JSON format:
{
  "names": ["Name 1", "Name 2", "Name 3", "Name 4", "Name 5"],
  "reasoning": "Brief explanation for the naming theme"
}`;
}

/**
 * Test cases for boat suggestions prompt
 */
export const boatSuggestionsTests = [
  PromptUtils.createTestCase(
    'Cruiser with elegant preferences',
    { boatType: 'cruiser', preferences: ['elegant', 'classic'] },
    JSON.stringify({
      names: ['Sea Breeze', 'Ocean Voyager', 'Blue Horizon', 'Mariner', 'Aurora']
    })
  ),
  PromptUtils.createTestCase(
    'Racing boat with performance preferences',
    { boatType: 'racing', preferences: ['fast', 'aggressive'] },
    JSON.stringify({
      names: ['Velocity', 'Storm Chaser', 'Riptide', 'Thunderwave', 'Hurricane']
    })
  ),
  PromptUtils.createTestCase(
    'Fishing boat with practical preferences',
    { boatType: 'fishing', preferences: ['functional', 'traditional'] },
    JSON.stringify({
      names: ['Reel Deal', 'Hook Line', 'Catch 22', 'Bait Master', 'Deep Sea']
    })
  )
];

/**
 * Comprehensive test suite for boat suggestions
 */
export const boatSuggestionsTestSuite = PromptUtils.createTestSuite(
  'Boat Suggestions Comprehensive Test',
  boatSuggestionsTests,
  0.8,
  1000,
  0.9
);

/**
 * Migration record for boat suggestions prompt
 */
export const boatSuggestionsMigration: any = {
  prompt: boatSuggestionsPrompt,
  fromLocation: 'app/api/ai/suggest-sailboats/route.ts',
  toLocation: 'app/lib/ai/prompts/use-cases/boat-suggestions.ts',
  description: 'Migrated inline prompt template to centralized prompt registry',
  version: '1.0.0',
  date: new Date('2024-02-05'),
  notes: 'Preserved original template structure with variable interpolation'
};