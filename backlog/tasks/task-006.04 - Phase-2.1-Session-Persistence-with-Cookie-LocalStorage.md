---
id: TASK-006.04
title: 'Phase 2.1: Session Persistence with Cookie + LocalStorage'
status: Done
assignee: []
created_date: '2026-02-08 17:44'
updated_date: '2026-02-09 08:09'
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

**Note: Preferred locations must support for both Departure location and Arrival locations. Also a point to consider is should locations be stored as bounding box coordinates as if those are already available from the first step of conversation or just location texts give by user?

** Note: There should also be a way the user to clear the current status and AI conversation and start over if wanting so. 

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
- [x] #1 Session ID persists in cookie across browser sessions
- [x] #2 Conversation history restored from localStorage
- [x] #3 Gathered preferences restored on return visit
- [x] #4 Welcome back message shown to returning users
- [x] #5 Session expires after 7 days of inactivity
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Created:
- `app/api/prospect/session/route.ts` - API endpoint for HttpOnly cookie session management
  - GET: Returns/creates session ID from cookie
  - DELETE: Clears session cookie

### Updated:
- `app/contexts/ProspectChatContext.tsx`
  - Added cookie-based session initialization
  - Combined cookie (session ID) with localStorage (conversation data)
  - Updated `clearSession` to also clear server cookie and get new session

- `app/components/prospect/ProspectChat.tsx`
  - Added "Start Fresh" button in header when conversation exists
  - Confirmation dialog before clearing

- `app/lib/ai/prospect/types.ts`
  - Added `departureLocations` and `arrivalLocations` to ProspectPreferences

### Installed:
- `@types/uuid` for TypeScript support

### Session Flow:
1. On page load: Fetch session ID from HttpOnly cookie
2. If cookie exists: Check localStorage for matching session data
3. If data matches: Restore conversation/preferences
4. If mismatch: Clear stale localStorage, use new session ID
5. On clear: Delete cookie, clear localStorage, get new session ID
<!-- SECTION:NOTES:END -->
