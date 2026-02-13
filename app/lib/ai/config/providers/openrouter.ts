export interface ProviderModelConfig {
  models: string[];
  temperature: number;
  maxTokens: number;
}

export const openrouterConfig = {
  // Cheap models for DEV for now
  dev: {
    models: [
    'arcee-ai/trinity-mini',
    'openai/gpt-oss-120b:exacto',
    'openai/gpt-4o-mini',
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
      // Then try some paid models
      'arcee-ai/trinity-mini',
      'openai/gpt-oss-120b:exacto',
      'openai/gpt-4o-mini',
      'qwen/qwen3-14b',
      'qwen/qwen3-30b-a3b',
      'openai/gpt-5-nano'
      ],
    temperature: 0.3,
    maxTokens: 8000
  },

};