// spec: Phase 1 Crew Role Tests - Suite 4: Filters
// seed: tests/seed.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';
import { setCookieConsentBeforeNavigation } from '../fixtures/cookieHelper';

/**
 * Mock Supabase auth so the user appears as an authenticated crew member.
 * The filter button in the Header only renders for authenticated crew users.
 * We inject the session into localStorage before any page scripts run.
 */
async function mockCrewUser(page: Page): Promise<void> {
  const mockUser = {
    id: 'test-crew-001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'crewtest@example.com',
    email_confirmed_at: '2025-01-01T00:00:00.000Z',
    confirmed_at: '2025-01-01T00:00:00.000Z',
    last_sign_in_at: '2025-01-01T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    // Include roles in user_metadata so UserRoleContext picks it up immediately
    user_metadata: { full_name: 'Crew Tester', roles: ['crew'] },
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };

  const mockSession = {
    access_token: 'mock-crew-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-crew-refresh-token',
    user: mockUser,
  };

  // Inject the session into localStorage before any scripts run
  await page.addInitScript((session) => {
    try {
      localStorage.setItem(
        'sb-zyofbhkvkpygruriubjn-auth-token',
        JSON.stringify(session)
      );
    } catch {
      // Ignore storage errors in the test environment
    }
  }, mockSession);

  // Mock Supabase auth endpoints so session refresh calls succeed
  await page.route('**/auth/v1/**', async (route: Route) => {
    const url = route.request().url();
    if (url.includes('/token') || url.includes('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          url.includes('/user') ? mockUser : mockSession
        ),
      });
    } else {
      await route.continue();
    }
  });

  // Mock Supabase profiles table (for FiltersDialog to load profile data)
  await page.route('**/rest/v1/profiles**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

/** Minimal valid Mapbox GL style that allows map initialization without full tile loading. */
const MINIMAL_MAPBOX_STYLE = JSON.stringify({
  version: 8,
  name: 'test-style',
  metadata: {},
  center: [0, 20],
  zoom: 2,
  bearing: 0,
  pitch: 0,
  sources: {},
  layers: [],
});

async function setupFilterBaseMocks(page: Page): Promise<void> {
  // Provide a minimal valid Mapbox style so the map can initialize (fires 'load' event)
  await page.route('https://api.mapbox.com/styles/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MINIMAL_MAPBOX_STYLE,
    });
  });
  // Abort tile/event requests to reduce network noise
  await page.route('https://api.mapbox.com/v4/**', async (route: Route) => {
    await route.abort();
  });
  await page.route('https://events.mapbox.com/**', async (route: Route) => {
    await route.abort();
  });
  await page.route('**/api/legs/viewport**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ legs: [] }),
    });
  });
}

/** Open the FiltersDialog by clicking the search/filter button in the header. */
async function openFilterDialog(page: Page): Promise<void> {
  // Header renders a button with aria-label starting with "Search"
  // This button is only visible for authenticated users with 'crew' role
  const filterBtn = page.getByRole('button', { name: /^Search/i }).first();
  await expect(filterBtn).toBeVisible({ timeout: 15000 });
  await filterBtn.click();

  // FiltersDialog renders a panel heading "Search" (from t('search'))
  await expect(
    page.getByRole('heading', { name: /^Search$/i }).first()
  ).toBeVisible({ timeout: 5000 });
}

test.describe('Filters', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    // Set cookie consent before navigation to prevent banner from appearing
    await setCookieConsentBeforeNavigation(page);
    // Mock authenticated crew user so the filter button is visible
    await mockCrewUser(page);
  });

  // TC-50
  test('filter dialog opens when clicking the search button in the header', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);
    await expect(page.getByRole('heading', { name: /^Search$/i }).first()).toBeVisible();
  });

  // TC-51
  test('filter dialog contains the availability date range picker button', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);
    // FiltersPageContent renders a button with aria-label="Select date range"
    await expect(
      page.getByRole('button', { name: /select date range/i })
    ).toBeVisible({ timeout: 5000 });
  });

  // TC-52
  test('filter dialog contains a departure location autocomplete input', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);
    // LocationAutocomplete is rendered with id="filter-departure-location"
    await expect(page.locator('#filter-departure-location')).toBeVisible({ timeout: 5000 });
  });

  // TC-53
  test('filter dialog contains an arrival location autocomplete input', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);
    // LocationAutocomplete is rendered with id="filter-arrival-location"
    await expect(page.locator('#filter-arrival-location')).toBeVisible({ timeout: 5000 });
  });

  // TC-54
  test('clicking the date range button opens the DateRangePicker calendar', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    // Click the date range button
    await page.getByRole('button', { name: /select date range/i }).click();

    // DateRangePicker is rendered inside a fixed-position overlay at z-[9999]
    // It contains month/year navigation and calendar cells
    const calendarOverlay = page.locator('.fixed').filter({
      hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/,
    }).first();
    await expect(calendarOverlay).toBeVisible({ timeout: 5000 });
  });

  // TC-55
  test('typing in the departure location input shows the input is interactive', async ({ page }) => {
    await setupFilterBaseMocks(page);

    // Mock Mapbox geocoding for autocomplete suggestions
    await page.route('https://api.mapbox.com/geocoding/**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          features: [
            {
              place_name: 'Barcelona, Catalonia, Spain',
              center: [2.17, 41.38],
            },
          ],
        }),
      });
    });

    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    const departureInput = page.locator('#filter-departure-location');
    await departureInput.fill('Barcelona');

    // Verify the input accepted the typed text
    await expect(departureInput).toHaveValue('Barcelona');
  });

  // TC-56
  test('experience level section is present in the filter dialog', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    // FiltersPageContent places SkillLevelSelector in Card 2 (second .bg-card.rounded-lg)
    // The card is present even before the profile data loads
    const cards = page.locator('.bg-card.rounded-lg.border');
    await expect(cards.nth(1)).toBeVisible({ timeout: 5000 });
  });

  // TC-57
  test('risk level selector shows Coastal, Offshore, and Extreme sailing options', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    // RiskLevelSelector renders the three risk level labels
    await expect(page.getByText(/Coastal/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Offshore/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Extreme/i).first()).toBeVisible({ timeout: 5000 });
  });

  // TC-58
  test('"Save & Search" (or equivalent) button is present in the filter dialog footer', async ({
    page,
  }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    // FiltersPageContent renders a sticky footer button from tFilters('saveAndSearch') = "Search"
    const saveBtn = page.getByRole('button', { name: /save.*search|search/i }).last();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });

  // TC-59
  test('"Clear all" button is present in the filter dialog header', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    // The dialog header renders a "Clear all" button via t('clearAll')
    await expect(page.getByRole('button', { name: /clear all/i })).toBeVisible({ timeout: 5000 });
  });

  // TC-60
  test('pressing Escape closes the filter dialog', async ({ page }) => {
    await setupFilterBaseMocks(page);
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await openFilterDialog(page);

    // Verify dialog is open
    await expect(
      page.getByRole('heading', { name: /^Search$/i }).first()
    ).toBeVisible();

    // FiltersDialog listens for the Escape key and calls onClose()
    await page.keyboard.press('Escape');

    // Dialog should be removed from the DOM (if (!isOpen) return null)
    await expect(page.getByRole('heading', { name: /^Search$/i })).toHaveCount(0, {
      timeout: 3000,
    });
  });

  // TC-61
  test('saving filters while on /crew navigates to the dashboard', async ({ page }) => {
    await setupFilterBaseMocks(page);

    // Mock region API for the crew home page
    await page.route('**/api/legs/by-region**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: [] }),
      });
    });

    // Start on the crew home page (not the dashboard)
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await openFilterDialog(page);

    // Click Save & Search – handleSave() calls router.push('/crew/dashboard')
    // when pathname !== '/crew/dashboard'
    const saveBtn = page.getByRole('button', { name: /save.*search|search/i }).last();
    await saveBtn.click();

    await expect(page).toHaveURL(/\/crew\/dashboard/, { timeout: 5000 });
  });
});
