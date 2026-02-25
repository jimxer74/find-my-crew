/**
 * System Prompt Builder
 * Reusable utilities for building complex system prompts with context injection
 */

import { BuilderContext, TemplateContext } from '../types';

/**
 * System prompt builder for AI assistant with dynamic context injection
 */
export class SystemPromptBuilder {
  private baseTemplate: string;
  private contextSections: Map<string, (context: BuilderContext) => string> = new Map();

  constructor(baseTemplate?: string) {
    this.baseTemplate = baseTemplate || this.getDefaultTemplate();
  }

  /**
   * Add a context section to the prompt
   */
  addContextSection(name: string, builder: (context: BuilderContext) => string): this {
    this.contextSections.set(name, builder);
    return this;
  }

  /**
   * Build the complete system prompt with context
   */
  build(context: BuilderContext = {}): string {
    let prompt = this.baseTemplate;

    // Inject context sections
    for (const [name, builder] of this.contextSections) {
      const section = builder(context);
      if (section) {
        prompt = prompt.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), section);
      }
    }

    // Handle remaining template variables
    prompt = this.interpolateTemplate(prompt, context);

    return prompt;
  }

  /**
   * Get the default system prompt template
   */
  private getDefaultTemplate(): string {
    return `You are a sailing crew management assistant. Your role is to help users find sailing opportunities, manage their profiles, and connect with boat owners.

## Context
{{userContext}}

## Tools Available
{{availableTools}}

## Instructions
{{instructions}}

## Response Format
{{responseFormat}

## Validation Rules
{{validationRules}

IMPORTANT: Always follow the instructions exactly as written. Do not make up information or provide generic responses.

When in doubt, ask for clarification rather than making assumptions.

Return your responses in the specified JSON format with no additional text or explanations.`;
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, context: BuilderContext): string {
    return template.replace(/\$\{(\w+)\}/g, (match, key) => {
      const value = context[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Create a user context section
   */
  static createUserContext(context: BuilderContext): string {
    const sections: string[] = [];

    if (context.userContext) {
      const user = context.userContext;
      sections.push(`### User Profile
- Name: ${user.name || 'Unknown'}
- Role: ${user.role || 'Unknown'}
- Experience: ${user.experience || 'Not specified'}
- Skills: ${user.skills?.join(', ') || 'None specified'}
- Preferences: ${user.preferences?.join(', ') || 'None specified'}`);
    }

    if (context.inputData) {
      sections.push(`### Current Request
${JSON.stringify(context.inputData, null, 2)}`);
    }

    return sections.join('\\n\\n');
  }

  /**
   * Create available tools section
   */
  static createToolsSection(availableTools: string[]): string {
    if (!availableTools || availableTools.length === 0) {
      return 'No tools available.';
    }

    return `The following tools are available:

${availableTools.map((tool, index) => `${index + 1}. **${tool}**`).join('\\n')}
`;
  }

  /**
   * Create instructions section
   */
  static createInstructions(instructions: string[]): string {
    if (!instructions || instructions.length === 0) {
      return 'No specific instructions provided.';
    }

    return `Follow these instructions carefully:

${instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\\n')}
`;
  }

  /**
   * Create response format section
   */
  static createResponseFormat(format: string): string {
    return `### Response Format
${format}`;
  }

  /**
   * Create validation rules section
   */
  static createValidationRules(rules: string[]): string {
    if (!rules || rules.length === 0) {
      return 'No validation rules specified.';
    }

    return `### Validation Rules
Ensure your responses follow these rules:

${rules.map((rule, index) => `${index + 1}. ${rule}`).join('\\n')}
`;
  }
}

/**
 * Assistant system prompt builder factory
 */
export class AssistantSystemPromptBuilder extends SystemPromptBuilder {
  constructor() {
    super();
    this.setupDefaultSections();
  }

  private setupDefaultSections(): void {
    this.addContextSection('userContext', SystemPromptBuilder.createUserContext)
      .addContextSection('availableTools', (context) =>
        SystemPromptBuilder.createToolsSection(context.availableTools || [])
      )
      .addContextSection('instructions', (context) =>
        SystemPromptBuilder.createInstructions(context.instructions || [])
      )
      .addContextSection('responseFormat', (context) =>
        SystemPromptBuilder.createResponseFormat(context.responseFormat || 'JSON')
      )
      .addContextSection('validationRules', (context) =>
        SystemPromptBuilder.createValidationRules(context.validationRules || [])
      );
  }

  /**
   * Build assistant system prompt with standard configuration
   */
  buildAssistantSystemPrompt(context: BuilderContext): string {
    // Add standard instructions for assistant
    context.instructions = context.instructions || [
      'Prioritize user safety and accurate information',
      'Verify information before providing responses',
      'Use available tools when appropriate',
      'Maintain professional sailing terminology',
      'Provide clear, actionable advice'
    ];

    // Add standard response format
    context.responseFormat = context.responseFormat || `
Use this JSON structure for your responses:
{
  "type": "text|tool_call|error",
  "content": "Your response here",
  "toolName": "name_of_tool_if_applicable",
  "toolArgs": "arguments_if_applicable"
}`;

    // Add standard validation rules
    context.validationRules = context.validationRules || [
      'Always validate user input for completeness',
      'Check for potential safety concerns in sailing advice',
      'Ensure all tool calls have proper parameters',
      'Return JSON responses when specified',
      'Do not provide information about unverified sailing routes or conditions'
    ];

    return this.build(context);
  }
}

/**
 * Template-based prompt builder for common patterns
 */
export class TemplatePromptBuilder {
  /**
   * Build a boat suggestions prompt
   */
  static buildBoatSuggestionsPrompt(boatType: string, preferences: string[]): string {
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
   * Build a boat details extraction prompt
   */
  static buildBoatDetailsPrompt(description: string): string {
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
"${description}"`;
  }

  /**
   * Build a profile generation prompt
   */
  static buildProfileGenerationPrompt(facebookData: any): string {
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
  }

  /**
   * Build a registration assessment prompt
   */
  static buildRegistrationAssessmentPrompt(
    crewProfile: any,
    legRequirements: any,
    qAndA: any
  ): string {
    return `Assess the compatibility between the crew member and the sailing leg requirements.

Crew Profile:
${JSON.stringify(crewProfile, null, 2)}

Leg Requirements:
${JSON.stringify(legRequirements, null, 2)}

Questions and Answers:
${JSON.stringify(qAndA, null, 2)}

Please provide a compatibility assessment with the following structure:

1. Overall Compatibility Score (1-10)
2. Strengths (what makes this a good match)
3. Concerns (potential issues or mismatches)
4. Recommendations (suggestions for either party)

Return your assessment in this JSON format:
{
  "compatibilityScore": number,
  "strengths": string[],
  "concerns": string[],
  "recommendations": string[],
  "matchStatus": "strong_match|good_match|potential_match|not_recommended"
}`;
  }
}