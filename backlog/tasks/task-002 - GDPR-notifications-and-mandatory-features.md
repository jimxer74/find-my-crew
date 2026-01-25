---
id: TASK-002
title: GDPR notifications and mandatory features
status: To Do
assignee: []
created_date: '2026-01-23 17:11'
updated_date: '2026-01-25 08:46'
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
- [ ] #1 Signup form includes required checkboxes for Privacy Policy and Terms of Service acceptance
- [ ] #2 Signup form includes optional checkboxes for AI processing consent, profile sharing consent, and marketing emails
- [ ] #3 Cookie consent banner appears on first visit with Essential/Analytics/Marketing categories
- [ ] #4 Cookie preferences are stored and banner doesn't reappear once set
- [ ] #5 Account settings page exists at /settings/privacy or /account/privacy
- [ ] #6 View My Data section displays all collected personal data in readable format
- [ ] #7 Export My Data button downloads complete personal data as JSON file
- [ ] #8 Delete My Account flow with confirmation dialog permanently removes all user data
- [ ] #9 Withdraw Consent section allows toggling AI processing, profile sharing, and marketing consents
- [ ] #10 Privacy Policy page exists at /privacy-policy with placeholder content structure
- [ ] #11 Terms of Service page exists at /terms-of-service with placeholder content structure
- [ ] #12 Footer includes links to Privacy Policy and Terms of Service
- [ ] #13 Database schema includes consent tracking fields with timestamps
- [ ] #14 Email preferences UI allows managing registration/journey/profile notification preferences
- [ ] #15 Consent changes are timestamped for audit purposes
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
