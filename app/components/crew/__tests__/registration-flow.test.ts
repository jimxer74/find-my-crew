import { describe, it, expect, jest, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { LegDetailsPanel } from '../LegDetailsPanel';

// Mock dependencies
jest.mock('@/app/contexts/AuthContext');
jest.mock('@/app/lib/supabaseClient');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetSupabaseBrowserClient = getSupabaseBrowserClient as jest.MockedFunction<typeof getSupabaseBrowserClient>;

describe('Registration Flow - Server-side Requirements', () => {
  const mockUser = { id: 'user-123' };
  const mockLeg = {
    leg_id: 'leg-123',
    journey_id: 'journey-456',
    leg_name: 'Test Leg',
    journey_name: 'Test Journey',
    boat_image_url: 'test-image.jpg',
    description: 'Test description',
    start_date: '2024-06-15',
    end_date: '2024-06-20',
    capacity: 5,
    status: 'Open',
    created_at: '2024-06-10T10:00:00Z',
  };

  const mockJourneyImages = [
    { id: 'img-1', url: 'journey-image-1.jpg' },
    { id: 'img-2', url: 'journey-image-2.jpg' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser });
    mockGetSupabaseBrowserClient.mockReturnValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      data: { profile_sharing_consent: true },
      error: null,
    } as any);
  });

  it('should show regular registration modal for server-side requirements only', async () => {
    // Mock fetch responses
    global.fetch = jest.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            requirements: [
              { id: 'req-1', requirement_type: 'risk_level', is_required: true },
              { id: 'req-2', requirement_type: 'experience_level', is_required: true },
              { id: 'req-3', requirement_type: 'skill', skill_name: 'sailing', is_required: true },
            ]
          })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            auto_approval_enabled: true,
            auto_approval_threshold: 80
          })
        })
      );

    render(
      <LegDetailsPanel
        leg={mockLeg}
        journeyImages={mockJourneyImages}
        isLastLeg={false}
      />
    );

    // Find and click the register button
    const registerButton = screen.getByText('Register for leg');
    fireEvent.click(registerButton);

    // Wait for modal to appear and requirements to be checked
    await waitFor(() => {
      expect(screen.getByText('Register for Test Leg')).toBeInTheDocument();
    });

    // Should show the regular registration modal, not requirements form
    expect(screen.getByText('Additional Notes (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();

    // Should not show requirements form elements
    expect(screen.queryByText('Registration Questions')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Your answer...')).not.toBeInTheDocument();
  });

  it('should show requirements form for question-type requirements', async () => {
    // Mock fetch responses
    global.fetch = jest.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            requirements: [
              { id: 'req-1', requirement_type: 'question', question_text: 'Why do you want to join?', is_required: true },
              { id: 'req-2', requirement_type: 'question', question_text: 'Describe your experience', is_required: true },
            ]
          })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            auto_approval_enabled: true,
            auto_approval_threshold: 80
          })
        })
      );

    render(
      <LegDetailsPanel
        leg={mockLeg}
        journeyImages={mockJourneyImages}
        isLastLeg={false}
      />
    );

    // Find and click the register button
    const registerButton = screen.getByText('Register for leg');
    fireEvent.click(registerButton);

    // Wait for modal to appear and requirements to be checked
    await waitFor(() => {
      expect(screen.getByText('Register for Test Leg')).toBeInTheDocument();
    });

    // Should show the requirements form
    expect(screen.getByText('Registration Questions')).toBeInTheDocument();
    expect(screen.getByText('Why do you want to join?')).toBeInTheDocument();
    expect(screen.getByText('Describe your experience')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your answer...')).toBeInTheDocument();

    // Should not show regular registration modal elements
    expect(screen.queryByText('Additional Notes (Optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
  });

  it('should show regular modal when no requirements exist', async () => {
    // Mock fetch responses
    global.fetch = jest.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            requirements: []
          })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            auto_approval_enabled: false,
            auto_approval_threshold: 80
          })
        })
      );

    render(
      <LegDetailsPanel
        leg={mockLeg}
        journeyImages={mockJourneyImages}
        isLastLeg={false}
      />
    );

    // Find and click the register button
    const registerButton = screen.getByText('Register for leg');
    fireEvent.click(registerButton);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText('Register for Test Leg')).toBeInTheDocument();
    });

    // Should show the regular registration modal
    expect(screen.getByText('Additional Notes (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Register')).toBeInTheDocument();

    // Should not show requirements form
    expect(screen.queryByText('Registration Questions')).not.toBeInTheDocument();
  });

  it('should handle mixed requirements (question + server-side) correctly', async () => {
    // Mock fetch responses
    global.fetch = jest.fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            requirements: [
              { id: 'req-1', requirement_type: 'question', question_text: 'Why do you want to join?', is_required: true },
              { id: 'req-2', requirement_type: 'risk_level', is_required: true },
              { id: 'req-3', requirement_type: 'experience_level', is_required: true },
            ]
          })
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            auto_approval_enabled: true,
            auto_approval_threshold: 80
          })
        })
      );

    render(
      <LegDetailsPanel
        leg={mockLeg}
        journeyImages={mockJourneyImages}
        isLastLeg={false}
      />
    );

    // Find and click the register button
    const registerButton = screen.getByText('Register for leg');
    fireEvent.click(registerButton);

    // Wait for modal to appear and requirements to be checked
    await waitFor(() => {
      expect(screen.getByText('Register for Test Leg')).toBeInTheDocument();
    });

    // Should show the requirements form since question requirements exist
    expect(screen.getByText('Registration Questions')).toBeInTheDocument();
    expect(screen.getByText('Why do you want to join?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your answer...')).toBeInTheDocument();

    // Should not show regular registration modal elements
    expect(screen.queryByText('Additional Notes (Optional)')).not.toBeInTheDocument();
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
  });
});