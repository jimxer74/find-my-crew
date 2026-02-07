/**
 * Test script to verify the new AI configuration system
 */

import {
  getCurrentConfig,
  getCurrentEnvironment,
  getProviderConfig,
  hasAnyProvider,
  getAvailableProviders,
  getAPIKeys,
  UseCase
} from '@/app/lib/ai/config/index';

async function testConfig() {
  console.log('🧪 Testing AI Configuration System');
  console.log('=====================================');

  // Test environment detection
  console.log('Current environment:', getCurrentEnvironment());

  // Test configuration loading
  try {
    const config = getCurrentConfig();
    console.log('✅ Configuration loaded successfully');
    console.log('Number of providers:', config.providers.length);
    console.log('Default temperature:', config.defaultTemperature);
    console.log('Default max tokens:', config.defaultMaxTokens);

    // Test provider availability
    console.log('Has any provider:', hasAnyProvider());
    console.log('Available providers:', getAvailableProviders());

    // Test API keys
    const apiKeys = getAPIKeys();
    console.log('API keys status:');
    Object.entries(apiKeys).forEach(([provider, key]) => {
      console.log(`  ${provider}: ${key ? 'configured' : 'not configured'}`);
    });

    // Test provider-specific config
    for (const provider of getAvailableProviders()) {
      const providerConfig = getProviderConfig(provider, getCurrentEnvironment());
      if (providerConfig) {
        console.log(`✅ ${provider} configuration:`, {
          models: providerConfig.models.length,
          temperature: providerConfig.temperature,
          maxTokens: providerConfig.maxTokens
        });
      }
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testConfig();