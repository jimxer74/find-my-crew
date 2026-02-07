/**
 * AI Provider and Model Configuration
 *
 * This configuration allows you to specify preferred AI providers and models
 * for different use cases. The system will try providers/models in order
 * until one succeeds.
 *
 * Supports both development and production configurations with different model priorities
 * and cost considerations.
 */

export type AIProvider = 'deepseek' | 'groq' | 'gemini' | 'openrouter';
export type Environment = 'development' | 'production';

export type UseCase =
  | 'boat-details'           // Extracting comprehensive boat details
  | 'boat-suggestions'       // Suggesting boat options
  | 'suggest-sailboats'      // Suggesting sailboat make/model names
  | 'profile-generation'     // Generating user profiles
  | 'generate-journey'       // Generating sailing journey plans
  | 'suggest-makers'         // Suggesting boat manufacturers
  | 'suggest-models'         // Suggesting boat models
  | 'assess-registration'    // Assessing crew member registration match for automated approval
  | 'generate-profile'       // Generating profile suggestions from Facebook data
  | 'assistant-chat'         // AI assistant conversational chat with tool calling
  | 'assistant-system'       // System-level assistant configuration
  | 'general-conversation';  // General conversation fallback for intent classification

export interface ModelConfig {
  provider: AIProvider;
  models: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface UseCaseConfig {
  useCase: UseCase;
  preferredProviders: ModelConfig[];
}

/**
 * Get current environment - development by default, production when NODE_ENV=production
 */
export function getCurrentEnvironment(): Environment {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * Development configuration - prioritizes free/low-cost models for testing
 */
export const DEV_AI_CONFIG: Record<UseCase, ModelConfig[]> = {
  'boat-details': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-reasoner', 'deepseek-chat'],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'boat-suggestions': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.7,
      maxTokens: 500,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
  ],
  'profile-generation': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
  ],
  'suggest-sailboats': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.7,
      maxTokens: 500,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
  ],
  'generate-journey': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-flash', 'gemini-3-flash'], // Free tier models
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
      ],
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'deepseek',
      models: [
        'deepseek-reasoner', 'deepseek-chat'
      ],
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 20000,
    },
  ],
  'suggest-makers': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-flash', 'gemini-3-flash'], // Free tier models
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
  ],
  'suggest-models': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-flash', 'gemini-3-flash'], // Free tier models
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
  ],
  'assess-registration': [
    {
      provider: 'openrouter',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-reasoner', 'deepseek-chat'],
      temperature: 0.3, // Lower temperature for more consistent scoring
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'generate-profile': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/claude-sonnet-4-5', // Premium model
        'deepseek/deepseek-r1-0528:free',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.5, // Balanced for creative but accurate suggestions
      maxTokens: 10000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
  ],
  'assistant-chat': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/claude-sonnet-4-5', // Premium model
        'openrouter/free',
        'deepseek/deepseek-r1-0528:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
        'meta-llama/llama-guard-4-12b', // Moderation
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.7, // Slightly creative for natural conversation
      maxTokens: 4000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
  ],
  'assistant-system': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/claude-sonnet-4-5', // Premium model
        'openrouter/free',
        'deepseek/deepseek-r1-0528:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'general-conversation': [
    {
      provider: 'openrouter',
      models: [
        'openrouter/free',
        'deepseek/deepseek-r1-0528:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen3-4b:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.1-8b-instant', // Free tier model
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-flash', // Free tier model
        'gemini-3-flash',
      ],
      temperature: 0.7,
      maxTokens: 500,
    },
    {
      provider: 'openrouter',
      models: [
        'openai/gpt-4o-mini', // Cost-effective model
        'anthropic/claude-haiku', // Free tier model
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
  ],
};

/**
 * Production configuration - prioritizes high-quality, sophisticated models
 */
export const PROD_AI_CONFIG: Record<UseCase, ModelConfig[]> = {
  'boat-details': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
        'anthropic/opus-20250409', // Premium model
        'google/gemini-2.5-pro-exp', // Premium model
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-reasoner', 'deepseek-chat'],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'boat-suggestions': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-pro', 'gemini-3-pro'],
      temperature: 0.7,
      maxTokens: 500,
    },
  ],
  'profile-generation': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model for creativity
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
        'google/gemini-2.5-pro-exp', // Premium model
      ],
      temperature: 0.6, // Higher temperature for creative suggestions
      maxTokens: 10000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.5,
      maxTokens: 10000,
    },
  ],
  'suggest-sailboats': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
        'google/gemini-2.5-pro-exp', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.7,
      maxTokens: 500,
    },
  ],
  'generate-journey': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model with largest context
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
        'google/gemini-2.5-pro-exp', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'openai/gpt-oss-120b',
      ],
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-pro', 'gemini-3-pro'],
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'deepseek',
      models: [
        'deepseek-reasoner', 'deepseek-chat'
      ],
      temperature: 0.7,
      maxTokens: 20000,
    },
  ],
  'suggest-makers': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-pro', 'gemini-3-pro'],
      temperature: 0.7,
      maxTokens: 300,
    },
  ],
  'suggest-models': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
      ],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat'],
      temperature: 0.7,
      maxTokens: 300,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-pro', 'gemini-3-pro'],
      temperature: 0.7,
      maxTokens: 300,
    },
  ],
  'assess-registration': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium reasoning model
        'anthropic/claude-sonnet-4-5', // Premium reasoning model
        'openai/gpt-4o', // Premium reasoning model
        'google/gemini-2.5-pro-exp', // Premium reasoning model
      ],
      temperature: 0.2, // Lower temperature for more consistent scoring
      maxTokens: 2000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-reasoner', 'deepseek-chat'],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'generate-profile': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model for creativity
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
        'google/gemini-2.5-pro-exp', // Premium model
      ],
      temperature: 0.6, // Higher temperature for creative suggestions
      maxTokens: 10000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
      ],
      temperature: 0.5,
      maxTokens: 10000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.5,
      maxTokens: 10000,
    },
  ],
  'assistant-chat': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model for complex conversations
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
        'google/gemini-2.5-pro-exp', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'meta-llama/llama-4-maverick-17b-128e-instruct',
        'llama-3.3-70b-versatile',
        'qwen/qwen3-32b',
        'meta-llama/llama-guard-4-12b', // Moderation
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.7,
      maxTokens: 4000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.7,
      maxTokens: 4000,
    },
  ],
  'assistant-system': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'general-conversation': [
    {
      provider: 'openrouter',
      models: [
        'anthropic/opus-20250409', // Premium model
        'anthropic/claude-sonnet-4-5', // Premium model
        'openai/gpt-4o', // Premium model
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'groq',
      models: [
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
      ],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.7,
      maxTokens: 1000,
    },
    {
      provider: 'gemini',
      models: ['gemini-2.5-pro', 'gemini-3-pro'],
      temperature: 0.7,
      maxTokens: 500,
    },
  ],
};

/**
 * Get configuration for current environment
 */
export function getAIConfig(): Record<UseCase, ModelConfig[]> {
  const env = getCurrentEnvironment();
  return env === 'production' ? PROD_AI_CONFIG : DEV_AI_CONFIG;
}

/**
 * Get configuration for specific environment
 */
export function getAIConfigForEnv(env: Environment): Record<UseCase, ModelConfig[]> {
  return env === 'production' ? PROD_AI_CONFIG : DEV_AI_CONFIG;
}

/**
 * Configuration for each use case (backward compatibility)
 * @deprecated Use getAIConfig() instead for environment-aware configuration
 */
export const AI_CONFIG: Record<UseCase, ModelConfig[]> = getAIConfig();

/**
 * Get API keys from environment variables
 */
export function getAPIKeys(): Record<AIProvider, string | undefined> {
  return {
    deepseek: process.env.DEEPSEEK_API_KEY,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GOOGLE_GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
}

/**
 * Check if at least one AI provider is configured
 */
export function hasAnyProvider(): boolean {
  const keys = getAPIKeys();
  return !!(keys.deepseek || keys.groq || keys.gemini);
}

/**
 * Get available providers (those with API keys configured)
 */
export function getAvailableProviders(): AIProvider[] {
  const keys = getAPIKeys();
  return (Object.keys(keys) as AIProvider[]).filter(
    (provider) => keys[provider]
  );
}
