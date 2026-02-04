/**
 * Simple JavaScript test script to verify OpenRouter API availability
 * Run with: node test-openrouter-js.js
 */

require('dotenv').config();

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY not set in environment');
    console.log('Please set: export OPENROUTER_API_KEY=your_api_key_here');
    return;
  }

  console.log('Testing OpenRouter API availability...');

  // Test with the free model from config
  const testPrompt = 'Hello, this is a test. Please respond with just the word "success" if you are working correctly.';
  const model = 'openrouter/free';

  try {
    console.log(`Calling OpenRouter with model: ${model}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://find-my-crew.vercel.app',
        'X-Title': 'Find My Crew',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: testPrompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ OpenRouter API error:');
      console.log('Status:', response.status);
      console.log('Error:', errorData.error?.message || response.statusText);
      return;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      console.log('❌ OpenRouter returned empty response');
      return;
    }

    console.log('✅ OpenRouter API is working!');
    console.log('Response:', text);

  } catch (error) {
    console.log('❌ OpenRouter API test failed:');
    console.log('Error:', error.message);
  }
}

// Also test other OpenRouter models
async function testOpenRouterModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return;

  const models = [
    'openrouter/free',
    'anthropic/claude-haiku',
    'openai/gpt-4o-mini',
    'anthropic/opus-20250409'
  ];

  console.log('\nTesting other OpenRouter models...');

  for (const model of models) {
    console.log(`\nTesting model: ${model}`);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://find-my-crew.vercel.app',
          'X-Title': 'Find My Crew',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: 'Test',
            },
          ],
          temperature: 0.1,
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log(`❌ ${model} failed: ${errorData.error?.message || response.statusText}`);
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (text) {
        console.log(`✅ ${model} working: "${text.trim()}"`);
      } else {
        console.log(`❌ ${model} returned empty response`);
      }
    } catch (error) {
      console.log(`❌ ${model} failed: ${error.message}`);
    }
  }
}

// Run tests
testOpenRouter().then(() => {
  testOpenRouterModels();
}).catch(console.error);