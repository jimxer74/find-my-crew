import { type Page } from '@playwright/test';

/**
 * Helper to set cookie preferences in localStorage before page load.
 * This prevents the cookie consent banner from appearing in tests.
 * Also grants geolocation permission and sets a mock location so the crew home page
 * does not get stuck showing "Detecting your location..." (useUserLocation has a
 * 10-second timeout before falling back to a default location).
 */
export async function setCookieConsentBeforeNavigation(page: Page): Promise<void> {
  // Grant geolocation permission so the crew page does not wait for user prompt/timeout
  try {
    await page.context().grantPermissions(['geolocation']);
    // Use Mediterranean coordinates (the app default fallback location)
    await page.context().setGeolocation({ latitude: 41.9028, longitude: 12.4964 });
  } catch {
    // Ignore errors – some browsers may not support this in the test environment
  }

  // Set the cookie consent in localStorage before any navigation
  await page.addInitScript(() => {
    const cookieConsent = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    localStorage.setItem('cookie_consent', JSON.stringify(cookieConsent));
  });
}

/**
 * Helper to dismiss the cookie consent banner if it appears
 * Clicks "Reject All" to dismiss it
 */
export async function dismissCookieConsentBanner(page: Page): Promise<void> {
  // Check if the banner is visible and dismiss it
  const rejectButton = page.getByRole('button', { name: 'Reject All' });
  const isVisible = await rejectButton.isVisible().catch(() => false);

  if (isVisible) {
    await rejectButton.click();
    // Wait for the banner to disappear
    await page.waitForTimeout(500);
  }
}
