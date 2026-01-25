---
id: TASK-026
title: Registration approved / denied summary page for crew
status: Done
assignee: []
created_date: '2026-01-25 08:21'
updated_date: '2026-01-25 12:09'
labels: []
dependencies: []
priority: high
ordinal: 500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Crew Registration Summary Modal Implementation
Overview
Create a modal dialog that displays registration summary information for crew members when they click on approval/denial notifications. The modal shows different content based on registration status (approved vs denied).

Components to Create
1. API Endpoint: `/api/registrations/crew/[registrationId]/details/route.ts`
Similar to owner's endpoint but accessible by crew members
Verify the registration belongs to the authenticated crew user
Return same data structure as owner endpoint:
Registration data (status, notes, created_at, ai_match_score, ai_match_reasoning, auto_approved)
Boat and skipper information (from boat owner profile)
Journey and leg information
Journey requirements and crew's answers (optional, for reference)
Waypoints for distance calculation
2. Modal Component: app/components/crew/RegistrationSummaryModal.tsx
Modal dialog component following existing modal patterns (similar to BoatFormModal, JourneyFormModal)
Props: isOpen, onClose, registrationId
Fetch data from new API endpoint
Display different content based on status:
For Approved Registrations:

Status badge (green "Approved")
Auto-approved indicator if applicable
Boat information (name, type, make/model, image)
Skipper information (name, avatar from owner profile)
Journey name and date range
Leg name with waypoints and dates
Leg distance and duration (calculated)
Owner message (from registration.notes)
For Denied Registrations:

Status badge (red "Not approved")
Reason for denial:
Owner message (from registration.notes) if present
AI assessment reasoning (from ai_match_reasoning) if present
Fallback message if neither available
Journey and leg information (for context)
Boat and skipper information (for reference)
Common Elements:

Collapsible sections (similar to owner page)
Journey & Leg section with waypoints
Boat & Skipper section
Responsive design for mobile
Loading and error states
3. Update Notification Service: app/lib/notifications/service.ts
Update notifyRegistrationApproved to include registration_id in metadata
Update notifyRegistrationDenied to include registration_id in metadata
Keep existing link format for backward compatibility, but metadata will be used by modal
4. Update Notification Center: app/components/notifications/NotificationCenter.tsx
Detect REGISTRATION_APPROVED and REGISTRATION_DENIED notification types
Extract registration_id from notification metadata
Open RegistrationSummaryModal instead of navigating to link
Pass registrationId to modal
5. Update Crew Registrations Page: app/crew/registrations/page.tsx (optional enhancement)
Make status badges clickable
Open modal when clicking on approved/denied status badges
This provides an alternative entry point beyond notifications
Technical Details
Data Structure
The API endpoint should return data matching the owner's endpoint structure:

registration: status, notes, timestamps, AI assessment
boat: name, type, make, model, image, speed
journey: name, dates
leg: name, dates, waypoints, distance calculation
owner: profile info (full_name, profile_image_url) from boat.owner_id
requirements and answers: optional, for reference
Authorization
Verify user is crew member (hasCrewRole)
Verify registration belongs to authenticated user (registrations.user_id === current_user.id)
Return 403 if unauthorized
UI Patterns
Follow existing modal patterns (backdrop, close button, responsive)
Use collapsible sections like owner page
Reuse existing components:
SkillsMatchingDisplay (if showing skills)
Risk level icons from getRiskLevelConfig
Experience level icons from getExperienceLevelConfig
Status badges (same styling as owner page)
Distance/Duration Calculation
Reuse calculation logic from owner page:
Haversine formula for distance
Boat speed at 75% efficiency for duration
Files to Create
`app/api/registrations/crew/[registrationId]/details/route.ts` - API endpoint
app/components/crew/RegistrationSummaryModal.tsx - Modal component
Files to Modify
app/lib/notifications/service.ts - Ensure registration_id in metadata
app/components/notifications/NotificationCenter.tsx - Open modal on click
app/crew/registrations/page.tsx - Optional: make badges clickable
Dependencies
Uses existing patterns from `app/owner/registrations/[registrationId]/page.tsx`
Reuses utility functions from app/lib/dateFormat.ts, app/lib/skillUtils.ts
Uses existing components: SkillsMatchingDisplay, risk/experience level configs
<!-- SECTION:DESCRIPTION:END -->
