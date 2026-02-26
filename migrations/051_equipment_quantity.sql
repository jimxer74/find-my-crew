-- Add quantity column to boat_equipment
-- Allows recording multiple identical units (e.g. 4 winches of the same model)

alter table public.boat_equipment
  add column if not exists quantity integer not null default 1
    constraint boat_equipment_quantity_positive check (quantity >= 1);
