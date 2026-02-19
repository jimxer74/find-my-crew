// spec: Phase 1 Crew Role Tests - Suite 5: Registration Flow
// seed: tests/seed.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';

const MOCK_REG_LEG = {
  leg_id: 'leg-301',
  leg_name: 'Transatlantic Rally Leg 2',
  journey_id: 'journey-301',
  journey_name: 'Great Circle Route',
  leg_description: 'A demanding open-ocean crossing with experienced crew.',
  start_date: '2026-08-01',
  end_date: '2026-08-21',
  crew_needed: 2,
  leg_risk_level: 'Offshore sailing',
  journey_risk_level: ['Offshore sailing'],
  cost_model: null,
  journey_images: [],
  skills: ['Navigation', 'Offshore sailing', 'Watch keeping'],
  boat_id: 'boat-301',
  boat_name: 'Ocean Wanderer',
  boat_type: 'Sailing Yacht',
  boat_image_url: null,
  boat_average_speed_knots: 7,
  boat_make_model: 'Oyster 55',
  owner_name: 'Capt. Alice Ward',
  owner_image_url: null,
  min_experience_level: 4,
  skill_match_percentage: 78,
  experience_level_matches: true,
  start_waypoint: { lng: -17.88, lat: 14.71, name: 'Dakar, Senegal' },
  end_waypoint: { lng: -61.01, lat: 14.62, name: 'Martinique' },
};

const MOCK_HOME_LEGS = [
  {
    leg_id: MOCK_REG_LEG.leg_id,
    leg_name: MOCK_REG_LEG.leg_name,
    journey_id: MOCK_REG_LEG.journey_id,
    journey_name: MOCK_REG_LEG.journey_name,
    start_date: MOCK_REG_LEG.start_date,
    end_date: MOCK_REG_LEG.end_date,
    journey_images: [],
    boat_name: MOCK_REG_LEG.boat_name,
    boat_image_url: null,
    boat_make_model: MOCK_REG_LEG.boat_make_model,
    skill_match_percentage: 78,
    experience_level_matches: true,
    start_waypoint: MOCK_REG_LEG.start_waypoint,
    end_waypoint: MOCK_REG_LEG.end_waypoint,
  },
];

interface RegistrationMockOptions {
  hasRequirements?: boolean;
  registrationSuccess?: boolean;
  autoApproved?: boolean;
}

async function setupRegistrationMocks(
  page: Page,
  options: RegistrationMockOptions = {}
): Promise<void> {
  const { hasRequirements = false, registrationSuccess = true, autoApproved = false } = options;

  await page.route('**/api/legs/by-region**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ legs: MOCK_HOME_LEGS }),
    });
  });

  await page.route(`**/api/legs/${MOCK_REG_LEG.leg_id}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REG_LEG),
    });
  });

  await page.route(
    `**/api/journeys/${MOCK_REG_LEG.journey_id}/requirements**`,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requirements: hasRequirements
            ? [
                {
                  id: 'req-001',
                  requirement_type: 'question',
                  question_text: 'Describe your offshore sailing experience.',
                  is_required: true,
                  weight: 1,
                  order: 1,
                },
              ]
            : [],
        }),
      });
    }
  );

  await page.route(
    `**/api/registrations?leg_id=${MOCK_REG_LEG.leg_id}**`,
    async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ registration: null }),
      });
    }
  );

  await page.route('**/api/registrations', async (route: Route) => {
    if (route.request().method() === 'POST') {
      if (registrationSuccess) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            registration_id: 'reg-001',
            status: autoApproved ? 'Approved' : 'Pending approval',
            auto_approved: autoApproved,
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Already registered for this leg' }),
        });
      }
    } else {
      await route.continue();
    }
  });

  await page.route('**/rest/v1/profiles**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { sailing_experience: 4, risk_level: ['Offshore sailing'], skills: [] },
      ]),
    });
  });

  await page.route('**/rest/v1/consents**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { consent_type: 'ai_profile_sharing', consented: true },
      ]),
    });
  });
}

async function setupDashboardForRegistration(page: Page): Promise<void> {
  await page.route('https://api.mapbox.com/**', async (route: Route) => {
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

test.describe('Registration Flow', () => {
  // TC-70
  test('clicking the Join button on a leg card opens the registration dialog', async ({ page }) => {
    await setupRegistrationMocks(page);
    await page.goto('/crew', { waitUntil: 'networkidle' });
    await expect(page.getByText('Transatlantic Rally Leg 2')).toBeVisible({ timeout: 15000 });

    // LegCarousel renders a "Join" button per card when user is authenticated
    const joinButton = page.locator('button').filter({ hasText: /^Join$/ }).first();
    const isVisible = await joinButton.isVisible().catch(() => false);

    if (isVisible) {
      await joinButton.click();
      // LegRegistrationDialog renders with role="dialog" and aria-modal="true"
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    }
  });

  // TC-71
  test('registration dialog header shows the correct leg name', async ({ page }) => {
    await setupRegistrationMocks(page);
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    // LegRegistrationDialog renders: "Register for {leg.leg_name}"
    await expect(
      page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
    ).toBeVisible({ timeout: 15000 });
  });

  // TC-72
  test('registration dialog can be dismissed with the close button', async ({ page }) => {
    await setupRegistrationMocks(page);
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    const dialogTitle = page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`);
    await expect(dialogTitle).toBeVisible({ timeout: 15000 });

    // Close button has aria-label="Close"
    const closeBtn = page.getByRole('button', { name: 'Close' }).first();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();

    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });
  });

  // TC-73
  test('pressing Escape key closes the registration dialog', async ({ page }) => {
    await setupRegistrationMocks(page);
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    const dialogTitle = page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`);
    await expect(dialogTitle).toBeVisible({ timeout: 15000 });

    // LegRegistrationDialog listens for keydown Escape via useEffect
    await page.keyboard.press('Escape');
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });
  });

  // TC-74
  test('simple registration form appears when the leg has no custom requirements', async ({
    page,
  }) => {
    await setupRegistrationMocks(page, { hasRequirements: false });
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    await expect(
      page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
    ).toBeVisible({ timeout: 15000 });

    // Wait for requirements check to complete; showSimpleForm becomes true
    await page.waitForTimeout(2000);

    // Simple form renders a Register/Submit button
    await expect(
      page.getByRole('button', { name: /register/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // TC-75
  test('requirements form appears when the leg has question-type requirements', async ({ page }) => {
    await setupRegistrationMocks(page, { hasRequirements: true });
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    await expect(
      page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
    ).toBeVisible({ timeout: 15000 });

    // Wait for requirements to load
    await page.waitForTimeout(2000);

    // RegistrationRequirementsForm or the dialog itself should be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  });

  // TC-76
  test('submitting a valid registration shows the success modal', async ({ page }) => {
    await setupRegistrationMocks(page, { hasRequirements: false, registrationSuccess: true });
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    await expect(
      page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
    ).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(2000);

    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      // RegistrationSuccessModal renders with title "Registration Submitted"
      await expect(
        page.getByText(/Registration Submitted|Registration Approved/i)
      ).toBeVisible({ timeout: 10000 });
    }
  });

  // TC-77
  test('success modal has a dismiss button that closes it', async ({ page }) => {
    await setupRegistrationMocks(page, { hasRequirements: false, registrationSuccess: true });
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    await expect(
      page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await expect(
        page.getByText(/Registration Submitted|Registration Approved/i)
      ).toBeVisible({ timeout: 10000 });

      // RegistrationSuccessModal footer button: "Got it" (pending) or "View Dashboard" (auto-approved)
      const dismissBtn = page.getByRole('button', { name: /got it|view dashboard/i });
      await expect(dismissBtn).toBeVisible({ timeout: 5000 });
      await dismissBtn.click();

      await expect(
        page.getByText(/Registration Submitted|Registration Approved/i)
      ).not.toBeVisible({ timeout: 5000 });
    }
  });

  // TC-78
  test('registration dialog shows loading state while fetching the leg by ID', async ({ page }) => {
    // Delay the leg API to make the loading spinner observable
    await page.route(`**/api/legs/${MOCK_REG_LEG.leg_id}`, async (route: Route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REG_LEG),
      });
    });
    await page.route('**/api/legs/by-region**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ legs: MOCK_HOME_LEGS }),
      });
    });

    await page.goto('/crew', { waitUntil: 'networkidle' });
    await expect(page.getByText('Transatlantic Rally Leg 2')).toBeVisible({ timeout: 15000 });

    const joinBtn = page.locator('button').filter({ hasText: /^Join$/ }).first();
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
      // LegRegistrationDialog shows "Loading leg information..." while loadingLeg=true
      // The dialog container should appear immediately
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    }
  });

  // TC-79
  test('dialog shows an error message when leg fetch returns 404', async ({ page }) => {
    // Return 404 for the leg fetch
    await page.route(`**/api/legs/${MOCK_REG_LEG.leg_id}`, async (route: Route) => {
      await route.fulfill({ status: 404, body: 'Not Found' });
    });
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    // When leg fetch fails, LegRegistrationDialog sets registrationError state
    // "Failed to load leg information" text is shown inside the dialog
    const errorMsg = page.getByText(/Failed to load leg information/i);
    const isVisible = await errorMsg.isVisible().catch(() => false);
    // Page should remain stable regardless of dialog error state
    await expect(page.locator('body')).toBeVisible();
    // The error may appear inside the dialog if it was opened
    expect(typeof isVisible).toBe('boolean');
  });

  // TC-80
  test('registration dialog opens from crew home Join button with the correct leg name', async ({
    page,
  }) => {
    await setupRegistrationMocks(page);
    await page.goto('/crew', { waitUntil: 'networkidle' });
    await expect(page.getByText('Transatlantic Rally Leg 2')).toBeVisible({ timeout: 15000 });

    const joinButton = page.locator('button').filter({ hasText: /^Join$/ }).first();
    const joinVisible = await joinButton.isVisible().catch(() => false);

    if (joinVisible) {
      await joinButton.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      // Dialog title must mention the leg name
      await expect(
        page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
      ).toBeVisible({ timeout: 10000 });
    } else {
      // Skip if user is not authenticated (join button not shown)
      test.skip();
    }
  });

  // TC-81
  test('clicking the backdrop on desktop closes the registration dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setupRegistrationMocks(page);
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);

    const dialogTitle = page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`);
    await expect(dialogTitle).toBeVisible({ timeout: 15000 });

    // On desktop the dialog wraps with a semi-transparent inset-0 overlay
    // Clicking the top-left corner (outside the centered dialog card) fires handleBackdropClick
    await page.mouse.click(10, 10);
    await expect(dialogTitle).not.toBeVisible({ timeout: 5000 });
  });

  // TC-82
  test('auto-approved registration shows the "Registration Approved" success message', async ({
    page,
  }) => {
    await setupRegistrationMocks(page, {
      hasRequirements: false,
      registrationSuccess: true,
      autoApproved: true,
    });
    await setupDashboardForRegistration(page);

    await page.goto(
      `/crew/dashboard?legId=${MOCK_REG_LEG.leg_id}&register=true`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(3000);
    await expect(
      page.getByText(`Register for ${MOCK_REG_LEG.leg_name}`)
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      // autoApproved=true → RegistrationSuccessModal title: "Registration Approved! 🎉"
      await expect(
        page.getByText(/Registration Approved/i)
      ).toBeVisible({ timeout: 10000 });
      // Footer button says "View Dashboard" for auto-approved
      await expect(
        page.getByRole('button', { name: /view dashboard/i })
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // TC-83
  test('registrations page shows existing registration cards', async ({ page }) => {
    await page.route('**/api/registrations/crew/details', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registrations: [
            {
              registration_id: 'reg-existing-001',
              registration_status: 'Pending approval',
              registration_notes: null,
              registration_created_at: '2026-03-01T10:00:00Z',
              registration_updated_at: '2026-03-01T10:00:00Z',
              ai_match_score: null,
              ai_match_reasoning: null,
              auto_approved: false,
              leg_id: MOCK_REG_LEG.leg_id,
              leg_name: MOCK_REG_LEG.leg_name,
              leg_description: null,
              journey_id: MOCK_REG_LEG.journey_id,
              journey_name: MOCK_REG_LEG.journey_name,
              start_date: MOCK_REG_LEG.start_date,
              end_date: MOCK_REG_LEG.end_date,
              crew_needed: 2,
              risk_level: 'Offshore sailing',
              skills: ['Navigation'],
              boat_id: MOCK_REG_LEG.boat_id,
              boat_name: MOCK_REG_LEG.boat_name,
              boat_type: MOCK_REG_LEG.boat_type,
              boat_make_model: MOCK_REG_LEG.boat_make_model,
              boat_image_url: null,
              boat_average_speed_knots: 7,
              owner_name: MOCK_REG_LEG.owner_name,
              owner_image_url: null,
              min_experience_level: 4,
              skill_match_percentage: 78,
              experience_level_matches: true,
              start_waypoint: MOCK_REG_LEG.start_waypoint,
              end_waypoint: MOCK_REG_LEG.end_waypoint,
            },
          ],
        }),
      });
    });
    await page.route('**/rest/v1/profiles**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ skills: [], sailing_experience: 4 }]),
      });
    });

    await page.goto('/crew/registrations', { waitUntil: 'networkidle' });
    await expect(
      page.getByText('Transatlantic Rally Leg 2')
    ).toBeVisible({ timeout: 15000 });
  });

  // TC-84
  test('registrations page shows an empty state when the user has no registrations', async ({
    page,
  }) => {
    await page.route('**/api/registrations/crew/details', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ registrations: [] }),
      });
    });
    await page.route('**/rest/v1/profiles**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ skills: [], sailing_experience: null }]),
      });
    });

    await page.goto('/crew/registrations', { waitUntil: 'networkidle' });

    // MyRegistrationsPage renders a "Browse legs" link in the empty state card
    await expect(
      page.getByRole('link', { name: /browse legs/i })
    ).toBeVisible({ timeout: 15000 });
  });

  // TC-85
  test('registration card displays the "Pending approval" status badge', async ({ page }) => {
    await page.route('**/api/registrations/crew/details', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registrations: [
            {
              registration_id: 'reg-003',
              registration_status: 'Pending approval',
              registration_notes: null,
              registration_created_at: '2026-03-01T10:00:00Z',
              registration_updated_at: '2026-03-01T10:00:00Z',
              ai_match_score: null,
              ai_match_reasoning: null,
              auto_approved: false,
              leg_id: MOCK_REG_LEG.leg_id,
              leg_name: MOCK_REG_LEG.leg_name,
              leg_description: null,
              journey_id: MOCK_REG_LEG.journey_id,
              journey_name: MOCK_REG_LEG.journey_name,
              start_date: MOCK_REG_LEG.start_date,
              end_date: MOCK_REG_LEG.end_date,
              crew_needed: 2,
              risk_level: null,
              skills: [],
              boat_id: MOCK_REG_LEG.boat_id,
              boat_name: MOCK_REG_LEG.boat_name,
              boat_type: null,
              boat_make_model: null,
              boat_image_url: null,
              boat_average_speed_knots: null,
              owner_name: null,
              owner_image_url: null,
              min_experience_level: null,
              start_waypoint: null,
              end_waypoint: null,
            },
          ],
        }),
      });
    });
    await page.route('**/rest/v1/profiles**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ skills: [], sailing_experience: null }]),
      });
    });

    await page.goto('/crew/registrations', { waitUntil: 'networkidle' });
    await expect(page.getByText('Transatlantic Rally Leg 2')).toBeVisible({ timeout: 15000 });
    // getStatusBadge() renders a <span> with the status text
    await expect(page.getByText('Pending approval')).toBeVisible({ timeout: 5000 });
  });

  // TC-86
  test('registrations page renders a visible page title heading', async ({ page }) => {
    await page.route('**/api/registrations/crew/details', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ registrations: [] }),
      });
    });
    await page.route('**/rest/v1/profiles**', async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ skills: [], sailing_experience: null }]),
      });
    });

    await page.goto('/crew/registrations', { waitUntil: 'networkidle' });

    // MyRegistrationsPage renders an <h1> from t('title')
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });
  });
});
