-- Migration: Create session linking functions for prospect_sessions
-- Purpose: Link prospect sessions to authenticated users after signup
-- Date: 2026-02-10

-- Function to link a prospect session to a user after signup
-- This is called when a user signs up and we need to link their existing session
CREATE OR REPLACE FUNCTION public.link_prospect_session_to_user(
  p_session_id UUID,
  p_user_id UUID,
  p_user_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_exists BOOLEAN;
BEGIN
  -- Check if session exists
  SELECT EXISTS(SELECT 1 FROM public.prospect_sessions WHERE session_id = p_session_id)
  INTO session_exists;
  
  IF NOT session_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Link session to user
  UPDATE public.prospect_sessions
  SET 
    user_id = p_user_id,
    email = COALESCE(p_user_email, email), -- Update email if provided
    last_active_at = NOW()
  WHERE session_id = p_session_id;
  
  RETURN TRUE;
END;
$$;

-- Function to find and link sessions by email (for users who shared email before signup)
CREATE OR REPLACE FUNCTION public.link_prospect_sessions_by_email(
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  linked_count INTEGER;
BEGIN
  -- Link all unauthenticated sessions with matching email to the new user
  UPDATE public.prospect_sessions
  SET 
    user_id = p_user_id,
    email = p_user_email,
    last_active_at = NOW()
  WHERE email = LOWER(TRIM(p_user_email))
    AND user_id IS NULL;
  
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.link_prospect_session_to_user IS 'Links a single prospect session to an authenticated user after signup.';
COMMENT ON FUNCTION public.link_prospect_sessions_by_email IS 'Links all prospect sessions with matching email to an authenticated user. Used when user shared email before signup.';
