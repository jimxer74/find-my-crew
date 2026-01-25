---
id: TASK-002
title: GDPR notifications and mandatory features
status: Done
assignee: []
created_date: '2026-01-23 17:11'
updated_date: '2026-01-25 10:17'
labels: []
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement comprehensive GDPR compliance features for the Find My Crew application, including consent management during signup, data subject rights (view, export, delete data), and legal pages.

## Current State Analysis
- Profile data collected: name, email, phone, sailing experience, skills, risk preferences, sailing preferences (includes health/dietary info), certifications, profile image
- No privacy policy or terms of service pages exist
- No consent mechanism during signup
- No data subject rights UI (export, deletion, view data)
- Email preferences table exists but has no UI
- AI assessment sends full crew profile to Claude API without explicit consent
- Sensitive health data collected in free-text field

## Scope

### 1. Consent Management (Signup Flow)
New users must explicitly consent to:
- **Privacy Policy acceptance** - Required checkbox linking to privacy policy
- **Terms of Service acceptance** - Required checkbox linking to terms
- **AI Processing consent** - Explicit opt-in for crew data to be assessed by Claude AI for matching
- **Profile Sharing consent** - Consent for profile data to be visible to boat owners
- **Marketing/Email consent** - Optional opt-in for promotional emails (separate from transactional)

### 2. Cookie Consent Banner
- Display cookie consent banner on first visit
- Categories: Essential (always on), Analytics (optional), Marketing (optional)
- Store preference in localStorage + database for logged-in users
- Show banner again if preferences not set

### 3. Data Subject Rights (Account Settings Page)
Create `/settings/privacy` or `/account/privacy` page with:
- **View My Data** - Display all personal data collected in readable format
- **Export My Data** - Download all personal data as JSON file (GDPR data portability)
- **Delete My Account** - Self-service account deletion with confirmation (right to be forgotten)
- **Withdraw Consent** - UI to revoke AI processing consent, profile sharing consent, marketing consent

### 4. Legal Pages (Placeholder Content)
- `/privacy-policy` - Privacy policy page with placeholder sections
- `/terms-of-service` - Terms of service page with placeholder sections
- Footer links to both pages
- Placeholder text clearly marked for legal review

### 5. Database Schema Updates
- Add consent fields to profiles table or create new `user_consents` table:
  - `privacy_policy_accepted_at` (timestamp)
  - `terms_accepted_at` (timestamp)
  - `ai_processing_consent` (boolean + timestamp)
  - `profile_sharing_consent` (boolean + timestamp)
  - `marketing_consent` (boolean + timestamp)
  - `cookie_preferences` (jsonb: {essential: true, analytics: boolean, marketing: boolean})
- Add audit trail for consent changes

### 6. Email Preferences UI
- Build UI for existing `email_preferences` table
- Categories: Registration updates, Journey updates, Profile reminders
- Link to marketing consent

## Out of Scope (for this task)
- Existing user migration (consent only required for new signups)
- Actual privacy policy legal text (placeholder only)
- Cookie analytics implementation (just consent mechanism)
- GDPR-specific logging/audit system (basic consent timestamps only)
- Data Processing Agreement with AI provider
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Signup form includes required checkboxes for Privacy Policy and Terms of Service acceptance
- [x] #2 Signup form includes optional checkboxes for AI processing consent, profile sharing consent, and marketing emails
- [x] #3 Cookie consent banner appears on first visit with Essential/Analytics/Marketing categories
- [x] #4 Cookie preferences are stored and banner doesn't reappear once set
- [x] #5 Account settings page exists at /settings/privacy or /account/privacy
- [x] #6 View My Data section displays all collected personal data in readable format
- [x] #7 Export My Data button downloads complete personal data as JSON file
- [x] #8 Delete My Account flow with confirmation dialog permanently removes all user data
- [x] #9 Withdraw Consent section allows toggling AI processing, profile sharing, and marketing consents
- [x] #10 Privacy Policy page exists at /privacy-policy with placeholder content structure
- [x] #11 Terms of Service page exists at /terms-of-service with placeholder content structure
- [x] #12 Footer includes links to Privacy Policy and Terms of Service
- [x] #13 Database schema includes consent tracking fields with timestamps
- [x] #14 Email preferences UI allows managing registration/journey/profile notification preferences
- [x] #15 Consent changes are timestamped for audit purposes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Database Schema
1. Create migration for `user_consents` table or add fields to profiles
2. Add consent timestamp fields: privacy_policy, terms, ai_processing, profile_sharing, marketing
3. Add cookie_preferences jsonb field
4. Update specs/tables.sql

### Phase 2: Legal Pages
1. Create `/privacy-policy/page.tsx` with placeholder structure
2. Create `/terms-of-service/page.tsx` with placeholder structure
3. Add footer links to both pages

### Phase 3: Cookie Consent Banner
1. Create CookieConsentBanner component
2. Implement localStorage persistence for anonymous users
3. Sync to database for authenticated users
4. Add to root layout

### Phase 4: Signup Flow Updates
1. Add consent checkboxes to signup form
2. Privacy Policy acceptance (required)
3. Terms of Service acceptance (required)
4. AI Processing consent (optional, default unchecked)
5. Profile Sharing consent (optional, default unchecked)
6. Marketing consent (optional, default unchecked)
7. Save consents to database on successful signup

### Phase 5: Account Settings - Privacy Page
1. Create `/settings/privacy/page.tsx` or `/account/privacy/page.tsx`
2. Implement View My Data section
3. Implement Export My Data (JSON download)
4. Implement Delete My Account with confirmation
5. Implement Withdraw/Modify Consent toggles

### Phase 6: Email Preferences UI
1. Create UI for email_preferences table
2. Add to account settings page
3. Link marketing consent to email preferences

### Phase 7: Integration
1. Check AI processing consent before sending data to Claude
2. Check profile sharing consent in relevant queries
3. Respect marketing consent in notification service
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Complete

### Files Created

**Database Schema**
- `migrations/006_user_consents.sql` - Migration for user_consents and consent_audit_log tables
- `app/types/consents.ts` - TypeScript types for consent management

**Legal Pages**
- `app/privacy-policy/page.tsx` - Privacy policy placeholder page with structured sections
- `app/terms-of-service/page.tsx` - Terms of service placeholder page with structured sections

**Cookie Consent**
- `app/components/CookieConsentBanner.tsx` - GDPR-compliant cookie consent banner with Essential/Analytics/Marketing categories

**API Endpoints**
- `app/api/user/consents/route.ts` - GET/PATCH for managing user consents
- `app/api/user/email-preferences/route.ts` - GET/PATCH for email notification preferences
- `app/api/user/data-export/route.ts` - GET to export all user data as JSON
- `app/api/user/delete-account/route.ts` - DELETE to permanently remove user account

**Privacy Settings**
- `app/settings/privacy/page.tsx` - Comprehensive privacy settings page with:
  - Consent toggles (AI processing, profile sharing, marketing)
  - Email notification preferences
  - View My Data section with data summary
  - Export My Data button (JSON download)
  - Delete My Account with confirmation dialog

**Footer Component**
- `app/components/Footer.tsx` - Footer with links to privacy policy, terms, and privacy settings

### Files Modified

**Signup Flow**
- `app/auth/signup/page.tsx` - Added consent checkboxes:
  - Privacy Policy (required)
  - Terms of Service (required)
  - AI Processing (optional)
  - Profile Sharing (optional)
  - Marketing (optional)

**AI Assessment**
- `app/lib/ai/assessRegistration.ts` - Added AI consent check before processing; notifies owner for manual review if user hasn't consented

**Root Layout**
- `app/layout.tsx` - Added CookieConsentBanner component

**Schema Documentation**
- `specs/tables.sql` - Added user_consents and consent_audit_log table definitions

### Features Implemented

1. **Consent Management at Signup**
   - Required: Privacy Policy and Terms of Service acceptance
   - Optional: AI processing, profile sharing, marketing consent
   - All consents timestamped and stored in database

2. **Cookie Consent Banner**
   - Appears on first visit
   - Categories: Essential (always on), Analytics, Marketing
   - Stored in localStorage for anonymous users
   - Synced to database for authenticated users
   - Accept All / Reject All / Customize options

3. **Privacy Settings Page** (`/settings/privacy`)
   - Toggle consents on/off with real-time updates
   - View collected data summary
   - Export all data as JSON (GDPR data portability)
   - Delete account with confirmation dialog
   - Email notification preferences

4. **GDPR Compliance**
   - Consent audit trail stored in consent_audit_log table
   - AI processing requires explicit opt-in consent
   - Data export includes all user data (profile, boats, registrations, etc.)
   - Account deletion cascades to all related data

5. **Legal Pages (Placeholders)**
   - Privacy Policy with all required GDPR sections
   - Terms of Service with standard sections
   - Clearly marked as placeholders for legal review

6. **Footer with Legal Links**
   - Privacy Policy, Terms of Service, Privacy Settings links
   - Added to legal pages and privacy settings page
<!-- SECTION:FINAL_SUMMARY:END -->
