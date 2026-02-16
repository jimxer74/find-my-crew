/**
 * AI Document Classification Service
 *
 * Uses vision-capable AI to classify uploaded documents and extract metadata.
 * Routes through OpenRouter using the AI config system for model selection.
 * Privacy-first: one-shot API call, no document content stored in conversations.
 */

import type { DocumentClassificationResult, DocumentCategory } from '@/app/lib/documents/types';
import { getUseCaseConfig, getAIConfig, getAPIKeys } from '@/app/lib/ai/config';

const VALID_CATEGORIES: DocumentCategory[] = [
  'passport', 'drivers_license', 'national_id',
  'sailing_license', 'certification', 'insurance',
  'boat_registration', 'medical', 'other',
];

const CLASSIFICATION_SYSTEM_PROMPT = `You are a document classification assistant. Analyze the provided document image or PDF and:

1. Classify the document into one of these categories:
   - passport: National passport or travel document
   - drivers_license: Driving license / permit
   - national_id: National ID card or equivalent
   - sailing_license: Sailing qualification, skipper license, or boating license
   - certification: Professional certification (first aid, STCW, VHF radio, etc.)
   - insurance: Insurance policy or certificate (boat, travel, health, liability)
   - boat_registration: Boat registration, ownership certificate, or flag state document
   - medical: Medical certificate or fitness-to-sail document
   - other: Any document that doesn't fit the above categories

2. Extract metadata where visible:
   - document_number: The main identification number
   - holder_name: Full name of the document holder
   - expiry_date: Expiration date in YYYY-MM-DD format
   - issue_date: Issue date in YYYY-MM-DD format
   - issuing_authority: Organization/government that issued the document
   - issuing_country: ISO 3166-1 alpha-2 country code (e.g., US, GB, FI)

3. Provide a confidence score (0.0-1.0) for the classification.

Respond ONLY with valid JSON in this exact format:
{
  "category": "<category>",
  "subcategory": "<more specific type or null>",
  "confidence": <0.0-1.0>,
  "extracted_metadata": {
    "document_number": "<number or null>",
    "holder_name": "<name or null>",
    "expiry_date": "<YYYY-MM-DD or null>",
    "issue_date": "<YYYY-MM-DD or null>",
    "issuing_authority": "<authority or null>",
    "issuing_country": "<XX or null>"
  }
}

If you cannot determine a field, set it to null. Do not include any text outside the JSON.`;

/**
 * Get model configuration for document classification from the AI config system.
 */
function getClassificationConfig() {
  const useCaseConfig = getUseCaseConfig('document-classification');
  const envConfig = getAIConfig();

  const providers = useCaseConfig?.providers || envConfig.providers;
  const temperature = useCaseConfig?.temperature ?? envConfig.defaultTemperature;
  const maxTokens = useCaseConfig?.maxTokens ?? envConfig.defaultMaxTokens;

  return { providers, temperature, maxTokens };
}

/**
 * Classify a document using a vision-capable AI model via OpenRouter.
 *
 * Uses the AI config system ('document-classification' use case) for model selection.
 * Sends multimodal content (text + image) through OpenRouter's API.
 *
 * @param fileBase64 - Base64-encoded file content
 * @param mimeType - MIME type of the file (image/jpeg, image/png, application/pdf, etc.)
 * @returns Classification result with category, confidence, and extracted metadata
 */
export async function classifyDocument(
  fileBase64: string,
  mimeType: string
): Promise<DocumentClassificationResult> {
  const { providers, temperature, maxTokens } = getClassificationConfig();
  const apiKeys = getAPIKeys();

  const errors: Array<{ provider: string; model: string; error: string }> = [];

  for (const providerConfig of providers) {
    const apiKey = apiKeys[providerConfig.provider];
    if (!apiKey) {
      console.log(`[document-classification] Skipping ${providerConfig.provider} - no API key`);
      continue;
    }

    for (const model of providerConfig.models) {
      try {
        console.log(`[document-classification] Trying ${providerConfig.provider}/${model}`);

        const finalTemperature = providerConfig.temperature ?? temperature;
        const finalMaxTokens = providerConfig.maxTokens ?? maxTokens;

        const result = await callVisionAPI(
          providerConfig.provider,
          apiKey,
          model,
          fileBase64,
          mimeType,
          finalTemperature,
          finalMaxTokens,
        );

        console.log(`[document-classification] Success with ${providerConfig.provider}/${model}`);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.log(`[document-classification] Failed ${providerConfig.provider}/${model}: ${message}`);
        errors.push({ provider: providerConfig.provider, model, error: message });
      }
    }
  }

  throw new Error(
    `All providers failed for document-classification. Errors: ${JSON.stringify(errors)}`
  );
}

/**
 * Call a vision-capable model via OpenRouter's multimodal API.
 */
async function callVisionAPI(
  provider: string,
  apiKey: string,
  model: string,
  fileBase64: string,
  mimeType: string,
  temperature: number,
  maxTokens: number,
): Promise<DocumentClassificationResult> {
  // OpenRouter uses OpenAI-compatible multimodal format
  const dataUrl = `data:${mimeType};base64,${fileBase64}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://www.sailsm.art',
      'X-Title': 'SailSmart',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CLASSIFICATION_SYSTEM_PROMPT },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider} API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`${provider}/${model} returned empty response`);
  }

  const parsed = JSON.parse(text) as DocumentClassificationResult;

  // Validate and sanitize the result
  if (!VALID_CATEGORIES.includes(parsed.category)) {
    parsed.category = 'other';
  }

  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0));
  parsed.subcategory = parsed.subcategory || null;
  parsed.extracted_metadata = parsed.extracted_metadata || {};

  return parsed;
}
