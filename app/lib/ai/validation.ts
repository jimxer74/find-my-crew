/**
 * AI Input Validation and Sanitization
 *
 * Provides functions to validate and sanitize user inputs before sending to AI models.
 * Helps prevent prompt injection and ensures safe, bounded inputs.
 */

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

// Maximum lengths for different input types
export const MAX_INPUT_LENGTHS = {
  shortText: 200, // Names, titles
  mediumText: 1000, // Descriptions, notes
  longText: 5000, // Detailed content
  prompt: 10000, // AI prompts
  coordinate: 20, // Coordinate strings
};

// Patterns that could indicate prompt injection attempts
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now\s+a/i,
  /new\s+(instructions?|persona|role)/i,
  /system\s*:\s*/i,
  /\[\[.*\]\]/g, // Markdown-style injection attempts
  /\{\{.*\}\}/g, // Template injection attempts
  /<\s*script/i, // Script tags
  /javascript\s*:/i, // JavaScript protocol
  /data\s*:/i, // Data URIs
  /eval\s*\(/i, // Eval function
  /exec\s*\(/i, // Exec function
];

/**
 * Sanitize text input by removing potentially harmful content
 */
export function sanitizeText(input: string, maxLength: number = MAX_INPUT_LENGTHS.mediumText): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength);

  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize unicode (prevents homograph attacks)
  sanitized = sanitized.normalize('NFKC');

  return sanitized;
}

/**
 * Check if text contains suspicious patterns that could be prompt injection
 */
export function containsSuspiciousPatterns(input: string): boolean {
  if (!input) return false;

  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Validate and sanitize a short text input (names, titles)
 */
export function validateShortText(input: string, fieldName: string = 'input'): ValidationResult {
  const sanitized = sanitizeText(input, MAX_INPUT_LENGTHS.shortText);

  if (!sanitized) {
    return { valid: false, sanitized: '', error: `${fieldName} is required` };
  }

  if (sanitized.length < 2) {
    return { valid: false, sanitized, error: `${fieldName} must be at least 2 characters` };
  }

  if (containsSuspiciousPatterns(sanitized)) {
    return { valid: false, sanitized: '', error: `${fieldName} contains invalid content` };
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize a medium text input (descriptions, notes)
 */
export function validateMediumText(input: string, fieldName: string = 'input', required: boolean = false): ValidationResult {
  const sanitized = sanitizeText(input, MAX_INPUT_LENGTHS.mediumText);

  if (!sanitized && required) {
    return { valid: false, sanitized: '', error: `${fieldName} is required` };
  }

  if (containsSuspiciousPatterns(sanitized)) {
    return { valid: false, sanitized: '', error: `${fieldName} contains invalid content` };
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize a long text input (detailed content)
 */
export function validateLongText(input: string, fieldName: string = 'input', required: boolean = false): ValidationResult {
  const sanitized = sanitizeText(input, MAX_INPUT_LENGTHS.longText);

  if (!sanitized && required) {
    return { valid: false, sanitized: '', error: `${fieldName} is required` };
  }

  if (containsSuspiciousPatterns(sanitized)) {
    return { valid: false, sanitized: '', error: `${fieldName} contains invalid content` };
  }

  return { valid: true, sanitized };
}

/**
 * Validate coordinate value
 */
export function validateCoordinate(value: unknown, fieldName: string = 'coordinate'): { valid: boolean; value: number; error?: string } {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, value: 0, error: `${fieldName} must be a valid number` };
  }

  // Basic bounds check for lat/lng
  if (fieldName.toLowerCase().includes('lat')) {
    if (value < -90 || value > 90) {
      return { valid: false, value: 0, error: `${fieldName} must be between -90 and 90` };
    }
  } else if (fieldName.toLowerCase().includes('lng') || fieldName.toLowerCase().includes('lon')) {
    if (value < -180 || value > 180) {
      return { valid: false, value: 0, error: `${fieldName} must be between -180 and 180` };
    }
  }

  return { valid: true, value };
}

/**
 * Validate a location object with name and coordinates
 */
export function validateLocation(
  location: unknown,
  fieldName: string = 'location'
): { valid: boolean; location: { name: string; lat: number; lng: number } | null; error?: string } {
  if (!location || typeof location !== 'object') {
    return { valid: false, location: null, error: `${fieldName} is required` };
  }

  const loc = location as { name?: unknown; lat?: unknown; lng?: unknown };

  // Validate name
  const nameResult = validateShortText(String(loc.name || ''), `${fieldName} name`);
  if (!nameResult.valid) {
    return { valid: false, location: null, error: nameResult.error };
  }

  // Validate coordinates
  const latResult = validateCoordinate(loc.lat, `${fieldName} latitude`);
  if (!latResult.valid) {
    return { valid: false, location: null, error: latResult.error };
  }

  const lngResult = validateCoordinate(loc.lng, `${fieldName} longitude`);
  if (!lngResult.valid) {
    return { valid: false, location: null, error: lngResult.error };
  }

  return {
    valid: true,
    location: {
      name: nameResult.sanitized,
      lat: latResult.value,
      lng: lngResult.value,
    },
  };
}

/**
 * Validate an array of locations (waypoints)
 */
export function validateWaypointArray(
  waypoints: unknown,
  maxCount: number = 50
): { valid: boolean; waypoints: Array<{ name: string; lat: number; lng: number }>; error?: string } {
  if (!waypoints) {
    return { valid: true, waypoints: [] };
  }

  if (!Array.isArray(waypoints)) {
    return { valid: false, waypoints: [], error: 'Waypoints must be an array' };
  }

  if (waypoints.length > maxCount) {
    return { valid: false, waypoints: [], error: `Maximum ${maxCount} waypoints allowed` };
  }

  const validatedWaypoints: Array<{ name: string; lat: number; lng: number }> = [];

  for (let i = 0; i < waypoints.length; i++) {
    const result = validateLocation(waypoints[i], `Waypoint ${i + 1}`);
    if (!result.valid) {
      return { valid: false, waypoints: [], error: result.error };
    }
    if (result.location) {
      validatedWaypoints.push(result.location);
    }
  }

  return { valid: true, waypoints: validatedWaypoints };
}

/**
 * Validate date string in YYYY-MM-DD format
 */
export function validateDateString(input: string, fieldName: string = 'date'): { valid: boolean; date: string | null; error?: string } {
  if (!input) {
    return { valid: true, date: null };
  }

  const sanitized = sanitizeText(input, 10);

  // Check format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sanitized)) {
    return { valid: false, date: null, error: `${fieldName} must be in YYYY-MM-DD format` };
  }

  // Validate it's a real date
  const date = new Date(sanitized);
  if (isNaN(date.getTime())) {
    return { valid: false, date: null, error: `${fieldName} is not a valid date` };
  }

  return { valid: true, date: sanitized };
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: unknown,
  fieldName: string = 'value',
  max?: number
): { valid: boolean; value: number | null; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: true, value: null };
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return { valid: false, value: null, error: `${fieldName} must be a valid number` };
  }

  if (num < 0) {
    return { valid: false, value: null, error: `${fieldName} must be positive` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, value: null, error: `${fieldName} must be at most ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Wrap user input for safe inclusion in prompts
 * This adds markers to help the AI distinguish user input from instructions
 */
export function wrapUserInput(input: string, label: string = 'User Input'): string {
  const sanitized = sanitizeText(input);
  return `[${label} Start]\n${sanitized}\n[${label} End]`;
}
