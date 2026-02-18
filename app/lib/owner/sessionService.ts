/**
 * Owner Session Service
 * 
 * Client-side service for managing owner chat sessions via API.
 * Similar to prospect session service but owners are always authenticated.
 */

import { OwnerSession } from '@/app/lib/ai/owner/types';

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
    console.error('[OwnerSessionService] Error loading session:', error);
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
    console.log('[OwnerSessionService] 💾 Saving session:', {
      sessionId,
      messagesCount: session.conversation?.length || 0,
      preferencesKeys: Object.keys(session.gatheredPreferences || {}),
    });

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
      console.log('[OwnerSessionService] 📡 Fetch completed:', {
        ok: response?.ok,
        status: response?.status,
        statusText: response?.statusText,
        type: response?.type,
        url: response?.url,
        responseType: typeof response,
        responseIsNull: response === null,
        responseIsUndefined: response === undefined,
      });
    } catch (fetchError: any) {
      // Network error or fetch failed before getting response
      console.error('[OwnerSessionService] ❌ Fetch failed (network error):', {
        message: fetchError?.message,
        name: fetchError?.name,
        stack: fetchError?.stack,
        sessionId,
        url: '/api/owner/session/data',
        error: fetchError,
      });
      throw new Error(`Network error: ${fetchError?.message || 'Failed to connect to server'}`);
    }

    // Validate response object before proceeding
    if (!response) {
      console.error('[OwnerSessionService] ❌ Response is null or undefined!');
      throw new Error('Invalid response: response object is null or undefined');
    }

    if (!response.ok) {
      // Log raw response immediately for debugging
      console.error('[OwnerSessionService] ❌ Response not OK - raw response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        type: response.type,
        redirected: response.redirected,
        headers: response.headers ? Object.fromEntries(response.headers.entries()) : 'no headers',
      });

      // Capture response properties immediately - check if response is valid
      const status = response?.status ?? 'NO_STATUS';
      const statusText = response?.statusText ?? 'NO_STATUS_TEXT';
      const responseUrl = response?.url ?? 'NO_URL';
      const responseType = response?.type ?? 'NO_TYPE';
      const responseRedirected = response?.redirected ?? false;
      const responseOk = response?.ok ?? false;

      let errorMessage = `Failed to save session: ${status} ${statusText || 'Unknown error'}`;
      let errorDetails: any = {
        status: String(status),
        statusText: String(statusText),
        url: String(responseUrl),
        type: String(responseType),
        redirected: Boolean(responseRedirected),
        ok: Boolean(responseOk),
        responseValid: response !== null && response !== undefined,
      };

      // Log errorDetails immediately after creation to verify it's populated
      console.error('[OwnerSessionService] 🔍 errorDetails after creation:', {
        errorDetails,
        errorDetailsKeys: Object.keys(errorDetails),
        errorDetailsString: JSON.stringify(errorDetails),
        status,
        statusText,
        responseUrl,
      });

      // Read response body once - can only be read once
      let responseBody: string | null = null;
      let readError: any = null;
      try {
        if (response && typeof response.text === 'function') {
          responseBody = await response.text();
        } else {
          errorDetails.responseTextUnavailable = 'Response.text is not a function or response is invalid';
        }
      } catch (err: any) {
        readError = err;
        errorDetails.readError = {
          message: err?.message || 'Failed to read response body',
          name: err?.name,
          stack: err?.stack,
          error: String(err),
        };
      }

      if (responseBody !== null) {
        errorDetails.responseBody = responseBody;
        errorDetails.responseBodyLength = responseBody.length;

        // Try to parse as JSON
        try {
          const errorData = JSON.parse(responseBody);
          errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
          errorDetails.parsedError = errorData;
          errorDetails.error = errorData.error;
          errorDetails.message = errorData.message;
          errorDetails.details = errorData.details;
          errorDetails.code = errorData.code;
          errorDetails.hint = errorData.hint;
          console.error('[OwnerSessionService] 🔍 errorDetails after parsing JSON:', {
            errorDetails,
            errorDetailsKeys: Object.keys(errorDetails),
            errorData,
          });
        } catch (parseError: any) {
          // Not JSON - use text as error message if no other message
          errorDetails.parseError = {
            message: parseError?.message || 'Response is not JSON',
            name: parseError?.name,
          };
          if (errorMessage.includes('Unknown error')) {
            errorMessage = responseBody.substring(0, 200) || errorMessage;
          }
          console.error('[OwnerSessionService] 🔍 errorDetails after parse error:', {
            errorDetails,
            errorDetailsKeys: Object.keys(errorDetails),
            parseError: parseError?.message,
          });
        }
      } else if (readError) {
        errorDetails.readErrorOccurred = true;
        console.error('[OwnerSessionService] 🔍 errorDetails after readError:', {
          errorDetails,
          errorDetailsKeys: Object.keys(errorDetails),
          readError,
        });
      } else {
        console.error('[OwnerSessionService] 🔍 responseBody is null and no readError:', {
          errorDetails,
          errorDetailsKeys: Object.keys(errorDetails),
          responseBody,
          readError,
        });
      }

      // Log with all available details - ensure we always have something to log
      const logData: any = {
        sessionId,
        messagesCount: session.conversation?.length || 0,
        preferencesKeys: Object.keys(session.gatheredPreferences || {}),
        errorMessage,
        rawResponse: {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          type: response.type,
          redirected: response.redirected,
        },
      };

      // Add errorDetails properties individually to ensure they're captured
      if (errorDetails.status !== undefined) logData.status = errorDetails.status;
      if (errorDetails.statusText !== undefined) logData.statusText = errorDetails.statusText;
      if (errorDetails.url !== undefined) logData.url = errorDetails.url;
      if (errorDetails.responseBody !== undefined) logData.responseBody = errorDetails.responseBody;
      if (errorDetails.responseBodyLength !== undefined) logData.responseBodyLength = errorDetails.responseBodyLength;
      if (errorDetails.parsedError !== undefined) logData.parsedError = errorDetails.parsedError;
      if (errorDetails.error !== undefined) logData.error = errorDetails.error;
      if (errorDetails.message !== undefined) logData.message = errorDetails.message;
      if (errorDetails.details !== undefined) logData.details = errorDetails.details;
      if (errorDetails.code !== undefined) logData.code = errorDetails.code;
      if (errorDetails.hint !== undefined) logData.hint = errorDetails.hint;
      if (errorDetails.readError !== undefined) logData.readError = errorDetails.readError;
      if (errorDetails.parseError !== undefined) logData.parseError = errorDetails.parseError;

      // Log the complete error information - logData has all the actual data
      console.error('[OwnerSessionService] ❌ Save failed - Complete error details:', logData);

      // Extract the most useful error message from the parsed error data
      const finalErrorMessage = logData.error || logData.details || logData.message || errorMessage;
      const errorCode = logData.code;
      const errorHint = logData.hint;

      // Build a comprehensive error message
      let comprehensiveError = finalErrorMessage;
      if (errorCode) {
        comprehensiveError += ` (Code: ${errorCode})`;
      }
      if (errorHint) {
        comprehensiveError += ` - ${errorHint}`;
      }

      console.error('[OwnerSessionService] ❌ Throwing error:', comprehensiveError);
      throw new Error(comprehensiveError);
    }

    console.log('[OwnerSessionService] ✅ Session saved successfully');
  } catch (error: any) {
    // Enhanced error logging - capture all possible error properties
    const errorInfo: any = {
      message: error?.message || 'No error message',
      name: error?.name || 'Error',
      stack: error?.stack || 'No stack trace',
      sessionId,
    };

    // Capture additional error properties if they exist
    if (error?.cause) errorInfo.cause = error.cause;
    if (error?.code) errorInfo.code = error.code;
    if (error?.status) errorInfo.status = error.status;
    if (error?.statusText) errorInfo.statusText = error.statusText;
    if (error?.response) errorInfo.hasResponse = true;
    if (error?.request) errorInfo.hasRequest = true;

    // Try to stringify the error to see all properties
    try {
      errorInfo.errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch (stringifyError) {
      errorInfo.stringifyError = 'Could not stringify error';
    }

    console.error('[OwnerSessionService] Error saving session:', errorInfo);
    throw error;
  }
}

/**
 * Delete session from server
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    console.log('[OwnerSessionService] 🗑️ Deleting session:', sessionId);
    
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

      console.error('[OwnerSessionService] ❌ Delete failed:', errorDetails);
      throw new Error(errorMessage);
    }

    console.log('[OwnerSessionService] ✅ Session deleted successfully');
  } catch (error: any) {
    console.error('[OwnerSessionService] Error deleting session:', {
      message: error.message,
      stack: error.stack,
      sessionId,
    });
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
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email, postSignupOnboarding: options?.postSignupOnboarding }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to link session: ${response.statusText}`);
    }
  } catch (error: any) {
    console.error('[OwnerSessionService] Error linking session:', error);
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
    console.error('[OwnerSessionService] Error updating onboarding state:', error);
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
