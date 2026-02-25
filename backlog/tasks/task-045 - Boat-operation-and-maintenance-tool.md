---
id: TASK-045
title: Boat operation and maintenance tool
status: In Progress
assignee: []
created_date: '2026-01-28 13:18'
updated_date: '2026-02-25 16:18'
labels:
  - boat-management
  - MVP
  - monorepo
  - new-module
dependencies:
  - TASK-133
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposal for Sailboat Management Tool
As a sailboat owner, managing maintenance and operations can be overwhelming, especially with the unique demands of marine environments like saltwater corrosion, variable weather, and remote access. This proposal outlines a simple web/mobile-based tool designed for ease of use, focusing on core features to track, schedule, and log key aspects such as engine, rigging, spare parts, and overall boat operations. The tool should be intuitive, with a clean interface (e.g., dashboard home screen), offline capabilities for mobile use at sea, and cloud sync for data backup. It targets individual owners or small crews, avoiding complexity like enterprise integrations.
The goal is to reduce downtime, prevent costly breakdowns, ensure safety compliance, and streamline record-keeping for insurance or resale. We'll structure it around modular sections, with user-friendly features like searchable databases, reminders via email/push notifications, and exportable reports (PDF/CSV). 

Key Design Principles

Simplicity: Minimalist UI with one-tap actions; no steep learning curve.
Mobile-First: Optimized for phones/tablets—quick logs during passages, photo uploads for visual records.
Data Security: User accounts with encrypted storage; optional sharing for co-owners or mechanics.
Customization: Allow users to add custom categories/items.
Cost-Effective: Free basic version; premium for advanced analytics or multi-boat support.
Integrations: Basic ones like calendar sync for reminders; avoid overkill.
Create own folder boat-management for this app in the monorepo

Table of Contents for Tool Features

User Setup and Dashboard
Boat Profile Management
Inventory and Spare Parts Tracking
Maintenance Scheduling and Tasks
Operation Logs and Usage Tracking
Checklists and Procedures
Reminders and Notifications
Reporting and Analytics
Safety and Compliance Features
Additional Utilities and Settings

Below, I detail each section, including what to include, why it's useful, and implementation ideas tailored to sailboat owners' needs (e.g., handling irregular usage, harsh conditions).
1. Users and Accounts
- Use the current user and authentication model and auto providers.

2. Boat Profile Management
- Basic table and data structures are in place, boat data is fetched from external source when created. A local boat_registry database is also available, which will be extended with every new boat added to system

- Data missing: All engine and equipment related, maybe to add generic datamodel for adding boat equipment, with a classification scheme for equipment and modules:  specifics like solar panel setup, watermaker, winches, masts, spars, anchors, electronics, etc.
Why Include?: Centralizes info often scattered in paper files; useful for quick reference during repairs or crew handovers.

- Ideas using AI **Important** These are ideas to further investigate and plan, DO NOT IMPLEMENT these at first.
- AI assessment of the equipment and idenification for example common know issues considering the age, running hours, usage etc. 
- AI image identifcation of equipment and parts, and autogenerate and fill the equipment database / hierarchy without manual typing
- AI autodiscovery of the equipment specs, documentation, instructions, maintenance documents etc. without need to search them manually from web

- Documentation Vault exits, but it is a user specific not per Boat, option is to extend the Document Value metadata to include a boat_id for which particular documet belongs and create boat specific view on Document vault that displayes only documents for the specific boat.  Upload PDFs/photos of manuals, registration, insurance docs; searchable by keyword.

3. Inventory and Spare Parts Tracking

Item Database: Categorize by systems—engine (filters, belts), rigging (shackles, lines), electrical (batteries, fuses), safety (flares, life jackets), galley (provisions).
Tracking Features: Add items with details (quantity, location on boat, purchase date, supplier, cost, expiration if applicable). Barcode/QR scanning or AI image idenfication for quick entry on mobile.
Low Stock Alerts: Set thresholds (e.g., notify when oil filters drop below 2).
Usage Logging: Deduct quantities automatically when used in maintenance tasks.
Why Include?: Prevents running out of critical spares mid-passage; tracks costs for budgeting. Sailboats often have limited storage, so location tracking avoids frantic searches.

4. Maintenance Scheduling and Tasks

Task Library: Pre-built templates for common jobs—engine oil change (every 100 hours), rigging inspection (annually), antifouling (seasonal), winch servicing.
Scheduling: Calendar view; set recurring tasks based on time (e.g., monthly) or usage (e.g., engine hours). Assign to self or others (e.g., mechanic).
Task Details: Step-by-step instructions (editable), required tools/parts, estimated time/cost. Photo/video upload for before/after records.
Completion Logging: Mark as done with notes; auto-link to inventory deductions.
Why Include?: Sailboats degrade quickly without routine care; this ensures nothing slips through, extending boat life and safety.

5. Voyage, Operation Logs and Usage Tracking

Engine Log: Track hours run, fuel consumption, RPM logs; calculate efficiency.
Sail and Rigging Log: Record sail usage (hours per sail), reefing events, line wear; note weather conditions.

Voyage Log: Simple entries for passages—route, duration, weather, conditions,  issues encountered (e.g., "Starboard shroud tension adjusted").

Why Include?: Essential for warranty claims, resale value, and diagnosing issues. Owners often forget to log manually; mobile app makes it easy during watches.

6. Checklists and Procedures

Pre-Departure/Arrival Checklists: Customizable lists—engine start, rigging check, safety gear, provisioning.
Emergency Procedures: Built-in guides for man overboard, fire, flooding; link to user-uploaded handbooks.
Seasonal Prep: Winterizing/de-winterizing checklists for engine, plumbing.
Interactive Features: Tick boxes with timestamps; shareable PDFs for crew.
Why Include?: Reduces human error in high-stakes environments; aligns with safety best practices from the crew handbook perspective.

7. Reminders and Notifications

Automated Alerts: Push/email for due maintenance, expiring parts (e.g., batteries), weather-linked warnings (basic integration with free APIs like OpenWeather).
Customization: Set preferences (e.g., weekly summaries).
Escalation: If ignored, send follow-ups.
Why Include?: Owners aren't always on the boat; reminders prevent neglect, especially for seasonal sailors.

8. Reporting and Analytics

History Views: Filterable logs by date, system, or cost; export reports for taxes/insurance.
Analytics: Basic trends—e.g., fuel efficiency over time, most frequent repairs.
Budget Tracker: Total costs by category; forecast annual expenses.
Why Include?: Provides insights for better planning; valuable for long-term ownership.

9. Safety and Compliance Features

Compliance Tracker: Reminders for certifications (e.g., life raft inspection, radio license renewal).
Incident Reporting: Log accidents/near-misses with details, photos; generate reports for authorities.
Crew Management: Basic sharing—invite crew to view checklists or logs (read-only).
Why Include?: Sailboats involve legal requirements; this ensures adherence, reducing liability.

10. Additional Utilities and Settings

Search and Backup: Global search across all data; auto-backup to cloud.
Community Features (Optional): Forum links or shared templates for common boat models.
Settings: Units (metric/imperial), language, dark mode for night use.
Feedback Loop: In-app suggestions for tool improvements.
Why Include?: Enhances usability; keeps the tool evolving based on user needs.

Implementation Roadmap

MVP (Minimum Viable Product): Start with sections 1-4; launch web version first, then mobile app.
Monetization: Freemium model—basic free, premium for unlimited storage/analytics ($5/month).
Testing: Beta with sailboat owners; focus on offline reliability.
Potential Challenges: Data accuracy (user-input reliant); privacy for shared logs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria (MVP - Sections 1-4)

<!-- SECTION:ACCEPTANCE:BEGIN -->
- [ ] #1 boat-management/ module created in monorepo with proper structure (components/, lib/) importing from @shared/*
- [ ] #2 Equipment data model: boat_equipment table with category/subcategory, JSONB specs, parent_id hierarchy, linked to boats table
- [ ] #3 Document vault extended: boat_id FK added to document_vault, boat-scoped document views and upload working
- [ ] #4 Boat Profile page: displays boat details + linked equipment hierarchy + boat-specific documents from vault
- [ ] #5 Equipment CRUD: owners can add/edit/delete equipment items with category classification, specs, photos, and manual/doc links
- [ ] #6 Inventory tracking: boat_inventory table with quantity, location, purchase date, supplier, cost, expiration; low-stock threshold alerts
- [ ] #7 Maintenance task library: pre-built templates for common sailboat maintenance (engine, rigging, antifouling, winch servicing, etc.)
- [ ] #8 Maintenance scheduling: calendar view, recurring tasks (time-based or usage-based), task assignment, completion logging with notes/photos
- [ ] #9 Maintenance-inventory link: completing a maintenance task auto-deducts linked spare parts from inventory
- [ ] #10 All new tables have RLS policies, GDPR deletion logic updated, and migrations created in /migrations/
<!-- SECTION:ACCEPTANCE:END -->

## Definition of Done
<!-- DOD:BEGIN -->
<!-- SECTION:DOD:BEGIN -->
- [ ] #1 Module builds successfully within monorepo (npm run build passes)
- [ ] #2 All new database tables documented in specs/tables.sql with RLS policies
- [ ] #3 GDPR account deletion updated for new tables (per CLAUDE.md requirement)
- [ ] #4 Responsive UI using shared design system (@shared/ui components)
- [ ] #5 Mobile-friendly interface for on-boat usage
<!-- SECTION:DOD:END -->
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Monorepo Integration (2026-02-25)

#### Module Location

Create `boat-management/` module in monorepo root (template directory already exists).

**Target Structure:**
```
boat-management/
├── components/
│   ├── equipment/       # Equipment CRUD, hierarchy tree view
│   ├── inventory/       # Spare parts tracking UI
│   ├── maintenance/     # Task scheduling, calendar, completion forms
│   └── dashboard/       # Main boat management dashboard
├── lib/
│   ├── equipment-service.ts
│   ├── inventory-service.ts
│   ├── maintenance-service.ts
│   └── types.ts
└── index.ts
```

Pages and API routes live in `app/` (Next.js requirement) but import from `boat-management/`:
```
app/owner/boats/[boatId]/          # Boat profile + equipment
app/owner/boats/[boatId]/inventory # Spare parts
app/owner/boats/[boatId]/maintenance # Maintenance tasks
app/api/boat-management/           # API endpoints
```

#### Shared Infrastructure to Reuse

These modules are ALREADY BUILT in shared/ and must be reused:

| Shared Module | Use in boat-management |
|---|---|
| `@shared/auth` | Authentication, role checks, feature access |
| `@shared/database` | Supabase client/server, error handling |
| `@shared/ui/*` | Button, Modal, Card, Badge, Input, Select, ImageUpload, etc. |
| `@shared/components/vault` | DocumentCard, DocumentUploadModal, SecureDocumentViewer |
| `@shared/components/notifications` | NotificationBell, notification alerts |
| `@shared/components/ai` | AssistantChat (extend for boat management context later) |
| `@shared/lib/boat-registry` | Boat spec lookup and caching service |
| `@shared/lib/documents` | Document types and audit utilities |
| `@shared/lib/notifications` | Notification service for reminders/alerts |
| `@shared/lib/limits` | Rate limiting for API endpoints |
| `@shared/logging` | Structured logging |
| `@shared/ai` | AI service providers (for future AI features) |

#### Existing Database Tables to Leverage

- **boats** - Boat profile with full sailboat specs (LOA, beam, draft, displacement, sail area, performance ratios, images)
- **boat_registry** - External boat model spec cache (sailboatdata.com etc.)
- **document_vault** - Document storage with AI classification (extend with boat_id)
- **document_access_grants** - Shareable document access (reuse for boat docs)
- **profiles** - User profiles (boat owner identity)
- **notifications** - Notification delivery system

---

### Database Schema (New Tables)

#### 1. Equipment Table (`boat_equipment`)

Single table with JSONB specs for flexibility. Parent-child hierarchy via `parent_id`.

```sql
create table if not exists public.boat_equipment (
  id            uuid primary key default gen_random_uuid(),
  boat_id       uuid not null references public.boats(id) on delete cascade,
  parent_id     uuid references public.boat_equipment(id) on delete set null,
  name          text not null,
  category      text not null,     -- engine, rigging, electrical, safety, navigation, plumbing, etc.
  subcategory   text,              -- e.g. for engine: fuel_system, cooling, alternator, gearbox
  manufacturer  text,
  model         text,
  serial_number text,
  year_installed int,
  specs         jsonb default '{}',  -- Flexible: {power_kw, voltage, capacity_liters, running_hours, etc.}
  notes         text,
  images        text[] default '{}',
  status        text default 'active',  -- active, decommissioned, needs_replacement
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- RLS: owner of the boat can CRUD, others read-only if boat is public
```

#### 2. Spare Parts / Inventory (`boat_inventory`)

```sql
create table if not exists public.boat_inventory (
  id            uuid primary key default gen_random_uuid(),
  boat_id       uuid not null references public.boats(id) on delete cascade,
  equipment_id  uuid references public.boat_equipment(id) on delete set null,
  name          text not null,
  category      text not null,
  quantity      int not null default 0,
  min_quantity  int default 0,     -- threshold for low-stock alert
  unit          text,              -- pieces, liters, meters, kg
  location      text,              -- where on boat: engine_room, lazarette, forepeak, etc.
  supplier      text,
  part_number   text,
  cost          numeric,
  currency      text default 'EUR',
  purchase_date date,
  expiry_date   date,              -- for flares, batteries, medical supplies
  notes         text,
  images        text[] default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Alert trigger: when quantity <= min_quantity, create notification
```

#### 3. Maintenance Tasks (`boat_maintenance_tasks`)

Dual-purpose: templates (is_template=true) and scheduled instances.

```sql
create table if not exists public.boat_maintenance_tasks (
  id            uuid primary key default gen_random_uuid(),
  boat_id       uuid not null references public.boats(id) on delete cascade,
  equipment_id  uuid references public.boat_equipment(id) on delete set null,
  title         text not null,
  description   text,
  category      text not null,     -- routine, seasonal, repair, inspection, safety
  priority      text default 'medium',  -- low, medium, high, critical
  status        text default 'pending',  -- pending, in_progress, completed, overdue, skipped
  is_template   boolean default false,
  template_id   uuid references public.boat_maintenance_tasks(id),
  recurrence    jsonb,             -- {type: 'time'|'usage', interval_days: 90, engine_hours: 100}
  due_date      date,
  completed_at  timestamptz,
  completed_by  uuid references auth.users(id),
  assigned_to   uuid references auth.users(id),
  estimated_hours numeric,
  actual_hours  numeric,
  estimated_cost numeric,
  actual_cost   numeric,
  instructions  text,              -- step-by-step guide
  parts_needed  jsonb default '[]',  -- [{inventory_id, quantity}]
  notes         text,
  images_before text[] default '{}',
  images_after  text[] default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

#### 4. Document Vault Extension (migration only)

Add optional boat_id to existing document_vault table:

```sql
alter table public.document_vault
  add column if not exists boat_id uuid references public.boats(id) on delete set null;

create index if not exists idx_document_vault_boat_id
  on public.document_vault(boat_id) where boat_id is not null;
```

This allows: `null boat_id` = personal document, `set boat_id` = boat-specific document.

---

### Equipment Category Taxonomy

```
Engine & Propulsion:  engine, fuel_system, cooling, gearbox, propeller, alternator, exhaust
Rigging & Sails:      mast, boom, standing_rigging, running_rigging, winches, sails, furlers
Electrical:           batteries, solar, wind_generator, shore_power, wiring, inverter, charger
Navigation:           gps, chartplotter, radar, ais, compass, autopilot, instruments
Safety:               life_raft, life_jackets, epirb, flares, fire_extinguishers, jacklines
Plumbing:             freshwater, watermaker, bilge_pumps, heads, holding_tank
Anchoring:            anchors, chain, windlass
Hull & Deck:          hull, keel, rudder, hatches, ports, teak_deck
Electronics:          vhf_radio, ssb, satellite_phone, wifi
Galley:               stove, oven, refrigeration, provisions
Comfort:              heating, ventilation, lighting, cushions
Dinghy & Tender:      dinghy, outboard, davits
```

---

### MVP Implementation Phases

#### Phase 1: Module Setup + Boat Profile Enhancement
- Create boat-management/ module structure in monorepo
- Add boat_equipment table + migration
- Add boat_id to document_vault + migration
- Create Boat Profile page with equipment hierarchy view
- Equipment CRUD (add/edit/delete with category classification)
- Boat-scoped document vault view (filter by boat_id)

#### Phase 2: Inventory + Spare Parts
- Add boat_inventory table + migration
- Inventory list with category filtering and search
- Add/edit spare parts with all tracking details
- Low-stock alerts using @shared/lib/notifications
- Location-on-boat tracking field

#### Phase 3: Maintenance Scheduling
- Add boat_maintenance_tasks table + migration
- Task template library with pre-built common sailboat tasks
- Calendar view for scheduling (due dates, recurring)
- Recurring task support (time-based: every N days; usage-based: every N engine hours)
- Task completion with notes, photos, and inventory deduction

#### Phase 4: Integration + Polish
- Dashboard home screen with status overview (upcoming tasks, low stock, equipment status)
- Maintenance-inventory auto-deduction on task completion
- Notification reminders for due maintenance and low stock
- Mobile-optimized layout for on-boat usage
- Export functionality (PDF/CSV for reports, insurance, resale)

---

### Post-MVP Features (Sections 5-10)

These sections are defined in the Description above but are NOT part of MVP:

- **Section 5**: Voyage/Operation Logs (engine hours, sail usage, voyage entries)
- **Section 6**: Checklists (pre-departure, arrival, emergency, seasonal)
- **Section 7**: Advanced Reminders (weather-linked, escalation)
- **Section 8**: Reporting & Analytics (trends, budget tracking, forecasting)
- **Section 9**: Safety & Compliance (certifications, incident reporting, crew sharing)
- **Section 10**: Utilities (global search, community templates, settings)

---

### AI Features (Future - DO NOT IMPLEMENT in MVP)

These are planned for post-MVP and will leverage @shared/ai infrastructure:

1. **AI equipment identification** from photos (upload photo → auto-fill equipment fields)
2. **AI condition assessment** based on age, running hours, usage patterns
3. **AI auto-discovery** of equipment specs, manuals, and documentation from web
4. **AI maintenance recommendations** based on equipment profile and usage history

## Phase 1 COMPLETE - Equipment Management (2026-02-25)

### ✅ All Phase 1 deliverables completed:

**1. Module Structure & Services**
- boat-management/lib/types.ts - Complete type system with 12 equipment categories
- boat-management/lib/equipment-service.ts - Full CRUD + tree builder
- boat-management/lib/inventory-service.ts - Full CRUD + low-stock alerts
- boat-management/lib/maintenance-service.ts - Full CRUD + templates + recurring tasks
- Migration 049 - All 3 tables with RLS policies

**2. UI Components**
- EquipmentList - Grid layout, category filtering, search, status badges
- EquipmentForm - Full form with category/subcategory selection, validation
- BoatDetailNav - Tab navigation for Equipment/Inventory/Maintenance sections
- Mobile-friendly, uses @shared/ui design system

**3. API Routes (RESTful)**
- GET /api/boats/[boatId]/equipment - List all equipment
- POST /api/boats/[boatId]/equipment - Create equipment  
- GET /api/boats/[boatId]/equipment/[equipmentId] - Get single item
- PUT /api/boats/[boatId]/equipment/[equipmentId] - Update
- DELETE /api/boats/[boatId]/equipment/[equipmentId] - Delete
- All routes include auth checks, boat ownership verification

**4. Pages & Navigation**
- /owner/boats/[boatId]/layout.tsx - Boat detail header + tab nav
- /owner/boats/[boatId]/page.tsx - Equipment management page (default tab)
- /owner/boats/[boatId]/inventory/page.tsx - Placeholder for Phase 2
- /owner/boats/[boatId]/maintenance/page.tsx - Placeholder for Phase 3
- Updated /owner/boats/page.tsx with Manage link to boat detail

**5. Database Updates**
- specs/tables.sql - Complete boat_equipment, boat_inventory, boat_maintenance_tasks definitions with RLS
- GDPR deletion route updated - Clears maintenance user references, handles cascading deletes
- Constraint checks & verification updated for new tables

**6. Build Status**
- ✅ npm run build succeeds
- ✅ All routes properly compiled
- ✅ 82 pages compile without errors
- ✅ No regressions in existing functionality
<!-- SECTION:NOTES:END -->
