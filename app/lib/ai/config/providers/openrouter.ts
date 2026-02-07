export interface ProviderModelConfig {
  models: string[];
  temperature: number;
  maxTokens: number;
}

export const openrouterConfig = {
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