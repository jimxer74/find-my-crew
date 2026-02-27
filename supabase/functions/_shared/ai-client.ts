/**
 * Unified AI client for Edge Function handlers.
 *
 * Wraps OpenRouter so handlers can specify per-use-case settings:
 *   model, maxTokens, temperature, systemPrompt, webSearch.
 *
 * OpenRouter supports 200+ models — handlers just pass the model string.
 * See https://openrouter.ai/models for available model IDs.
 */

// ---------------------------------------------------------------------------
// Options — every field is optional; sensible defaults are applied
// ---------------------------------------------------------------------------

export interface AICallOptions {
  /** OpenRouter model ID. Default: 'openai/gpt-4o-mini' */
  model?: string;

  /** Maximum tokens in the completion. Default: 10000 */
  maxTokens?: number;

  /** Sampling temperature 0–2. Default: 0.5 */
  temperature?: number;

  /** Optional system prompt prepended to the conversation */
  systemPrompt?: string;

  /**
   * Enable OpenRouter web search plugin.
   * Useful for use cases that need real-world or up-to-date information.
   * Default: false
   */
  webSearch?: boolean;

  /**
   * Number of web search results to include when webSearch is true.
   * Default: 5
   */
  webSearchMaxResults?: number;
}

// ---------------------------------------------------------------------------
// callAI — the only function handlers need to import from this module
// ---------------------------------------------------------------------------

export async function callAI(
  prompt: string,
  options: AICallOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const {
    model = 'openai/gpt-4o-mini',
    maxTokens = 10000,
    temperature = 0.5,
    systemPrompt,
    webSearch = false,
    webSearchMaxResults = 5,
  } = options;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (webSearch) {
    body.plugins = [{ id: 'web', max_results: webSearchMaxResults }];
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
