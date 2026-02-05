/**
 * Boat Details Prompt
 * Inline prompt template for extracting boat specifications from text
 */

import { PromptUtils, USE_CASES, PROMPT_FORMATS } from '../index';

/**
 * Boat details extraction prompt definition
 * Migrated from: app/api/ai/fill-boat-details/route.ts (lines 20-65)
 */
export const boatDetailsPrompt = PromptUtils.createTemplatePrompt(
  'boat-details',
  USE_CASES.BOAT_DETAILS,
  `Extract the following boat specifications from the text below:

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
"\${text}"`,
  'Extract boat specifications from unstructured text with strict formatting requirements',
  ['boat', 'extraction', 'specifications', 'formatting', 'validation']
);

/**
 * Enhanced boat details extraction prompt with additional fields
 */
export const boatDetailsEnhancedPrompt = PromptUtils.createTemplatePrompt(
  'boat-details-enhanced',
  USE_CASES.BOAT_DETAILS,
  `Extract the following boat specifications from the text below:

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
- fuel_capacity: Fuel capacity in gallons (e.g., "150 gal")
- water_capacity: Water capacity in gallons (e.g., "100 gal")
- headroom: Interior headroom in feet (e.g., "6.5 ft")

OPTIONAL FIELDS (include if mentioned):
- sails: Types and condition of sails
- electronics: Navigation and communication equipment
- condition: Overall condition description
- features: Special features or upgrades

Return the boat specifications in this exact JSON format:
{
  "name": "string",
  "make_model": "string",
  "year": "string",
  "length": "string",
  "beam": "string",
  "draft": "string",
  "displacement": "string",
  "engine": "string",
  "fuel_capacity": "string",
  "water_capacity": "string",
  "headroom": "string",
  "sails": "string",
  "electronics": "string",
  "condition": "string",
  "features": "string"
}

TEXT TO ANALYZE:
"\${text}"`,
  'Enhanced boat specifications extraction with additional fields and optional data',
  ['boat', 'extraction', 'detailed', 'comprehensive']
);

/**
 * Function to create a boat details extraction prompt with specific text
 */
export function createBoatDetailsPrompt(text: string): string {
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
}

/**
 * Function to create an enhanced boat details extraction prompt
 */
export function createEnhancedBoatDetailsPrompt(text: string): string {
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
- fuel_capacity: Fuel capacity in gallons (e.g., "150 gal")
- water_capacity: Water capacity in gallons (e.g., "100 gal")
- headroom: Interior headroom in feet (e.g., "6.5 ft")

OPTIONAL FIELDS (include if mentioned):
- sails: Types and condition of sails
- electronics: Navigation and communication equipment
- condition: Overall condition description
- features: Special features or upgrades

Return the boat specifications in this exact JSON format:
{
  "name": "string",
  "make_model": "string",
  "year": "string",
  "length": "string",
  "beam": "string",
  "draft": "string",
  "displacement": "string",
  "engine": "string",
  "fuel_capacity": "string",
  "water_capacity": "string",
  "headroom": "string",
  "sails": "string",
  "electronics": "string",
  "condition": "string",
  "features": "string"
}

TEXT TO ANALYZE:
"${text}"`;
}

/**
 * Test cases for boat details extraction prompt
 */
export const boatDetailsTests = [
  PromptUtils.createTestCase(
    'Complete boat specification',
    {
      text: 'This 2020 Beneteau Oceanis 46 cruiser has 46 feet of length, 14 feet beam, and 6 feet draft. It features a Yanmar 75 HP engine with 150 gallons of fuel capacity.'
    },
    JSON.stringify({
      name: 'Not specified',
      make_model: 'Beneteau Oceanis 46',
      year: '2020',
      length: '46 ft',
      beam: '14 ft',
      draft: '6 ft',
      displacement: 'Not specified',
      engine: 'Yanmar 75 HP',
      fuel_capacity: '150 gal',
      water_capacity: 'Not specified',
      headroom: 'Not specified'
    })
  ),
  PromptUtils.createTestCase(
    'Partial boat specification',
    {
      text: 'A beautiful sailing boat with 40 feet length and a Volvo engine.'
    },
    JSON.stringify({
      name: 'Not specified',
      make_model: 'Not specified',
      year: 'Not specified',
      length: '40 ft',
      beam: 'Not specified',
      draft: 'Not specified',
      displacement: 'Not specified',
      engine: 'Volvo',
      fuel_capacity: 'Not specified',
      water_capacity: 'Not specified',
      headroom: 'Not specified'
    })
  ),
  PromptUtils.createTestCase(
    'Boat with name and basic specs',
    {
      text: 'The Sea Breeze is a 2018 Jeanneau Sun Odyssey 44 with 44 feet length and a 50 HP diesel engine.'
    },
    JSON.stringify({
      name: 'Sea Breeze',
      make_model: 'Jeanneau Sun Odyssey 44',
      year: '2018',
      length: '44 ft',
      beam: 'Not specified',
      draft: 'Not specified',
      displacement: 'Not specified',
      engine: '50 HP diesel',
      fuel_capacity: 'Not specified',
      water_capacity: 'Not specified',
      headroom: 'Not specified'
    })
  )
];

/**
 * Comprehensive test suite for boat details extraction
 */
export const boatDetailsTestSuite = PromptUtils.createTestSuite(
  'Boat Details Extraction Comprehensive Test',
  boatDetailsTests,
  0.85,
  1500,
  0.9
);

/**
 * Migration record for boat details prompt
 */
export const boatDetailsMigration: any = {
  prompt: boatDetailsPrompt,
  fromLocation: 'app/api/ai/fill-boat-details/route.ts',
  toLocation: 'app/lib/ai/prompts/use-cases/boat-details.ts',
  description: 'Migrated inline prompt template with strict formatting requirements to centralized prompt registry',
  version: '1.0.0',
  date: new Date('2024-02-05'),
  notes: 'Preserved all critical formatting requirements and field specifications'
};