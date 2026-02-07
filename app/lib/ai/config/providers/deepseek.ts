export const deepseekConfig = {
  dev: {
    models: ['deepseek-r1', 'deepseek-chat'],
    temperature: 0.3,
    maxTokens: 4000
  },
  prod: {
    models: ['deepseek-r1', 'deepseek-chat'],
    temperature: 0.3,
    maxTokens: 8000
  }
};