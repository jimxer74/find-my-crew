-- ============================================================================
-- Phase 1: Database Schema Extensions for Automated Approval Flow
-- ============================================================================
-- This migration adds support for:
-- 1. Custom journey requirements/questions
-- 2. Registration answers to requirements
-- 3. Auto-approval configuration on journeys
-- 4. AI assessment fields on registrations
-- ============================================================================

-- ============================================================================
-- STEP 1.1: Create journey_requirements table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.journey_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('text', 'multiple_choice', 'yes_no', 'rating')),
    options JSONB, -- For multiple_choice questions, stores available options
    is_required BOOLEAN NOT NULL DEFAULT true,
    weight INTEGER NOT NULL DEFAULT 5 CHECK (weight >= 1 AND weight <= 10),
    "order" INTEGER NOT NULL DEFAULT 0, -- Display order for questions
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for journey_requirements
CREATE INDEX IF NOT EXISTS journey_requirements_journey_id_idx 
ON public.journey_requirements(journey_id);

CREATE INDEX IF NOT EXISTS journey_requirements_journey_order_idx 
ON public.journey_requirements(journey_id, "order");

-- Comments
COMMENT ON TABLE public.journey_requirements IS 'Stores custom questions/requirements for journeys that crew members must answer during registration';
COMMENT ON COLUMN public.journey_requirements.question_text IS 'The question to ask crew members';
COMMENT ON COLUMN public.journey_requirements.question_type IS 'Type of question: text, multiple_choice, yes_no, or rating';
COMMENT ON COLUMN public.journey_requirements.options IS 'For multiple_choice questions, stores available options as JSON array';
COMMENT ON COLUMN public.journey_requirements.is_required IS 'Whether the answer is mandatory';
COMMENT ON COLUMN public.journey_requirements.weight IS 'Importance weight for AI matching (1=low, 10=critical)';
COMMENT ON COLUMN public.journey_requirements."order" IS 'Display order for questions';

-- ============================================================================
-- STEP 1.2: Create registration_answers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.registration_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES public.journey_requirements(id) ON DELETE CASCADE,
    answer_text TEXT, -- For text/yes_no answers
    answer_json JSONB, -- For multiple_choice/rating answers
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure one answer per requirement per registration
    UNIQUE(registration_id, requirement_id)
);

-- Indexes for registration_answers
CREATE INDEX IF NOT EXISTS registration_answers_registration_id_idx 
ON public.registration_answers(registration_id);

CREATE INDEX IF NOT EXISTS registration_answers_requirement_id_idx 
ON public.registration_answers(requirement_id);

-- Comments
COMMENT ON TABLE public.registration_answers IS 'Stores crew member answers to journey requirements';
COMMENT ON COLUMN public.registration_answers.answer_text IS 'For text/yes_no answers';
COMMENT ON COLUMN public.registration_answers.answer_json IS 'For multiple_choice/rating answers';

-- ============================================================================
-- STEP 1.3: Add auto-approval fields to journeys table
-- ============================================================================

ALTER TABLE public.journeys 
ADD COLUMN IF NOT EXISTS auto_approval_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.journeys 
ADD COLUMN IF NOT EXISTS auto_approval_threshold INTEGER NOT NULL DEFAULT 80 
CHECK (auto_approval_threshold >= 0 AND auto_approval_threshold <= 100);

-- Index for filtering journeys with auto-approval enabled
CREATE INDEX IF NOT EXISTS journeys_auto_approval_enabled_idx 
ON public.journeys(auto_approval_enabled) 
WHERE auto_approval_enabled = true;

-- Comments
COMMENT ON COLUMN public.journeys.auto_approval_enabled IS 'Whether automated approval is enabled for this journey';
COMMENT ON COLUMN public.journeys.auto_approval_threshold IS 'Minimum AI match score (0-100) required for auto-approval';

-- ============================================================================
-- STEP 1.4: Add AI assessment fields to registrations table
-- ============================================================================

ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS ai_match_score INTEGER 
CHECK (ai_match_score IS NULL OR (ai_match_score >= 0 AND ai_match_score <= 100));

ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS ai_match_reasoning TEXT;

ALTER TABLE public.registrations 
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN NOT NULL DEFAULT false;

-- Indexes for AI assessment fields
CREATE INDEX IF NOT EXISTS registrations_ai_match_score_idx 
ON public.registrations(ai_match_score) 
WHERE ai_match_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS registrations_auto_approved_idx 
ON public.registrations(auto_approved) 
WHERE auto_approved = true;

-- Comments
COMMENT ON COLUMN public.registrations.ai_match_score IS 'AI-calculated match score (0-100)';
COMMENT ON COLUMN public.registrations.ai_match_reasoning IS 'AI explanation of the match score';
COMMENT ON COLUMN public.registrations.auto_approved IS 'True if this registration was auto-approved by AI';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on journey_requirements
ALTER TABLE public.journey_requirements ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view requirements for published journeys
CREATE POLICY "Anyone can view requirements for published journeys"
ON public.journey_requirements FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.journeys j
        WHERE j.id = journey_requirements.journey_id
        AND j.state = 'Published'
    )
    OR
    -- Journey owners can view requirements for their journeys
    EXISTS (
        SELECT 1 FROM public.journeys j
        INNER JOIN public.boats b ON b.id = j.boat_id
        WHERE j.id = journey_requirements.journey_id
        AND b.owner_id = auth.uid()
    )
);

-- Policy: Journey owners can manage requirements for their journeys
CREATE POLICY "Owners can manage requirements for their journeys"
ON public.journey_requirements FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.journeys j
        INNER JOIN public.boats b ON b.id = j.boat_id
        WHERE j.id = journey_requirements.journey_id
        AND b.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.journeys j
        INNER JOIN public.boats b ON b.id = j.boat_id
        WHERE j.id = journey_requirements.journey_id
        AND b.owner_id = auth.uid()
    )
);

-- Enable RLS on registration_answers
ALTER TABLE public.registration_answers ENABLE ROW LEVEL SECURITY;

-- Policy: Crew members can view their own answers
CREATE POLICY "Crew can view own answers"
ON public.registration_answers FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.registrations r
        WHERE r.id = registration_answers.registration_id
        AND r.user_id = auth.uid()
    )
);

-- Policy: Journey owners can view answers for registrations to their journeys
CREATE POLICY "Owners can view answers for their journeys"
ON public.registration_answers FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.registrations r
        INNER JOIN public.legs l ON l.id = r.leg_id
        INNER JOIN public.journeys j ON j.id = l.journey_id
        INNER JOIN public.boats b ON b.id = j.boat_id
        WHERE r.id = registration_answers.registration_id
        AND b.owner_id = auth.uid()
    )
);

-- Policy: Crew members can create/update answers for their own registrations
CREATE POLICY "Crew can manage answers for own registrations"
ON public.registration_answers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.registrations r
        WHERE r.id = registration_answers.registration_id
        AND r.user_id = auth.uid()
        AND r.status = 'Pending approval' -- Only allow updates while pending
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.registrations r
        WHERE r.id = registration_answers.registration_id
        AND r.user_id = auth.uid()
        AND r.status = 'Pending approval' -- Only allow updates while pending
    )
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for journey_requirements
DROP TRIGGER IF EXISTS update_journey_requirements_updated_at ON public.journey_requirements;
CREATE TRIGGER update_journey_requirements_updated_at
    BEFORE UPDATE ON public.journey_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for registration_answers
DROP TRIGGER IF EXISTS update_registration_answers_updated_at ON public.registration_answers;
CREATE TRIGGER update_registration_answers_updated_at
    BEFORE UPDATE ON public.registration_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VALIDATION FUNCTIONS
-- ============================================================================

-- Function to validate that multiple_choice questions have options
CREATE OR REPLACE FUNCTION validate_requirement_options()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.question_type = 'multiple_choice' AND (NEW.options IS NULL OR jsonb_array_length(NEW.options) = 0) THEN
        RAISE EXCEPTION 'multiple_choice questions must have options';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate requirement options
DROP TRIGGER IF EXISTS validate_requirement_options_trigger ON public.journey_requirements;
CREATE TRIGGER validate_requirement_options_trigger
    BEFORE INSERT OR UPDATE ON public.journey_requirements
    FOR EACH ROW
    EXECUTE FUNCTION validate_requirement_options();

-- Function to validate that answer format matches question type
CREATE OR REPLACE FUNCTION validate_answer_format()
RETURNS TRIGGER AS $$
DECLARE
    req_type TEXT;
BEGIN
    SELECT question_type INTO req_type
    FROM public.journey_requirements
    WHERE id = NEW.requirement_id;

    -- Validate answer format based on question type
    IF req_type = 'text' THEN
        IF NEW.answer_text IS NULL OR NEW.answer_text = '' THEN
            RAISE EXCEPTION 'text questions require answer_text';
        END IF;
        IF NEW.answer_json IS NOT NULL THEN
            RAISE EXCEPTION 'text questions should not have answer_json';
        END IF;
    ELSIF req_type = 'yes_no' THEN
        IF NEW.answer_text IS NULL OR NEW.answer_text NOT IN ('Yes', 'No') THEN
            RAISE EXCEPTION 'yes_no questions require answer_text to be "Yes" or "No"';
        END IF;
        IF NEW.answer_json IS NOT NULL THEN
            RAISE EXCEPTION 'yes_no questions should not have answer_json';
        END IF;
    ELSIF req_type = 'multiple_choice' THEN
        IF NEW.answer_json IS NULL THEN
            RAISE EXCEPTION 'multiple_choice questions require answer_json';
        END IF;
        IF NOT jsonb_typeof(NEW.answer_json) = 'array' THEN
            RAISE EXCEPTION 'multiple_choice answer_json must be a JSON array';
        END IF;
    ELSIF req_type = 'rating' THEN
        IF NEW.answer_json IS NULL THEN
            RAISE EXCEPTION 'rating questions require answer_json';
        END IF;
        -- Validate it's a number between 1 and 10 (or whatever range we decide)
        IF NOT (jsonb_typeof(NEW.answer_json) = 'number' AND (NEW.answer_json::text::int >= 1 AND NEW.answer_json::text::int <= 10)) THEN
            RAISE EXCEPTION 'rating answer_json must be a number between 1 and 10';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate answer format
DROP TRIGGER IF EXISTS validate_answer_format_trigger ON public.registration_answers;
CREATE TRIGGER validate_answer_format_trigger
    BEFORE INSERT OR UPDATE ON public.registration_answers
    FOR EACH ROW
    EXECUTE FUNCTION validate_answer_format();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
