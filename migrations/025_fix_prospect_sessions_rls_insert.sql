-- Migration: Fix RLS policies for prospect_sessions INSERT operations
-- Purpose: Add INSERT policy for unauthenticated users
-- Date: 2026-02-10
-- Issue: The existing "Unauthenticated users can access their sessions" policy
--        only has USING clause, which doesn't cover INSERT operations.
--        INSERT requires WITH CHECK clause.

-- Drop the existing policy that doesn't properly handle INSERT
DROP POLICY IF EXISTS "Unauthenticated users can access their sessions" ON public.prospect_sessions;

-- Create separate policies for different operations

-- SELECT: Unauthenticated users can view sessions with user_id = NULL
CREATE POLICY "Unauthenticated users can view their sessions"
  ON public.prospect_sessions
  FOR SELECT
  USING (user_id IS NULL);

-- INSERT: Unauthenticated users can create sessions with user_id = NULL
CREATE POLICY "Unauthenticated users can create sessions"
  ON public.prospect_sessions
  FOR INSERT
  WITH CHECK (user_id IS NULL);

-- UPDATE: Unauthenticated users can update sessions with user_id = NULL
CREATE POLICY "Unauthenticated users can update their sessions"
  ON public.prospect_sessions
  FOR UPDATE
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- DELETE: Unauthenticated users can delete sessions with user_id = NULL
CREATE POLICY "Unauthenticated users can delete their sessions"
  ON public.prospect_sessions
  FOR DELETE
  USING (user_id IS NULL);
