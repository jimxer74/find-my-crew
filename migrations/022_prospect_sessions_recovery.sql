-- Migration: Create session recovery functions for prospect_sessions
-- Purpose: Enable email-based session recovery and session merging
-- Date: 2026-02-10

-- Function to find sessions by email (for returning users who lost their cookie)
-- Returns most recent active session for the email
CREATE OR REPLACE FUNCTION public.find_prospect_session_by_email(
  p_email TEXT
)
RETURNS TABLE (
  session_id UUID,
  conversation JSONB,
  gathered_preferences JSONB,
  viewed_legs TEXT[],
  created_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.session_id,
    ps.conversation,
    ps.gathered_preferences,
    ps.viewed_legs,
    ps.created_at,
    ps.last_active_at
  FROM public.prospect_sessions ps
  WHERE ps.email = LOWER(TRIM(p_email))
    AND ps.user_id IS NULL  -- Only unauthenticated sessions
    AND ps.expires_at > NOW()  -- Not expired
  ORDER BY ps.last_active_at DESC
  LIMIT 1;  -- Return most recent session
END;
$$;

-- Function to merge multiple sessions (if user had multiple sessions before signup)
CREATE OR REPLACE FUNCTION public.merge_prospect_sessions(
  p_target_session_id UUID,
  p_source_session_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_session RECORD;
  merged_conversation JSONB;
  merged_preferences JSONB;
  merged_viewed_legs TEXT[];
BEGIN
  -- Get target session
  SELECT conversation, gathered_preferences, viewed_legs
  INTO merged_conversation, merged_preferences, merged_viewed_legs
  FROM public.prospect_sessions
  WHERE session_id = p_target_session_id;
  
  IF merged_conversation IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Merge each source session into target
  FOR source_session IN 
    SELECT conversation, gathered_preferences, viewed_legs
    FROM public.prospect_sessions
    WHERE session_id = ANY(p_source_session_ids)
      AND session_id != p_target_session_id
  LOOP
    -- Merge conversations (append messages, keeping chronological order)
    merged_conversation := merged_conversation || source_session.conversation;
    
    -- Merge preferences (target takes precedence, but fill in missing fields)
    merged_preferences := merged_preferences || COALESCE(source_session.gathered_preferences, '{}'::jsonb);
    
    -- Merge viewed legs (union, no duplicates)
    merged_viewed_legs := (
      SELECT ARRAY_AGG(DISTINCT leg_id)
      FROM (
        SELECT UNNEST(merged_viewed_legs) AS leg_id
        UNION
        SELECT UNNEST(source_session.viewed_legs) AS leg_id
      ) AS combined_legs
    );
  END LOOP;
  
  -- Update target session with merged data
  UPDATE public.prospect_sessions
  SET 
    conversation = merged_conversation,
    gathered_preferences = merged_preferences,
    viewed_legs = merged_viewed_legs,
    last_active_at = NOW()
  WHERE session_id = p_target_session_id;
  
  -- Delete source sessions (they've been merged)
  DELETE FROM public.prospect_sessions
  WHERE session_id = ANY(p_source_session_ids)
    AND session_id != p_target_session_id;
  
  RETURN TRUE;
END;
$$;

-- Add comments
COMMENT ON FUNCTION public.find_prospect_session_by_email IS 'Finds the most recent unauthenticated session by email. Used for session recovery when user loses cookie.';
COMMENT ON FUNCTION public.merge_prospect_sessions IS 'Merges multiple prospect sessions into one. Used when user has sessions on multiple devices/browsers.';
