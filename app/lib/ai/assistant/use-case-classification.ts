/**
 * Use Case Classification System
 *
 * Implements hybrid intent classification with pattern recognition and LLM fallback
 * for crew sailing platform use cases.
 */

// Import UserContext from types file
import { UserContext } from './types';
import { callAI, AIServiceError } from '../service';

/**
 * Available use case intents for the sailing platform
 */
export enum UseCaseIntent {
  CREW_SEARCH_SAILING_TRIPS = 'crew_search_sailing_trips',
  CREW_IMPROVE_PROFILE = 'crew_improve_profile',
  CREW_REGISTER = 'crew_register',
  GENERAL_CONVERSATION = 'general_conversation'
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
  classifyIntent(userMessage: string): Promise<UseCaseIntent>;
  classifyIntentSync(userMessage: string): UseCaseIntent;
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
export interface SanitizedUserContext extends Omit<UserContext, 'profile'> {
  profile?: Omit<UserContext['profile'], 'username' | 'fullName' | 'roles' | 'certifications'> & {
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
    [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, [
      { pattern: /\bfind.*\bsail.*\btrip/i, weight: 5, description: 'Direct sailing trip search' },
      { pattern: /\bsearch.*\bsail.*\btrip/i, weight: 5, description: 'Direct sailing trip search' },
      { pattern: /\bfind.*\bsail.*\bleg/i, weight: 5, description: 'Direct sailing leg search' },
      { pattern: /\bsearch.*\bsail.*\bleg/i, weight: 5, description: 'Direct sailing leg search' },
      { pattern: /\blook.*\bfor.*\bsail.*\btrip/i, weight: 4, description: 'Looking for sailing trip' },
      { pattern: /\blook.*\bfor.*\bsail.*\bleg/i, weight: 4, description: 'Looking for sailing leg' },
      { pattern: /\bfind.*\bsail.*\bopportunity/i, weight: 5, description: 'Direct sailing opportunity search' },
      { pattern: /\bsearch.*\bsail.*\bopportunity/i, weight: 5, description: 'Direct sailing opportunity search' },
      { pattern: /\bfind.*\bsailing.*\bopportunity/i, weight: 5, description: 'Direct sailing opportunity search' },
      { pattern: /\bsearch.*\bsailing.*\bopportunity/i, weight: 5, description: 'Direct sailing opportunity search' },
      { pattern: /\bfind.*\bsail.*\bopportunities/i, weight: 5, description: 'Direct sailing opportunities search' },
      { pattern: /\bsearch.*\bsail.*\bopportunities/i, weight: 5, description: 'Direct sailing opportunities search' },
      { pattern: /\bfind.*\bsailing.*\bopportunities/i, weight: 5, description: 'Direct sailing opportunities search' },
      { pattern: /\bsearch.*\bsailing.*\bopportunities/i, weight: 5, description: 'Direct sailing opportunities search' },
      { pattern: /\bhelp.*search.*sail.*trip/i, weight: 4, description: 'Help with sailing trip search' },
      { pattern: /\bhelp.*find.*sail.*trip/i, weight: 4, description: 'Help with sailing trip search' },
      { pattern: /\bhelp.*search.*sail.*leg/i, weight: 4, description: 'Help with sailing leg search' },
      { pattern: /\bhelp.*find.*sail.*leg/i, weight: 4, description: 'Help with sailing leg search' },
      { pattern: /\bfrom.*to.*sail/i, weight: 3, description: 'Route specification' },
      { pattern: /\bmediterranean.*trip/i, weight: 3, description: 'Location-specific search' },
      { pattern: /\bleg.*sail/i, weight: 3, description: 'Leg-specific search' },
      { pattern: /\bcrew.*position/i, weight: 4, description: 'Crew position inquiry' },
      { pattern: /\bjourney.*search/i, weight: 3, description: 'Journey search pattern' },
      { pattern: /\bwhere.*sail.*trip/i, weight: 3, description: 'Location-based sailing trip inquiry' },
      { pattern: /\bocean.*trip/i, weight: 3, description: 'Ocean trip search' },
      { pattern: /\bcross.*ocean/i, weight: 3, description: 'Ocean crossing search' }
    ]],
    [UseCaseIntent.CREW_IMPROVE_PROFILE, [
      { pattern: /\bimprove\b.*\bprofile/i, weight: 5, description: 'Direct profile improvement' },
      { pattern: /\bupdate\b.*\bskills/i, weight: 5, description: 'Skills update request' },
      { pattern: /\benhance\b.*\bprofile/i, weight: 4, description: 'Profile enhancement' },
      { pattern: /\bhelp.*better.*profile/i, weight: 4, description: 'Profile help request' },
      { pattern: /\boptimize\b.*\bprofile/i, weight: 3, description: 'Profile optimization' },
      { pattern: /\bcertification.*improve/i, weight: 4, description: 'Certification enhancement' },
      { pattern: /\bmake.*better.*profile/i, weight: 4, description: 'Profile quality improvement' },
      { pattern: /\bcomplete\b.*\bprofile/i, weight: 4, description: 'Profile completion request' },
      { pattern: /\bfill.*profile/i, weight: 4, description: 'Profile filling request' },
      { pattern: /\bfix.*profile/i, weight: 3, description: 'Profile fixing request' },
      { pattern: /\bmissing.*profile/i, weight: 3, description: 'Missing profile information' },
      { pattern: /\badd.*profile/i, weight: 3, description: 'Adding profile information' }
    ]],
    [UseCaseIntent.CREW_REGISTER, [
      { pattern: /\bregister\b.*\bleg/i, weight: 5, description: 'Leg registration' },
      { pattern: /\bjoin\b.*\btrip/i, weight: 5, description: 'Trip joining' },
      { pattern: /\bsign.*up.*crew/i, weight: 5, description: 'Crew sign up' },
      { pattern: /\bsign.*up.*position/i, weight: 5, description: 'Position sign up' },
      { pattern: /\bapply\b.*\bopportunity/i, weight: 4, description: 'Opportunity application' },
      { pattern: /\bapply\b.*\bposition/i, weight: 4, description: 'Position application' },
      { pattern: /\bavailable.*sail/i, weight: 4, description: 'Availability inquiry' },
      { pattern: /\binterested.*join/i, weight: 4, description: 'Joining interest expression' },
      { pattern: /\bcan.*i.*join/i, weight: 4, description: 'Joining capability inquiry' },
      { pattern: /\bwant.*register/i, weight: 4, description: 'Registration desire expression' },
      { pattern: /\bhow.*register/i, weight: 3, description: 'Registration process inquiry' },
      { pattern: /\bposition.*available/i, weight: 3, description: 'Position availability' },
      { pattern: /\bslot.*available/i, weight: 3, description: 'Slot availability' },
      { pattern: /\bcrew.*available/i, weight: 4, description: 'Crew availability inquiry' },
      { pattern: /\bcrew.*position/i, weight: 3, description: 'Crew position inquiry' },
      { pattern: /\bsign.*up.*opportunity/i, weight: 3, description: 'Opportunity sign up' },
      { pattern: /\bjoin.*\bcrew.*\bsummer/i, weight: 4, description: 'Summer crew joining' },
      { pattern: /\bjoin.*\bcrew.*\bsail/i, weight: 4, description: 'Crew sailing joining' }
    ]],
  ]);

  private confidenceThreshold: number = 5;

  /**
   * Asynchronous intent classification with hybrid approach
   */
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

  /**
   * Synchronous intent classification for performance-critical paths
   */
  classifyIntentSync(message: string): UseCaseIntent {
    // Synchronous version for performance-critical paths
    const fastResult = this.classifyFast(message);
    return fastResult.confidence >= this.confidenceThreshold
      ? fastResult.intent
      : UseCaseIntent.GENERAL_CONVERSATION; // Default fallback without async call
  }

  /**
   * Fast pattern-based classification
   */
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

  /**
   * LLM-based classification for low-confidence cases
   */
  private async classifyWithLLM(message: string): Promise<UseCaseIntent> {
    const prompt = `Classify this user message into one of these crew sailing platform intents:

- crew_search_sailing_trips: User wants to find sailing opportunities, trips, or legs as crew
- crew_improve_profile: User wants help with their crew profile, skills, or certifications
- crew_register: User wants to join/apply for a specific crew opportunity
- general_conversation: General questions or unclear intent

Message: "${message}"

Respond ONLY with the intent name (exact match), no explanation, no additional text.`;

    try {
      const result = await callAI({
        useCase: 'general-conversation',
        prompt: prompt,
        temperature: 0.1,
        maxTokens: 50
      });
      return this.parseIntentResponse(result.text);
    } catch (error) {
      console.error('[AI Assistant] LLM classification failed:', error);
      return UseCaseIntent.GENERAL_CONVERSATION;
    }
  }

  /**
   * Parse LLM response to extract intent
   */
  private parseIntentResponse(response: string): UseCaseIntent {
    const normalized = response.toLowerCase().trim();

    // More specific matching for sailing search - require multiple keywords
    if (normalized.includes('crew_search') ||
        (normalized.includes('search') && (normalized.includes('trip') || normalized.includes('leg') || normalized.includes('opportunity'))) ||
        (normalized.includes('find') && (normalized.includes('trip') || normalized.includes('leg') || normalized.includes('opportunity')))) {
      return UseCaseIntent.CREW_SEARCH_SAILING_TRIPS;
    } else if (normalized.includes('crew_improve') || normalized.includes('improve') || normalized.includes('profile') || normalized.includes('skill')) {
      return UseCaseIntent.CREW_IMPROVE_PROFILE;
    } else if (normalized.includes('crew_register') || normalized.includes('register') || normalized.includes('join') || normalized.includes('apply')) {
      return UseCaseIntent.CREW_REGISTER;
    } else {
      return UseCaseIntent.GENERAL_CONVERSATION;
    }
  }

  /**
   * Contextual scoring based on sailing platform terminology
   */
  private contextualScoring(message: string, intent: UseCaseIntent): number {
    let score = 0;

    // Location mentions for crew search
    if (intent === UseCaseIntent.CREW_SEARCH_SAILING_TRIPS) {
      const locationKeywords = ['barcelona', 'mediterranean', 'caribbean', 'pacific', 'atlantic', 'amsterdam', 'new york', 'california', 'florida', 'bahamas'];
      score += locationKeywords.filter(k => message.includes(k.toLowerCase())).length;

      // Crew-specific terms - only add if message contains action verbs or intent indicators
      const actionVerbs = ['find', 'search', 'look', 'want', 'need', 'looking', 'interested'];
      const hasActionVerb = actionVerbs.some(v => message.includes(v));
      const crewTerms = ['crew', 'position', 'role', 'experience level', 'skill level', 'captain', 'skipper', 'watch', 'deck', 'navigation'];
      const crewMatches = crewTerms.filter(k => message.includes(k)).length;

      // Only add crew term score if there are action verbs (indicates intent)
      if (hasActionVerb) {
        score += crewMatches;
      }

      // Sailing distance/complexity indicators - only add if message contains action verbs
      const sailingComplexity = ['coastal', 'offshore', 'bluewater', 'transatlantic', 'circumnavigation', 'long-distance', 'short-haul'];
      const sailingMatches = sailingComplexity.filter(k => message.includes(k)).length;

      if (hasActionVerb) {
        score += sailingMatches;
      }
    }

    // Profile-related terms for crew profile improvement
    if (intent === UseCaseIntent.CREW_IMPROVE_PROFILE) {
      const profileTerms = ['skills', 'certification', 'experience', 'description', 'bio', 'resume', 'cv', 'qualifications', 'training', 'courses'];
      score += profileTerms.filter(k => message.includes(k)).length;

      // Crew-specific improvement terms
      const improvementTerms = ['better', 'enhance', 'optimize', 'update', 'improve', 'strengthen', 'develop', 'advance', 'upgrade'];
      score += improvementTerms.filter(k => message.includes(k)).length;

      // Profile completeness indicators
      const completenessTerms = ['missing', 'empty', 'blank', 'incomplete', 'partial', 'need', 'add', 'fill', 'complete'];
      score += completenessTerms.filter(k => message.includes(k)).length;
    }

    // Crew registration keywords
    if (intent === UseCaseIntent.CREW_REGISTER) {
      const registrationKeywords = ['register', 'join', 'apply', 'interested', 'want to', 'available', 'sign up', 'participate', 'take part', 'get involved'];
      score += registrationKeywords.filter(k => message.includes(k)).length;

      // Crew position terms
      const positionTerms = ['crew', 'position', 'role', 'opportunity', 'opening', 'spot', 'place', 'slot', 'slot available', 'position available'];
      score += positionTerms.filter(k => message.includes(k)).length;

      // Availability indicators
      const availabilityTerms = ['when', 'available', 'time', 'date', 'period', 'season', 'month', 'year', 'now', 'soon'];
      score += availabilityTerms.filter(k => message.includes(k)).length;
    }

    return score;
  }

  /**
   * Configure confidence threshold
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }

  /**
   * Add custom pattern based on user feedback
   */
  addCustomPattern(intent: UseCaseIntent, pattern: IntentPattern): void {
    if (!this.fastPatterns.has(intent)) {
      this.fastPatterns.set(intent, []);
    }
    this.fastPatterns.get(intent)!.push(pattern);
  }

  /**
   * Get pattern statistics for monitoring
   */
  getPatternStats(): Record<UseCaseIntent, number> {
    const stats: Record<UseCaseIntent, number> = {
      [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]: 0,
      [UseCaseIntent.CREW_IMPROVE_PROFILE]: 0,
      [UseCaseIntent.CREW_REGISTER]: 0,
      [UseCaseIntent.GENERAL_CONVERSATION]: 0
    };

    for (const [intent, patterns] of this.fastPatterns) {
      stats[intent] = patterns.length;
    }

    return stats;
  }
}

// Export UserContext for use in other modules
export type { UserContext };