Database tables

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- Enable PostGIS for geospatial support (required for waypoints spatial queries)
-- See: migrations/enable_postgis.sql
create extension if not exists "postgis";


-- ============================================================================
-- ENUM TYPES
-- ============================================================================


-- Registration status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'registration_status') then
    create type registration_status as enum ('Pending approval', 'Approved', 'Not approved', 'Cancelled');
  end if;
end$$;

-- Profile type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_type') then
    create type profile_type as enum ('owner', 'crew');
  end if;
end$$;

-- Risk level enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'risk_level') then
    create type risk_level as enum ('Coastal sailing', 'Offshore sailing', 'Extreme sailing');
  end if;
end$$;

-- Journey state enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'journey_state') then
    create type journey_state as enum ('In planning', 'Published', 'Archived');
  end if;
end$$;

-- Cost model enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cost_model') then
    create type cost_model as enum (
      'Shared contribution',
      'Owner covers all costs',
      'Crew pays a fee',
      'Delivery/paid crew',
      'Not defined'
    );
  end if;
end$$;

-- Sailboat category enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sailboat_category') then
    create type sailboat_category as enum ('Daysailers', 'Coastal cruisers', 'Traditional offshore cruisers', 'Performance cruisers', 'Multihulls', 'Expedition sailboats');
  end if;
end$$;


-- ============================================================================
-- TABLE: profiles
-- ============================================================================

create table public.profiles (
  id uuid not null,
  full_name text null,
  user_description text null,  -- Free-text description of the user
  certifications text null,
  phone text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  username text not null,
  risk_level risk_level[] null default '{}'::risk_level[],
  sailing_preferences text null,
  skills text[] null default '{}'::text[],
  sailing_experience integer null,
  profile_image_url text null,
  roles character varying(50) [] null default (array[]::character varying[])::character varying(50) [],
  profile_completion_percentage integer null default 0,
  profile_completed_at timestamp without time zone null,
  email text null,
  language varchar(5) null default 'en',  -- User preferred language (en, fi)
  constraint profiles_pkey primary key (id),
  constraint profiles_language_check check (language in ('en', 'fi')),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete cascade
);
-- Indexes
create unique index if not exists profiles_user_id_key on public.profiles (id);
create index if not exists idx_profiles_email on public.profiles(email);

-- Trigger to sync email from auth.users
create or replace function public.sync_user_email()
returns trigger as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_email_updated
  after insert or update of email on auth.users
  for each row
  execute function public.sync_user_email();

-- Enable Row Level Security
alter table profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by all"
on profiles for select
using (true);

create policy "Users can insert their own profile"
on profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id);


-- ============================================================================
-- TABLE: boats
-- ============================================================================

-- Table definition
create table if not exists public.boats (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  type        sailboat_category, -- Sailboat category (nullable)
  make_model  text, -- Combined make and model field (e.g., "Bavaria 46")
  capacity    int,
  home_port   text,
  country_flag text, -- ISO 3166-1 alpha-2 country code (e.g., US, GB, FR)
  loa_m       numeric, -- length overall in meters
  lwl_m       numeric, -- length waterline in meters (for sailboat calculations)
  beam_m      numeric, -- Beam in meters
  max_draft_m numeric, -- Maximum draft (deepest point below waterline) in meters
  displcmt_m  numeric, -- Displacement in kg
  ballast_kg  numeric, -- Ballast weight in kg (for sailboats)
  sail_area_sqm numeric, -- Total sail area in square meters (for sailboats)
  average_speed_knots numeric, -- Average cruising speed in knots
  link_to_specs text, -- Link to additional information like sailboatdata.com
  images      text[] default '{}',  -- store image URLs from Supabase Storage
  characteristics text, -- Boat characteristics description
  capabilities text, -- Boat capabilities description
  accommodations text, -- Accommodations description
  -- Sailboat performance calculations (can be calculated from above or stored directly)
  sa_displ_ratio numeric, -- Sail Area to Displacement Ratio (S.A. / Displ.)
  ballast_displ_ratio numeric, -- Ballast to Displacement Ratio (Bal. / Displ.) as percentage
  displ_len_ratio numeric, -- Displacement to Length Ratio (Disp: / Len)
  comfort_ratio numeric, -- Comfort Ratio (Ted Brewer's formula)
  capsize_screening numeric, -- Capsize Screening Formula value
  hull_speed_knots numeric, -- Theoretical hull speed in knots
  ppi_pounds_per_inch numeric, -- Pounds per Inch Immersion (PPI)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create index if not exists boats_owner_id_idx on public.boats (owner_id);

-- Enable Row Level Security
alter table boats enable row level security;

-- Policies
create policy "Boats are accessible to all"
on boats for select
using(true);

create policy "Owners can insert their boats"
on boats for insert
with check (auth.uid() = owner_id);

create policy "Owners can update their boat details"
on boats for update
using(auth.uid() = owner_id);

create policy "Onwers can delete their boats"
on boats for delete
using(auth.uid() = owner_id);


-- ============================================================================
-- TABLE: journeys
-- ============================================================================

-- Table definition
create table if not exists public.journeys (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats (id) on delete cascade,
  name         text not null,
  start_date   date,
  end_date     date,
  description  text,
  risk_level   risk_level[] default '{}',
  skills       text[] default '{}',  -- Required skills for this journey (array of skill names)
  min_experience_level integer,  -- Minimum required experience level: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
  cost_model   cost_model default 'Not defined',
  state        journey_state not null default 'In planning',
  is_ai_generated boolean default false,
  ai_prompt    text,
  images       text[] default '{}',  -- store image URLs from Supabase Storage
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists journeys_boat_id_idx on public.journeys (boat_id);
create index if not exists journeys_state_idx on public.journeys (state);

-- Enable Row Level Security
alter table journeys enable row level security;

-- Policies
-- Only published journeys are viewable by everyone, owners can see all their journeys
create policy "Published journeys are viewable by all"
on journeys for select
using (
  state = 'Published'::journey_state
  or exists (
    select 1 from boats
    where boats.id = journeys.boat_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can insert journeys for their boats"
on journeys for insert
to authenticated
with check (
  auth.uid() IS NOT NULL
  AND journeys.boat_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM public.boats 
    WHERE boats.id::text = journeys.boat_id::text
    AND boats.owner_id::text = auth.uid()::text
  )
);

create policy "Owners can update their own journeys"
on journeys for update
using (
  exists (
    select 1 from boats
    where boats.id = journeys.boat_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can delete their own journeys"
on journeys for delete
using (
  exists (
    select 1 from boats
    where boats.id = journeys.boat_id
    and boats.owner_id = auth.uid()
  )
);


-- ============================================================================
-- TABLE: legs
-- ============================================================================

-- Table definition
create table if not exists public.legs (
  id           uuid primary key default gen_random_uuid(),
  journey_id   uuid not null references public.journeys (id) on delete cascade,
  name         text not null,
  description  text,  -- Additional descriptive text for the leg
  bbox         geometry(Polygon, 4326),  -- Bounding box of all waypoints, pre-calculated for fast viewport queries (PostGIS)
  start_date   timestamptz,
  end_date     timestamptz,
  crew_needed  int,
  skills       text[] default '{}',  -- simple array of skill tags (leg-specific skills, not journey skills)
  risk_level   risk_level,  -- Risk level for this leg: Coastal sailing, Offshore sailing, or Extreme sailing (single selection)
  min_experience_level integer,  -- Minimum required experience level for this leg. Can be more strict (higher number) than journey level, but not less strict. Values: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists legs_journey_id_idx on public.legs (journey_id);
create index if not exists legs_bbox_idx on public.legs using gist (bbox);  -- GIST spatial index for viewport queries

-- Note: Waypoints are now stored in the normalized waypoints table (see waypoints table definition below)

-- Enable Row Level Security
alter table legs enable row level security;

-- Policies
create policy "Legs are viewable by all"
on legs for select
using (true);

create policy "Owners can insert legs for their journeys"
on legs for insert
with check (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = legs.journey_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can update their own legs"
on legs for update
using (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = legs.journey_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can delete their own legs"
on legs for delete
using (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = legs.journey_id
    and boats.owner_id = auth.uid()
  )
);


-- ============================================================================
-- TABLE: waypoints
-- ============================================================================

-- Table definition
create table if not exists public.waypoints (
  id           uuid primary key default gen_random_uuid(),
  leg_id       uuid not null references public.legs (id) on delete cascade,
  index        integer not null,  -- Order within leg (0 = start, 1+ = waypoints, last = end)
  name         text,  -- Location name
  location     geometry(Point, 4326) not null,  -- PostGIS geometry (lng, lat) in WGS84
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint waypoints_leg_index_unique unique (leg_id, index)
);

-- Indexes
create index if not exists waypoints_location_idx on public.waypoints using gist (location);  -- GIST spatial index for geospatial queries
create index if not exists waypoints_leg_id_idx on public.waypoints (leg_id);  -- Index for fast joins with legs
create index if not exists waypoints_leg_id_index_idx on public.waypoints (leg_id, index);  -- Composite index for ordered retrieval

-- Comments
comment on table public.waypoints is 'Waypoints for journey legs, stored as PostGIS geometry for efficient spatial queries';
comment on column public.waypoints.location is 'PostGIS Point geometry in WGS84 (SRID 4326). Coordinates are stored as [lng, lat]';
comment on column public.waypoints.index is 'Order of waypoint within leg: 0 = start, 1+ = intermediate waypoints, last = end';

-- Triggers
-- Automatic bbox update: see migrations/create_bbox_update_trigger.sql
-- The bbox column in legs table is automatically updated when waypoints are modified

-- Enable Row Level Security
alter table waypoints enable row level security;

-- Policies (inherit from legs - waypoints are accessible if the leg is accessible)
create policy "Waypoints are viewable by all"
on waypoints for select
using (
  exists (
    select 1 from legs
    where legs.id = waypoints.leg_id
  )
);

create policy "Owners can insert waypoints for their legs"
on waypoints for insert
with check (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = waypoints.leg_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can update waypoints for their legs"
on waypoints for update
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = waypoints.leg_id
    and boats.owner_id = auth.uid()
  )
);

create policy "Owners can delete waypoints for their legs"
on waypoints for delete
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = waypoints.leg_id
    and boats.owner_id = auth.uid()
  )
);

-- RPC Function: insert_leg_waypoints
-- Inserts waypoints with PostGIS geometry conversion
-- Uses SECURITY DEFINER to bypass RLS for atomic leg+waypoints creation
create or replace function public.insert_leg_waypoints(
  leg_id_param uuid,
  waypoints_param jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  waypoint jsonb;
  waypoint_index integer;
  waypoint_name text;
  waypoint_lng numeric;
  waypoint_lat numeric;
  boat_owner_id uuid;
begin
  -- Verify the leg exists and the caller owns the boat (authorization check)
  select boats.owner_id into boat_owner_id
  from legs
  join journeys on journeys.id = legs.journey_id
  join boats on boats.id = journeys.boat_id
  where legs.id = leg_id_param;

  if boat_owner_id is null then
    raise exception 'Leg not found: %', leg_id_param;
  end if;

  if boat_owner_id != auth.uid() then
    raise exception 'Unauthorized: You do not own this leg''s boat';
  end if;

  -- Delete existing waypoints for this leg (for updates)
  delete from waypoints where leg_id = leg_id_param;

  -- Insert each waypoint
  for waypoint in select * from jsonb_array_elements(waypoints_param)
  loop
    waypoint_index := (waypoint->>'index')::integer;
    waypoint_name := waypoint->>'name';
    waypoint_lng := (waypoint->>'lng')::numeric;
    waypoint_lat := (waypoint->>'lat')::numeric;

    insert into waypoints (leg_id, index, name, location)
    values (
      leg_id_param,
      waypoint_index,
      waypoint_name,
      ST_SetSRID(ST_MakePoint(waypoint_lng, waypoint_lat), 4326)
    );
  end loop;
end;
$$;

grant execute on function public.insert_leg_waypoints(uuid, jsonb) to authenticated;

comment on function public.insert_leg_waypoints is
'Inserts waypoints for a leg with PostGIS geometry conversion.
Parameters:
  - leg_id_param: UUID of the leg
  - waypoints_param: JSONB array of {index, name, lng, lat}
Authorization: Caller must own the boat associated with the leg.';


-- ============================================================================
-- TABLE: registrations
-- ============================================================================

-- Table definition
create table if not exists public.registrations (
  id           uuid primary key default gen_random_uuid(),
  leg_id       uuid not null references public.legs (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       registration_status not null default 'Pending approval',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
  match_percentage numeric, -- match percentage between user skills and leg required skills, experience level, and risk level
);

-- Indexes
create index if not exists registrations_leg_id_idx on public.registrations (leg_id);
create index if not exists registrations_user_id_idx on public.registrations (user_id);
create unique index if not exists registrations_leg_user_unique
  on public.registrations (leg_id, user_id);

-- Enable Row Level Security
alter table registrations enable row level security;

-- Policies
-- Users can view their own registrations
create policy "Users can view their own registrations"
on registrations for select
using (auth.uid() = user_id);

-- Journey owners can view registrations for their journeys
create policy "Owners can view registrations for their journeys"
on registrations for select
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = registrations.leg_id
    and boats.owner_id = auth.uid()
  )
);

-- Users can create registrations for themselves
create policy "Users can create their own registrations"
on registrations for insert
with check (auth.uid() = user_id);

-- Users can update their own registrations
create policy "Users can update their own registrations"
on registrations for update
using (auth.uid() = user_id);

-- Journey owners can update registrations for their journeys
create policy "Owners can update registrations for their journeys"
on registrations for update
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = registrations.leg_id
    and boats.owner_id = auth.uid()
  )
);

-- Users can delete their own registrations
create policy "Users can delete their own registrations"
on registrations for delete
using (auth.uid() = user_id);

-- Journey owners can delete registrations for their journeys
create policy "Owners can delete registrations for their journeys"
on registrations for delete
using (
  exists (
    select 1 from legs
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where legs.id = registrations.leg_id
    and boats.owner_id = auth.uid()
  )
);


-- ============================================================================
-- TABLE: notifications
-- ============================================================================

-- Table definition
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        varchar(50) not null,  -- notification type: registration_approved, registration_denied, new_registration, journey_updated, leg_updated, profile_reminder
  title       varchar(255) not null,
  message     text,
  link        varchar(500),  -- optional URL to navigate to when notification is clicked
  read        boolean default false,
  metadata    jsonb default '{}',  -- additional JSON data related to the notification (e.g., journey_id, registration_id)
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read) where read = false;
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);

-- NOTE: RLS is DISABLED on notifications table.
-- Notifications are only created/accessed through authenticated API routes
-- which have their own authorization checks.


-- ============================================================================
-- TABLE: email_preferences
-- ============================================================================

-- Table definition
create table if not exists public.email_preferences (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  registration_updates  boolean default true,
  journey_updates       boolean default true,
  profile_reminders     boolean default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Enable Row Level Security
alter table email_preferences enable row level security;

-- Policies
create policy "Users can view own email preferences"
on email_preferences for select
using (auth.uid() = user_id);

create policy "Users can update own email preferences"
on email_preferences for update
using (auth.uid() = user_id);

create policy "Users can insert own email preferences"
on email_preferences for insert
with check (auth.uid() = user_id);

-- Trigger for updated_at
create or replace function update_email_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger trigger_email_preferences_updated_at
  before update on public.email_preferences
  for each row
  execute function update_email_preferences_updated_at();


-- ============================================================================
-- TABLE: user_consents
-- ============================================================================
-- Stores user consent preferences for GDPR compliance

create table if not exists public.user_consents (
  user_id                       uuid primary key references auth.users(id) on delete cascade,

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

  -- Consent setup tracking
  consent_setup_completed_at    timestamptz,  -- When user completed the initial consent setup modal after first login

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

create or replace trigger trigger_user_consents_updated_at
  before update on public.user_consents
  for each row
  execute function update_user_consents_updated_at();


-- ============================================================================
-- TABLE: consent_audit_log
-- ============================================================================
-- Audit trail for consent changes (GDPR requirement)

create table if not exists public.consent_audit_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
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
-- TABLE: ai_conversations
-- ============================================================================
-- Stores conversation threads between users and the AI assistant

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text, -- Auto-generated from first message or user-provided
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_ai_conversations_user_id on public.ai_conversations(user_id);
create index if not exists idx_ai_conversations_updated_at on public.ai_conversations(updated_at desc);

-- Enable Row Level Security
alter table ai_conversations enable row level security;

-- Policies: Users can only access their own conversations
create policy "Users can view own conversations"
on ai_conversations for select
using (auth.uid() = user_id);

create policy "Users can create own conversations"
on ai_conversations for insert
with check (auth.uid() = user_id);

create policy "Users can update own conversations"
on ai_conversations for update
using (auth.uid() = user_id);

create policy "Users can delete own conversations"
on ai_conversations for delete
using (auth.uid() = user_id);

-- Trigger for updated_at
create or replace function update_ai_conversations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_ai_conversations_updated_at
  before update on public.ai_conversations
  for each row
  execute function update_ai_conversations_updated_at();


-- ============================================================================
-- TABLE: ai_messages
-- ============================================================================
-- Stores individual messages within conversations

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}', -- Store tool calls, function results, etc.
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_ai_messages_conversation_id on public.ai_messages(conversation_id);
create index if not exists idx_ai_messages_conversation_created on public.ai_messages(conversation_id, created_at);

-- Enable Row Level Security
alter table ai_messages enable row level security;

-- Policies: Users can access messages in their own conversations
create policy "Users can view messages in own conversations"
on ai_messages for select
using (
  exists (
    select 1 from ai_conversations
    where ai_conversations.id = ai_messages.conversation_id
    and ai_conversations.user_id = auth.uid()
  )
);

create policy "Users can create messages in own conversations"
on ai_messages for insert
with check (
  exists (
    select 1 from ai_conversations
    where ai_conversations.id = ai_messages.conversation_id
    and ai_conversations.user_id = auth.uid()
  )
);

-- Messages are immutable - no update policy
-- Delete cascades from conversation


-- ============================================================================
-- TABLE: ai_pending_actions
-- ============================================================================
-- Stores action suggestions from AI assistant that are awaiting user action
-- These are not actions that AI is executing, but rather actions that AI is suggesting to the user to improve for exmple their profile, register for a leg, etc.

create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  action_type text not null, -- 'register_for_leg', 'update_profile_user_description', 'update_profile_certifications', etc.
  action_payload jsonb not null, -- Parameters for the action (supports both old bulk format and new field-specific format)
  explanation text not null, -- AI's explanation of why this action is suggested
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- New fields for better field-specific action support
  field_type text, -- For profile updates: the specific field being updated (user_description, certifications, etc.)
  suggested_value text, -- For profile updates: the suggested value (for display purposes)
  input_prompt text, -- Prompt to show user when collecting input (e.g., "Please provide your sailing experience level")
  input_options text[], -- Options for multi-select or select input types (e.g., skill options, risk levels)
  input_type text check (input_type in ('text', 'text_array', 'select')), -- Type of input required
  profile_field text -- Specifies which profile field this action relates to (e.g., user_description, certifications, risk_level, sailing_preferences, skills)
                     -- Used for automatic action completion when users update their profile fields
);

-- Indexes
create index if not exists idx_ai_pending_actions_user_id on public.ai_pending_actions(user_id);
create index if not exists idx_ai_pending_actions_status on public.ai_pending_actions(user_id, status) where status = 'pending';
create index if not exists idx_ai_pending_actions_conversation on public.ai_pending_actions(conversation_id);
create index if not exists idx_ai_pending_actions_field_type on public.ai_pending_actions(field_type) where field_type is not null;
create index if not exists idx_ai_pending_actions_action_type on public.ai_pending_actions(action_type);
create index if not exists idx_ai_pending_actions_profile_field on public.ai_pending_actions(profile_field) where profile_field is not null;

-- Enable Row Level Security
alter table ai_pending_actions enable row level security;

-- Policies: Users can only access their own pending actions
create policy "Users can view own pending actions"
on ai_pending_actions for select
using (auth.uid() = user_id);

create policy "Users can create own pending actions"
on ai_pending_actions for insert
with check (auth.uid() = user_id);

create policy "Users can update own pending actions"
on ai_pending_actions for update
using (auth.uid() = user_id);




-- ============================================================================
-- TABLE: feedback
-- ============================================================================
-- User-submitted feedback including bugs, feature requests, and improvements

-- Feedback type enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_type') then
    create type feedback_type as enum ('bug', 'feature', 'improvement', 'other');
  end if;
end$$;

-- Feedback status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type feedback_status as enum (
      'new',           -- Just submitted
      'under_review',  -- Being evaluated
      'planned',       -- Accepted, in roadmap
      'in_progress',   -- Currently being worked on
      'completed',     -- Done and deployed
      'declined'       -- Won't implement (with reason)
    );
  end if;
end$$;

-- Table definition
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),

  -- Submitter
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Content
  type feedback_type not null,
  title varchar(200) not null,
  description text,

  -- Context (optional - where feedback was submitted from)
  context_page varchar(100),      -- e.g., '/crew/dashboard'
  context_metadata jsonb,         -- Additional context like journey_id, leg_id

  -- Status tracking
  status feedback_status not null default 'new',
  status_note text,               -- Admin note explaining status change
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id) on delete set null,

  -- Voting (denormalized for performance)
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  vote_score integer generated always as (upvotes - downvotes) stored,

  -- Visibility
  is_public boolean not null default true,
  is_anonymous boolean not null default false,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_feedback_status on public.feedback(status);
create index if not exists idx_feedback_type on public.feedback(type);
create index if not exists idx_feedback_user_id on public.feedback(user_id);
create index if not exists idx_feedback_vote_score on public.feedback(vote_score desc);
create index if not exists idx_feedback_created_at on public.feedback(created_at desc);
create index if not exists idx_feedback_public on public.feedback(is_public) where is_public = true;

-- Enable Row Level Security
alter table public.feedback enable row level security;

-- Policies
create policy "Public feedback viewable by all"
on public.feedback for select
using (is_public = true or user_id = auth.uid());

create policy "Users can create feedback"
on public.feedback for insert
with check (auth.uid() = user_id);

create policy "Users can update own feedback"
on public.feedback for update
using (auth.uid() = user_id);

create policy "Users can delete own feedback"
on public.feedback for delete
using (auth.uid() = user_id);

-- Trigger for updated_at
create or replace function update_feedback_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_feedback_updated_at
  before update on public.feedback
  for each row
  execute function update_feedback_updated_at();


-- ============================================================================
-- TABLE: feedback_votes
-- ============================================================================
-- Tracks individual votes on feedback items, one vote per user per feedback

create table if not exists public.feedback_votes (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)), -- -1 = downvote, 1 = upvote
  created_at timestamptz not null default now(),

  constraint unique_user_feedback_vote unique (feedback_id, user_id)
);

-- Indexes
create index if not exists idx_feedback_votes_feedback_id on public.feedback_votes(feedback_id);
create index if not exists idx_feedback_votes_user_id on public.feedback_votes(user_id);

-- Enable Row Level Security
alter table public.feedback_votes enable row level security;

-- Policies
create policy "Votes viewable by all"
on public.feedback_votes for select
using (true);

create policy "Users can vote"
on public.feedback_votes for insert
with check (auth.uid() = user_id);

create policy "Users can change vote"
on public.feedback_votes for update
using (auth.uid() = user_id);

create policy "Users can remove vote"
on public.feedback_votes for delete
using (auth.uid() = user_id);

-- Trigger to update vote counts on feedback table
create or replace function update_feedback_vote_counts()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.feedback set
      upvotes = upvotes + case when new.vote = 1 then 1 else 0 end,
      downvotes = downvotes + case when new.vote = -1 then 1 else 0 end,
      updated_at = now()
    where id = new.feedback_id;
  elsif tg_op = 'DELETE' then
    update public.feedback set
      upvotes = upvotes - case when old.vote = 1 then 1 else 0 end,
      downvotes = downvotes - case when old.vote = -1 then 1 else 0 end,
      updated_at = now()
    where id = old.feedback_id;
  elsif tg_op = 'UPDATE' then
    update public.feedback set
      upvotes = upvotes - case when old.vote = 1 then 1 else 0 end
                        + case when new.vote = 1 then 1 else 0 end,
      downvotes = downvotes - case when old.vote = -1 then 1 else 0 end
                            + case when new.vote = -1 then 1 else 0 end,
      updated_at = now()
    where id = new.feedback_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger trigger_update_feedback_votes
  after insert or update or delete on public.feedback_votes
  for each row
  execute function update_feedback_vote_counts();


-- ============================================================================
-- TABLE: feedback_prompt_dismissals
-- ============================================================================
-- Tracks when users dismiss feedback prompts to control prompt frequency

create table if not exists public.feedback_prompt_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_type varchar(50) not null, -- 'post_journey', 'post_registration', 'general'
  dismissed_at timestamptz not null default now(),
  dismiss_until timestamptz, -- NULL = forever, otherwise show again after this date

  constraint unique_user_prompt_dismissal unique (user_id, prompt_type)
);

-- Indexes
create index if not exists idx_feedback_prompt_dismissals_user_id on public.feedback_prompt_dismissals(user_id);

-- Enable Row Level Security
alter table public.feedback_prompt_dismissals enable row level security;

-- Policies
create policy "Users can view own dismissals"
on public.feedback_prompt_dismissals for select
using (auth.uid() = user_id);

create policy "Users can create dismissals"
on public.feedback_prompt_dismissals for insert
with check (auth.uid() = user_id);

create policy "Users can update dismissals"
on public.feedback_prompt_dismissals for update
using (auth.uid() = user_id);

create policy "Users can delete dismissals"
on public.feedback_prompt_dismissals for delete
using (auth.uid() = user_id);


-- ============================================================================
-- STORAGE POLICIES: boat-images bucket
-- ============================================================================
-- Note: First create the bucket in Supabase Dashboard > Storage > New bucket
-- Name: boat-images, Public: true

-- Allow authenticated users to upload images to their own folder
create policy "Authenticated users can upload boat images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'boat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public to view boat images
create policy "Public can view boat images"
on storage.objects for select
to public
using (bucket_id = 'boat-images');

-- Allow users to update their own images
create policy "Users can update their own boat images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'boat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'boat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own images
create policy "Users can delete their own boat images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'boat-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- STORAGE POLICIES: journey-images bucket
-- ============================================================================
-- Note: First create the bucket in Supabase Dashboard > Storage > New bucket
-- Name: journey-images, Public: true

-- Allow authenticated users to upload images to their own folder
create policy "Authenticated users can upload journey images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'journey-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public to view journey images
create policy "Public can view journey images"
on storage.objects for select
to public
using (bucket_id = 'journey-images');

-- Allow users to update their own images
create policy "Users can update their own journey images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'journey-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'journey-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own images
create policy "Users can delete their own journey images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'journey-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);



