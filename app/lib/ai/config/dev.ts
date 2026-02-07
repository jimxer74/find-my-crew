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
  defaultMaxTokens: 4000
};