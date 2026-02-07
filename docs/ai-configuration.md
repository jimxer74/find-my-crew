# AI Configuration System Documentation

## Overview

The simplified AI Configuration System provides a clean, maintainable approach to managing AI model configurations across development and production environments. This system replaces the complex use-case-specific configurations with environment-based defaults and optional provider overrides.

## Architecture

### Configuration Structure

```
/app/lib/ai/config/
├── index.ts              # Main configuration loader
├── dev.ts                # Development environment configuration
├── prod.ts               # Production environment configuration
└── providers/           # Provider-specific model configurations
    ├── deepseek.ts
    ├── groq.ts
    ├── gemini.ts
    └── openrouter.ts
```

### Configuration Types

```typescript
interface AIProviderConfig {
  provider: AIProvider;        // 'deepseek' | 'groq' | 'gemini' | 'openrouter'
  models: string[];           // Array of model names for fallback
  temperature?: number;       // Default temperature (0.0 - 1.0)
  maxTokens?: number;         // Default max tokens
}

interface EnvironmentConfig {
  providers: AIProviderConfig[];  // Ordered list of providers (fallback chain)
  defaultTemperature: number;     // Default temperature for unspecified providers
  defaultMaxTokens: number;       // Default max tokens for unspecified providers
}
```

## Environment Configurations

### Development Environment (`/app/lib/ai/config/dev.ts`)

Prioritizes free and low-cost models for testing and development:

```typescript
const devConfig: EnvironmentConfig = {
  providers: [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'llama-3.1-8b-instant'
      ],
      temperature: 0.5,
      maxTokens: 4000
    },
    {
      provider: 'deepseek',
      models: ['deepseek-r1', 'deepseek-chat'],
      temperature: 0.3,
      maxTokens: 4000
    },
    {
      provider: 'groq',
      models: ['llama-3.1-8b', 'llama-3.3-70b', 'qwen-3-32b'],
      temperature: 0.3,
      maxTokens: 4000
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-flash', 'gemini-3-flash'],
      temperature: 0.3,
      maxTokens: 4000
    }
  ],
  defaultTemperature: 0.5,
  defaultMaxTokens: 4000
};
```

### Production Environment (`/app/lib/ai/config/prod.ts`)

Prioritizes premium, high-quality models for optimal results:

```typescript
const prodConfig: EnvironmentConfig = {
  providers: [
    {
      provider: 'openrouter',
      models: [
        'anthropic/claude-sonnet-4-5',
        'openai/gpt-4o',
        'anthropic/opus-20250409',
        'google/gemini-2.5-pro-exp'
      ],
      temperature: 0.3,
      maxTokens: 8000
    },
    {
      provider: 'groq',
      models: [
        'llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b'
      ],
      temperature: 0.3,
      maxTokens: 8000
    },
    {
      provider: 'deepseek',
      models: ['deepseek-r1', 'deepseek-chat'],
      temperature: 0.3,
      maxTokens: 8000
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-pro', 'gemini-3-pro'],
      temperature: 0.3,
      maxTokens: 8000
    }
  ],
  defaultTemperature: 0.3,
  defaultMaxTokens: 8000
};
```

## Provider-Specific Configurations

Each provider has its own configuration file that defines appropriate models for each environment:

### OpenRouter (`/app/lib/ai/config/providers/openrouter.ts`)

```typescript
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

## Environment Variable Provider Selection

### Configuration Override

Set the `SAILSMART_LLM_PROVIDER` environment variable to use only a specific provider:

```bash
# Use only OpenRouter models
export SAILSMART_LLM_PROVIDER=openrouter

# Use only DeepSeek models
export SAILSMART_LLM_PROVIDER=deepseek

# Use default environment configuration (no override)
# (SAILSMART_LLM_PROVIDER not set)
```

### Behavior

- **When set**: The system uses only the specified provider with environment-appropriate models
- **When not set**: The system uses the default provider chain for the current environment
- **Fallback**: If the specified provider is unavailable, the system will fail rather than fall back

## Usage Examples

### Basic AI Call

```typescript
import { callAI } from '@/lib/ai/service';

// Uses default configuration for current environment
const result = await callAI({
  useCase: 'boat-details',
  prompt: 'Extract boat details from this text...'
});
```

### Custom Parameters

```typescript
// Override default temperature and maxTokens
const result = await callAI({
  useCase: 'generate-journey',
  prompt: 'Generate a sailing journey...',
  temperature: 0.7,
  maxTokens: 15000
});
```

### Provider-Specific Usage

```bash
# In .env.local for development
SAILSMART_LLM_PROVIDER=openrouter
```

```typescript
// Will only use OpenRouter models, appropriate for DEV environment
const result = await callAI({
  useCase: 'profile-generation',
  prompt: 'Generate user profile...'
});
```

## Configuration Helpers

### Environment Detection

```typescript
import { getCurrentEnvironment, getAIConfig } from '@/lib/ai/config';

// Get current environment ('development' or 'production')
const env = getCurrentEnvironment();

// Get configuration for current environment
const config = getAIConfig();

// Get configuration for specific environment
const devConfig = getAIConfigForEnv('development');
```

### Provider Availability

```typescript
import { hasAnyProvider, getAvailableProviders } from '@/lib/ai/config';

// Check if at least one provider is configured
if (hasAnyProvider()) {
  console.log('AI providers available');
}

// Get list of configured providers
const availableProviders = getAvailableProviders();
console.log('Available providers:', availableProviders);
```

## Migration Guide

### From Use Case Specific Configurations

**Before (Complex):**
```typescript
// 1,000+ lines of use-case-specific configurations
const boatDetailsConfig = {
  useCase: 'boat-details',
  preferredProviders: [
    { provider: 'openrouter', models: [...], temperature: 0.7, maxTokens: 4000 },
    // ... 4-5 more provider configurations per use case
  ]
};
```

**After (Simplified):**
```typescript
// Single environment configuration
const devConfig = {
  providers: [
    { provider: 'openrouter', models: [...], temperature: 0.5, maxTokens: 4000 },
    // ... 3-4 provider configurations total
  ],
  defaultTemperature: 0.5,
  defaultMaxTokens: 4000
};
```

### API Compatibility

All existing API routes and functions continue to work without changes:

```typescript
// These continue to work exactly as before
await callAI({ useCase: 'boat-details', prompt: '...' });
await callAI({ useCase: 'generate-journey', prompt: '...' });
await callAI({ useCase: 'profile-generation', prompt: '...' });
```

## Environment Setup

### Required Environment Variables

```bash
# API Keys (at least one required)
DEEPSEEK_API_KEY=your_deepseek_key
GROQ_API_KEY=your_groq_key
GOOGLE_GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional: Provider override
SAILSMART_LLM_PROVIDER=openrouter  # or deepseek, groq, gemini

# Application URL (for OpenRouter headers)
NEXT_PUBLIC_APP_URL=https://sailsm.art
```

### Development Setup

```bash
# .env.development
DEEPSEEK_API_KEY=sk-your-dev-key
OPENROUTER_API_KEY=your-openrouter-key
SAILSMART_LLM_PROVIDER=deepseek  # Optional: test specific provider
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production Setup

```bash
# .env.production
DEEPSEEK_API_KEY=sk-your-prod-key
GROQ_API_KEY=your-groq-key
OPENROUTER_API_KEY=your-openrouter-key
# SAILSMART_LLM_PROVIDER=  # Optional: use default production config
NEXT_PUBLIC_APP_URL=https://sailsm.art
```

## Troubleshooting

### Common Issues

1. **No providers configured**
   - Ensure at least one API key environment variable is set
   - Check that `hasAnyProvider()` returns true

2. **Provider-specific errors**
   - Verify API keys are valid and have sufficient credits
   - Check rate limits for the specific provider

3. **Environment variable not working**
   - Ensure `SAILSMART_LLM_PROVIDER` is set to a valid provider name
   - Restart the application after changing environment variables

### Debug Logging

Enable debug logging to troubleshoot configuration issues:

```typescript
// In development, errors include detailed provider information
try {
  const result = await callAI({ useCase: 'boat-details', prompt: '...' });
} catch (error) {
  console.error('AI call failed:', error);
  // Error includes: provider, model, original error details
}
```

## Performance Considerations

### Rate Limiting

The system includes built-in rate limiting per provider and use case:

- **Per-provider limits**: 120 requests per 60 seconds (configurable)
- **Use case limits**: Separate limits per use case
- **Exponential backoff**: Automatic retry with delays on rate limit errors
- **Timeout handling**: 60-second timeout per AI call

### Model Selection

- **Free models first**: In development, free models are prioritized
- **Quality first**: In production, premium models are prioritized
- **Fallback chain**: If primary model fails, system tries next model in list
- **Provider fallback**: If provider is unavailable, system tries next provider

## Future Extensions

### Adding New Providers

1. Create provider configuration file: `/app/lib/ai/config/providers/newprovider.ts`
2. Add provider to environment configurations in `dev.ts` and `prod.ts`
3. Update `AIProvider` type if needed
4. Implement provider-specific API calls in `/app/lib/ai/service.ts`

### Adding New Use Cases

No configuration changes needed - new use cases automatically inherit the environment configuration:

```typescript
// Just use it - no configuration required
const result = await callAI({
  useCase: 'new-use-case',  // Will use default environment configuration
  prompt: '...'
});
```

## Monitoring and Observability

### Metrics

The system tracks:

- **Provider usage**: Which providers are being used most
- **Success rates**: Success/failure rates per provider
- **Response times**: Average response times per provider
- **Rate limit hits**: How often rate limits are encountered

### Logs

Detailed logging includes:

- **Provider selection**: Which provider/model was selected
- **API responses**: Success/failure with error details
- **Rate limiting**: Rate limit hits and retry attempts
- **Configuration**: Active configuration being used

This documentation provides a comprehensive guide to the simplified AI configuration system, making it easy to understand, maintain, and extend.