import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { createMockUser } from '@/__tests__/utils/mocks';

// Mock Supabase client
vi.mock('@/app/lib/supabaseClient', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide default auth values', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(typeof result.current.signOut).toBe('function');
  });

  it('should initialize loading state correctly', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Initially loading should be true
    expect(result.current.loading).toBe(true);

    // Wait for initial session check
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should call signOut when signOut is invoked', async () => {
    const { getSupabaseBrowserClient } = await import('@/app/lib/supabaseClient');
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    
    vi.mocked(getSupabaseBrowserClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: mockSignOut,
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.signOut();

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should handle auth state changes', async () => {
    const mockOnAuthStateChange = vi.fn((callback) => {
      // Simulate auth state change
      setTimeout(() => {
        callback('SIGNED_IN', { user: createMockUser(), session: {} } as any);
      }, 100);
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });

    const { getSupabaseBrowserClient } = await import('@/app/lib/supabaseClient');
    vi.mocked(getSupabaseBrowserClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: mockOnAuthStateChange,
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });
});
