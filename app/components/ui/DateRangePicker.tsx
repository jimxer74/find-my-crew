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
}: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
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

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

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

    if (selectingStart || !value.start) {
      // Starting a new selection
      onChange({ start: clickedDate, end: null });
      setSelectingStart(false);
    } else {
      // Completing the range
      if (clickedDate < value.start) {
        // If clicked date is before start, make it the new start
        onChange({ start: clickedDate, end: value.start });
      } else {
        // Normal case: set end date
        onChange({ start: value.start, end: clickedDate });
      }
      setSelectingStart(true);
    }
  };

  const isDateInRange = (day: number, month: Date): boolean => {
    if (!value.start || !value.end) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return date >= value.start && date <= value.end;
  };

  const isStartDate = (day: number, month: Date): boolean => {
    if (!value.start) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return date.getTime() === value.start.getTime();
  };

  const isEndDate = (day: number, month: Date): boolean => {
    if (!value.end) return false;
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    return date.getTime() === value.end.getTime();
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
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label="Previous month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="font-semibold text-foreground">
            {monthName} {year}
          </div>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 hover:bg-muted rounded transition-colors"
            aria-label="Next month"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="aspect-square" />;
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
                  aspect-square flex items-center justify-center text-sm rounded transition-colors
                  ${isDisabled 
                    ? 'text-muted-foreground/30 cursor-not-allowed' 
                    : 'hover:bg-accent cursor-pointer'
                  }
                  ${isStart || isEnd
                    ? 'bg-foreground text-background font-semibold'
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
      className={`bg-card border border-border rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Mode selector tabs - Currently only Days mode */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex bg-muted rounded-lg p-1">
          <button className="px-4 py-2 rounded-md bg-card text-foreground font-medium text-sm transition-colors">
            Days
          </button>
        </div>
      </div>

      {/* Two-month calendar view */}
      <div className="flex gap-8">
        {renderCalendar(currentMonth)}
        {renderCalendar(getNextMonth())}
      </div>
    </div>
  );
}
