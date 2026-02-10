import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserContext } from '@/app/lib/ai/assistant/context';
import { callAI } from '@/app/lib/ai/service';
import { parseJsonArrayFromAIResponse } from '@/app/lib/ai/shared';

const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[API generate-suggestions] ${message}`, data !== undefined ? data : '');
  }
};

export const maxDuration = 30; // Shorter timeout for lightweight call

/**
 * Build prompt for generating profile-based suggestions
 */
function buildSuggestionPrompt(userContext: any): string {
  const { profile, recentRegistrations, boats } = userContext;
  
  let prompt = `You are analyzing a user's SailSmart profile to suggest helpful prompts they could ask the assistant.

User Profile:
`;

  if (profile) {
    prompt += `- Roles: ${profile.roles?.join(', ') || 'None'}\n`;
    if (profile.sailingExperience) {
      const expNames = ['Beginner', 'Competent Crew', 'Coastal Skipper', 'Offshore Skipper'];
      prompt += `- Experience Level: ${expNames[profile.sailingExperience - 1] || 'Unknown'}\n`;
    }
    if (profile.skills?.length > 0) {
      prompt += `- Skills: ${profile.skills.join(', ')}\n`;
    }
    if (profile.certifications) {
      prompt += `- Certifications: ${profile.certifications}\n`;
    }
    if (profile.riskLevel?.length > 0) {
      prompt += `- Risk Level: ${profile.riskLevel.join(', ')}\n`;
    }
    
    // Profile completeness
    const completenessFields = [
      profile.userDescription ? 'user_description' : null,
      profile.sailingExperience ? 'sailing_experience' : null,
      profile.skills?.length > 0 ? 'skills' : null,
      profile.certifications ? 'certifications' : null,
      profile.riskLevel?.length > 0 ? 'risk_level' : null,
      profile.sailingPreferences ? 'sailing_preferences' : null,
    ].filter(Boolean);
    prompt += `- Profile Completeness: ${completenessFields.length}/6 fields filled\n`;
  } else {
    prompt += `- Profile: Not created yet\n`;
  }

  if (recentRegistrations?.length > 0) {
    prompt += `\nRecent Activity:\n`;
    recentRegistrations.slice(0, 3).forEach((reg: any) => {
      prompt += `- Registered for "${reg.legName}" on "${reg.journeyName}" (Status: ${reg.status})\n`;
    });
  }

  if (boats?.length > 0) {
    prompt += `\nBoats Owned:\n`;
    boats.slice(0, 3).forEach((boat: any) => {
      prompt += `- ${boat.name}${boat.make_model ? ` (${boat.make_model})` : ''}\n`;
    });
  }

  prompt += `\nGenerate 3-5 contextual, actionable prompts the user could ask to:
1. Continue their current journey (based on recent activity)
2. Improve their profile (if incomplete)
3. Discover new opportunities (based on their interests and role)
4. Manage their account (based on their role)

Return ONLY a JSON array of prompt strings, no other text, no markdown code blocks, no explanations. Each prompt should be:
- Actionable and specific
- Relevant to their profile and role
- Natural and conversational
- Maximum 60 characters per prompt

Return ONLY the JSON array, nothing else. Example: ["Show me trips in the Mediterranean", "How do I improve my profile?", "Check my registration status"]`;

  return prompt;
}

export async function POST(request: NextRequest) {
  log('=== POST /api/ai/assistant/generate-suggestions ===');

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', userMessage: 'Please sign in to continue.' },
        { status: 401 }
      );
    }

    // Check AI consent
    const { data: consents } = await supabase
      .from('user_consents')
      .select('ai_processing_consent')
      .eq('user_id', user.id)
      .single();

    if (!consents?.ai_processing_consent) {
      return NextResponse.json(
        { error: 'AI consent not granted', userMessage: 'Please enable AI features in your settings.' },
        { status: 403 }
      );
    }

    // Get user context
    log('Fetching user context...');
    const userContext = await getUserContext(supabase, user.id);
    log('User context fetched', {
      hasProfile: !!userContext.profile,
      roles: userContext.profile?.roles,
      registrationCount: userContext.recentRegistrations?.length,
      boatCount: userContext.boats?.length,
    });

    // Build suggestion prompt
    const suggestionPrompt = buildSuggestionPrompt(userContext);
    log('Calling AI to generate suggestions...');

    // Call AI with lightweight settings
    const aiResponse = await callAI({
      useCase: 'assistant-chat',
      prompt: suggestionPrompt,
      temperature: 0.7,
      maxTokens: 200, // Small response for just suggestions
    });

    log('AI response received', { length: aiResponse.text.length });

    // Parse JSON array from response using shared utility
    let suggestions: string[] = [];
    try {
      suggestions = parseJsonArrayFromAIResponse(aiResponse.text);

      // Validate and clean suggestions
      suggestions = suggestions
        .filter((s: any) => typeof s === 'string' && s.length > 0 && s.length < 100)
        .slice(0, 5); // Max 5 suggestions

      // Fallback suggestions if parsing fails or empty
      if (suggestions.length === 0) {
        log('No valid suggestions parsed, using fallbacks');
        if (userContext.profile?.roles?.includes('crew')) {
          suggestions = [
            'Show me sailing trips matching my skills',
            'How can I improve my profile?',
            'Check my registration status',
          ];
        } else if (userContext.profile?.roles?.includes('owner')) {
          suggestions = [
            'Create a new sailing journey',
            'Manage my boats',
            'View my journey registrations',
          ];
        } else {
          suggestions = [
            'Show me sailing opportunities',
            'How do I get started?',
            'Tell me about the platform',
          ];
        }
      }
    } catch (parseError) {
      log('Failed to parse suggestions, using fallbacks', parseError);
      // Use fallback suggestions based on role
      if (userContext.profile?.roles?.includes('crew')) {
        suggestions = [
          'Show me sailing trips matching my skills',
          'How can I improve my profile?',
          'Check my registration status',
        ];
      } else if (userContext.profile?.roles?.includes('owner')) {
        suggestions = [
          'Create a new sailing journey',
          'Manage my boats',
          'View my journey registrations',
        ];
      } else {
        suggestions = [
          'Show me sailing opportunities',
          'How do I get started?',
          'Tell me about the platform',
        ];
      }
    }

    log('Suggestions generated', { count: suggestions.length, suggestions });
    return NextResponse.json({
      suggestions,
      generatedAt: Date.now(),
    });
  } catch (error: any) {
    log('Error', error?.message);
    console.error('[generate-suggestions]', error);
    
    // Return fallback suggestions on error
    return NextResponse.json({
      suggestions: [
        'Show me sailing opportunities',
        'How can I improve my profile?',
        'Tell me about the platform',
      ],
      generatedAt: Date.now(),
      error: error?.message,
    });
  }
}
