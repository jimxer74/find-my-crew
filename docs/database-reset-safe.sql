-- ============================================================================
-- SAFE DATABASE RESET SCRIPT (with transaction rollback safety)
-- ============================================================================
-- This version uses a transaction so you can rollback if something goes wrong
-- ============================================================================

BEGIN;

-- ============================================================================
-- Delete data from tables in correct order
-- ============================================================================

-- Delete registration-related data first
DELETE FROM public.registration_answers;
DELETE FROM public.registrations;

-- Delete journey requirements
DELETE FROM public.journey_requirements;

-- Delete waypoints (depends on legs)
DELETE FROM public.waypoints;
-- DELETE FROM public.leg_waypoints;

-- Delete legs
DELETE FROM public.legs;

-- Delete journeys
DELETE FROM public.journeys;

-- Delete boats
DELETE FROM public.boats;

-- Delete profiles
DELETE FROM public.profiles;

-- Delete consets
DELETE FROM public.email_preferences;

-- Delete profiles
DELETE FROM public.user_consents;

-- Delete profiles
DELETE FROM public.consent_audit_log;

-- ============================================================================
-- Verify deletion (optional)
-- ============================================================================
DO $$
DECLARE
    profile_count INTEGER;
    boat_count INTEGER;
    journey_count INTEGER;
    leg_count INTEGER;
    registration_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    SELECT COUNT(*) INTO boat_count FROM public.boats;
    SELECT COUNT(*) INTO journey_count FROM public.journeys;
    SELECT COUNT(*) INTO leg_count FROM public.legs;
    SELECT COUNT(*) INTO registration_count FROM public.registrations;
    
    RAISE NOTICE 'Deletion complete. Remaining rows:';
    RAISE NOTICE 'Profiles: %', profile_count;
    RAISE NOTICE 'Boats: %', boat_count;
    RAISE NOTICE 'Journeys: %', journey_count;
    RAISE NOTICE 'Legs: %', leg_count;
    RAISE NOTICE 'Registrations: %', registration_count;
    BEGIN
        RAISE NOTICE 'Registration Answers: %', (SELECT COUNT(*) FROM public.registration_answers);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Registration Answers: Table does not exist';
    END;
    
    BEGIN
        RAISE NOTICE 'Journey Requirements: %', (SELECT COUNT(*) FROM public.journey_requirements);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Journey Requirements: Table does not exist';
    END;
    
    BEGIN
        RAISE NOTICE 'Waypoints: %', (SELECT COUNT(*) FROM public.waypoints);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Waypoints: Table does not exist';
    END;
END $$;

-- ============================================================================
-- COMMIT the transaction
-- If something went wrong, you can ROLLBACK instead
-- ============================================================================
COMMIT;

-- To rollback instead, use: ROLLBACK;
