/**
 * Modular Prompt System
 *
 * Implements use-case specific prompt templates with conditional context sections.
 */

import { UserContext, UseCaseIntent, SanitizedUserContext } from './use-case-classification';

/**
 * Prompt template interface
 */
export interface PromptTemplate {
  id: string;
  useCase: UseCaseIntent;
  baseTemplate: string;
  contextSections: PromptSection[];
  toolInstructions: string;
  responseFormat: string;
}

/**
 * Prompt section interface
 */
export interface PromptSection {
  name: string;
  condition: (context: UserContext) => boolean;
  content: (context: UserContext) => string;
}

/**
 * Modular prompt builder
 */
export class ModularPromptBuilder {
  private templates: Map<UseCaseIntent, PromptTemplate> = new Map();

  constructor() {
    this.loadTemplates();
  }

  /**
   * Load all use case specific templates
   */
  private loadTemplates(): void {
    // Load all crew use case specific templates
    this.templates.set(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, this.createCrewSearchTripsTemplate());
    this.templates.set(UseCaseIntent.CREW_IMPROVE_PROFILE, this.createCrewImproveProfileTemplate());
    this.templates.set(UseCaseIntent.CREW_REGISTER, this.createCrewRegisterTemplate());
    this.templates.set(UseCaseIntent.GENERAL_CONVERSATION, this.createGeneralConversationTemplate());
  }

  /**
   * Create crew search sailing trips template
   */
  private createCrewSearchTripsTemplate(): PromptTemplate {
    return {
      id: 'crew-search-trips-v1',
      useCase: UseCaseIntent.CREW_SEARCH_SAILING_TRIPS,
      baseTemplate: `You are a crew sailing trip finder specialist. Your goal is to help crew members find the perfect sailing opportunities based on their skills, experience level, and preferences.

Focus on: Crew search functionality, sailing trip matching, leg and journey exploration, location-based searches, and sailing opportunity discovery.`,
      contextSections: [
        {
          name: 'crew-profile',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `Crew Profile: ${(ctx.profile as any)?.username || 'Anonymous'}
Experience Level: ${this.getExperienceLevelName((ctx.profile as any)?.sailingExperience || 1)}
Skills: ${(ctx.profile as any)?.skills?.join(', ') || 'None specified'}
Certifications: ${(ctx.profile as any)?.certifications || 'None specified'}
Roles: ${(ctx.profile as any)?.roles?.join(', ') || 'None specified'}`,
        },
        {
          name: 'crew-preferences',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `Crew Preferences:
- Experience Level: ${this.getExperienceLevelName((ctx.profile as any)?.sailingExperience || 1)}
- Risk Level: ${(ctx.profile as any)?.riskLevel?.join(', ') || 'Not specified'}
- Sailing Preferences: ${(ctx.profile as any)?.sailingPreferences || 'Not specified'}`,
        },
        {
          name: 'recent-activity',
          condition: (ctx) => !!ctx.recentRegistrations && ctx.recentRegistrations.length > 0,
          content: (ctx) => `Recent Activity: ${ctx.recentRegistrations?.length || 0} recent registrations as crew
Recent Journeys: ${ctx.recentRegistrations?.slice(0, 3).map(r => `"${r.journeyName}"`).join(', ') || ''}`,
        },
        {
          name: 'platform-context',
          condition: (ctx) => true,
          content: () => `Platform Context:
- Sailing journeys and legs available for crew registration
- Location-based search capabilities (Mediterranean, Caribbean, etc.)
- Experience level matching (Beginner to Offshore Skipper)
- Risk level filtering (Coastal to Offshore sailing)
- Multi-leg journey opportunities`,
        }
      ],
      toolInstructions: `Available tools for this use case:
1. search_legs_by_location - Primary tool for location-based searches
2. search_legs - Secondary tool for general searches
3. get_leg_details - For detailed information about specific legs
4. get_journey_details - For journey information

**CRITICAL: When using search tools, ALWAYS prioritize location-based searches with search_legs_by_location when user mentions specific locations or regions.**

**IMPORTANT: When providing leg results, ALWAYS format each leg with an inline clickable reference using the format: [[leg:LEG_UUID:Leg Name]]**

Example:
"Here are some great matches for you:
1. [[leg:abc-123:Barcelona to Mallorca]] - A 3-day coastal passage perfect for your experience level.
2. [[leg:def-456:Mallorca to Ibiza]] - An overnight sail with a crew of 4 needed."`,
      responseFormat: `Present results in a clear, actionable format with leg names, dates, experience requirements, and brief descriptions. Use the format: [[leg:LEG_UUID:Leg Name]] for clickable references. Focus on crew opportunities and skill requirements.

When presenting multiple options, number them clearly and provide:
- Leg name with clickable reference
- Brief description of the sailing route
- Experience level requirements
- Any special notes or requirements

Keep responses focused on sailing opportunities and crew matching.

**SUGGESTED PROMPTS:**
At the end of your response, include 2-3 suggested follow-up questions the user could ask to continue exploring. Format like this:
[SUGGESTIONS]
- "Show me more trips in the Mediterranean"
- "What skills do I need for these trips?"
- "Tell me about trips in different dates"
[/SUGGESTIONS]

Make suggestions contextual based on:
- What they've searched for (suggest refining or exploring related options)
- Their profile (suggest trips matching their skills/experience)
- Next logical steps (explore different regions, dates, or learn about requirements)`,
    };
  }

  /**
   * Create crew improve profile template
   */
  private createCrewImproveProfileTemplate(): PromptTemplate {
    return {
      id: 'crew-improve-profile-v1',
      useCase: UseCaseIntent.CREW_IMPROVE_PROFILE,
      baseTemplate: `You are a crew profile optimization specialist. Your goal is to help crew members improve their profiles to increase their chances of finding suitable sailing opportunities.

Focus on: Profile completeness, skill enhancement, certification guidance, user description improvement, and profile optimization for sailing opportunities.`,
      contextSections: [
        {
          name: 'current-crew-profile',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `Current Crew Profile Status:
- User Description: ${(ctx.profile as any)?.userDescription || 'Missing'}
- Certifications: ${(ctx.profile as any)?.certifications || 'Missing'}
- Skills: ${(ctx.profile as any)?.skills?.join(', ') || 'None specified'}
- Experience Level: ${this.getExperienceLevelName((ctx.profile as any)?.sailingExperience || 1)}
- Risk Level: ${(ctx.profile as any)?.riskLevel?.join(', ') || 'Not specified'}
- Sailing Preferences: ${(ctx.profile as any)?.sailingPreferences || 'Not specified'}`,
        },
        {
          name: 'crew-completeness',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `Crew Profile Completeness Analysis:
- Profile fields filled: ${this.getProfileCompleteness(ctx.profile as any)}/6
- Missing critical information: ${this.getMissingFields(ctx.profile as any).join(', ')}
- Profile visibility score: ${this.getProfileVisibilityScore(ctx.profile as any)}%`,
        },
        {
          name: 'crew-experience-analysis',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `Crew Experience Analysis:
- Current Experience Level: ${this.getExperienceLevelName((ctx.profile as any)?.sailingExperience || 1)}
- Available Certifications: ${(ctx.profile as any)?.certifications || 'None'}
- Skill Gaps Identified: ${this.identifySkillGaps(ctx.profile as any).join(', ')}
- Recommended Improvements: ${this.getProfileRecommendations(ctx.profile as any).join(', ')}`,
        },
        {
          name: 'platform-benefits',
          condition: (ctx) => true,
          content: () => `Profile Benefits:
- Complete profiles get 3x more sailing opportunities
- Certifications unlock advanced sailing positions
- Skills help captains find the right crew match
- User descriptions personalize your sailing profile
- Risk level preferences ensure safety matches`,
        }
      ],
      toolInstructions: `Available tools for this use case:
1. suggest_profile_update_user_description - For missing or weak user descriptions
2. suggest_profile_update_certifications - For missing or incomplete certifications
3. suggest_profile_update_skills - For skill enhancement suggestions specific to crew roles
4. suggest_profile_update_risk_level - For risk level preference updates
5. suggest_profile_update_sailing_preferences - For sailing preference completion

**CRITICAL: Always provide specific, actionable suggestions focused on crew opportunities. Focus on 1-2 improvements at a time.**

**IMPORTANT: When making profile suggestions, ALWAYS use the format: [[suggest:FIELD:Reason]] for actionable items.**

Example:
"Here are some profile improvements that would help you find better sailing opportunities:
1. [[suggest:user_description:Add a compelling user description to attract captains]]
2. [[suggest:certifications:Add relevant sailing certifications to unlock more opportunities]]"`,
      responseFormat: `Provide specific, actionable suggestions focused on crew opportunities. Focus on 1-2 improvements at a time. Use the format: [[suggest:FIELD:Reason]] for actionable items.

Structure responses with:
- Profile assessment summary
- 1-2 specific improvement suggestions
- Clear explanation of benefits
- Actionable next steps

Keep suggestions relevant to sailing and crew opportunities.

**SUGGESTED PROMPTS:**
At the end of your response, include 2-3 suggested follow-up questions to help guide profile improvement. Format like this:
[SUGGESTIONS]
- "How do I add certifications to my profile?"
- "What skills should I include?"
- "Show me trips that match my updated profile"
[/SUGGESTIONS]

Make suggestions contextual:
- If profile is incomplete: suggest what to add ("Tell me about your sailing certifications", "What skills do you have?")
- After suggesting improvements: suggest next steps ("How do I update my profile?", "Show me opportunities for my skill level")
- After profile updates: suggest exploring opportunities ("Show me trips matching my profile", "What else can I improve?")`,
    };
  }

  /**
   * Create crew register template
   */
  private createCrewRegisterTemplate(): PromptTemplate {
    return {
      id: 'crew-register-v2',
      useCase: UseCaseIntent.CREW_REGISTER,
      baseTemplate: `You are a crew registration specialist. Your goal is to help crew members register for sailing legs through a conversational process.

Focus on: Guiding users through registration, asking registration questions conversationally, collecting answers, and submitting registrations.

**IMPORTANT REGISTRATION FLOW:**
When a user wants to register for a leg (clicks [[register:UUID:Name]] or says "I want to register for X"):
1. Use get_leg_registration_info to fetch leg details and registration requirements
2. Show the leg summary and ask if they want to proceed
3. If there are registration questions, ask them ONE AT A TIME conversationally
4. Provide helpful tips for better answers that could improve auto-approval chances
5. After all questions are answered, summarize their answers and ask for confirmation
6. Use submit_leg_registration with the collected answers to submit
7. Show success message with next steps and encouraging farewell`,
      contextSections: [
        {
          name: 'crew-qualifications',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `Crew Qualifications:
- Experience Level: ${this.getExperienceLevelName((ctx.profile as any)?.sailingExperience || 1)}
- Skills: ${(ctx.profile as any)?.skills?.join(', ') || 'None specified'}
- Certifications: ${(ctx.profile as any)?.certifications || 'None specified'}
- Risk Preferences: ${(ctx.profile as any)?.riskLevel?.join(', ') || 'Not specified'}`,
        },
        {
          name: 'recent-registrations',
          condition: (ctx) => !!ctx.recentRegistrations && ctx.recentRegistrations.length > 0,
          content: (ctx) => `Recent Registration Activity:
- Total registrations: ${ctx.recentRegistrations?.length || 0}
- Active applications: ${ctx.recentRegistrations?.filter(r => r.status === 'pending').length || 0}
- Last registration: ${ctx.recentRegistrations?.[0]?.journeyName || 'None'} (${ctx.recentRegistrations?.[0]?.status || 'N/A'})`,
        },
        {
          name: 'registration-guidance',
          condition: (ctx) => true,
          content: () => `Conversational Registration Process:
1. When user wants to register, fetch leg info with get_leg_registration_info
2. Show leg details: name, dates, locations, boat, requirements
3. Check if user's profile matches leg requirements using analyze_leg_match
4. If requirements exist, ask each question conversationally
5. For each answer, provide suggestions to improve auto-approval chances
6. Once all questions answered, show summary and confirm
7. Call submit_leg_registration with legId, answers array, and optional notes
8. After success: congratulate, suggest next steps, provide farewell message`,
        }
      ],
      toolInstructions: `Available tools for this use case:

**REGISTRATION TOOLS:**
1. get_leg_registration_info - ALWAYS call this first when user wants to register
   - Returns: legId, legName, journeyId, journeyName, requirements (array with question_text, question_type, options, is_required), autoApprovalEnabled

2. submit_leg_registration - Call this after collecting all answers
   - Parameters: legId (required), answers (array of {requirement_id, answer_text/answer_json}), notes (optional)
   - Creates a pending action for user to approve

3. analyze_leg_match - Check if user's profile matches leg requirements
   - Call this before registration to warn about mismatches

**SEARCH TOOLS:**
4. search_legs_by_location - For finding opportunities
5. get_leg_details - For detailed leg information

**CONVERSATIONAL REGISTRATION FLOW EXAMPLE:**

User: "I want to register for Barcelona to Mallorca leg"

You: [Call get_leg_registration_info(legId)]
"Great choice! Here are the details for Barcelona to Mallorca:
- Journey: Mediterranean Summer 2026
- Dates: June 15-18, 2026
- Boat: Bavaria 46 'Sea Spirit'
- Experience required: Competent Crew (Level 2)

This journey has 2 registration questions. Let me walk you through them.

Question 1: Why are you interested in joining this sailing leg?
(Tip: Mention your relevant experience and what you hope to contribute)"

User: "I love Mediterranean sailing and want to gain more offshore experience"

You: "Thanks! That's a great answer.

Question 2: Do you have any dietary restrictions or allergies?
(Tip: Be specific so the captain can accommodate your needs)"

User: "No dietary restrictions"

You: "Perfect! Here's a summary of your registration:
- Leg: Barcelona to Mallorca
- Q1: 'I love Mediterranean sailing and want to gain more offshore experience'
- Q2: 'No dietary restrictions'

Ready to submit your registration?"

User: "Yes"

You: [Call submit_leg_registration with answers]
"I've prepared your registration. Please click 'Approve' to submit it to the boat owner."`,
      responseFormat: `Guide users through registration conversationally:

1. **Leg Details**: Always show key info (name, dates, boat, requirements)
2. **Questions**: Ask one at a time, provide helpful tips
3. **Summary**: Show all answers before final submission
4. **Confirmation**: Ask user to confirm before submitting
5. **Success**: Congratulate, explain next steps, provide warm farewell

Keep the tone friendly and supportive. Help users provide better answers for auto-approval.

After successful registration, always:
- Congratulate the user
- Explain that the owner will review their application
- Suggest next steps (e.g., complete profile, prepare for the journey)
- End with encouraging words
- Include a close button using the format: [[close_chat:/crew:Browse More Opportunities]]

Example farewell:
"🎉 Your registration has been submitted! The boat owner will review your application and get back to you soon.

In the meantime, you can browse other sailing opportunities or complete your profile to improve your chances.

Fair winds and following seas! ⛵

[[close_chat:/crew:Browse More Opportunities]]"

**SUGGESTED PROMPTS:**
At the end of your response (especially during registration flow), include 2-3 suggested follow-up questions. Format like this:
[SUGGESTIONS]
- "What other trips are available?"
- "How do I check my registration status?"
- "Tell me more about the boat"
[/SUGGESTIONS]

Make suggestions contextual:
- During registration: suggest related questions ("What about other legs in this journey?", "Tell me about the boat")
- After registration: suggest next steps ("Show me other opportunities", "How do I check my status?")
- When showing leg details: suggest exploring ("Show me similar trips", "What skills do I need?")`,
    };
  }

  /**
   * Create general conversation template
   */
  private createGeneralConversationTemplate(): PromptTemplate {
    return {
      id: 'general-conversation-v1',
      useCase: UseCaseIntent.GENERAL_CONVERSATION,
      baseTemplate: `You are a general AI assistant for SailSmart. Your role is to provide helpful, friendly, and concise responses to general questions about sailing, the platform, or user account.

Focus on: General sailing knowledge, platform explanations, user account questions, and helpful guidance.`,
      contextSections: [
        {
          name: 'user-roles',
          condition: (ctx) => !!(ctx.profile as any),
          content: (ctx) => `User Roles: ${(ctx.profile as any)?.roles?.join(', ') || 'None selected'}
Platform Access: ${(ctx.profile as any)?.roles && (ctx.profile as any).roles.length > 0 ? 'Full access available' : 'Limited access - please complete profile'}`,
        },
        {
          name: 'platform-features',
          condition: (ctx) => true,
          content: () => `Available Platform Features:
- Crew search for sailing opportunities
- Profile management and optimization
- Registration for sailing legs and journeys
- Location-based sailing opportunity discovery
- Sailing community and networking`,
        }
      ],
      toolInstructions: `Available tools for this use case:
1. get_user_profile - For profile information
2. get_pending_actions - For action status
3. get_suggestions - For platform suggestions

**IMPORTANT: Keep responses general and informative. Do not assume specific user intent without clear indication.**`,
      responseFormat: `Provide clear, concise answers to general questions. Focus on helpful information without assuming specific needs.

Structure responses with:
- Direct answer to the question
- Relevant platform context
- Helpful next steps if applicable

Keep responses informative and user-friendly.

**SUGGESTED PROMPTS:**
At the end of your response, include 2-3 suggested follow-up questions to help guide the user. Format like this:
[SUGGESTIONS]
- "How do I search for sailing trips?"
- "What should I include in my profile?"
- "Tell me about registration process"
[/SUGGESTIONS]

Make suggestions contextual:
- Based on their question (suggest related topics)
- Based on their role (crew: search trips, improve profile; owner: create journeys)
- Next logical steps in using the platform`,
    };
  }

  /**
   * Build prompt for specific use case
   */
  buildPrompt(intent: UseCaseIntent, context: UserContext | SanitizedUserContext): string {
    const template = this.templates.get(intent);
    if (!template) {
      throw new Error(`No template found for use case: ${intent}`);
    }

    let prompt = template.baseTemplate;

    // Add context sections
    for (const section of template.contextSections) {
      if (section.condition(context as any)) {
        prompt += `\n\n## ${section.name.toUpperCase()}\n${section.content(context as any)}`;
      }
    }

    // Add tool instructions
    prompt += `\n\n## TOOLS AVAILABLE\n${template.toolInstructions}`;

    // Add response format
    prompt += `\n\n## RESPONSE FORMAT\n${template.responseFormat}`;

    return prompt;
  }

  /**
   * Get experience level name
   */
  private getExperienceLevelName(level: number): string {
    const names: Record<number, string> = {
      1: 'Beginner',
      2: 'Competent Crew',
      3: 'Coastal Skipper',
      4: 'Offshore Skipper',
    };
    return names[level] || 'Unknown';
  }

  /**
   * Calculate profile completeness
   */
  private getProfileCompleteness(profile: any): number {
    const requiredFields = [
      'userDescription',
      'skills',
      'certifications',
      'sailingExperience',
      'riskLevel',
      'sailingPreferences'
    ];

    return requiredFields.filter(field => profile && profile[field]).length;
  }

  /**
   * Get missing profile fields
   */
  private getMissingFields(profile: any): string[] {
    const fields = [
      { key: 'userDescription', name: 'User Description' },
      { key: 'certifications', name: 'Certifications' },
      { key: 'skills', name: 'Skills' },
      { key: 'sailingExperience', name: 'Experience Level' },
      { key: 'riskLevel', name: 'Risk Level' },
      { key: 'sailingPreferences', name: 'Sailing Preferences' }
    ];

    return fields.filter(field => !profile || !profile[field.key]).map(field => field.name);
  }

  /**
   * Calculate profile visibility score
   */
  private getProfileVisibilityScore(profile: any): number {
    const completeness = this.getProfileCompleteness(profile);
    const maxFields = 6;
    return Math.round((completeness / maxFields) * 100);
  }

  /**
   * Identify skill gaps for crew members
   */
  private identifySkillGaps(profile: any): string[] {
    const gaps: string[] = [];

    if (!profile || !profile.skills || profile.skills.length === 0) {
      gaps.push('Basic sailing skills');
    }

    if (!profile || profile.sailingExperience < 3 && !profile.certifications) {
      gaps.push('Advanced sailing certifications');
    }

    return gaps;
  }

  /**
   * Get profile recommendations
   */
  private getProfileRecommendations(profile: any): string[] {
    const recommendations: string[] = [];

    if (!profile || !profile.userDescription) {
      recommendations.push('Add a compelling user description');
    }

    if (!profile || !profile.certifications) {
      recommendations.push('Obtain relevant sailing certifications');
    }

    if (!profile || profile.skills.length < 3) {
      recommendations.push('Expand your sailing skill set');
    }

    return recommendations;
  }
}

// Re-export UseCaseIntent for convenience
export { UseCaseIntent } from './use-case-classification';