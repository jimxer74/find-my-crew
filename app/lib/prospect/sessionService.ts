/**
 * Prospect Session Service
 * 
 * Client-side service for managing prospect chat sessions via API.
 * Replaces localStorage-based session storage with server-side database storage.
 */

import { ProspectSession } from '@/app/lib/ai/prospect/types';

/**
 * Load session from server using session_id from cookie
 */
export async function loadSession(sessionId: string): Promise<ProspectSession | null> {
  try {
    const response = await fetch('/api/prospect/session/data', {
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
    console.error('[SessionService] Error loading session:', error);
    throw error;
  }
}

/**
 * Save session to server
 * - Uses session_id from cookie
 * - Automatically links to user_id if authenticated
 * - Stores email if user shares it in conversation
 */
export async function saveSession(sessionId: string, session: ProspectSession): Promise<void> {
  try {
    console.log('[SessionService] 💾 Saving session:', {
      sessionId,
      messagesCount: session.conversation?.length || 0,
      preferencesKeys: Object.keys(session.gatheredPreferences || {}),
      viewedLegsCount: session.viewedLegs?.length || 0,
    });

    const response = await fetch('/api/prospect/session/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ session }),
    });

    if (!response.ok) {
      let errorMessage = `Failed to save session: ${response.status} ${response.statusText}`;
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

      console.error('[SessionService] ❌ Save failed:', errorDetails);
      throw new Error(errorMessage);
    }

    console.log('[SessionService] ✅ Session saved successfully');
  } catch (error: any) {
    console.error('[SessionService] Error saving session:', {
      message: error.message,
      stack: error.stack,
      sessionId,
    });
    throw error;
  }
}

/**
 * Delete session from server
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    console.log('[SessionService] 🗑️ Deleting session:', sessionId);
    
    const response = await fetch('/api/prospect/session/data', {
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

      console.error('[SessionService] ❌ Delete failed:', errorDetails);
      throw new Error(errorMessage);
    }

    console.log('[SessionService] ✅ Session deleted successfully');
  } catch (error: any) {
    console.error('[SessionService] Error deleting session:', {
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
 */
export async function linkSessionToUser(
  sessionId: string,
  userId: string,
  email?: string
): Promise<void> {
  try {
    const response = await fetch('/api/prospect/session/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to link session: ${response.statusText}`);
    }
  } catch (error: any) {
    console.error('[SessionService] Error linking session:', error);
    throw error;
  }
}

/**
 * Recover session by email (for returning users who lost their cookie)
 * - Finds most recent session with matching email
 * - Returns session_id and session data
 * - Only works if user shared email before
 */
export async function recoverSessionByEmail(
  email: string
): Promise<{ sessionId: string; session: ProspectSession } | null> {
  try {
    const response = await fetch('/api/prospect/session/recover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to recover session: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.session) {
      return null;
    }

    return {
      sessionId: data.session.sessionId,
      session: data.session,
    };
  } catch (error: any) {
    console.error('[SessionService] Error recovering session:', error);
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
