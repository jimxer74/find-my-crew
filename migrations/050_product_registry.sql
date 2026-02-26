-- Migration 050: Product Registry
-- Creates product_registry table for shared equipment data across all boats.
-- Adds product_registry_id FK to boat_equipment table.
-- Seeds 24 marine engine models from engines.json.

-- ============================================================================
-- Product Registry Table
-- Category-agnostic: specs in JSONB, no dedicated per-category columns.
-- ============================================================================

create table if not exists public.product_registry (
  id                  uuid primary key default gen_random_uuid(),
  category            text not null,                -- matches boat_equipment.category enum values
  subcategory         text,                         -- optional, matches boat_equipment subcategory
  manufacturer        text not null,
  model               text not null,
  description         text,
  variants            text[] default '{}',
  specs               jsonb default '{}',           -- agnostic: {hp: 27, cooling: "heat-exchanger", ...}
  manufacturer_url    text,
  documentation_links jsonb default '[]',           -- [{title: "...", url: "..."}]
  spare_parts_links   jsonb default '[]',           -- [{region: "eu|us|uk|asia|global", title: "...", url: "..."}]
  is_verified         boolean default false,        -- true = curated/seeded, false = community submission
  submitted_by        uuid references auth.users(id) on delete set null,  -- null = seeded
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (manufacturer, model)
);

-- Index for autocomplete search
create index if not exists idx_product_registry_category
  on public.product_registry(category);

create index if not exists idx_product_registry_manufacturer_model
  on public.product_registry(manufacturer, model);

-- GIN index for full-text search on manufacturer + model + description
create index if not exists idx_product_registry_fts
  on public.product_registry
  using gin(to_tsvector('english',
    coalesce(manufacturer, '') || ' ' || coalesce(model, '') || ' ' || coalesce(description, '')
  ));

alter table public.product_registry enable row level security;

-- Anyone can search/read the registry
create policy "Anyone can view product registry"
  on public.product_registry for select using (true);

-- Authenticated users can submit new products
create policy "Authenticated users can submit products"
  on public.product_registry for insert
  with check (auth.uid() is not null);

-- Users can update only their own submissions
create policy "Submitters can update their own products"
  on public.product_registry for update
  using (submitted_by = auth.uid());

-- Users can delete only their own submissions
create policy "Submitters can delete their own products"
  on public.product_registry for delete
  using (submitted_by = auth.uid());

-- ============================================================================
-- Add product_registry_id FK to boat_equipment
-- Optional link: equipment can still exist without a registry match.
-- ============================================================================

alter table public.boat_equipment
  add column if not exists product_registry_id uuid
    references public.product_registry(id) on delete set null;

create index if not exists idx_boat_equipment_product_registry_id
  on public.boat_equipment(product_registry_id)
  where product_registry_id is not null;

-- ============================================================================
-- Seed: 24 Marine Engine Models from engines.json
-- All seeded entries: is_verified=true, submitted_by=NULL
-- All spare_parts_links tagged region='global' initially.
-- Regional tagging (eu/us/uk) can be added in a follow-up migration.
-- ============================================================================

insert into public.product_registry (
  category, subcategory, manufacturer, model, description, variants, specs,
  documentation_links, spare_parts_links, is_verified, submitted_by
) values

-- 1. Yanmar 1GM10
(
  'engine', 'engine', 'Yanmar', '1GM10',
  'Single-cylinder raw-water or heat-exchanger inboard / saildrive',
  ARRAY['1GM10C (saildrive)', '1GM10F', '1GM10L'],
  '{"hp": 9}'::jsonb,
  '[{"title": "Official Operation Manual", "url": "https://www.yanmar.com/marine/wp-content/uploads/2020/05/0AGMM-EN0013_2018.04.pdf"}, {"title": "Workshop/Service Manual", "url": "https://nhmr.nl/wp-content/uploads/2022/03/YANMAR-WORKSHOP-MANUAL-1GM10-2GM30-3GM30-3HM35.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar GM Parts & Spares", "url": "https://parts4engines.com/collections/yanmar-gm-series"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=yanmar+1gm10"}, {"region": "global", "title": "Official Yanmar Dealer Locator", "url": "https://www.yanmar.com/marine/dealer-locator/"}]'::jsonb,
  true, null
),

-- 2. Yanmar 2GM20
(
  'engine', 'engine', 'Yanmar', '2GM20',
  'Twin-cylinder raw-water or heat-exchanger inboard / saildrive',
  ARRAY['2GM20F', '2GM20C (saildrive)'],
  '{"hp": 18}'::jsonb,
  '[{"title": "GM Series Operation Manual", "url": "https://www.yanmar.com/marine/wp-content/uploads/2020/05/0AGMM-EN0013_2018.04.pdf"}, {"title": "Workshop Manual", "url": "https://nhmr.nl/wp-content/uploads/2022/03/YANMAR-WORKSHOP-MANUAL-1GM10-2GM30-3GM30-3HM35.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar GM Series Parts", "url": "https://parts4engines.com/collections/yanmar-gm-series"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=yanmar+2gm20"}]'::jsonb,
  true, null
),

-- 3. Yanmar 3GM30
(
  'engine', 'engine', 'Yanmar', '3GM30',
  'Three-cylinder raw-water or heat-exchanger inboard / saildrive',
  ARRAY['3GM30F', '3GM30C'],
  '{"hp": 27}'::jsonb,
  '[{"title": "GM Series Operation Manual", "url": "https://www.yanmar.com/marine/wp-content/uploads/2020/05/0AGMM-EN0013_2018.04.pdf"}, {"title": "Workshop Manual", "url": "https://nhmr.nl/wp-content/uploads/2022/03/YANMAR-WORKSHOP-MANUAL-1GM10-2GM30-3GM30-3HM35.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar GM Series Parts", "url": "https://parts4engines.com/collections/yanmar-gm-series"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=yanmar+3gm30"}]'::jsonb,
  true, null
),

-- 4. Yanmar 3YM30
(
  'engine', 'engine', 'Yanmar', '3YM30',
  'Modern three-cylinder heat-exchanger inboard / saildrive',
  ARRAY['3YM20 (21 hp sibling)', '3YM30C saildrive'],
  '{"hp": 29}'::jsonb,
  '[{"title": "YM Series Operation Manual", "url": "https://www.yanmar.com/media/global/com/product/marinepleasure/sailBoatPropulsion/operationmanual/0AYMM-EN0023_English.pdf"}, {"title": "Service Manual", "url": "https://j109.org/docs/yanmar_3ym-2ym-service-manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar YM Series Parts", "url": "https://parts4engines.com/collections/yanmar-ym-series"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=yanmar+3ym30"}]'::jsonb,
  true, null
),

-- 5. Yanmar 3JH5E
(
  'engine', 'engine', 'Yanmar', '3JH5E',
  'Three-cylinder common-rail / heat-exchanger inboard / saildrive',
  ARRAY['3JH40 (40 hp CR update)'],
  '{"hp": 39}'::jsonb,
  '[{"title": "JH Series Operation Manual", "url": "https://www.yanmar.com/marine/wp-content/uploads/2020/05/Operation-Manual_4JH3DTE-49961-202851.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar JH Series Parts", "url": "https://parts4engines.com/collections/yanmar-jh-series"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=yanmar+3jh5"}]'::jsonb,
  true, null
),

-- 6. Yanmar 4JH5E
(
  'engine', 'engine', 'Yanmar', '4JH5E',
  'Four-cylinder heat-exchanger inboard / saildrive',
  ARRAY['4JH57', '4JH-CR series'],
  '{"hp": 54}'::jsonb,
  '[{"title": "JH Series Operation Manual", "url": "https://www.yanmar.com/marine/wp-content/uploads/2020/05/Operation-Manual_4JH3DTE-49961-202851.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar JH Series Parts", "url": "https://parts4engines.com/collections/yanmar-jh-series"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=yanmar+4jh"}]'::jsonb,
  true, null
),

-- 7. Yanmar 3JH40
(
  'engine', 'engine', 'Yanmar', '3JH40',
  'Modern common-rail three-cylinder',
  ARRAY['Saildrive & shaft versions'],
  '{"hp": 40}'::jsonb,
  '[{"title": "Yanmar JH-CR Manuals", "url": "https://www.yanmar.com/marine/service/"}]'::jsonb,
  '[{"region": "global", "title": "Yanmar JH Series Parts", "url": "https://parts4engines.com/collections/yanmar-jh-series"}, {"region": "global", "title": "Yanmar Dealer Locator", "url": "https://www.yanmar.com/marine/dealer-locator/"}]'::jsonb,
  true, null
),

-- 8. Volvo Penta D1-13
(
  'engine', 'engine', 'Volvo Penta', 'D1-13',
  'Twin-cylinder heat-exchanger inboard / saildrive',
  ARRAY['D1-13B/F'],
  '{"hp": 12}'::jsonb,
  '[{"title": "D1-13/20/30 & D2-40 Operators Manual", "url": "https://j109.org/docs/volvo_d1-30_operators_manual.pdf"}, {"title": "Official Volvo Penta Publications", "url": "https://pubs.volvopenta.com/publications/"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d1-13"}]'::jsonb,
  true, null
),

-- 9. Volvo Penta D1-20
(
  'engine', 'engine', 'Volvo Penta', 'D1-20',
  'Three-cylinder heat-exchanger inboard / saildrive',
  ARRAY['D1-20B/F'],
  '{"hp": 18}'::jsonb,
  '[{"title": "D1-13/20/30 & D2-40 Operators Manual", "url": "https://j109.org/docs/volvo_d1-30_operators_manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d1-20"}]'::jsonb,
  true, null
),

-- 10. Volvo Penta D1-30
(
  'engine', 'engine', 'Volvo Penta', 'D1-30',
  'Three-cylinder heat-exchanger / saildrive',
  ARRAY['D1-30B/F'],
  '{"hp": 27}'::jsonb,
  '[{"title": "D1-13/20/30 Operators Manual", "url": "https://j109.org/docs/volvo_d1-30_operators_manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d1-30"}]'::jsonb,
  true, null
),

-- 11. Volvo Penta D2-40
(
  'engine', 'engine', 'Volvo Penta', 'D2-40',
  'Four-cylinder heat-exchanger / saildrive',
  ARRAY['D2-40B/F'],
  '{"hp": 37}'::jsonb,
  '[{"title": "D1/D2 Operators Manual", "url": "https://j109.org/docs/volvo_d1-30_operators_manual.pdf"}, {"title": "D1/D2 Service Manual", "url": "https://sailing.mit.edu/wikiupload/d/de/Engine_service_manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d2-40"}]'::jsonb,
  true, null
),

-- 12. Volvo Penta MD2030
(
  'engine', 'engine', 'Volvo Penta', 'MD2030',
  'Older three-cylinder (very common on 1980s-2000s boats)',
  ARRAY['MD2020', 'MD2040 siblings'],
  '{"hp": 29}'::jsonb,
  '[{"title": "Volvo Penta MD Series Manuals", "url": "https://pubs.volvopenta.com/"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+md2030"}]'::jsonb,
  true, null
),

-- 13. Beta Marine Beta 25
(
  'engine', 'engine', 'Beta Marine', 'Beta 25',
  'Kubota-based three-cylinder heat-exchanger / saildrive',
  ARRAY['Beta 20', 'Beta 30 siblings'],
  '{"hp": 25}'::jsonb,
  '[{"title": "Official Operators Maintenance Manuals", "url": "https://betamarineusa.com/literature-downloads-engines/"}]'::jsonb,
  '[{"region": "global", "title": "Official Beta Parts Store", "url": "https://parts.betamarineusa.com/"}, {"region": "global", "title": "Beta 25/30 Parts", "url": "https://www.betamarinewest.com/online-store/Beta-30-Parts-c29710197"}]'::jsonb,
  true, null
),

-- 14. Beta Marine Beta 30
(
  'engine', 'engine', 'Beta Marine', 'Beta 30',
  'Kubota-based three-cylinder heat-exchanger / saildrive',
  ARRAY['Beta 28', 'Beta 35'],
  '{"hp": 30}'::jsonb,
  '[{"title": "Beta Marine Manuals", "url": "https://betamarineusa.com/literature-downloads-engines/"}, {"title": "Beta 43/50 Range Manual (similar)", "url": "https://www.marinedieselbasics.com/wp-content/uploads/Beta-43-5050.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Official Beta Parts Store", "url": "https://parts.betamarineusa.com/"}, {"region": "global", "title": "Beta 30 Illustrated Parts List", "url": "https://admarineservices.com/wp-content/uploads/2017/02/B30_Spares_List.pdf"}]'::jsonb,
  true, null
),

-- 15. Beta Marine Beta 38
(
  'engine', 'engine', 'Beta Marine', 'Beta 38',
  'Four-cylinder Kubota-based heat-exchanger',
  ARRAY['Beta 43'],
  '{"hp": 38}'::jsonb,
  '[{"title": "Beta Marine Manuals", "url": "https://betamarineusa.com/literature-downloads-engines/"}]'::jsonb,
  '[{"region": "global", "title": "Official Beta Parts Store", "url": "https://parts.betamarineusa.com/"}, {"region": "global", "title": "Beta Marine UK Spares", "url": "https://betamarine.co.uk/spares-support-section/"}]'::jsonb,
  true, null
),

-- 16. Perkins 4.108
(
  'engine', 'engine', 'Perkins', '4.108',
  'Classic four-cylinder (ubiquitous on older boats)',
  ARRAY['4.108M marine'],
  '{"hp": 37}'::jsonb,
  '[{"title": "Perkins 4.108 Workshop Manual", "url": "https://sbo.sailboatowners.com/downloads/Hunter_gen_93327239.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Perkins 4.108M Parts", "url": "https://parts4engines.com/collections/perkins-4-108m-parts"}, {"region": "global", "title": "Trans Atlantic Diesels Cruise Kits", "url": "https://www.tadiesels.com/perkins-4108.html"}]'::jsonb,
  true, null
),

-- 17. Westerbeke 20B Two
(
  'engine', 'engine', 'Westerbeke', '20B Two',
  'Three-cylinder heat-exchanger (common repower)',
  ARRAY['12.5B', '30B siblings'],
  '{"hp": 18}'::jsonb,
  '[{"title": "Westerbeke Operator & Service Manuals", "url": "https://www.westerbeke.com/"}]'::jsonb,
  '[{"region": "global", "title": "Westerbeke Parts", "url": "https://www.westerbeke.com/parts/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=westerbeke+20b"}]'::jsonb,
  true, null
),

-- 18. Universal (Westerbeke) M-25XP
(
  'engine', 'engine', 'Universal (Westerbeke)', 'M-25XP',
  'Kubota-based three-cylinder (very common on US boats)',
  ARRAY['M-25', 'M-35'],
  '{"hp": 26}'::jsonb,
  '[{"title": "Universal / Westerbeke Manuals", "url": "https://www.westerbeke.com/"}]'::jsonb,
  '[{"region": "global", "title": "Westerbeke Parts", "url": "https://www.westerbeke.com/parts/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=universal+m-25"}]'::jsonb,
  true, null
),

-- 19. Nanni N3.30
(
  'engine', 'engine', 'Nanni', 'N3.30',
  'Kubota-based three-cylinder (European popular)',
  ARRAY['N2.10', 'N4.38 etc.'],
  '{"hp": 30}'::jsonb,
  '[{"title": "Nanni Marine Engine Manuals", "url": "https://marine-diesel-engine-manuals.com/"}]'::jsonb,
  '[{"region": "global", "title": "Nanni Dealer Locator", "url": "https://www.nanni.com/en/"}]'::jsonb,
  true, null
),

-- 20. Sole Mini-33
(
  'engine', 'engine', 'Sole', 'Mini-33',
  'Modern compact diesel (popular on smaller yachts)',
  ARRAY['Sole Mini series'],
  '{"hp": 33}'::jsonb,
  '[{"title": "Sole Diesel Official Manuals", "url": "https://www.solediesel.com/"}]'::jsonb,
  '[{"region": "global", "title": "Sole Diesel Spare Parts", "url": "https://www.solediesel.com/en/spare-parts/"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=sole+mini+diesel"}]'::jsonb,
  true, null
),

-- 21. Volvo Penta D2-50
(
  'engine', 'engine', 'Volvo Penta', 'D2-50',
  'Four-cylinder naturally aspirated heat-exchanger inboard / saildrive',
  ARRAY['D2-50F (flange/shaft focus)', 'D2-50 with 130S saildrive'],
  '{"hp": 50}'::jsonb,
  '[{"title": "Official D2 Product Page", "url": "https://www.volvopenta.com/en-us/marine/all-marine-engines/d2"}, {"title": "D2-50 Product Leaflet PDF", "url": "https://pubs.volvopenta.com/ProdDocs/Home/Disclaimer?publication=47710130&lang=en-US"}, {"title": "D1/D2 Series Service Manual", "url": "https://sailing.mit.edu/wikiupload/d/de/Engine_service_manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Parts4Engines D2 Series Kits", "url": "https://parts4engines.com/collections/volvo-penta-d2-40-d2-50f-d2-55-d2-60f-d2-75"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d2-50"}]'::jsonb,
  true, null
),

-- 22. Volvo Penta D2-55
(
  'engine', 'engine', 'Volvo Penta', 'D2-55',
  'Four-cylinder naturally aspirated heat-exchanger inboard / saildrive (older model, phased out ~2010s)',
  ARRAY['D2-55 A/B/C (generational updates)', 'D2-55 with MS25/HS25 gearbox or 130S saildrive'],
  '{"hp": 55}'::jsonb,
  '[{"title": "D1/D2 Service Manual (covers D2-55)", "url": "https://sailing.mit.edu/wikiupload/d/de/Engine_service_manual.pdf"}, {"title": "Volvo D2-55 Brochure", "url": "https://www.tadiesels.com/releases/Volvo%20D2-55%20Brochure.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Parts4Engines D2-55 Parts", "url": "https://parts4engines.com/collections/volvo-penta-d2-55-parts"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d2-55"}]'::jsonb,
  true, null
),

-- 23. Volvo Penta D2-60
(
  'engine', 'engine', 'Volvo Penta', 'D2-60',
  'Four-cylinder turbocharged with charge air cooler heat-exchanger inboard / saildrive',
  ARRAY['D2-60F', 'D2-60 with 150S saildrive'],
  '{"hp": 60}'::jsonb,
  '[{"title": "Current D2 Series Page", "url": "https://www.volvopenta.com/en-us/marine/all-marine-engines/d2"}, {"title": "Volvo Penta Publications Portal", "url": "https://pubs.volvopenta.com/"}, {"title": "D1/D2 Series Manual", "url": "https://sailing.mit.edu/wikiupload/d/de/Engine_service_manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Parts4Engines D2 Series", "url": "https://parts4engines.com/collections/volvo-penta-d2-40-d2-50f-d2-55-d2-60f-d2-75"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d2-60"}]'::jsonb,
  true, null
),

-- 24. Volvo Penta D2-75
(
  'engine', 'engine', 'Volvo Penta', 'D2-75',
  'Four-cylinder turbocharged with charge air cooler heat-exchanger inboard / saildrive',
  ARRAY['D2-75F', 'D2-75 with 150S saildrive'],
  '{"hp": 75}'::jsonb,
  '[{"title": "Official D2 Page (covers D2-75)", "url": "https://www.volvopenta.com/en-us/marine/all-marine-engines/d2"}, {"title": "D2-75 Technical Data PDF", "url": "https://main2.likipevpreseller.com/wp-content/uploads/sites/40/2016/04/english_D2-75.pdf"}, {"title": "D1/D2 Service Manual", "url": "https://sailing.mit.edu/wikiupload/d/de/Engine_service_manual.pdf"}]'::jsonb,
  '[{"region": "global", "title": "Volvo Penta Parts & Service", "url": "https://www.volvopenta.com/en-us/parts-service/"}, {"region": "global", "title": "Parts4Engines D2 Series", "url": "https://parts4engines.com/collections/volvo-penta-d2-40-d2-50f-d2-55-d2-60f-d2-75"}, {"region": "global", "title": "Defender Marine", "url": "https://www.defender.com/search?keywords=volvo+d2-75"}]'::jsonb,
  true, null
)

on conflict (manufacturer, model) do nothing;
