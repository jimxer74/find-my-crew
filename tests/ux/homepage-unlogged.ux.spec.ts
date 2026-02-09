import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/testHelpers';
import { TEST_CONFIG } from '../utils/constants';

/**
 * UX tests for the homepage (/) route for unlogged users
 * Tests the welcome page experience including dual-column layout,
 * search functionality, authentication modals, and responsive design
 */
test.describe('Homepage - Unlogged User', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);

    // Navigate first so we have a same-origin document (required for localStorage access)
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60000 });

    // Clear all session data to ensure we're testing as unlogged user
    await helpers.clearSession();

    // Reload so the page runs with empty storage (clean unlogged state)
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('should load homepage successfully', async ({ page }) => {
    // Verify URL
    await expect(page).toHaveURL('/');
    
    // Verify page title exists
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log(`Page title: ${title}`);
    
    // Verify main content is visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display header with navigation', async ({ page }) => {
    // Header should be visible (from layout.tsx)
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible();
    
    // Logo should be visible (either in header or on page)
    const logo = page.locator('img[alt*="SailSmart"], img[src*="sailsmart"]').first();
    await expect(logo).toBeVisible();
  });

  test('should display dual-column layout for unlogged users', async ({ page }) => {
    // Crew column (right side on desktop) should be visible
    const crewTitle = page.getByText('Find Your Next Adventure', { exact: false });
    await expect(crewTitle).toBeVisible();
    
    // Owner column (left side on desktop) should be visible
    const ownerTitle = page.getByText('Find Your Perfect Crew', { exact: false });
    await expect(ownerTitle).toBeVisible();
    
    // Verify crew description is visible
    const crewDescription = page.getByText(/Tell us what you're looking for/i);
    await expect(crewDescription).toBeVisible();
    
    // Verify owner description is visible
    const ownerDescription = page.getByText(/Post your sailing plans/i);
    await expect(ownerDescription).toBeVisible();
  });

  test('should display login button in top right', async ({ page }) => {
    // Login button should be visible (fixed top right on homepage)
    const loginButton = page.getByRole('button', { name: /log in/i }).first();
    await expect(loginButton).toBeVisible();
    
    // Verify button is clickable
    await expect(loginButton).toBeEnabled();
  });

  test('should display search form for crew members', async ({ page }) => {
    // Search textarea should be visible
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    await expect(searchTextarea).toBeVisible();
    
    // Search button should be visible
    const searchButton = searchTextarea.locator('..').locator('button[type="submit"]');
    await expect(searchButton).toBeVisible();
    
    // Search button should be disabled when input is empty
    await expect(searchButton).toBeDisabled();
  });

  test('should enable search button when text is entered', async ({ page }) => {
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    const searchButton = searchTextarea.locator('..').locator('button[type="submit"]');
    
    // Initially disabled
    await expect(searchButton).toBeDisabled();
    
    // Type in search field
    await searchTextarea.fill('Mediterranean sailing in summer');
    
    // Button should now be enabled
    await expect(searchButton).toBeEnabled();
  });

  test('should navigate to chat on search submission', async ({ page }) => {
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    const searchButton = searchTextarea.locator('..').locator('button[type="submit"]');
    
    // Enter search query
    await searchTextarea.fill('Caribbean sailing');
    
    // Submit search
    await Promise.all([
      page.waitForURL(/\/welcome\/chat/),
      searchButton.click()
    ]);
    
    // Verify navigation to chat page
    await expect(page).toHaveURL(/\/welcome\/chat/);
  });

  test('should open login modal when login button is clicked', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: /log in/i }).first();
    
    // Click login button
    await loginButton.click();
    
    // Wait for modal to appear
    await page.waitForTimeout(500);
    
    // Check for login modal elements (email input or modal title)
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]').first();
    
    // Either email input or modal should be visible
    const emailVisible = await emailInput.isVisible().catch(() => false);
    const modalVisible = await modal.isVisible().catch(() => false);
    
    expect(emailVisible || modalVisible).toBeTruthy();
  });

  test('should display footer', async ({ page }) => {
    // Scroll to bottom to ensure footer is loaded
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Footer should be visible
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible();
  });

  test('should handle responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(TEST_CONFIG.viewport.mobile);
    
    // Wait for layout to adjust
    await page.waitForTimeout(500);
    
    // Crew section should still be visible
    const crewTitle = page.getByText('Find Your Next Adventure', { exact: false });
    await expect(crewTitle).toBeVisible();
    
    // Owner section should still be visible
    const ownerTitle = page.getByText('Find Your Perfect Crew', { exact: false });
    await expect(ownerTitle).toBeVisible();
    
    // Search form should be visible and usable
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    await expect(searchTextarea).toBeVisible();
    
    // Login button should be visible
    const loginButton = page.getByRole('button', { name: /log in/i }).first();
    await expect(loginButton).toBeVisible();
  });

  test('should handle responsive design on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize(TEST_CONFIG.viewport.tablet);
    
    // Wait for layout to adjust
    await page.waitForTimeout(500);
    
    // Both sections should be visible
    const crewTitle = page.getByText('Find Your Next Adventure', { exact: false });
    await expect(crewTitle).toBeVisible();
    
    const ownerTitle = page.getByText('Find Your Perfect Crew', { exact: false });
    await expect(ownerTitle).toBeVisible();
  });

  test('should handle responsive design on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(TEST_CONFIG.viewport.desktop);
    
    // Wait for layout to adjust
    await page.waitForTimeout(500);
    
    // Both sections should be visible side by side
    const crewTitle = page.getByText('Find Your Next Adventure', { exact: false });
    await expect(crewTitle).toBeVisible();
    
    const ownerTitle = page.getByText('Find Your Perfect Crew', { exact: false });
    await expect(ownerTitle).toBeVisible();
  });

  test('should have proper accessibility - headings structure', async ({ page }) => {
    // Check for H1 headings
    const h1Elements = page.locator('h1');
    const h1Count = await h1Elements.count();
    
    expect(h1Count).toBeGreaterThan(0);
    console.log(`Found ${h1Count} H1 heading(s)`);
    
    // Verify at least one H1 contains expected text
    const crewH1 = page.getByRole('heading', { name: /Find Your Next Adventure/i });
    await expect(crewH1).toBeVisible();
  });

  test('should have proper accessibility - images with alt text', async ({ page }) => {
    // Get all images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      let imagesWithAlt = 0;
      for (let i = 0; i < imageCount; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        if (alt && alt.trim() !== '') {
          imagesWithAlt++;
        }
      }
      console.log(`Found ${imagesWithAlt}/${imageCount} images with alt text`);
      // At least logo should have alt text
      expect(imagesWithAlt).toBeGreaterThan(0);
    }
  });

  test('should have proper accessibility - form labels and placeholders', async ({ page }) => {
    // Search textarea should have placeholder
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    await expect(searchTextarea).toBeVisible();
    
    const placeholder = await searchTextarea.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder?.length).toBeGreaterThan(0);
  });

  test('should have proper accessibility - button labels', async ({ page }) => {
    // Search button should have aria-label
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    const searchButton = searchTextarea.locator('..').locator('button[type="submit"]');
    
    const ariaLabel = await searchButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    
    // Login button should have accessible text
    const loginButton = page.getByRole('button', { name: /log in/i }).first();
    await expect(loginButton).toBeVisible();
  });

  test('should not show continue conversation link when no session exists', async ({ page }) => {
    // Continue conversation link should not be visible for unlogged users without session
    const continueLink = page.getByText(/Continue previous conversation/i);
    await expect(continueLink).not.toBeVisible();
  });

  test('should handle Enter key in search field', async ({ page }) => {
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    
    // Fill search field
    await searchTextarea.fill('Baltic Sea adventure');
    
    // Press Enter (without Shift)
    await Promise.all([
      page.waitForURL(/\/welcome\/chat/),
      searchTextarea.press('Enter')
    ]);
    
    // Should navigate to chat
    await expect(page).toHaveURL(/\/welcome\/chat/);
  });

  test('should not submit search on Shift+Enter', async ({ page }) => {
    const searchTextarea = page.locator('textarea[placeholder*="Where and when do you want to sail"]');
    
    // Fill search field
    await searchTextarea.fill('Multi-line\nsearch query');
    
    // Press Shift+Enter (should create new line, not submit)
    await searchTextarea.press('Shift+Enter');
    
    // Should still be on homepage
    await expect(page).toHaveURL('/');
    
    // Textarea should still contain the text
    const value = await searchTextarea.inputValue();
    expect(value).toContain('Multi-line');
  });

  test('should display owner CTA as disabled', async ({ page }) => {
    // Owner CTA button should be disabled (Coming Soon)
    const ownerCta = page.getByRole('button', { name: /Coming Soon/i });
    
    if (await ownerCta.count() > 0) {
      await expect(ownerCta).toBeDisabled();
    }
  });

  test('should have proper keyboard navigation', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Should focus on first interactive element (likely logo link or login button)
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should load background image', async ({ page }) => {
    // Check if background image is loaded (check for background-image style or img element)
    const body = page.locator('body');
    const backgroundImage = await body.evaluate((el) => {
      const bg = window.getComputedStyle(el).backgroundImage;
      return bg && bg !== 'none';
    });
    
    // Background image should be present (homepage has background image)
    expect(backgroundImage).toBeTruthy();
  });
});
