/**
 * URL Content Fetching Service
 *
 * Multi-tier content fetching with graceful degradation:
 * 1. Try official API (Facebook, Twitter) if authenticated
 * 2. Fall back to ScraperAPI for generic URLs
 * 3. Return user-friendly errors if all fail
 */

import { logger } from '@/app/lib/logger';
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
 * Fetch Facebook content via API or scraper
 */
async function fetchFacebookContent(
  url: string,
  authProvider: AuthProvider | undefined,
  accessToken: string | undefined
): Promise<FetchResult> {
  // Try API first if authenticated
  if (authProvider === 'facebook' && accessToken) {
    try {
      return await fetchFacebookWithAPI(url, accessToken);
    } catch (error) {
      logger.warn('[fetchFacebookContent] API failed, falling back to scraper:', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to scraper
  return await fetchWithScreenScraper(url, 'facebook');
}

/**
 * Fetch Facebook content via Graph API
 */
async function fetchFacebookWithAPI(url: string, accessToken: string): Promise<FetchResult> {
  // Extract post ID from URL
  const postIdMatch = url.match(/\/posts\/(\d+)|facebook\.com\/(\d+)/);
  if (!postIdMatch) {
    throw new Error('Could not extract post ID from Facebook URL');
  }

  const postId = postIdMatch[1] || postIdMatch[2];

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?fields=message,story,created_time,permalink_url&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error(`Facebook API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const content = data.message || data.story || '';

    if (!content) {
      throw new Error('No content found in Facebook post');
    }

    return {
      content: content.substring(0, 5000),
      url: data.permalink_url || url,
      fetchedAt: new Date().toISOString(),
      source: 'api',
      metadata: {
        platform: 'facebook',
        createdTime: data.created_time,
        postId,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch from Facebook API: ${error instanceof Error ? error.message : String(error)}`);
  }
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
