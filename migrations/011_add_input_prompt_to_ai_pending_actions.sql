-- Add input_prompt, input_options, and input_type columns to ai_pending_actions table for input collection functionality

ALTER TABLE public.ai_pending_actions
ADD COLUMN IF NOT EXISTS input_prompt text;

ALTER TABLE public.ai_pending_actions
ADD COLUMN IF NOT EXISTS input_options text[];

ALTER TABLE public.ai_pending_actions
ADD COLUMN IF NOT EXISTS input_type text check (input_type in ('text', 'text_array', 'select'));

-- Add index for better query performance when filtering actions that need input
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_input_prompt
ON public.ai_pending_actions(action_type, input_prompt)
WHERE input_prompt IS NOT NULL;

-- Add comment to document the new columns
COMMENT ON COLUMN public.ai_pending_actions.input_prompt IS
'Prompt to show user when collecting input (e.g., "Please provide your sailing experience level"). Used for actions that require user input before approval.';

COMMENT ON COLUMN public.ai_pending_actions.input_options IS
'Options for multi-select or select input types (e.g., skill options, risk levels). Used when input_type is "text_array" or "select".';

COMMENT ON COLUMN public.ai_pending_actions.input_type IS
'Type of input required: "text" for single text input, "text_array" for multi-select, "select" for single select. Defines how the input should be collected from the user.';