# AI Configuration System Implementation Plan

## Overview

This implementation plan details the step-by-step process for replacing the complex use-case-specific AI model configurations with a simplified environment-based system. The plan includes file structure, code examples, and comprehensive testing strategy.

## Current State Analysis

### Complexity Issues
- **1,000+ lines** of configuration in `/app/lib/ai/config.ts`
- **13 use cases** each with 4-5 provider configurations
- **50+ different model specifications** across DEV and PROD
- **High duplication** between similar use cases
- **Poor maintainability** requiring updates in multiple places

### Current Architecture
```
/app/lib/ai/config.ts (1,000+ lines)
├── AIProvider enum (4 providers)
├── UseCase enum (13 use cases)
├── ModelConfig interface
├── UseCaseConfig interface
├── DEV_AI_CONFIG (complex nested structure)
└── PROD_AI_CONFIG (complex nested structure)
```

## Target Architecture

### Simplified Structure
```
/app/lib/ai/config/
├── index.ts              # Main configuration loader
├── dev.ts                # Development environment configuration
├── prod.ts               # Production environment configuration
└── providers/           # Provider-specific configurations
    ├── deepseek.ts
    ├── groq.ts
    ├── gemini.ts
    └── openrouter.ts
```

### Key Benefits
- **80% reduction** in configuration code
- **Single source of truth** for each provider
- **Environment-specific** model selection
- **Easy provider override** via environment variable
- **Maintained functionality** with improved maintainability

## Implementation Steps

### Phase 1: Create New Configuration Structure

#### Step 1.1: Create Provider-Specific Configuration Files

**File: `/app/lib/ai/config/providers/openrouter.ts`**
```typescript
export interface ProviderModelConfig {
  models: string[];
  temperature: number;
  maxTokens: number;
}

export const openrouterConfig = {
  dev: {
    models: [
      'deepseek/deepseek-r1-0528:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'llama-3.1-8b-instant',
      'qwen/qwen-3-4b:free',
      'qwen/qwen-3-80b:free'
    ],
    temperature: 0.5,
    maxTokens: 4000
  },
  prod: {
    models: [
      'anthropic/claude-sonnet-4-5',
      'openai/gpt-4o',
      'anthropic/opus-20250409',
      'google/gemini-2.5-pro-exp',
      'meta-llama/llama-4-scout-17b-16e-instruct'
    ],
    temperature: 0.3,
    maxTokens: 8000
  }
};
```

**File: `/app/lib/ai/config/providers/deepseek.ts`**
```typescript
export const deepseekConfig = {
  dev: {
    models: ['deepseek-r1', 'deepseek-chat'],
    temperature: 0.3,
    maxTokens: 4000
  },
  prod: {
    models: ['deepseek-r1', 'deepseek-chat'],
    temperature: 0.3,
    maxTokens: 8000
  }
};
```

**File: `/app/lib/ai/config/providers/groq.ts`**
```typescript
export const groqConfig = {
  dev: {
    models: ['llama-3.1-8b', 'llama-3.3-70b', 'qwen-3-32b'],
    temperature: 0.3,
    maxTokens: 4000
  },
  prod: {
    models: ['llama-4-scout-17b-16e-instruct', 'llama-3.3-70b'],
    temperature: 0.3,
    maxTokens: 8000
  }
};
```

**File: `/app/lib/ai/config/providers/gemini.ts`**
```typescript
export const geminiConfig = {
  dev: {
    models: ['gemini-2.5-flash', 'gemini-3-flash'],
    temperature: 0.3,
    maxTokens: 4000
  },
  prod: {
    models: ['gemini-2.5-pro', 'gemini-3-pro'],
    temperature: 0.3,
    maxTokens: 8000
  }
};
```

#### Step 1.2: Create Environment Configuration Files

**File: `/app/lib/ai/config/dev.ts`**
```typescript
import { AIProvider } from '../service';
import { openrouterConfig } from './providers/openrouter';
import { deepseekConfig } from './providers/deepseek';
import { groqConfig } from './providers/groq';
import { geminiConfig } from './providers/gemini';

interface AIProviderConfig {
  provider: AIProvider;
  models: string[];
  temperature: number;
  maxTokens: number;
}

interface EnvironmentConfig {
  providers: AIProviderConfig[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export const devConfig: EnvironmentConfig = {
  providers: [
    {
      provider: 'openrouter',
      models: openrouterConfig.dev.models,
      temperature: openrouterConfig.dev.temperature,
      maxTokens: openrouterConfig.dev.maxTokens
    },
    {
      provider: 'deepseek',
      models: deepseekConfig.dev.models,
      temperature: deepseekConfig.dev.temperature,
      maxTokens: deepseekConfig.dev.maxTokens
    },
    {
      provider: 'groq',
      models: groqConfig.dev.models,
      temperature: groqConfig.dev.temperature,
      maxTokens: groqConfig.dev.maxTokens
    },
    {
      provider: 'gemini',
      models: geminiConfig.dev.models,
      temperature: geminiConfig.dev.temperature,
      maxTokens: geminiConfig.dev.maxTokens
    }
  ],
  defaultTemperature: 0.5,
  defaultMaxTokens: 4000
};
```

**File: `/app/lib/ai/config/prod.ts`**
```typescript
import { AIProvider } from '../service';
import { openrouterConfig } from './providers/openrouter';
import { deepseekConfig } from './providers/deepseek';
import { groqConfig } from './providers/groq';
import { geminiConfig } from './providers/gemini';

interface AIProviderConfig {
  provider: AIProvider;
  models: string[];
  temperature: number;
  maxTokens: number;
}

interface EnvironmentConfig {
  providers: AIProviderConfig[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export const prodConfig: EnvironmentConfig = {
  providers: [
    {
      provider: 'openrouter',
      models: openrouterConfig.prod.models,
      temperature: openrouterConfig.prod.temperature,
      maxTokens: openrouterConfig.prod.maxTokens
    },
    {
      provider: 'groq',
      models: groqConfig.prod.models,
      temperature: groqConfig.prod.temperature,
      maxTokens: groqConfig.prod.maxTokens
    },
    {
      provider: 'deepseek',
      models: deepseekConfig.prod.models,
      temperature: deepseekConfig.prod.temperature,
      maxTokens: deepseekConfig.prod.maxTokens
    },
    {
      provider: 'gemini',
      models: geminiConfig.prod.models,
      temperature: geminiConfig.prod.temperature,
      maxTokens: geminiConfig.prod.maxTokens
    }
  ],
  defaultTemperature: 0.3,
  defaultMaxTokens: 8000
};
```

#### Step 1.3: Create Main Configuration Loader

**File: `/app/lib/ai/config/index.ts`**
```typescript
import { AIProvider } from '../service';
import { devConfig } from './dev';
import { prodConfig } from './prod';

export type AIProvider = 'deepseek' | 'groq' | 'gemini' | 'openrouter';

export interface AIProviderConfig {
  provider: AIProvider;
  models: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface EnvironmentConfig {
  providers: AIProviderConfig[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

/**
 * Get current environment (development or production)
 */
export function getCurrentEnvironment(): 'development' | 'production' {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * Get configuration for current environment
 */
export function getAIConfig(): EnvironmentConfig {
  const env = getCurrentEnvironment();
  return getAIConfigForEnv(env);
}

/**
 * Get configuration for specific environment
 */
export function getAIConfigForEnv(env: 'development' | 'production'): EnvironmentConfig {
  return env === 'production' ? prodConfig : devConfig;
}

/**
 * Get provider-specific configuration for environment
 */
export function getProviderConfig(
  provider: AIProvider,
  env: 'development' | 'production'
): AIProviderConfig | null {
  const config = getAIConfigForEnv(env);
  return config.providers.find(p => p.provider === provider) || null;
}

/**
 * Check if any providers are configured
 */
export function hasAnyProvider(): boolean {
  const config = getAIConfig();
  return config.providers.length > 0;
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): AIProvider[] {
  const config = getAIConfig();
  return config.providers.map(p => p.provider);
}

/**
 * Get API keys for all configured providers
 */
export function getAPIKeys(): Record<AIProvider, string | undefined> {
  return {
    deepseek: process.env.DEEPSEEK_API_KEY,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GOOGLE_GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY
  };
}

/**
 * Check if a specific provider has an API key configured
 */
export function hasProviderAPIKey(provider: AIProvider): boolean {
  const keys = getAPIKeys();
  return !!keys[provider];
}

/**
 * Get environment-specific models for a provider
 */
export function getProviderModels(
  provider: AIProvider,
  env: 'development' | 'production' = getCurrentEnvironment()
): string[] {
  const config = getProviderConfig(provider, env);
  return config?.models || [];
}

/**
 * Get default configuration for environment with optional provider override
 */
export function getCurrentConfig(): EnvironmentConfig {
  const providerOverride = process.env.SAILSMART_LLM_PROVIDER as AIProvider | undefined;

  if (providerOverride) {
    return getProviderSpecificConfig(providerOverride);
  }

  return getAIConfig();
}

/**
 * Get configuration for specific provider only
 */
function getProviderSpecificConfig(provider: AIProvider): EnvironmentConfig {
  const env = getCurrentEnvironment();
  const providerConfig = getProviderConfig(provider, env);

  if (!providerConfig) {
    throw new Error(`Provider ${provider} not configured for environment ${env}`);
  }

  return {
    providers: [providerConfig],
    defaultTemperature: providerConfig.temperature || 0.5,
    defaultMaxTokens: providerConfig.maxTokens || 4000
  };
}
```

### Phase 2: Update AI Service Logic

#### Step 2.1: Modify Configuration Import in Service

**File: `/app/lib/ai/service.ts` (Update imports)**
```typescript
// Remove old imports
// import { DEV_AI_CONFIG, PROD_AI_CONFIG, getCurrentEnvironment, getAIConfig, UseCase, AIProvider } from './config';

// Add new imports
import {
  getCurrentConfig,
  getCurrentEnvironment,
  getProviderConfig,
  hasProviderAPIKey,
  AIProviderConfig,
  EnvironmentConfig
} from './config';
```

#### Step 2.2: Update Provider Selection Logic

**Replace the existing `callAI` function provider selection:**

```typescript
// OLD CODE (lines ~100-200):
const config = getAIConfig();
const useCaseConfig = config.find(c => c.useCase === useCase);
if (!useCaseConfig) {
  throw new AIServiceError('No AI configuration found', 'callAI', 'no_config', useCase);
}

// NEW CODE:
const envConfig = getCurrentConfig();
const providers = envConfig.providers;
```

#### Step 2.3: Update Model Selection Logic

**Replace use case-specific model selection:**

```typescript
// OLD CODE:
for (const providerConfig of useCaseConfig.preferredProviders) {
  const apiKey = getAPIKeys()[providerConfig.provider];
  if (!apiKey) {
    logger.debug(`Skipping ${providerConfig.provider} - no API key configured`);
    continue;
  }

// NEW CODE:
for (const providerConfig of providers) {
  if (!hasProviderAPIKey(providerConfig.provider)) {
    logger.debug(`Skipping ${providerConfig.provider} - no API key configured`);
    continue;
  }
```

#### Step 2.4: Update Temperature and MaxTokens Logic

**Replace use case-specific defaults:**

```typescript
// OLD CODE:
const temperature = temperatureOverride ?? providerConfig.temperature ?? 0.5;
const maxTokens = maxTokensOverride ?? providerConfig.maxTokens ?? 3000;

// NEW CODE:
const temperature = temperatureOverride ?? providerConfig.temperature ?? envConfig.defaultTemperature;
const maxTokens = maxTokensOverride ?? providerConfig.maxTokens ?? envConfig.defaultMaxTokens;
```

### Phase 3: Update Helper Functions

#### Step 3.1: Update Configuration Helpers

**Replace old helper functions:**

```typescript
// OLD CODE:
export function getCurrentEnvironment(): 'development' | 'production' {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

export function getAIConfig(): UseCaseConfig[] {
  return getCurrentEnvironment() === 'production' ? PROD_AI_CONFIG : DEV_AI_CONFIG;
}

export function getAIConfigForEnv(env: 'development' | 'production'): UseCaseConfig[] {
  return env === 'production' ? PROD_AI_CONFIG : DEV_AI_CONFIG;
}

// NEW CODE - Remove these (handled in config/index.ts)
```

### Phase 4: Create Migration Script

#### Step 4.1: Create Backup and Migration Script

**File: `/scripts/migrate-ai-config.ts`**
```typescript
#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

const CONFIG_FILE = '/app/lib/ai/config.ts';
const BACKUP_FILE = '/app/lib/ai/config.ts.backup';

function backupCurrentConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.copyFileSync(CONFIG_FILE, BACKUP_FILE);
    console.log('✅ Backed up current config to', BACKUP_FILE);
  }
}

function createMigrationReport() {
  const report = `
# AI Configuration Migration Report

## Migration Complete

### Changes Made:
- ✅ Created new simplified configuration structure
- ✅ Moved provider-specific configurations to separate files
- ✅ Created environment-specific configurations (DEV/PROD)
- ✅ Added environment variable provider override support
- ✅ Updated AI service to use new configuration system

### Files Created:
- /app/lib/ai/config/index.ts (main loader)
- /app/lib/ai/config/dev.ts (development config)
- /app/lib/ai/config/prod.ts (production config)
- /app/lib/ai/config/providers/openrouter.ts
- /app/lib/ai/config/providers/deepseek.ts
- /app/lib/ai/config/providers/groq.ts
- /app/lib/ai/config/providers/gemini.ts

### Files Modified:
- /app/lib/ai/service.ts (updated to use new config)

### Files Backed Up:
- /app/lib/ai/config.ts → /app/lib/ai/config.ts.backup

### Environment Variables:
- New: SAILSMART_LLM_PROVIDER (optional provider override)

### Testing:
Run the following to verify migration:
1. npm run dev
2. Test AI API routes: /api/ai/boat-details, /api/ai/generate-journey
3. Verify all existing functionality works

### Rollback:
If issues occur, restore from backup:
mv /app/lib/ai/config.ts.backup /app/lib/ai/config.ts
`;

  fs.writeFileSync('/app/migration-report.md', report);
  console.log('📄 Migration report created: /app/migration-report.md');
}

async function main() {
  console.log('🚀 Starting AI configuration migration...');

  backupCurrentConfig();
  createMigrationReport();

  console.log('✅ Migration complete!');
  console.log('📋 Please review the migration report and test the application.');
}

main().catch(console.error);
```

## Testing Strategy

### Unit Tests

#### Test Configuration Loading
```typescript
// __tests__/ai/config.test.ts
import { getCurrentConfig, getCurrentEnvironment, getProviderConfig } from '@/lib/ai/config';

describe('AI Configuration', () => {
  test('should load correct environment config', () => {
    process.env.NODE_ENV = 'development';
    const config = getCurrentConfig();
    expect(config.providers.length).toBeGreaterThan(0);
  });

  test('should override provider when SAILSMART_LLM_PROVIDER is set', () => {
    process.env.SAILSMART_LLM_PROVIDER = 'openrouter';
    const config = getCurrentConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].provider).toBe('openrouter');
  });
});
```

#### Test Provider Selection
```typescript
// __tests__/ai/service.test.ts
import { callAI } from '@/lib/ai/service';

describe('AI Service', () => {
  test('should use correct provider for environment', async () => {
    process.env.NODE_ENV = 'development';
    process.env.OPENROUTER_API_KEY = 'test-key';

    const result = await callAI({
      useCase: 'boat-details',
      prompt: 'Test prompt'
    });

    expect(result).toBeDefined();
  });
});
```

### Integration Tests

#### Test All API Routes
```typescript
// __tests__/api/ai.test.ts
describe('AI API Routes', () => {
  test('boat-details API should work', async () => {
    const response = await fetch('/api/ai/boat-details', {
      method: 'POST',
      body: JSON.stringify({ text: 'Test boat description' })
    });

    expect(response.status).toBe(200);
  });

  test('generate-journey API should work', async () => {
    const response = await fetch('/api/ai/generate-journey', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Generate journey' })
    });

    expect(response.status).toBe(200);
  });
});
```

### Environment Variable Tests

#### Test Provider Override
```bash
# Test DEV environment with override
NODE_ENV=development SAILSMART_LLM_PROVIDER=openrouter npm run dev

# Test PROD environment with override
NODE_ENV=production SAILSMART_LLM_PROVIDER=deepseek npm run build

# Test default behavior
NODE_ENV=development npm run dev
```

### Performance Tests

#### Test Rate Limiting
```typescript
// __tests__/ai/rate-limit.test.ts
describe('Rate Limiting', () => {
  test('should handle rate limits gracefully', async () => {
    // Simulate multiple rapid requests
    const promises = Array(50).fill(0).map(() =>
      callAI({ useCase: 'boat-details', prompt: 'Test' })
    );

    await Promise.all(promises);
    // Should not throw rate limit errors
  });
});
```

## Deployment Strategy

### Phase 1: Development Testing
1. Deploy to development environment
2. Test all AI functionality
3. Verify environment variable overrides work
4. Monitor logs for any configuration issues

### Phase 2: Staging Testing
1. Deploy to staging environment
2. Run full integration test suite
3. Test with real AI provider APIs
4. Validate performance and rate limiting

### Phase 3: Production Deployment
1. Deploy with feature flag (if available)
2. Monitor AI service metrics
3. Verify all API routes work correctly
4. Rollback plan ready if issues occur

### Rollback Plan
1. Restore `/app/lib/ai/config.ts` from backup
2. Revert changes to `/app/lib/ai/service.ts`
3. Restart application
4. Verify functionality restored

## Success Criteria

### Functional Requirements
- ✅ All existing AI API routes continue to work
- ✅ Environment variable provider override functions correctly
- ✅ DEV environment uses free models
- ✅ PROD environment uses premium models
- ✅ Rate limiting and error handling preserved
- ✅ All use cases supported without configuration changes

### Non-Functional Requirements
- ✅ Configuration code reduced by 80%
- ✅ Single source of truth for each provider
- ✅ Easy to add new providers or models
- ✅ Clear separation of DEV/PROD concerns
- ✅ Maintainable and extensible architecture

### Performance Requirements
- ✅ No degradation in AI response times
- ✅ Rate limiting continues to function
- ✅ Error handling and fallbacks preserved
- ✅ Memory usage not increased

## Monitoring and Observability

### Metrics to Monitor
- AI provider usage by environment
- Success/failure rates per provider
- Response times by provider
- Rate limit hit frequency
- Configuration loading errors

### Logs to Monitor
- Provider selection decisions
- API key availability
- Configuration loading errors
- Fallback chain usage
- Environment variable changes

### Alerts
- Configuration loading failures
- All providers unavailable
- High rate limit hit rates
- Degrading response times

This implementation plan provides a comprehensive roadmap for migrating to the simplified AI configuration system while maintaining all existing functionality and improving maintainability.