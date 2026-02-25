-- Migration 049: Boat Management Module Tables
-- Creates boat_equipment, boat_inventory, boat_maintenance_tasks tables
-- Extends document_vault with boat_id

-- ============================================================================
-- 1. Extend document_vault with optional boat_id
-- ============================================================================

alter table public.document_vault
  add column if not exists boat_id uuid references public.boats(id) on delete set null;

create index if not exists idx_document_vault_boat_id
  on public.document_vault(boat_id) where boat_id is not null;

-- Add boat-management document categories
alter table public.document_vault drop constraint if exists document_vault_category_valid;
alter table public.document_vault add constraint document_vault_category_valid check (
  category is null or category in (
    'passport', 'drivers_license', 'national_id',
    'sailing_license', 'certification', 'insurance',
    'boat_registration', 'medical', 'other',
    'equipment_manual', 'service_record', 'warranty',
    'boat_survey', 'safety_certificate'
  )
);


-- ============================================================================
-- 2. Boat Equipment Table
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

-- Indexes
create index if not exists idx_boat_equipment_boat_id on public.boat_equipment(boat_id);
create index if not exists idx_boat_equipment_parent_id on public.boat_equipment(parent_id) where parent_id is not null;
create index if not exists idx_boat_equipment_category on public.boat_equipment(category);

-- Enable RLS
alter table boat_equipment enable row level security;

-- RLS Policies: boat owner can CRUD, all authenticated can read
create policy "Anyone can view equipment"
  on boat_equipment for select
  using (true);

create policy "Boat owners can insert equipment"
  on boat_equipment for insert
  with check (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

create policy "Boat owners can update equipment"
  on boat_equipment for update
  using (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

create policy "Boat owners can delete equipment"
  on boat_equipment for delete
  using (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );


-- ============================================================================
-- 3. Boat Inventory / Spare Parts Table
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

-- Indexes
create index if not exists idx_boat_inventory_boat_id on public.boat_inventory(boat_id);
create index if not exists idx_boat_inventory_equipment_id on public.boat_inventory(equipment_id) where equipment_id is not null;
create index if not exists idx_boat_inventory_category on public.boat_inventory(category);

-- Enable RLS
alter table boat_inventory enable row level security;

-- RLS Policies
create policy "Anyone can view inventory"
  on boat_inventory for select
  using (true);

create policy "Boat owners can insert inventory"
  on boat_inventory for insert
  with check (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

create policy "Boat owners can update inventory"
  on boat_inventory for update
  using (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

create policy "Boat owners can delete inventory"
  on boat_inventory for delete
  using (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );


-- ============================================================================
-- 4. Boat Maintenance Tasks Table
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

-- Indexes
create index if not exists idx_boat_maintenance_boat_id on public.boat_maintenance_tasks(boat_id);
create index if not exists idx_boat_maintenance_equipment_id on public.boat_maintenance_tasks(equipment_id) where equipment_id is not null;
create index if not exists idx_boat_maintenance_status on public.boat_maintenance_tasks(status) where is_template = false;
create index if not exists idx_boat_maintenance_due_date on public.boat_maintenance_tasks(due_date) where due_date is not null and is_template = false;
create index if not exists idx_boat_maintenance_template on public.boat_maintenance_tasks(is_template) where is_template = true;

-- Enable RLS
alter table boat_maintenance_tasks enable row level security;

-- RLS Policies
create policy "Anyone can view maintenance tasks"
  on boat_maintenance_tasks for select
  using (true);

create policy "Boat owners can insert maintenance tasks"
  on boat_maintenance_tasks for insert
  with check (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

create policy "Boat owners can update maintenance tasks"
  on boat_maintenance_tasks for update
  using (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

create policy "Boat owners can delete maintenance tasks"
  on boat_maintenance_tasks for delete
  using (
    exists (
      select 1 from boats where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );
