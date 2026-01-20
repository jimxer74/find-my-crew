import type { User } from '@supabase/supabase-js';
import type { ExperienceLevel } from '@/app/types/experience-levels';

/**
 * Mock factory for creating test users
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {
      role: 'crew',
      ...overrides?.user_metadata,
    },
    aud: 'authenticated',
    confirmation_sent_at: null,
    recovery_sent_at: null,
    email_change_sent_at: null,
    new_email: null,
    invited_at: null,
    action_link: null,
    email_confirmed_at: new Date().toISOString(),
    phone: null,
    phone_confirmed_at: null,
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

/**
 * Mock factory for creating journey data
 */
export function createMockJourney(overrides?: any) {
  return {
    id: 'test-journey-id',
    boat_id: 'test-boat-id',
    name: 'Test Journey',
    start_date: '2024-06-01',
    end_date: '2024-06-15',
    description: 'Test journey description',
    risk_level: 'Coastal sailing',
    skills: ['Navigation', 'First Aid'],
    min_experience_level: 2,
    state: 'Published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock factory for creating leg data
 */
export function createMockLeg(overrides?: any) {
  return {
    leg_id: 'test-leg-id',
    leg_name: 'Test Leg',
    leg_description: 'Test leg description',
    journey_id: 'test-journey-id',
    journey_name: 'Test Journey',
    start_date: '2024-06-01T00:00:00Z',
    end_date: '2024-06-05T00:00:00Z',
    crew_needed: 2,
    leg_risk_level: 'Coastal sailing' as const,
    journey_risk_level: ['Coastal sailing'] as const[],
    skills: ['Navigation'],
    boat_id: 'test-boat-id',
    boat_name: 'Test Boat',
    boat_type: 'Coastal cruisers',
    boat_image_url: null,
    boat_average_speed_knots: 6,
    owner_name: 'Test Owner',
    owner_image_url: null,
    min_experience_level: 2,
    start_waypoint: {
      lng: 0,
      lat: 0,
      name: 'Start',
    },
    end_waypoint: {
      lng: 1,
      lat: 1,
      name: 'End',
    },
    ...overrides,
  };
}

/**
 * Mock factory for creating boat data
 */
export function createMockBoat(overrides?: any) {
  return {
    id: 'test-boat-id',
    owner_id: 'test-user-id',
    name: 'Test Boat',
    type: 'Coastal cruisers',
    capacity: 6,
    home_port: 'Test Port',
    average_speed_knots: 6,
    images: [],
    ...overrides,
  };
}

/**
 * Mock factory for creating location data
 */
export function createMockLocation(overrides?: any) {
  return {
    name: 'Test Location',
    coordinates: [0, 0],
    place_name: 'Test Location, Test Country',
    ...overrides,
  };
}

// Import vi for mocks
import { vi } from 'vitest';

/**
 * Helper to mock Supabase client
 */
export function createMockSupabaseClient() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}
