/**
 * Facebook Graph API Service
 *
 * Fetches user data from Facebook Graph API using the OAuth access token
 */

import { logger } from '@shared/logging';
import {
  FacebookProfile,
  FacebookPost,
  FacebookLike,
  FacebookPaginatedResponse,
  FacebookUserData,
} from './types';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

interface GraphAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

function isGraphAPIError(response: unknown): response is GraphAPIError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as GraphAPIError).error === 'object'
  );
}

/**
 * Fetch user's basic profile information
 */
export async function fetchProfile(accessToken: string): Promise<FacebookProfile | null> {
  try {
    const fields = 'id,name,first_name,last_name,email,picture.type(large)';
    const response = await fetch(
      `${GRAPH_API_BASE}/me?fields=${fields}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (isGraphAPIError(data)) {
      logger.error('Facebook Graph API error (profile):', { error: data.error.message });
      return null;
    }

    return data as FacebookProfile;
  } catch (error) {
    logger.error('Error fetching Facebook profile:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return null;
  }
}

/**
 * Fetch user's recent posts
 * Note: Requires user_posts permission which needs Facebook App Review
 */
export async function fetchPosts(
  accessToken: string,
  limit: number = 50
): Promise<FacebookPost[]> {
  try {
    const fields = 'id,message,story,created_time,full_picture,type,permalink_url';
    const response = await fetch(
      `${GRAPH_API_BASE}/me/posts?fields=${fields}&limit=${limit}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (isGraphAPIError(data)) {
      // Permission errors are expected if user denied or app not reviewed
      logger.warn('Facebook Graph API error (posts):', { error: data.error.message });
      return [];
    }

    const paginatedData = data as FacebookPaginatedResponse<FacebookPost>;
    return paginatedData.data || [];
  } catch (error) {
    logger.error('Error fetching Facebook posts:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return [];
  }
}

/**
 * Fetch user's page likes
 * Note: Requires user_likes permission which needs Facebook App Review
 */
export async function fetchLikes(
  accessToken: string,
  limit: number = 100
): Promise<FacebookLike[]> {
  try {
    const fields = 'id,name,category,created_time';
    const response = await fetch(
      `${GRAPH_API_BASE}/me/likes?fields=${fields}&limit=${limit}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (isGraphAPIError(data)) {
      // Permission errors are expected if user denied or app not reviewed
      logger.warn('Facebook Graph API error (likes):', { error: data.error.message });
      return [];
    }

    const paginatedData = data as FacebookPaginatedResponse<FacebookLike>;
    return paginatedData.data || [];
  } catch (error) {
    logger.error('Error fetching Facebook likes:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return [];
  }
}

/**
 * Fetch user's profile picture URL in large format
 */
export async function fetchProfilePicture(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me/picture?type=large&redirect=false&access_token=${accessToken}`
    );

    const data = await response.json();

    if (isGraphAPIError(data)) {
      logger.warn('Facebook Graph API error (picture):', { error: data.error.message });
      return null;
    }

    if (data.data?.url && !data.data?.is_silhouette) {
      return data.data.url;
    }

    return null;
  } catch (error) {
    logger.error('Error fetching Facebook profile picture:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return null;
  }
}

/**
 * Fetch all available Facebook user data
 * Handles permission errors gracefully - returns whatever data is accessible
 */
export async function fetchAllUserData(accessToken: string): Promise<FacebookUserData> {
  const errors: string[] = [];

  // Fetch all data in parallel
  const [profile, posts, likes, profilePictureUrl] = await Promise.all([
    fetchProfile(accessToken),
    fetchPosts(accessToken),
    fetchLikes(accessToken),
    fetchProfilePicture(accessToken),
  ]);

  // Track what we couldn't fetch
  if (!profile) {
    errors.push('Could not fetch basic profile information');
  }
  if (posts.length === 0) {
    errors.push('Could not fetch posts (permission may not be granted)');
  }
  if (likes.length === 0) {
    errors.push('Could not fetch likes (permission may not be granted)');
  }

  return {
    profile,
    posts,
    likes,
    profilePictureUrl: profilePictureUrl || profile?.picture?.data?.url || null,
    errors,
  };
}

/**
 * Check if access token is valid
 */
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/me?access_token=${accessToken}`
    );
    const data = await response.json();
    return !isGraphAPIError(data);
  } catch {
    return false;
  }
}
