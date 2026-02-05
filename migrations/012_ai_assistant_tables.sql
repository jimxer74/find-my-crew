-- Migration: AI Assistant Tables
-- Description: Creates tables for AI assistant conversations, messages, pending actions, and suggestions

-- ============================================================================
-- TABLE: ai_conversations
-- ============================================================================
-- Stores conversation threads between users and the AI assistant

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- Auto-generated from first message or user-provided
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON public.ai_conversations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own conversations
CREATE POLICY "Users can view own conversations"
ON ai_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
ON ai_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
ON ai_conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
ON ai_conversations FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_conversations_updated_at();


-- ============================================================================
-- TABLE: ai_messages
-- ============================================================================
-- Stores individual messages within conversations

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Store tool calls, function results, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created ON public.ai_messages(conversation_id, created_at);

-- Enable Row Level Security
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- Policies: Users can access messages in their own conversations
CREATE POLICY "Users can view messages in own conversations"
ON ai_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ai_conversations
    WHERE ai_conversations.id = ai_messages.conversation_id
    AND ai_conversations.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in own conversations"
ON ai_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM ai_conversations
    WHERE ai_conversations.id = ai_messages.conversation_id
    AND ai_conversations.user_id = auth.uid()
  )
);

-- Messages are immutable - no update policy
-- Delete cascades from conversation


-- ============================================================================
-- TABLE: ai_pending_actions
-- ============================================================================
-- Stores action suggestions from AI that await user approval

CREATE TABLE IF NOT EXISTS public.ai_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'register_for_leg', 'update_profile', 'create_journey', 'approve_registration', etc.
  action_payload JSONB NOT NULL, -- Parameters for the action
  explanation TEXT NOT NULL, -- AI's explanation of why this action is suggested
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user_id ON public.ai_pending_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_status ON public.ai_pending_actions(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_conversation ON public.ai_pending_actions(conversation_id);

-- Enable Row Level Security
ALTER TABLE ai_pending_actions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own pending actions
CREATE POLICY "Users can view own pending actions"
ON ai_pending_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pending actions"
ON ai_pending_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending actions"
ON ai_pending_actions FOR UPDATE
USING (auth.uid() = user_id);


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.ai_conversations IS 'AI assistant conversation threads for each user';
COMMENT ON TABLE public.ai_messages IS 'Individual messages within AI assistant conversations';
COMMENT ON TABLE public.ai_pending_actions IS 'Actions suggested by AI awaiting user approval before execution';
COMMENT ON TABLE public.ai_suggestions IS 'Proactive suggestions generated by the system for matching opportunities';

COMMENT ON COLUMN public.ai_messages.metadata IS 'Stores tool calls, function results, and other message metadata as JSON';
COMMENT ON COLUMN public.ai_pending_actions.action_type IS 'Type of action: register_for_leg, update_profile, create_journey, approve_registration, etc.';
COMMENT ON COLUMN public.ai_pending_actions.action_payload IS 'JSON object containing all parameters needed to execute the action';
COMMENT ON COLUMN public.ai_suggestions.suggestion_type IS 'Type of suggestion: matching_leg, matching_crew, profile_improvement, journey_opportunity';
COMMENT ON COLUMN public.ai_suggestions.metadata IS 'JSON object with related entity IDs and match scores';
