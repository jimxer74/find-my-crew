# Localization Analysis Summary

## Overview
This document provides a comprehensive analysis of the SailSmart codebase (Next.js application) to identify all UI components, texts, and configurations that are not yet fully localized.

## Project Information
- **Project**: SailSmart - SailSmart
- **Technology Stack**: Next.js 16.1.1, TypeScript, Tailwind CSS, Supabase
- **Current i18n Setup**: next-intl 4.8.1 with English (en) and Finnish (fi) locales
- **Analysis Date**: February 6, 2026

## Current Localization Infrastructure ✅

### What's Already Localized
- Complete i18n configuration with next-intl
- 2,800+ translation keys in both English and Finnish
- Proper locale detection and persistence (cookie + localStorage)
- Server-side and client-side translation utilities
- Comprehensive translation coverage across 16 categories:
  - common, auth, navigation, home, journeys, boats, registrations
  - profile, notifications, assistant, settings, footer, errors, dates
  - metadata, feedback

### i18n Architecture
- `/i18n/config.ts` - Locale definitions
- `/i18n/request.ts` - Server-side configuration
- `/app/lib/i18n.ts` - Utility functions
- `/messages/en.json` & `/messages/fi.json` - Translation files
- Components using `useTranslations()` hook

## Identified Localization Issues ⚠️

### 1. Component-Level Hardcoded Strings

#### CookieConsentBanner Component
**File**: `app/components/CookieConsentBanner.tsx`
**Issues**: All user-facing text is hardcoded (20+ strings)
- "Cookie Preferences", "We use cookies to enhance..."
- "Essential Cookies", "Analytics Cookies", "Marketing Cookies"
- "Accept All", "Reject All", "Customize", "Save Preferences"
- **Impact**: High - Cookie consent is legally required and must be in user's language

#### Auth Components
**Files**: `app/components/LoginModal.tsx`, `app/components/SignupModal.tsx`
**Issues**:
- "Sign in to your account", "Create your account"
- Form labels: "Email address", "Password", "Full Name"
- Placeholders: "you@example.com", "••••••••", "John Doe"
- Buttons: "Signing in...", "Sign in", "Creating account..."
- **Impact**: High - Authentication is critical user flow

#### Header and Navigation
**Files**: `app/components/Header.tsx`, `app/components/NavigationMenu.tsx`
**Issues**:
- "⚠ Beta release**Please read**" (badge text)
- "Menu", "For Skipper", "For Crew", "Appearance"
- **Impact**: Medium - Navigation is frequently used

#### Profile and Wizard Components
**Files**: `app/components/profile/ProfileCreationWizard.tsx`, `app/components/profile/sections/PersonalInfoSection.tsx`
**Issues**:
- "Let's set up your profile. We can use AI to help fill in..."
- "We'll analyze your Facebook posts and interests..."
- "Fetching your Facebook data..."
- "Full Name", "John Doe" (labels and placeholders)
- **Impact**: Medium - Profile setup is important for user onboarding

#### Assistant and AI Components
**File**: `app/components/ai/AssistantChat.tsx`
**Issues**:
- "Register for ${legName}" (title attributes)
- "Register: {legName}" (link text)
- "View ${legName}" (title attributes)
- **Impact**: Medium - AI features are core functionality

### 2. Form and Input Components

#### DateRangePicker Component
**File**: `app/components/ui/DateRangePicker.tsx`
**Issues**:
- Month names array: ['January', 'February', 'March', ...]
- Weekday abbreviations: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
- "Availability", "Select your available date range"
- "Cancel", "Save", "Save and Search"
- **Impact**: High - Date selection is frequently used

#### ImageUpload Component
**File**: `app/components/ui/ImageUpload.tsx`
**Issues**:
- Error messages: "'${file.name}' is not an image file"
- "'${file.name}' is too large (max ${maxSize}MB)"
- "Too many files selected (max ${maxFiles})"
- "Failed to upload ${file.name}: ${uploadError.message}"
- **Impact**: Medium - File uploads are common user interactions

#### RequirementsManager Component
**File**: `app/components/manage/RequirementsManager.tsx`
**Issues**:
- alert() messages: "Please add at least one requirement..."
- "Failed to update approval settings"
- "Question text is required"
- "Multiple choice questions must have at least one option"
- **Impact**: Medium - Admin functionality

### 3. Validation and Error Messages

#### API Routes and Server Code
**Files**: Multiple API route files in `app/api/`
**Issues**: 85+ hardcoded error messages across:
- Authentication errors
- Database errors
- Validation errors
- Network errors
- Permission errors
- Examples: "Unauthorized", "Invalid input", "Internal server error"
- **Impact**: High - Error handling affects user experience

#### Error Handling Utilities
**File**: `app/lib/errors.ts`
**Issues**:
- Generic error messages: "Authentication error. Please sign in again."
- "A database error occurred. Please try again."
- "Invalid input. Please check your data and try again."
- **Impact**: High - Error messages are user-facing

#### Validation Functions
**File**: `app/lib/ai/validation.ts`
**Issues**:
- 20+ validation error messages with placeholders
- "${fieldName} is required", "${fieldName} must be at least 2 characters"
- Date format errors, coordinate validation errors
- **Impact**: High - Validation feedback is critical for forms

### 4. Configuration and Schema Files

#### Database Schema
**File**: `specs/tables.sql`
**Issues**:
- Enum values: 'Pending approval', 'Approved', 'Not approved', 'Cancelled'
- Profile types: 'owner', 'crew'
- Risk levels: 'Coastal sailing', 'Offshore sailing', 'Extreme sailing'
- Journey states: 'In planning', 'Published', 'Archived'
- **Impact**: Medium - Database enums affect UI display

#### Configuration Files
**Files**: Multiple JSON config files in `app/config/`
**Issues**:
- `risk-levels-config.json`: Extensive hardcoded content (~300+ words per level)
- `skills-config.json`: InfoText questions and startingSentence templates
- `cost-models-config.json`: Display names and descriptions
- `experience-levels-config.json`: Descriptions and typicalEquivalents
- **Impact**: High - Configuration drives user interface content

### 5. Security and Configuration Headers

#### Next.js Configuration
**File**: `next.config.ts`
**Issues**:
- Security headers with hardcoded values:
  - "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  - "X-Frame-Options": "DENY"
  - Content-Security-Policy directives
- **Impact**: Low - Security headers are technical configuration

#### Environment Variables (Security Issue)
**File**: `.env.local`
**Issues**:
- **CRITICAL**: API keys and secrets exposed in version control
- NEXT_PUBLIC_SUPABASE_URL, GOOGLE_GEMINI_API_KEY, etc.
- **Impact**: Critical security vulnerability

### 6. Test Files

#### Test Assertions
**Files**: Various `.test.ts` files
**Issues**:
- Test strings that appear in user-facing error messages
- "Not set", "Invalid date" in date formatting tests
- **Impact**: Low - Test files don't affect production UI

## Summary Statistics

### Total Hardcoded Strings Identified: ~200+

#### By Category:
1. **UI Components**: ~70 strings (modals, forms, navigation)
2. **Error Messages**: ~85 strings (API routes, validation, utilities)
3. **Configuration Content**: ~900 lines of hardcoded content
4. **Database Enums**: 26 hardcoded enum values
5. **Security Headers**: 7 hardcoded policy values

#### By Impact Level:
- **High Impact**: ~40 strings (auth, cookies, errors, validation)
- **Medium Impact**: ~120 strings (forms, navigation, configuration)
- **Low Impact**: ~40 strings (test files, security headers)

## Recommendations

### Immediate Actions (High Priority)
1. **Cookie Consent**: Localize all cookie banner text immediately (legal compliance)
2. **Authentication**: Move all auth modal text to translation files
3. **Error Messages**: Create error message translation keys
4. **Form Labels**: Localize all form labels, placeholders, and validation messages
5. **Security**: Remove `.env.local` from version control, use `.env.example`

### Medium Priority
1. **Configuration Files**: Create translated versions of config files
2. **Date Components**: Add month/day translations to DateRangePicker
3. **Navigation**: Localize menu labels and section headers
4. **AI Components**: Localize assistant and AI feature text

### Low Priority
1. **Test Files**: Update test assertions to use translation keys
2. **Security Headers**: Consider dynamic CSP based on environment
3. **Documentation**: Add localization documentation

### Implementation Strategy
1. **Create new translation keys** in `/messages/en.json` and `/messages/fi.json`
2. **Update components** to use `useTranslations()` hook
3. **Add date localization** using JavaScript's Intl.DateTimeFormat
4. **Update configuration** to support multiple languages
5. **Test thoroughly** with both English and Finnish locales

## Files Requiring Updates

### Components (15+ files):
- `app/components/CookieConsentBanner.tsx`
- `app/components/LoginModal.tsx`
- `app/components/SignupModal.tsx`
- `app/components/profile/ProfileCreationWizard.tsx`
- `app/components/ui/DateRangePicker.tsx`
- `app/components/ui/ImageUpload.tsx`
- `app/components/manage/RequirementsManager.tsx`
- And others...

### Configuration (5+ files):
- `specs/tables.sql`
- `app/config/risk-levels-config.json`
- `app/config/skills-config.json`
- `app/config/cost-models-config.json`
- `app/config/experience-levels-config.json`

### Utilities (3+ files):
- `app/lib/errors.ts`
- `app/lib/ai/validation.ts`
- Multiple API route files

## Conclusion

The SailSmart application has a solid i18n foundation with next-intl but has significant gaps in localization coverage. Approximately 200+ hardcoded strings need to be moved to the translation system, with the highest priority being cookie consent, authentication flows, and error handling. The configuration files contain extensive hardcoded content that should also be localized. Addressing these issues will provide a fully localized user experience for both English and Finnish users.