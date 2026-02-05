/**
 * Data Sanitization System
 *
 * Implements comprehensive PII detection and removal for AI prompts and responses.
 */

import { UserContext, UseCaseIntent, SanitizedUserContext } from './use-case-classification';

/**
 * Data sanitization interface
 */
export class CrewDataSanitizer {
  private sensitiveFields: Set<string> = new Set([
    'username', 'fullName', 'firstName', 'lastName', 'email', 'phone',
    'phoneNumber', 'address', 'postalCode', 'city', 'country', 'image',
    'avatar', 'profileImage', 'dateOfBirth', 'nationality', 'emergencyContact'
  ]);

  private piiPatterns: RegExp[] = [
    /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g,           // Email addresses
    /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,        // SSN-like patterns
    /\b\d{10,}\b/g,                              // Long number sequences
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // Phone numbers
    /\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/gi      // UK postal codes
  ];

  private useCaseFieldAccess: Record<UseCaseIntent, string[]> = {
    [UseCaseIntent.CREW_SEARCH_SAILING_TRIPS]: [
      'sailingExperience', 'skills', 'certifications', 'riskLevel', 'availability',
      'preferences', 'experienceLevel', 'rolePreferences'
    ],
    [UseCaseIntent.CREW_IMPROVE_PROFILE]: [
      'userDescription', 'skills', 'certifications', 'sailingExperience',
      'riskLevel', 'experienceLevel', 'profileCompleteness'
    ],
    [UseCaseIntent.CREW_REGISTER]: [
      'sailingExperience', 'skills', 'certifications', 'riskLevel', 'availability',
      'recentRegistrations', 'experienceLevel'
    ],
    [UseCaseIntent.GENERAL_CONVERSATION]: [
      'roles', 'sailingExperience', 'skills'
    ]
  };

  /**
   * Sanitize user context for a specific use case
   */
  sanitizeContext(context: UserContext, useCase: UseCaseIntent): SanitizedUserContext {
    // Deep clone to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(context));

    // Remove sensitive fields globally
    this.removeSensitiveFields(sanitized);

    // Apply use-case specific filtering
    this.applyUseCaseFiltering(sanitized, useCase);

    // Sanitize user messages in context
    if (sanitized.conversations) {
      sanitized.conversations = sanitized.conversations.map((conv: any) => ({
        ...conv,
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          content: this.sanitizeMessage(msg.content)
        }))
      }));
    }

    return sanitized;
  }

  /**
   * Sanitize user message content
   */
  sanitizeMessage(message: string): string {
    let sanitized = message;

    // Remove PII patterns
    for (const pattern of this.piiPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Remove common sensitive terms
    const sensitiveTerms = ['my email', 'my phone', 'my address', 'my username', 'my name is', 'my phone number'];
    for (const term of sensitiveTerms) {
      sanitized = sanitized.replace(new RegExp(term, 'gi'), 'this information');
    }

    return sanitized;
  }

  /**
   * Sanitize AI response to prevent PII leakage
   */
  sanitizeResponse(response: string): string {
    // Remove any accidentally exposed PII from AI responses
    let sanitized = response;

    // Remove email patterns from responses
    sanitized = sanitized.replace(this.piiPatterns[0], '[REDACTED_EMAIL]');

    // Remove phone patterns from responses
    sanitized = sanitized.replace(this.piiPatterns[3], '[REDACTED_PHONE]');

    // Remove any potential usernames or names that might be exposed
    const namePatterns = [
      /\bmy name is ([A-Z][a-z]+ [A-Z][a-z]+)/gi,
      /\bi am ([A-Z][a-z]+ [A-Z][a-z]+)/gi,
      /\bcall me ([A-Z][a-z]+ [A-Z][a-z]+)/gi
    ];

    for (const pattern of namePatterns) {
      sanitized = sanitized.replace(pattern, 'the user');
    }

    return sanitized;
  }

  /**
   * Remove sensitive fields from user context
   */
  private removeSensitiveFields(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    for (const field of this.sensitiveFields) {
      if (obj.hasOwnProperty(field)) {
        delete obj[field];
      }
    }

    // Recursively clean nested objects
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key]);
      }
    }
  }

  /**
   * Apply use-case specific context filtering
   */
  private applyUseCaseFiltering(context: any, useCase: UseCaseIntent): void {
    const allowedFields = new Set(this.useCaseFieldAccess[useCase]);

    // Filter user profile
    if (context.profile) {
      const profile = context.profile;
      const filteredProfile: any = {};

      for (const field of allowedFields) {
        if (profile.hasOwnProperty(field)) {
          filteredProfile[field] = profile[field];
        }
      }

      context.profile = filteredProfile;
    }

    // Filter other context sections based on use case
    this.filterContextSections(context, useCase);
  }

  /**
   * Filter context sections based on use case
   */
  private filterContextSections(context: any, useCase: UseCaseIntent): void {
    switch (useCase) {
      case UseCaseIntent.CREW_SEARCH_SAILING_TRIPS:
        // Keep only search-relevant context
        context.boats = [];
        delete context.pendingActions;
        if (context.recentRegistrations) {
          context.recentRegistrations = context.recentRegistrations.slice(0, 3);
        }
        break;

      case UseCaseIntent.CREW_IMPROVE_PROFILE:
        // Keep only profile-relevant context
        context.boats = [];
        delete context.recentRegistrations;
        delete context.pendingActions;
        break;

      case UseCaseIntent.CREW_REGISTER:
        // Keep only registration-relevant context
        context.boats = [];
        if (context.recentRegistrations) {
          context.recentRegistrations = context.recentRegistrations.slice(0, 5);
        }
        break;

      case UseCaseIntent.GENERAL_CONVERSATION:
        // Keep minimal context
        context.boats = [];
        delete context.recentRegistrations;
        delete context.pendingActions;
        break;
    }
  }
}

/**
 * Sensitive data validation utilities
 */
export class SensitiveDataValidator {
  private static readonly MAX_STRING_LENGTH = 200;
  private static readonly MAX_ARRAY_SIZE = 10;

  /**
   * Validate context for sensitive data
   */
  static validateContext(context: any): void {
    // Check for any remaining sensitive data
    const serialized = JSON.stringify(context);
    const emailPattern = /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/;
    const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

    if (emailPattern.test(serialized)) {
      throw new Error('Sensitive email data detected in context');
    }

    if (phonePattern.test(serialized)) {
      throw new Error('Sensitive phone data detected in context');
    }

    // Check for excessive data size
    if (serialized.length > 50000) {
      throw new Error('Context size exceeds maximum allowed size');
    }
  }

  /**
   * Sanitize output to prevent PII leakage
   */
  static sanitizeOutput(output: string): string {
    // Remove any potential PII from AI output
    return output.replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g, '[REDACTED_EMAIL]');
  }

  /**
   * Check if a field contains sensitive data
   */
  static isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'username', 'fullName', 'firstName', 'lastName', 'email', 'phone',
      'phoneNumber', 'address', 'postalCode', 'city', 'country', 'image',
      'avatar', 'profileImage', 'dateOfBirth', 'nationality', 'emergencyContact'
    ];

    return sensitiveFields.includes(fieldName.toLowerCase());
  }

  /**
   * Get sanitization report for monitoring
   */
  static getSanitizationReport(text: string): {
    emailCount: number;
    phoneCount: number;
    sanitizedLength: number;
    originalLength: number;
  } {
    const emailPattern = /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/g;
    const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

    const emailMatches = text.match(emailPattern) || [];
    const phoneMatches = text.match(phonePattern) || [];

    return {
      emailCount: emailMatches.length,
      phoneCount: phoneMatches.length,
      sanitizedLength: text.length,
      originalLength: text.length
    };
  }
}

/**
 * Privacy compliance checker
 */
export class PrivacyComplianceChecker {
  /**
   * Check if context complies with data protection regulations
   */
  static checkCompliance(context: any): {
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for PII in profile
    if (context.profile) {
      const profileText = JSON.stringify(context.profile);
      const emailPattern = /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b/;
      const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

      if (emailPattern.test(profileText)) {
        issues.push('Email addresses detected in profile');
        recommendations.push('Remove email addresses from profile data before AI processing');
      }

      if (phonePattern.test(profileText)) {
        issues.push('Phone numbers detected in profile');
        recommendations.push('Remove phone numbers from profile data before AI processing');
      }
    }

    // Check data minimization
    const contextSize = JSON.stringify(context).length;
    if (contextSize > 50000) {
      issues.push('Context size exceeds recommended limit');
      recommendations.push('Consider reducing context size to improve performance and privacy');
    }

    return {
      compliant: issues.length === 0,
      issues,
      recommendations
    };
  }
}