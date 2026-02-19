// spec: Phase 1 Crew Role Tests - Suite 3: Leg Details Panel
// seed: tests/seed.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';

const MOCK_LEG = {
  leg_id: 'leg-201',
  leg_name: 'Pacific Island Hop Leg 3',
  leg_description:
    'This leg takes you from Tahiti to Bora Bora, sailing through the Society Islands with their stunning turquoise lagoons.',
  journey_id: 'journey-201',
  journey_name: 'South Pacific Dream',
  start_date: '2026-06-15',
  end_date: '2026-06-22',
  crew_needed: 2,
  leg_risk_level: 'Coastal sailing',
  journey_risk_level: ['Coastal sailing'],
  cost_model: null,
  journey_images: [],
  skills: ['Navigation', 'Sailing', 'Watch keeping'],
  boat_id: 'boat-201',
  boat_name: 'Pearl of the Pacific',
  boat_type: 'Sailing Catamaran',
  boat_image_url: null,
  boat_average_speed_knots: 8,
  boat_make_model: 'Leopard 45',
  owner_name: 'Sophie Martin',
  owner_image_url: null,
  min_experience_level: 2,
  skill_match_percentage: 88,
  experience_level_matches: true,
  start_waypoint: { lng: -149.57, lat: -17.53, name: 'Papeete, Tahiti' },
  end_waypoint: { lng: -151.74, lat: -16.5, name: 'Bora Bora' },
};

async function setupPanelMocks(page: Page): Promise<void> {
  await page.route('https://api.mapbox.com/**', async (route: Route) => {
    await route.abort();
  });
  await page.route('**/api/legs/viewport**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ legs: [MOCK_LEG] }),
    });
  });
  await page.route(`**/api/legs/${MOCK_LEG.leg_id}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LEG),
    });
  });
  await page.route(`**/api/legs/${MOCK_LEG.leg_id}/waypoints`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        waypoints: [
          { id: 'wp-1', index: 0, name: 'Papeete', coordinates: [-149.57, -17.53] },
          { id: 'wp-2', index: 1, name: 'Moorea', coordinates: [-149.83, -17.53] },
          { id: 'wp-3', index: 2, name: 'Bora Bora', coordinates: [-151.74, -16.5] },
        ],
      }),
    });
  });
  await page.route(
    `**/api/journeys/${MOCK_LEG.journey_id}/requirements**`,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ requirements: [] }),
      });
    }
  );
}

test.describe('Leg Details Panel', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  // TC-40
  test('details panel opens when navigating to dashboard with a valid legId param', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    // LegDetailsPanel renders with the leg name visible
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
  });

  // TC-41
  test('panel displays both the leg name and the parent journey name', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('South Pacific Dream').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-42
  test('panel shows the departure and arrival waypoint names', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    // LegDetailsPanel renders start_waypoint.name and end_waypoint.name
    await expect(page.getByText(/Papeete/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Bora Bora/i).first()).toBeVisible({ timeout: 10000 });
  });

  // TC-43
  test('panel displays formatted start and end dates', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    // Dates 2026-06-15 to 2026-06-22 formatted via formatDate()
    await expect(page.getByText(/Jun|2026/i).first()).toBeVisible({ timeout: 10000 });
  });

  // TC-44
  test('panel shows the risk level badge for the leg', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    // leg_risk_level: 'Coastal sailing' → displayName from riskLevelsConfig
    await expect(page.getByText(/Coastal/i).first()).toBeVisible({ timeout: 10000 });
  });

  // TC-45
  test('panel displays the skills required for the leg', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    // SkillsMatchingDisplay renders each skill as a badge; check for 'Navigation'
    await expect(page.getByText('Navigation').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-46
  test('panel displays the boat name and type information', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    // Boat name is rendered in the details panel
    await expect(page.getByText('Pearl of the Pacific').first()).toBeVisible({ timeout: 10000 });
  });

  // TC-47
  test('panel can be closed using the close button', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);

    const legTitle = page.getByText('Pacific Island Hop Leg 3').first();
    await expect(legTitle).toBeVisible({ timeout: 15000 });

    // LegDetailsPanel renders a close button with aria-label="Close"
    const closeBtn = page.getByRole('button', { name: 'Close' }).first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();

    // After closing, the browse pane should become visible again (isVisible={!selectedLeg})
    await expect(page.getByText(/Leg[s]? in View/i)).toBeVisible({ timeout: 5000 });
  });

  // TC-48
  test('panel shows the leg description text content', async ({ page }) => {
    await setupPanelMocks(page);
    await page.goto(`/crew/dashboard?legId=${MOCK_LEG.leg_id}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);
    await expect(page.getByText('Pacific Island Hop Leg 3').first()).toBeVisible({
      timeout: 15000,
    });
    // leg_description contains "Society Islands" – rendered in the details panel content
    await expect(page.getByText(/Society Islands/i).first()).toBeVisible({ timeout: 10000 });
  });
});
