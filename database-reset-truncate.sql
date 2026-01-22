-- ============================================================================
-- FAST DATABASE RESET USING TRUNCATE
-- ============================================================================
-- This is the fastest method but requires careful ordering due to foreign keys
-- TRUNCATE resets sequences automatically and is faster than DELETE
-- ============================================================================

BEGIN;

-- ============================================================================
-- Disable foreign key checks temporarily (PostgreSQL doesn't support this directly)
-- Instead, we'll TRUNCATE in the correct order with CASCADE
-- ============================================================================

-- TRUNCATE with CASCADE will automatically handle dependent tables
-- Order matters: delete most dependent tables first

-- Note: Some tables may not exist if features haven't been implemented yet
-- Wrap in DO block to handle missing tables gracefully
DO $$
BEGIN
    -- Try to truncate each table, ignore if it doesn't exist
    BEGIN
        TRUNCATE TABLE public.registration_answers CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table registration_answers does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.registrations CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table registrations does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.journey_requirements CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table journey_requirements does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.waypoints CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table waypoints does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.legs CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table legs does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.journeys CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table journeys does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.boats CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table boats does not exist, skipping';
    END;
    
    BEGIN
        TRUNCATE TABLE public.profiles CASCADE;
    EXCEPTION WHEN undefined_table THEN
        RAISE NOTICE 'Table profiles does not exist, skipping';
    END;
END $$;
TRUNCATE TABLE public.journeys CASCADE;
TRUNCATE TABLE public.boats CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- ============================================================================
-- Note: To delete auth.users, you'll need to use Supabase Dashboard or API
-- TRUNCATE auth.users CASCADE; -- May not work due to Supabase restrictions
-- ============================================================================

COMMIT;

-- ============================================================================
-- Alternative: If CASCADE doesn't work due to foreign key constraints,
-- use this approach instead (delete in order):
-- ============================================================================
/*
BEGIN;

TRUNCATE TABLE public.registration_answers;
TRUNCATE TABLE public.registrations;
TRUNCATE TABLE public.journey_requirements;
TRUNCATE TABLE public.legs;
TRUNCATE TABLE public.journeys;
TRUNCATE TABLE public.boats;
TRUNCATE TABLE public.profiles;

COMMIT;
*/
