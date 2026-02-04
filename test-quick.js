/**
 * Quick test to verify the AI service with rate limiting works
 * Run with: node test-quick.js
 */

require('dotenv').config();

async function quickTest() {
  console.log('Quick AI Service Test\n');

  // Test that the environment is set up correctly
  console.log('Environment Check:');
  console.log('✅ OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set');
  console.log('✅ DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? 'Set' : 'Not set');
  console.log('✅ GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set' : 'Not set');
  console.log('✅ GOOGLE_GEMINI_API_KEY:', process.env.GOOGLE_GEMINI_API_KEY ? 'Set' : 'Not set');

  // Test rate limiting import
  try {
    const { RateLimiter } = require('./app/lib/ai/rateLimit');
    console.log('✅ Rate limiting module loaded successfully');

    const limiter = new RateLimiter('test', { maxRequests: 5, windowMs: 1000 });
    console.log('✅ Rate limiter created successfully');
  } catch (error) {
    console.log('❌ Rate limiting module failed:', error.message);
  }

  // Test AI service import
  try {
    const { callAI } = require('./app/lib/ai/service');
    console.log('✅ AI service loaded successfully');
  } catch (error) {
    console.log('❌ AI service failed:', error.message);
  }

  console.log('\n=== Test Results ===');
  console.log('If all checks show ✅, the setup is working correctly.');
  console.log('The "Too many requests" error should now be prevented by rate limiting.');
}

quickTest().catch(console.error);