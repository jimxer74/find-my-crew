-- Migration 056: upsert_and_enrich_product_registry RPC
--
-- Shared database function called by both the async job worker
-- (generate-boat-equipment) and the Next.js API route (product-registry/ai-search)
-- to upsert and selectively enrich product_registry entries from AI-generated data.
--
-- Behaviour:
--   1. INSERT new (manufacturer, model) pairs — skips conflicts (DO NOTHING)
--   2. UPDATE existing records — fills only NULL/empty fields, never overwrites verified data
--   3. RETURNS full rows for all input items (including their IDs)
--
-- SECURITY DEFINER: runs with the privileges of the function owner so both the
-- authenticated-user context (ai-search API route) and the service-role context
-- (edge function job worker) can enrich records they did not submit — e.g. seeded
-- entries where submitted_by IS NULL, which would otherwise fail the RLS update policy.

CREATE OR REPLACE FUNCTION public.upsert_and_enrich_product_registry(items JSONB)
RETURNS SETOF public.product_registry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- -------------------------------------------------------------------------
  -- Step 1: Insert new records — skip existing (manufacturer, model) pairs
  -- -------------------------------------------------------------------------
  INSERT INTO product_registry (
    category, subcategory, manufacturer, model,
    description, variants, specs,
    manufacturer_url, documentation_links, spare_parts_links,
    is_verified, submitted_by
  )
  SELECT
    el->>'category',
    NULLIF(el->>'subcategory', ''),
    el->>'manufacturer',
    el->>'model',
    NULLIF(el->>'description', ''),
    CASE
      WHEN el->'variants' IS NOT NULL AND jsonb_typeof(el->'variants') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(el->'variants'))
      ELSE '{}'::text[]
    END,
    COALESCE(el->'specs', '{}'::jsonb),
    CASE WHEN el->>'manufacturer_url' ~ '^https?://' THEN el->>'manufacturer_url' ELSE NULL END,
    COALESCE(el->'documentation_links', '[]'::jsonb),
    COALESCE(el->'spare_parts_links',   '[]'::jsonb),
    COALESCE((el->>'is_verified')::boolean, false),
    NULL  -- submitted_by: AI-sourced, not user-submitted
  FROM jsonb_array_elements(items) AS el
  WHERE (el->>'manufacturer') IS NOT NULL
    AND (el->>'model')        IS NOT NULL
  ON CONFLICT (manufacturer, model) DO NOTHING;

  -- -------------------------------------------------------------------------
  -- Step 2: Enrich existing records — fill only NULL/empty fields
  -- Never overwrites non-empty verified data.
  -- Only runs the UPDATE when there is at least one field to fill.
  -- -------------------------------------------------------------------------
  UPDATE product_registry pr
  SET
    description = CASE
                    WHEN pr.description IS NULL AND (el->>'description') IS NOT NULL
                    THEN el->>'description'
                    ELSE pr.description
                  END,
    manufacturer_url = CASE
                         WHEN pr.manufacturer_url IS NULL
                          AND el->>'manufacturer_url' ~ '^https?://'
                         THEN el->>'manufacturer_url'
                         ELSE pr.manufacturer_url
                       END,
    documentation_links = CASE
                            WHEN jsonb_array_length(COALESCE(pr.documentation_links, '[]'::jsonb)) = 0
                             AND jsonb_array_length(COALESCE(el->'documentation_links', '[]'::jsonb)) > 0
                            THEN el->'documentation_links'
                            ELSE pr.documentation_links
                          END,
    spare_parts_links = CASE
                          WHEN jsonb_array_length(COALESCE(pr.spare_parts_links, '[]'::jsonb)) = 0
                           AND jsonb_array_length(COALESCE(el->'spare_parts_links', '[]'::jsonb)) > 0
                          THEN el->'spare_parts_links'
                          ELSE pr.spare_parts_links
                        END,
    variants = CASE
                 WHEN array_length(COALESCE(pr.variants, '{}'::text[]), 1) IS NULL
                  AND el->'variants' IS NOT NULL
                  AND jsonb_typeof(el->'variants') = 'array'
                  AND jsonb_array_length(el->'variants') > 0
                 THEN ARRAY(SELECT jsonb_array_elements_text(el->'variants'))
                 ELSE pr.variants
               END,
    specs = CASE
              WHEN (pr.specs IS NULL OR pr.specs = '{}'::jsonb)
               AND el->'specs' IS NOT NULL
               AND el->'specs' != '{}'::jsonb
              THEN el->'specs'
              ELSE pr.specs
            END,
    updated_at = now()
  FROM jsonb_array_elements(items) AS el
  WHERE pr.manufacturer = el->>'manufacturer'
    AND pr.model        = el->>'model'
    -- Only touch rows where there is actually something to fill in
    AND (
      (pr.description IS NULL AND (el->>'description') IS NOT NULL)
      OR
      (pr.manufacturer_url IS NULL AND el->>'manufacturer_url' ~ '^https?://')
      OR
      (jsonb_array_length(COALESCE(pr.documentation_links, '[]'::jsonb)) = 0
        AND jsonb_array_length(COALESCE(el->'documentation_links', '[]'::jsonb)) > 0)
      OR
      (jsonb_array_length(COALESCE(pr.spare_parts_links, '[]'::jsonb)) = 0
        AND jsonb_array_length(COALESCE(el->'spare_parts_links', '[]'::jsonb)) > 0)
      OR
      (array_length(COALESCE(pr.variants, '{}'::text[]), 1) IS NULL
        AND jsonb_array_length(COALESCE(el->'variants', '[]'::jsonb)) > 0)
      OR
      ((pr.specs IS NULL OR pr.specs = '{}'::jsonb)
        AND el->'specs' IS NOT NULL AND el->'specs' != '{}'::jsonb)
    );

  -- -------------------------------------------------------------------------
  -- Step 3: Return the full rows (with IDs) for all input items
  -- -------------------------------------------------------------------------
  RETURN QUERY
    SELECT pr.*
    FROM product_registry pr
    JOIN jsonb_array_elements(items) AS el
      ON pr.manufacturer = el->>'manufacturer'
     AND pr.model        = el->>'model';
END;
$$;

-- Allow authenticated users and the service role to call this function.
-- The service role already bypasses RLS; authenticated users need explicit EXECUTE.
GRANT EXECUTE ON FUNCTION public.upsert_and_enrich_product_registry(JSONB)
  TO authenticated, service_role;
