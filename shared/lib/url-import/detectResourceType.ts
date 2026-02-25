/**
 * URL Resource Type Detection
 *
 * Detects the platform/resource type of a given URL and extracts relevant metadata.
 * Supports: Facebook, Twitter, and generic web resources.
 */

export type ResourceType = 'facebook' | 'twitter' | 'generic';
export type AuthProvider = 'facebook' | 'twitter' | null;

export interface DetectionResult {
  resourceType: ResourceType;
  authProvider: AuthProvider;
  resourceId?: string; // Post ID, username, etc.
  domain: string;
  metadata: Record<string, any>;
}

/**
 * Validates if a string is a valid URL
 * Rejects suspicious patterns like javascript: or data:
 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);

    // Reject dangerous protocols
    if (url.protocol === 'javascript:' || url.protocol === 'data:') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Detects the resource type of a URL and extracts relevant metadata
 *
 * @param url - The URL to analyze
 * @returns DetectionResult with platform type, auth provider, and metadata
 * @throws Error if URL is invalid
 */
export function detectResourceType(url: string): DetectionResult {
  try {
    if (!isValidUrl(url)) {
      throw new Error('Invalid URL provided');
    }

    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    // Facebook detection
    if (domain.includes('facebook.com')) {
      return detectFacebook(urlObj, domain);
    }

    // Twitter detection
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return detectTwitter(urlObj, domain);
    }

    // Generic web resource
    return {
      resourceType: 'generic',
      authProvider: null,
      domain,
      metadata: {
        path: urlObj.pathname,
        hasQuery: urlObj.search.length > 0,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid URL provided') {
      throw error;
    }
    throw new Error('Invalid URL provided');
  }
}

/**
 * Detects Facebook URLs and extracts post/profile information
 */
function detectFacebook(urlObj: URL, domain: string): DetectionResult {
  const pathname = urlObj.pathname;

  // Match post URLs: /username/posts/ID or /ID/
  const postMatch = pathname.match(/\/posts\/(\d+)|^\/(\d+)\/?$/);
  const userMatch = pathname.match(/^\/([^/?]+)(?:\/posts)?/);

  if (postMatch) {
    const postId = postMatch[1] || postMatch[2];
    return {
      resourceType: 'facebook',
      authProvider: 'facebook',
      resourceId: postId,
      domain,
      metadata: {
        type: 'post',
        postId,
        userId: userMatch?.[1],
      },
    };
  }

  // Profile URL
  if (userMatch && userMatch[1] && !userMatch[1].startsWith('?')) {
    return {
      resourceType: 'facebook',
      authProvider: 'facebook',
      resourceId: userMatch[1],
      domain,
      metadata: {
        type: 'profile',
        username: userMatch[1],
      },
    };
  }

  // Generic Facebook URL
  return {
    resourceType: 'facebook',
    authProvider: 'facebook',
    domain,
    metadata: {
      type: 'unknown',
      path: pathname,
    },
  };
}

/**
 * Detects Twitter/X URLs and extracts tweet/profile information
 */
function detectTwitter(urlObj: URL, domain: string): DetectionResult {
  const pathname = urlObj.pathname;
  const normalizedDomain = domain.includes('x.com') ? 'x.com' : 'twitter.com';

  // Match tweet URLs: /username/status/ID
  const tweetMatch = pathname.match(/\/status\/(\d+)/);
  if (tweetMatch) {
    const tweetId = tweetMatch[1];
    const usernameMatch = pathname.match(/^\/([^/?]+)/);
    return {
      resourceType: 'twitter',
      authProvider: 'twitter',
      resourceId: tweetId,
      domain: normalizedDomain,
      metadata: {
        type: 'tweet',
        tweetId,
        username: usernameMatch?.[1],
      },
    };
  }

  // Profile URL: /username
  const profileMatch = pathname.match(/^\/([^/?]+)\/?$/);
  if (profileMatch && !['home', 'search', 'explore', 'notifications', 'messages'].includes(profileMatch[1])) {
    return {
      resourceType: 'twitter',
      authProvider: 'twitter',
      resourceId: profileMatch[1],
      domain: normalizedDomain,
      metadata: {
        type: 'profile',
        username: profileMatch[1],
      },
    };
  }

  // Generic Twitter URL
  return {
    resourceType: 'twitter',
    authProvider: 'twitter',
    domain: normalizedDomain,
    metadata: {
      type: 'unknown',
      path: pathname,
    },
  };
}
