import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillLevelSelector } from './SkillLevelSelector';
import { ExperienceLevel } from '@/app/types/experience-levels';

describe('SkillLevelSelector', () => {
  const mockOnChange = vi.fn();
  const mockOnInfoClick = vi.fn();
  const mockOnWarning = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all experience level options', async () => {
    render(<SkillLevelSelector value={null} onChange={mockOnChange} />);
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText('Beginner')).toBeInTheDocument();
      expect(screen.getByText('Confident Crew')).toBeInTheDocument();
      expect(screen.getByText('Competent Coastal Skipper')).toBeInTheDocument();
      expect(screen.getByText('Offshore Skipper')).toBeInTheDocument();
    });
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
      const selectedButton = screen.getByText('Confident Crew').closest('button');
      expect(selectedButton).toHaveClass('border-primary');
    });
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
    render(
      <SkillLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={2}
        showProfileIndicator={true}
        showWarning={true}
        onWarning={mockOnWarning}
      />
    );
    
    // Select level 3 (higher than profile level 2)
    await waitFor(() => {
      const skipperButton = screen.getByText('Competent Coastal Skipper').closest('button');
      expect(skipperButton).toBeInTheDocument();
    });
    
    const skipperButton = screen.getByText('Competent Coastal Skipper').closest('button');
    await user.click(skipperButton!);
    
    await waitFor(() => {
      expect(mockOnWarning).toHaveBeenCalled();
      const warningCall = mockOnWarning.mock.calls.find(call => call[0] && call[0].includes('higher than your profile level'));
      expect(warningCall).toBeDefined();
    });
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
    
    // Select level 2 (same as profile)
    await waitFor(() => {
      const crewButton = screen.getByText('Confident Crew').closest('button');
      expect(crewButton).toBeInTheDocument();
    });
    
    const crewButton = screen.getByText('Confident Crew').closest('button');
    await user.click(crewButton!);
    
    // Should not warn for same level - wait for useEffect to run
    await waitFor(() => {
      expect(mockOnWarning).toHaveBeenCalledWith(null);
    });
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
