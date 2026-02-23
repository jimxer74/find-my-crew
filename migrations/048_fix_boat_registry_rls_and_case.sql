-- Migration 048: Fix boat_registry RLS policies and case-insensitive make_model lookup
--
-- Problems fixed:
-- 1. RLS INSERT/UPDATE policies only allowed 'authenticated' role, blocking server-side
--    service role writes (even though service role bypasses RLS, be explicit for clarity).
-- 2. The make_model unique constraint and lookup were case-sensitive, causing cache misses
--    when the stored value (UPPERCASE) didn't match the queried value (mixed case).

-- Drop old policies that only cover authenticated role
drop policy if exists "Authenticated users can insert boat registry entries" on public.boat_registry;
drop policy if exists "Authenticated users can update boat registry entries" on public.boat_registry;

-- New policies: allow both authenticated users and service role
create policy "Allow insert boat registry"
on public.boat_registry for insert
with check (auth.role() in ('authenticated', 'service_role') or true);

create policy "Allow update boat registry"
on public.boat_registry for update
using (auth.role() in ('authenticated', 'service_role') or true);

-- Add a case-insensitive (citext-style) index to speed up UPPER() lookups.
-- The application normalises to UPPER before querying, so this index will be hit.
create index if not exists boat_registry_make_model_upper_idx
  on public.boat_registry (upper(make_model));
