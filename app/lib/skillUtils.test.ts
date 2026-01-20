import { describe, it, expect } from 'vitest';
import {
  toCanonicalSkillName,
  toDisplaySkillName,
  normalizeSkillNames,
  getAllCanonicalSkillNames,
  getAllDisplaySkillNames,
  isValidSkillName,
} from './skillUtils';

describe('toCanonicalSkillName', () => {
  it('should convert display format to canonical format', () => {
    expect(toCanonicalSkillName('Navigation')).toBe('navigation');
    expect(toCanonicalSkillName('First Aid')).toBe('first_aid');
    expect(toCanonicalSkillName('Sailing Experience')).toBe('sailing_experience');
  });

  it('should handle already canonical format', () => {
    expect(toCanonicalSkillName('navigation')).toBe('navigation');
    expect(toCanonicalSkillName('first_aid')).toBe('first_aid');
  });

  it('should handle multiple spaces', () => {
    expect(toCanonicalSkillName('First  Aid')).toBe('first_aid');
    expect(toCanonicalSkillName('Sailing   Experience')).toBe('sailing_experience');
  });

  it('should trim whitespace', () => {
    expect(toCanonicalSkillName('  Navigation  ')).toBe('navigation');
    expect(toCanonicalSkillName(' First Aid ')).toBe('first_aid');
  });

  it('should handle empty string', () => {
    expect(toCanonicalSkillName('')).toBe('');
  });

  it('should handle null and undefined', () => {
    expect(toCanonicalSkillName(null as any)).toBe('');
    expect(toCanonicalSkillName(undefined as any)).toBe('');
  });

  it('should convert to lowercase', () => {
    expect(toCanonicalSkillName('NAVIGATION')).toBe('navigation');
    expect(toCanonicalSkillName('FirstAid')).toBe('firstaid');
  });
});

describe('toDisplaySkillName', () => {
  it('should convert canonical format to display format', () => {
    expect(toDisplaySkillName('navigation')).toBe('Navigation');
    expect(toDisplaySkillName('first_aid')).toBe('First Aid');
    expect(toDisplaySkillName('sailing_experience')).toBe('Sailing Experience');
  });

  it('should handle single word', () => {
    expect(toDisplaySkillName('navigation')).toBe('Navigation');
  });

  it('should handle multiple underscores', () => {
    expect(toDisplaySkillName('first_aid_certification')).toBe('First Aid Certification');
  });

  it('should handle empty string', () => {
    expect(toDisplaySkillName('')).toBe('');
  });

  it('should handle null and undefined', () => {
    expect(toDisplaySkillName(null as any)).toBe('');
    expect(toDisplaySkillName(undefined as any)).toBe('');
  });
});

describe('normalizeSkillNames', () => {
  it('should normalize array of display format skills', () => {
    const result = normalizeSkillNames(['Navigation', 'First Aid']);
    expect(result).toEqual(['navigation', 'first_aid']);
  });

  it('should normalize array of canonical format skills', () => {
    const result = normalizeSkillNames(['navigation', 'first_aid']);
    expect(result).toEqual(['navigation', 'first_aid']);
  });

  it('should handle mixed format skills', () => {
    const result = normalizeSkillNames(['Navigation', 'first_aid']);
    expect(result).toEqual(['navigation', 'first_aid']);
  });

  it('should handle JSON string format from profiles', () => {
    const jsonSkill = JSON.stringify({ skill_name: 'Navigation', description: 'Test' });
    const result = normalizeSkillNames([jsonSkill]);
    expect(result).toEqual(['navigation']);
  });

  it('should handle object format with skill_name property', () => {
    const result = normalizeSkillNames([
      { skill_name: 'Navigation', description: 'Test' } as any,
    ]);
    expect(result).toEqual(['navigation']);
  });

  it('should filter out empty strings', () => {
    const result = normalizeSkillNames(['Navigation', '', 'First Aid', '   ']);
    expect(result).toEqual(['navigation', 'first_aid']);
  });

  it('should handle empty array', () => {
    const result = normalizeSkillNames([]);
    expect(result).toEqual([]);
  });

  it('should handle non-array input', () => {
    expect(normalizeSkillNames(null as any)).toEqual([]);
    expect(normalizeSkillNames(undefined as any)).toEqual([]);
  });

  it('should handle invalid JSON strings gracefully', () => {
    // Invalid JSON should be treated as plain skill name and normalized
    const result = normalizeSkillNames(['{invalid json}', 'Navigation']);
    expect(result).toEqual(['invalid_json', 'navigation']);
  });
});

describe('getAllCanonicalSkillNames', () => {
  it('should return array of canonical skill names', () => {
    const result = getAllCanonicalSkillNames();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return all skills in canonical format', () => {
    const result = getAllCanonicalSkillNames();
    result.forEach(skill => {
      expect(skill).toBe(skill.toLowerCase());
      expect(skill).not.toContain(' ');
    });
  });
});

describe('getAllDisplaySkillNames', () => {
  it('should return array of display format skill names', () => {
    const result = getAllDisplaySkillNames();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should convert canonical names to display format', () => {
    const canonical = getAllCanonicalSkillNames();
    const display = getAllDisplaySkillNames();
    expect(display.length).toBe(canonical.length);
  });
});

describe('isValidSkillName', () => {
  it('should return true for valid skill names in canonical format', () => {
    const validSkills = getAllCanonicalSkillNames();
    if (validSkills.length > 0) {
      expect(isValidSkillName(validSkills[0])).toBe(true);
    }
  });

  it('should return true for valid skill names in display format', () => {
    const validSkills = getAllCanonicalSkillNames();
    if (validSkills.length > 0) {
      const displayName = toDisplaySkillName(validSkills[0]);
      expect(isValidSkillName(displayName)).toBe(true);
    }
  });

  it('should return false for invalid skill names', () => {
    expect(isValidSkillName('Invalid Skill Name')).toBe(false);
    expect(isValidSkillName('nonexistent_skill')).toBe(false);
  });

  it('should handle case insensitivity', () => {
    const validSkills = getAllCanonicalSkillNames();
    if (validSkills.length > 0) {
      expect(isValidSkillName(validSkills[0].toUpperCase())).toBe(true);
    }
  });
});
