/**
 * Rate Limiting utility for AI API calls
 *
 * Prevents "Too many requests" errors by implementing request throttling
 * and retry logic with exponential backoff.
 */

import { logger } from '../logger';

interface RateLimitConfig {
  maxRequests: number;        // Maximum requests allowed
  windowMs: number;           // Time window in milliseconds
  maxRetries: number;         // Maximum retry attempts
  baseRetryDelay: number;     // Base delay between retries in milliseconds
}

// Default rate limit configuration
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 120,           // 60 requests per minute (1 per second)
  windowMs: 60000,           // 1 minute window
  maxRetries: 5,             // Try up to 3 times
  baseRetryDelay: 1000,      // Start with 1 second delay
};

// Rate limiter state
const rateLimitState = {
  requests: new Map<string, number[]>(),
  inProgress: new Map<string, Promise<any>>(),
};

/**
 * Simple rate limiter that tracks requests per time window
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private key: string;

  constructor(key: string, config: Partial<RateLimitConfig> = {}) {
    this.key = key;
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Execute a function with rate limiting and retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we already have a pending request for this key
    if (rateLimitState.inProgress.has(this.key)) {
      return rateLimitState.inProgress.get(this.key);
    }

    const executeWithRetry = async (): Promise<T> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          // Check rate limit
          await this.checkRateLimit();

          // Execute the function
          const result = await fn();

          // Success - clear any pending state
          rateLimitState.inProgress.delete(this.key);

          return result;

        } catch (error: any) {
          lastError = error;

          // Don't retry if it's not a rate limit error
          if (!this.isRateLimitError(error)) {
            break;
          }

          // Don't retry on the last attempt
          if (attempt === this.config.maxRetries) {
            break;
          }

          // Calculate retry delay with exponential backoff
          const delay = this.config.baseRetryDelay * Math.pow(2, attempt);
          logger.debug(`Rate limit hit for ${this.key}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`);

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // All retries failed
      rateLimitState.inProgress.delete(this.key);
      throw lastError;
    };

    // Store the promise to prevent duplicate requests
    const promise = executeWithRetry();
    rateLimitState.inProgress.set(this.key, promise);

    return promise;
  }

  /**
   * Check if we're within rate limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let requests = rateLimitState.requests.get(this.key) || [];

    // Remove requests outside the current window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if we've exceeded the limit
    if (requests.length >= this.config.maxRequests) {
      // Calculate how long to wait
      const oldestRequest = requests[0];
      const waitTime = (oldestRequest + this.config.windowMs) - now;

      if (waitTime > 0) {
        logger.debug(`Rate limit exceeded for ${this.key}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Recalculate after waiting
        const newNow = Date.now();
        const newWindowStart = newNow - this.config.windowMs;
        requests = requests.filter(timestamp => timestamp > newWindowStart);
      }
    }

    // Add current request timestamp
    requests.push(now);
    rateLimitState.requests.set(this.key, requests);
  }

  /**
   * Check if an error is a rate limiting error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const status = error.status || error.statusCode || error.code;

    // Check for rate limit indicators in message
    const rateLimitMessages = [
      'too many requests',
      'rate limit',
      '429',
      'too many',
      'rate-limit',
      'rate_limit'
    ];

    const isRateLimitMessage = rateLimitMessages.some(msg => message.includes(msg));

    // Check for rate limit status codes
    const isRateLimitStatus = [429, '429', 'TOO_MANY_REQUESTS', 'RateLimitError'].includes(status);

    return isRateLimitMessage || isRateLimitStatus;
  }

  /**
   * Clear rate limit state for a key (for testing purposes)
   */
  static clear(key: string): void {
    rateLimitState.requests.delete(key);
    rateLimitState.inProgress.delete(key);
  }

  /**
   * Get current rate limit status
   */
  getStatus(key?: string): any {
    const targetKey = key || this.key;
    const requests = rateLimitState.requests.get(targetKey) || [];
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const currentRequests = requests.filter(timestamp => timestamp > windowStart);

    return {
      key: targetKey,
      currentRequests: currentRequests.length,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      isLimited: currentRequests.length >= this.config.maxRequests,
      pending: rateLimitState.inProgress.has(targetKey)
    };
  }
}

/**
 * Create a rate limiter for a specific AI provider and model
 */
export function createRateLimiter(provider: string, model: string): RateLimiter {
  const key = `${provider}:${model}`;
  return new RateLimiter(key);
}

/**
 * Create a rate limiter for a specific use case
 */
export function createUseCaseRateLimiter(useCase: string): RateLimiter {
  return new RateLimiter(`use-case:${useCase}`);
}

/**
 * Create a global rate limiter for all AI calls
 */
export const GLOBAL_AI_RATE_LIMITER = new RateLimiter('global:ai');

// Provider-specific configurations
export const PROVIDER_RATE_LIMITS = {
  'deepseek': {
    maxRequests: 90,        // DeepSeek allows more requests
    windowMs: 60000,
    maxRetries: 3,
    baseRetryDelay: 1000,
  },
  'groq': {
    maxRequests: 60,        // Groq standard rate limit
    windowMs: 60000,
    maxRetries: 3,
    baseRetryDelay: 1000,
  },
  'gemini': {
    maxRequests: 60,        // Gemini standard rate limit
    windowMs: 60000,
    maxRetries: 3,
    baseRetryDelay: 1000,
  },
  'openrouter': {
    maxRequests: 40,        // OpenRouter more conservative rate limit
    windowMs: 60000,
    maxRetries: 3,
    baseRetryDelay: 2000,   // Longer initial delay for OpenRouter
  },
} as const;

/**
 * Get rate limit configuration for a provider
 */
export function getRateLimitConfig(provider: string): RateLimitConfig {
  return PROVIDER_RATE_LIMITS[provider as keyof typeof PROVIDER_RATE_LIMITS] || {
    maxRequests: 60,
    windowMs: 60000,
    maxRetries: 3,
    baseRetryDelay: 1000,
  };
}