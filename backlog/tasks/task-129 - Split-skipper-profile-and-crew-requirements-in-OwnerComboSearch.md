---
id: TASK-129
title: Split skipper profile and crew requirements in OwnerComboSearch
status: In Progress
assignee: []
created_date: '2026-02-23 14:11'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the plan to split the combined skipperCrewProfiles textarea into separate skipperProfile and crewRequirements fields throughout the stack.

## Files to modify:
1. migrations/045_add_skipper_crew_profiles_to_owner_sessions.sql (NEW)
2. specs/tables.sql
3. app/components/ui/OwnerComboSearchBox.tsx
4. app/page.tsx
5. app/lib/ai/owner/types.ts
6. app/contexts/OwnerChatContext.tsx
7. app/api/owner/session/data/route.ts
8. app/lib/ai/owner/service.ts (minor updates for labeled sections)
9. app/api/ai/owner/trigger-profile-completion/route.ts (pass new fields)
<!-- SECTION:DESCRIPTION:END -->
