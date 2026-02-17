-- Fix notifications table foreign key constraint
-- Issue: notifications.user_id was referencing public.profiles(id) instead of auth.users(id)
-- This causes data integrity issues when profiles are deleted through auth.users cascade
--
-- Solution: Drop old FK and create new FK to auth.users(id)

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.notifications
DROP CONSTRAINT notifications_user_id_fkey;

-- Step 2: Add new foreign key constraint to auth.users
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
