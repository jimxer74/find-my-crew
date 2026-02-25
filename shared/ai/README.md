# AI Service Configuration

This directory contains a configurable AI service system that allows you to specify preferred AI providers and models for different use cases.

## Architecture

### Files

- **`config.ts`**: Defines use cases, provider preferences, and model configurations
- **`service.ts`**: Implements the unified AI service that handles provider/model selection and API calls

## Use Cases

The system supports the following use cases:

1. **`boat-details`**: Extracting comprehensive boat details from make/model
2. **`suggest-sailboats`**: Suggesting sailboat make/model names
3. **`generate-journey`**: Generating sailing journey plans
4. **`suggest-makers`**: Suggesting boat manufacturers
5. **`suggest-models`**: Suggesting boat models

## Development vs Production Configuration

The system supports environment-specific configurations to optimize costs and performance:

### Environment Detection

- **Development**: `NODE_ENV !== 'production'` (default)
- **Production**: `NODE_ENV === 'production'`

### Development Configuration

Prioritizes free and low-cost models for testing and development:

- **OpenRouter**: `openrouter/free` (primary free tier model)
- **Groq**: `llama-3.1-8b-instant` (free tier)
- **Gemini**: `gemini-2.5-flash`, `gemini-3-flash` (free tier)
- **OpenRouter**: `openai/gpt-4o-mini`, `anthropic/claude-haiku` (cost-effective fallbacks)

### Production Configuration

Prioritizes high-quality, sophisticated models for production use:

- **OpenRouter**: `anthropic/opus-20250409`, `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`
- **Groq**: `meta-llama/llama-4-scout-17b-16e-instruct`
- **Gemini**: `gemini-2.5-pro`, `gemini-3-pro`

### Configuration Functions

```typescript
import {
  getAIConfig,
  getAIConfigForEnv,
  getCurrentEnvironment
} from '@/app/lib/ai/config';

// Get config for current environment
const currentConfig = getAIConfig();

// Get config for specific environment
const devConfig = getAIConfigForEnv('development');
const prodConfig = getAIConfigForEnv('production');

// Check current environment
const env = getCurrentEnvironment(); // 'development' | 'production'
```

## Configuration

### Provider Priority

For each use case, you can configure the order of providers and models to try. The system will:

1. Try providers in the order specified in the environment config
2. For each provider, try models in order until one succeeds
3. Automatically fall back to the next provider/model if one fails

### Example Configuration

```typescript
// Development configuration (cost-optimized)
'boat-details': [
  {
    provider: 'openrouter',
    models: ['openrouter/free'], // Primary free tier
    temperature: 0.3,
    maxTokens: 2000,
  },
  {
    provider: 'deepseek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    temperature: 0.3,
    maxTokens: 2000,
  },
  {
    provider: 'groq',
    models: ['llama-3.1-8b-instant'], // Free tier
    temperature: 0.3,
    maxTokens: 2000,
  },
  // ... more providers
]

// Production configuration (quality-optimized)
'boat-details': [
  {
    provider: 'groq',
    models: ['meta-llama/llama-4-scout-17b-16e-instruct'],
    temperature: 0.3,
    maxTokens: 2000,
  },
  {
    provider: 'openrouter',
    models: ['anthropic/opus-20250409', 'anthropic/claude-sonnet-4-5'], // Premium
    temperature: 0.3,
    maxTokens: 2000,
  },
  // ... more providers
]
```

### Supported Providers

- **`deepseek`**: DeepSeek API (requires `DEEPSEEK_API_KEY`)
- **`groq`**: Groq API (requires `GROQ_API_KEY`)
- **`gemini`**: Google Gemini API (requires `GOOGLE_GEMINI_API_KEY`)
- **`openrouter`**: OpenRouter.ai API (requires `OPENROUTER_API_KEY`)

## Usage

### In API Routes

```typescript
import { callAI, AIServiceError } from '@/app/lib/ai/service';

// In your route handler
try {
  const result = await callAI({
    useCase: 'boat-details',
    prompt: 'Your prompt here',
    // Optional: override temperature or maxTokens
    temperature: 0.5,
    maxTokens: 1500,
  });

  console.log(`Success with ${result.provider}/${result.model}`);
  const text = result.text;
  // Process the response...
} catch (error) {
  if (error instanceof AIServiceError) {
    console.error(`Failed with ${error.provider}/${error.model}`);
  }
  // Handle error...
}
```

## Customizing Configuration

### For Development Environment

To change provider/model preferences for development:

1. Edit `DEV_AI_CONFIG` in `app/lib/ai/config.ts`
2. Reorder providers/models to prioritize free/low-cost options
3. By default, `openrouter/free` is now prioritized first for all use cases
4. Use other free tier models like `llama-3.1-8b-instant`, `gemini-2.5-flash`, `claude-haiku`

### For Production Environment

To change provider/model preferences for production:

1. Edit `PROD_AI_CONFIG` in `app/lib/ai/config.ts`
2. Reorder providers/models to prioritize high-quality options
3. Use premium models like `anthropic/opus-20250409`, `gpt-4o`, `gemini-2.5-pro-exp`

### Environment-Aware Configuration

The system automatically selects the appropriate configuration based on `NODE_ENV`:

```typescript
// In development (NODE_ENV !== 'production')
// Uses DEV_AI_CONFIG with openrouter/free prioritized first, then other free/low-cost models

// In production (NODE_ENV === 'production')
// Uses PROD_AI_CONFIG with premium models
```

## Environment Variables

Make sure to set at least one of these in your `.env.local`:

- `DEEPSEEK_API_KEY` - For DeepSeek API
- `GROQ_API_KEY` - For Groq API (free tier available)
- `GOOGLE_GEMINI_API_KEY` - For Google Gemini API
- `OPENROUTER_API_KEY` - For OpenRouter.ai API

## Benefits

1. **Cost Optimization**: Development uses openrouter/free first, then free/low-cost models, production uses premium models
2. **Environment Awareness**: Automatic configuration selection based on `NODE_ENV`
3. **Centralized Configuration**: All AI provider/model preferences in one place
4. **Easy Customization**: Change preferences without touching route code
5. **Automatic Fallbacks**: System handles provider failures gracefully
6. **Type Safety**: Full TypeScript support with proper types
7. **Use Case Optimization**: Different models for different tasks
8. **Scalable Architecture**: Easy to add new environments or configurations
