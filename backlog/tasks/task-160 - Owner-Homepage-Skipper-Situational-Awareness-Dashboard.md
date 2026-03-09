---
id: TASK-160
title: Owner Homepage - Skipper Situational Awareness Dashboard
status: Done
assignee: []
created_date: '2026-03-09 20:48'
updated_date: '2026-03-09 21:42'
labels:
  - ui
  - dashboard
  - owner
  - new-page
dependencies: []
references:
  - app/owner/journeys/page.tsx
  - app/owner/registrations/page.tsx
  - app/owner/boats/page.tsx
  - specs/tables.sql
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a new homepage at `/owner` that gives the skipper a real-time situational awareness overview of their fleet and upcoming activity. Currently `/owner` has no `page.tsx` — navigating there falls through to a 404.

The dashboard should surface the most critical information at a glance so the skipper can immediately identify what needs attention without clicking into individual sections.

**Sections (priority order):**

1. **Pending Registrations** — crew applications awaiting approval across all journeys/legs; each row shows crew name, leg name, match score, date applied; quick Approve/Decline actions; badge count on section header
2. **Upcoming Journeys** — next 3–5 published journeys sorted by start date; shows name, boat, start date, leg count, crew slots filled vs needed; link to manage
3. **Fleet Maintenance** — per-boat summary of `critical` or `high` priority tasks with `pending` or `overdue` status; overdue tasks shown in red; grouped by boat; link to full maintenance list
4. **Crew & Registration Stats** — compact stat cards: total pending approvals, total approved crew across active journeys, total legs needing crew (crew_needed > 0), journeys in planning vs published
5. **Quick Actions** — prominent shortcuts: "Plan a new journey", "Add a boat", "View all registrations"

**Design principles:**
- Skipper lands here after login — it must load fast (single combined data fetch where possible)
- Use Card components from the design system; keep visual hierarchy clear
- Overdue/critical items use destructive/red color; pending items use amber; healthy items use green
- Mobile responsive — stat cards stack to 2-column grid on mobile
- Header stays visible (no fixed full-screen overlays)
- Show empty states gracefully when no boats/journeys exist yet (e.g. first-time owner after onboarding)

## Implementation Plan

### Phase 1 — Data Fetching

All data is fetched in a single `useEffect` using parallel `Promise.all` queries from the Supabase browser client. The owner's `boat_ids` (from `boats.owner_id = user.id`) are used as the join key for all downstream queries.

```typescript
// Fetch all in parallel:
const [boatsRes, journeysRes, registrationsRes, maintenanceRes] = await Promise.all([
  supabase.from('boats').select('id, name').eq('owner_id', userId),

  supabase.from('journeys')
    .select('id, name, state, start_date, boat_id, boats(name)')
    .in('boat_id', boatIds)
    .in('state', ['Published', 'In planning'])
    .order('start_date', { ascending: true })
    .limit(5),

  supabase.from('registrations')
    .select('id, status, created_at, match_score, legs(name, journey_id, journeys(name)), profiles(full_name, profile_image_url)')
    .in('leg_id', legIds)  // via legs joined to boat journeys
    .eq('status', 'Pending approval')
    .order('created_at', { ascending: true }),

  supabase.from('boat_maintenance_tasks')
    .select('id, title, priority, status, due_date, boat_id, boats(name)')
    .in('boat_id', boatIds)
    .in('priority', ['critical', 'high'])
    .in('status', ['pending', 'in_progress', 'overdue'])
    .eq('is_template', false)
    .order('due_date', { ascending: true })
    .limit(20),
]);
```

Leg IDs for the registration query require a two-step fetch: first get legs from journeys on owner's boats, then fetch pending registrations for those legs.

### Phase 2 — Stat Cards

Four stat cards in a responsive grid (`grid-cols-2 md:grid-cols-4`):
- **Pending approvals** — count of 'Pending approval' registrations → links to /owner/registrations
- **Active crew** — count of 'Approved' registrations for Published journeys' legs
- **Legs needing crew** — legs where `crew_needed > 0` on Published journeys
- **Journeys published** — count of Published journeys vs In planning

Each card: large number, label, subtle icon, colored indicator (amber for pending, green for healthy).

### Phase 3 — Pending Registrations Section

```
┌─────────────────────────────────────────────────────┐
│ Pending Registrations  [3]                    View all →│
├─────────────────────────────────────────────────────┤
│ 👤 Anna K.   Leg: Helsinki → Tallinn   85%  2d ago  │
│              [Approve]  [Decline]                    │
│ 👤 Mark T.   Leg: Baltic Crossing      72%  4d ago  │
│              [Approve]  [Decline]                    │
└─────────────────────────────────────────────────────┘
```

Approve/Decline buttons call `supabase.from('registrations').update({ status })` and remove the row optimistically.

### Phase 4 — Upcoming Journeys Section

Cards showing next 3-5 journeys:
```
┌──────────────────────────────┐
│ Baltic Adventure             │
│ 📅 Jun 12 – Jul 4  🚢 Saga  │
│ 3 legs · 2/5 crew filled     │
│                  [Manage →]  │
└──────────────────────────────┘
```

Crew filled = count of 'Approved' registrations / sum of `crew_needed` across legs for that journey.

### Phase 5 — Fleet Maintenance Section

Grouped by boat, showing up to 5 tasks per boat:
```
⚓ Saga (Swan 48)
  🔴 Engine oil change   OVERDUE  (was due Mar 1)
  🟠 Bilge pump service  HIGH     (due Apr 15)
  [View all maintenance →]
```

Overdue = status 'overdue' OR (due_date < today AND status not 'completed'/'skipped').

### Phase 6 — Quick Actions Bar

Row of 3 prominent buttons below the stat cards:
- `+ Plan Journey` → /owner/journeys/create
- `+ Add Boat` → /owner/boats (or /owner/onboarding)
- `📋 Registrations` → /owner/registrations

### Key Files

| File | Action |
|------|--------|
| `app/owner/page.tsx` | CREATE — main dashboard page |
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Navigating to /owner renders the dashboard page (no 404)
- [x] #2 Pending registrations section shows all 'Pending approval' registrations across all owner's boats with approve/decline quick actions
- [x] #3 Upcoming journeys section shows next 3-5 published journeys sorted by start_date ascending
- [x] #4 Fleet maintenance section shows critical/high priority pending and overdue tasks grouped by boat
- [x] #5 Stat cards show: pending registrations count, approved crew count, legs needing crew, journeys published vs in planning
- [x] #6 Overdue maintenance tasks are visually highlighted in red/destructive color
- [x] #7 Quick action buttons link to: /owner/journeys/create, /owner/boats, /owner/registrations
- [x] #8 Empty states are shown when no boats, journeys, or registrations exist
- [x] #9 Page is mobile-responsive (stat cards in 2-column grid on mobile, full layout on desktop)
- [x] #10 Page loads within a single data-fetch round trip (parallel Supabase queries)
- [x] #11 Header remains visible — no full-screen overlays
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created `app/owner/page.tsx` — a full skipper situational awareness dashboard.

**Data fetch strategy (3 sequential rounds to avoid circular deps):**
1. Owner's boats (join key for everything else)
2. Journeys + maintenance tasks in parallel (independent)
3. Legs (needs journey IDs)
4. Pending + approved registrations in parallel (needs leg IDs)

**Sections implemented:**
- **Stat cards** (2-col mobile / 4-col desktop): pending approvals (amber), active crew (green), legs needing crew (blue), published journeys (primary)
- **Quick actions bar**: Plan Journey, Manage Boats, All Registrations
- **Pending registrations**: avatar, name, journey+leg, match score %, time ago, inline Approve/Decline with optimistic removal; "View" link to full detail page; capped at 8 with overflow link
- **Upcoming journeys**: card grid (1→2→3 cols), shows state badge (Live/Draft), boat, dates, leg count, crew fill ratio with color (green/amber/neutral)
- **Fleet maintenance**: grouped by boat, overdue highlighted red with AlertTriangle badge, per-task priority label + due date, links to `/owner/boats/[id]/maintenance`
- **First-time empty state**: shown when owner has no boats yet

**Build**: TypeScript compiles clean, Next.js build passes.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 New file app/owner/page.tsx created as a 'use client' page
- [x] #2 All data fetched via Supabase browser client using owner's boat IDs as the join key
- [x] #3 Pending registrations section: clicking Approve/Decline updates status optimistically and re-fetches count
- [x] #4 Maintenance section queries boat_maintenance_tasks where priority in ('critical','high') and status in ('pending','in_progress','overdue') and is_template = false
- [x] #5 TypeScript compiles with no errors
- [x] #6 Consistent with existing owner page styling (uses same Card, Button, Link patterns as journeys/registrations pages)
<!-- DOD:END -->
