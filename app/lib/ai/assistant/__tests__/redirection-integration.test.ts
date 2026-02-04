import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssistantProvider, useAssistant } from '@/app/contexts/AssistantContext';
import { ActionConfirmation } from '@/app/components/ai/ActionConfirmation';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/app/lib/ai/assistant', () => ({
  executeAction: vi.fn(),
}));

const MockComponent = () => {
  const assistant = useAssistant();
  return (
    <div>
      <span data-testid="assistant-state">{JSON.stringify(assistant.isOpen)}</span>
      <button
        data-testid="redirect-button"
        onClick={() => {
          // Mock a profile update action
          const mockAction = {
            id: 'test-action-id',
            user_id: 'user-123',
            action_type: 'update_profile_skills',
            action_payload: {},
            explanation: 'Test explanation',
            status: 'pending',
            created_at: '2023-01-01T00:00:00Z',
            resolved_at: null,
          };
          assistant.redirectToProfile(mockAction);
        }}
      >
        Redirect to Profile
      </button>
    </div>
  );
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>{children}</AssistantProvider>
    </QueryClientProvider>
  );
};

describe('Profile Redirection Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  it('should redirect to profile page with correct query parameters', async () => {
    render(
      <TestWrapper>
        <MockComponent />
      </TestWrapper>
    );

    const redirectButton = screen.getByTestId('redirect-button');
    fireEvent.click(redirectButton);

    await waitFor(() => {
      expect(window.location.href).toBe('/profile?section=experience&field=skills&aiActionId=test-action-id');
    });
  });

  it('should handle different profile update action types correctly', async () => {
    const actionTypes = [
      'suggest_profile_update_user_description',
      'update_profile_user_description',
      'update_profile_certifications',
      'update_profile_risk_level',
      'update_profile_sailing_preferences',
      'update_profile_skills',
      'refine_skills'
    ];

    actionTypes.forEach(async (actionType) => {
      const mockAction = {
        id: 'test-action-id',
        user_id: 'user-123',
        action_type: actionType,
        action_payload: {},
        explanation: 'Test explanation',
        status: 'pending',
        created_at: '2023-01-01T00:00:00Z',
        resolved_at: null,
      };

      // Reset location
      window.location.href = '';

      render(
        <TestWrapper>
          <ActionConfirmation
            action={mockAction}
            onApprove={() => {}}
            onReject={() => {}}
            onRedirectToProfile={(action) => {
              const { section, field } = parseProfileAction(action);
              window.location.href = `/profile?section=${section}&field=${field}&aiActionId=${action.id}`;
            }}
          />
        </TestWrapper>
      );

      const redirectToProfileButton = screen.getByText('Update in Profile');
      fireEvent.click(redirectToProfileButton);

      await waitFor(() => {
        expect(window.location.href).toContain('/profile?section=');
        expect(window.location.href).toContain('&field=');
        expect(window.location.href).toContain('&aiActionId=test-action-id');
      });
    });
  });

  it('should show AI suggestion context in ActionConfirmation', () => {
    const mockAction = {
      id: 'test-action-id',
      user_id: 'user-123',
      action_type: 'suggest_profile_update_user_description',
      action_payload: {},
      explanation: 'Test explanation',
      status: 'pending',
      created_at: '2023-01-01T00:00:00Z',
      resolved_at: null,
    };

    render(
      <TestWrapper>
        <ActionConfirmation
          action={mockAction}
          onApprove={() => {}}
          onReject={() => {}}
          onRedirectToProfile={() => {}}
        />
      </TestWrapper>
    );

    expect(screen.getByText('AI suggests updating your user description to improve match rate')).toBeInTheDocument();
  });

  it('should maintain backward compatibility for non-profile actions', () => {
    const mockAction = {
      id: 'test-action-id',
      user_id: 'user-123',
      action_type: 'register_for_leg',
      action_payload: {},
      explanation: 'Test explanation',
      status: 'pending',
      created_at: '2023-01-01T00:00:00Z',
      resolved_at: null,
    };

    render(
      <TestWrapper>
        <ActionConfirmation
          action={mockAction}
          onApprove={() => {}}
          onReject={() => {}}
          onRedirectToProfile={() => {}}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.queryByText('Update in Profile')).not.toBeInTheDocument();
  });
});