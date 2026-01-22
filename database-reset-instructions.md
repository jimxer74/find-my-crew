# Database Reset Instructions

## Overview

These SQL scripts are designed to completely empty your database before implementing the profile refactoring plan. Use them only in **development/testing environments**.

## Available Scripts

### 1. `database-reset.sql` - Standard DELETE approach
- Uses DELETE statements in correct order
- Safe and can be rolled back
- Slower but more controlled
- **Recommended for most cases**

### 2. `database-reset-safe.sql` - Transaction-wrapped DELETE
- Same as above but wrapped in a transaction
- Can rollback if something goes wrong
- Includes verification queries
- **Recommended if you want extra safety**

### 3. `database-reset-complete.sql` - Includes auth users
- Deletes application data AND auth users
- Attempts to delete from `auth.users` table
- **Warning**: May not work if you don't have direct database access
- **Use Supabase Dashboard for auth users if this fails**

### 4. `database-reset-truncate.sql` - Fast TRUNCATE approach
- Uses TRUNCATE which is faster than DELETE
- Automatically resets sequences
- Uses CASCADE to handle dependencies
- **Fastest option but less control**

## Tables That Will Be Emptied

Based on the codebase analysis, these tables will be cleared:

1. `public.registration_answers` - Answers to journey requirements (if automated approval implemented)
2. `public.registrations` - Crew registrations for legs
3. `public.journey_requirements` - Custom requirements for journeys (if automated approval implemented)
4. `public.waypoints` - Waypoints for journey legs (PostGIS geometry)
5. `public.legs` - Journey legs
6. `public.journeys` - Sailing journeys
7. `public.boats` - Boat information
8. `public.profiles` - User profiles

**Note**: Some tables (`registration_answers`, `journey_requirements`) may not exist if automated approval features haven't been implemented yet. The scripts handle this gracefully.

## Important Notes

### Auth Users (Supabase)

**Deleting auth users requires special handling:**

1. **Via Supabase Dashboard** (Recommended):
   - Go to Authentication → Users
   - Select all users → Delete

2. **Via Supabase Management API**:
   ```bash
   # Use Supabase CLI or API
   supabase db reset
   ```

3. **Via SQL** (if you have direct access):
   ```sql
   DELETE FROM auth.users;
   ```

### Row Level Security (RLS)

If RLS policies prevent deletion, you may need to:

1. Temporarily disable RLS:
   ```sql
   ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
   -- Run deletion scripts
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
   ```

2. Or use a service role key (bypasses RLS)

### Foreign Key Constraints

The scripts handle foreign key constraints by deleting in the correct order:
1. Most dependent tables first (registration_answers, registrations)
2. Then journey_requirements, legs
3. Then journeys, boats
4. Finally profiles

## Usage Instructions

### Option 1: Using Supabase SQL Editor

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the script you want to use
4. Review the script carefully
5. Click "Run"

### Option 2: Using psql Command Line

```bash
psql -h your-db-host -U postgres -d postgres -f database-reset-safe.sql
```

### Option 3: Using Supabase CLI

```bash
supabase db reset
# This resets the entire database including migrations
```

## Verification

After running the reset script, verify tables are empty:

```sql
SELECT 
    'profiles' as table_name, COUNT(*) as row_count FROM public.profiles
UNION ALL
SELECT 'boats', COUNT(*) FROM public.boats
UNION ALL
SELECT 'journeys', COUNT(*) FROM public.journeys
UNION ALL
SELECT 'legs', COUNT(*) FROM public.legs
UNION ALL
SELECT 'registrations', COUNT(*) FROM public.registrations
UNION ALL
SELECT 'registration_answers', COUNT(*) FROM public.registration_answers
UNION ALL
SELECT 'journey_requirements', COUNT(*) FROM public.journey_requirements
UNION ALL
SELECT 'waypoints', COUNT(*) FROM public.waypoints
UNION ALL
SELECT 'leg_waypoints', COUNT(*) FROM public.leg_waypoints;
```

All counts should be 0.

## After Reset

Once the database is reset, you can:

1. Run the profile refactoring migration (convert role to roles array)
2. Test the new signup flow without role selection
3. Test optional profile functionality
4. Test limited browsing for non-profile users

## Backup Recommendation

**Before running any reset script, create a backup:**

```sql
-- Export data (if you want to keep a backup)
pg_dump -h your-host -U postgres -d your-database > backup_before_reset.sql
```

Or use Supabase Dashboard → Database → Backups

## Troubleshooting

### Error: "permission denied"
- You may need to use a service role key or admin account
- Check RLS policies

### Error: "foreign key constraint violation"
- Make sure you're deleting in the correct order
- Use the CASCADE option if using TRUNCATE

### Auth users not deleted
- Use Supabase Dashboard → Authentication → Users
- Or use Supabase Management API
- Direct SQL deletion may be restricted
