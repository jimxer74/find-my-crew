export const geminiConfig = {
  dev: {
    models: ['gemini-2.5-flash', 'gemini-3-flash'],
    temperature: 0.3,
    maxTokens: 4000
  },
  prod: {
    models: ['gemini-2.5-pro', 'gemini-3-pro'],
    temperature: 0.3,
    maxTokens: 8000
  }
};