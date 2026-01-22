-- ============================================================================
-- COMPLETE DATABASE RESET (including auth users)
-- ============================================================================
-- WARNING: This will delete EVERYTHING including authentication users!
-- Only use in development/testing environments!
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Delete application data
-- ============================================================================

DELETE FROM public.registration_answers;
DELETE FROM public.registrations;
DELETE FROM public.journey_requirements;
DELETE FROM public.waypoints;
DELETE FROM public.leg_waypoints;
DELETE FROM public.legs;
DELETE FROM public.journeys;
DELETE FROM public.boats;
DELETE FROM public.profiles;

-- ============================================================================
-- STEP 2: Delete Auth Users (Supabase)
-- ============================================================================
-- WARNING: This deletes all authentication users!
-- 
-- Note: In Supabase, you may need to:
-- 1. Use Supabase Dashboard → Authentication → Users → Delete
-- 2. Or use Supabase Management API
-- 3. Or if you have direct database access with proper permissions:
DELETE FROM auth.users;

-- ============================================================================
-- STEP 3: Clean up auth-related tables (if accessible)
-- ============================================================================
-- These tables are managed by Supabase Auth, but if you have access:
-- DELETE FROM auth.sessions;
-- DELETE FROM auth.refresh_tokens;
-- DELETE FROM auth.audit_log_entries;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
    profile_count INTEGER;
    boat_count INTEGER;
    journey_count INTEGER;
    leg_count INTEGER;
    registration_count INTEGER;
    auth_user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    SELECT COUNT(*) INTO boat_count FROM public.boats;
    SELECT COUNT(*) INTO journey_count FROM public.journeys;
    SELECT COUNT(*) INTO leg_count FROM public.legs;
    SELECT COUNT(*) INTO registration_count FROM public.registrations;
    
    BEGIN
        SELECT COUNT(*) INTO auth_user_count FROM auth.users;
    EXCEPTION
        WHEN OTHERS THEN
            auth_user_count := -1; -- Cannot access auth.users
    END;
    
    RAISE NOTICE '=== Database Reset Complete ===';
    RAISE NOTICE 'Profiles: %', profile_count;
    RAISE NOTICE 'Boats: %', boat_count;
    RAISE NOTICE 'Journeys: %', journey_count;
    RAISE NOTICE 'Legs: %', leg_count;
    RAISE NOTICE 'Registrations: %', registration_count;
    IF auth_user_count >= 0 THEN
        RAISE NOTICE 'Auth Users: %', auth_user_count;
    ELSE
        RAISE NOTICE 'Auth Users: Cannot access (may require Supabase Dashboard)';
    END IF;
END $$;

COMMIT;
