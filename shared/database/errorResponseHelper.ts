/**
 * Error Response Helper
 *
 * Provides utilities for sanitizing error responses based on environment
 * - In development: Returns full error details for debugging
 * - In production: Returns generic error messages to prevent information disclosure
 */

type ErrorResponse = {
  error: string;
  details?: string;
  code?: string;
};

/**
 * Sanitize an error response based on environment
 *
 * @param error - The error to sanitize
 * @param publicMessage - The message to return in production
 * @returns Sanitized error response
 */
export function sanitizeErrorResponse(
  error: unknown,
  publicMessage: string = 'An error occurred. Please try again later.'
): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Extract error message
  let errorMessage = publicMessage;
  let errorDetails = undefined;
  let errorCode = undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = (error as any).code;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (typeof error === 'object' && error !== null) {
    errorMessage = (error as any).message || String(error);
    errorCode = (error as any).code;
  }

  // In development, include full details
  if (isDevelopment) {
    return {
      error: errorMessage,
      details: String(error),
      code: errorCode,
    };
  }

  // In production, return generic message only
  return {
    error: publicMessage,
  };
}

/**
 * Create a sanitized error response for API routes
 *
 * @param error - The error to handle
 * @param statusCode - HTTP status code (default 500)
 * @param publicMessage - Message to show in production
 * @returns Object ready for JSON response
 */
export function createErrorResponse(
  error: unknown,
  statusCode: number = 500,
  publicMessage: string = 'An error occurred. Please try again later.'
) {
  return {
    statusCode,
    response: sanitizeErrorResponse(error, publicMessage),
  };
}
