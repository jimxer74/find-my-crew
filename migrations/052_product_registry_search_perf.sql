-- Migration 052: Product Registry — search performance improvements
--
-- Problem: all autocomplete queries used ILIKE '%query%' (leading wildcard),
-- which cannot use any B-tree index and causes a full table scan.
-- The GIN FTS index added in 050 was never used because the code called ILIKE.
--
-- Three changes:
--   1. pg_trgm GIN index   — makes ILIKE '%partial%' fast (zero code changes needed)
--   2. Stored search_vector — pre-computes the tsvector so FTS scans avoid
--                             re-evaluating the expression on every row
--   3. New FTS GIN index   — on the stored column; replaces the expression-based one

-- 1. pg_trgm extension (available on all Supabase projects)
create extension if not exists pg_trgm;

-- 2. Stored generated tsvector column
--    GENERATED ALWAYS ... STORED means Postgres writes the value at insert/update time,
--    so queries read a plain column rather than re-evaluating the expression.
alter table public.product_registry
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('english',
        coalesce(manufacturer, '') || ' ' ||
        coalesce(model,        '') || ' ' ||
        coalesce(description,  '')
      )
    ) stored;

-- 3a. Drop the old expression-based FTS index (replaced below)
drop index if exists idx_product_registry_fts;

-- 3b. New FTS GIN index on the stored column — faster because no expression to evaluate
create index if not exists idx_product_registry_search_vector
  on public.product_registry using gin(search_vector);

-- 4. pg_trgm GIN index — covers ILIKE '%x%' patterns across all three text fields
--    Postgres picks this up automatically; no query changes required.
create index if not exists idx_product_registry_trgm
  on public.product_registry
  using gin(
    (coalesce(manufacturer, '') || ' ' || coalesce(model, '') || ' ' || coalesce(description, ''))
    gin_trgm_ops
  );
