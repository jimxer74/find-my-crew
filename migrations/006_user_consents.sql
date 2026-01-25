-- Migration: 006_user_consents.sql
-- Description: Add GDPR consent management tables
-- Created: 2026-01-25

-- ============================================================================
-- TABLE: user_consents
-- ============================================================================
-- Stores user consent preferences for GDPR compliance

create table if not exists public.user_consents (
  user_id                       uuid primary key references public.profiles(id) on delete cascade,

  -- Legal consents (required during signup)
  privacy_policy_accepted_at    timestamptz,  -- When user accepted privacy policy
  terms_accepted_at             timestamptz,  -- When user accepted terms of service

  -- Optional consents
  ai_processing_consent         boolean default false,  -- Consent for AI-based matching
  ai_processing_consent_at      timestamptz,  -- When consent was granted/revoked

  profile_sharing_consent       boolean default false,  -- Consent for profile visibility to boat owners
  profile_sharing_consent_at    timestamptz,  -- When consent was granted/revoked

  marketing_consent             boolean default false,  -- Consent for marketing emails
  marketing_consent_at          timestamptz,  -- When consent was granted/revoked

  -- Cookie preferences
  cookie_preferences            jsonb default '{"essential": true, "analytics": false, "marketing": false}'::jsonb,
  cookie_preferences_at         timestamptz,  -- When cookie preferences were last updated

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- Indexes
create index if not exists idx_user_consents_ai_processing on public.user_consents(ai_processing_consent) where ai_processing_consent = true;
create index if not exists idx_user_consents_profile_sharing on public.user_consents(profile_sharing_consent) where profile_sharing_consent = true;
create index if not exists idx_user_consents_marketing on public.user_consents(marketing_consent) where marketing_consent = true;

-- Enable Row Level Security
alter table user_consents enable row level security;

-- Policies
create policy "Users can view own consents"
on user_consents for select
using (auth.uid() = user_id);

create policy "Users can insert own consents"
on user_consents for insert
with check (auth.uid() = user_id);

create policy "Users can update own consents"
on user_consents for update
using (auth.uid() = user_id);

-- Trigger for updated_at
create or replace function update_user_consents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_user_consents_updated_at
  before update on public.user_consents
  for each row
  execute function update_user_consents_updated_at();


-- ============================================================================
-- TABLE: consent_audit_log
-- ============================================================================
-- Audit trail for consent changes (GDPR requirement)

create table if not exists public.consent_audit_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  consent_type    varchar(50) not null,  -- 'privacy_policy', 'terms', 'ai_processing', 'profile_sharing', 'marketing', 'cookies'
  action          varchar(20) not null,  -- 'granted', 'revoked', 'updated'
  old_value       jsonb,  -- Previous consent state
  new_value       jsonb,  -- New consent state
  ip_address      inet,   -- IP address when consent was changed
  user_agent      text,   -- Browser user agent
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists idx_consent_audit_user_id on public.consent_audit_log(user_id);
create index if not exists idx_consent_audit_created_at on public.consent_audit_log(created_at desc);
create index if not exists idx_consent_audit_user_created on public.consent_audit_log(user_id, created_at desc);

-- Enable Row Level Security
alter table consent_audit_log enable row level security;

-- Policies (users can only view their own audit log)
create policy "Users can view own consent audit log"
on consent_audit_log for select
using (auth.uid() = user_id);

-- Insert policy: users can insert their own audit logs
create policy "Users can insert own consent audit log"
on consent_audit_log for insert
with check (auth.uid() = user_id);

-- No update or delete policies - audit logs are immutable


-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.user_consents is 'GDPR consent preferences for each user';
comment on column public.user_consents.privacy_policy_accepted_at is 'Timestamp when user accepted the privacy policy (required)';
comment on column public.user_consents.terms_accepted_at is 'Timestamp when user accepted terms of service (required)';
comment on column public.user_consents.ai_processing_consent is 'Whether user consents to AI-based matching of their profile';
comment on column public.user_consents.profile_sharing_consent is 'Whether user consents to their profile being visible to boat owners';
comment on column public.user_consents.marketing_consent is 'Whether user consents to receiving marketing emails';
comment on column public.user_consents.cookie_preferences is 'JSON object with cookie consent categories: essential (always true), analytics, marketing';

comment on table public.consent_audit_log is 'Immutable audit trail of all consent changes for GDPR compliance';
comment on column public.consent_audit_log.consent_type is 'Type of consent: privacy_policy, terms, ai_processing, profile_sharing, marketing, cookies';
comment on column public.consent_audit_log.action is 'Action taken: granted, revoked, updated';
