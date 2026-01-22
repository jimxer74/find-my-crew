/**
 * AI Service - Unified interface for calling AI providers
 * 
 * This service handles provider/model selection, API calls, and fallbacks
 * based on the configuration in config.ts
 */

import { AIProvider, UseCase, ModelConfig, AI_CONFIG, getAPIKeys, hasAnyProvider } from './config';

export interface AICallOptions {
  useCase: UseCase;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AICallResult {
  text: string;
  provider: AIProvider;
  model: string;
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public provider?: AIProvider,
    public model?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/**
 * Call DeepSeek API
 */
async function callDeepSeek(
  model: string,
  prompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new AIServiceError('DeepSeek API key not configured', 'deepseek');
  }

  // Create abort controller with 60 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIServiceError(
        `DeepSeek API error: ${errorData.error?.message || response.statusText}`,
        'deepseek',
        model,
        errorData
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new AIServiceError('DeepSeek returned empty response', 'deepseek', model);
    }

    return text;
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new AIServiceError(
        `DeepSeek API timeout after 60 seconds`,
        'deepseek',
        model,
        error
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Groq API
 */
async function callGroq(
  model: string,
  prompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AIServiceError('Groq API key not configured', 'groq');
  }

  // Create abort controller with 60 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AIServiceError(
        `Groq API error: ${errorData.error?.message || response.statusText}`,
        'groq',
        model,
        errorData
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new AIServiceError('Groq returned empty response', 'groq', model);
    }

    return text;
  } catch (error: any) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new AIServiceError(
        `Groq API timeout after 60 seconds`,
        'groq',
        model,
        error
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call Google Gemini API
 */
async function callGemini(
  model: string,
  prompt: string,
  temperature: number = 0.7,
  maxTokens: number = 1000
): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new AIServiceError('Google Gemini API key not configured', 'gemini');
  }

  // Try v1beta first, then v1
  const apiVersions = ['v1beta', 'v1'];
  
  for (const apiVersion of apiVersions) {
    // Create abort controller with 60 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        clearTimeout(timeoutId);
        // Try next API version if this one fails
        if (apiVersion === 'v1beta') {
          continue;
        }
        throw new AIServiceError(
          `Gemini API error: ${errorData.error?.message || response.statusText}`,
          'gemini',
          model,
          errorData
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      clearTimeout(timeoutId);
      if (text) {
        return text;
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      // Handle timeout errors
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        // If it's the last API version, throw timeout error
        if (apiVersion === 'v1') {
          throw new AIServiceError(
            `Gemini API timeout after 60 seconds`,
            'gemini',
            model,
            error
          );
        }
        // Otherwise continue to next API version
        continue;
      }
      // If it's the last API version, throw the error
      if (apiVersion === 'v1') {
        throw error;
      }
      // Otherwise continue to next API version
      continue;
    }
  }

  throw new AIServiceError('Gemini returned empty response', 'gemini', model);
}

/**
 * Call AI provider based on provider type
 */
async function callProvider(
  provider: AIProvider,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  switch (provider) {
    case 'deepseek':
      return callDeepSeek(model, prompt, temperature, maxTokens);
    case 'groq':
      return callGroq(model, prompt, temperature, maxTokens);
    case 'gemini':
      return callGemini(model, prompt, temperature, maxTokens);
    default:
      throw new AIServiceError(`Unknown provider: ${provider}`, provider);
  }
}

/**
 * Main function to call AI with automatic provider/model selection and fallback
 */
export async function callAI(options: AICallOptions): Promise<AICallResult> {
  const { useCase, prompt, temperature, maxTokens } = options;

  // Check if any provider is configured
  if (!hasAnyProvider()) {
    throw new AIServiceError(
      'No AI provider configured. Set DEEPSEEK_API_KEY, GROQ_API_KEY, or GOOGLE_GEMINI_API_KEY'
    );
  }

  // Get configuration for this use case
  const configs = AI_CONFIG[useCase];
  if (!configs || configs.length === 0) {
    throw new AIServiceError(`No configuration found for use case: ${useCase}`);
  }

  const errors: Array<{ provider: AIProvider; model: string; error: string }> = [];

  // Try each provider configuration in order
  for (const config of configs) {
    const apiKey = getAPIKeys()[config.provider];
    
    // Skip if provider doesn't have API key
    if (!apiKey) {
      console.log(`Skipping ${config.provider} - API key not configured`);
      continue;
    }

    // Try each model for this provider
    for (const model of config.models) {
      try {
        const finalTemperature = temperature ?? config.temperature ?? 0.7;
        const finalMaxTokens = maxTokens ?? config.maxTokens ?? 1000;

        console.log(`Trying ${config.provider}/${model} for use case: ${useCase}`);

        const text = await callProvider(
          config.provider,
          model,
          prompt,
          finalTemperature,
          finalMaxTokens
        );

        console.log(`Success with ${config.provider}/${model}`);
        
        return {
          text,
          provider: config.provider,
          model,
        };
      } catch (error: any) {
        const errorMessage = error instanceof AIServiceError 
          ? error.message 
          : error.message || 'Unknown error';
        
        console.log(`Failed ${config.provider}/${model}: ${errorMessage}`);
        errors.push({
          provider: config.provider,
          model,
          error: errorMessage,
        });
        // Continue to next model
        continue;
      }
    }
  }

  // If we get here, all providers/models failed
  throw new AIServiceError(
    `All AI providers failed for use case: ${useCase}. Errors: ${JSON.stringify(errors)}`
  );
}
