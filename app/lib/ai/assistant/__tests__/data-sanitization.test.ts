/**
 * Data Sanitization Tests
 */

import { describe, it, expect } from 'vitest';
import { CrewDataSanitizer, SensitiveDataValidator } from '../data-sanitization';
import { UseCaseIntent } from '../use-case-classification';

describe('CrewDataSanitizer', () => {
  let sanitizer: CrewDataSanitizer;

  beforeEach(() => {
    sanitizer = new CrewDataSanitizer();
  });

  describe('sanitizeMessage', () => {
    it('should remove email addresses', () => {
      const message = 'Contact me at test@example.com for more info';
      const result = sanitizer.sanitizeMessage(message);
      expect(result).toBe('Contact me at [REDACTED] for more info');
    });

    it('should remove phone numbers', () => {
      const message = 'Call me at 555-123-4567';
      const result = sanitizer.sanitizeMessage(message);
      expect(result).toBe('Call me at [REDACTED]');
    });

    it('should handle multiple PII instances', () => {
      const message = 'Email test@example.com or call 555-123-4567';
      const result = sanitizer.sanitizeMessage(message);
      expect(result).toBe('Email [REDACTED] or call [REDACTED]');
    });

    it('should preserve non-PII content', () => {
      const message = 'I love sailing in the Mediterranean';
      const result = sanitizer.sanitizeMessage(message);
      expect(result).toBe('I love sailing in the Mediterranean');
    });
  });

  describe('sanitizeResponse', () => {
    it('should remove email addresses from responses', () => {
      const response = 'Please contact captain@boat.com for details';
      const result = sanitizer.sanitizeResponse(response);
      expect(result).toBe('Please contact [REDACTED_EMAIL] for details');
    });

    it('should remove phone numbers from responses', () => {
      const response = 'Call 555-987-6543 for more information';
      const result = sanitizer.sanitizeResponse(response);
      expect(result).toBe('Call [REDACTED_PHONE] for more information');
    });
  });

  describe('sanitizeContext', () => {
    const mockContext = {
      userId: 'user-123',
      profile: {
        username: 'sailor_john',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        sailingExperience: 3,
        skills: ['navigation', 'cooking'],
        certifications: 'RYA Yachtmaster',
        riskLevel: ['Offshore sailing'],
        sailingPreferences: 'Long-distance passages'
      },
      boats: [
        { id: 'boat-1', name: 'Sea Breeze', type: 'Sailing yacht' }
      ],
      recentRegistrations: [
        { id: 'reg-1', legId: 'leg-1', status: 'pending' }
      ]
    };

    it('should remove sensitive fields from profile', () => {
      const result = sanitizer.sanitizeContext(mockContext, UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
      expect(result.profile).not.toHaveProperty('username');
      expect(result.profile).not.toHaveProperty('fullName');
      expect(result.profile).not.toHaveProperty('email');
      expect(result.profile).not.toHaveProperty('phone');
    });

    it('should keep sailing-related fields', () => {
      const result = sanitizer.sanitizeContext(mockContext, UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
      expect(result.profile).toHaveProperty('sailingExperience');
      expect(result.profile).toHaveProperty('skills');
      expect(result.profile).toHaveProperty('certifications');
      expect(result.profile).toHaveProperty('riskLevel');
    });

    it('should filter context based on use case', () => {
      const result = sanitizer.sanitizeContext(mockContext, UseCaseIntent.CREW_SEARCH_SAILING_TRIPS);
      expect(result.boats).toHaveLength(0); // Should be filtered out for crew search
      expect(result.recentRegistrations).toHaveLength(1); // Should be kept
    });
  });
});

describe('SensitiveDataValidator', () => {
  describe('validateContext', () => {
    it('should throw error for email in context', () => {
      const context = {
        profile: {
          email: 'test@example.com'
        }
      };

      expect(() => {
        SensitiveDataValidator.validateContext(context);
      }).toThrow('Sensitive email data detected in context');
    });

    it('should throw error for phone in context', () => {
      const context = {
        profile: {
          phone: '555-123-4567'
        }
      };

      expect(() => {
        SensitiveDataValidator.validateContext(context);
      }).toThrow('Sensitive phone data detected in context');
    });

    it('should throw error for large context size', () => {
      const largeContext = {
        profile: {
          data: 'x'.repeat(60000)
        }
      };

      expect(() => {
        SensitiveDataValidator.validateContext(largeContext);
      }).toThrow('Context size exceeds maximum allowed size');
    });

    it('should pass validation for clean context', () => {
      const cleanContext = {
        profile: {
          sailingExperience: 3,
          skills: ['navigation']
        }
      };

      expect(() => {
        SensitiveDataValidator.validateContext(cleanContext);
      }).not.toThrow();
    });
  });

  describe('sanitizeOutput', () => {
    it('should remove email addresses from output', () => {
      const output = 'Contact captain@boat.com for details';
      const result = SensitiveDataValidator.sanitizeOutput(output);
      expect(result).toBe('Contact [REDACTED_EMAIL] for details');
    });

    it('should handle multiple email addresses', () => {
      const output = 'Email test@example.com or captain@boat.com';
      const result = SensitiveDataValidator.sanitizeOutput(output);
      expect(result).toBe('Email [REDACTED_EMAIL] or [REDACTED_EMAIL]');
    });
  });

  describe('isSensitiveField', () => {
    it('should identify sensitive fields', () => {
      expect(SensitiveDataValidator.isSensitiveField('email')).toBe(true);
      expect(SensitiveDataValidator.isSensitiveField('phone')).toBe(true);
      expect(SensitiveDataValidator.isSensitiveField('username')).toBe(true);
      expect(SensitiveDataValidator.isSensitiveField('sailingExperience')).toBe(false);
    });
  });

  describe('getSanitizationReport', () => {
    it('should count PII in text', () => {
      const text = 'Contact me at test@example.com or call 555-123-4567';
      const report = SensitiveDataValidator.getSanitizationReport(text);

      expect(report.emailCount).toBe(1);
      expect(report.phoneCount).toBe(1);
      expect(report.originalLength).toBe(text.length);
    });

    it('should handle text with no PII', () => {
      const text = 'I love sailing in the Mediterranean';
      const report = SensitiveDataValidator.getSanitizationReport(text);

      expect(report.emailCount).toBe(0);
      expect(report.phoneCount).toBe(0);
      expect(report.originalLength).toBe(text.length);
    });
  });
});