/**
 * URL Import API Endpoint
 *
 * POST /api/url-import/fetch-content
 *
 * Orchestrates URL detection and content fetching for importing user profiles.
 * Handles authentication, validation, rate limiting, and error handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@shared/logging';
import { getSupabaseServerClient } from '@shared/database/server';
import { detectResourceType, isValidUrl } from '@/app/lib/url-import/detectResourceType';
import { fetchResourceContent } from '@/app/lib/url-import/fetchResourceContent';

// Simple in-memory rate limiting (in production, use Redis)
const importAttempts = new Map<string, number[]>();

/**
 * Check if user has exceeded rate limit (10 imports per hour)
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const attempts = importAttempts.get(userId) || [];
  const recentAttempts = attempts.filter((timestamp) => timestamp > oneHourAgo);

  if (recentAttempts.length >= 10) {
    return false; // Rate limited
  }

  recentAttempts.push(now);
  importAttempts.set(userId, recentAttempts);
  return true; // OK
}

interface RequestBody {
  url?: string;
}

interface SuccessResponse {
  success: true;
  resourceType: string;
  content: string;
  title?: string;
  author?: string;
  source: string;
  metadata: Record<string, any>;
  preview: string;
}

interface ErrorResponse {
  error: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // Get authenticated user
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated. Please sign in first.' }, { status: 401 });
    }

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      logger.warn('[url-import] Rate limit exceeded:', { userId: user.id });
      return NextResponse.json(
        { error: 'Too many import attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { url } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!isValidUrl(url)) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Detect resource type
    let detection;
    try {
      detection = detectResourceType(url);
    } catch (error) {
      logger.warn('[url-import] Detection failed:', { url, error });
      return NextResponse.json({ error: 'Could not determine content type from URL' }, { status: 400 });
    }

    // Check if user has OAuth token for this provider
    let accessToken: string | undefined;
    if (detection.authProvider) {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (session?.user?.identities) {
        const providerIdentity = session.user.identities.find((i) => i.provider === detection.authProvider);
        if (providerIdentity?.identity_data?.access_token) {
          accessToken = providerIdentity.identity_data.access_token;
        }
      }
    }

    // Fetch content
    let result;
    try {
      result = await fetchResourceContent({
        url,
        resourceType: detection.resourceType,
        authProvider: detection.authProvider || undefined,
        accessToken,
        userId: user.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content';
      logger.error('[url-import] Content fetch failed:', {
        userId: user.id,
        url,
        resourceType: detection.resourceType,
        error: errorMessage,
      });

      // Return user-friendly error
      if (errorMessage.includes('Could not fetch content')) {
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }

      return NextResponse.json(
        { error: 'Failed to fetch content from URL. Please check the URL and try again.' },
        { status: 500 }
      );
    }

    // Log successful import
    logger.info('[url-import] Content imported successfully:', {
      userId: user.id,
      url,
      resourceType: detection.resourceType,
      source: result.source,
      contentLength: result.content.length,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      resourceType: detection.resourceType,
      content: result.content,
      title: result.title,
      author: result.author,
      source: result.source,
      metadata: result.metadata,
      preview: result.content.substring(0, 300) + (result.content.length > 300 ? '...' : ''),
    });
  } catch (error) {
    logger.error('[url-import] Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
