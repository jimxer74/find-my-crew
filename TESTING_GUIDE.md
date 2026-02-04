# Testing Guide - OpenRouter API and AI Fixes

## Quick Start

**For most users, run these commands:**

```bash
# 1. Quick verification that everything is set up correctly
node test-quick.js

# 2. Comprehensive testing including rate limiting
node test-comprehensive.js
```

If both complete successfully, your AI assistant fixes are working correctly!

## Test Scripts Overview

### Essential Tests (Use These)

1. **`test-quick.js`** - Quick verification script
   - Checks environment variables
   - Verifies module imports work
   - Fastest way to verify setup

2. **`test-comprehensive.js`** - Complete testing suite
   - OpenRouter API connectivity
   - Multiple model testing
   - JSON parsing robustness
   - Rate limiting functionality
   - **Recommended for full verification**

### Optional Tests

3. **`test-openrouter-js.js`** - Simple OpenRouter test (JavaScript version)
4. **`test-rate-limiting.js`** - Rate limiting specific tests
5. **`test-openrouter-simple.js`** - Basic connectivity test

### TypeScript Tests (Advanced Users)

6. **`test-openrouter.ts`** - TypeScript version (requires `npx ts-node`)
   ```bash
   npx ts-node test-openrouter.ts
   ```

## Common Issues and Solutions

### Issue: "Cannot find module 'node-fetch'"
**Solution**: Use the JavaScript versions instead:
```bash
node test-openrouter-js.js  # Instead of test-openrouter.ts
```

### Issue: "OPENROUTER_API_KEY not set"
**Solution**: Set the environment variable:
```bash
export OPENROUTER_API_KEY=your_api_key_here
```

### Issue: Module import errors
**Solution**: Run from the correct directory and use `.js` files:
```bash
cd /path/to/find-my-crew
node test-quick.js
```

## Environment Setup

Your project already has API keys configured in `.env.local`:
```
OPENROUTER_API_KEY=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
```

If tests show the API key as "Not set", ensure:
1. You're running from the correct directory
2. The `.env.local` file exists
3. You haven't overridden the environment in your shell

## Expected Test Results

### test-quick.js Output
```
Environment Check:
✅ OPENROUTER_API_KEY: Set
✅ DEEPSEEK_API_KEY: Set
✅ GROQ_API_KEY: Set
✅ GOOGLE_GEMINI_API_KEY: Set
✅ Rate limiting module loaded successfully
✅ Rate limiter created successfully
✅ AI service loaded successfully
```

### test-comprehensive.js Output
```
Testing OpenRouter API availability...
✅ OpenRouter API is working!
Testing other OpenRouter models...
✅ openrouter/free working
✅ anthropic/claude-haiku working
✅ openai/gpt-4o-mini working
✅ anthropic/opus-20250409 working

Testing JSON parsing robustness...
✅ Parsed successfully: {"name":"suggest_profile_update_user_description","arguments":{"reason":"Test"}}

Testing rate limiting functionality...
✅ Rate limiting is working - some requests were limited
```

## What Each Fix Addresses

### 1. JSON Parsing Fix
- **Problem**: AI responses with malformed JSON caused crashes
- **Solution**: Robust JSON parsing that handles various formats
- **Test**: JSON parsing test cases in `test-comprehensive.js`

### 2. Rate Limiting Fix
- **Problem**: "Too many requests" errors from API overload
- **Solution**: Rate limiting with exponential backoff retry
- **Test**: Rate limiting tests in `test-comprehensive.js`

## Files Modified Summary

1. **`app/lib/ai/assistant/service.ts`** - JSON parsing fixes
2. **`app/lib/ai/service.ts`** - Rate limiting implementation
3. **`app/lib/ai/rateLimit.ts`** - New rate limiting utility

## Troubleshooting

### If tests fail:
1. **Check environment variables** - Run `node test-quick.js` first
2. **Check internet connection** - Tests require network access
3. **Check API key validity** - Verify on OpenRouter dashboard
4. **Run from correct directory** - Must be in project root

### If OpenRouter tests fail:
1. Verify API key is valid on OpenRouter
2. Check if model requires credits
3. Check OpenRouter status page for outages

### If rate limiting tests show no throttling:
1. Rate limits may be higher than test volume
2. Provider may have generous limits
3. This is normal - rate limiting is preventative

## Next Steps

After successful testing:
1. Your AI assistant should no longer crash on malformed JSON
2. "Too many requests" errors should be prevented
3. Failed requests will be automatically retried
4. Application should maintain responsiveness during high usage

The fixes are backward compatible and require no changes to your existing application code.