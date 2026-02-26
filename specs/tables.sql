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
  preferred_departure_location jsonb null,  -- Preferred departure location: {name, lat, lng, isCruisingRegion?, bbox?, countryCode?, countryName?}
  preferred_arrival_location jsonb null,    -- Preferred arrival location: same shape as departure
  availability_start_date date null,        -- When crew is available from
  availability_end_date date null,          -- When crew is available until
  constraint profiles_pkey primary key (id),
  constraint profiles_language_check check (language in ('en', 'fi')),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete cascade
);
-- Indexes
create unique index if not exists profiles_user_id_key on public.profiles (id);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_availability_dates on public.profiles (availability_start_date, availability_end_date) where availability_start_date is not null or availability_end_date is not null;

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
-- TABLE: boat_registry
-- ============================================================================

-- Table definition
create table if not exists public.boat_registry (
  id uuid primary key default gen_random_uuid(),
  make_model text not null,
  slug text, -- Optional slug from sailboatdata.com (e.g., "bavaria-46")
  type sailboat_category,
  capacity int,
  loa_m numeric,
  beam_m numeric,
  max_draft_m numeric,
  displcmt_m numeric,
  average_speed_knots numeric,
  link_to_specs text,
  characteristics text,
  capabilities text,
  accommodations text,
  sa_displ_ratio numeric,
  ballast_displ_ratio numeric,
  displ_len_ratio numeric,
  comfort_ratio numeric,
  capsize_screening numeric,
  hull_speed_knots numeric,
  ppi_pounds_per_inch numeric,
  fetch_count int default 0, -- Track how many times this registry entry was used
  last_fetched_at timestamptz, -- When external source was last checked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boat_registry_make_model_unique unique (make_model)
);

-- Indexes
create index if not exists boat_registry_make_model_idx on public.boat_registry (make_model);
create index if not exists boat_registry_make_model_upper_idx on public.boat_registry (upper(make_model));
create index if not exists boat_registry_slug_idx on public.boat_registry (slug) where slug is not null;

-- Enable Row Level Security
alter table boat_registry enable row level security;

-- Policies
create policy "Boat registry is viewable by all"
on boat_registry for select
using (true);

create policy "Allow insert boat registry"
on boat_registry for insert
with check (auth.role() in ('authenticated', 'service_role') or true);

create policy "Allow update boat registry"
on boat_registry for update
using (auth.role() in ('authenticated', 'service_role') or true);


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
  cost_info    text,  -- Free text for owners to inform crew about costs (semantics left to owner)
  state        journey_state not null default 'In planning',
  is_ai_generated boolean default false,
  ai_prompt    text,
  images       text[] default '{}',  -- store image URLs from Supabase Storage
  auto_approval_enabled boolean default false,  -- Toggle automated approval for this journey
  auto_approval_threshold integer default 80 check (auto_approval_threshold >= 0 and auto_approval_threshold <= 100),  -- Minimum match score for auto-approval (0-100)
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

-- RPC Function: insert_journey_with_risk
-- Inserts a journey with risk_level as text[] (cast to scalar risk_level in SQL)
-- Bypasses PostgREST enum serialization. journeys.risk_level is scalar enum in production.
create or replace function public.insert_journey_with_risk(
  p_boat_id uuid,
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_risk_level text[],
  p_skills text[],
  p_min_experience_level integer,
  p_cost_model text,
  p_cost_info text,
  p_state text default 'In planning'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_journey_id uuid;
  v_owner_id uuid;
  v_risk_level risk_level;  -- scalar enum
begin
  select owner_id into v_owner_id from boats where id = p_boat_id;
  if v_owner_id is null then
    raise exception 'Boat not found: %', p_boat_id;
  end if;
  if v_owner_id != auth.uid() then
    raise exception 'Unauthorized: You do not own this boat';
  end if;

  -- Take first valid risk_level (column is scalar enum)
  select (array_agg(r::risk_level))[1] into v_risk_level
  from unnest(coalesce(p_risk_level, array[]::text[])) as r
  where r in ('Coastal sailing', 'Offshore sailing', 'Extreme sailing');

  insert into journeys (
    boat_id, name, description, start_date, end_date,
    risk_level, skills, min_experience_level, cost_model, cost_info, state
  )
  values (
    p_boat_id, p_name, p_description, p_start_date, p_end_date,
    v_risk_level,
    coalesce(p_skills, '{}'),
    coalesce(p_min_experience_level, 1),
    coalesce(p_cost_model, 'Not defined')::cost_model,
    p_cost_info,
    coalesce(p_state, 'In planning')::journey_state
  )
  returning id into v_journey_id;

  return v_journey_id;
end;
$$;

grant execute on function public.insert_journey_with_risk(uuid, text, text, date, date, text[], text[], integer, text, text, text) to authenticated;

comment on function public.insert_journey_with_risk is
'Inserts a journey with risk_level as text[] (takes first valid, casts to scalar risk_level).
Bypasses PostgREST enum serialization. journeys.risk_level is scalar enum in production.
Authorization: Caller must own the boat.';


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
  match_percentage numeric,  -- match percentage between user skills and leg required skills, experience level, and risk level
  ai_match_score integer check (ai_match_score >= 0 and ai_match_score <= 100),  -- AI-calculated match percentage (0-100)
  ai_match_reasoning text,  -- AI explanation of the score
  auto_approved boolean default false,  -- True if AI auto-approved this registration
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index if not exists registrations_leg_id_idx on public.registrations (leg_id);
create index if not exists registrations_user_id_idx on public.registrations (user_id);
create index if not exists registrations_ai_match_score_idx on public.registrations (ai_match_score);
create index if not exists registrations_auto_approved_idx on public.registrations (auto_approved);
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
-- TABLE: journey_requirements
-- ============================================================================

-- Table definition
create table if not exists public.journey_requirements (
  id                      uuid primary key default gen_random_uuid(),
  journey_id              uuid not null references public.journeys (id) on delete cascade,
  requirement_type        varchar(50) not null,  -- 'risk_level', 'experience_level', 'skill', 'passport', 'question'
  -- For 'question' type:
  question_text           text,  -- The question to ask crew members
  -- For 'skill' type:
  skill_name              text,  -- Canonical skill name from skills-config.json (e.g. 'navigation', 'heavy_weather')
  -- For 'skill' and 'question' types:
  qualification_criteria  text,  -- Free-text criteria for AI assessment of answers/skills
  weight                  integer default 5 check (weight >= 0 and weight <= 10),  -- Importance weight for AI scoring (0=ignored, 10=critical)
  -- For 'passport' type:
  require_photo_validation boolean default false,  -- Whether photo-ID verification is required
  pass_confidence_score   integer default 7 check (pass_confidence_score >= 0 and pass_confidence_score <= 10),  -- Minimum AI confidence for passport validation
  -- Common fields:
  is_required             boolean default true,
  "order"                 integer default 0,  -- Display order
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes
create index if not exists journey_requirements_journey_id_idx
  on public.journey_requirements (journey_id);
create index if not exists journey_requirements_journey_order_idx
  on public.journey_requirements (journey_id, "order");

-- Enable Row Level Security
alter table journey_requirements enable row level security;

-- Policies
-- Requirements for published journeys are viewable by all authenticated users
create policy "Requirements for published journeys are viewable by all"
on journey_requirements for select
using (
  exists (
    select 1 from journeys
    where journeys.id = journey_requirements.journey_id
    and (
      journeys.state = 'Published'::journey_state
      or exists (
        select 1 from boats
        where boats.id = journeys.boat_id
        and boats.owner_id = auth.uid()
      )
    )
  )
);

-- Owners can insert requirements for their journeys
create policy "Owners can insert requirements for their journeys"
on journey_requirements for insert
to authenticated
with check (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = journey_requirements.journey_id
    and boats.owner_id = auth.uid()
  )
);

-- Owners can update requirements for their journeys
create policy "Owners can update requirements for their journeys"
on journey_requirements for update
using (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = journey_requirements.journey_id
    and boats.owner_id = auth.uid()
  )
);

-- Owners can delete requirements for their journeys
create policy "Owners can delete requirements for their journeys"
on journey_requirements for delete
using (
  exists (
    select 1 from journeys
    join boats on boats.id = journeys.boat_id
    where journeys.id = journey_requirements.journey_id
    and boats.owner_id = auth.uid()
  )
);


-- ============================================================================
-- TABLE: registration_answers
-- ============================================================================

-- Table definition
create table if not exists public.registration_answers (
  id                        uuid primary key default gen_random_uuid(),
  registration_id           uuid not null references public.registrations (id) on delete cascade,
  requirement_id            uuid not null references public.journey_requirements (id) on delete cascade,
  -- For 'question' type:
  answer_text               text,  -- Crew member's text answer
  answer_json               jsonb,  -- Structured answer data (e.g. multiple choice selections)
  -- For AI-assessed types (skill, question, passport):
  ai_score                  integer check (ai_score >= 0 and ai_score <= 10),  -- Per-requirement AI score (0-10)
  ai_reasoning              text,  -- AI explanation for this requirement's score
  -- For passport type:
  passport_document_id      uuid references public.document_vault (id),  -- Reference to crew's passport in vault
  photo_verification_passed boolean,  -- Whether photo-ID verification passed
  photo_confidence_score    numeric(3,2) check (photo_confidence_score >= 0 and photo_confidence_score <= 1),  -- AI confidence (0.00-1.00)
  photo_file_data           text,  -- Base64-encoded photo file for facial verification
  -- Common:
  passed                    boolean,  -- Whether this individual requirement was met
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- Constraints:
  constraint registration_answers_unique unique (registration_id, requirement_id)
);

-- Indexes
create index if not exists registration_answers_registration_id_idx
  on public.registration_answers (registration_id);
create index if not exists registration_answers_requirement_id_idx
  on public.registration_answers (requirement_id);

-- Enable Row Level Security
alter table registration_answers enable row level security;

-- Policies
-- Users can view their own answers
create policy "Users can view their own registration answers"
on registration_answers for select
using (
  exists (
    select 1 from registrations
    where registrations.id = registration_answers.registration_id
    and registrations.user_id = auth.uid()
  )
);

-- Journey owners can view answers for registrations to their journeys
create policy "Owners can view answers for their journey registrations"
on registration_answers for select
using (
  exists (
    select 1 from registrations
    join legs on legs.id = registrations.leg_id
    join journeys on journeys.id = legs.journey_id
    join boats on boats.id = journeys.boat_id
    where registrations.id = registration_answers.registration_id
    and boats.owner_id = auth.uid()
  )
);

-- Users can insert answers for their own registrations
create policy "Users can insert their own registration answers"
on registration_answers for insert
to authenticated
with check (
  exists (
    select 1 from registrations
    where registrations.id = registration_answers.registration_id
    and registrations.user_id = auth.uid()
  )
);

-- Users can update their own answers (only while registration is pending)
create policy "Users can update their own registration answers"
on registration_answers for update
using (
  exists (
    select 1 from registrations
    where registrations.id = registration_answers.registration_id
    and registrations.user_id = auth.uid()
    and registrations.status = 'Pending approval'
  )
);

-- Service role can update answers (for AI assessment results)
-- Note: AI assessment runs server-side with service role, so it bypasses RLS.
-- No explicit policy needed for service role updates.


-- ============================================================================
-- TABLE: notifications
-- ============================================================================

-- Table definition
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
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

-- Enable Row Level Security (migration 041)
alter table public.notifications enable row level security;

-- RLS Policies
create policy "Users can read their own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role can create notifications"
  on public.notifications
  for insert
  with check (true);

create policy "Service role can delete notifications"
  on public.notifications
  for delete
  using (true);


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


-- ============================================================================
-- TABLE: document_vault
-- ============================================================================
-- Secure document vault for sensitive user documents (passports, licenses, etc.)

create table if not exists public.document_vault (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references auth.users(id) on delete cascade,
  file_path                 text not null,       -- Storage path in secure-documents bucket: {user_id}/{doc_id}/{filename}
  file_name                 text not null,       -- Original filename
  file_type                 text not null,       -- MIME type
  file_size                 integer not null,    -- File size in bytes
  category                  text,                -- AI-classified or user-selected: passport, drivers_license, national_id, sailing_license, certification, insurance, boat_registration, medical, other
  subcategory               text,                -- More specific classification
  classification_confidence real,                -- AI confidence score 0.0-1.0
  metadata                  jsonb default '{}'::jsonb, -- AI-extracted: document_number, expiry_date, issuing_authority, holder_name, etc.
  description               text,                -- User-provided description
  file_hash                 text,                -- SHA-256 hash for integrity verification
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint document_vault_file_size_positive check (file_size > 0),
  constraint document_vault_file_size_max check (file_size <= 10485760),
  constraint document_vault_category_valid check (
    category is null or category in (
      'passport', 'drivers_license', 'national_id',
      'sailing_license', 'certification', 'insurance',
      'boat_registration', 'medical', 'other'
    )
  ),
  constraint document_vault_confidence_range check (
    classification_confidence is null
    or (classification_confidence >= 0.0 and classification_confidence <= 1.0)
  )
);

-- Indexes
create index if not exists idx_document_vault_owner_id on public.document_vault(owner_id);
create index if not exists idx_document_vault_category on public.document_vault(category) where category is not null;
create index if not exists idx_document_vault_created_at on public.document_vault(created_at desc);

-- Enable Row Level Security
alter table document_vault enable row level security;

-- Policies: owner-only access
create policy "Users can view own documents"
on document_vault for select
using (auth.uid() = owner_id);

create policy "Users can upload own documents"
on document_vault for insert
with check (auth.uid() = owner_id);

create policy "Users can update own documents"
on document_vault for update
using (auth.uid() = owner_id);

create policy "Users can delete own documents"
on document_vault for delete
using (auth.uid() = owner_id);

-- Trigger for updated_at
create or replace function update_document_vault_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_document_vault_updated_at
  before update on public.document_vault
  for each row
  execute function update_document_vault_updated_at();


-- ============================================================================
-- TABLE: document_access_grants
-- ============================================================================
-- Time-limited, purpose-bound access grants for shared document viewing

create table if not exists public.document_access_grants (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references public.document_vault(id) on delete cascade,
  grantor_id            uuid not null references auth.users(id) on delete cascade,
  grantee_id            uuid not null references auth.users(id) on delete cascade,
  purpose               text not null,          -- journey_registration, identity_verification, insurance_proof, certification_check, other
  purpose_reference_id  uuid,                   -- Optional reference (e.g., journey_id)
  access_level          text not null default 'view_only',
  expires_at            timestamptz not null,
  max_views             integer,                -- NULL = unlimited within expiry
  view_count            integer not null default 0,
  is_revoked            boolean not null default false,
  revoked_at            timestamptz,
  created_at            timestamptz not null default now(),

  constraint document_access_grants_no_self_grant check (grantor_id != grantee_id),
  constraint document_access_grants_expires_future check (expires_at > created_at),
  constraint document_access_grants_max_duration check (expires_at <= created_at + interval '30 days'),
  constraint document_access_grants_purpose_valid check (
    purpose in (
      'journey_registration', 'identity_verification',
      'insurance_proof', 'certification_check', 'other'
    )
  ),
  constraint document_access_grants_access_level_valid check (access_level in ('view_only')),
  constraint document_access_grants_view_count_positive check (view_count >= 0),
  constraint document_access_grants_max_views_positive check (max_views is null or max_views > 0)
);

-- Partial unique index: one active grant per document+grantee+purpose combo
create unique index if not exists idx_document_access_grants_unique_active
  on public.document_access_grants (document_id, grantee_id, purpose)
  where is_revoked = false;

-- Indexes
create index if not exists idx_document_access_grants_document_id on public.document_access_grants(document_id);
create index if not exists idx_document_access_grants_grantor_id on public.document_access_grants(grantor_id);
create index if not exists idx_document_access_grants_grantee_id on public.document_access_grants(grantee_id);
create index if not exists idx_document_access_grants_active on public.document_access_grants(grantee_id, is_revoked, expires_at)
  where is_revoked = false;

-- Enable Row Level Security
alter table document_access_grants enable row level security;

-- Policies
create policy "Grantors can view their grants"
on document_access_grants for select
using (auth.uid() = grantor_id);

create policy "Grantees can view grants shared with them"
on document_access_grants for select
using (auth.uid() = grantee_id);

create policy "Document owners can create grants"
on document_access_grants for insert
with check (
  auth.uid() = grantor_id
  and exists (
    select 1 from document_vault
    where document_vault.id = document_id
    and document_vault.owner_id = auth.uid()
  )
);

create policy "Grantors can update their grants"
on document_access_grants for update
using (auth.uid() = grantor_id);

create policy "Grantors can delete their grants"
on document_access_grants for delete
using (auth.uid() = grantor_id);


-- ============================================================================
-- TABLE: document_access_log (Immutable Audit Trail)
-- ============================================================================

create table if not exists public.document_access_log (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid references public.document_vault(id) on delete set null,
  document_owner_id uuid references auth.users(id) on delete set null,
  accessed_by       uuid references auth.users(id) on delete set null,
  access_type       text not null,     -- upload, view, delete, grant_create, grant_revoke, classify, metadata_update
  access_granted    boolean not null,
  denial_reason     text,
  ip_address        text,
  user_agent        text,
  details           jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now(),

  constraint document_access_log_type_valid check (
    access_type in (
      'upload', 'view', 'delete', 'grant_create',
      'grant_revoke', 'classify', 'metadata_update'
    )
  )
);

-- Indexes
create index if not exists idx_document_access_log_document_id on public.document_access_log(document_id);
create index if not exists idx_document_access_log_owner_id on public.document_access_log(document_owner_id);
create index if not exists idx_document_access_log_accessed_by on public.document_access_log(accessed_by);
create index if not exists idx_document_access_log_created_at on public.document_access_log(created_at desc);

-- Enable Row Level Security
alter table document_access_log enable row level security;

-- Policies: document owner can view, authenticated users can insert, NO update/delete (immutable)
create policy "Document owners can view access logs"
on document_access_log for select
using (auth.uid() = document_owner_id);

create policy "Authenticated users can create access logs"
on document_access_log for insert
to authenticated
with check (true);


-- ============================================================================
-- TABLE: prospect_sessions
-- ============================================================================

create table if not exists public.prospect_sessions (
  session_id uuid primary key,
  -- CRITICAL: user_id is NULL for unauthenticated users (before signup)
  -- After signup, this gets linked to auth.users(id)
  user_id uuid references auth.users(id) on delete cascade, -- NULLABLE for unauthenticated users
  -- Optional: email for linking sessions before signup (if user shares email)
  -- This helps link sessions when user signs up with same email
  email text,
  conversation jsonb not null default '[]'::jsonb,
  gathered_preferences jsonb not null default '{}'::jsonb,
  viewed_legs text[] default '{}'::text[],
  onboarding_state varchar(50) not null default 'signup_pending', -- Onboarding state: signup_pending, consent_pending, profile_pending, completed
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  post_signup_onboarding_pending boolean not null default false,
  profile_completion_triggered_at timestamptz null
);

-- Indexes for performance
create index if not exists idx_prospect_sessions_user_id 
  on public.prospect_sessions(user_id) 
  where user_id is not null;

-- Index for email-based session linking (before signup)
create index if not exists idx_prospect_sessions_email 
  on public.prospect_sessions(email) 
  where email is not null and user_id is null;

create index if not exists idx_prospect_sessions_expires 
  on public.prospect_sessions(expires_at);

create index if not exists idx_prospect_sessions_last_active 
  on public.prospect_sessions(last_active_at);

-- Enable Row Level Security
alter table public.prospect_sessions enable row level security;

-- RLS Policies
-- CRITICAL: Allow unauthenticated access to sessions with user_id = NULL
-- This enables prospect users to access their sessions before signup
-- Security: API routes MUST validate session_id from cookie matches requested session

-- SELECT: Unauthenticated users can view sessions with user_id = NULL
create policy "Unauthenticated users can view their sessions"
  on public.prospect_sessions
  for select
  using (user_id is null);

-- INSERT: Unauthenticated users can create sessions with user_id = NULL
create policy "Unauthenticated users can create sessions"
  on public.prospect_sessions
  for insert
  with check (user_id is null);

-- UPDATE: Unauthenticated users can update sessions with user_id = NULL
create policy "Unauthenticated users can update their sessions"
  on public.prospect_sessions
  for update
  using (user_id is null)
  with check (user_id is null);

-- DELETE: Unauthenticated users can delete sessions with user_id = NULL
create policy "Unauthenticated users can delete their sessions"
  on public.prospect_sessions
  for delete
  using (user_id is null);

-- Authenticated users can access their own sessions
create policy "Users can view own sessions"
  on public.prospect_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.prospect_sessions
  for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.prospect_sessions
  for delete
  using (auth.uid() = user_id);

-- Service role can access all sessions (for cleanup jobs and session linking)
create policy "Service role can manage all sessions"
  on public.prospect_sessions
  for all
  using (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- TABLE: owner_sessions
-- ============================================================================

create table if not exists public.owner_sessions (
  session_id uuid primary key,
  -- CRITICAL: user_id is NULL for unauthenticated users (before signup)
  -- After signup, this gets linked to auth.users(id)
  user_id uuid references auth.users(id) on delete cascade, -- NULLABLE for unauthenticated users
  -- Optional: email for linking sessions before signup (if user shares email)
  -- This helps link sessions when user signs up with same email
  email text,
  conversation jsonb not null default '[]'::jsonb,
  gathered_preferences jsonb not null default '{}'::jsonb,
  onboarding_state varchar(50) not null default 'signup_pending', -- Onboarding state: signup_pending, consent_pending, profile_pending, boat_pending, journey_pending, completed
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  post_signup_onboarding_pending boolean not null default false,
  profile_completion_triggered_at timestamptz null,
  skipper_profile text,          -- Raw skipper/owner profile text from combo search box
  crew_requirements text,        -- Raw crew requirements text from combo search box
  journey_details text           -- Parsed journey details text from combo search box (locations, dates, waypoints)
);

-- Indexes for performance
create index if not exists idx_owner_sessions_user_id 
  on public.owner_sessions(user_id) 
  where user_id is not null;

-- Index for email-based session linking (before signup)
create index if not exists idx_owner_sessions_email 
  on public.owner_sessions(email) 
  where email is not null and user_id is null;

create index if not exists idx_owner_sessions_expires 
  on public.owner_sessions(expires_at);

create index if not exists idx_owner_sessions_last_active 
  on public.owner_sessions(last_active_at);

-- Enable Row Level Security
alter table public.owner_sessions enable row level security;

-- RLS Policies
-- CRITICAL: Allow unauthenticated access to sessions with user_id = NULL
-- This enables owner users to access their sessions before signup
-- Security: API routes MUST validate session_id from cookie matches requested session

-- SELECT: Unauthenticated users can view sessions with user_id = NULL
create policy "Unauthenticated users can view their owner sessions"
  on public.owner_sessions
  for select
  using (user_id is null);

-- INSERT: Unauthenticated users can create sessions with user_id = NULL
create policy "Unauthenticated users can create owner sessions"
  on public.owner_sessions
  for insert
  with check (user_id is null);

-- UPDATE: Unauthenticated users can update sessions with user_id = NULL
create policy "Unauthenticated users can update their owner sessions"
  on public.owner_sessions
  for update
  using (user_id is null)
  with check (user_id is null);

-- DELETE: Unauthenticated users can delete sessions with user_id = NULL
create policy "Unauthenticated users can delete their owner sessions"
  on public.owner_sessions
  for delete
  using (user_id is null);

-- Authenticated users can access their own sessions
create policy "Users can view own owner sessions"
  on public.owner_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can update own owner sessions"
  on public.owner_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own owner sessions"
  on public.owner_sessions
  for delete
  using (auth.uid() = user_id);

-- Service role can access all sessions (for cleanup jobs and session linking)
create policy "Service role can manage all owner sessions"
  on public.owner_sessions
  for all
  using (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================================
-- STORAGE POLICIES: secure-documents bucket (PRIVATE)
-- ============================================================================
-- NOTE: Create bucket in Supabase Dashboard > Storage > New bucket
-- Name: secure-documents, Public: false
-- Grantees NEVER access storage directly - server generates signed URLs via service role

-- Owner can upload to their folder
create policy "Owners can upload secure documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner can read their own files
create policy "Owners can read own secure documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner can update their own files
create policy "Owners can update own secure documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner can delete their own files
create policy "Owners can delete own secure documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'secure-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================================
-- BOAT MANAGEMENT MODULE TABLES
-- ============================================================================

-- Document Vault Extension: optional boat_id for boat-specific documents
-- (boat_id column added to existing document_vault table)
-- alter table public.document_vault add column if not exists boat_id uuid references public.boats(id) on delete set null;
-- create index if not exists idx_document_vault_boat_id on public.document_vault(boat_id) where boat_id is not null;

-- Extended document categories include boat management types:
-- 'equipment_manual', 'service_record', 'warranty', 'boat_survey', 'safety_certificate'


-- ============================================================================
-- Product Registry Table
-- Community-grown catalog of marine equipment (engines, electronics, rigging…).
-- Category-agnostic: all per-category specs stored in JSONB.
-- shared across all boats and owners.
-- ============================================================================

create table if not exists public.product_registry (
  id                  uuid primary key default gen_random_uuid(),
  category            text not null,                -- matches boat_equipment.category values
  subcategory         text,
  manufacturer        text not null,
  model               text not null,
  description         text,
  variants            text[] default '{}',
  specs               jsonb default '{}',           -- agnostic: {hp: 27, cooling: "heat-exchanger", ...}
  manufacturer_url    text,
  documentation_links jsonb default '[]',           -- [{title: "...", url: "..."}]
  spare_parts_links   jsonb default '[]',           -- [{region: "eu|us|uk|asia|global", title: "...", url: "..."}]
  is_verified         boolean default false,        -- true = curated/seeded; false = community submission
  submitted_by        uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (manufacturer, model)
);

create index if not exists idx_product_registry_category on public.product_registry(category);
create index if not exists idx_product_registry_manufacturer_model on public.product_registry(manufacturer, model);
create index if not exists idx_product_registry_fts on public.product_registry
  using gin(to_tsvector('english',
    coalesce(manufacturer, '') || ' ' || coalesce(model, '') || ' ' || coalesce(description, '')
  ));

alter table public.product_registry enable row level security;

create policy "Anyone can view product registry"
  on public.product_registry for select using (true);

create policy "Authenticated users can submit products"
  on public.product_registry for insert
  with check (auth.uid() is not null);

create policy "Submitters can update their own products"
  on public.product_registry for update
  using (submitted_by = auth.uid());

create policy "Submitters can delete their own products"
  on public.product_registry for delete
  using (submitted_by = auth.uid());


-- ============================================================================
-- Boat Equipment Table
-- Hierarchical equipment registry with parent-child relationships.
-- Uses JSONB specs for flexible equipment-specific attributes.
-- Optional link to product_registry for auto-fill and documentation.
-- ============================================================================

create table if not exists public.boat_equipment (
  id              uuid primary key default gen_random_uuid(),
  boat_id         uuid not null references public.boats(id) on delete cascade,
  parent_id       uuid references public.boat_equipment(id) on delete set null,
  name            text not null,
  category        text not null,
  subcategory     text,
  manufacturer    text,
  model           text,
  serial_number   text,
  year_installed  int,
  specs           jsonb default '{}',
  notes           text,
  images          text[] default '{}',
  status          text not null default 'active',
  product_registry_id uuid references public.product_registry(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint boat_equipment_category_valid check (
    category in (
      'engine', 'rigging', 'electrical', 'navigation', 'safety',
      'plumbing', 'anchoring', 'hull_deck', 'electronics',
      'galley', 'comfort', 'dinghy'
    )
  ),
  constraint boat_equipment_status_valid check (
    status in ('active', 'decommissioned', 'needs_replacement')
  )
);

create index if not exists idx_boat_equipment_boat_id on public.boat_equipment(boat_id);
create index if not exists idx_boat_equipment_parent_id on public.boat_equipment(parent_id) where parent_id is not null;
create index if not exists idx_boat_equipment_category on public.boat_equipment(category);
create index if not exists idx_boat_equipment_product_registry_id on public.boat_equipment(product_registry_id) where product_registry_id is not null;

alter table boat_equipment enable row level security;

create policy "Anyone can view equipment"
  on boat_equipment for select using (true);

create policy "Boat owners can insert equipment"
  on boat_equipment for insert
  with check (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

create policy "Boat owners can update equipment"
  on boat_equipment for update
  using (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

create policy "Boat owners can delete equipment"
  on boat_equipment for delete
  using (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));


-- ============================================================================
-- Boat Inventory / Spare Parts Table
-- Tracks spare parts, consumables, and supplies per boat.
-- Links to equipment via optional equipment_id.
-- ============================================================================

create table if not exists public.boat_inventory (
  id              uuid primary key default gen_random_uuid(),
  boat_id         uuid not null references public.boats(id) on delete cascade,
  equipment_id    uuid references public.boat_equipment(id) on delete set null,
  name            text not null,
  category        text not null,
  quantity        int not null default 0,
  min_quantity    int default 0,
  unit            text,
  location        text,
  supplier        text,
  part_number     text,
  cost            numeric,
  currency        text default 'EUR',
  purchase_date   date,
  expiry_date     date,
  notes           text,
  images          text[] default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint boat_inventory_quantity_non_negative check (quantity >= 0),
  constraint boat_inventory_min_quantity_non_negative check (min_quantity >= 0)
);

create index if not exists idx_boat_inventory_boat_id on public.boat_inventory(boat_id);
create index if not exists idx_boat_inventory_equipment_id on public.boat_inventory(equipment_id) where equipment_id is not null;
create index if not exists idx_boat_inventory_category on public.boat_inventory(category);

alter table boat_inventory enable row level security;

create policy "Anyone can view inventory"
  on boat_inventory for select using (true);

create policy "Boat owners can insert inventory"
  on boat_inventory for insert
  with check (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

create policy "Boat owners can update inventory"
  on boat_inventory for update
  using (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

create policy "Boat owners can delete inventory"
  on boat_inventory for delete
  using (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));


-- ============================================================================
-- Boat Maintenance Tasks Table
-- Dual-purpose: templates (is_template=true) and scheduled task instances.
-- Supports time-based and usage-based recurrence via JSONB config.
-- ============================================================================

create table if not exists public.boat_maintenance_tasks (
  id              uuid primary key default gen_random_uuid(),
  boat_id         uuid not null references public.boats(id) on delete cascade,
  equipment_id    uuid references public.boat_equipment(id) on delete set null,
  title           text not null,
  description     text,
  category        text not null,
  priority        text not null default 'medium',
  status          text not null default 'pending',
  is_template     boolean default false,
  template_id     uuid references public.boat_maintenance_tasks(id) on delete set null,
  recurrence      jsonb,
  due_date        date,
  completed_at    timestamptz,
  completed_by    uuid references auth.users(id) on delete set null,
  assigned_to     uuid references auth.users(id) on delete set null,
  estimated_hours numeric,
  actual_hours    numeric,
  estimated_cost  numeric,
  actual_cost     numeric,
  instructions    text,
  parts_needed    jsonb default '[]',
  notes           text,
  images_before   text[] default '{}',
  images_after    text[] default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint boat_maintenance_category_valid check (
    category in ('routine', 'seasonal', 'repair', 'inspection', 'safety')
  ),
  constraint boat_maintenance_priority_valid check (
    priority in ('low', 'medium', 'high', 'critical')
  ),
  constraint boat_maintenance_status_valid check (
    status in ('pending', 'in_progress', 'completed', 'overdue', 'skipped')
  )
);

create index if not exists idx_boat_maintenance_boat_id on public.boat_maintenance_tasks(boat_id);
create index if not exists idx_boat_maintenance_equipment_id on public.boat_maintenance_tasks(equipment_id) where equipment_id is not null;
create index if not exists idx_boat_maintenance_status on public.boat_maintenance_tasks(status) where is_template = false;
create index if not exists idx_boat_maintenance_due_date on public.boat_maintenance_tasks(due_date) where due_date is not null and is_template = false;
create index if not exists idx_boat_maintenance_template on public.boat_maintenance_tasks(is_template) where is_template = true;

alter table boat_maintenance_tasks enable row level security;

create policy "Anyone can view maintenance tasks"
  on boat_maintenance_tasks for select using (true);

create policy "Boat owners can insert maintenance tasks"
  on boat_maintenance_tasks for insert
  with check (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

create policy "Boat owners can update maintenance tasks"
  on boat_maintenance_tasks for update
  using (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

create policy "Boat owners can delete maintenance tasks"
  on boat_maintenance_tasks for delete
  using (exists (select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()));

