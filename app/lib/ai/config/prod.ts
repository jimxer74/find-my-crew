import { AIProvider, EnvironmentConfig, UseCase } from './';
import { openrouterConfig } from './providers/openrouter';
import { deepseekConfig } from './providers/deepseek';
import { groqConfig } from './providers/groq';
import { geminiConfig } from './providers/gemini';

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
  defaultMaxTokens: 8000,
  // Use-case-specific overrides for production
  useCaseOverrides: {
    // Premium models for conversational chat (better reasoning, tool calling)
    'owner-chat': {
      providers: [
        {
          provider: 'openrouter',
          models: ['openai/gpt-4o-mini'],
          temperature: 0.3,  // Lower temperature for more deterministic tool calls
          maxTokens: 8000
        }
      ],
      temperature: 0.3,  // Lower temperature for more deterministic tool calls
      maxTokens: 8000
    },
    'prospect-chat': {
      providers: [
        {
          provider: 'openrouter',
          models: ['openai/gpt-4o-mini'],
          temperature: 0.7,
          maxTokens: 6000
        }
      ],
      temperature: 0.7,
      maxTokens: 6000
    },
    // Cheaper models for simple extraction tasks
    'boat-details': {
      providers: [
        {
          provider: 'openrouter',
          models: ['openai/gpt-4o-mini'],
          temperature: 0.2,
          maxTokens: 4000
        }
      ],
      temperature: 0.2,
      maxTokens: 4000
    },
    // Fast, cheap models for suggestions
    'suggest-sailboats': {
      providers: [
        {
          provider: 'openrouter',
          models: ['openai/gpt-4o-mini'],
          temperature: 0.3,
          maxTokens: 2000
        }
      ],
      temperature: 0.3,
      maxTokens: 2000
    },
    // High-quality models for journey generation (complex reasoning)
    'generate-journey': {
      providers: [
        {
          provider: 'openrouter',
          // Use auto-mode to automatically select the best model based on the context
          models: ['openai/gpt-4o-mini'],
          temperature: 0.5,
          maxTokens: 20000
        }
      ],
      temperature: 0.5,
      maxTokens: 8000
    },
    // Simple models for assistant chat (complex reasoning)
    'assistant-chat': {
      providers: [
        {
          provider: 'openrouter',
          // Use auto-mode to automatically select the best model based on the context
          models: ['openai/gpt-4o-mini'],
          temperature: 0.5,
          maxTokens: 8000
        }
      ],
      temperature: 0.5,
      maxTokens: 8000
    },
    // Vision model for document classification (low temperature for deterministic extraction)
    'document-classification': {
      providers: [
        {
          provider: 'openrouter',
          models: ['google/gemini-2.0-flash-001'],
          temperature: 0.1,
          maxTokens: 1024
        }
      ],
      temperature: 0.1,
      maxTokens: 1024
    }

  },
  
};