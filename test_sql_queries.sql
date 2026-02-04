-- Test SQL queries for fetch_all_boats tool

-- Test 1: Owner user query (should return boats owned by the user)
SELECT
  id,
  name,
  type,
  make,
  model,
  capacity,
  home_port,
  country_flag,
  loa_m,
  lwl_m,
  beam_m,
  max_draft_m,
  displcmt_m,
  sail_area_sqm,
  sa_displ_ratio,
  ballast_displ_ratio,
  characteristics,
  capabilities,
  accommodations,
  images
FROM boats
WHERE owner_id = 'owner-user-uuid'
LIMIT 10;

-- Test 2: Crew user query (should return boats with published journeys)
SELECT
  b.id,
  b.name,
  b.type,
  b.make_model,
  b.capacity,
  b.home_port,
  b.country_flag,
  b.loa_m,
  b.lwl_m,
  b.beam_m,
  b.max_draft_m,
  b.displcmt_m,
  b.sail_area_sqm,
  b.sa_displ_ratio,
  b.ballast_displ_ratio,
  b.characteristics,
  b.capabilities,
  b.accommodations,
  b.images,
  COUNT(j.id) as published_journeys_count
FROM boats b
INNER JOIN journeys j ON j.boat_id = b.id
WHERE j.state = 'Published'
GROUP BY b.id, b.name, b.type, b.make_model, b.capacity, b.home_port, b.country_flag, b.loa_m, b.lwl_m, b.beam_m, b.max_draft_m, b.displcmt_m, b.sail_area_sqm, b.sa_displ_ratio, b.ballast_displ_ratio, b.characteristics, b.capabilities, b.accommodations, b.images
LIMIT 10;

-- Test 3: Filter by boat type (for crew user)
SELECT
  b.id,
  b.name,
  b.type,
  b.make_model,
  b.capacity,
  b.home_port,
  b.country_flag,
  b.loa_m,
  b.lwl_m,
  b.beam_m,
  b.max_draft_m,
  b.displcmt_m,
  b.sail_area_sqm,
  b.sa_displ_ratio,
  b.ballast_displ_ratio,
  b.characteristics,
  b.capabilities,
  b.accommodations,
  b.images,
  COUNT(j.id) as published_journeys_count
FROM boats b
INNER JOIN journeys j ON j.boat_id = b.id
WHERE j.state = 'Published'
  AND b.type = 'Coastal cruisers'
GROUP BY b.id, b.name, b.type, b.make_model, b.capacity, b.home_port, b.country_flag, b.loa_m, b.lwl_m, b.beam_m, b.max_draft_m, b.displcmt_m, b.sail_area_sqm, b.sa_displ_ratio, b.ballast_displ_ratio, b.characteristics, b.capabilities, b.accommodations, b.images
LIMIT 5;

-- Test 4: Filter by home port (for crew user)
SELECT
  b.id,
  b.name,
  b.type,
  b.make_model,
  b.capacity,
  b.home_port,
  b.country_flag,
  b.loa_m,
  b.lwl_m,
  b.beam_m,
  b.max_draft_m,
  b.displcmt_m,
  b.sail_area_sqm,
  b.sa_displ_ratio,
  b.ballast_displ_ratio,
  b.characteristics,
  b.capabilities,
  b.accommodations,
  b.images,
  COUNT(j.id) as published_journeys_count
FROM boats b
INNER JOIN journeys j ON j.boat_id = b.id
WHERE j.state = 'Published'
  AND b.home_port ILIKE '%Mediterranean%'
GROUP BY b.id, b.name, b.type, b.make_model, b.capacity, b.home_port, b.country_flag, b.loa_m, b.lwl_m, b.beam_m, b.max_draft_m, b.displcmt_m, b.sail_area_sqm, b.sa_displ_ratio, b.ballast_displ_ratio, b.characteristics, b.capabilities, b.accommodations, b.images
LIMIT 10;

-- Test 5: Check RLS policy compliance
-- This should return all boats for SELECT (as per current policy)
SELECT COUNT(*) FROM boats;

-- Test 6: Check profile roles query
SELECT id, roles FROM profiles WHERE id = 'test-user-id';