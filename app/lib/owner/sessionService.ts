/**
 * Owner Session Service
 *
 * Client-side service for managing owner chat sessions via API.
 * Similar to prospect session service but owners are always authenticated.
 */

import { OwnerSession } from '@/app/lib/ai/owner/types';
import { logger } from '@shared/logging';

/**
 * Load session from server using session_id from cookie
 */
export async function loadSession(sessionId: string): Promise<OwnerSession | null> {
  try {
    const response = await fetch('/api/owner/session/data', {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Session doesn't exist - return null (not an error)
        return null;
      }
      throw new Error(`Failed to load session: ${response.statusText}`);
    }

    const data = await response.json();
    return data.session || null;
  } catch (error: any) {
    logger.error('Error loading session', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Save session to server
 * - Uses session_id from cookie
 * - Automatically linked to authenticated user_id
 * - Stores user's email when available
 */
export async function saveSession(sessionId: string, session: OwnerSession): Promise<void> {
  try {
    logger.debug('Saving session', {
      hasSessionId: !!sessionId,
      messagesCount: session.conversation?.length || 0,
      preferencesCount: Object.keys(session.gatheredPreferences || {}).length,
    }, true);

    // Get user's email from Supabase auth if available
    // Note: This is handled in the API route instead to avoid importing server-only code in client components
    const userEmail = null;

    // Email will be extracted from auth context in the API route
    // No need to add it to gatheredPreferences here
    const sessionWithUserEmail = session;

    let response: Response;
    try {
      response = await fetch('/api/owner/session/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ session: sessionWithUserEmail }),
      });

      // Log response immediately after fetch
      logger.debug('Fetch completed', {
        ok: response?.ok,
        status: response?.status,
        statusText: response?.statusText,
        url: response?.url,
      }, true);
    } catch (fetchError: any) {
      // Network error or fetch failed before getting response
      logger.error('Fetch failed (network error)', {
        message: fetchError?.message || 'Unknown error',
        sessionId,
        url: '/api/owner/session/data',
      });
      throw new Error(`Network error: ${fetchError?.message || 'Failed to connect to server'}`);
    }

    // Validate response object before proceeding
    if (!response) {
      logger.error('Response is null or undefined');
      throw new Error('Invalid response: response object is null or undefined');
    }

    if (!response.ok) {
      // Capture response properties
      const status = response?.status ?? 'NO_STATUS';
      const statusText = response?.statusText ?? 'NO_STATUS_TEXT';
      const responseUrl = response?.url ?? 'NO_URL';

      let errorMessage = `Failed to save session: ${status} ${statusText || 'Unknown error'}`;
      let errorDetails: any = {
        status: String(status),
        statusText: String(statusText),
        url: String(responseUrl),
      };

      // Read response body once - can only be read once
      let responseBody: string | null = null;
      try {
        if (response && typeof response.text === 'function') {
          responseBody = await response.text();
        }
      } catch (err: any) {
        // Ignore read errors
      }

      if (responseBody !== null) {
        // Try to parse as JSON
        try {
          const errorData = JSON.parse(responseBody);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
          errorDetails.error = errorData.error;
          errorDetails.message = errorData.message;
          errorDetails.details = errorData.details;
        } catch (parseError: any) {
          // Not JSON - use text as error message if needed
          if (errorMessage.includes('Unknown error')) {
            errorMessage = responseBody.substring(0, 200) || errorMessage;
          }
        }
      }

      // Log error details
      logger.error('Failed to save session', {
        status: errorDetails.status,
        statusText: errorDetails.statusText,
        url: errorDetails.url,
        error: errorDetails.error,
        message: errorDetails.message,
        details: errorDetails.details,
      });

      throw new Error(errorMessage);
    }

    logger.debug('Session saved successfully', {}, true);
  } catch (error: any) {
    logger.error('Error saving session', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Delete session from server
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    logger.debug('Deleting session', { hasSessionId: !!sessionId }, true);
    
    const response = await fetch('/api/owner/session/data', {
      method: 'DELETE',
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      let errorMessage = `Failed to delete session: ${response.status} ${response.statusText}`;
      let errorDetails: any = { status: response.status, statusText: response.statusText };

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        errorDetails = { ...errorDetails, ...errorData };
      } catch (parseError) {
        // Response is not JSON, try to get text
        try {
          const text = await response.text();
          errorDetails.text = text;
        } catch (textError) {
          // Ignore
        }
      }

      logger.error('Delete failed', { status: errorDetails.status, statusText: errorDetails.statusText });
      throw new Error(errorMessage);
    }

    logger.debug('Session deleted successfully', {}, true);
  } catch (error: any) {
    logger.error('Error deleting session', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Link session to authenticated user (called after signup)
 * - Links by session_id (current session)
 * - Also links by email (all sessions with matching email)
 * @param postSignupOnboarding - When true, marks session for after-consent API to redirect and trigger profile completion
 */
export async function linkSessionToUser(
  sessionId: string,
  userId: string,
  email?: string,
  options?: { postSignupOnboarding?: boolean }
): Promise<void> {
  try {
    const response = await fetch('/api/owner/session/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, postSignupOnboarding: options?.postSignupOnboarding }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to link session: ${response.statusText}`);
    }
  } catch (error: any) {
    logger.error('Error linking session', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Update onboarding state for an owner session
 */
export async function updateOnboardingState(
  sessionId: string,
  newState: string
): Promise<void> {
  try {
    const response = await fetch('/api/owner/session/data', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ onboarding_state: newState }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update onboarding state: ${response.statusText}`);
    }
  } catch (error: any) {
    logger.error('Error updating onboarding state', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Extract email from conversation message (if user shares it)
 * Simple regex-based extraction - can be enhanced with AI if needed
 */
export function extractEmailFromMessage(message: string): string | null {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = message.match(emailRegex);
  return match ? match[0].toLowerCase().trim() : null;
}
