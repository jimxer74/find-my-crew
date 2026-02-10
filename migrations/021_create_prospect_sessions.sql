-- Migration: Create prospect_sessions table
-- Purpose: Store prospect chat sessions server-side instead of localStorage
-- Date: 2026-02-10

-- Create prospect_sessions table
CREATE TABLE IF NOT EXISTS public.prospect_sessions (
  session_id UUID PRIMARY KEY,
  -- CRITICAL: user_id is NULL for unauthenticated users (before signup)
  -- After signup, this gets linked to auth.users(id)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULLABLE for unauthenticated users
  -- Optional: email for linking sessions before signup (if user shares email)
  -- This helps link sessions when user signs up with same email
  email TEXT,
  conversation JSONB NOT NULL DEFAULT '[]'::jsonb,
  gathered_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  viewed_legs TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_user_id 
  ON public.prospect_sessions(user_id) 
  WHERE user_id IS NOT NULL;

-- Index for email-based session linking (before signup)
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_email 
  ON public.prospect_sessions(email) 
  WHERE email IS NOT NULL AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_sessions_expires 
  ON public.prospect_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_prospect_sessions_last_active 
  ON public.prospect_sessions(last_active_at);

-- Enable Row Level Security
ALTER TABLE public.prospect_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- CRITICAL: Allow unauthenticated access to sessions with user_id = NULL
-- This enables prospect users to access their sessions before signup
-- Security: API routes MUST validate session_id from cookie matches requested session
CREATE POLICY "Unauthenticated users can access their sessions"
  ON public.prospect_sessions
  FOR ALL
  USING (user_id IS NULL);

-- Authenticated users can access their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.prospect_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.prospect_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.prospect_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all sessions (for cleanup jobs and session linking)
CREATE POLICY "Service role can manage all sessions"
  ON public.prospect_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment explaining the table
COMMENT ON TABLE public.prospect_sessions IS 'Stores prospect chat sessions server-side. Sessions start with user_id = NULL (unauthenticated) and get linked to user_id after signup.';
