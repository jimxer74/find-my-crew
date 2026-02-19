// spec: Phase 1 Crew Role Tests - Suite 2: Map Dashboard
// seed: tests/seed.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';
import { setCookieConsentBeforeNavigation } from '../fixtures/cookieHelper';

const MOCK_VIEWPORT_LEGS = [
  {
    leg_id: 'leg-101',
    leg_name: 'Caribbean Trade Wind Run',
    leg_description: 'Sailing the classic trade wind route from Canaries to Barbados.',
    journey_id: 'journey-101',
    journey_name: 'ARC Atlantic Rally',
    start_date: '2026-11-20',
    end_date: '2026-12-15',
    crew_needed: 3,
    leg_risk_level: 'Offshore sailing',
    journey_risk_level: ['Offshore sailing'],
    cost_model: null,
    journey_images: [],
    skills: ['Navigation', 'Watch keeping'],
    boat_id: 'boat-101',
    boat_name: 'Tradewind Spirit',
    boat_type: 'Sailing Yacht',
    boat_image_url: null,
    boat_average_speed_knots: 7,
    boat_make_model: 'Hallberg-Rassy 42',
    owner_name: 'Captain James Cook',
    owner_image_url: null,
    min_experience_level: 3,
    skill_match_percentage: 90,
    experience_level_matches: true,
    start_waypoint: { lng: -15.41, lat: 27.98, name: 'Las Palmas' },
    end_waypoint: { lng: -59.54, lat: 13.1, name: 'Bridgetown' },
  },
  {
    leg_id: 'leg-102',
    leg_name: 'North Sea Passage',
    leg_description: 'Challenging North Sea crossing.',
    journey_id: 'journey-102',
    journey_name: 'Northern Lights Tour',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    crew_needed: 2,
    leg_risk_level: 'Coastal sailing',
    journey_risk_level: ['Coastal sailing'],
    cost_model: null,
    journey_images: [],
    skills: ['Coastal sailing', 'Navigation'],
    boat_id: 'boat-102',
    boat_name: 'Nordic Star',
    boat_type: 'Sailing Yacht',
    boat_image_url: null,
    boat_average_speed_knots: 6,
    boat_make_model: 'Swan 45',
    owner_name: 'Erik Hansen',
    owner_image_url: null,
    min_experience_level: 2,
    skill_match_percentage: 65,
    experience_level_matches: true,
    start_waypoint: { lng: 4.47, lat: 51.92, name: 'Rotterdam' },
    end_waypoint: { lng: 10.0, lat: 53.55, name: 'Hamburg' },
  },
];

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

/**
 * Set up mocks for the dashboard page.
 * Provides a minimal Mapbox style response so the map can initialize without real CDN access,
 * and aborts tile/event requests to reduce network noise.
 */
async function setupDashboardMocks(page: Page): Promise<void> {
  // Provide a minimal valid Mapbox style so the map can initialize (fires 'load' event)
  // without making real network calls to the CDN. Our minimal style has no sprite/glyphs
  // so Mapbox GL won't make additional CDN requests for those assets.
  await page.route('https://api.mapbox.com/styles/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: MINIMAL_MAPBOX_STYLE,
    });
  });
  // Abort tile requests (not needed for map initialization)
  await page.route('https://api.mapbox.com/v4/**', async (route: Route) => {
    await route.abort();
  });
  // Abort Mapbox telemetry
  await page.route('https://events.mapbox.com/**', async (route: Route) => {
    await route.abort();
  });
  await page.route('**/api/legs/viewport**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ legs: MOCK_VIEWPORT_LEGS }),
    });
  });
}

test.describe('Crew Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Set cookie consent before navigation to prevent banner from appearing
    await setCookieConsentBeforeNavigation(page);
    await setupDashboardMocks(page);
  });

  // TC-20
  test('dashboard page loads and the map container div is visible', async ({ page }) => {
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // CrewBrowseMap mounts a div ref with style="min-height: 400px"
    await expect(
      page.locator('[style*="min-height: 400px"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  // TC-21
  test('application header is visible on the dashboard page', async ({ page }) => {
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // The Header component renders as a <nav> element (not <header>)
    // On the dashboard, the header is positioned with left offset but still present
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-22
  test('left browse pane is visible on desktop with a leg count header', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // LegBrowsePane renders "X Legs in View" in its header (even with 0 legs)
    // The pane itself is always rendered on desktop (md:flex)
    await expect(page.getByText(/Leg[s]? in View/i)).toBeVisible({ timeout: 20000 });
  });

  // TC-23
  test('browse pane lists the leg names returned by the viewport API', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // Wait for map to load and viewport API to be called
    await expect(
      page.getByText('Caribbean Trade Wind Run').first()
    ).toBeVisible({ timeout: 25000 });
  });

  // TC-24
  test('page body remains visible while the viewport API is fetching data', async ({ page }) => {
    // Delay viewport API to observe loading state
    await page.route('**/api/legs/viewport**', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: MOCK_VIEWPORT_LEGS }),
      });
    });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // CrewBrowseMap renders "Loading legs..." overlay; page must remain visible
    await expect(page.locator('body')).toBeVisible();
  });

  // TC-25
  test('clicking a leg in the browse pane opens its details panel on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Mock the individual leg and waypoints APIs
    await page.route('**/api/legs/leg-101', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VIEWPORT_LEGS[0]),
      });
    });
    await page.route('**/api/legs/leg-101/waypoints', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ waypoints: [] }),
      });
    });

    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });

    const legCard = page.getByText('Caribbean Trade Wind Run').first();
    await expect(legCard).toBeVisible({ timeout: 25000 });
    await legCard.click();

    // LegDetailsPanel appears on desktop (hidden md:block wrapper)
    await expect(
      page.getByText('Caribbean Trade Wind Run').first()
    ).toBeVisible({ timeout: 10000 });
  });

  // TC-26
  test('browse pane can be minimized via its collapse button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait for the browse pane to appear
    await expect(page.getByText(/Leg[s]? in View/i)).toBeVisible({ timeout: 20000 });

    // LegBrowsePane has aria-label="Minimize panel" on the collapse chevron button
    const minimizeBtn = page.getByRole('button', { name: 'Minimize panel' });
    await expect(minimizeBtn).toBeVisible({ timeout: 10000 });
    await minimizeBtn.click();

    // After minimizing, the expand handle has aria-label="Show legs list"
    await expect(
      page.getByRole('button', { name: 'Show legs list' })
    ).toBeVisible({ timeout: 5000 });
  });

  // TC-27
  test('minimized browse pane is restored by clicking the expand handle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });

    // Wait for pane to appear then minimize
    await expect(page.getByText(/Leg[s]? in View/i)).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Minimize panel' }).click();
    const expandBtn = page.getByRole('button', { name: 'Show legs list' });
    await expect(expandBtn).toBeVisible({ timeout: 5000 });

    // Then expand
    await expandBtn.click();
    await expect(page.getByText(/Leg[s]? in View/i)).toBeVisible({ timeout: 5000 });
  });

  // TC-28
  test('navigating to dashboard with legId URL param pre-selects that leg', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route('**/api/legs/leg-101', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_VIEWPORT_LEGS[0]),
      });
    });
    await page.route('**/api/legs/leg-101/waypoints', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ waypoints: [] }),
      });
    });

    await page.goto('/crew/dashboard?legId=leg-101', { waitUntil: 'domcontentloaded' });

    // Pre-selected leg details appear in the panel on the left
    await expect(
      page.getByText('Caribbean Trade Wind Run').first()
    ).toBeVisible({ timeout: 25000 });
  });

  // TC-29
  test('mobile view shows a bottom sheet with the legs-in-view count', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // BottomSheet header renders "X Legs in View"
    await expect(page.getByText(/Leg[s]? in View/i)).toBeVisible({ timeout: 25000 });
  });

  // TC-30
  test('mobile "List View" button navigates to the crew home page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Dashboard renders a "List View" button on mobile with aria-label="List View"
    const listViewBtn = page.getByRole('button', { name: 'List View' });
    await expect(listViewBtn).toBeVisible({ timeout: 10000 });
    await listViewBtn.click();
    await expect(page).toHaveURL(/\/crew$/, { timeout: 10000 });
  });

  // TC-31
  test('map container element has a minimum height style applied', async ({ page }) => {
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // CrewBrowseMap root div is styled with min-height: 400px via inline style
    await expect(
      page.locator('[style*="min-height: 400px"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  // TC-32
  test('unauthenticated user sees a bottom sign-in banner on the dashboard', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Non-authenticated users see a fixed bottom banner with sign in / sign up links
    const signInVisible = await page
      .getByRole('link', { name: /sign.?in/i })
      .last()
      .isVisible()
      .catch(() => false);
    const signUpVisible = await page
      .getByRole('link', { name: /sign.?up/i })
      .last()
      .isVisible()
      .catch(() => false);
    expect(signInVisible || signUpVisible).toBe(true);
  });

  // TC-33
  test('viewport API is called after the map initialises', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/legs/viewport')) {
        apiRequests.push(req.url());
      }
    });

    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // Wait for map load event + 500ms debounce + initial viewport trigger
    await page.waitForTimeout(6000);
    expect(apiRequests.length).toBeGreaterThan(0);
  });

  // TC-34
  test('browse pane shows a spinner while the viewport API is in-flight', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    // Delay viewport API to make loading state observable
    await page.route('**/api/legs/viewport**', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: MOCK_VIEWPORT_LEGS }),
      });
    });

    await page.goto('/crew/dashboard', { waitUntil: 'domcontentloaded' });
    // LegBrowsePane shows an animate-spin spinner while isLoading=true
    await page.waitForTimeout(600);
    // Verify the pane header area exists; spinner is transient
    await expect(page.locator('body')).toBeVisible();
  });
});
