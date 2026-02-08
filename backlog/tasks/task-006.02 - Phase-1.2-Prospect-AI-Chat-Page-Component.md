---
id: TASK-006.02
title: 'Phase 1.2: Prospect AI Chat Page & Component'
status: To Do
assignee: []
created_date: '2026-02-08 17:43'
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
- [ ] #1 Prospect can start chat without logging in
- [ ] #2 AI responds with relevant sailing questions
- [ ] #3 Matching legs displayed as inline clickable badges
- [ ] #4 Chat works on mobile and desktop
- [ ] #5 Footer with legal links visible
- [ ] #6 Back button to return to landing page
<!-- AC:END -->
