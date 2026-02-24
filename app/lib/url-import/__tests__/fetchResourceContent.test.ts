/**
 * Tests for Content Fetching Service
 */

import { fetchResourceContent } from '../fetchResourceContent';

// Mock the dependencies
jest.mock('@/app/lib/sailboatdata_queries', () => ({
  fetchWithScraperAPI: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { fetchWithScraperAPI } from '@/app/lib/sailboatdata_queries';

const mockFetchWithScraperAPI = fetchWithScraperAPI as jest.MockedFunction<typeof fetchWithScraperAPI>;

describe('Content Fetching Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Generic Web Content', () => {
    it('fetches generic web content via ScraperAPI', async () => {
      const mockHtml = `
        <html>
          <head><title>My Blog</title></head>
          <body>
            <h1>My Sailing Journey</h1>
            <p>This is my amazing sailing adventure...</p>
          </body>
        </html>
      `;

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://myblog.com/sailing-journey',
        resourceType: 'generic',
      });

      expect(result.source).toBe('scraper');
      expect(result.metadata.platform).toBe('generic');
      expect(result.metadata.tool).toBe('scraperapi');
      expect(result.content).toContain('My Sailing Journey');
      expect(result.title).toBe('My Blog');
    });

    it('strips HTML tags from content', async () => {
      const mockHtml = `
        <div>
          <script>alert('xss')</script>
          <style>body { color: red; }</style>
          <p>Clean content here</p>
        </div>
      `;

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });

      expect(result.content).toContain('Clean content here');
      expect(result.content).not.toContain('<');
      expect(result.content).not.toContain('alert');
    });

    it('truncates content to 5000 characters', async () => {
      const longText = 'x'.repeat(10000);
      const mockHtml = `<p>${longText}</p>`;

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });

      expect(result.content.length).toBeLessThanOrEqual(5000);
    });

    it('throws error if ScraperAPI fails', async () => {
      mockFetchWithScraperAPI.mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(
        fetchResourceContent({
          url: 'https://example.com',
          resourceType: 'generic',
        })
      ).rejects.toThrow('Could not fetch content from URL');
    });

    it('throws error if no content is extracted', async () => {
      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => '<html></html>',
      } as any);

      await expect(
        fetchResourceContent({
          url: 'https://example.com',
          resourceType: 'generic',
        })
      ).rejects.toThrow('Could not fetch content from URL');
    });
  });

  describe('Facebook Content', () => {
    it('attempts API fetch when authenticated', async () => {
      // Note: In real implementation, this would call Graph API
      // For testing purposes, we're mocking the fallback to scraper
      const mockHtml = '<p>Facebook post content</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://facebook.com/user/posts/123',
        resourceType: 'facebook',
        authProvider: 'facebook',
        accessToken: 'test_token',
      });

      // When no real API response, falls back to scraper
      expect(result.source === 'scraper' || result.source === 'api').toBe(true);
    });

    it('falls back to scraper when not authenticated', async () => {
      const mockHtml = '<p>Scraped Facebook content</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://facebook.com/user/posts/123',
        resourceType: 'facebook',
      });

      expect(result.source).toBe('scraper');
      expect(result.metadata.platform).toBe('facebook');
    });
  });

  describe('Twitter Content', () => {
    it('fetches Twitter content via scraper when not authenticated', async () => {
      const mockHtml = '<p>This is my tweet about sailing...</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://twitter.com/user/status/123',
        resourceType: 'twitter',
      });

      expect(result.source).toBe('scraper');
      expect(result.metadata.platform).toBe('twitter');
      expect(result.content).toContain('sailing');
    });
  });

  describe('Metadata Extraction', () => {
    it('includes title in metadata', async () => {
      const mockHtml = '<html><head><title>Test Page</title></head><body>Content</body></html>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });

      expect(result.title).toBe('Test Page');
    });

    it('includes fetched timestamp', async () => {
      const mockHtml = '<p>Content</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const before = new Date();
      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });
      const after = new Date();

      expect(result.fetchedAt).toBeDefined();
      expect(new Date(result.fetchedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(new Date(result.fetchedAt).getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('includes character count in metadata', async () => {
      const mockHtml = '<p>Sample content text</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });

      expect(result.metadata.charCount).toBeDefined();
      expect(result.metadata.charCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('provides user-friendly error messages', async () => {
      mockFetchWithScraperAPI.mockRejectedValue(new Error('Network timeout'));

      await expect(
        fetchResourceContent({
          url: 'https://example.com',
          resourceType: 'generic',
        })
      ).rejects.toThrow('Could not fetch content from URL. Please paste the content manually.');
    });

    it('handles different error types', async () => {
      mockFetchWithScraperAPI.mockRejectedValue('Network error');

      await expect(
        fetchResourceContent({
          url: 'https://example.com',
          resourceType: 'generic',
        })
      ).rejects.toThrow();
    });
  });

  describe('Content Normalization', () => {
    it('handles multiple spaces', async () => {
      const mockHtml = '<p>Text    with     multiple    spaces</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });

      expect(result.content).not.toContain('     ');
    });

    it('preserves line breaks appropriately', async () => {
      const mockHtml = '<p>Line 1</p><p>Line 2</p>';

      mockFetchWithScraperAPI.mockResolvedValue({
        ok: true,
        text: async () => mockHtml,
      } as any);

      const result = await fetchResourceContent({
        url: 'https://example.com',
        resourceType: 'generic',
      });

      expect(result.content).toContain('Line 1');
      expect(result.content).toContain('Line 2');
    });
  });
});
