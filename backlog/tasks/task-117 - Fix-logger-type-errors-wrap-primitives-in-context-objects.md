---
id: TASK-117
title: Fix logger type errors - wrap primitives in context objects
status: In Progress
assignee: []
created_date: '2026-02-18 19:43'
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
