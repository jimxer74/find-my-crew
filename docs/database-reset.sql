-- ============================================================================
-- DATABASE RESET SCRIPT FOR TESTING
-- ============================================================================
-- WARNING: This script will DELETE ALL DATA from the application tables
-- Use only in development/testing environments!
-- 
-- This script is designed to completely empty the database before implementing
-- the profile refactoring plan (converting role to roles array, etc.)
-- ============================================================================

-- ============================================================================
-- STEP 1: Disable Row Level Security (RLS) temporarily for cleanup
-- ============================================================================
-- Note: You may need to disable RLS policies to delete data
-- Re-enable RLS after reset if needed

-- ============================================================================
-- STEP 2: Delete data from tables in correct order (respecting foreign keys)
-- ============================================================================
-- Delete in reverse dependency order to avoid foreign key violations

-- Delete registration-related data first (most dependent)
-- Note: These tables may not exist if automated approval hasn't been implemented yet
DELETE FROM public.registration_answers;
DELETE FROM public.registrations;

-- Delete journey requirements (depends on journeys)
-- Note: This table may not exist if automated approval hasn't been implemented yet
DELETE FROM public.journey_requirements;

-- Delete waypoints (depends on legs)
-- Note: Waypoints may be stored in a 'waypoints' table or 'leg_waypoints' table
DELETE FROM public.waypoints;
DELETE FROM public.leg_waypoints;

-- Delete legs (depends on journeys)
DELETE FROM public.legs;

-- Delete journeys (depends on boats)
DELETE FROM public.journeys;

-- Delete boats (depends on profiles/auth.users)
DELETE FROM public.boats;

-- Delete profiles (depends on auth.users)
DELETE FROM public.profiles;

-- ============================================================================
-- STEP 3: Optional - Delete Auth Users (Supabase Auth)
-- ============================================================================
-- WARNING: This will delete ALL authentication users!
-- Only use if you want to completely reset authentication
-- 
-- In Supabase, you typically need to use the Supabase Dashboard or API
-- to delete auth users. However, if you have direct database access:
--
-- DELETE FROM auth.users;
--
-- Alternatively, use Supabase Management API or Dashboard to delete users
-- ============================================================================

-- ============================================================================
-- STEP 4: Reset sequences (if any auto-increment columns exist)
-- ============================================================================
-- Note: Most tables use UUIDs (gen_random_uuid()), so sequences may not be needed
-- If you have any SERIAL or BIGSERIAL columns, reset them here:
-- ALTER SEQUENCE table_name_id_seq RESTART WITH 1;

-- ============================================================================
-- STEP 5: Verify tables are empty (optional check)
-- ============================================================================
-- Run these queries to verify:
-- SELECT COUNT(*) FROM public.profiles;
-- SELECT COUNT(*) FROM public.boats;
-- SELECT COUNT(*) FROM public.journeys;
-- SELECT COUNT(*) FROM public.legs;
-- SELECT COUNT(*) FROM public.registrations;
-- SELECT COUNT(*) FROM public.registration_answers;
-- SELECT COUNT(*) FROM public.journey_requirements;

-- ============================================================================
-- ALTERNATIVE: CASCADE DELETE approach (faster but less control)
-- ============================================================================
-- If you want to delete everything quickly using CASCADE:
-- 
-- TRUNCATE TABLE public.registration_answers CASCADE;
-- TRUNCATE TABLE public.registrations CASCADE;
-- TRUNCATE TABLE public.journey_requirements CASCADE;
-- TRUNCATE TABLE public.legs CASCADE;
-- TRUNCATE TABLE public.journeys CASCADE;
-- TRUNCATE TABLE public.boats CASCADE;
-- TRUNCATE TABLE public.profiles CASCADE;
--
-- Note: TRUNCATE is faster than DELETE but:
-- - Cannot be rolled back in some transaction modes
-- - Resets sequences automatically
-- - Requires table ownership or TRUNCATE privilege
-- ============================================================================
