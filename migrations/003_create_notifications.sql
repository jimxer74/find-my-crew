-- ============================================================================
-- Migration: Create Notifications System
-- ============================================================================
-- This migration creates the notifications table for in-app notifications
-- and an optional email_preferences table for user notification settings
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.notifications IS 'Stores in-app notifications for users';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: registration_approved, registration_denied, new_registration, journey_updated, leg_updated, profile_reminder';
COMMENT ON COLUMN public.notifications.link IS 'Optional URL to navigate to when notification is clicked';
COMMENT ON COLUMN public.notifications.metadata IS 'Additional JSON data related to the notification (e.g., journey_id, registration_id)';

-- ============================================================================
-- STEP 2: Create indexes for efficient queries
-- ============================================================================

-- Index for fetching user's notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- Partial index for fetching unread notifications efficiently
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

-- Index for sorting by creation date
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Composite index for common query pattern (user's notifications ordered by date)
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- ============================================================================
-- STEP 3: Row Level Security
-- ============================================================================
-- NOTE: RLS is DISABLED on notifications table.
-- Notifications are only created/accessed through authenticated API routes
-- which have their own authorization checks. This avoids RLS complexity
-- when server-side code needs to create notifications for other users.

-- If you need RLS in the future, you would need to use a service role client
-- for creating notifications, or implement more complex policies.

-- ============================================================================
-- STEP 4: Create email_preferences table (optional enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_updates BOOLEAN DEFAULT true,
  journey_updates BOOLEAN DEFAULT true,
  profile_reminders BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.email_preferences IS 'User preferences for email notifications';

-- ============================================================================
-- STEP 5: Enable RLS on email_preferences
-- ============================================================================

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own preferences
CREATE POLICY "Users can view own email preferences"
  ON public.email_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update own email preferences"
  ON public.email_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own email preferences"
  ON public.email_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- STEP 6: Create trigger for updated_at on email_preferences
-- ============================================================================

CREATE OR REPLACE FUNCTION update_email_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_email_preferences_updated_at();

-- ============================================================================
-- STEP 7: Create helper function to get unread notification count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count_result
  FROM public.notifications
  WHERE user_id = p_user_id AND read = false;

  RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  -- Verify notifications table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    RAISE NOTICE 'notifications table created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create notifications table';
  END IF;

  -- Verify email_preferences table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_preferences' AND table_schema = 'public') THEN
    RAISE NOTICE 'email_preferences table created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create email_preferences table';
  END IF;

  RAISE NOTICE '=== Migration 003 Complete ===';
END $$;

COMMIT;
