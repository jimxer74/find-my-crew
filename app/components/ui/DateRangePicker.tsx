'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './Button/Button';

export type DateRange = {
  start: Date | null;
  end: Date | null;
};

export type DateRangePickerProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onClose?: () => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  disableClickOutside?: boolean;
  isInDialog?: boolean;
  allowSingleDate?: boolean; // If true, allows selecting just one date (sets both start and end to the same date)
};

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DateRangePicker({
  value,
  onChange,
  onClose,
  minDate,
  maxDate,
  className = '',
  disableClickOutside = false,
  isInDialog = false,
  allowSingleDate = false,
}: DateRangePickerProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempRange, setTempRange] = useState<DateRange>(value);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Initialize current month based on selected dates or today
  useEffect(() => {
    if (value.start) {
      setCurrentMonth(new Date(value.start.getFullYear(), value.start.getMonth(), 1));
    } else {
      const today = new Date();
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }, []);

  // Update temp range when value prop changes
  useEffect(() => {
    setTempRange(value);
  }, [value]);

  // Close picker when clicking outside
  useEffect(() => {
    if (disableClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, disableClickOutside]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0

    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const handleDateClick = (day: number, month: Date) => {
    const clickedDate = new Date(month.getFullYear(), month.getMonth(), day);
    
    // Check if date is within min/max constraints
    if (minDate && clickedDate < minDate) return;
    if (maxDate && clickedDate > maxDate) return;

    if (allowSingleDate) {
      // Dual mode: supports both single date and range selection
      if (!tempRange.start) {
        // First click: set start date
        setTempRange({ start: clickedDate, end: null });
        setSelectingStart(false);
      } else if (!tempRange.end) {
        // Second click: can set end date (range) or same date (single date)
        if (clickedDate.getTime() === tempRange.start.getTime()) {
          // Same date clicked - set both to same date (single date mode)
          setTempRange({ start: clickedDate, end: clickedDate });
          setSelectingStart(true);
        } else if (clickedDate < tempRange.start) {
          // Clicked date is before start - make it the new start
          setTempRange({ start: clickedDate, end: tempRange.start });
          setSelectingStart(true);
        } else {
          // Normal case: set end date (range mode)
          setTempRange({ start: tempRange.start, end: clickedDate });
          setSelectingStart(true);
        }
      } else {
        // Both dates already set - clicking starts a new selection
        if (clickedDate.getTime() === tempRange.start.getTime() && 
            clickedDate.getTime() === tempRange.end.getTime()) {
          // Clicking the same single date again - clear selection
          setTempRange({ start: null, end: null });
          setSelectingStart(true);
        } else {
          // Start new selection
          setTempRange({ start: clickedDate, end: null });
          setSelectingStart(false);
        }
      }
    } else {
      // Range selection mode only (original behavior)
      if (selectingStart || !tempRange.start) {
        // Starting a new selection
        setTempRange({ start: clickedDate, end: null });
        setSelectingStart(false);
      } else {
        // Completing the range
        if (clickedDate < tempRange.start) {
          // If clicked date is before start, make it the new start
          setTempRange({ start: clickedDate, end: tempRange.start });
        } else {
          // Normal case: set end date
          setTempRange({ start: tempRange.start, end: clickedDate });
        }
        setSelectingStart(true);
      }
    }
  };

  const handleSave = () => {
    onChange(tempRange);
    onClose?.();
    // Navigate to crew dashboard after saving only if not in dialog
    if (!isInDialog) {
      router.push('/crew/dashboard');
      router.refresh();
    }
  };

  const handleCancel = () => {
    setTempRange(value); // Revert to original value
    setSelectingStart(true);
    onClose?.();
  };

  const isDateInRange = (day: number, month: Date): boolean => {
    if (!tempRange.start) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    
    // If only start date is selected (no end date yet), don't highlight range
    if (!tempRange.end) return false;
    
    // Check if date is within the range (inclusive)
    const startTime = tempRange.start.getTime();
    const endTime = tempRange.end.getTime();
    const dateTime = date.getTime();
    
    // Handle both single date (start === end) and range (start < end or start > end)
    if (startTime === endTime) {
      // Single date: highlight only if it's the exact same date
      return dateTime === startTime;
    } else {
      // Range: highlight dates between start and end (inclusive)
      const minTime = Math.min(startTime, endTime);
      const maxTime = Math.max(startTime, endTime);
      return dateTime >= minTime && dateTime <= maxTime;
    }
  };

  const isStartDate = (day: number, month: Date): boolean => {
    if (!tempRange.start) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return date.getTime() === tempRange.start.getTime();
  };

  const isEndDate = (day: number, month: Date): boolean => {
    if (!tempRange.end) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return date.getTime() === tempRange.end.getTime();
  };

  const isDateDisabled = (day: number, month: Date): boolean => {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const getNextMonth = () => {
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  };

  const renderCalendar = (month: Date) => {
    const days = getDaysInMonth(month);
    const monthName = MONTHS[month.getMonth()];
    const year = month.getFullYear();

    return (
      <div className="flex flex-col min-w-[280px] w-full sm:w-auto">
        <div className="flex items-center justify-center gap-3 mb-4 sm:mb-5">
          <Button
            onClick={() => navigateMonth('prev')}
            variant="ghost"
            size="sm"
            className="!p-2 !min-w-[44px] !min-h-[44px] !flex !items-center !justify-center"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div className="font-semibold text-foreground text-sm sm:text-base">
            {monthName} {year}
          </div>
          <Button
            onClick={() => navigateMonth('next')}
            variant="ghost"
            size="sm"
            className="!p-2 !min-w-[44px] !min-h-[44px] !flex !items-center !justify-center"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1.5 w-9">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="w-9 h-9" />;
            }

            const isInRange = isDateInRange(day, month);
            const isStart = isStartDate(day, month);
            const isEnd = isEndDate(day, month);
            const isDisabled = isDateDisabled(day, month);

            return (
              <Button
                key={`${month.getTime()}-${day}`}
                onClick={() => !isDisabled && handleDateClick(day, month)}
                disabled={isDisabled}
                variant={isStart || isEnd ? 'primary' : isInRange ? 'outline' : 'ghost'}
                size="sm"
                className={`!w-9 !h-9 !min-w-[36px] !min-h-[36px] !p-0 !text-sm !rounded-md !font-medium ${
                  isStart || isEnd ? '!shadow-sm' : ''
                } ${isDisabled ? '!text-muted-foreground/30' : ''}`}
              >
                {day}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={pickerRef}
      className={`bg-card border border-border rounded-xl shadow-lg p-4 sm:p-6 relative z-[1] ${className}`}
    >
      {/* Close button */}
      <Button
        onClick={handleCancel}
        className="absolute top-2 right-2 !p-2 !min-w-[44px] !min-h-[44px] !flex !items-center !justify-center"
        variant="ghost"
        size="sm"
        aria-label="Close"
      >
        <svg
          className="w-5 h-5 text-foreground"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>

      {/* Availability label - shown on large screens */}
      <div className="hidden lg:block mb-4 pb-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Availability</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {allowSingleDate ? 'Select your available date' : 'Select your available date range'}
        </p>
      </div>

      {/* Calendar view - one month on small screens, two months on large screens */}
      <div className="flex gap-4 sm:gap-6 lg:gap-8 flex-col lg:flex-row justify-center mb-4 sm:mb-6">
        {renderCalendar(currentMonth)}
        {/* Second month - only visible on large screens */}
        <div className="hidden lg:block">
          {renderCalendar(getNextMonth())}
        </div>
      </div>

      {/* Save and Cancel buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
        <Button
          onClick={handleCancel}
          variant="ghost"
          className="!px-4 !py-3 !min-h-[44px] !text-sm"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="primary"
          className="!px-4 !py-3 !min-h-[44px] !text-sm"
        >
          {isInDialog ? 'Save' : 'Save and Search'}
        </Button>
      </div>
    </div>
  );
}
