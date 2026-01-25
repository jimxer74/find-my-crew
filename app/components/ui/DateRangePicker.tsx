'use client';

import { useState, useEffect, useRef } from 'react';

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
}: DateRangePickerProps) {
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
  };

  const handleSave = () => {
    onChange(tempRange);
    onClose?.();
  };

  const handleCancel = () => {
    setTempRange(value); // Revert to original value
    setSelectingStart(true);
    onClose?.();
  };

  const isDateInRange = (day: number, month: Date): boolean => {
    if (!tempRange.start || !tempRange.end) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return date >= tempRange.start && date <= tempRange.end;
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
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-muted rounded-md transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="font-semibold text-foreground text-sm sm:text-base">
            {monthName} {year}
          </div>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-muted rounded-md transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
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
              <button
                key={`${month.getTime()}-${day}`}
                onClick={() => !isDisabled && handleDateClick(day, month)}
                disabled={isDisabled}
                className={`
                  w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center text-sm rounded-md transition-colors font-medium
                  ${isDisabled 
                    ? 'text-muted-foreground/30 cursor-not-allowed' 
                    : 'hover:bg-accent cursor-pointer active:scale-95'
                  }
                  ${isStart || isEnd
                    ? 'bg-foreground text-background font-semibold shadow-sm'
                    : isInRange
                    ? 'bg-muted text-foreground'
                    : 'text-foreground'
                  }
                `}
              >
                {day}
              </button>
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
      <button
        onClick={handleCancel}
        className="absolute top-2 right-2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-muted rounded-md transition-colors"
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
      </button>

      {/* Availability label - shown on large screens */}
      <div className="hidden lg:block mb-4 pb-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Availability</h3>
        <p className="text-sm text-muted-foreground mt-1">Select your available date range</p>
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
        <button
          onClick={handleCancel}
          className="px-4 py-3 min-h-[44px] text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-3 min-h-[44px] text-sm font-medium text-background bg-foreground hover:opacity-90 rounded-md transition-opacity"
        >
          Save
        </button>
      </div>
    </div>
  );
}
