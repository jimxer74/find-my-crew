# AI Assistant Iterative Approach Implementation Plan

## Overview

This document provides a comprehensive plan for breaking down the current monolithic AI assistant into an iterative, use-case-driven system that delivers focused, relevant responses instead of overwhelming users with all possible scenarios.

## Current State Analysis

### Problems with Current Architecture

1. **Massive System Prompt (340+ lines)**
   - Contains ALL possible scenarios regardless of user intent
   - Overwhelms LLM with unnecessary context
   - Poor performance and response quality

2. **One-Size-Fits-All Tool Presentation**
   - All tools shown to all users
   - No prioritization based on user intent
   - User confusion and decision paralysis

3. **No Early Intent Classification**
   - No attempt to understand user goal before processing
   - Wasted computation on irrelevant functionality

4. **Context Dilution**
   - All user data included regardless of relevance
   - Performance impact and privacy concerns

## Proposed Solution Architecture

### Phase 1: Intent Classification System

#### 1.1 Hybrid Use Case Classification
Implement a tiered intent classifier that runs BEFORE the main AI call, using pattern recognition first with LLM fallback for low-confidence cases:

```typescript
interface UseCaseClassifier {
  classifyIntent(userMessage: string): Promise<UseCaseIntent>;
  classifyIntentSync(userMessage: string): UseCaseIntent;
}

enum UseCaseIntent {
  CREW_SEARCH_SAILING_TRIPS = 'crew_search_sailing_trips',
  CREW_IMPROVE_PROFILE = 'crew_improve_profile',
  CREW_REGISTER = 'crew_register',
  GENERAL_CONVERSATION = 'general_conversation'
}
```

#### 1.2 Data Sanitization Layer
Implement comprehensive data sanitization to exclude sensitive personal identification information from all prompts:

```typescript
interface DataSanitizer {
  sanitizeContext(context: UserContext): SanitizedUserContext;
  sanitizeMessage(message: string): string;
  sanitizeResponse(response: string): string;
}

interface SensitiveDataFilter {
  isSensitive(field: string, value: any): boolean;
  shouldIncludeForUseCase(useCase: UseCaseIntent, field: string): boolean;
}
```

#### 1.2 Classification Patterns

**CREW UC1: crew_search_sailing_trips**
- Keywords: "find", "search", "look for", "opportunity", "trip", "journey", "leg", "sail", "crew position", "join boat"
- Patterns: "I want to find...", "Looking for...", "Can you help me find..."
- Triggers: Location mentions (city, region, sea), date ranges, skill requirements, boat type preferences

**CREW UC2: crew_improve_profile**
- Keywords: "improve", "update", "change", "better", "optimize", "enhance", "profile", "skills", "certifications"
- Patterns: "How can I...", "What should I...", "Can you help me improve..."
- Triggers: Profile-related questions, skill/certification mentions, experience level concerns

**CREW UC3: crew_register**
- Keywords: "register", "join", "apply", "sign up", "interested", "want to join", "crew position"
- Patterns: "I want to register...", "Can I join...", "How do I apply..."
- Triggers: Specific leg/journey mentions, registration questions, availability inquiries

#### 1.3 Hybrid Classification Implementation

```typescript
interface IntentPattern {
  pattern: RegExp;
  weight: number;
  description: string;
}

class HybridUseCaseClassifier implements UseCaseClassifier {
  private fastPatterns: Map<UseCaseIntent, IntentPattern[]> = new Map([
    [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, [
      { pattern: /\bfind\b.*\bsail/i, weight: 5, description: 'Direct sailing search' },
      { pattern: /\bsearch\b.*\btrip/i, weight: 5, description: 'Trip search pattern' },
      { pattern: /\blook.*\bfor.*\bcrew/i, weight: 5, description: 'Crew position search' },
      { pattern: /\bjoin.*\bboat/i, weight: 4, description: 'Boat joining' },
      { pattern: /\bfrom.*to.*sail/i, weight: 3, description: 'Route specification' },
      { pattern: /\bmediterranean.*trip/i, weight: 3, description: 'Location-specific search' },
      { pattern: /\bleg.*sail/i, weight: 3, description: 'Leg-specific search' },
      { pattern: /\bcrew.*position/i, weight: 4, description: 'Crew position inquiry' }
    ]],
    [UseCaseIntent.CREW_IMPROVE_PROFILE, [
      { pattern: /\bimprove\b.*\bprofile/i, weight: 5, description: 'Direct profile improvement' },
      { pattern: /\bupdate\b.*\bskills/i, weight: 5, description: 'Skills update request' },
      { pattern: /\benhance\b.*\bprofile/i, weight: 4, description: 'Profile enhancement' },
      { pattern: /\bhelp.*better.*profile/i, weight: 4, description: 'Profile help request' },
      { pattern: /\boptimize\b.*\bprofile/i, weight: 3, description: 'Profile optimization' },
      { pattern: /\bcertification.*improve/i, weight: 4, description: 'Certification enhancement' }
    ]],
    [UseCaseIntent.CREW_REGISTER, [
      { pattern: /\bregister\b.*\bleg/i, weight: 5, description: 'Leg registration' },
      { pattern: /\bjoin\b.*\btrip/i, weight: 5, description: 'Trip joining' },
      { pattern: /\bsign.*up.*crew/i, weight: 5, description: 'Crew sign up' },
      { pattern: /\bapply\b.*\bopportunity/i, weight: 4, description: 'Opportunity application' },
      { pattern: /\bavailable.*sail/i, weight: 4, description: 'Availability inquiry' }
    ]],
  ]);

  private confidenceThreshold: number = 5;
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  async classifyIntent(message: string): Promise<UseCaseIntent> {
    // Phase 1: Fast Pattern Recognition
    const fastResult = this.classifyFast(message);

    if (fastResult.confidence >= this.confidenceThreshold) {
      console.log(`[AI Assistant] Fast classification: ${fastResult.intent} (confidence: ${fastResult.confidence})`);
      return fastResult.intent;
    }

    // Phase 2: LLM Fallback for Low Confidence
    console.log(`[AI Assistant] Falling back to LLM classification (confidence: ${fastResult.confidence})`);
    return await this.classifyWithLLM(message);
  }

  classifyIntentSync(message: string): UseCaseIntent {
    // Synchronous version for performance-critical paths
    const fastResult = this.classifyFast(message);
    return fastResult.confidence >= this.confidenceThreshold
      ? fastResult.intent
      : UseCaseIntent.GENERAL_CONVERSATION; // Default fallback without async call
  }

  private classifyFast(message: string): { intent: UseCaseIntent; confidence: number } {
    const normalized = message.toLowerCase();
    let bestIntent: UseCaseIntent | null = null;
    let bestScore = 0;

    // Pattern matching with weighted scoring
    for (const [intent, patterns] of this.fastPatterns) {
      let score = 0;

      for (const pattern of patterns) {
        if (pattern.pattern.test(normalized)) {
          score += pattern.weight;
        }
      }

      // Additional contextual scoring
      if (score > 0) {
        score += this.contextualScoring(normalized, intent);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return {
      intent: bestIntent || UseCaseIntent.GENERAL_CONVERSATION,
      confidence: bestScore
    };
  }

  private async classifyWithLLM(message: string): Promise<UseCaseIntent> {
    const prompt = `Classify this user message into one of these crew sailing platform intents:

- crew_search_sailing_trips: User wants to find sailing opportunities, trips, or legs as crew
- crew_improve_profile: User wants help with their crew profile, skills, or certifications
- crew_register: User wants to join/apply for a specific crew opportunity
- general_conversation: General questions or unclear intent

Message: "${message}"

Respond ONLY with the intent name (exact match), no explanation, no additional text.`;

    try {
      const response = await this.aiService.generate(prompt);
      return this.parseIntentResponse(response);
    } catch (error) {
      console.error('[AI Assistant] LLM classification failed:', error);
      return UseCaseIntent.GENERAL_CONVERSATION;
    }
  }

  private parseIntentResponse(response: string): UseCaseIntent {
    const normalized = response.toLowerCase().trim();

    if (normalized.includes('crew_search') || normalized.includes('search') || normalized.includes('trip') || normalized.includes('sail')) {
      return UseCaseIntent.CREW_SEARCH_SAILING_TRIPS;
    } else if (normalized.includes('crew_improve') || normalized.includes('improve') || normalized.includes('profile') || normalized.includes('skill')) {
      return UseCaseIntent.CREW_IMPROVE_PROFILE;
    } else if (normalized.includes('crew_register') || normalized.includes('register') || normalized.includes('join') || normalized.includes('apply')) {
      return UseCaseIntent.CREW_REGISTER;
    } else {
      return UseCaseIntent.GENERAL_CONVERSATION;
    }
  }

  private contextualScoring(message: string, intent: UseCaseIntent): number {
    let score = 0;

    // Location mentions for crew search
    if (intent === UseCaseIntent.CREW_SEARCH_SAILING_TRIPS) {
      const locationKeywords = ['barcelona', 'mediterranean', 'caribbean', 'pacific', 'atlantic', 'amsterdam', 'new york'];
      score += locationKeywords.filter(k => message.includes(k.toLowerCase())).length;

      // Crew-specific terms
      const crewTerms = ['crew', 'position', 'role', 'experience level', 'skill level'];
      score += crewTerms.filter(k => message.includes(k)).length;
    }

    // Profile-related terms for crew profile improvement
    if (intent === UseCaseIntent.CREW_IMPROVE_PROFILE) {
      const profileTerms = ['skills', 'certification', 'experience', 'description', 'bio', 'resume', 'cv'];
      score += profileTerms.filter(k => message.includes(k)).length;

      // Crew-specific improvement terms
      const improvementTerms = ['better', 'enhance', 'optimize', 'update', 'improve'];
      score += improvementTerms.filter(k => message.includes(k)).length;
    }

    // Crew registration keywords
    if (intent === UseCaseIntent.CREW_REGISTER) {
      const registrationKeywords = ['register', 'join', 'apply', 'interested', 'want to', 'available', 'sign up'];
      score += registrationKeywords.filter(k => message.includes(k)).length;

      // Crew position terms
      const positionTerms = ['crew', 'position', 'role', 'opportunity', 'opening'];
      score += positionTerms.filter(k => message.includes(k)).length;
    }

    return score;
  }

  // Configuration method to adjust confidence threshold
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }

  // Method to add custom patterns based on user feedback
  addCustomPattern(intent: UseCaseIntent, pattern: IntentPattern): void {
    if (!this.fastPatterns.has(intent)) {
      this.fastPatterns.set(intent, []);
    }
    this.fastPatterns.get(intent)!.push(pattern);
  }
}

#### 1.3 Data Sanitization Implementation

```typescript
class CrewDataSanitizer implements DataSanitizer {
  private sensitiveFields: Set<string> = new Set([
    'username', 'fullName', 'firstName', 'lastName', 'email', 'phone',
    'phoneNumber', 'address', 'postalCode', 'city', 'country', 'image',
    'avatar', 'profileImage', 'dateOfBirth', 'nationality', 'emergencyContact'
  ]);

  private piiPatterns: RegExp[] = [
    /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g,           // Email addresses
    /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,        // SSN-like patterns
    /\b\d{10,}\b/g,                              // Long number sequences
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // Phone numbers
    /\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/gi      // UK postal codes
  ];

  private useCaseFieldAccess: Record<UseCaseIntent, string[]> = {
    [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]: [
      'sailingExperience', 'skills', 'certifications', 'riskLevel', 'availability',
      'preferences', 'experienceLevel', 'rolePreferences'
    ],
    [UseCaseIntent.CREW_IMPROVE_PROFILE]: [
      'userDescription', 'skills', 'certifications', 'sailingExperience',
      'riskLevel', 'experienceLevel', 'profileCompleteness'
    ],
    [UseCaseIntent.CREW_REGISTER]: [
      'sailingExperience', 'skills', 'certifications', 'riskLevel', 'availability',
      'recentRegistrations', 'experienceLevel'
    ],
    [UseCaseIntent.GENERAL_CONVERSATION]: [
      'roles', 'sailingExperience', 'skills'
    ]
  };

  sanitizeContext(context: UserContext, useCase: UseCaseIntent): SanitizedUserContext {
    // Deep clone to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(context));

    // Remove sensitive fields globally
    this.removeSensitiveFields(sanitized);

    // Apply use-case specific filtering
    this.applyUseCaseFiltering(sanitized, useCase);

    // Sanitize user messages in context
    if (sanitized.conversations) {
      sanitized.conversations = sanitized.conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
          content: this.sanitizeMessage(msg.content)
        }))
      }));
    }

    return sanitized;
  }

  sanitizeMessage(message: string): string {
    let sanitized = message;

    // Remove PII patterns
    for (const pattern of this.piiPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Remove common sensitive terms
    const sensitiveTerms = ['my email', 'my phone', 'my address', 'my username'];
    for (const term of sensitiveTerms) {
      sanitized = sanitized.replace(new RegExp(term, 'gi'), 'this information');
    }

    return sanitized;
  }

  sanitizeResponse(response: string): string {
    // Remove any accidentally exposed PII from AI responses
    let sanitized = response;

    // Remove email patterns from responses
    sanitized = sanitized.replace(this.piiPatterns[0], '[REDACTED_EMAIL]');

    // Remove phone patterns from responses
    sanitized = sanitized.replace(this.piiPatterns[3], '[REDACTED_PHONE]');

    return sanitized;
  }

  private removeSensitiveFields(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    for (const field of this.sensitiveFields) {
      if (obj.hasOwnProperty(field)) {
        delete obj[field];
      }
    }

    // Recursively clean nested objects
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key]);
      }
    }
  }

  private applyUseCaseFiltering(context: any, useCase: UseCaseIntent): void {
    const allowedFields = new Set(this.useCaseFieldAccess[useCase]);

    // Filter user profile
    if (context.profile) {
      const profile = context.profile;
      const filteredProfile: any = {};

      for (const field of allowedFields) {
        if (profile.hasOwnProperty(field)) {
          filteredProfile[field] = profile[field];
        }
      }

      context.profile = filteredProfile;
    }

    // Filter other context sections based on use case
    this.filterContextSections(context, useCase);
  }

  private filterContextSections(context: any, useCase: UseCaseIntent): void {
    switch (useCase) {
      case UseCaseIntent.CREW_SEARCH_SAILING_TRIPS:
        // Keep only search-relevant context
        delete context.boats;
        delete context.pendingActions;
        if (context.recentRegistrations) {
          context.recentRegistrations = context.recentRegistrations.slice(0, 3);
        }
        break;

      case UseCaseIntent.CREW_IMPROVE_PROFILE:
        // Keep only profile-relevant context
        delete context.boats;
        delete context.recentRegistrations;
        delete context.pendingActions;
        break;

      case UseCaseIntent.CREW_REGISTER:
        // Keep only registration-relevant context
        delete context.boats;
        if (context.recentRegistrations) {
          context.recentRegistrations = context.recentRegistrations.slice(0, 5);
        }
        break;

      case UseCaseIntent.GENERAL_CONVERSATION:
        // Keep minimal context
        delete context.boats;
        delete context.recentRegistrations;
        delete context.pendingActions;
        break;
    }
  }
}

class SensitiveDataValidator {
  private static readonly MAX_STRING_LENGTH = 200;
  private static readonly MAX_ARRAY_SIZE = 10;

  static validateContext(context: any): void {
    // Check for any remaining sensitive data
    const serialized = JSON.stringify(context);
    const emailPattern = /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/;
    const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

    if (emailPattern.test(serialized)) {
      throw new Error('Sensitive email data detected in context');
    }

    if (phonePattern.test(serialized)) {
      throw new Error('Sensitive phone data detected in context');
    }

    // Check for excessive data
    if (serialized.length > 50000) {
      throw new Error('Context size exceeds maximum allowed size');
    }
  }

  static sanitizeOutput(output: string): string {
    // Remove any potential PII from AI output
    return output.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g, '[REDACTED_EMAIL]');
  }
}
```

### Phase 2: Modular Prompt System

#### 2.1 Prompt Template Architecture

```typescript
interface PromptTemplate {
  id: string;
  useCase: UseCaseIntent;
  baseTemplate: string;
  contextSections: PromptSection[];
  toolInstructions: string;
  responseFormat: string;
}

interface PromptSection {
  name: string;
  condition: (context: UserContext) => boolean;
  content: (context: UserContext) => string;
}
```

#### 2.2 Use Case Specific Prompts

**CREW UC1: Crew Search Sailing Trips**
```typescript
const crewSearchTripsTemplate: PromptTemplate = {
  id: 'crew-search-trips-v1',
  useCase: UseCaseIntent.CREW_SEARCH_SAILING_TRIPS,
  baseTemplate: `You are a crew sailing trip finder specialist. Your goal is to help crew members find the perfect sailing opportunities based on their skills, experience level, and preferences.`,
  contextSections: [
    {
      name: 'crew-profile',
      condition: (ctx) => !!ctx.profile,
      content: (ctx) => `Crew Profile: ${ctx.profile?.fullName}\nExperience Level: ${ctx.profile?.sailingExperience}\nSkills: ${ctx.profile?.skills.join(', ')}\nCertifications: ${ctx.profile?.certifications}\nRoles: ${ctx.profile?.roles.join(', ')}`
    },
    {
      name: 'crew-preferences',
      condition: (ctx) => !!ctx.profile,
      content: (ctx) => `Crew Preferences:\n- Experience Level: ${ctx.profile?.sailingExperience}\n- Risk Level: ${ctx.profile?.riskLevel.join(', ')}\n- Availability: ${ctx.profile?.availability || 'Not specified'}`
    },
    {
      name: 'recent-activity',
      condition: (ctx) => ctx.recentRegistrations.length > 0,
      content: (ctx) => `Recent Activity: ${ctx.recentRegistrations.length} recent registrations as crew`
    }
  ],
  toolInstructions: `Available tools for this use case:
1. search_legs_by_location - Primary tool for location-based searches
2. search_legs - Secondary tool for general searches
3. get_leg_details - For detailed information about specific legs`,
  responseFormat: `Present results in a clear, actionable format with leg names, dates, experience requirements, and brief descriptions. Use the format: [[leg:LEG_UUID:Leg Name]] for clickable references. Focus on crew opportunities and skill requirements.`
};
```

**CREW UC2: Crew Improve Profile**
```typescript
const crewImproveProfileTemplate: PromptTemplate = {
  id: 'crew-improve-profile-v1',
  useCase: UseCaseIntent.CREW_IMPROVE_PROFILE,
  baseTemplate: `You are a crew profile optimization specialist. Your goal is to help crew members improve their profiles to increase their chances of finding suitable sailing opportunities.`,
  contextSections: [
    {
      name: 'current-crew-profile',
      condition: (ctx) => !!ctx.profile,
      content: (ctx) => `Current Crew Profile Status:\n- User Description: ${ctx.profile?.userDescription || 'Missing'}\n- Certifications: ${ctx.profile?.certifications || 'Missing'}\n- Skills: ${ctx.profile?.skills.join(', ')}\n- Experience Level: ${ctx.profile?.sailingExperience}\n- Risk Level: ${ctx.profile?.riskLevel.join(', ')}`
    },
    {
      name: 'crew-completeness',
      condition: (ctx) => !!ctx.profile,
      content: (ctx) => `Crew Profile Completeness: ${this.calculateCompleteness(ctx.profile)}% complete`
    },
    {
      name: 'crew-experience-analysis',
      condition: (ctx) => !!ctx.profile,
      content: (ctx) => `Crew Experience Analysis:\n- Current Experience Level: ${ctx.profile?.sailingExperience}\n- Available Certifications: ${ctx.profile?.certifications}\n- Skill Gaps: ${this.identifySkillGaps(ctx.profile)}`
    }
  ],
  toolInstructions: `Available tools for this use case:
1. suggest_profile_update_user_description - For missing or weak user descriptions
2. suggest_profile_update_certifications - For missing or incomplete certifications
3. suggest_profile_update_skills - For skill enhancement suggestions specific to crew roles`,
  responseFormat: `Provide specific, actionable suggestions focused on crew opportunities. Focus on 1-2 improvements at a time. Use the format: [[suggest:FIELD:Reason]] for actionable items.`
};
```

#### 2.3 Prompt Builder Implementation

```typescript
class ModularPromptBuilder {
  private templates: Map<UseCaseIntent, PromptTemplate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates() {
    // Load all crew use case specific templates
    this.templates.set(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, crewSearchTripsTemplate);
    this.templates.set(UseCaseIntent.CREW_IMPROVE_PROFILE, crewImproveProfileTemplate);
    // ... load other crew templates
  }

  buildPrompt(intent: UseCaseIntent, context: UserContext): string {
    const template = this.templates.get(intent);
    if (!template) {
      throw new Error(`No template found for use case: ${intent}`);
    }

    let prompt = template.baseTemplate;

    // Add context sections
    for (const section of template.contextSections) {
      if (section.condition(context)) {
        prompt += `\n\n## ${section.name.toUpperCase()}\n${section.content(context)}`;
      }
    }

    // Add tool instructions
    prompt += `\n\n## TOOLS AVAILABLE\n${template.toolInstructions}`;

    // Add response format
    prompt += `\n\n## RESPONSE FORMAT\n${template.responseFormat}`;

    return prompt;
  }
}
```

### Phase 3: Dynamic Tool Selection

#### 3.1 Tool Registry with Use Case Mapping

```typescript
interface ToolRegistry {
  getToolsForUseCase(intent: UseCaseIntent, userRoles: string[]): ToolDefinition[];
}

class UseCaseToolRegistry implements ToolRegistry {
  private toolMappings: Map<UseCaseIntent, string[]> = new Map([
    [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, [
      'search_legs_by_location',
      'search_legs',
      'get_leg_details',
      'get_journey_details'
    ]],
    [UseCaseIntent.CREW_IMPROVE_PROFILE, [
      'suggest_profile_update_user_description',
      'suggest_profile_update_certifications',
      'suggest_profile_update_skills'
    ]],
    [UseCaseIntent.CREW_REGISTER, [
      'suggest_register_for_leg',
      'get_leg_registration_info'
    ]],
    [UseCaseIntent.GENERAL_CONVERSATION, [
      'get_user_profile',
      'get_pending_actions',
      'get_suggestions'
    ]]
  ]);

  getToolsForUseCase(intent: UseCaseIntent, userRoles: string[]): ToolDefinition[] {
    const toolNames = this.toolMappings.get(intent) || [];

    // Get all tools and filter by use case and user roles
    const allTools = getToolsForUser(userRoles); // Existing function
    return allTools.filter(tool => toolNames.includes(tool.name));
  }
}
```

#### 3.2 Tool Prioritization

```typescript
class ToolPrioritizer {
  prioritizeTools(tools: ToolDefinition[], context: {
    userMessage: string;
    intent: UseCaseIntent;
    userContext: UserContext;
  }): ToolDefinition[] {
    // Score tools based on relevance
    const scoredTools = tools.map(tool => {
      let score = 0;

      // Base score based on use case priority
      score += this.getUseCasePriority(context.intent, tool.name);

      // Context-based scoring
      score += this.getContextRelevance(tool, context);

      // User message keyword matching
      score += this.getKeywordRelevance(tool, context.userMessage);

      return { tool, score };
    });

    // Sort by score descending
    return scoredTools
      .sort((a, b) => b.score - a.score)
      .map(item => item.tool);
  }

  private getUseCasePriority(intent: UseCaseIntent, toolName: string): number {
    const priorities: Record<UseCaseIntent, Record<string, number>> = {
      [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]: {
        'search_legs_by_location': 10,
        'search_legs': 8,
        'get_leg_details': 6
      },
      [UseCaseIntent.CREW_IMPROVE_PROFILE]: {
        'suggest_profile_update_user_description': 10,
        'suggest_profile_update_certifications': 8
      }
      // ... other priorities for crew use cases
    };

    return priorities[intent]?.[toolName] || 1;
  }
}
```

### Phase 4: Enhanced Processing Flow

#### 4.1 New Processing Flow

```typescript
class IterativeAssistantService {
  private classifier: HybridUseCaseClassifier;
  private promptBuilder: ModularPromptBuilder;
  private toolRegistry: UseCaseToolRegistry;
  private toolPrioritizer: ToolPrioritizer;
  private dataSanitizer: CrewDataSanitizer;

  async chat(
    supabase: SupabaseClient,
    request: ChatRequest,
    options: AssistantOptions
  ): Promise<ChatResponse> {

    // Phase 0: Data Sanitization (Before Processing)
    const sanitizedUserMessage = this.dataSanitizer.sanitizeMessage(request.message);
    console.log(`[AI Assistant] Sanitized user message: ${sanitizedUserMessage}`);

    // Phase 1: Intent Classification (Hybrid Approach)
    const intent = await this.classifier.classifyIntent(sanitizedUserMessage);
    console.log(`[AI Assistant] Classified intent: ${intent}`);

    // Phase 2: Context Building (Focused and Sanitized)
    const context = await getUserContext(supabase, options.userId);
    const focusedContext = this.filterContextForUseCase(context, intent);
    const sanitizedContext = this.dataSanitizer.sanitizeContext(focusedContext, intent);

    // Phase 3: Prompt Building (Modular)
    const systemPrompt = this.promptBuilder.buildPrompt(intent, sanitizedContext);

    // Phase 4: Tool Selection (Dynamic)
    const userRoles = sanitizedContext.profile?.roles || [];
    const allTools = this.toolRegistry.getToolsForUseCase(intent, userRoles);
    const prioritizedTools = this.toolPrioritizer.prioritizeTools(allTools, {
      userMessage: sanitizedUserMessage,
      intent,
      userContext: sanitizedContext
    });

    // Phase 5: AI Processing (Focused)
    const messages = this.buildMessages(systemPrompt, history);
    const aiResponse = await this.processAIWithTools(messages, prioritizedTools, {
      userId: options.userId,
      userRoles,
      conversationId: options.conversationId
    });

    // Phase 6: Response Generation (Use-Case Specific Formatting)
    const formattedResponse = this.formatResponse(aiResponse, intent);

    // Phase 7: Response Sanitization (Before Returning)
    const sanitizedResponse = this.dataSanitizer.sanitizeResponse(formattedResponse);
    console.log(`[AI Assistant] Sanitized response: ${sanitizedResponse}`);

    // Phase 8: Save and Return
    return this.saveAndReturnResponse(supabase, sanitizedResponse, options);
  }

  private filterContextForUseCase(context: UserContext, intent: UseCaseIntent): UserContext {
    // Only include relevant context for crew use cases
    switch (intent) {
      case UseCaseIntent.CREW_SEARCH_SAILING_TRIPS:
        return {
          ...context,
          boats: [], // Not relevant for crew searching
          recentRegistrations: context.recentRegistrations.slice(0, 3) // Limit recent crew applications
        };
      case UseCaseIntent.CREW_IMPROVE_PROFILE:
        return {
          ...context,
          boats: [], // Not relevant for crew profile improvement
          recentRegistrations: [] // Not relevant for profile improvement
        };
      case UseCaseIntent.CREW_REGISTER:
        return {
          ...context,
          boats: [], // Not relevant for crew registration
          recentRegistrations: context.recentRegistrations.slice(0, 5) // Recent crew activity
        };
      default:
        return context;
    }
  }
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
1. **Create Crew-Focused Hybrid Intent Classification System**
   - Implement `HybridUseCaseClassifier` with crew-specific pattern recognition
   - Create high-confidence pattern definitions for crew search, profile improvement, and registration
   - Add LLM fallback mechanism for low-confidence classifications
   - Implement confidence scoring and threshold configuration
   - Add feedback loop for pattern improvement based on crew interactions

2. **Implement Comprehensive Data Sanitization Layer**
   - Create `CrewDataSanitizer` for PII detection and removal
   - Implement sensitive field filtering and regex-based PII detection
   - Add use-case specific context filtering
   - Create response sanitization mechanisms
   - Implement validation and audit logging

2. **Build Modular Prompt System**
   - Create `PromptTemplate` interfaces
   - Implement `ModularPromptBuilder`
   - Create initial templates for UC1 and UC2

3. **Create Dynamic Tool Registry**
   - Implement `UseCaseToolRegistry`
   - Map tools to use cases
   - Create tool prioritization logic

### Phase 2: Core Implementation (Week 3-4)
1. **Modify Service Layer**
   - Update `chat()` function to use new flow
   - Implement context filtering
   - Add use-case specific response formatting

2. **Create Templates for All Use Cases**
   - Complete templates for UC3 and UC4
   - Add response format specifications
   - Create testing scenarios

3. **Enhanced Error Handling**
   - Graceful fallback to general conversation
   - Classification confidence scoring
   - User feedback mechanisms

### Phase 3: Optimization (Week 5-6)
1. **Performance Optimization**
   - Cache classification results
   - Optimize prompt building
   - Implement lazy loading for heavy context

2. **User Experience Improvements**
   - Add classification feedback
   - Implement user correction mechanisms
   - Create usage analytics

3. **Advanced Features**
   - Machine learning for classification improvement
   - Context-aware tool suggestions
   - Multi-turn conversation support

## Alternative Approaches

### Alternative 1: Gradual Migration (Recommended)
**Pros:**
- Low risk - can rollback easily
- Incremental improvements visible
- Can test each use case independently
- Minimal disruption to existing users

**Cons:**
- Longer implementation time
- Temporary code duplication
- More complex testing

**Implementation:**
1. Start with UC1 (search_sailing_trips)
2. Gradually add other use cases
3. Keep old system as fallback
4. Remove old system after all use cases migrated

### Alternative 2: Complete Rewrite
**Pros:**
- Clean architecture from start
- No legacy code to maintain
- Consistent patterns throughout
- Faster final implementation

**Cons:**
- High risk - all-or-nothing
- Long development time without visible progress
- Potential for undiscovered edge cases
- User disruption during transition

**Implementation:**
1. Build new system in parallel
2. Comprehensive testing
3. Cut over at specific date
4. Remove old system immediately

### Alternative 3: Hybrid Approach
**Pros:**
- Balance of risk and speed
- Can leverage existing patterns
- Incremental but with clear migration path

**Cons:**
- Complex integration logic
- Potential for inconsistent behavior
- Requires careful coordination

**Implementation:**
1. Identify high-impact use cases (UC1, UC2)
2. Implement new system for these use cases
3. Keep old system for other cases
4. Gradually migrate remaining cases

## Success Criteria

### Technical Metrics
- **Response Time**: 20% improvement in average response time for crew interactions
- **LLM Token Usage**: 30% reduction in system prompt tokens
- **Classification Accuracy**: 90%+ accuracy for main crew use cases
- **Pattern Recognition Coverage**: 80%+ of crew requests classified via patterns (no LLM needed)
- **LLM Fallback Rate**: Less than 20% of crew requests require LLM classification
- **Tool Relevance**: 80%+ of suggested tools are actually used by crew members
- **Data Sanitization**: 100% of PII removed from prompts and responses
- **Security Compliance**: Zero sensitive data exposure in AI interactions

### User Experience Metrics
- **User Satisfaction**: Measured through feedback surveys
- **Task Completion**: Time to complete common tasks
- **Error Rate**: Reduction in user confusion and errors
- **Engagement**: Increased usage of AI assistant features

### Business Metrics
- **Conversion Rate**: Improved registration and search completion
- **User Retention**: Better user experience leading to retention
- **Support Tickets**: Reduction in AI-related support requests
- **Data Security**: Zero data breach incidents related to AI interactions
- **Compliance**: Full adherence to data protection regulations
- **User Trust**: Increased user confidence in AI assistant privacy

## Risk Mitigation

### Risk 1: Poor Classification Accuracy
**Mitigation:**
- Start with high-confidence crew-specific patterns (weight 5+)
- Implement user feedback loop for pattern improvement
- Set appropriate confidence thresholds (configurable)
- Keep fallback to general conversation
- Continuous pattern refinement based on LLM corrections
- Monitor LLM fallback rates to identify pattern gaps
- Focus on crew language and terminology in pattern development

### Risk 2: Sensitive Data Exposure
**Mitigation:**
- Comprehensive PII detection patterns for emails, phone numbers, addresses
- Multi-layer sanitization: input, context, and output filtering
- Use-case specific field access control
- Regular validation of sanitization effectiveness
- Security testing with synthetic PII data
- Audit logging for data sanitization processes
- Compliance with data protection regulations (GDPR, CCPA)

### Risk 2: Performance Degradation
**Mitigation:**
- Benchmark each phase
- Implement caching strategies
- Monitor token usage
- Optimize prompt templates

### Risk 3: User Confusion During Transition
**Mitigation:**
- Clear communication about changes
- Gradual rollout to subsets of users
- Easy opt-out mechanism
- Comprehensive user documentation

### Risk 4: Missing Edge Cases
**Mitigation:**
- Extensive testing with real user data
- Monitor for unusual patterns
- Implement graceful error handling
- Maintain logging for analysis

## Rollback Strategy

### Immediate Rollback
- Feature flags to disable new system
- Database rollback scripts ready
- Monitoring alerts for error rates
- Communication plan for users

### Gradual Rollback
- Disable specific use cases individually
- Analyze failure patterns
- Fix and re-enable incrementally
- Maintain old system as fallback

## Implementation Timeline

### Week 1-2: Foundation
├── **Hybrid Intent Classification System**
│   ├── Fast pattern recognition implementation
│   ├── LLM fallback mechanism
│   ├── Confidence scoring system
│   └── Pattern definition and testing
├── **Data Sanitization Layer**
│   ├── Sensitive data detection patterns
│   ├── PII removal algorithms
│   ├── Use-case specific field filtering
│   └── Response sanitization mechanisms
├── Modular Prompt Framework
└── Dynamic Tool Registry

### Week 3-4: Core Implementation
├── Service Layer Updates
├── Complete Use Case Templates
└── Enhanced Error Handling

### Week 5-6: Optimization
├── Performance Improvements
├── User Experience Enhancements
├── Advanced Features
└── Pattern Coverage Expansion

### Week 7: Testing & Deployment
├── Comprehensive Testing
├── User Acceptance Testing
├── Gradual Rollout
└── Monitoring & Optimization

### Week 8: Pattern Enhancement
├── Analyze LLM fallback patterns
├── Expand pattern coverage based on usage
├── User feedback integration
└── Final performance tuning
```

## Conclusion

This iterative approach with hybrid intent classification will significantly improve the AI assistant's performance, user experience, and maintainability. By focusing on specific crew use cases and using a two-tier classification system, we can provide more relevant, faster, and higher-quality responses to users.

**Key Benefits of Hybrid Approach:**
- **Performance**: 80%+ of requests classified instantly via patterns
- **Accuracy**: LLM handles complex cases that patterns miss
- **Cost**: Minimal LLM usage for classification
- **Learning**: Pattern system improves over time based on LLM corrections
- **User Experience**: Fast responses with fallback intelligence

**Crew-Focused Advantages:**
- **Role-Specific Patterns**: Tailored to crew language and terminology
- **Contextual Relevance**: Filters out owner-specific information
- **Improved Accuracy**: Focused classification for better results
- **Enhanced UX**: Responses tailored to crew member needs

The gradual migration approach minimizes risk while allowing for continuous improvement and user feedback incorporation. This architecture also provides a solid foundation for future enhancements and additional use cases.

**Future Owner Use Cases:**
Once the crew use cases are stable and performing well, we can extend the system to support owner-specific use cases:
- **OWNER_SEARCH_CREW**: Finding suitable crew members
- **OWNER_MANAGE_TRIPS**: Managing sailing trips and opportunities
- **OWNER_IMPROVE_LISTING**: Enhancing boat listings and trip descriptions

**Implementation Strategy:**
1. Deploy pattern-based classification first with high-confidence thresholds
2. Monitor fallback rates and misclassification patterns
3. Use LLM corrections to expand and refine pattern definitions
4. Gradually increase pattern coverage while maintaining performance
5. Create feedback loops for continuous improvement
6. Extend to owner use cases after crew implementation is stable

**Data Security Strategy:**
1. Implement multi-layer sanitization at input, context, and output levels
2. Use comprehensive PII detection patterns for emails, phone numbers, and addresses
3. Apply use-case specific field filtering to minimize data exposure
4. Regularly validate sanitization effectiveness with synthetic data
5. Maintain audit logs for security compliance
6. Ensure GDPR and CCPA compliance in all data handling

This hybrid approach balances the need for immediate performance improvements with the flexibility to handle complex user intents that require AI reasoning, while providing a clear path for future role-based expansion and maintaining the highest standards of data security and privacy protection.