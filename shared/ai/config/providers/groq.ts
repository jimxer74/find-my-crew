export const groqConfig = {
  dev: {
    models: ['llama-3.1-8b', 'llama-3.3-70b', 'qwen-3-32b'],
    temperature: 0.3,
    maxTokens: 4000
  },
  prod: {
    models: ['llama-4-scout-17b-16e-instruct', 'llama-3.3-70b'],
    temperature: 0.3,
    maxTokens: 8000
  }
};