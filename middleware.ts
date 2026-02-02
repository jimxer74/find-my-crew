import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Rate Limiting Middleware for SailSmart
 *
 * This implementation uses in-memory rate limiting which works for single-instance deployments.
 * For production with multiple instances, use Vercel KV or Upstash Redis:
 *
 * To upgrade to Vercel KV:
 * 1. Install @vercel/kv: npm install @vercel/kv
 * 2. Create a KV store in Vercel dashboard
 * 3. Replace the in-memory store with kv.get/kv.set calls
 *
 * Example with Vercel KV:
 * import { kv } from '@vercel/kv';
 * const key = `ratelimit:${ip}:${bucket}`;
 * const current = await kv.incr(key);
 * if (current === 1) await kv.expire(key, windowMs / 1000);
 */

// Rate limit configuration by route type
const RATE_LIMITS = {
  ai: { requests: 10, windowMs: 60 * 1000 }, // 10 requests per minute for AI endpoints
  registration: { requests: 20, windowMs: 60 * 1000 }, // 20 requests per minute for registration
  general: { requests: 100, windowMs: 60 * 1000 }, // 100 requests per minute for general API
};

// In-memory store for rate limiting
// Note: This resets on server restart and doesn't work across multiple instances
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries periodically (every 5 minutes)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
    lastCleanup = now;
  }
}

function getClientIP(request: NextRequest): string {
  // Try various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  // Fallback to a default identifier
  return 'unknown';
}

function getRateLimitBucket(pathname: string): keyof typeof RATE_LIMITS {
  if (pathname.startsWith('/api/ai/')) {
    return 'ai';
  }
  if (pathname.startsWith('/api/registrations')) {
    return 'registration';
  }
  return 'general';
}

function checkRateLimit(ip: string, bucket: keyof typeof RATE_LIMITS): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  cleanupStore();

  const limit = RATE_LIMITS[bucket];
  const key = `${ip}:${bucket}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Start new window
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.windowMs });
    return { allowed: true, remaining: limit.requests - 1, resetIn: limit.windowMs };
  }

  if (entry.count >= limit.requests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }

  // Increment count
  entry.count += 1;
  return { allowed: true, remaining: limit.requests - entry.count, resetIn: entry.resetTime - now };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for certain routes (health checks, etc.)
  if (pathname === '/api/health' || pathname === '/api/ping') {
    return NextResponse.next();
  }

  const ip = getClientIP(request);
  const bucket = getRateLimitBucket(pathname);
  const { allowed, remaining, resetIn } = checkRateLimit(ip, bucket);

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(resetIn / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(resetIn / 1000)),
          'X-RateLimit-Limit': String(RATE_LIMITS[bucket].requests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetIn / 1000)),
        }
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS[bucket].requests));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetIn / 1000)));

  return response;
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
};
