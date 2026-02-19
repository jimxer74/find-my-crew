import { type Page, type Route } from '@playwright/test';

/**
 * Mock Supabase auth to simulate an authenticated crew user session.
 * This intercepts the Supabase session and profile API calls.
 */
export async function mockAuthenticatedCrewUser(page: Page): Promise<void> {
  const mockUser = {
    id: 'test-user-001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'testcrew@example.com',
    email_confirmed_at: '2025-01-01T00:00:00.000Z',
    phone: '',
    confirmed_at: '2025-01-01T00:00:00.000Z',
    last_sign_in_at: '2025-01-01T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Test Crew User' },
    identities: [],
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  };

  const mockSession = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'mock-refresh-token',
    user: mockUser,
  };

  // Mock Supabase auth session endpoint
  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSession),
    });
  });

  // Mock Supabase auth user endpoint
  await page.route('**/auth/v1/user**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    });
  });

  // Mock the Supabase realtime session check
  await page.route('**/rest/v1/user_roles**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ user_id: 'test-user-001', role: 'crew' }]),
    });
  });

  // Set up localStorage with mock session before navigation
  await page.addInitScript((session) => {
    // Pre-populate the Supabase session in localStorage
    const supabaseUrl = 'https://zyofbhkvkpygruriubjn.supabase.co';
    const storageKey = `sb-${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(session));
    // Also try the standard key format
    localStorage.setItem('sb-zyofbhkvkpygruriubjn-auth-token', JSON.stringify(session));
  }, mockSession);
}
