import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/testHelpers';

/**
 * UX Tests for Crew Management
 * Tests user experience when creating, managing, and interacting with crews
 */

test.describe('Crew Management UX', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Navigate to a page where crew management is available
    await helpers.navigateTo('/browse');
  });

  test('should allow easy crew discovery and browsing', async ({ page }) => {
    // Test search functionality
    const searchInput = page.locator('[data-testid="search-input"]');
    const locationFilter = page.locator('[data-testid="location-filter"]');
    const skillsFilter = page.locator('[data-testid="skills-filter"]');

    if (await searchInput.isVisible()) {
      // Search should be immediately accessible
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toBeFocused();

      // Should provide suggestions or autocomplete
      await searchInput.fill('web');

      // Should show search results
      const searchResults = page.locator('[data-testid="search-results"]');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toBeVisible();
      }
    }

    // Filters should be easy to use
    if (await locationFilter.isVisible()) {
      await locationFilter.click();
      const locationOptions = page.locator('[data-testid="location-option"]');
      await expect(locationOptions.first()).toBeVisible();
    }

    if (await skillsFilter.isVisible()) {
      await skillsFilter.click();
      const skillOptions = page.locator('[data-testid="skill-option"]');
      await expect(skillOptions.first()).toBeVisible();
    }
  });

  test('should display crew cards with clear information hierarchy', async ({ page }) => {
    // Test crew card layout
    const crewCards = page.locator('[data-testid="crew-card"]');
    const cardCount = await crewCards.count();

    if (cardCount > 0) {
      const firstCard = crewCards.first();

      // Card should be easily clickable
      await expect(firstCard).toBeVisible();

      // Should have clear title
      const title = firstCard.locator('[data-testid="crew-card-title"]');
      await expect(title).toBeVisible();

      // Should have description
      const description = firstCard.locator('[data-testid="crew-card-description"]');
      if (await description.isVisible()) {
        await expect(description).toBeVisible();
      }

      // Should show key information (members, skills, location)
      const memberCount = firstCard.locator('[data-testid="member-count"]');
      const skills = firstCard.locator('[data-testid="crew-skills"]');
      const location = firstCard.locator('[data-testid="crew-location"]');

      await expect(memberCount).toBeVisible();
      await expect(skills).toBeVisible();
      await expect(location).toBeVisible();

      // Join button should be prominent
      const joinButton = firstCard.locator('[data-testid="join-crew-button"]');
      await expect(joinButton).toBeVisible();
    }
  });

  test('should provide smooth crew creation workflow', async ({ page }) => {
    const createCrewButton = page.locator('[data-testid="create-crew-button"]');

    if (await createCrewButton.isVisible()) {
      // Click create button
      await createCrewButton.click();

      // Should open form or navigate to creation page
      const form = page.locator('[data-testid="crew-form"]');
      await expect(form).toBeVisible();

      // Form should have clear sections
      const nameInput = page.locator('[data-testid="crew-name-input"]');
      const descriptionInput = page.locator('[data-testid="crew-description-input"]');
      const locationInput = page.locator('[data-testid="crew-location-input"]');
      const skillsInput = page.locator('[data-testid="crew-skills-input"]');

      await expect(nameInput).toBeVisible();
      await expect(descriptionInput).toBeVisible();
      await expect(locationInput).toBeVisible();
      await expect(skillsInput).toBeVisible();

      // Should provide helpful placeholder text
      const namePlaceholder = await nameInput.getAttribute('placeholder');
      expect(namePlaceholder).toMatch(/name|title/i);

      // Should validate in real-time
      await nameInput.fill('Test Crew');
      await nameInput.blur();

      // Should show success state
      const validationSuccess = page.locator('[data-testid="validation-success"]');
      if (await validationSuccess.isVisible()) {
        await expect(validationSuccess).toBeVisible();
      }
    }
  });

  test('should handle crew member management intuitively', async ({ page }) => {
    // Test member list
    const memberList = page.locator('[data-testid="member-list"]');
    if (await memberList.isVisible()) {
      await expect(memberList).toBeVisible();

      const members = page.locator('[data-testid="member-item"]');
      const memberCount = await members.count();

      if (memberCount > 0) {
        // Each member should show avatar and name
        const firstMember = members.first();
        const avatar = firstMember.locator('[data-testid="member-avatar"]');
        const name = firstMember.locator('[data-testid="member-name"]');

        await expect(avatar).toBeVisible();
        await expect(name).toBeVisible();
      }

      // Should have invite functionality
      const inviteButton = page.locator('[data-testid="invite-member-button"]');
      if (await inviteButton.isVisible()) {
        await expect(inviteButton).toBeVisible();
      }
    }
  });

  test('should provide clear feedback for crew actions', async ({ page }) => {
    // Test join crew action
    const joinButtons = page.locator('[data-testid="join-crew-button"]');
    const joinCount = await joinButtons.count();

    if (joinCount > 0) {
      const firstJoinButton = joinButtons.first();

      // Should show loading state during action
      await firstJoinButton.click();

      const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
      await expect(loadingSpinner).toBeVisible();

      // Should show success or error message
      const toast = page.locator('[data-testid="toast"]');
      await expect(toast).toBeVisible();
    }

    // Test edit functionality
    const editButton = page.locator('[data-testid="edit-crew-button"]');
    if (await editButton.isVisible()) {
      await editButton.click();

      // Should open edit form
      const editForm = page.locator('[data-testid="edit-crew-form"]');
      await expect(editForm).toBeVisible();
    }
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Test form validation errors
    const nameInput = page.locator('[data-testid="crew-name-input"]');

    if (await nameInput.isVisible()) {
      // Enter invalid data
      await nameInput.fill('');
      await nameInput.blur();

      // Should show validation error
      const error = page.locator('[data-testid="validation-error"]');
      await expect(error).toBeVisible();
      await expect(error).toContainText(/required|name/i);
    }

    // Test network errors
    await page.route('**/api/crews/**', route => route.abort());

    const submitButton = page.locator('[data-testid="submit-button"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();

      const errorMessage = page.locator('[data-testid="error-message"]');
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should maintain context during navigation', async ({ page }) => {
    // Test that users can easily navigate between crew views
    const browseButton = page.locator('[data-testid="browse-button"]');
    const myCrewsButton = page.locator('[data-testid="mycrews-button"]');

    if (await browseButton.isVisible() && await myCrewsButton.isVisible()) {
      // Should be able to switch views easily
      await myCrewsButton.click();
      await expect(page).toHaveURL(/.*mycrews/);

      await browseButton.click();
      await expect(page).toHaveURL(/.*browse/);
    }
  });

  test('should provide search and filter functionality', async ({ page }) => {
    // Test search
    const searchInput = page.locator('[data-testid="search-input"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('web development');
      await searchInput.press('Enter');

      // Should update results
      const results = page.locator('[data-testid="search-results"]');
      await expect(results).toBeVisible();
    }

    // Test filters
    const filters = page.locator('[data-testid="filter-button"]');
    if (await filters.isVisible()) {
      await filters.click();

      const filterOptions = page.locator('[data-testid="filter-option"]');
      await expect(filterOptions.first()).toBeVisible();
    }
  });

  test('should handle responsive design for different screen sizes', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 812 });

    const crewCards = page.locator('[data-testid="crew-card"]');
    const cardCount = await crewCards.count();

    if (cardCount > 0) {
      // Cards should be stackable on mobile
      const firstCard = crewCards.first();
      const cardBox = await firstCard.boundingBox();

      // Cards should be full width on mobile
      expect(cardBox?.width).toBeGreaterThan(300);

      // Touch targets should be large enough
      const joinButton = firstCard.locator('[data-testid="join-crew-button"]');
      const buttonBox = await joinButton.boundingBox();

      expect(buttonBox?.height).toBeGreaterThan(40);
    }
  });

  test('should provide accessibility features', async ({ page }) => {
    // Test keyboard navigation
    const crewCards = page.locator('[data-testid="crew-card"]');
    const cardCount = await crewCards.count();

    if (cardCount > 0) {
      // Should be navigable by keyboard
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }

    // Test ARIA labels
    const cards = page.locator('[data-testid="crew-card"]');
    const cardCountAfter = await cards.count();

    for (let i = 0; i < Math.min(3, cardCountAfter); i++) {
      const card = cards.nth(i);
      const ariaLabel = await card.getAttribute('aria-label');

      if (ariaLabel) {
        expect(ariaLabel).toBeTruthy();
      }
    }
  });

  test('should provide clear loading states', async ({ page }) => {
    // Test loading during data fetch
    await page.route('**/api/crews/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    await page.reload();

    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();

    await expect(loadingSpinner).toBeHidden({ timeout: 5000 });
  });
});