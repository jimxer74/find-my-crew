export interface ProviderModelConfig {
  models: string[];
  temperature: number;
  maxTokens: number;
}

export const openrouterConfig = {
  /*
  dev: {
    models: [
      'openrouter/free',
      'deepseek/deepseek-r1-0528:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'llama-3.1-8b-instant',
      'qwen/qwen-3-4b:free',
      'qwen/qwen-3-80b:free'
    ],
    temperature: 0.5,
    maxTokens: 4000
    
  },
*/
  dev: {
    models: [
    // First try any free models
    //'openrouter/free',
      // Then try some paid models
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'arcee-ai/trinity-mini',
    'openai/gpt-oss-120b:exacto',
    'qwen/qwen3-14b',
    'qwen/qwen3-30b-a3b',
    'openai/gpt-5-nano'

    ],
    temperature: 0.3,
    maxTokens: 8000
  },

  // Cheap models for PROD for now
  prod: {
    models: [
      // Try first some free models
    //'nousresearch/deephermes-3-mistral-24b-preview',
    //'qwen/qwen3-4b:free',
      // Then try some paid models
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'arcee-ai/trinity-mini',
    'openai/gpt-oss-120b:exacto',
    'qwen/qwen3-14b',
    'qwen/qwen3-30b-a3b',
    'openai/gpt-5-nano'
    ],
    temperature: 0.3,
    maxTokens: 8000
  },

  /* Premium models for real PROD
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
  }*/
};