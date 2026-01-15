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

## Configuration

### Provider Priority

For each use case, you can configure the order of providers and models to try. The system will:

1. Try providers in the order specified in `AI_CONFIG`
2. For each provider, try models in order until one succeeds
3. Automatically fall back to the next provider/model if one fails

### Example Configuration

```typescript
'boat-details': [
  {
    provider: 'deepseek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    temperature: 0.3,
    maxTokens: 2000,
  },
  {
    provider: 'groq',
    models: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
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

To change provider/model preferences for a use case, edit `app/lib/ai/config.ts`:

1. Find the use case in `AI_CONFIG`
2. Reorder providers/models as needed
3. Adjust `temperature` and `maxTokens` per provider if needed

The system will automatically use your new configuration on the next request.

## Environment Variables

Make sure to set at least one of these in your `.env.local`:

- `DEEPSEEK_API_KEY` - For DeepSeek API
- `GROQ_API_KEY` - For Groq API (free tier available)
- `GOOGLE_GEMINI_API_KEY` - For Google Gemini API

## Benefits

1. **Centralized Configuration**: All AI provider/model preferences in one place
2. **Easy Customization**: Change preferences without touching route code
3. **Automatic Fallbacks**: System handles provider failures gracefully
4. **Type Safety**: Full TypeScript support with proper types
5. **Use Case Optimization**: Different models for different tasks
