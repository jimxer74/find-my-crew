-- Add email column to owner_sessions and prospect_sessions
-- This stores the user's email when available for better session tracking

-- Column already exists in schema, but ensure it's properly set up
alter table public.owner_sessions
  add column if not exists email text;

alter table public.prospect_sessions
  add column if not exists email text;

-- Create index for email-based session queries (for logged-in users)
create index if not exists idx_owner_sessions_email_with_user
  on public.owner_sessions(email)
  where user_id is not null and email is not null;

create index if not exists idx_prospect_sessions_email_with_user
  on public.prospect_sessions(email)
  where user_id is not null and email is not null;

-- Update RLS policies to allow authenticated users to access their sessions by email when linked
-- (These policies already exist, but ensuring they work with email column)

comment on column public.owner_sessions.email is 'User email when available (for linking sessions to user accounts)';
comment on column public.prospect_sessions.email is 'User email when available (for linking sessions to user accounts)';