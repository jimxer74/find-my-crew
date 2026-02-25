import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SkillLevelSelector } from './SkillLevelSelector';
import { ExperienceLevel } from '@shared/types/experience-levels';

describe('SkillLevelSelector', () => {
  const mockOnChange = vi.fn();
  const mockOnInfoClick = vi.fn();
  const mockOnWarning = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all experience level options', async () => {
    render(<SkillLevelSelector value={null} onChange={mockOnChange} />);
    
    // Wait for component to render - check for at least one level first
    await waitFor(() => {
      expect(screen.getByText('Beginner')).toBeInTheDocument();
    });
    
    // Then check for others
    expect(screen.getByText('Competent Crew')).toBeInTheDocument();
    expect(screen.getByText('Coastal Skipper')).toBeInTheDocument();
    expect(screen.getByText('Offshore Skipper')).toBeInTheDocument();
  });

  it('should call onChange when a level is clicked', async () => {
    const user = userEvent.setup();
    render(<SkillLevelSelector value={null} onChange={mockOnChange} />);
    
    const beginnerButton = screen.getByText('Beginner').closest('button');
    expect(beginnerButton).toBeInTheDocument();
    
    await user.click(beginnerButton!);
    expect(mockOnChange).toHaveBeenCalledWith(1);
  });

  it('should deselect when clicking the same level again', async () => {
    const user = userEvent.setup();
    render(<SkillLevelSelector value={1} onChange={mockOnChange} />);
    
    const beginnerButton = screen.getByText('Beginner').closest('button');
    await user.click(beginnerButton!);
    
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('should highlight selected level', async () => {
    render(<SkillLevelSelector value={2} onChange={mockOnChange} />);
    
    await waitFor(() => {
      const selectedButton = screen.getByText('Competent Crew').closest('button');
      expect(selectedButton).toBeInTheDocument();
    });
    
    const selectedButton = screen.getByText('Competent Crew').closest('button');
    expect(selectedButton).toHaveClass('border-primary');
  });

  it('should show profile indicator when showProfileIndicator is true', () => {
    render(
      <SkillLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={2}
        showProfileIndicator={true}
      />
    );
    
    const profileBadge = screen.getByText('Profile');
    expect(profileBadge).toBeInTheDocument();
  });

  it('should not show profile indicator when showProfileIndicator is false', () => {
    render(
      <SkillLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={2}
        showProfileIndicator={false}
      />
    );
    
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
  });

  it('should call onWarning when selecting level higher than profile', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const [value, setValue] = useState<ExperienceLevel | null>(null);
      return (
        <SkillLevelSelector
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
            mockOnChange(newValue);
          }}
          profileValue={2}
          showProfileIndicator={true}
          showWarning={true}
          onWarning={mockOnWarning}
        />
      );
    };
    
    render(<TestComponent />);
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Coastal Skipper')).toBeInTheDocument();
    });
    
    const skipperButton = screen.getByText('Coastal Skipper').closest('button');
    await user.click(skipperButton!);
    
    // Wait for useEffect to trigger warning with the actual message
    await waitFor(() => {
      const warningCalls = mockOnWarning.mock.calls;
      const hasWarningMessage = warningCalls.some(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('higher than your profile level')
      );
      if (!hasWarningMessage) {
        throw new Error('Warning message not found yet');
      }
    }, { timeout: 2000 });
    
    // Verify the warning message was called
    const warningCalls = mockOnWarning.mock.calls;
    const hasWarningMessage = warningCalls.some(call => 
      call[0] && typeof call[0] === 'string' && call[0].includes('higher than your profile level')
    );
    expect(hasWarningMessage).toBe(true);
  });

  it('should call onInfoClick when a level is selected', async () => {
    const user = userEvent.setup();
    render(
      <SkillLevelSelector
        value={null}
        onChange={mockOnChange}
        onInfoClick={mockOnInfoClick}
      />
    );
    
    const beginnerButton = screen.getByText('Beginner').closest('button');
    await user.click(beginnerButton!);
    
    expect(mockOnInfoClick).toHaveBeenCalled();
  });

  it('should not call onWarning when selecting level equal to profile', async () => {
    const user = userEvent.setup();
    render(
      <SkillLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={2}
        showWarning={true}
        onWarning={mockOnWarning}
      />
    );
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Competent Crew')).toBeInTheDocument();
    });
    
    const crewButton = screen.getByText('Competent Crew').closest('button');
    await user.click(crewButton!);
    
    // Wait for useEffect to run and clear warning
    await waitFor(() => {
      expect(mockOnWarning).toHaveBeenCalled();
    }, { timeout: 2000 });
    
    // Should clear warning (call with null) for same level
    const lastCall = mockOnWarning.mock.calls[mockOnWarning.mock.calls.length - 1];
    expect(lastCall[0]).toBe(null);
  });

  it('should not call onWarning when selecting level lower than profile', async () => {
    const user = userEvent.setup();
    render(
      <SkillLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={3}
        showWarning={true}
        onWarning={mockOnWarning}
      />
    );
    
    // Select level 1 (lower than profile level 3)
    const beginnerButton = screen.getByText('Beginner').closest('button');
    await user.click(beginnerButton!);
    
    expect(mockOnWarning).toHaveBeenCalledWith(null);
  });
});
