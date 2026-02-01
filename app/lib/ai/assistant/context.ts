/**
 * AI Assistant Context Builder
 *
 * Builds the system prompt and user context for AI conversations.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { UserContext } from './types';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[Context Builder] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Fetch user context from the database
 */
export async function getUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserContext> {
  log('--- getUserContext started ---', { userId });

  // Fetch profile
  log('Fetching user profile...');
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, roles, sailing_experience, user_description, certifications, skills, risk_level, sailing_preferences')
    .eq('id', userId)
    .single();

  log('Profile fetched:', {
    hasProfile: !!profile,
    username: profile?.username,
    roles: profile?.roles
  });

  // Fetch boats if user is owner
  let boats: UserContext['boats'] = [];
  if (profile?.roles?.includes('owner')) {
    log('User is owner, fetching boats...');
    const { data: boatsData } = await supabase
      .from('boats')
      .select('id, name, type, make, model')
      .eq('owner_id', userId)
      .limit(10);
    boats = boatsData || [];
    log('Boats fetched:', { count: boats.length });
  }

  // Fetch recent registrations if user is crew
  let recentRegistrations: UserContext['recentRegistrations'] = [];
  if (profile?.roles?.includes('crew')) {
    log('User is crew, fetching recent registrations...');
    const { data: registrationsData } = await supabase
      .from('registrations')
      .select(`
        id,
        status,
        created_at,
        legs!inner (
          id,
          name,
          journeys!inner (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    recentRegistrations = (registrationsData || []).map((r: any) => ({
      id: r.id,
      legId: r.legs.id,
      legName: r.legs.name,
      journeyName: r.legs.journeys.name,
      status: r.status,
      createdAt: r.created_at,
    }));
    log('Recent registrations fetched:', { count: recentRegistrations.length });
  }

  // Count pending actions
  log('Counting pending actions and suggestions...');
  const { count: pendingActionsCount } = await supabase
    .from('ai_pending_actions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');

  // Count active suggestions
  const { count: suggestionsCount } = await supabase
    .from('ai_suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('dismissed', false);

  log('Context counts:', { pendingActionsCount, suggestionsCount });
  log('--- getUserContext completed ---');

  return {
    userId,
    profile: profile ? {
      username: profile.username,
      fullName: profile.full_name,
      roles: profile.roles || [],
      sailingExperience: profile.sailing_experience,
      userDescription: profile.user_description,
      certifications: profile.certifications,
      skills: profile.skills || [],
      riskLevel: profile.risk_level || [],
      sailingPreferences: profile.sailing_preferences,
    } : null,
    boats,
    recentRegistrations,
    pendingActionsCount: pendingActionsCount || 0,
    suggestionsCount: suggestionsCount || 0,
  };
}

/**
 * Build the system prompt for the AI assistant
 */
export function buildSystemPrompt(context: UserContext): string {
  log('Building system prompt...', {
    hasProfile: !!context.profile,
    roles: context.profile?.roles,
    boatCount: context.boats?.length,
    registrationCount: context.recentRegistrations?.length
  });

  const { profile, boats, recentRegistrations, pendingActionsCount, suggestionsCount } = context;

  let prompt = `You are a helpful AI assistant for "SailSmart", a platform that connects sailing boat owners with crew members looking for sailing opportunities.

Your role is to help users:
- Find sailing journeys and legs that match their skills and preferences
- Understand their options and make informed decisions
- Complete tasks like registering for legs or managing their profile
- Get answers about sailing, the platform, or their account

IMPORTANT RULES:
1. Always be helpful, friendly, and concise
2. When suggesting actions, use the appropriate "suggest_*" tools - these create pending actions the user must approve
3. Never execute actions directly - always suggest and let the user confirm
4. Be honest about what you don't know
5. For data queries, use the available tools to get accurate information
6. Respect the user's role - don't suggest owner actions to crew members or vice versa
7. Politely and respectfully decline to answer questions that are not related to the platform, sailing or related to sailing and cruising, weather, or sailboat information.

`;

  // Add user context
  if (profile) {
    prompt += `\n## Current User Context\n\n`;
    prompt += `**Username:** ${profile.username}\n`;
    if (profile.fullName) prompt += `**Name:** ${profile.fullName}\n`;
    prompt += `**Roles:** ${profile.roles.length > 0 ? profile.roles.join(', ') : 'No roles selected'}\n`;

    if (profile.roles.includes('crew')) {
      prompt += `\n### Crew Profile\n`;
      if(profile.userDescription) {
        prompt += `- User Description: ${profile.userDescription}\n`;
      }
      if (profile.sailingExperience) {
        const expNames = ['Beginner', 'Competent Crew', 'Coastal Skipper', 'Offshore Skipper'];
        prompt += `- Experience Level: ${expNames[profile.sailingExperience - 1] || 'Unknown'}\n`;
      }
      if (profile.skills.length > 0) {
        prompt += `- Skills: ${profile.skills.join(', ')}\n`;
      }
      if (profile.riskLevel.length > 0) {
        prompt += `- Comfortable with: ${profile.riskLevel.join(', ')}\n`;
      }
      if (profile.certifications) {
        prompt += `- Certifications: ${profile.certifications}\n`;
      }
    }

    if (profile.roles.includes('owner') && boats && boats.length > 0) {
      prompt += `\n### Owner's Boats\n`;
      boats.forEach(boat => {
        prompt += `- ${boat.name}`;
        if (boat.make || boat.model) {
          prompt += ` (${[boat.make, boat.model].filter(Boolean).join(' ')})`;
        }
        prompt += `\n`;
      });
    }

    if (recentRegistrations && recentRegistrations.length > 0) {
      prompt += `\n### Recent Registrations\n`;
      recentRegistrations.forEach(reg => {
        prompt += `- ${reg.legName} on "${reg.journeyName}" - Status: ${reg.status}\n`;
      });
    }

    if (pendingActionsCount > 0) {
      prompt += `\n**Note:** User has ${pendingActionsCount} pending action(s) awaiting approval.\n`;
    }

    if (suggestionsCount > 0) {
      prompt += `**Note:** User has ${suggestionsCount} unread suggestion(s).\n`;
    }
  } else {
    prompt += `\n## Current User Context\n\n`;
    prompt += `The user hasn't created a profile yet. Encourage them to complete their profile to unlock all features.\n`;
  }

  prompt += `\n## Available Actions\n\n`;
  prompt += `You have access to various tools to help the user. Use them appropriately based on the user's request.`;

  return prompt;
}

/**
 * Get the sailing experience level name from number
 */
export function getExperienceLevelName(level: number): string {
  const names: Record<number, string> = {
    1: 'Beginner',
    2: 'Competent Crew',
    3: 'Coastal Skipper',
    4: 'Offshore Skipper',
  };
  return names[level] || 'Unknown';
}
