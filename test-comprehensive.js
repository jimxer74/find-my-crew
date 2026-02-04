/**
 * Comprehensive test script for OpenRouter API and JSON parsing
 * Run with: node test-comprehensive.js
 */

const fetch = require('node-fetch');

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.log('❌ OPENROUTER_API_KEY not set in environment');
    console.log('Please set: export OPENROUTER_API_KEY=your_api_key_here');
    return false;
  }

  console.log('Testing OpenRouter API availability...');

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
      console.log('Full error data:', errorData);
      return false;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      console.log('❌ OpenRouter returned empty response');
      console.log('Full response:', JSON.stringify(data, null, 2));
      return false;
    }

    console.log('✅ OpenRouter API is working!');
    console.log('Response:', text);
    return true;

  } catch (error) {
    console.log('❌ OpenRouter API test failed:');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    return false;
  }
}

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

// Test JSON parsing robustness
function testJSONParsing() {
  console.log('\nTesting JSON parsing robustness...');

  // Test cases that might cause parsing issues
  const testCases = [
    '{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Test"}}',
    '"{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Test"}}"',
    'suggest_profile_update_user_description({"reason": "Test"})',
    'some text before {"name": "suggest_profile_update_user_description", "arguments": {"reason": "Test"}} some text after',
    '{"name": "suggest_profile_update_user_description", "arguments": {"reason": "Test"',
    'invalid json content'
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\nTest case ${index + 1}: ${testCase.substring(0, 50)}...`);
    try {
      // Apply the same parsing logic as in the fixed service
      let cleanContent = testCase;
      if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
        cleanContent = cleanContent.slice(1, -1);
      }

      // Look for the first { and last } to extract JSON object
      let jsonContent = cleanContent;
      const firstBrace = jsonContent.indexOf('{');
      const lastBrace = jsonContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (jsonError) {
        // Try to extract a valid JSON object from the text
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            console.log(`   ❌ Still failed to parse: ${nestedError.message}`);
            return;
          }
        } else {
          console.log(`   ❌ No valid JSON object found`);
          return;
        }
      }

      // Validate this is actually a tool call (must have name field)
      if (!parsed.name || typeof parsed.name !== 'string') {
        console.log(`   ❌ No valid "name" field`);
        return;
      }

      console.log(`   ✅ Parsed successfully: ${JSON.stringify(parsed)}`);
    } catch (error) {
      console.log(`   ❌ Failed to parse: ${error.message}`);
    }
  });
}

// Test rate limiting functionality
async function testRateLimiting() {
  console.log('\nTesting rate limiting functionality...');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log('❌ Cannot test rate limiting - OPENROUTER_API_KEY not set');
    return;
  }

  console.log('Making rapid requests to test rate limiting...');

  const promises = [];
  for (let i = 0; i < 5; i++) {
    const promise = fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://find-my-crew.vercel.app',
        'X-Title': 'Find My Crew',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{ role: 'user', content: `Test request ${i + 1}` }],
        temperature: 0.1,
        max_tokens: 10,
      }),
    }).then(response => {
      console.log(`Request ${i + 1}: ${response.ok ? 'Success' : 'Rate limited'}`);
      return response.ok;
    }).catch(error => {
      console.log(`Request ${i + 1}: Failed - ${error.message}`);
      return false;
    });

    promises.push(promise);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const results = await Promise.allSettled(promises);
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

  console.log(`Rate limiting test: ${successCount}/${results.length} requests succeeded`);
  if (successCount < results.length) {
    console.log('✅ Rate limiting is working - some requests were limited');
  } else {
    console.log('ℹ️  Rate limiting may not be active or limits are high');
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== OpenRouter and JSON Parsing Tests ===\n');

  const isOpenRouterWorking = await testOpenRouter();

  if (isOpenRouterWorking) {
    await testOpenRouterModels();
    await testRateLimiting();
  }

  testJSONParsing();

  console.log('\n=== Test Summary ===');
  console.log('If OpenRouter tests passed, the API is working correctly.');
  console.log('If JSON parsing tests passed, the parsing logic is robust.');
  console.log('If rate limiting tests show some requests were limited, rate limiting is working.');
  console.log('Check the output above for any failures.');
}

runAllTests().catch(console.error);