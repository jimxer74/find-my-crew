-- Add 'redirected' status to ai_pending_actions status constraint
-- This enables the AI assistant profile update redirection workflow

-- Drop the existing constraint
ALTER TABLE public.ai_pending_actions DROP CONSTRAINT ai_pending_actions_status_check;

-- Add the updated constraint with 'redirected' status included
ALTER TABLE public.ai_pending_actions
ADD CONSTRAINT ai_pending_actions_status_check
CHECK (status in ('pending', 'approved', 'rejected', 'expired', 'redirected'));

-- Update the table schema in specs
-- The specs/tables.sql file should be updated to include 'redirected' in the status check constraint

COMMENT ON CONSTRAINT ai_pending_actions_status_check ON public.ai_pending_actions IS
'Valid status values for AI pending actions: pending (awaiting user decision), approved (action completed successfully), rejected (user declined), expired (action timed out), redirected (user redirected to profile page for input)';