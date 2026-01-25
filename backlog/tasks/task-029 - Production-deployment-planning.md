---
id: TASK-029
title: Production deployment planning
status: Done
assignee: []
created_date: '2026-01-25 15:31'
updated_date: '2026-01-25 16:47'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Plan and implementation for making Find My Crew ready for pilot production deployment with configurable limits, CI/CD pipeline, and security hardening.

## Architecture (Pilot)

| Component | Technology | Notes |
|-----------|------------|-------|
| Hosting | Vercel Pro | Native Next.js 16 support, edge functions |
| Database | Supabase Pro | Already integrated, PostGIS, Auth, Storage, RLS |
| Monitoring | Vercel Analytics + Sentry | Error tracking and performance |
| Secrets | Vercel Environment Variables | Encrypted at rest |
| Email | Resend (existing) | Already integrated |
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Security headers configured in next.config.ts
- [x] #2 RLS policies added to registrations table
- [x] #3 Rate limiting middleware implemented
- [x] #4 Limits system created with pilot configuration
- [x] #5 GitHub Actions CI/CD workflows created
- [x] #6 Limit checks added to boat/journey creation forms
- [x] #7 AI input validation and sanitization implemented
- [x] #8 Error sanitization utility created
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

### 1. Security Headers (next.config.ts)
- HSTS with 2-year max-age, includeSubDomains, preload
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy for camera, microphone, geolocation
- Content-Security-Policy with directives for Mapbox and Supabase

### 2. RLS Policies for Registrations
Created `migrations/008_registrations_rls.sql` with 7 policies:
- Users can view their own registrations
- Owners can view registrations for their journeys
- Users can create their own registrations
- Users can update their own registrations
- Owners can update registrations for their journeys
- Users can delete their own registrations
- Owners can delete registrations for their journeys

Updated `specs/tables.sql` with the new RLS policies.

### 3. Rate Limiting Middleware
Created `middleware.ts` with configurable rate limits:
- AI endpoints: 10 requests/minute
- Registration endpoints: 20 requests/minute
- General API: 100 requests/minute

Features:
- In-memory store with automatic cleanup
- Proper 429 responses with Retry-After headers
- X-RateLimit-* headers on all responses
- Comments for upgrading to Vercel KV for multi-instance deployments

### 4. Limits System
Created `app/lib/limits/` with:
- `types.ts` - TypeScript types for limits
- `config.ts` - Release type detection and limit values
- `service.ts` - Limit checking functions
- `index.ts` - Centralized exports

Pilot limits:
- maxBoatsPerUser: 1
- maxJourneysPerUser: 2
- maxLegsPerJourney: 10
- maxRegisteredUsers: 50
- maxWaypointsPerLeg: 20
- maxImagesPerBoat: 5

Functions: `canCreateBoat`, `canCreateJourney`, `canCreateLeg`, `canRegisterUser`, `canCreateWaypoint`

### 5. GitHub Actions CI/CD Workflows
Created `.github/workflows/`:

**ci.yml** - Runs on PRs and pushes:
- Lint check
- TypeScript type check
- Vitest tests
- Build verification
- npm security audit

**deploy-staging.yml** - Auto-deploy on main push:
- Deploys to Vercel preview
- Aliases to staging domain

**deploy-production.yml** - Manual with approval:
- Validates semver tag format
- Runs full CI checks
- Creates git tag
- Deploys to Vercel production
- Configurable release type (pilot/beta/production)

### 6. Limit Checks in Forms
Updated `BoatFormModal.tsx` and `JourneyFormModal.tsx`:
- Check limits when modal opens for new item
- Display user-friendly error when limit reached
- Disable submit button when limit exceeded
- Allow editing existing items even at limit

### 7. AI Input Validation
Created `app/lib/ai/validation.ts` with:
- `sanitizeText` - Remove control characters, normalize unicode
- `containsSuspiciousPatterns` - Detect prompt injection attempts
- `validateShortText`, `validateMediumText`, `validateLongText`
- `validateCoordinate`, `validateLocation`, `validateWaypointArray`
- `validateDateString`, `validatePositiveNumber`
- `wrapUserInput` - Safe prompt inclusion

Updated `app/api/ai/generate-journey/route.ts` to use validation.

### 8. Error Sanitization
Created `app/lib/errors.ts` with:
- `sanitizeError` - Log full error, return generic message
- `categorizeError` - Classify errors by type
- `containsSensitiveInfo` - Detect secrets in messages
- `createErrorResponse` - Generate API error response
- `handleApiError` - Wrapper for try-catch blocks

## Files Created
- `middleware.ts`
- `migrations/008_registrations_rls.sql`
- `app/lib/limits/types.ts`
- `app/lib/limits/config.ts`
- `app/lib/limits/service.ts`
- `app/lib/limits/index.ts`
- `app/lib/ai/validation.ts`
- `app/lib/errors.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

## Files Modified
- `next.config.ts` - Security headers
- `specs/tables.sql` - RLS policies for registrations
- `app/components/manage/BoatFormModal.tsx` - Limit checks
- `app/components/manage/JourneyFormModal.tsx` - Limit checks
- `app/api/ai/generate-journey/route.ts` - Input validation

## Manual Steps Required
1. **Rotate API keys** and store in Vercel Environment Variables
2. **Apply migration** 008_registrations_rls.sql to Supabase
3. **Configure GitHub secrets**: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
4. **Set RELEASE_TYPE=pilot** in Vercel environment variables
5. **Optional**: Integrate Sentry for monitoring
<!-- SECTION:FINAL_SUMMARY:END -->
