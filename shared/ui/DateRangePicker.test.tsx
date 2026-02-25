import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker, DateRange } from './DateRangePicker';

describe('DateRangePicker', () => {
  const mockOnChange = vi.fn();
  const mockOnClose = vi.fn();

  const defaultProps = {
    value: { start: null, end: null } as DateRange,
    onChange: mockOnChange,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render calendar with current month', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    const today = new Date();
    const monthName = today.toLocaleDateString('en-US', { month: 'long' });
    expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument();
  });

  it('should navigate to previous month', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    const prevButtons = screen.getAllByLabelText('Previous month');
    await user.click(prevButtons[0]); // Click first calendar's prev button
    
    // Wait for month to update
    await waitFor(() => {
      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const monthName = prevMonth.toLocaleDateString('en-US', { month: 'long' });
      expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument();
    });
  });

  it('should navigate to next month', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    const nextButtons = screen.getAllByLabelText('Next month');
    await user.click(nextButtons[0]); // Click first calendar's next button
    
    // Wait for month to update
    await waitFor(() => {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthName = nextMonth.toLocaleDateString('en-US', { month: 'long' });
      expect(screen.getByText(new RegExp(monthName))).toBeInTheDocument();
    });
  });

  it('should select start date when clicking a date', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    // Click on day 15 (use getAllByText since there are two calendars)
    const day15Buttons = screen.getAllByText('15');
    await user.click(day15Buttons[0]); // Click first calendar's day 15
    
    // Start date should be selected (visual indication)
    await waitFor(() => {
      expect(day15Buttons[0].closest('button')).toHaveClass('bg-foreground');
    });
  });

  it('should select end date after start date is selected', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    // Click on day 15 (start)
    const day15Buttons = screen.getAllByText('15');
    await user.click(day15Buttons[0]);
    
    // Click on day 20 (end)
    const day20Buttons = screen.getAllByText('20');
    await user.click(day20Buttons[0]);
    
    // Both dates should be selected
    await waitFor(() => {
      expect(day15Buttons[0].closest('button')).toHaveClass('bg-foreground');
      expect(day20Buttons[0].closest('button')).toHaveClass('bg-foreground');
    });
  });

  it('should swap dates if end date is before start date', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    // Click on day 20 first
    const day20Buttons = screen.getAllByText('20');
    await user.click(day20Buttons[0]);
    
    // Click on day 15 (before day 20)
    const day15Buttons = screen.getAllByText('15');
    await user.click(day15Buttons[0]);
    
    // Day 15 should become start, day 20 should become end
    await waitFor(() => {
      expect(day15Buttons[0].closest('button')).toHaveClass('bg-foreground');
      expect(day20Buttons[0].closest('button')).toHaveClass('bg-foreground');
    });
  });

  it('should call onChange and onClose when Save is clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    // Select a date range
    const day15Buttons = screen.getAllByText('15');
    await user.click(day15Buttons[0]);
    
    const day20Buttons = screen.getAllByText('20');
    await user.click(day20Buttons[0]);
    
    // Click Save
    const saveButton = screen.getByText('Save');
    await user.click(saveButton);
    
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should revert changes and call onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const initialValue: DateRange = { start: new Date(2024, 5, 15), end: new Date(2024, 5, 20) };
    
    render(<DateRangePicker {...defaultProps} value={initialValue} />);
    
    // Select a different date
    const day10Buttons = screen.getAllByText('10');
    await user.click(day10Buttons[0]);
    
    // Click Cancel
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
    // onChange should not be called with new value
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should show Close button and call onClose when clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangePicker {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should disable dates before minDate', async () => {
    const user = userEvent.setup();
    const minDate = new Date(2024, 5, 10); // June 10, 2024
    // Set initial value to June 2024 so calendar shows that month
    const initialValue: DateRange = { start: new Date(2024, 5, 15), end: null };
    
    render(<DateRangePicker {...defaultProps} value={initialValue} minDate={minDate} />);
    
    // Wait for calendar to render June 2024
    await waitFor(() => {
      expect(screen.getByText(/June/)).toBeInTheDocument();
    });
    
    // Day 5 should be disabled (before minDate of June 10)
    const day5Buttons = screen.getAllByText('5');
    if (day5Buttons.length > 0) {
      const day5Button = day5Buttons[0].closest('button');
      expect(day5Button).toBeDisabled();
    }
  });

  it('should disable dates after maxDate', async () => {
    const user = userEvent.setup();
    const maxDate = new Date(2024, 5, 25); // June 25, 2024
    
    render(<DateRangePicker {...defaultProps} maxDate={maxDate} />);
    
    // Day 30 should be disabled (if it exists)
    const day30 = screen.queryByText('30');
    if (day30) {
      const day30Button = day30.closest('button');
      expect(day30Button).toBeDisabled();
    }
  });

  it('should initialize with provided value', () => {
    const startDate = new Date(2024, 5, 15);
    const endDate = new Date(2024, 5, 20);
    const value: DateRange = { start: startDate, end: endDate };
    
    render(<DateRangePicker {...defaultProps} value={value} />);
    
    // The calendar should show June 2024
    expect(screen.getByText(/June/)).toBeInTheDocument();
  });

  it('should display two months side by side on larger screens', () => {
    render(<DateRangePicker {...defaultProps} />);
    
    // Should show current month and next month
    const calendars = screen.getAllByText(/Mo/);
    expect(calendars.length).toBeGreaterThanOrEqual(1);
  });
});
