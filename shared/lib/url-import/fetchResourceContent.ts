/**
 * URL Content Fetching Service
 *
 * Multi-tier content fetching with graceful degradation:
 * 1. Try official API (Facebook, Twitter) if authenticated
 * 2. Fall back to ScraperAPI for generic URLs
 * 3. Return user-friendly errors if all fail
 */

import { logger } from '@shared/logging';
import type { ResourceType, AuthProvider } from './detectResourceType';

/**
 * Fetch URL content using ScraperAPI with optional JavaScript rendering
 */
async function fetchWithScraperAPI(url: string, options?: Record<string, any>, renderJavaScript = true): Promise<Response> {
  const apiKey = process.env.SCRAPERAPI_API_KEY;
  if (!apiKey) {
    throw new Error('SCRAPERAPI_API_KEY not configured');
  }

  // Build ScraperAPI request URL
  const scraperParams = new URLSearchParams({
    api_key: apiKey,
    url: url,
    render: renderJavaScript ? 'true' : 'false',
  });

  const scraperUrl = `http://api.scraperapi.com?${scraperParams.toString()}`;

  try {
    // Use AbortController for timeout (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(scraperUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    throw new Error(`ScraperAPI request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface FetchOptions {
  url: string;
  resourceType: ResourceType;
  authProvider?: AuthProvider;
  accessToken?: string;
  userId?: string;
}

export interface FetchResult {
  content: string;
  title?: string;
  author?: string;
  url: string;
  fetchedAt: string;
  source: 'api' | 'scraper';
  metadata: Record<string, any>;
}

/**
 * Fetches content from a URL using appropriate method based on resource type
 */
export async function fetchResourceContent(options: FetchOptions): Promise<FetchResult> {
  const { url, resourceType, authProvider, accessToken } = options;

  try {
    switch (resourceType) {
      case 'facebook':
        return await fetchFacebookContent(url, authProvider, accessToken);

      case 'twitter':
        return await fetchTwitterContent(url, authProvider, accessToken);

      case 'generic':
      default:
        return await fetchGenericContent(url);
    }
  } catch (error) {
    logger.error('[fetchResourceContent] Error fetching content:', {
      url,
      resourceType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetch Facebook content via Graph API.
 * ScraperAPI is NOT used as a fallback — Facebook blocks all scrapers with 403.
 * When no access token is available the caller should prompt the user to
 * authenticate with Facebook first.
 */
async function fetchFacebookContent(
  url: string,
  authProvider: AuthProvider | undefined,
  accessToken: string | undefined
): Promise<FetchResult> {
  if (!accessToken) {
    throw new Error(
      'Facebook content requires authentication. Please sign in with Facebook to import this URL.'
    );
  }

  return await fetchFacebookWithAPI(url, accessToken);
}

/**
 * Extract the numeric Facebook object ID from a variety of URL patterns:
 *   /posts/{id}
 *   /permalink/{id}
 *   /groups/{name}/permalink/{id}
 *   /{username}/posts/{id}
 *   facebook.com/{numeric-id}
 *
 * Returns undefined for plain profile URLs (/{username}) so the caller can
 * fall back to fetching the user's own profile instead.
 */
function extractFacebookObjectId(url: string): string | undefined {
  const u = new URL(url);
  const path = u.pathname;

  // Group permalink: /groups/{name}/permalink/{id}/
  const groupPermalink = path.match(/\/groups\/[^/]+\/permalink\/(\d+)/);
  if (groupPermalink) return groupPermalink[1];

  // /posts/{id} anywhere in the path
  const postsMatch = path.match(/\/posts\/(\d+)/);
  if (postsMatch) return postsMatch[1];

  // /permalink/{id}
  const permalinkMatch = path.match(/\/permalink\/(\d+)/);
  if (permalinkMatch) return permalinkMatch[1];

  // Bare numeric path: facebook.com/{numeric-id}
  const numericPath = path.match(/^\/(\d+)\/?$/);
  if (numericPath) return numericPath[1];

  return undefined;
}

/**
 * Fetch Facebook content via Graph API.
 * Handles posts (by numeric object ID) and profile-level URLs (via /me).
 */
async function fetchFacebookWithAPI(url: string, accessToken: string): Promise<FetchResult> {
  const GRAPH = 'https://graph.facebook.com/v19.0';

  const objectId = extractFacebookObjectId(url);

  // ── Fetch a specific post / group post ────────────────────────────────────
  if (objectId) {
    const fields = 'message,story,created_time,permalink_url,from';
    const apiUrl = `${GRAPH}/${objectId}?fields=${fields}&access_token=${accessToken}`;

    const response = await fetch(apiUrl);
    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok || (data as { error?: unknown }).error) {
      const errMsg =
        (data as { error?: { message?: string } }).error?.message ||
        `Facebook API responded with ${response.status}`;
      throw new Error(`Facebook API error: ${errMsg}`);
    }

    const message = (data.message as string) || (data.story as string) || '';
    if (!message) {
      throw new Error('No readable content found in this Facebook post.');
    }

    const authorName = (data.from as { name?: string } | undefined)?.name;
    const parts: string[] = [];
    if (authorName) parts.push(`Author: ${authorName}`);
    parts.push(message);

    return {
      content: parts.join('\n').substring(0, 5000),
      author: authorName,
      url: (data.permalink_url as string) || url,
      fetchedAt: new Date().toISOString(),
      source: 'api',
      metadata: {
        platform: 'facebook',
        objectId,
        createdTime: data.created_time,
      },
    };
  }

  // ── Profile URL: fetch the authenticated user's own data ─────────────────
  // (handles facebook.com/{username} style URLs — assumes it's the user's own profile)
  const profileFields = 'id,name,about,location,work,education,website';
  const profileUrl = `${GRAPH}/me?fields=${profileFields}&access_token=${accessToken}`;

  const profileRes = await fetch(profileUrl);
  const profile = (await profileRes.json()) as Record<string, unknown>;

  if (!profileRes.ok || (profile as { error?: unknown }).error) {
    const errMsg =
      (profile as { error?: { message?: string } }).error?.message ||
      `Facebook API responded with ${profileRes.status}`;
    throw new Error(`Facebook API error: ${errMsg}`);
  }

  // Compose a readable summary from the profile fields
  const lines: string[] = [];
  if (profile.name) lines.push(`Name: ${profile.name}`);
  if (profile.about) lines.push(`About: ${profile.about}`);
  if ((profile.location as { name?: string } | undefined)?.name) {
    lines.push(`Location: ${(profile.location as { name: string }).name}`);
  }
  const workEntries = profile.work as Array<{ employer?: { name?: string }; position?: { name?: string } }> | undefined;
  if (workEntries?.length) {
    const workLines = workEntries
      .slice(0, 3)
      .map((w) => [w.employer?.name, w.position?.name].filter(Boolean).join(' — '))
      .filter(Boolean);
    if (workLines.length) lines.push(`Work: ${workLines.join('; ')}`);
  }
  if (profile.website) lines.push(`Website: ${profile.website}`);

  if (!lines.length) {
    throw new Error('No readable profile information found from Facebook.');
  }

  return {
    content: lines.join('\n').substring(0, 5000),
    author: profile.name as string | undefined,
    url,
    fetchedAt: new Date().toISOString(),
    source: 'api',
    metadata: { platform: 'facebook', userId: profile.id },
  };
}

/**
 * Fetch Twitter content via API or scraper
 */
async function fetchTwitterContent(
  url: string,
  authProvider: AuthProvider | undefined,
  accessToken: string | undefined
): Promise<FetchResult> {
  // Try API first if authenticated
  if (authProvider === 'twitter' && accessToken) {
    try {
      return await fetchTwitterWithAPI(url, accessToken);
    } catch (error) {
      logger.warn('[fetchTwitterContent] API failed, falling back to scraper:', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to scraper
  return await fetchWithScreenScraper(url, 'twitter');
}

/**
 * Fetch Twitter content via Twitter API v2
 */
async function fetchTwitterWithAPI(url: string, accessToken: string): Promise<FetchResult> {
  // Extract tweet ID from URL
  const tweetIdMatch = url.match(/\/status\/(\d+)/);
  if (!tweetIdMatch) {
    throw new Error('Could not extract tweet ID from Twitter URL');
  }

  const tweetId = tweetIdMatch[1];

  try {
    const response = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=created_at,author_id&expansions=author_id&user.fields=username`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const content = data.data?.text;

    if (!content) {
      throw new Error('No content found in tweet');
    }

    const author = data.includes?.users?.[0]?.username;

    return {
      content: content.substring(0, 5000),
      author,
      url,
      fetchedAt: new Date().toISOString(),
      source: 'api',
      metadata: {
        platform: 'twitter',
        tweetId,
        authorUsername: author,
        createdAt: data.data?.created_at,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch from Twitter API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch generic web content via ScraperAPI
 */
async function fetchGenericContent(url: string): Promise<FetchResult> {
  return await fetchWithScreenScraper(url, 'generic');
}

/**
 * Fetch content using ScraperAPI with JavaScript rendering
 */
async function fetchWithScreenScraper(url: string, platform: string): Promise<FetchResult> {
  try {
    // Use existing ScraperAPI integration with JavaScript rendering
    const response = await fetchWithScraperAPI(url, {}, true);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || undefined;

    // Extract text content (strip HTML, scripts, styles)
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const content = cleanHtml.substring(0, 5000);

    if (!content) {
      throw new Error('No content extracted from URL');
    }

    return {
      content,
      title,
      url,
      fetchedAt: new Date().toISOString(),
      source: 'scraper',
      metadata: {
        platform,
        tool: 'scraperapi',
        charCount: content.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[fetchWithScreenScraper] Scraper failed:', {
      url,
      platform,
      error: errorMessage,
    });
    throw new Error(`Could not fetch content from URL. Please paste the content manually.`);
  }
}
