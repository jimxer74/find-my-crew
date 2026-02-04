/**
 * Test script to verify rate limiting functionality
 * Run with: node test-rate-limiting.js
 */

require('dotenv').config();

const { RateLimiter, createRateLimiter, createUseCaseRateLimiter, GLOBAL_AI_RATE_LIMITER } = require('./app/lib/ai/rateLimit');

async function testRateLimiting() {
  console.log('Testing Rate Limiting Functionality\n');

  // Test 1: Basic rate limiting
  console.log('=== Test 1: Basic Rate Limiting ===');
  const basicLimiter = new RateLimiter('test:basic', {
    maxRequests: 3,
    windowMs: 5000,  // 5 seconds
    maxRetries: 1,
    baseRetryDelay: 500
  });

  console.log('Making 5 rapid requests (should hit rate limit)...');
  const promises = [];
  for (let i = 0; i < 5; i++) {
    const promise = basicLimiter.execute(async () => {
      console.log(`Request ${i + 1} - Success`);
      return `Request ${i + 1} completed`;
    });
    promises.push(promise);
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    console.log('Rate limiting working - some requests were delayed/retried');
  }

  // Test 2: Provider-specific rate limiting
  console.log('\n=== Test 2: Provider Rate Limiting ===');
  const deepseekLimiter = createRateLimiter('deepseek', 'deepseek-chat');
  const openrouterLimiter = createRateLimiter('openrouter', 'openrouter/free');

  console.log('DeepSeek config:', deepseekLimiter.getStatus());
  console.log('OpenRouter config:', openrouterLimiter.getStatus());

  // Test 3: Use case rate limiting
  console.log('\n=== Test 3: Use Case Rate Limiting ===');
  const boatDetailsLimiter = createUseCaseRateLimiter('boat-details');
  const suggestSailboatsLimiter = createUseCaseRateLimiter('suggest-sailboats');

  console.log('Boat details limiter status:', boatDetailsLimiter.getStatus());
  console.log('Suggest sailboats limiter status:', suggestSailboatsLimiter.getStatus());

  // Test 4: Global rate limiting
  console.log('\n=== Test 4: Global Rate Limiting ===');
  console.log('Global limiter status:', GLOBAL_AI_RATE_LIMITER.getStatus());

  // Test 5: Simulate API calls with mock function
  console.log('\n=== Test 5: Simulated API Calls ===');

  const mockAPICall = (provider, model) => {
    return new Promise((resolve, reject) => {
      const limiter = createRateLimiter(provider, model);
      limiter.execute(async () => {
        console.log(`[${provider}/${model}] API call started`);
        await new Promise(r => setTimeout(r, 100)); // Simulate API call time
        console.log(`[${provider}/${model}] API call completed`);
        return `Success from ${provider}/${model}`;
      }).then(resolve).catch(reject);
    });
  };

  const apiCalls = [
    () => mockAPICall('openrouter', 'openrouter/free'),
    () => mockAPICall('deepseek', 'deepseek-chat'),
    () => mockAPICall('groq', 'llama-3.1-8b-instant'),
    () => mockAPICall('openrouter', 'anthropic/claude-haiku'),
    () => mockAPICall('deepseek', 'deepseek-reasoner'),
  ];

  console.log('Making rapid API calls with rate limiting...');
  const apiPromises = apiCalls.map(fn => fn());
  await Promise.allSettled(apiPromises);

  console.log('\n=== Rate Limiting Test Complete ===');
  console.log('If you see requests being delayed or retried, rate limiting is working correctly.');
}

// Run the test
testRateLimiting().catch(console.error);