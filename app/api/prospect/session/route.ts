import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE_NAME = 'prospect_session_id';
const SESSION_EXPIRY_DAYS = 7;

/**
 * GET /api/prospect/session
 * Returns the current session ID from cookie, or creates a new one
 */
export async function GET() {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = uuidv4();
  }

  // Set/refresh the cookie with updated expiry
  const response = NextResponse.json({
    sessionId,
    isNewSession,
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  });

  return response;
}

/**
 * DELETE /api/prospect/session
 * Clears the session cookie (for "Start Fresh" functionality)
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  return response;
}
