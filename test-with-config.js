/**
 * Test OpenRouter using the project's actual configuration
 * This script uses the same logic as the actual application
 */

require('dotenv').config();

const fetch = require('node-fetch');

// Import the configuration from the project
const AI_CONFIG = {
  'boat-details': [
    {
      provider: 'openrouter',
      models: ['openrouter/free'],
      temperature: 0.3,
      maxTokens: 2000,
    }
  ],
  'suggest-sailboats': [
    {
      provider: 'openrouter',
      models: ['openrouter/free'],
      temperature: 0.7,
      maxTokens: 1000,
    }
  ],
  'generate-journey': [
    {
      provider: 'openrouter',
      models: ['openrouter/free'],
      temperature: 0.7,
      maxTokens: 20000,
    }
  ]
};

async function callOpenRouter(model, prompt, temperature = 0.7, maxTokens = 1000) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

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
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('OpenRouter returned empty response');
    }

    return text;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('OpenRouter API timeout after 60 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testUseCases() {
  console.log('Testing OpenRouter with project configuration...\n');

  const testCases = [
    {
      useCase: 'boat-details',
      prompt: 'Extract details from this boat description: "A beautiful 45ft blue sailboat with white sails, located in Miami."',
      config: AI_CONFIG['boat-details'][0]
    },
    {
      useCase: 'suggest-sailboats',
      prompt: 'Suggest 3 popular sailboat models for a beginner sailor.',
      config: AI_CONFIG['suggest-sailboats'][0]
    },
    {
      useCase: 'generate-journey',
      prompt: 'Generate a simple sailing journey plan from Miami to Key West.',
      config: AI_CONFIG['generate-journey'][0]
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing use case: ${testCase.useCase}`);
    console.log(`Model: ${testCase.config.models[0]}`);
    console.log(`Prompt: ${testCase.prompt.substring(0, 50)}...`);

    try {
      const result = await callOpenRouter(
        testCase.config.models[0],
        testCase.prompt,
        testCase.config.temperature,
        testCase.config.maxTokens
      );

      console.log(`✅ Success! Response length: ${result.length} characters`);
      console.log(`Response preview: ${result.substring(0, 100)}...`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }

    console.log('---\n');
  }
}

async function testModelAvailability() {
  console.log('Testing model availability...\n');

  const models = [
    'openrouter/free',
    'anthropic/claude-haiku',
    'openai/gpt-4o-mini',
    'anthropic/opus-20250409'
  ];

  for (const model of models) {
    console.log(`Testing model: ${model}`);
    try {
      const result = await callOpenRouter(model, 'Hello, test this model.', 0.1, 50);
      console.log(`✅ ${model} is available`);
    } catch (error) {
      console.log(`❌ ${model} failed: ${error.message}`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('=== OpenRouter Integration Test ===\n');

  // Check if API key is set
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('❌ OPENROUTER_API_KEY not found in environment variables');
    console.log('Please ensure it is set in your .env.local file');
    return;
  }

  console.log('✅ OPENROUTER_API_KEY found in environment');

  await testModelAvailability();
  console.log('\n' + '='.repeat(50) + '\n');
  await testUseCases();

  console.log('=== Test Summary ===');
  console.log('If all tests passed, OpenRouter is working correctly with your project configuration.');
}

runTests().catch(console.error);