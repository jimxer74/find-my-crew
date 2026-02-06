/**
 * Use Case Classification System
 *
 * Implements hybrid intent classification with pattern recognition and LLM fallback
 * for crew sailing platform use cases.
 */
import { UserContext } from './types';
import { callAI, AIServiceError } from '../service';

/**
 * Available use case intents for the sailing platform
 */
export enum UseCaseIntent {
  CREW_SEARCH_SAILING_TRIPS = 'crew_search_sailing_trips',
  CREW_IMPROVE_PROFILE = 'crew_improve_profile',
  CREW_REGISTER = 'crew_register',
  GENERAL_CONVERSATION = 'general_conversation',
  CLARIFICATION_REQUEST = 'clarification_request',
}

/**
 * Standardized intent classification result
 */
export interface IntentMessage {
  intent: UseCaseIntent;
  secondaryIntent: UseCaseIntent | null;
  message: string;
  confidence: number;
  reasoning: string;
}

/**
 * Intent pattern for matching user messages
 */
export interface IntentPattern {
  pattern: RegExp;
  weight: number;
  description: string;
}

/**
 * Interface for use case classification
 */
export interface UseCaseClassifier {
  classifyIntent(userMessage: string): Promise<IntentMessage>;
  classifyIntentSync(userMessage: string): IntentMessage;
}

/**
 * Interface for data sanitization
 */
export interface DataSanitizer {
  sanitizeContext(context: UserContext): SanitizedUserContext;
  sanitizeMessage(message: string): string;
  sanitizeResponse(response: string): string;
}

/**
 * Interface for sensitive data filtering
 */
export interface SensitiveDataFilter {
  isSensitive(field: string, value: any): boolean;
  shouldIncludeForUseCase(useCase: UseCaseIntent, field: string): boolean;
}

/**
 * Sanitized user context with sensitive data removed
 */
export interface SanitizedUserContext
  extends Omit<UserContext, 'profile'> {
  profile?: Omit<
    UserContext['profile'],
    'username' | 'fullName' | 'roles' | 'certifications'
  > & {
    username?: string;
    fullName?: string;
    roles?: string[];
    certifications?: string;
  };
}

/**
 * Hybrid use case classifier implementation
 */
export class HybridUseCaseClassifier implements UseCaseClassifier {
  private fastPatterns: Map<UseCaseIntent, IntentPattern[]> = new Map([
    [
      UseCaseIntent.CREW_SEARCH_SAILING_TRIPS,
      [
        { pattern: /\bfind.*\bsail.*\btrip/i, weight: 5, description: 'Direct sailing trip search' },
        { pattern: /\bsearch.*\bsail.*\btrip/i, weight: 5, description: 'Direct sailing trip search' },
        { pattern: /\bfind.*\bsail.*\bleg/i, weight: 5, description: 'Direct sailing leg search' },
        { pattern: /\bsearch.*\bsail.*\bleg/i, weight: 5, description: 'Direct sailing leg search' },
        { pattern: /\blook.*\bfor.*\bsail.*\btrip/i, weight: 4, description: 'Looking for sailing trip' },
        { pattern: /\blook.*\bfor.*\bsail.*\bleg/i, weight: 4, description: 'Looking for sailing leg' },
        // ... (keeping your other patterns – not repeating all for brevity)
        { pattern: /\bcross.*ocean/i, weight: 3, description: 'Ocean crossing search' },
      ],
    ],
    [
      UseCaseIntent.CREW_IMPROVE_PROFILE,
      [
        { pattern: /\bimprove\b.*\bprofile/i, weight: 5, description: 'Direct profile improvement' },
        // ... (your patterns)
      ],
    ],
    [
      UseCaseIntent.CREW_REGISTER,
      [
        { pattern: /\bregister\b.*\bleg/i, weight: 5, description: 'Leg registration' },
        // ... (your patterns)
      ],
    ],
  ]);

  private confidenceThreshold: number = 5;
  private maxFastConfidence = 20; // used to normalize fast path score to 0–1 range

  /**
   * Asynchronous intent classification with hybrid approach
   */
  async classifyIntent(message: string): Promise<IntentMessage> {

    // Phase 1: Fast Pattern Recognition
    /*
    const fastResult = this.classifyFast(message);
    if (fastResult.confidence >= this.confidenceThreshold) {
      console.log(
        `[AI Assistant] Fast classification: ${fastResult.intent} (score: ${fastResult.confidence})`
      );
      return {
        intent: fastResult.intent,
        secondaryIntent: null,
        message: '',
        confidence: Math.min(fastResult.confidence / this.maxFastConfidence, 1),
        reasoning: 'Fast pattern recognition',
      };
    }
*/
    // Phase 2: LLM Fallback
    console.log(`[AI Assistant] Defaulting to LLM classification`);
    return await this.classifyWithLLM(message);
  }

  /**
   * Synchronous intent classification for performance-critical paths
   */
  classifyIntentSync(message: string): IntentMessage {
    const fastResult = this.classifyFast(message);

    if (fastResult.confidence >= this.confidenceThreshold) {
      return {
        intent: fastResult.intent,
        secondaryIntent: null,
        message: '',
        confidence: Math.min(fastResult.confidence / this.maxFastConfidence, 1),
        reasoning: 'Fast pattern recognition',
      };
    }

    // Safe synchronous fallback
    return {
      intent: UseCaseIntent.GENERAL_CONVERSATION,
      secondaryIntent: null,
      message: '',
      confidence: 0,
      reasoning: 'Low confidence in fast classification',
    };
  }

  /**
   * Fast pattern-based classification
   */
  private classifyFast(message: string): { intent: UseCaseIntent; confidence: number } {
    const normalized = message.toLowerCase();
    let bestIntent: UseCaseIntent | null = null;
    let bestScore = 0;

    for (const [intent, patterns] of this.fastPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.pattern.test(normalized)) {
          score += pattern.weight;
        }
      }

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
      confidence: bestScore,
    };
  }

  /**
   * LLM-based classification for low-confidence cases
   */
  private async classifyWithLLM(message: string): Promise<IntentMessage> {
    const prompt = `You are an intelligent Sailing platform assistant router. Your only job right now is to deeply understand the user's current message and classify their intent as precisely as possible.

Rules you must follow:
• Be extremely accurate — do not guess or over-generalize
• If multiple intents are present, pick the PRIMARY one and note secondary ones if relevant
• If the user is asking for clarification, continuing a previous request, or providing missing information → classify as "${UseCaseIntent.CLARIFICATION_REQUEST}"
• If you're not at least 70% confident → use "${UseCaseIntent.CLARIFICATION_REQUEST}"
• Use ONLY the exact intent values listed below — do not invent new ones

Available intents (use the exact value):
- ${UseCaseIntent.CREW_SEARCH_SAILING_TRIPS}: User wants to find sailing opportunities, journeys, voyages, trips, or legs as crew
- ${UseCaseIntent.CREW_IMPROVE_PROFILE}: User wants help to improve their crew profile, skills, description or certifications
- ${UseCaseIntent.CREW_REGISTER}: User wants to join/apply for a specific crew opportunity
- ${UseCaseIntent.GENERAL_CONVERSATION}: General questions, chit-chat or unclear intent
- ${UseCaseIntent.CLARIFICATION_REQUEST}: Cannot confidently classify — ask for clarification

IMPORTANT: Respond ONLY with valid JSON in this exact structure — NO extra text, NO markdown code blocks, NO explanations, NO formatting. Return ONLY the JSON object:

{
  "primary_intent": "one_of_the_values_above",
  "confidence": 0.0 to 1.0,
  "secondary_intent": "another_value_or_null",
  "message": "short message to the user (only if clarification is needed, otherwise empty string)",
  "reasoning": "short 1-2 sentence explanation why you chose this intent"
}

User message:
"${message}"
`;

    try {
      const result = await callAI({
        useCase: 'general-conversation',
        prompt,
        temperature: 0.1,
        maxTokens: 500,
      });

      // Additional safety check: if the response looks like it contains markdown
      // or other non-JSON content, try to extract just the JSON
      const response = result.text;

      // If the response starts with something other than {, try to find JSON within it
      if (response && !response.trim().startsWith('{')) {
        // Look for JSON pattern within the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return this.parseIntentResponse(jsonMatch[0]);
        }
      }

      return this.parseIntentResponse(response);
    } catch (error) {
      console.error('[AI Assistant] LLM classification failed:', error);
      return {
        intent: UseCaseIntent.CLARIFICATION_REQUEST,
        secondaryIntent: null,
        message: 'Sorry, I had trouble understanding. Could you please say more?',
        confidence: 0,
        reasoning: 'LLM call failed',
      };
    }
  }

  /**
   * Parse LLM response safely with enhanced markdown handling
   */
  private parseIntentResponse(response: string): IntentMessage {
    try {
      // Input validation and sanitization
      if (!response || typeof response !== 'string') {
        throw new Error('Invalid response format');
      }

      // Limit response length to prevent memory issues
      const maxResponseLength = 10000;
      if (response.length > maxResponseLength) {
        response = response.substring(0, maxResponseLength);
      }

      // Clean up common LLM output artifacts with enhanced markdown handling
      let cleaned = response.trim();

      // Handle various markdown code block formats:
      // ```json, ```JSON, ```javascript, ```python, ``` (no language), ``` js, etc.
      // Remove opening code block (case-insensitive, with optional language identifier)
      cleaned = cleaned.replace(/^```(?:json|js|javascript|python|tsx|ts|\s*)?\s*/i, '');

      // Remove closing code block
      cleaned = cleaned.replace(/\s*```$/i, '');

      // Handle the specific case where response starts with backticks but doesn't match above pattern
      // This addresses the error case: "```" at the start
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3).trim();
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.substring(0, cleaned.length - 3).trim();
      }

      // Remove any remaining leading/trailing whitespace and newlines
      cleaned = cleaned.trim();

      // Additional cleanup for common LLM artifacts
      // Remove any remaining "json" text that might be left over
      cleaned = cleaned.replace(/^\s*json\s*/i, '');

      // Parse the cleaned JSON
      const json = JSON.parse(cleaned);

      // Validate required fields
      if (!json.primary_intent) {
        throw new Error('Missing primary_intent field');
      }

      const intent = json.primary_intent as UseCaseIntent;
      if (!Object.values(UseCaseIntent).includes(intent)) {
        console.warn('Invalid intent value:', intent);
        return {
          intent: UseCaseIntent.CLARIFICATION_REQUEST,
          secondaryIntent: null,
          message: 'Sorry, I didn’t quite understand. Could you clarify what you’re looking for?',
          confidence: 0,
          reasoning: 'Invalid intent value received from LLM',
        };
      }

      return {
        intent,
        secondaryIntent:
          json.secondary_intent && Object.values(UseCaseIntent).includes(json.secondary_intent)
            ? (json.secondary_intent as UseCaseIntent)
            : null,
        confidence: Number(json.confidence) || 0,
        message: String(json.message || ''),
        reasoning: String(json.reasoning || 'Classified by LLM'),
      };
    } catch (err) {
      // Enhanced error logging without exposing full raw response
      const errorInfo = err instanceof Error ? err.message : String(err);
      const responsePreview = response ? response.substring(0, 200) + (response.length > 200 ? '...' : '') : 'empty';

      console.error('Failed to parse intent JSON:', {
        error: errorInfo,
        responsePreview,
        responseLength: response ? response.length : 0
      });

      return {
        intent: UseCaseIntent.CLARIFICATION_REQUEST,
        secondaryIntent: null,
        message: 'Sorry, I didn’t quite understand. Could you clarify what you’re looking for?',
        confidence: 0,
        reasoning: 'Failed to parse LLM classification response',
      };
    }
  }

  /**
   * Contextual scoring based on sailing platform terminology
   */
  private contextualScoring(message: string, intent: UseCaseIntent): number {
    let score = 0;

    if (intent === UseCaseIntent.CREW_SEARCH_SAILING_TRIPS) {
      const locationKeywords = [
        'barcelona',
        'mediterranean',
        'caribbean',
        'pacific',
        'atlantic',
        'amsterdam',
        'new york',
        'california',
        'florida',
        'bahamas',
      ];
      score += locationKeywords.filter((k) => message.includes(k)).length;

      const actionVerbs = ['find', 'search', 'look', 'want', 'need', 'looking', 'interested'];
      const hasActionVerb = actionVerbs.some((v) => message.includes(v));

      const crewTerms = [
        'crew',
        'position',
        'role',
        'experience level',
        'skill level',
        'captain',
        'skipper',
        'watch',
        'deck',
        'navigation',
      ];
      if (hasActionVerb) score += crewTerms.filter((k) => message.includes(k)).length;

      const sailingComplexity = [
        'coastal',
        'offshore',
        'bluewater',
        'transatlantic',
        'circumnavigation',
        'long-distance',
        'short-haul',
      ];
      if (hasActionVerb) score += sailingComplexity.filter((k) => message.includes(k)).length;
    }

    // Similar logic for other intents (omitted here for brevity – keep your original)

    return score;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }

  addCustomPattern(intent: UseCaseIntent, pattern: IntentPattern): void {
    if (!this.fastPatterns.has(intent)) {
      this.fastPatterns.set(intent, []);
    }
    this.fastPatterns.get(intent)!.push(pattern);
  }

  getPatternStats(): Record<UseCaseIntent, number> {
    const stats: Record<UseCaseIntent, number> = {
      [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]: 0,
      [UseCaseIntent.CREW_IMPROVE_PROFILE]: 0,
      [UseCaseIntent.CREW_REGISTER]: 0,
      [UseCaseIntent.GENERAL_CONVERSATION]: 0,
      [UseCaseIntent.CLARIFICATION_REQUEST]: 0,
    };
    for (const [intent, patterns] of this.fastPatterns) {
      stats[intent] = patterns.length;
    }
    return stats;
  }
}

// Export type if needed elsewhere
export type { UserContext };