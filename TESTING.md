# Testing OpenRouter API and JSON Parsing

This directory contains test scripts to verify OpenRouter API availability and test the JSON parsing robustness.

## Prerequisites

1. Set your OpenRouter API key:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

2. Install Node.js (version 18+ recommended for native fetch support)

## Test Scripts

### 1. Quick Verification (Recommended)
```bash
node test-quick.js
```
Quick check that all modules load correctly and environment is set up.

### 2. Simple OpenRouter Test
```bash
node test-openrouter-simple.js
```
Tests basic OpenRouter API connectivity with the free model.

### 3. JavaScript OpenRouter Test
```bash
node test-openrouter-js.js
```
Simple JavaScript test without TypeScript dependencies.

### 4. Comprehensive Test (Recommended)
```bash
node test-comprehensive.js
```
Tests:
- OpenRouter API availability
- Multiple OpenRouter models
- JSON parsing robustness with various malformed inputs
- Rate limiting functionality

### 5. Rate Limiting Test
```bash
node test-rate-limiting.js
```
Tests the rate limiting functionality specifically.

### 6. TypeScript Test (Optional)
```bash
npx ts-node test-openrouter.ts
```
Tests OpenRouter using the actual service implementation (requires ts-node).

## Expected Results

### Environment Check
- ✅ All API keys should be "Set" (not "Not set")
- ✅ Rate limiting module should load successfully
- ✅ AI service should load successfully

### OpenRouter Tests
- ✅ Should show "OpenRouter API is working!" if the API key is valid
- ❌ Should show error details if the API key is invalid or not set

### JSON Parsing Tests
- ✅ Should successfully parse most test cases, including malformed JSON
- ❌ Should gracefully handle completely invalid JSON

### Rate Limiting Tests
- ✅ Should show requests being delayed or retried when rate limits are hit
- ✅ Should demonstrate exponential backoff behavior

## Troubleshooting

### OpenRouter API Key Issues
If you see "OPENROUTER_API_KEY not set in environment":
1. Make sure you've set the environment variable
2. Check that the variable is exported in your current shell session
3. Verify the API key is valid on the OpenRouter dashboard

### Module Import Issues
If you see "Cannot find module" errors:
1. Use the JavaScript versions (`.js` files) instead of TypeScript (`.ts` files)
2. Ensure you're running from the correct directory
3. Use `test-quick.js` first to verify basic setup

### Network Issues
If you see network errors:
1. Check your internet connection
2. Verify the OpenRouter API endpoint is accessible
3. Check if there are any firewall restrictions

### JSON Parsing Issues
The updated parsing logic should handle:
- JSON wrapped in quotes
- Text before/after JSON objects
- Incomplete JSON objects
- Completely invalid JSON

If you encounter parsing issues, the logs will show exactly what content failed to parse.

## API Key Setup

1. Go to [OpenRouter](https://openrouter.ai/)
2. Sign up for an account
3. Navigate to your API keys section
4. Create a new API key
5. Set it as an environment variable:
   ```bash
   export OPENROUTER_API_KEY=your_api_key_here
   ```

## Models Tested

The scripts test these OpenRouter models:
- `openrouter/free` - Free tier model (should always work if API key is valid)
- `anthropic/claude-haiku` - Claude Haiku model
- `openai/gpt-4o-mini` - GPT-4o mini model
- `anthropic/opus-20250409` - Claude Opus model

Note: Some models may require credits or specific permissions on your OpenRouter account.

## Quick Start

For most users, run these two commands:

```bash
# 1. Quick verification
node test-quick.js

# 2. Comprehensive testing
node test-comprehensive.js
```

If both complete successfully, your OpenRouter integration and AI fixes are working correctly!