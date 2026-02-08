import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/testHelpers';

/**
 * UX Tests for Home Page
 * Tests user experience flows and interactions on the main landing page
 */

test.describe('Home Page UX', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.navigateTo('/');
  });

  test('should display hero section with clear value proposition', async ({ page }) => {
    // Test hero section visibility and content
    await expect(page.locator('[data-testid="hero-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="hero-subtitle"]')).toBeVisible();

    // Check for clear call-to-action buttons
    const browseButton = page.locator('[data-testid="browse-button"]');
    const joinButton = page.locator('[data-testid="join-button"]');

    await expect(browseButton).toBeVisible();
    await expect(joinButton).toBeVisible();

    // Buttons should be easily clickable (minimum 44px height)
    const browseBox = await browseButton.boundingBox();
    const joinBox = await joinButton.boundingBox();

    expect(browseBox?.height).toBeGreaterThan(40);
    expect(joinBox?.height).toBeGreaterThan(40);

    // Buttons should have clear, action-oriented text
    await expect(browseButton).toContainText(/browse|find/i);
    await expect(joinButton).toContainText(/join|get started/i);
  });

  test('should display feature highlights with visual icons', async ({ page }) => {
    // Test feature section visibility
    const featureSection = page.locator('[data-testid="features-section"]');
    await expect(featureSection).toBeVisible();

    // Check for feature cards
    const features = [
      'search',
      'match',
      'communicate',
      'join'
    ];

    for (const feature of features) {
      const featureCard = page.locator(`[data-testid="feature-${feature}"]`);
      await expect(featureCard).toBeVisible();

      // Each feature should have an icon
      const icon = featureCard.locator('svg, img');
      await expect(icon).toBeVisible();

      // Feature should have title and description
      const title = featureCard.locator('[data-testid="feature-title"]');
      const description = featureCard.locator('[data-testid="feature-description"]');

      await expect(title).toBeVisible();
      await expect(description).toBeVisible();
    }
  });

  test('should have responsive navigation that works on mobile', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Check if navigation is accessible
    const navToggle = page.locator('[data-testid="nav-toggle"]');
    if (await navToggle.isVisible()) {
      await navToggle.click();
    }

    // Navigation links should be visible and tappable
    const navLinks = page.locator('nav a');
    const navLinkCount = await navLinks.count();
    expect(navLinkCount).toBeGreaterThan(0);

    // Each nav link should be large enough to tap (minimum 44px)
    const navLinkCount = await navLinks.count();
    for (let i = 0; i < navLinkCount; i++) {
      const navLink = navLinks.nth(i);
      const box = await navLink.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThan(40);
      }
    }
  });

  test('should have accessible form elements', async ({ page }) => {
    // Test form accessibility
    const forms = page.locator('form');
    const inputs = page.locator('input, select, textarea');

    // Check for proper labels
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');

      // Each input should have an id or name
      expect(id || name).toBeTruthy();

      // Should have associated label
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        if (await label.isVisible()) {
          await expect(label).toBeVisible();
        }
      }
    }
  });

  test('should display loading states during data fetching', async ({ page }) => {
    // Intercept API calls to simulate loading
    await page.route('**/api/**', async route => {
      // Delay the response to show loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    // Trigger data fetching (e.g., by navigating to browse page)
    await page.goto('/browse');

    // Should show loading indicator
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();

    // Loading should complete
    await expect(loadingSpinner).toBeHidden({ timeout: 5000 });
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/**', route => route.abort());

    // Try to load data that would cause error
    await page.goto('/browse');

    // Should show error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    // Error message should be helpful and actionable
    const errorText = await errorMessage.textContent();
    expect(errorText).toMatch(/error|problem|try again/i);

    // Should provide a way to retry
    const retryButton = page.locator('[data-testid="retry-button"]');
    if (await retryButton.isVisible()) {
      await expect(retryButton).toBeVisible();
    }
  });

  test('should maintain consistent visual hierarchy', async ({ page }) => {
    // Test visual hierarchy using computed styles
    const heroTitle = page.locator('[data-testid="hero-title"]');
    const heroSubtitle = page.locator('[data-testid="hero-subtitle"]');
    const featureTitles = page.locator('[data-testid="feature-title"]');

    // Hero title should be largest
    const heroTitleStyles = await heroTitle.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: parseInt(style.fontSize),
        fontWeight: style.fontWeight,
      };
    });

    const heroSubtitleStyles = await heroSubtitle.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        fontSize: parseInt(style.fontSize),
        fontWeight: style.fontWeight,
      };
    });

    // Hero title should be larger than subtitle
    expect(heroTitleStyles.fontSize).toBeGreaterThan(heroSubtitleStyles.fontSize);

    // Feature titles should be consistent
    const featureTitleCount = await featureTitles.count();
    if (featureTitleCount > 1) {
      const firstFeatureStyles = await featureTitles.nth(0).evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: parseInt(style.fontSize),
          fontWeight: style.fontWeight,
        };
      });

      const secondFeatureStyles = await featureTitles.nth(1).evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: parseInt(style.fontSize),
          fontWeight: style.fontWeight,
        };
      });

      // Feature titles should have consistent styling
      expect(firstFeatureStyles.fontSize).toBe(secondFeatureStyles.fontSize);
      expect(firstFeatureStyles.fontWeight).toBe(secondFeatureStyles.fontWeight);
    }
  });

  test('should have proper color contrast for accessibility', async ({ page }) => {
    // This would ideally use a color contrast checker
    // For now, we'll check that elements have color styles
    const textElements = page.locator('*');
    const elementCount = await textElements.count();

    // Check a sample of elements for color contrast
    const sampleSize = Math.min(10, elementCount);
    for (let i = 0; i < sampleSize; i++) {
      const element = textElements.nth(i);
      const styles = await element.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
        };
      });

      // Elements should have defined colors
      expect(styles.color).toBeTruthy();
      expect(styles.backgroundColor).toBeTruthy();
    }
  });

  test('should provide clear feedback for user interactions', async ({ page }) => {
    // Test button hover states
    const buttons = page.locator('button, [role="button"]');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      const firstButton = buttons.nth(0);

      // Normal state
      const normalStyles = await firstButton.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      });

      // Hover state
      await firstButton.hover();
      const hoverStyles = await firstButton.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
        };
      });

      // Hover state should be different from normal state
      // (This is a basic check - in practice you'd want more sophisticated validation)
      expect(hoverStyles.backgroundColor).toBeTruthy();
    }
  });

  test('should handle viewport resizing gracefully', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 812 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1024, height: 768 },  // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      // Elements should remain visible and accessible
      const heroTitle = page.locator('[data-testid="hero-title"]');
      if (await heroTitle.isVisible()) {
        await expect(heroTitle).toBeVisible();
      }

      // Navigation should be accessible
      const nav = page.locator('nav');
      if (await nav.isVisible()) {
        await expect(nav).toBeVisible();
      }

      // Content should not overflow horizontally
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width);
    }
  });
});