import { describe, it, expect } from 'vitest';
import {
  calculateMatchPercentage,
  checkExperienceLevelMatch,
  getMatchColorClass,
  getMatchTextColorClass,
  getMatchBgColorClass,
  getMatchMarkerColor,
  getMatchingAndMissingSkills,
} from './skillMatching';

describe('calculateMatchPercentage', () => {
  it('should return 100 when leg has no skill requirements', () => {
    const result = calculateMatchPercentage(['Navigation'], [], 2, null);
    expect(result).toBe(100);
  });

  it('should return 0 when user experience level is insufficient', () => {
    const result = calculateMatchPercentage(['Navigation'], ['Navigation'], 1, 3);
    expect(result).toBe(0);
  });

  it('should return 100 when user experience level is null and leg requires level (no experience check)', () => {
    // When userExperienceLevel is null, the function doesn't check experience level
    // It only checks if legMinExperienceLevel is not null AND userExperienceLevel is not null
    const result = calculateMatchPercentage(['Navigation'], ['Navigation'], null, 2);
    expect(result).toBe(100); // Skills match, experience check is skipped when user level is null
  });

  it('should return 100 when user has all required skills', () => {
    const result = calculateMatchPercentage(
      ['Navigation', 'First Aid'],
      ['Navigation', 'First Aid'],
      2,
      2
    );
    expect(result).toBe(100);
  });

  it('should return 50 when user has half of required skills', () => {
    const result = calculateMatchPercentage(
      ['Navigation'],
      ['Navigation', 'First Aid'],
      2,
      2
    );
    expect(result).toBe(50);
  });

  it('should return 0 when user has no matching skills', () => {
    const result = calculateMatchPercentage(
      ['Navigation'],
      ['First Aid', 'Engine Maintenance'],
      2,
      2
    );
    expect(result).toBe(0);
  });

  it('should handle skill name normalization (display vs canonical format)', () => {
    const result = calculateMatchPercentage(
      ['Navigation'], // Display format
      ['navigation'], // Canonical format
      2,
      2
    );
    expect(result).toBe(100);
  });

  it('should handle empty user skills array', () => {
    const result = calculateMatchPercentage([], ['Navigation'], 2, 2);
    expect(result).toBe(0);
  });

  it('should handle null experience levels correctly', () => {
    const result = calculateMatchPercentage(['Navigation'], ['Navigation'], null, null);
    expect(result).toBe(100);
  });

  it('should round percentages correctly', () => {
    // 1 out of 3 skills = 33.33%, should round to 33
    const result = calculateMatchPercentage(
      ['Navigation'],
      ['Navigation', 'First Aid', 'Engine Maintenance'],
      2,
      2
    );
    expect(result).toBe(33);
  });
});

describe('checkExperienceLevelMatch', () => {
  it('should return true when leg has no experience requirement', () => {
    expect(checkExperienceLevelMatch(2, null)).toBe(true);
    expect(checkExperienceLevelMatch(null, null)).toBe(true);
  });

  it('should return false when user has no experience level but leg requires one', () => {
    expect(checkExperienceLevelMatch(null, 2)).toBe(false);
  });

  it('should return true when user level equals required level', () => {
    expect(checkExperienceLevelMatch(2, 2)).toBe(true);
    expect(checkExperienceLevelMatch(4, 4)).toBe(true);
  });

  it('should return true when user level exceeds required level', () => {
    expect(checkExperienceLevelMatch(3, 2)).toBe(true);
    expect(checkExperienceLevelMatch(4, 1)).toBe(true);
  });

  it('should return false when user level is below required level', () => {
    expect(checkExperienceLevelMatch(1, 2)).toBe(false);
    expect(checkExperienceLevelMatch(2, 4)).toBe(false);
  });
});

describe('getMatchColorClass', () => {
  it('should return green for high match (>=80)', () => {
    expect(getMatchColorClass(100)).toBe('bg-green-500 border-green-600');
    expect(getMatchColorClass(80)).toBe('bg-green-500 border-green-600');
  });

  it('should return yellow for medium match (50-79)', () => {
    expect(getMatchColorClass(79)).toBe('bg-yellow-500 border-yellow-600');
    expect(getMatchColorClass(50)).toBe('bg-yellow-500 border-yellow-600');
  });

  it('should return orange for low match (25-49)', () => {
    expect(getMatchColorClass(49)).toBe('bg-orange-500 border-orange-600');
    expect(getMatchColorClass(25)).toBe('bg-orange-500 border-orange-600');
  });

  it('should return red for very low match (<25)', () => {
    expect(getMatchColorClass(24)).toBe('bg-red-500 border-red-600');
    expect(getMatchColorClass(0)).toBe('bg-red-500 border-red-600');
  });
});

describe('getMatchTextColorClass', () => {
  it('should return correct text colors for different match percentages', () => {
    expect(getMatchTextColorClass(100)).toBe('text-green-700');
    expect(getMatchTextColorClass(70)).toBe('text-yellow-700');
    expect(getMatchTextColorClass(30)).toBe('text-orange-700');
    expect(getMatchTextColorClass(10)).toBe('text-red-700');
  });
});

describe('getMatchBgColorClass', () => {
  it('should return correct background colors for different match percentages', () => {
    expect(getMatchBgColorClass(100)).toBe('bg-green-50 border-green-200');
    expect(getMatchBgColorClass(70)).toBe('bg-yellow-50 border-yellow-200');
    expect(getMatchBgColorClass(30)).toBe('bg-orange-50 border-orange-200');
    expect(getMatchBgColorClass(10)).toBe('bg-red-50 border-red-200');
  });
});

describe('getMatchMarkerColor', () => {
  it('should return red when experience level does not match', () => {
    expect(getMatchMarkerColor(100, false)).toBe('#ef4444');
    expect(getMatchMarkerColor(80, false)).toBe('#ef4444');
  });

  it('should return green for high match when experience matches', () => {
    expect(getMatchMarkerColor(100, true)).toBe('#22c55e');
    expect(getMatchMarkerColor(80, true)).toBe('#22c55e');
  });

  it('should return yellow for medium match', () => {
    expect(getMatchMarkerColor(70, true)).toBe('#eab308');
    expect(getMatchMarkerColor(50, true)).toBe('#eab308');
  });

  it('should return orange for low match', () => {
    expect(getMatchMarkerColor(30, true)).toBe('#f97316');
    expect(getMatchMarkerColor(25, true)).toBe('#f97316');
  });

  it('should return red for very low match', () => {
    expect(getMatchMarkerColor(20, true)).toBe('#ef4444');
    expect(getMatchMarkerColor(0, true)).toBe('#ef4444');
  });
});

describe('getMatchingAndMissingSkills', () => {
  it('should return all skills as matching when user has all required skills', () => {
    const result = getMatchingAndMissingSkills(
      ['Navigation', 'First Aid'],
      ['Navigation', 'First Aid']
    );
    expect(result.matching).toEqual(['navigation', 'first_aid']);
    expect(result.missing).toEqual([]);
  });

  it('should return correct matching and missing skills', () => {
    const result = getMatchingAndMissingSkills(
      ['Navigation'],
      ['Navigation', 'First Aid', 'Engine Maintenance']
    );
    expect(result.matching).toEqual(['navigation']);
    expect(result.missing).toEqual(['first_aid', 'engine_maintenance']);
  });

  it('should return all skills as missing when user has no matching skills', () => {
    const result = getMatchingAndMissingSkills(
      ['Navigation'],
      ['First Aid', 'Engine Maintenance']
    );
    expect(result.matching).toEqual([]);
    expect(result.missing).toEqual(['first_aid', 'engine_maintenance']);
  });

  it('should handle skill name normalization', () => {
    const result = getMatchingAndMissingSkills(
      ['Navigation'], // Display format
      ['navigation'] // Canonical format
    );
    expect(result.matching).toEqual(['navigation']);
    expect(result.missing).toEqual([]);
  });

  it('should handle empty arrays', () => {
    const result = getMatchingAndMissingSkills([], []);
    expect(result.matching).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('should handle empty user skills', () => {
    const result = getMatchingAndMissingSkills([], ['Navigation', 'First Aid']);
    expect(result.matching).toEqual([]);
    expect(result.missing).toEqual(['navigation', 'first_aid']);
  });
});
