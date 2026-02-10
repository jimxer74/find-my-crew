-- Migration: Create cleanup function for prospect_sessions
-- Purpose: Clean up expired prospect sessions
-- Date: 2026-02-10

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_prospect_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.prospect_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.cleanup_expired_prospect_sessions IS 'Deletes expired prospect sessions. Should be run periodically (e.g., daily via cron job).';

-- Optional: Create scheduled job (if using pg_cron extension)
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('cleanup-prospect-sessions', '0 2 * * *', 
--   'SELECT public.cleanup_expired_prospect_sessions()');
