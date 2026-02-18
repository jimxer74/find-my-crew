/**
 * Production-Safe Logging System
 *
 * Provides structured logging with dynamic debug level control.
 * Important for AI flows where verbose logging helps with issue analysis.
 *
 * Debug levels can be controlled via:
 * 1. LOG_LEVEL environment variable (TRACE, DEBUG, INFO, WARN, ERROR)
 * 2. X-Debug-Level header in requests
 * 3. loggerState.setDebugLevel() for runtime changes
 */

type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type LogContext = Record<string, any>;

const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
};

class LoggerState {
  private debugLevel: LogLevel = 'INFO';
  private aiFlowDebug: boolean = false;
  private verboseRoutes: Set<string> = new Set();

  constructor() {
    // Read from environment
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
    if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
      this.debugLevel = envLevel;
    }

    // AI flows get debug by default in development
    if (process.env.NODE_ENV === 'development') {
      this.aiFlowDebug = true;
    }
  }

  setDebugLevel(level: LogLevel) {
    this.debugLevel = level;
  }

  getDebugLevel(): LogLevel {
    return this.debugLevel;
  }

  setAIFlowDebug(enabled: boolean) {
    this.aiFlowDebug = enabled;
  }

  isAIFlowDebugEnabled(): boolean {
    return this.aiFlowDebug;
  }

  addVerboseRoute(route: string) {
    this.verboseRoutes.add(route);
  }

  removeVerboseRoute(route: string) {
    this.verboseRoutes.delete(route);
  }

  isRouteVerbose(route: string): boolean {
    return this.verboseRoutes.has(route);
  }
}

export const loggerState = new LoggerState();

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[loggerState.getDebugLevel()];
}

/**
 * Check if verbose logging is enabled for AI flows
 */
function isAIFlowVerbose(): boolean {
  return loggerState.isAIFlowDebugEnabled();
}

/**
 * Format log message with timestamp and level
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

export const logger = {
  /**
   * Trace level - most verbose, use for detailed flow tracking
   * Particularly useful for AI flows
   */
  trace(message: string, context?: LogContext) {
    if (shouldLog('TRACE')) {
      console.debug(formatLog('TRACE', message, context));
    }
  },

  /**
   * Debug level - detailed information for debugging
   * Enabled by LOG_LEVEL=DEBUG or in AI flow debug mode
   */
  debug(message: string, context?: LogContext, aiFlow: boolean = false) {
    if (shouldLog('DEBUG') || (aiFlow && isAIFlowVerbose())) {
      console.debug(formatLog('DEBUG', message, context));
    }
  },

  /**
   * Info level - general informational messages
   * Always logged unless LOG_LEVEL=WARN or higher
   */
  info(message: string, context?: LogContext) {
    if (shouldLog('INFO')) {
      console.log(formatLog('INFO', message, context));
    }
  },

  /**
   * Warn level - warning messages
   * Always logged
   */
  warn(message: string, context?: LogContext) {
    if (shouldLog('WARN')) {
      console.warn(formatLog('WARN', message, context));
    }
  },

  /**
   * Error level - error messages
   * Always logged
   */
  error(message: string, context?: LogContext) {
    if (shouldLog('ERROR')) {
      console.error(formatLog('ERROR', message, context));
    }
  },

  /**
   * AI Flow specific logging - automatically verbose when enabled
   * Use this for AI conversation, prompt processing, etc.
   */
  aiFlow(stage: string, message: string, context?: LogContext) {
    const level = isAIFlowVerbose() ? 'DEBUG' : 'INFO';
    const fullMessage = `[AI] ${stage}: ${message}`;

    if (level === 'DEBUG') {
      this.debug(fullMessage, context, true);
    } else {
      this.info(fullMessage, context);
    }
  },

  /**
   * Get current debug configuration (useful for debugging the logger itself)
   */
  getConfig() {
    return {
      debugLevel: loggerState.getDebugLevel(),
      aiFlowDebug: loggerState.isAIFlowDebugEnabled(),
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production',
    };
  },
};
