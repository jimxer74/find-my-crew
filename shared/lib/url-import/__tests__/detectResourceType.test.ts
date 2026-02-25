/**
 * Tests for URL Resource Type Detection
 */

import { detectResourceType, isValidUrl } from '../detectResourceType';

describe('URL Validation', () => {
  describe('isValidUrl', () => {
    it('accepts valid HTTP URLs', () => {
      expect(isValidUrl('https://facebook.com/user/posts/123')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://twitter.com/user/status/456')).toBe(true);
    });

    it('accepts URLs with www prefix', () => {
      expect(isValidUrl('https://www.facebook.com/user')).toBe(true);
    });

    it('rejects invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('javascript:alert("xss")')).toBe(false);
      expect(isValidUrl('data:text/html,<script>alert("xss")</script>')).toBe(false);
    });

    it('rejects empty strings', () => {
      expect(isValidUrl('')).toBe(false);
    });
  });
});

describe('Facebook Detection', () => {
  it('detects Facebook post URLs', () => {
    const result = detectResourceType('https://facebook.com/john.doe/posts/123456789');
    expect(result.resourceType).toBe('facebook');
    expect(result.authProvider).toBe('facebook');
    expect(result.resourceId).toBe('123456789');
    expect(result.metadata.type).toBe('post');
  });

  it('detects Facebook post URLs with numeric path', () => {
    const result = detectResourceType('https://facebook.com/123456789');
    expect(result.resourceType).toBe('facebook');
    expect(result.resourceId).toBe('123456789');
    expect(result.metadata.type).toBe('post');
  });

  it('detects Facebook profile URLs', () => {
    const result = detectResourceType('https://facebook.com/john.doe');
    expect(result.resourceType).toBe('facebook');
    expect(result.authProvider).toBe('facebook');
    expect(result.metadata.type).toBe('profile');
    expect(result.metadata.username).toBe('john.doe');
  });

  it('handles Facebook URLs with www prefix', () => {
    const result = detectResourceType('https://www.facebook.com/sarah.smith/posts/987654321');
    expect(result.resourceType).toBe('facebook');
    expect(result.resourceId).toBe('987654321');
  });

  it('handles Facebook URLs with trailing slashes', () => {
    const result = detectResourceType('https://facebook.com/user.name/posts/123456789/');
    expect(result.resourceType).toBe('facebook');
    expect(result.resourceId).toBe('123456789');
  });

  it('handles Facebook URLs with query parameters', () => {
    const result = detectResourceType(
      'https://facebook.com/jane.doe/posts/555555555/?utm_source=facebook'
    );
    expect(result.resourceType).toBe('facebook');
    expect(result.resourceId).toBe('555555555');
  });
});

describe('Twitter Detection', () => {
  it('detects Twitter tweet URLs', () => {
    const result = detectResourceType('https://twitter.com/elonmusk/status/1234567890');
    expect(result.resourceType).toBe('twitter');
    expect(result.authProvider).toBe('twitter');
    expect(result.resourceId).toBe('1234567890');
    expect(result.metadata.type).toBe('tweet');
    expect(result.metadata.username).toBe('elonmusk');
  });

  it('detects X.com (Twitter) URLs', () => {
    const result = detectResourceType('https://x.com/user/status/9876543210');
    expect(result.resourceType).toBe('twitter');
    expect(result.domain).toBe('x.com');
    expect(result.resourceId).toBe('9876543210');
  });

  it('detects Twitter profile URLs', () => {
    const result = detectResourceType('https://twitter.com/opensea');
    expect(result.resourceType).toBe('twitter');
    expect(result.authProvider).toBe('twitter');
    expect(result.metadata.type).toBe('profile');
    expect(result.metadata.username).toBe('opensea');
  });

  it('ignores special Twitter paths', () => {
    const result = detectResourceType('https://twitter.com/home');
    expect(result.resourceType).toBe('twitter');
    expect(result.metadata.type).toBe('unknown');
  });

  it('handles Twitter URLs with trailing slashes', () => {
    const result = detectResourceType('https://twitter.com/user/status/1234567890/');
    expect(result.resourceType).toBe('twitter');
    expect(result.resourceId).toBe('1234567890');
  });

  it('handles X.com URLs with www prefix', () => {
    const result = detectResourceType('https://www.x.com/someone/status/5555555555');
    expect(result.resourceType).toBe('twitter');
    expect(result.resourceId).toBe('5555555555');
  });
});

describe('Generic Web Detection', () => {
  it('detects generic blog URLs', () => {
    const result = detectResourceType('https://myblog.com/my-sailing-journey');
    expect(result.resourceType).toBe('generic');
    expect(result.authProvider).toBeNull();
    expect(result.metadata.path).toBe('/my-sailing-journey');
  });

  it('detects generic forum URLs', () => {
    const result = detectResourceType('https://sailing-forum.com/users/captainmike');
    expect(result.resourceType).toBe('generic');
    expect(result.domain).toBe('sailing-forum.com');
  });

  it('detects URLs with query parameters', () => {
    const result = detectResourceType('https://example.com/profile?id=123&view=public');
    expect(result.resourceType).toBe('generic');
    expect(result.metadata.hasQuery).toBe(true);
  });

  it('normalizes domain names', () => {
    const result = detectResourceType('https://www.example.com/page');
    expect(result.domain).toBe('example.com');
  });
});

describe('Error Handling', () => {
  it('throws error for invalid URLs', () => {
    expect(() => detectResourceType('not a url')).toThrow('Invalid URL provided');
  });

  it('throws error for malicious URLs', () => {
    expect(() => detectResourceType('javascript:alert("xss")')).toThrow('Invalid URL provided');
  });

  it('throws error for data URLs', () => {
    expect(() => detectResourceType('data:text/html,test')).toThrow('Invalid URL provided');
  });
});

describe('Edge Cases', () => {
  it('handles URLs without protocol', () => {
    expect(() => detectResourceType('facebook.com/user')).toThrow();
  });

  it('handles very long URLs', () => {
    const longPath = '/a'.repeat(1000);
    const result = detectResourceType(`https://example.com${longPath}`);
    expect(result.resourceType).toBe('generic');
  });

  it('preserves metadata correctly', () => {
    const result = detectResourceType('https://facebook.com/user/posts/123');
    expect(result.metadata).toBeDefined();
    expect(result.metadata).toHaveProperty('type');
  });
});
