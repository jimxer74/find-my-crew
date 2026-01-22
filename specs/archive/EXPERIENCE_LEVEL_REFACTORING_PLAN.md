# Experience Level Refactoring Plan

## Overview
Refactor Experience Level system to:
1. Use JSON configuration file (similar to `risk-levels-config.json` and `skills-config.json`)
2. Store numeric values (1-4) in database instead of text
3. Reference levels by numeric value throughout codebase
4. Make names and definitions configurable

## Current State
- **Database**: `profiles.sailing_experience` stores text: `'Beginner' | 'Competent Crew' | 'Coastal Skipper' | 'Offshore Skipper'`
- **Database**: `journeys.min_experience_level` stores text (same values)
- **Component**: `SkillLevelSelector.tsx` has hardcoded levels and info
- **Types**: TypeScript types use string literals

## Target State
- **Database**: Store integer values: `1 | 2 | 3 | 4` (or `NULL`)
- **Config**: `experience-levels-config.json` defines all level metadata
- **Code**: All references use numeric values internally
- **UI**: Component reads from config, displays names/descriptions dynamically

---

## Step-by-Step Implementation Plan

### Phase 1: Create Configuration File
**File**: `app/config/experience-levels-config.json`

**Structure**:
```json
{
  "levels": [
    {
      "value": 1,
      "name": "Beginner",
      "displayName": "Beginner",
      "icon": "/Beginner.png",
      "description": "Little to no previous time on sailboats (0–10–15 days total)",
      "infoText": "...",
      "typicalEquivalents": "RYA Competent Crew start / ASA 101 start / \"Green beginner\"",
      "note": "This level is about safety orientation, terminology, and getting comfortable on the water."
    },
    {
      "value": 2,
      "name": "Competent Crew",
      "displayName": "Competent Crew",
      "icon": "/Competent_crew.png",
      ...
    },
    {
      "value": 3,
      "name": "Coastal Skipper",
      "displayName": "Coastal Skipper",
      "icon": "/Coastal_skipper.png",
      ...
    },
    {
      "value": 4,
      "name": "Offshore Skipper",
      "displayName": "Offshore Skipper",
      "icon": "/Offshore_skipper.png",
      ...
    }
  ]
}
```

**Actions**:
1. Create JSON file with all 4 levels
2. Include all current info text content from `SkillLevelSelector.tsx`
3. Add icon paths
4. Add display names (may differ from internal names)

---

### Phase 2: Database Schema Changes

#### 2.1 Create Migration: Change Column Types
**File**: `migrations/change_experience_level_to_integer.sql`

**Actions**:
1. Add new integer columns:
   - `profiles.sailing_experience_level` (integer, nullable)
   - `journeys.min_experience_level` (integer, nullable) - already exists but as text
2. Migrate existing data:
   - Convert text values to integers:
     - `'Beginner'` → `1`
     - `'Competent Crew'` → `2`
     - `'Coastal Skipper'` → `3`
     - `'Offshore Skipper'` → `4`
     - `NULL` → `NULL`
3. Drop old text columns:
   - `profiles.sailing_experience` (text)
   - `journeys.min_experience_level` (text) - rename new column
4. Rename new columns to final names:
   - `profiles.sailing_experience_level` → `profiles.sailing_experience`
   - Or keep as `sailing_experience_level` for clarity?

**Decision Point**: 
- Option A: Keep `sailing_experience` name (simpler, but less clear it's numeric)
- Option B: Rename to `sailing_experience_level` (clearer, but requires more code changes)

**Recommendation**: Option A (keep `sailing_experience`) for backward compatibility in code references.

#### 2.2 Update Documentation
**File**: `specs/tables.txt`

**Actions**:
1. Update `profiles.sailing_experience` comment to: `integer, -- Experience level: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper`
2. Update `journeys.min_experience_level` comment similarly

---

### Phase 3: TypeScript Type Updates

#### 3.1 Create Shared Type Definition
**File**: `app/types/experience-levels.ts` (new file)

**Actions**:
1. Define type based on config:
   ```typescript
   export type ExperienceLevel = 1 | 2 | 3 | 4;
   ```
2. Export helper functions:
   - `getExperienceLevelConfig(level: ExperienceLevel)`
   - `getExperienceLevelByName(name: string): ExperienceLevel | null`
   - `getExperienceLevelDisplayName(level: ExperienceLevel): string`

#### 3.2 Update Component Types
**Files**:
- `app/components/ui/SkillLevelSelector.tsx`
- `app/profile/page.tsx`
- `app/components/manage/JourneyFormModal.tsx`

**Actions**:
1. Change `SkillLevel` type from string union to `ExperienceLevel` (1-4)
2. Update all type references:
   - `sailing_experience: ExperienceLevel | null`
   - `min_experience_level: ExperienceLevel | null`
3. Update `Profile` type in `profile/page.tsx`
4. Update `Journey` type in `JourneyFormModal.tsx`

---

### Phase 4: Component Refactoring

#### 4.1 Refactor SkillLevelSelector Component
**File**: `app/components/ui/SkillLevelSelector.tsx`

**Actions**:
1. Import config: `import experienceLevelsConfig from '@/app/config/experience-levels-config.json'`
2. Import type: `import { ExperienceLevel } from '@/app/types/experience-levels'`
3. Replace hardcoded `getSkillLevelInfo` function with config-based lookup
4. Update component to:
   - Iterate over `experienceLevelsConfig.levels` instead of hardcoded cases
   - Use `level.value` for comparisons
   - Use `level.displayName` for labels
   - Use `level.icon` for images
   - Use `level.infoText` for sidebar content
5. Update props:
   - `value: ExperienceLevel | null` (instead of string)
   - `onChange: (value: ExperienceLevel | null) => void`

#### 4.2 Update Profile Page
**File**: `app/profile/page.tsx`

**Actions**:
1. Import `ExperienceLevel` type
2. Update `formData.sailing_experience` type to `ExperienceLevel | null`
3. Update `Profile` type `sailing_experience` to `ExperienceLevel | null`
4. Update load logic: Database returns integer, use directly
5. Update save logic: Save integer directly
6. Update sidebar title matching logic (if needed)

#### 4.3 Update Journey Form Modal
**File**: `app/components/manage/JourneyFormModal.tsx`

**Actions**:
1. Import `ExperienceLevel` type
2. Update `Journey` type `min_experience_level` to `ExperienceLevel | null`
3. Update form state initialization
4. Update load logic: Convert database integer to `ExperienceLevel | null`
5. Update save logic: Save integer directly

---

### Phase 5: Database Query Updates

#### 5.1 Check for Filtering/Query Logic
**Files to check**:
- `app/api/legs/viewport/route.ts` (if experience filtering exists)
- `migrations/create_legs_viewport_query.sql` (RPC functions)
- Any other API routes that filter by experience

**Actions**:
1. Search codebase for any queries filtering by `sailing_experience` or `min_experience_level`
2. Update WHERE clauses to use integer comparisons instead of text
3. If matching logic exists (e.g., "user experience >= journey min requirement"):
   - Update to numeric comparison: `user_experience_level >= journey_min_experience_level`

---

### Phase 6: Testing & Validation

#### 6.1 Data Migration Testing
**Actions**:
1. Test migration on development database
2. Verify all existing text values convert correctly
3. Verify NULL values remain NULL
4. Verify no data loss

#### 6.2 Component Testing
**Actions**:
1. Test Profile page:
   - Load existing profile with experience level
   - Change experience level
   - Save and verify integer stored
2. Test Journey form:
   - Create new journey with min experience level
   - Edit existing journey
   - Verify integer stored correctly
3. Test SkillLevelSelector:
   - All 4 levels display correctly
   - Icons load correctly
   - Sidebar info displays correctly
   - Selection works

#### 6.3 Integration Testing
**Actions**:
1. Test experience level matching (if implemented):
   - User with level 2 should see journeys requiring level 1 or 2
   - User with level 2 should NOT see journeys requiring level 3 or 4
2. Test edge cases:
   - NULL values handled correctly
   - Invalid values rejected

---

### Phase 7: Cleanup

#### 7.1 Remove Old Code
**Actions**:
1. Remove hardcoded level definitions from `SkillLevelSelector.tsx`
2. Remove any unused helper functions
3. Remove old type definitions

#### 7.2 Update Comments
**Actions**:
1. Update code comments referencing experience levels
2. Update README/docs if any

---

## Migration Strategy

### Safe Migration Approach
1. **Add new columns** alongside old ones
2. **Migrate data** from old to new columns
3. **Update application code** to use new columns
4. **Test thoroughly**
5. **Drop old columns** after verification

### Rollback Plan
- Keep old text columns until migration verified
- Can rollback by reverting code to use text columns
- Migration script should be idempotent (can run multiple times safely)

---

## Potential Issues & Considerations

### 1. Data Consistency
- **Issue**: Existing data may have inconsistent text values
- **Solution**: Migration script should handle edge cases, normalize values

### 2. API Compatibility
- **Issue**: If API endpoints expose experience levels, they may need versioning
- **Solution**: API can return both numeric value and display name from config

### 3. Display Name vs Internal Name
- **Issue**: Display names might differ from internal names
- **Solution**: Config includes both `name` (internal) and `displayName` (UI)

### 4. Future Extensibility
- **Consideration**: What if we need to add level 5 or change level 3?
- **Solution**: Config-based approach makes this easy - just update JSON

### 5. Type Safety
- **Consideration**: TypeScript should enforce valid values (1-4)
- **Solution**: Use union type `1 | 2 | 3 | 4` and helper functions

---

## Files to Create/Modify

### New Files
1. `app/config/experience-levels-config.json`
2. `app/types/experience-levels.ts`
3. `migrations/change_experience_level_to_integer.sql`

### Modified Files
1. `app/components/ui/SkillLevelSelector.tsx`
2. `app/profile/page.tsx`
3. `app/components/manage/JourneyFormModal.tsx`
4. `specs/tables.txt`
5. Any API routes that query/filter by experience (if any)

---

## Estimated Effort
- **Phase 1** (Config): 30 min
- **Phase 2** (Database): 1 hour
- **Phase 3** (Types): 30 min
- **Phase 4** (Components): 2 hours
- **Phase 5** (Queries): 1 hour (if needed)
- **Phase 6** (Testing): 1-2 hours
- **Phase 7** (Cleanup): 30 min

**Total**: ~6-7 hours

---

## Questions to Resolve Before Starting

1. **Column naming**: Keep `sailing_experience` or rename to `sailing_experience_level`?
2. **Display names**: Should they match internal names exactly, or can they differ?
3. **Icon paths**: Are they always in `/public` folder, or configurable?
4. **API responses**: Should API return numeric value, display name, or both?
5. **Matching logic**: Is there existing logic that matches user experience to journey requirements? If so, where?
