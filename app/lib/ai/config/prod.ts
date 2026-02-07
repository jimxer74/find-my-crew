import { AIProvider } from './';
import { openrouterConfig } from './providers/openrouter';
import { deepseekConfig } from './providers/deepseek';
import { groqConfig } from './providers/groq';
import { geminiConfig } from './providers/gemini';

interface AIProviderConfig {
  provider: AIProvider;
  models: string[];
  temperature: number;
  maxTokens: number;
}

interface EnvironmentConfig {
  providers: AIProviderConfig[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

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
  defaultMaxTokens: 8000
};