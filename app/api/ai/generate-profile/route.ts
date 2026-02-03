import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { callAI } from '@/app/lib/ai/service';
import { FacebookUserData, ProfileSuggestion } from '@/app/lib/facebook/types';

const PROFILE_GENERATION_PROMPT = `You are an AI assistant helping to create a sailing crew member profile based on Facebook data. Analyze the provided data and suggest profile fields.

IMPORTANT GUIDELINES:
1. Be CONSERVATIVE with sailing experience inferences - only suggest experience if there's clear evidence
2. Look for sailing-related keywords: sailing, yacht, boat, maritime, crew, offshore, coastal, navigation, etc.
3. Consider the user's interests, activities, and posts when inferring skills
4. Generate a username from their name (lowercase, no spaces, add numbers if needed for uniqueness)
5. If there's no sailing-related content, set sailing fields to null but still provide general profile info

PROFILE FIELDS TO SUGGEST:
- username: A unique username (lowercase, no spaces, 3-20 chars)
- usernameAlternatives: 2-3 alternative username options
- fullName: User's full name
- sailingExperience: 1-4 scale (1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper) or null if unknown
- userDescription: Free text description of who the user is, their background, and interests
- certifications: Any sailing certifications mentioned, or null
- sailingPreferences: What type of sailing they might prefer, or null
- skills: Array of relevant skills. Use these exact skill categories and add a text description per each of the skill (safety_and_mob, heavy_weather, night_sailing, watch_keeping, navigation, sailing_experience, certifications, physical_fitness)
- riskLevel: Array from ["Coastal sailing", "Offshore sailing", "Extreme sailing"] based on apparent comfort level

CONFIDENCE LEVELS:
For each major suggestion, indicate confidence:
- "high": Clear, explicit evidence in the data
- "medium": Reasonable inference from available data
- "low": Weak inference, user should verify
- "none": Pure guess, no supporting evidence

FACEBOOK DATA TO ANALYZE:
{facebookData}

Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact format:
{
  "username": "string",
  "usernameAlternatives": ["string", "string"],
  "fullName": "string",
  "profileImageUrl": "string or null",
  "sailingExperience": "number 1-4 or null",
  "userDescription": "string or null",
  "certifications": "string or null",
  "sailingPreferences": "string or null",

  "skills": [{"skill": 
    "safety_and_mob"|
    "heavy_weather"|
    "night_sailing"|
    "watch_keeping"|
    "navigation"|
    "sailing_experience"|
    "certifications"|
    "physical_fitness"|
    "technical_skills"|
    "first_aid"|"seasickness_management", "description": "string"}],

  "riskLevel": ["string"],

  "confidence": {
    "sailingExperience": "high|medium|low|none",
    "overall": "high|medium|low|none"
  },
  "reasoning": "Brief explanation of how you derived these suggestions"
}`;

function buildPrompt(facebookData: FacebookUserData): string {
  // Prepare a summarized version of Facebook data for the prompt
  const summary = {
    profile: facebookData.profile ? {
      name: facebookData.profile.name,
      firstName: facebookData.profile.first_name,
      lastName: facebookData.profile.last_name,
      //email: facebookData.profile.email,
    } : null,
    profilePictureUrl: facebookData.profilePictureUrl,
    recentPosts: facebookData.posts.slice(0, 20).map(post => ({
      message: post.message?.slice(0, 500),
      story: post.story,
      date: post.created_time,
    })),
    likes: facebookData.likes.slice(0, 50).map(like => ({
      name: like.name,
      category: like.category,
    })),
    dataQuality: {
      hasProfile: !!facebookData.profile,
      postCount: facebookData.posts.length,
      likeCount: facebookData.likes.length,
    },
  };

  return PROFILE_GENERATION_PROMPT.replace(
    '{facebookData}',
    JSON.stringify(summary, null, 2)
  );
}

function parseAIResponse(text: string): ProfileSuggestion {
  // Try to extract JSON from the response (handle potential markdown wrapping)
  let jsonText = text.trim();

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  const parsed = JSON.parse(jsonText);

  // Validate and normalize the response
  return {
    username: String(parsed.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
    usernameAlternatives: Array.isArray(parsed.usernameAlternatives)
      ? parsed.usernameAlternatives.map((u: string) => String(u).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))
      : [],
    fullName: String(parsed.fullName || ''),
    profileImageUrl: parsed.profileImageUrl || null,
    sailingExperience: parsed.sailingExperience ? Number(parsed.sailingExperience) : null,
    userDescription: parsed.userDescription || null,
    certifications: parsed.certifications || null,
    sailingPreferences: parsed.sailingPreferences || null,

    skills: Array.isArray(parsed.skills) ? parsed.skills.map((skill: { skill: string; description: string }) => ({
      skill: skill.skill,
      description: skill.description,
    })) : [],

    riskLevel: Array.isArray(parsed.riskLevel) ? parsed.riskLevel.map(String) : [],

    confidence: {
      sailingExperience: parsed.confidence?.sailingExperience || 'none',
      overall: parsed.confidence?.overall || 'none',
    },
    
    reasoning: String(parsed.reasoning || 'No reasoning provided'),
  };
}

function createFallbackSuggestion(facebookData: FacebookUserData): ProfileSuggestion {
  const profile = facebookData.profile;
  const name = profile?.name || profile?.first_name || '';
  const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);

  return {
    username: baseUsername || 'user',
    usernameAlternatives: [
      `${baseUsername}1`,
      `${baseUsername}_sailor`,
    ].filter(Boolean),
    fullName: name,
    profileImageUrl: facebookData.profilePictureUrl,
    sailingExperience: null,
    userDescription: null,
    certifications: null,
    sailingPreferences: null,
    skills: [],
    riskLevel: ['Coastal sailing'],
    confidence: {
      sailingExperience: 'none',
      overall: 'none',
    },
    reasoning: 'AI analysis unavailable. Please fill in your sailing experience manually.',
  };
}

export async function POST(request: NextRequest) {
  try {
    // Validate the user is authenticated
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in this context
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check user's AI processing consent
    const { data: consents } = await supabase
      .from('user_consents')
      .select('ai_processing_consent')
      .eq('user_id', user.id)
      .single();

    if (!consents?.ai_processing_consent) {
      return NextResponse.json(
        { error: 'AI processing consent not granted' },
        { status: 403 }
      );
    }

    // Get Facebook data from request body
    const body = await request.json();
    const facebookData: FacebookUserData = body.facebookData;

    if (!facebookData || !facebookData.profile) {
      return NextResponse.json(
        { error: 'Facebook data is required' },
        { status: 400 }
      );
    }

    // Build the prompt and call AI
    const prompt = buildPrompt(facebookData);

    try {
      const aiResult = await callAI({
        useCase: 'generate-profile',
        prompt,
      });

      const suggestion = parseAIResponse(aiResult.text);

      // Add the profile image URL from Facebook if not already set
      if (!suggestion.profileImageUrl && facebookData.profilePictureUrl) {
        suggestion.profileImageUrl = facebookData.profilePictureUrl;
      }

      return NextResponse.json({
        success: true,
        suggestion,
        aiProvider: aiResult.provider,
        aiModel: aiResult.model,
      });
    } catch (aiError) {
      console.error('AI profile generation failed:', aiError);

      // Return a fallback suggestion based on basic Facebook data
      const fallbackSuggestion = createFallbackSuggestion(facebookData);

      return NextResponse.json({
        success: true,
        suggestion: fallbackSuggestion,
        aiProvider: null,
        aiModel: null,
        fallback: true,
        fallbackReason: 'AI service unavailable',
      });
    }
  } catch (error) {
    console.error('Error generating profile:', error);
    return NextResponse.json(
      { error: 'Failed to generate profile suggestions' },
      { status: 500 }
    );
  }
}
