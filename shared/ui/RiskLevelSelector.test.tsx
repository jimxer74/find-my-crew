import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RiskLevelSelector } from './RiskLevelSelector';

describe('RiskLevelSelector', () => {
  const mockOnChange = vi.fn();
  const mockOnInfoClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all risk level options', () => {
    render(<RiskLevelSelector value={null} onChange={mockOnChange} />);
    
    expect(screen.getByText('Coastal sailing')).toBeInTheDocument();
    expect(screen.getByText('Offshore sailing')).toBeInTheDocument();
    expect(screen.getByText('Extreme sailing')).toBeInTheDocument();
  });

  it('should call onChange when a level is clicked in multi-select mode', async () => {
    const user = userEvent.setup();
    render(<RiskLevelSelector value={[]} onChange={mockOnChange} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    expect(coastalButton).toBeInTheDocument();
    
    await user.click(coastalButton!);
    expect(mockOnChange).toHaveBeenCalledWith(['Coastal sailing']);
  });

  it('should toggle selection in multi-select mode', async () => {
    const user = userEvent.setup();
    render(<RiskLevelSelector value={['Coastal sailing']} onChange={mockOnChange} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    await user.click(coastalButton!);
    
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('should allow multiple selections in multi-select mode', async () => {
    const user = userEvent.setup();
    render(<RiskLevelSelector value={['Coastal sailing']} onChange={mockOnChange} />);
    
    const offshoreButton = screen.getByText('Offshore sailing').closest('button');
    await user.click(offshoreButton!);
    
    expect(mockOnChange).toHaveBeenCalledWith(['Coastal sailing', 'Offshore sailing']);
  });

  it('should work in single-select mode', async () => {
    const user = userEvent.setup();
    render(<RiskLevelSelector value={null} onChange={mockOnChange} singleSelect={true} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    await user.click(coastalButton!);
    
    expect(mockOnChange).toHaveBeenCalledWith('Coastal sailing');
  });

  it('should deselect in single-select mode when clicking same level', async () => {
    const user = userEvent.setup();
    render(<RiskLevelSelector value="Coastal sailing" onChange={mockOnChange} singleSelect={true} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    await user.click(coastalButton!);
    
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('should highlight selected levels', () => {
    render(<RiskLevelSelector value={['Coastal sailing', 'Offshore sailing']} onChange={mockOnChange} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    const offshoreButton = screen.getByText('Offshore sailing').closest('button');
    
    expect(coastalButton).toHaveClass('border-primary');
    expect(offshoreButton).toHaveClass('border-primary');
  });

  it('should show profile indicator when showProfileIndicator is true', () => {
    render(
      <RiskLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={['Coastal sailing']}
        showProfileIndicator={true}
      />
    );
    
    const profileBadge = screen.getByText('Profile');
    expect(profileBadge).toBeInTheDocument();
  });

  it('should not show profile indicator when showProfileIndicator is false', () => {
    render(
      <RiskLevelSelector
        value={null}
        onChange={mockOnChange}
        profileValue={['Coastal sailing']}
        showProfileIndicator={false}
      />
    );
    
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
  });

  it('should call onInfoClick when a level is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RiskLevelSelector
        value={null}
        onChange={mockOnChange}
        onInfoClick={mockOnInfoClick}
      />
    );
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    await user.click(coastalButton!);
    
    expect(mockOnInfoClick).toHaveBeenCalled();
  });

  it('should handle array value prop', () => {
    render(<RiskLevelSelector value={['Coastal sailing']} onChange={mockOnChange} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    expect(coastalButton).toHaveClass('border-primary');
  });

  it('should handle single value prop in multi-select mode', () => {
    render(<RiskLevelSelector value="Coastal sailing" onChange={mockOnChange} />);
    
    const coastalButton = screen.getByText('Coastal sailing').closest('button');
    expect(coastalButton).toHaveClass('border-primary');
  });
});
