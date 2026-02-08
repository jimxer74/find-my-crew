---
id: TASK-006.04
title: 'Phase 2.1: Session Persistence with Cookie + LocalStorage'
status: To Do
assignee: []
created_date: '2026-02-08 17:44'
labels:
  - session
  - persistence
  - phase-2
dependencies: []
parent_task_id: TASK-006
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement session persistence for prospect users so they can return and continue their conversation.

**Depends on:** Phase 1 tasks

**Session Management:**
- Generate UUID session ID on first visit
- Store session ID in HttpOnly cookie (7-day expiry)
- Store conversation data in localStorage keyed by session ID

**LocalStorage Schema:**
```typescript
interface ProspectSession {
  sessionId: string;
  createdAt: string;
  lastActiveAt: string;
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  gatheredPreferences: {
    experienceLevel?: number;
    riskLevels?: string[];
    preferredDates?: { start: string; end: string };
    preferredLocations?: string[];
    skills?: string[];
    sailingGoals?: string;
  };
  viewedLegs: string[]; // IDs of legs user clicked on
}
```

**Components:**
- `useProspectSession` hook for session management
- Session restoration on page load
- "Welcome back" message when returning user detected
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Session ID persists in cookie across browser sessions
- [ ] #2 Conversation history restored from localStorage
- [ ] #3 Gathered preferences restored on return visit
- [ ] #4 Welcome back message shown to returning users
- [ ] #5 Session expires after 7 days of inactivity
<!-- AC:END -->
