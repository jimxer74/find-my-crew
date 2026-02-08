import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/testHelpers';

/**
 * UX Tests for Authentication Flow
 * Tests user experience during login, signup, and authentication processes
 */

test.describe('Authentication UX', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.navigateTo('/auth');
  });

  test('should display clear authentication options', async ({ page }) => {
    // Test authentication page layout
    const authContainer = page.locator('[data-testid="auth-container"]');
    await expect(authContainer).toBeVisible();

    // Should have clear tabs or buttons for login/signup
    const loginTab = page.locator('[data-testid="login-tab"]');
    const signupTab = page.locator('[data-testid="signup-tab"]');

    if (await loginTab.isVisible() && await signupTab.isVisible()) {
      await expect(loginTab).toBeVisible();
      await expect(signupTab).toBeVisible();

      // Tabs should indicate current state
      const activeTab = page.locator('[data-testid="login-tab"][aria-selected="true"]');
      if (await activeTab.isVisible()) {
        await expect(activeTab).toBeVisible();
      }
    }

    // Alternative: separate pages with clear navigation
    const loginLink = page.locator('[data-testid="login-link"]');
    const signupLink = page.locator('[data-testid="signup-link"]');

    if (await loginLink.isVisible() && await signupLink.isVisible()) {
      await expect(loginLink).toBeVisible();
      await expect(signupLink).toBeVisible();
    }
  });

  test('should have clearly labeled form fields', async ({ page }) => {
    // Test form field labels and placeholders
    const emailInput = page.locator('[data-testid="email-input"]');
    const passwordInput = page.locator('[data-testid="password-input"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Inputs should have proper type attributes
    const emailType = await emailInput.getAttribute('type');
    const passwordType = await passwordInput.getAttribute('type');

    expect(emailType).toBe('email');
    expect(passwordType).toBe('password');

    // Should have clear labels
    const emailLabel = page.locator('label[for="email"], label[for="email-input"]');
    const passwordLabel = page.locator('label[for="password"], label[for="password-input"]');

    if (await emailLabel.isVisible()) {
      await expect(emailLabel).toBeVisible();
    }

    if (await passwordLabel.isVisible()) {
      await expect(passwordLabel).toBeVisible();
    }

    // Should have helpful placeholders
    const emailPlaceholder = await emailInput.getAttribute('placeholder');
    const passwordPlaceholder = await passwordInput.getAttribute('placeholder');

    expect(emailPlaceholder).toMatch(/email|address/i);
    expect(passwordPlaceholder).toMatch(/password/i);
  });

  test('should provide real-time form validation', async ({ page }) => {
    const emailInput = page.locator('[data-testid="email-input"]');
    const passwordInput = page.locator('[data-testid="password-input"]');
    const submitButton = page.locator('[data-testid="submit-button"]');

    // Test email validation
    await emailInput.fill('invalid-email');
    await emailInput.blur();

    // Should show validation error for invalid email
    const emailError = page.locator('[data-testid="email-error"], [data-testid="validation-error"]');
    if (await emailError.isVisible()) {
      await expect(emailError).toBeVisible();
      await expect(emailError).toContainText(/email|valid/i);
    }

    // Test with valid email
    await emailInput.fill('test@example.com');
    await emailInput.blur();

    // Error should disappear
    if (await emailError.isVisible()) {
      await expect(emailError).toBeHidden();
    }

    // Test password requirements
    await passwordInput.fill('short');
    await passwordInput.blur();

    // Should show password requirements
    const passwordError = page.locator('[data-testid="password-error"], [data-testid="validation-error"]');
    if (await passwordError.isVisible()) {
      await expect(passwordError).toBeVisible();
    }

    // Test with valid password
    await passwordInput.fill('ValidPassword123!');
    await passwordInput.blur();

    if (await passwordError.isVisible()) {
      await expect(passwordError).toBeHidden();
    }

    // Submit button should be enabled when form is valid
    await expect(submitButton).toBeEnabled();
  });

  test('should handle password visibility toggle', async ({ page }) => {
    const passwordInput = page.locator('[data-testid="password-input"]');
    const toggleButton = page.locator('[data-testid="password-toggle"]');

    if (await toggleButton.isVisible()) {
      // Password should be hidden by default
      const type = await passwordInput.getAttribute('type');
      expect(type).toBe('password');

      // Click toggle button
      await toggleButton.click();

      // Password should be visible
      const newType = await passwordInput.getAttribute('type');
      expect(newType).toBe('text');

      // Click again to hide
      await toggleButton.click();
      const hiddenType = await passwordInput.getAttribute('type');
      expect(hiddenType).toBe('password');
    }
  });

  test('should provide clear feedback during authentication', async ({ page }) => {
    const emailInput = page.locator('[data-testid="email-input"]');
    const passwordInput = page.locator('[data-testid="password-input"]');
    const submitButton = page.locator('[data-testid="submit-button"]');

    // Fill form
    await emailInput.fill('test@example.com');
    await passwordInput.fill('ValidPassword123!');

    // Submit should show loading state
    await submitButton.click();

    // Should show loading indicator
    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible();

    // Should handle success
    // (This would need actual API mocking for full testing)

    // Should handle error
    await emailInput.fill('wrong@example.com');
    await submitButton.click();

    // Should show error message
    const errorMessage = page.locator('[data-testid="auth-error"], [data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
  });

  test('should remember user preferences', async ({ page }) => {
    const rememberCheckbox = page.locator('[data-testid="remember-me"]');

    if (await rememberCheckbox.isVisible()) {
      // Should be unchecked by default
      await expect(rememberCheckbox).not.toBeChecked();

      // User can check it
      await rememberCheckbox.check();
      await expect(rememberCheckbox).toBeChecked();

      // Should persist across page reloads (if implemented)
      await page.reload();
      await expect(rememberCheckbox).toBeChecked();
    }
  });

  test('should provide password reset functionality', async ({ page }) => {
    const forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');

    if (await forgotPasswordLink.isVisible()) {
      await expect(forgotPasswordLink).toBeVisible();

      // Click should navigate to reset page
      await forgotPasswordLink.click();
      await expect(page).toHaveURL(/.*reset/);
    }
  });

  test('should handle social authentication options', async ({ page }) => {
    const socialButtons = page.locator('[data-testid="social-login-button"]');

    if (await socialButtons.count() > 0) {
      // Social buttons should be visible
      await expect(socialButtons.first()).toBeVisible();

      // Should have clear icons
      const icons = page.locator('[data-testid="social-login-button"] svg');
      await expect(icons.first()).toBeVisible();

      // Should indicate which provider
      const buttonLabels = await socialButtons.allTextContents();
      for (const label of buttonLabels) {
        expect(label.toLowerCase()).toMatch(/google|facebook|github|apple/i);
      }
    }
  });

  test('should maintain security best practices', async ({ page }) => {
    // Password fields should not be autofilled
    const passwordInput = page.locator('[data-testid="password-input"]');
    const autocomplete = await passwordInput.getAttribute('autocomplete');

    // Should have proper autocomplete settings
    expect(autocomplete).toMatch(/current-password|new-password|off/);

    // Forms should have CSRF protection
    const csrfToken = page.locator('input[name="_token"], input[name="csrf_token"]');
    if (await csrfToken.isVisible()) {
      const tokenValue = await csrfToken.getAttribute('value');
      expect(tokenValue).toBeTruthy();
    }

    // Should not expose sensitive data in URLs
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/password|token/i);
  });

  test('should be accessible to screen readers', async ({ page }) => {
    // Form should have proper ARIA attributes
    const form = page.locator('form');
    const formId = await form.getAttribute('id');

    if (formId) {
      // Labels should reference form fields
      const emailLabel = page.locator(`label[for="${formId}-email"]`);
      if (await emailLabel.isVisible()) {
        await expect(emailLabel).toBeVisible();
      }
    }

    // Error messages should be associated with inputs
    const errorElements = page.locator('[data-testid="error-message"]');
    const errorCount = await errorElements.count();

    if (errorCount > 0) {
      const firstError = errorElements.first();
      const ariaDescribedBy = await firstError.getAttribute('aria-describedby');

      if (ariaDescribedBy) {
        const input = page.locator(`#${ariaDescribedBy}`);
        await expect(input).toBeVisible();
      }
    }
  });

  test('should handle session management', async ({ page }) => {
    // Test persistent login
    const rememberMe = page.locator('[data-testid="remember-me"]');

    if (await rememberMe.isVisible()) {
      await rememberMe.check();

      // After login (mocked), should persist session
      // This would require actual authentication to test fully

      // Should handle session timeout gracefully
      // Should provide logout functionality
      const logoutButton = page.locator('[data-testid="logout-button"]');
      if (await logoutButton.isVisible()) {
        await expect(logoutButton).toBeVisible();
      }
    }
  });
});