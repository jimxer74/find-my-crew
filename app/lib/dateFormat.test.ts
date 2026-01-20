import { describe, it, expect } from 'vitest';
import { formatDate, formatDateShort } from './dateFormat';

describe('formatDate', () => {
  it('should format valid date string correctly', () => {
    const result = formatDate('2024-06-15');
    // Format should be "Jun 15, 2024" (month short, day, year)
    expect(result).toMatch(/Jun\s+15,\s+2024/);
  });

  it('should format Date object correctly', () => {
    const date = new Date('2024-06-15');
    const result = formatDate(date);
    expect(result).toMatch(/Jun\s+15,\s+2024/);
  });

  it('should return "Not set" for null', () => {
    expect(formatDate(null)).toBe('Not set');
  });

  it('should return "Not set" for undefined', () => {
    expect(formatDate(undefined)).toBe('Not set');
  });

  it('should return "Invalid date" for invalid date string', () => {
    expect(formatDate('invalid-date')).toBe('Invalid date');
    expect(formatDate('2024-13-45')).toBe('Invalid date');
  });

  it('should return "Invalid date" for invalid Date object', () => {
    const invalidDate = new Date('invalid');
    expect(formatDate(invalidDate)).toBe('Invalid date');
  });

  it('should handle different date formats', () => {
    const isoDate = '2024-06-15T10:30:00Z';
    const result = formatDate(isoDate);
    expect(result).toMatch(/Jun\s+15,\s+2024/);
  });

  it('should format dates in different months correctly', () => {
    expect(formatDate('2024-01-01')).toMatch(/Jan\s+1,\s+2024/);
    expect(formatDate('2024-12-31')).toMatch(/Dec\s+31,\s+2024/);
  });
});

describe('formatDateShort', () => {
  it('should format valid date string without year', () => {
    const result = formatDateShort('2024-06-15');
    // Format should be "Jun 15" (month short, day)
    expect(result).toMatch(/Jun\s+15/);
    expect(result).not.toContain('2024');
  });

  it('should format Date object without year', () => {
    const date = new Date('2024-06-15');
    const result = formatDateShort(date);
    expect(result).toMatch(/Jun\s+15/);
    expect(result).not.toContain('2024');
  });

  it('should return "Not set" for null', () => {
    expect(formatDateShort(null)).toBe('Not set');
  });

  it('should return "Not set" for undefined', () => {
    expect(formatDateShort(undefined)).toBe('Not set');
  });

  it('should return "Invalid date" for invalid date string', () => {
    expect(formatDateShort('invalid-date')).toBe('Invalid date');
  });

  it('should return "Invalid date" for invalid Date object', () => {
    const invalidDate = new Date('invalid');
    expect(formatDateShort(invalidDate)).toBe('Invalid date');
  });

  it('should format dates in different months correctly', () => {
    expect(formatDateShort('2024-01-01')).toMatch(/Jan\s+1/);
    expect(formatDateShort('2024-12-31')).toMatch(/Dec\s+31/);
  });

  it('should not include year in output', () => {
    const result = formatDateShort('2024-06-15');
    expect(result).not.toMatch(/\d{4}/); // Should not contain 4-digit year
  });
});
