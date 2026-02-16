import { AIProvider, EnvironmentConfig, UseCase } from './';
import { openrouterConfig } from './providers/openrouter';
import { deepseekConfig } from './providers/deepseek';
import { groqConfig } from './providers/groq';
import { geminiConfig } from './providers/gemini';

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
  defaultMaxTokens: 4000,
  // Use-case-specific overrides for development
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
  }
};