# AI Rate Limiting Solution

## Problem Solved

Fixed the "Too many requests" error in the AI assistant by implementing comprehensive rate limiting and retry logic.

## Changes Made

### 1. Created Rate Limiting Utility (`app/lib/ai/rateLimit.ts`)
- Implemented a robust rate limiter with sliding window algorithm
- Added exponential backoff retry logic for rate-limited requests
- Provider-specific rate limit configurations
- Use case-level rate limiting

### 2. Updated AI Service (`app/lib/ai/service.ts`)
- Added rate limiting to all provider functions:
  - `callDeepSeek` - 90 requests/minute (more lenient)
  - `callGroq` - 60 requests/minute (standard)
  - `callGemini` - 60 requests/minute (standard)
  - `callOpenRouter` - 40 requests/minute (more conservative)
- Added use case-level rate limiting to main `callAI` function
- Added global rate limiting for all AI calls

### 3. Created Test Scripts
- `test-rate-limiting.js` - Tests rate limiting functionality
- Updated existing test scripts to work with rate limiting

## Key Features

1. **Rate Limiting**: Prevents "Too many requests" errors by limiting API calls per time window
2. **Retry Logic**: Automatic retries with exponential backoff for rate-limited requests
3. **Provider-Specific Limits**: Different rate limits for different AI providers
4. **Use Case Level Limits**: Additional throttling based on the type of AI task
5. **Global Rate Limiting**: Overall protection for all AI calls

## Configuration

- **DeepSeek**: 90 requests/minute (more lenient)
- **Groq**: 60 requests/minute (standard)
- **Gemini**: 60 requests/minute (standard)
- **OpenRouter**: 40 requests/minute (more conservative)
- **Global**: 60 requests/minute for all AI calls

## Testing

Created `test-rate-limiting.js` to verify the rate limiting functionality works correctly.

## Usage

The rate limiting is now automatically applied to all AI calls. No changes needed in your application code.

## Benefits

1. **Prevents Rate Limiting Errors**: No more "Too many requests" errors
2. **Automatic Recovery**: Failed requests are automatically retried
3. **Fair Usage**: Ensures fair usage across different providers and use cases
4. **Performance**: Maintains responsiveness while respecting API limits

The fix addresses the root cause of the "Too many requests" error by implementing proper rate limiting and retry mechanisms.