import { devConfig } from './dev';
import { prodConfig } from './prod';

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
  | 'prospect-chat'          // AI chat for unauthenticated prospect users
  | 'owner-chat'             // AI chat for owner/skipper onboarding
  | 'general-conversation';  // General conversation fallback for intent classification

export interface AIProviderConfig {
  provider: AIProvider;
  models: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface EnvironmentConfig {
  providers: AIProviderConfig[];
  defaultTemperature: number;
  defaultMaxTokens: number;
}

/**
 * Get current environment (development or production)
 */
export function getCurrentEnvironment(): Environment {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

/**
 * Get configuration for current environment
 */
export function getAIConfig(): EnvironmentConfig {
  const env = getCurrentEnvironment();
  return getAIConfigForEnv(env);
}

/**
 * Get configuration for specific environment
 */
export function getAIConfigForEnv(env: 'development' | 'production'): EnvironmentConfig {
  return env === 'production' ? prodConfig : devConfig;
}

/**
 * Get provider-specific configuration for environment
 */
export function getProviderConfig(
  provider: AIProvider,
  env: 'development' | 'production'
): AIProviderConfig | null {
  const config = getAIConfigForEnv(env);
  return config.providers.find(p => p.provider === provider) || null;
}

/**
 * Check if any providers are configured
 */
export function hasAnyProvider(): boolean {
  const config = getAIConfig();
  return config.providers.length > 0;
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): AIProvider[] {
  const config = getAIConfig();
  return config.providers.map(p => p.provider);
}

/**
 * Get API keys for all configured providers
 */
export function getAPIKeys(): Record<AIProvider, string | undefined> {
  return {
    deepseek: process.env.DEEPSEEK_API_KEY,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GOOGLE_GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY
  };
}

/**
 * Check if a specific provider has an API key configured
 */
export function hasProviderAPIKey(provider: AIProvider): boolean {
  const keys = getAPIKeys();
  return !!keys[provider];
}

/**
 * Get environment-specific models for a provider
 */
export function getProviderModels(
  provider: AIProvider,
  env: 'development' | 'production' = getCurrentEnvironment()
): string[] {
  const config = getProviderConfig(provider, env);
  return config?.models || [];
}

/**
 * Get default configuration for environment with optional provider override
 */
export function getCurrentConfig(): EnvironmentConfig {
  const providerOverride = process.env.SAILSMART_LLM_PROVIDER as AIProvider | undefined;

  if (providerOverride) {
    return getProviderSpecificConfig(providerOverride);
  }

  return getAIConfig();
}

/**
 * Get configuration for specific provider only
 */
function getProviderSpecificConfig(provider: AIProvider): EnvironmentConfig {
  const env = getCurrentEnvironment();
  const providerConfig = getProviderConfig(provider, env);

  if (!providerConfig) {
    throw new Error(`Provider ${provider} not configured for environment ${env}`);
  }

  return {
    providers: [providerConfig],
    defaultTemperature: providerConfig.temperature || 0.5,
    defaultMaxTokens: providerConfig.maxTokens || 4000
  };
}