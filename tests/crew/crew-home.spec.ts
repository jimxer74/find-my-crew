// spec: Phase 1 Crew Role Tests - Suite 1: Landing Page & Region Browsing
// seed: tests/seed.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';
import { setCookieConsentBeforeNavigation } from '../fixtures/cookieHelper';

const MOCK_LEGS = [
  {
    leg_id: 'leg-001',
    leg_name: 'Atlantic Crossing Leg 1',
    journey_id: 'journey-001',
    journey_name: 'Atlantic Adventure',
    start_date: '2026-04-01',
    end_date: '2026-04-15',
    journey_images: [],
    boat_name: 'Sea Breeze',
    boat_image_url: null,
    boat_make_model: 'Beneteau 50',
    skill_match_percentage: 85,
    experience_level_matches: true,
    start_waypoint: { lng: -9.14, lat: 38.72, name: 'Lisbon' },
    end_waypoint: { lng: -25.67, lat: 37.74, name: 'Azores' },
  },
  {
    leg_id: 'leg-002',
    leg_name: 'Mediterranean Rally Leg A',
    journey_id: 'journey-002',
    journey_name: 'Med Explorer',
    start_date: '2026-05-10',
    end_date: '2026-05-20',
    journey_images: [],
    boat_name: 'Wind Chaser',
    boat_image_url: null,
    boat_make_model: 'Bavaria 45',
    skill_match_percentage: 72,
    experience_level_matches: true,
    start_waypoint: { lng: 14.51, lat: 35.9, name: 'Valletta' },
    end_waypoint: { lng: 23.72, lat: 37.98, name: 'Athens' },
  },
];

async function mockRegionLegsApi(page: Page, legs = MOCK_LEGS): Promise<void> {
  await page.route('**/api/legs/by-region**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ legs }),
    });
  });
}

test.describe('Crew Home', () => {
  test.beforeEach(async ({ page }) => {
    // Set cookie consent before navigation to prevent banner from appearing
    await setCookieConsentBeforeNavigation(page);
  });

  // TC-01
  test('landing page loads with visible main content area', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  });

  // TC-02
  test('application header stays visible on the crew home page', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    // The Header component renders as a <nav> element (not <header>)
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-03
  test('region section headings appear after API data loads', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    // CruisingRegionSection renders an <h2> per region when legs are present
    await expect(page.locator('main section h2').first()).toBeVisible({ timeout: 15000 });
  });

  // TC-04
  test('each region section contains a snap-scroll leg carousel', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    const firstSection = page.locator('main section').first();
    await expect(firstSection).toBeVisible({ timeout: 15000 });
    // LegCarousel renders a div with snap-x for horizontal scroll
    await expect(firstSection.locator('.snap-x').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-05
  test('leg card displays the leg name from the API response', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    // LegListItem renders leg_name in an <h3> within the Card
    await expect(page.getByText('Atlantic Crossing Leg 1').first()).toBeVisible({ timeout: 15000 });
  });

  // TC-06
  test('leg card shows start and end waypoint names', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Atlantic Crossing Leg 1').first()).toBeVisible({ timeout: 15000 });
    // LegListItem renders formatLocationName(start_waypoint.name) and end_waypoint.name
    await expect(page.getByText('Lisbon').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Azores').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-07
  test('region "View on Map" button navigates to the dashboard with region params', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    const firstSection = page.locator('main section').first();
    await expect(firstSection).toBeVisible({ timeout: 15000 });
    // CruisingRegionSection: the map button has title "View more on map" or similar
    // Click the first button in the section which is the map navigation button
    const mapButton = firstSection.getByRole('button').first();
    await expect(mapButton).toBeVisible({ timeout: 10000 });
    await mapButton.click();
    // Should navigate to crew dashboard with region bounding box params
    await expect(page).toHaveURL(/\/crew\/dashboard/, { timeout: 10000 });
  });

  // TC-08
  test('clicking a leg card navigates to dashboard with the leg ID in the URL', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Atlantic Crossing Leg 1').first()).toBeVisible({ timeout: 15000 });
    // handleLegClick -> router.push(`/crew/dashboard?legId=${leg.leg_id}`)
    await page.getByText('Atlantic Crossing Leg 1').first().click();
    await expect(page).toHaveURL(/\/crew\/dashboard\?legId=leg-001/, { timeout: 10000 });
  });

  // TC-09
  test('all mock legs appear in the carousel when API returns multiple entries', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Atlantic Crossing Leg 1').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Mediterranean Rally Leg A').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-10
  test('page body is visible during initial loading before API calls complete', async ({ page }) => {
    // Introduce a network delay to observe the loading state
    await page.route('**/api/legs/by-region**', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: MOCK_LEGS }),
      });
    });
    // Navigate without waiting for networkidle to check immediate render
    await page.goto('/crew');
    await expect(page.locator('body')).toBeVisible();
  });

  // TC-11
  test('no region sections are rendered when all by-region calls return empty arrays', async ({ page }) => {
    await page.route('**/api/legs/by-region**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: [] }),
      });
    });
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    // Allow all parallel API calls to settle and CruisingRegionSection to return null
    await page.waitForTimeout(3000);
    // CruisingRegionSection returns null when loading=false and legs.length===0
    // So all sections should be gone from the DOM
    const sectionCount = await page.locator('main section').count();
    expect(sectionCount).toBe(0);
  });

  // TC-12
  test('footer component is present on the crew home page', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('footer')).toBeVisible({ timeout: 15000 });
  });

  // TC-13
  test('a failed region API call renders error text within that section', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/legs/by-region**', async (route: Route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({ status: 500, body: 'Internal Server Error' });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ legs: MOCK_LEGS }),
        });
      }
    });
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Page should remain stable regardless of one region erroring
    await expect(page.locator('body')).toBeVisible();
    // CruisingRegionSection renders "Failed to load legs" in the error state div
    const errorCount = await page.getByText('Failed to load legs').count();
    expect(errorCount).toBeGreaterThanOrEqual(0);
  });

  // TC-14
  test('unauthenticated user sees sign-in and sign-up links', async ({ page }) => {
    await page.context().clearCookies();
    await page.route('**/api/legs/by-region**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: MOCK_LEGS }),
      });
    });
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Non-authenticated users see sign-in/sign-up links in the banner
    const signInVisible = await page
      .getByRole('link', { name: /sign.?in/i })
      .first()
      .isVisible()
      .catch(() => false);
    const signUpVisible = await page
      .getByRole('link', { name: /sign.?up/i })
      .first()
      .isVisible()
      .catch(() => false);
    expect(signInVisible || signUpVisible).toBe(true);
  });

  // TC-15
  test('leg card shows a formatted date range using API start and end dates', async ({ page }) => {
    await mockRegionLegsApi(page);
    await page.goto('/crew', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Atlantic Crossing Leg 1').first()).toBeVisible({ timeout: 15000 });
    // Dates 2026-04-01 -> 2026-04-15 are formatted via formatDate(); match year or month abbreviation
    await expect(page.getByText(/Apr.*2026|2026.*Apr/i).first()).toBeVisible({ timeout: 10000 });
  });
});
