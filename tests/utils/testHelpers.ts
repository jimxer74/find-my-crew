/**
 * Test utilities and helper functions for SailSmart Playwright tests
 */

import { Page, expect } from '@playwright/test';
import { selectors } from './selectors';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to a page and wait for it to load
   */
  async navigateTo(path: string) {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * Fill form fields with provided data
   */
  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      const input = this.page.locator(`[name="${field}"]`);
      await input.fill(value);
    }
  }

  /**
   * Submit a form
   */
  async submitForm(formSelector: string = 'form') {
    const form = this.page.locator(formSelector);
    await form.evaluate((el: HTMLFormElement) => el.submit());
    await this.waitForPageLoad();
  }

  /**
   * Check if element exists and is visible
   */
  async expectElementToBeVisible(selector: string) {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
  }

  /**
   * Check if element exists and is hidden
   */
  async expectElementToBeHidden(selector: string) {
    const element = this.page.locator(selector);
    await expect(element).toBeHidden();
  }

  /**
   * Check if element contains specific text
   */
  async expectElementToContainText(selector: string, text: string) {
    const element = this.page.locator(selector);
    await expect(element).toContainText(text);
  }

  /**
   * Click an element and wait for navigation
   */
  async clickAndWait(selector: string) {
    const element = this.page.locator(selector);
    await Promise.all([
      this.page.waitForNavigation(),
      element.click(),
    ]);
  }

  /**
   * Type text into an input field
   */
  async typeText(selector: string, text: string) {
    const element = this.page.locator(selector);
    await element.fill(text);
  }

  /**
   * Select an option from a dropdown
   */
  async selectOption(selector: string, value: string) {
    const element = this.page.locator(selector);
    await element.selectOption(value);
  }

  /**
   * Check a checkbox
   */
  async checkCheckbox(selector: string) {
    const element = this.page.locator(selector);
    await element.check();
  }

  /**
   * Uncheck a checkbox
   */
  async uncheckCheckbox(selector: string) {
    const element = this.page.locator(selector);
    await element.uncheck();
  }

  /**
   * Get text content of an element
   */
  async getTextContent(selector: string): Promise<string | null> {
    const element = this.page.locator(selector);
    return await element.textContent();
  }

  /**
   * Get value of an input field
   */
  async getInputValue(selector: string): Promise<string | null> {
    const element = this.page.locator(selector);
    return await element.inputValue();
  }

  /**
   * Wait for a toast message to appear
   */
  async waitForToast(message?: string) {
    const toast = this.page.locator(selectors.ui.toast);
    await expect(toast).toBeVisible();

    if (message) {
      await expect(toast).toContainText(message);
    }
  }

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingToFinish() {
    const spinner = this.page.locator(selectors.ui.loadingSpinner);
    await expect(spinner).toBeHidden();
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom() {
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop() {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  /**
   * Clear all cookies and local storage
   */
  async clearSession() {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Mock API responses
   */
  async mockApiResponse(url: string, response: any) {
    await this.page.route(url, route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Wait for network requests to complete
   */
  async waitForNetworkIdle(timeout: number = 5000) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }
}