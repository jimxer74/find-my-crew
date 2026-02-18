/**
 * Error Handling Utilities
 *
 * Provides functions to sanitize error messages for safe client responses.
 * Full errors are logged server-side; generic messages returned to clients.
 */

export interface SanitizedError {
  message: string;
  code?: string;
}

// Generic error messages for different categories
const GENERIC_MESSAGES: Record<string, string> = {
  auth: 'Authentication error. Please sign in again.',
  database: 'A database error occurred. Please try again.',
  validation: 'Invalid input. Please check your data and try again.',
  notFound: 'The requested resource was not found.',
  rateLimit: 'Too many requests. Please wait a moment and try again.',
  ai: 'AI service is temporarily unavailable. Please try again.',
  network: 'A network error occurred. Please check your connection.',
  storage: 'File storage error. Please try again.',
  permission: 'You do not have permission to perform this action.',
  default: 'An unexpected error occurred. Please try again.',
};

// Patterns to detect sensitive information in error messages
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /credential/i,
  /api[_-]?key/i,
  /auth/i,
  /bearer/i,
  /connection\s*string/i,
  /database\s*url/i,
  /supabase/i,
  /postgres/i,
  /\.env/i,
  /process\.env/i,
];

// Error code patterns for categorization
const ERROR_CATEGORIES: Record<string, RegExp[]> = {
  auth: [/auth/i, /unauthorized/i, /unauthenticated/i, /jwt/i, /session/i],
  database: [/database/i, /postgres/i, /supabase/i, /sql/i, /query/i, /rls/i, /row level/i],
  validation: [/validation/i, /invalid/i, /required/i, /format/i, /type.*error/i],
  notFound: [/not found/i, /404/i, /does not exist/i],
  rateLimit: [/rate limit/i, /too many/i, /throttl/i],
  ai: [/gemini/i, /openai/i, /anthropic/i, /groq/i, /ai service/i],
  network: [/network/i, /timeout/i, /connection/i, /fetch/i, /econnrefused/i],
  storage: [/storage/i, /upload/i, /file/i, /bucket/i],
  permission: [/permission/i, /forbidden/i, /403/i, /access denied/i],
};

/**
 * Check if an error message contains sensitive information
 */
export function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Categorize an error based on its message
 */
export function categorizeError(error: Error | string): keyof typeof GENERIC_MESSAGES {
  const message = typeof error === 'string' ? error : error.message;

  for (const [category, patterns] of Object.entries(ERROR_CATEGORIES)) {
    if (patterns.some((pattern) => pattern.test(message))) {
      return category as keyof typeof GENERIC_MESSAGES;
    }
  }

  return 'default';
}

/**
 * Sanitize an error for safe client response
 * Logs the full error server-side and returns a generic message
 */
export function sanitizeError(
  error: Error | string | unknown,
  context?: string
): SanitizedError {
  // Convert to error object if needed
  const errorObj =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown error');

  // Log full error server-side
  logger.error(`[Error${context ? ` in ${context}` : ''}]:`, {
    message: errorObj.message,
    stack: errorObj.stack,
    name: errorObj.name,
  });

  // Categorize the error
  const category = categorizeError(errorObj);

  // Check for sensitive info
  const hasSensitiveInfo = containsSensitiveInfo(errorObj.message);

  // Return sanitized response
  return {
    message:
      hasSensitiveInfo || category !== 'default'
        ? GENERIC_MESSAGES[category]
        : errorObj.message.slice(0, 200), // Limit message length
    code: category.toUpperCase(),
  };
}

/**
 * Create a safe error response for API routes
 */
export function createErrorResponse(
  error: Error | string | unknown,
  context?: string
): { error: string; code?: string; status: number } {
  const sanitized = sanitizeError(error, context);

  // Determine appropriate HTTP status
  const statusMap: Record<string, number> = {
    auth: 401,
    permission: 403,
    notFound: 404,
    rateLimit: 429,
    validation: 400,
    default: 500,
  };

  const category = categorizeError(
    typeof error === 'string' ? error : (error as Error)?.message || ''
  );

  return {
    error: sanitized.message,
    code: sanitized.code,
    status: statusMap[category] || 500,
  };
}

/**
 * Safe error wrapper for try-catch blocks in API routes
 * Usage: catch (error) { return handleApiError(error, 'fetchUser'); }
 */
export function handleApiError(
  error: unknown,
  context?: string
): Response {
  const { error: message, code, status } = createErrorResponse(error, context);

  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
