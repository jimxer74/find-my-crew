/**
 * Debug Middleware
 *
 * Middleware to handle debug control headers and enable verbose logging
 * for specific requests or AI flows.
 *
 * Usage in API routes:
 * ```typescript
 * import { applyDebugLevel } from '@/app/lib/debugMiddleware';
 *
 * export async function POST(request: NextRequest) {
 *   applyDebugLevel(request);
 *   // ... rest of handler
 * }
 * ```
 *
 * Headers:
 * - X-Debug-Level: Set debug level (TRACE, DEBUG, INFO, WARN, ERROR)
 * - X-AI-Flow-Debug: Enable verbose AI flow logging (true/false)
 * - X-Verbose-Route: Mark route as verbose
 */

import { NextRequest } from 'next/server';
import { logger, loggerState } from './logger';

/**
 * Apply debug settings from request headers
 *
 * @param request - NextRequest to extract debug headers from
 * @returns Previous debug state (for restoration if needed)
 */
export function applyDebugLevel(request: NextRequest) {
  const previousLevel = loggerState.getDebugLevel();
  const previousAIDebug = loggerState.isAIFlowDebugEnabled();

  // Check for explicit debug level header
  const debugLevelHeader = request.headers.get('X-Debug-Level');
  if (debugLevelHeader) {
    const validLevels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
    if (validLevels.includes(debugLevelHeader)) {
      loggerState.setDebugLevel(debugLevelHeader as any);
      logger.info('Debug level changed via header', {
        from: previousLevel,
        to: debugLevelHeader,
        route: request.nextUrl.pathname,
      });
    }
  }

  // Check for AI flow debug header
  const aiFlowDebugHeader = request.headers.get('X-AI-Flow-Debug');
  if (aiFlowDebugHeader === 'true') {
    loggerState.setAIFlowDebug(true);
    logger.info('AI flow debug enabled via header', {
      route: request.nextUrl.pathname,
    });
  } else if (aiFlowDebugHeader === 'false') {
    loggerState.setAIFlowDebug(false);
  }

  // Check for verbose route marking
  const verboseRouteHeader = request.headers.get('X-Verbose-Route');
  if (verboseRouteHeader === 'true') {
    loggerState.addVerboseRoute(request.nextUrl.pathname);
  }

  return { previousLevel, previousAIDebug };
}

/**
 * Restore previous debug state
 */
export function restoreDebugLevel(previousState: { previousLevel: any; previousAIDebug: boolean }) {
  loggerState.setDebugLevel(previousState.previousLevel);
  loggerState.setAIFlowDebug(previousState.previousAIDebug);
}

/**
 * Create a middleware function for Next.js middleware.ts
 * Can be used in app/middleware.ts for global request handling
 */
export function createDebugMiddleware() {
  return (request: NextRequest) => {
    applyDebugLevel(request);
    return undefined; // No response modification
  };
}

/**
 * Helper to enable debug for specific route patterns
 * Usage: enableDebugForRoute('/api/ai/*')
 */
export function enableDebugForRoute(pattern: string) {
  loggerState.addVerboseRoute(pattern);
  logger.info(`Debug enabled for route pattern: ${pattern}`);
}

/**
 * Helper to get debug info endpoint response
 * Can be used in a debug info API route
 */
export function getDebugInfo() {
  return {
    config: logger.getConfig(),
    timestamp: new Date().toISOString(),
    note: 'Debug levels can be controlled via X-Debug-Level, X-AI-Flow-Debug headers in requests',
  };
}
