---
id: doc-011
title: 'BUG FIX: searchMatchingCrew Function - Wrong Table Field Names'
type: other
created_date: '2026-02-22 08:09'
---
# BUG: searchMatchingCrew Function - Wrong Table Field Names

## Issues Found

The function in `app/lib/crew/matching-service.ts` (lines 212-305) is querying for non-existent fields from the `profiles` table.

### Problem Fields

**Line 220 - SELECT statement uses wrong field names**:
```typescript
// WRONG - These fields don't exist in profiles table:
'id, first_name, image_url, experience_level, risk_level, skills, home_port, home_port_lat, home_port_lng, availability'
```

**Actual fields in `profiles` table** (from `/specs/tables.sql` lines 79-106):
```sql
id uuid
full_name text          ✅ NOT first_name
user_description text
certifications text
phone text
created_at timestamp
updated_at timestamp
username text
risk_level risk_level[] ✅ Correct (array type)
sailing_preferences text
skills text[]           ✅ Correct
sailing_experience integer  ✅ NOT experience_level
profile_image_url text  ✅ NOT image_url
roles character varying(50)[]
profile_completion_percentage integer
profile_completed_at timestamp
email text
language varchar(5)
preferred_departure_location jsonb
preferred_arrival_location jsonb
availability_start_date date     ✅ NOT availability
availability_end_date date       ✅ NOT availability
```

### Field Mapping Issues

| Function Uses | Actual Field | Type | Issue |
|---|---|---|---|
| `first_name` | `full_name` | text | ❌ Wrong name |
| `image_url` | `profile_image_url` | text | ❌ Wrong name |
| `experience_level` | `sailing_experience` | integer | ❌ Wrong name |
| `home_port` | `preferred_departure_location` | jsonb | ⚠️ Wrong type (doesn't exist as simple text) |
| `home_port_lat` | ❌ DOESN'T EXIST | - | 🔴 CRITICAL |
| `home_port_lng` | ❌ DOESN'T EXIST | - | 🔴 CRITICAL |
| `availability` | `availability_start_date`, `availability_end_date` | date | ❌ Wrong names (two fields, not one) |

### Where These Wrong Fields Are Used

1. **Line 220** - SELECT statement
   - `first_name` → should be `full_name`
   - `image_url` → should be `profile_image_url`
   - `experience_level` → should be `sailing_experience`
   - `home_port`, `home_port_lat`, `home_port_lng` → MISSING (no location storage in profiles!)
   - `availability` → should be `availability_start_date, availability_end_date`

2. **Lines 224** - Filter by experience_level
   - Uses `experience_level` which doesn't exist
   - Should use `sailing_experience`

3. **Lines 240-244** - Location filtering (CRITICAL)
   - Uses `home_port_lat`, `home_port_lng` which DON'T EXIST
   - Profiles don't store exact coordinates, only preferred locations as JSONB

4. **Lines 102, 104-109, 266-270** - Distance calculations (calculateCrewMatchScore)
   - Uses `home_port_lat`, `home_port_lng` which DON'T EXIST
   - Same issue in normalizeCrewProfile

5. **Lines 195-196** - normalizeCrewProfile
   - Uses `first_name` → should be `full_name`
   - Uses `image_url` → should be `profile_image_url`

6. **Lines 202-204** - normalizeCrewProfile
   - Uses `home_port` → needs extraction from JSONB
   - Uses `home_port_lat`, `home_port_lng` → need extraction from JSONB or REMOVED
   - Uses `availability` → needs to handle two date fields

## Impact

**SEVERITY: 🔴 CRITICAL**

The function **will not work at all** because:
1. Database query will fail (selecting non-existent columns)
2. If it somehow worked, distance filtering is impossible (no coordinates stored)
3. Location-based matching cannot work as-is

## Solution Required

### Option A: Fix Function to Use Actual Fields (Recommended)
- Update all field references to match actual schema
- Remove distance-based filtering (profiles don't have coordinates)
- Extract location from JSONB fields if needed
- Use availability date range

### Option B: Update Database Schema
- Add `home_port_lat` and `home_port_lng` fields to profiles
- Rename fields to match function expectations
- Much larger change, affects migrations and data

**RECOMMENDED: Option A** - Fix the function to use actual schema

---

## Files That Need Changes

1. **`app/lib/crew/matching-service.ts`** - Main fix
   - Lines 220: SELECT statement
   - Lines 224: experience_level filter
   - Lines 240-244: location filtering
   - Lines 102, 104-109: distance calculation in scoring
   - Lines 195-196: normalizeCrewProfile name/image fields
   - Lines 202-204: normalizeCrewProfile location/availability fields

2. **`app/lib/ai/shared/tools/definitions.ts`** - If search_matching_crew tool uses this
   - Check if tool documentation matches actual schema

3. **Any AI prompts** that reference these fields
   - Search for "experience_level", "home_port_lat", "home_port_lng", "image_url"

---

## What Needs to Happen

### Immediate Fix (To Make Function Actually Work):

1. **SELECT statement** - Use correct field names
2. **Experience filter** - Change to `sailing_experience`
3. **Location filtering** - Remove or extract from JSONB
4. **Distance calculations** - Remove or extract from JSONB
5. **Availability filtering** - Use date range fields
6. **Response normalization** - Use correct field names

### Testing Required:

1. Query profiles table and verify fields return
2. Test matching logic with sample crew members
3. Test location/availability filtering
4. Verify match scoring still works

---

## Current Working Status

**Status**: ❌ **BROKEN - Will not execute**

The Supabase query will fail at runtime with error:
```
column "first_name" does not exist
column "image_url" does not exist
column "experience_level" does not exist
column "home_port_lat" does not exist
...
```
