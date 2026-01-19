# Skills Storage Refactoring Summary

## Overview
Refactored all skills saving functionalities to use a consistent canonical format (lowercase with underscores) across profiles, journeys, and legs tables.

## Canonical Format
- **Format**: Lowercase with underscores (e.g., `"navigation"`, `"sailing_experience"`, `"first_aid"`)
- **Source**: Defined in `/app/config/skills-config.json` where skill names are already in canonical format

## Changes Made

### 1. Created Utility Functions (`app/lib/skillUtils.ts`)
- `toCanonicalSkillName()`: Converts display format to canonical format
- `toDisplaySkillName()`: Converts canonical format to display format (Title Case)
- `normalizeSkillNames()`: Normalizes an array of skill names to canonical format
- `getAllCanonicalSkillNames()`: Returns all valid skill names from config
- `getAllDisplaySkillNames()`: Returns all skill names in display format
- `isValidSkillName()`: Validates if a skill name exists in config

### 2. Updated Save Operations

#### Profiles (`app/profile/page.tsx`)
- **Status**: Already using canonical format ✓
- Skills are stored as JSON strings: `'{"skill_name": "navigation", "description": "..."}'`
- The `skill_name` field uses `skill.name` from config, which is already canonical

#### Journeys (`app/components/manage/JourneyFormModal.tsx`)
- **Before**: Saved skills in display format (Title Case with spaces)
- **After**: Normalizes skills to canonical format before saving
- **Loading**: Converts canonical format to display format for UI

#### Legs (`app/components/manage/LegFormModal.tsx`)
- **Before**: Saved skills in display format (Title Case with spaces)
- **After**: Normalizes skills to canonical format before saving
- **Loading**: Converts canonical format to display format for UI

### 3. Updated API Endpoints

#### `/api/registrations/crew/details/route.ts`
- Uses `normalizeSkillNames()` utility for consistent parsing
- Returns skills in canonical format
- Handles both JSON strings (profiles) and plain strings (journeys/legs)

### 4. Updated Frontend Components

#### `SkillsMatchingDisplay` Component
- Converts skills to display format when rendering
- Matching logic uses canonical format internally

#### `CrewBrowseMap`
- User skills kept in canonical format for matching
- Uses `normalizeSkillNames()` utility

#### `My Registrations Page`
- Uses `normalizeSkillNames()` utility for user skills
- Skills from API are already in canonical format

### 5. Updated Matching Logic (`app/lib/skillMatching.ts`)
- Uses `toCanonicalSkillName()` from `skillUtils.ts`
- All comparisons use canonical format
- Ensures consistent matching regardless of input format

### 6. Database Migration (`migrations/normalize_skills_to_canonical_format.sql`)
- Normalizes existing data in `journeys`, `legs`, and `profiles` tables
- Converts display format to canonical format
- Handles edge cases (null, empty arrays, JSON strings)
- Adds column comments explaining the canonical format

## Migration Instructions

1. **Run the migration SQL**:
   ```sql
   -- Execute: migrations/normalize_skills_to_canonical_format.sql
   ```

2. **Verify the migration**:
   ```sql
   -- Check journeys
   SELECT id, name, skills FROM journeys LIMIT 5;
   
   -- Check legs
   SELECT id, name, skills FROM legs LIMIT 5;
   
   -- Check profiles
   SELECT id, username, skills FROM profiles LIMIT 5;
   ```

3. **Expected Results**:
   - All skills should be in lowercase with underscores
   - Examples: `["navigation", "sailing_experience"]` not `["Navigation", "Sailing Experience"]`

## Benefits

1. **Consistent Storage**: All skills stored in the same format across all tables
2. **Accurate Matching**: Skills matching works correctly regardless of how data was entered
3. **Maintainability**: Single source of truth for skill name normalization
4. **Future-Proof**: Easy to add new skills or change display format without affecting storage

## Testing Checklist

- [ ] Profile skills save correctly (already canonical)
- [ ] Journey skills save in canonical format
- [ ] Leg skills save in canonical format
- [ ] Skills display correctly in UI (converted to Title Case)
- [ ] Skills matching works correctly
- [ ] Migration SQL runs without errors
- [ ] Existing data is normalized correctly
