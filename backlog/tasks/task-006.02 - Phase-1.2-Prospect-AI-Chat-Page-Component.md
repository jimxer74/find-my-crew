---
id: TASK-006.02
title: 'Phase 1.2: Prospect AI Chat Page & Component'
status: Done
assignee: []
created_date: '2026-02-08 17:43'
updated_date: '2026-02-08 17:57'
labels:
  - ai
  - chat
  - phase-1
dependencies: []
parent_task_id: TASK-006
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a simplified AI chat interface for unauthenticated prospect users.

**Depends on:** TASK-006.01 (New Landing Page)

**New Page:**
- `app/welcome/chat/page.tsx` - Prospect chat page
- Minimal layout: chat component + footer only
- No header, no sidebar

**New Components:**
- `ProspectChat.tsx` - Simplified chat UI based on AssistantChat
- `ProspectChatContext.tsx` - State management for prospect sessions

**Key Differences from AssistantChat:**
- No authentication required
- No conversation history sidebar
- Simplified state (no pending actions UI)
- Different welcome message focused on sailing discovery
- Context-aware suggestions for prospect users

**API Endpoint:**
- `app/api/ai/prospect/chat/route.ts` - Handles prospect chat without auth
- No database writes (conversation stored in localStorage)
- Returns matching legs based on gathered preferences

**AI System Prompt:**
- Focused on discovering user's sailing aspirations
- Gather: experience level, preferred dates, locations, risk tolerance, skills
- Show matching legs early and often using `[[leg:UUID:Name]]` format
- Gently encourage sign-up after showing value
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Prospect can start chat without logging in
- [x] #2 AI responds with relevant sailing questions
- [x] #3 Matching legs displayed as inline clickable badges
- [x] #4 Chat works on mobile and desktop
- [x] #5 Footer with legal links visible
- [x] #6 Back button to return to landing page
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-02-08)

**Files Created:**
- `app/welcome/chat/page.tsx` - Prospect chat page with minimal layout
- `app/components/prospect/ProspectChat.tsx` - Chat UI with inline leg links
- `app/contexts/ProspectChatContext.tsx` - State management with localStorage persistence
- `app/api/ai/prospect/chat/route.ts` - API endpoint (no auth required)
- `app/lib/ai/prospect/types.ts` - TypeScript types
- `app/lib/ai/prospect/service.ts` - AI chat service with leg search tools
- `app/lib/ai/prospect/index.ts` - Module exports

**Key Features:**
- No authentication required
- LocalStorage-based session persistence (7-day expiry)
- Inline leg references: `[[leg:UUID:Name]]` rendered as clickable badges
- Quick suggestion buttons for conversation starters
- Mobile-responsive design
- Back button to landing page
- Footer with legal links

**Type Updates:**
- Added 'prospect-chat' to UseCase in `app/lib/ai/config/index.ts`
- Added 'prospect-chat' to UseCase in `app/lib/ai/prompts/types.ts`
<!-- SECTION:NOTES:END -->
