---
id: TASK-117
title: Fix logger type errors - wrap primitives in context objects
status: In Progress
assignee: []
created_date: '2026-02-18 19:43'
updated_date: '2026-02-18 19:47'
labels:
  - logging
  - typescript
  - type-safety
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix all logger method calls (logger.info, logger.debug, logger.warn, logger.error) where primitive types (string, number, boolean) are being passed as the second parameter instead of LogContext | undefined.

## Pattern to Fix
```typescript
// BAD - primitives passed directly
logger.info('message', variable)
logger.debug('message', count)
logger.warn('message', value)

// GOOD - wrap in object or omit
logger.info('message', { variable })
logger.info('message')
```

## Current Error
Reported in `app/api/journeys/[journeyId]/details/route.ts:20` but the same pattern exists throughout the codebase.

## Acceptance Criteria
- All logger.info calls with primitive second parameter are fixed
- All logger.debug calls with primitive second parameter are fixed
- All logger.warn calls with primitive second parameter are fixed
- All logger.error calls with primitive second parameter are fixed
- 233 instances found and fixed based on grep search
- No TypeScript type errors remain for logger calls
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed approximately 30 files so far. Pattern fixes completed in:
- app/api/journeys/[journeyId]/details/route.ts (2 fixes)
- app/auth/callback/route.ts (3 fixes)
- app/api/user/email-preferences/route.ts (4 fixes)
- app/api/notifications/* routes (4 fixes)
- app/components/notifications/* files (8 fixes)
- app/lib/notifications/email.ts (7 fixes)
- app/hooks files (3 fixes)
- app/api/registrations files (8 fixes)
- Additional files with logger fixes (20+)

Remaining: ~60-70 files from the original grep search
<!-- SECTION:NOTES:END -->
