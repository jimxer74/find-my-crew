/**
 * AI Provider and Model Configuration
 * 
 * This configuration allows you to specify preferred AI providers and models
 * for different use cases. The system will try providers/models in order
 * until one succeeds.
 */

export type AIProvider = 'deepseek' | 'groq' | 'gemini';

export type UseCase =
  | 'boat-details'           // Extracting comprehensive boat details
  | 'suggest-sailboats'      // Suggesting sailboat make/model names
  | 'generate-journey'       // Generating sailing journey plans
  | 'suggest-makers'         // Suggesting boat manufacturers
  | 'suggest-models'         // Suggesting boat models
  | 'assess-registration'    // Assessing crew member registration match for automated approval
  | 'generate-profile'       // Generating profile suggestions from Facebook data
  | 'assistant-chat';        // AI assistant conversational chat with tool calling

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
 * Configuration for each use case
 * Providers/models are tried in order until one succeeds
 */
export const AI_CONFIG: Record<UseCase, ModelConfig[]> = {
  'boat-details': [
    {
      provider: 'deepseek',
      models: ['deepseek-reasoner', 'deepseek-chat'],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'openai/gpt-oss-120b',
        'qwen/qwen3-32b',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
        'gemini-2.5-flash',
        'gemini-3-flash',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
  ],
  'suggest-sailboats': [
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'llama-3.1-70b-versatile',
        'qwen/qwen3-32b',
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
        'gemini-2.5-flash',
        'gemini-3-flash',
        'gemini-2.5-pro',
      ],
      temperature: 0.7,
      maxTokens: 500,
    },
  ],
  'generate-journey': [
    {
      provider: 'gemini',
      models: ['gemini-2.5-flash', 'gemini-3-flash'],
      temperature: 0.7,
      maxTokens: 20000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'openai/gpt-oss-120b',
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
  ],
  'suggest-makers': [
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
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
      models: ['gemini-2.5-flash', 'gemini-3-flash'],
      temperature: 0.7,
      maxTokens: 300,
    },
  ],
  'suggest-models': [
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
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
      models: ['gemini-2.5-flash', 'gemini-3-flash'],
      temperature: 0.7,
      maxTokens: 300,
    },
  ],
  'assess-registration': [
    {
      // Development: Use reasoning models for better assessment quality
      provider: 'deepseek',
      models: ['deepseek-reasoner', 'deepseek-chat'],
      temperature: 0.3, // Lower temperature for more consistent scoring
      maxTokens: 2000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'openai/gpt-oss-120b',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    {
      provider: 'gemini',
      models: [
        'gemini-2.5-pro',
        'gemini-3-pro',
        'gemini-2.5-flash',
      ],
      temperature: 0.3,
      maxTokens: 2000,
    },
    // Note: Production will use more sophisticated models (e.g., GPT-4, Claude Opus)
  ],
  'generate-profile': [
    {
      // Gemini first for profile generation - good at understanding context
      provider: 'gemini',
      models: [
        'gemini-2.5-flash',
        'gemini-3-flash',
        'gemini-2.5-pro',
      ],
      temperature: 0.5, // Balanced for creative but accurate suggestions
      maxTokens: 3000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'qwen/qwen3-32b',
      ],
      temperature: 0.5,
      maxTokens: 3000,
    },
    {
      provider: 'deepseek',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      temperature: 0.5,
      maxTokens: 3000,
    },
  ],
  'assistant-chat': [
    {
      // Gemini for conversational AI - good at chat, large context window
      provider: 'gemini',
      models: [
        'gemini-2.5-flash',
        'gemini-3-flash',
        'gemini-2.5-pro',
      ],
      temperature: 0.7, // Slightly creative for natural conversation
      maxTokens: 4000,
    },
    {
      provider: 'groq',
      models: [
        'llama-3.3-70b-versatile',
        'meta-llama/llama-4-scout-17b-16e-instruct',
        'qwen/qwen3-32b',
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
};

/**
 * Get API keys from environment variables
 */
export function getAPIKeys(): Record<AIProvider, string | undefined> {
  return {
    deepseek: process.env.DEEPSEEK_API_KEY,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GOOGLE_GEMINI_API_KEY,
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
