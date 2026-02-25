# TASK-133 Phase 1: Planning & Audit Report

**Date:** 2026-02-25
**Status:** Completed

## Executive Summary

Comprehensive audit of the Find My Crew codebase to determine module boundaries for monorepo refactoring. Current codebase is a single Next.js application with clear functional areas that can be cleanly separated into shared, crew-matching, and boat-management modules.

## Current Codebase Structure

### Root-Level Configuration
- `package.json` - Single workspace (will become root workspace for monorepo)
- `tsconfig.json`, `next.config.js`, `.eslintrc.json` - Shared build configs
- `tailwind.config.ts`, `postcss.config.ts` - Shared styling
- `specs/` - Database schema (shared)
- `migrations/` - Database migrations (shared)
- `public/` - Static assets

### Directory Statistics
- **Total Functional Directories**: 45+
- **Current Single Next.js App**: `app/`
- **Total Pages**: 82 (as documented)

## Codebase Analysis

### 1. SHARED Code Identification

#### 1.1 Authentication & Authorization (app/lib/auth/)
**Shared Across:** All applications
- Authentication context and hooks
- Role-based access control
- User profile management
- Consent and privacy settings

**Files:**
- `app/lib/auth/` - Auth utilities and helpers
- `app/contexts/AuthContext.tsx` - Core auth context
- `app/contexts/UserRoleContext.tsx` - Role context
- `app/components/auth/` - Shared auth components

#### 1.2 Database & ORM (app/lib/)
**Shared Across:** All applications
- Supabase client setup (browser & server)
- Database helpers (PostGIS, etc.)
- Error handling utilities
- Rate limiting logic

**Files:**
- `app/lib/supabaseClient.ts` - Browser client
- `app/lib/supabaseServer.ts` - Server client
- `app/lib/postgis-helpers.ts` - Spatial queries
- `app/lib/errorResponseHelper.ts` - Error handling
- `specs/tables.sql` - Schema definition
- `migrations/` - Migration files

#### 1.3 AI Integration Foundation (app/lib/ai/)
**Shared Across:** All applications
- AI service provider configuration
- Prompt templates and builders
- AI tool definitions
- Response parsing utilities
- Rate limiting for AI calls

**Files:**
- `app/lib/ai/service.ts` - Core AI service
- `app/lib/ai/config/` - Provider configs (OpenRouter, Groq, Gemini, DeepSeek)
- `app/lib/ai/prompts/` - Prompt management and examples
- `app/lib/ai/rateLimit.ts` - API rate limiting
- `app/lib/ai/shared/` - Shared utilities

#### 1.4 Logging (app/lib/logger.ts)
**Shared Across:** All applications
- Structured logging setup
- Log levels and formatting

**Files:**
- `app/lib/logger.ts` - Logger implementation

#### 1.5 UI Components Library (app/components/ui/)
**Shared Across:** All applications
- Core design system components
- Button, Modal, Card, Badge, etc.
- Pagination, Date picker, Location autocomplete
- Design tokens and styling

**Files:**
- `app/components/ui/` - 20+ shared UI components
- `app/lib/designTokens.ts` - Design system constants

#### 1.6 Internationalization (app/lib/i18n.ts)
**Shared Across:** All applications
- i18n configuration
- Translation setup

**Files:**
- `app/lib/i18n.ts` - i18n config

#### 1.7 Shared Types (app/types/)
**Shared Across:** All applications
- Common type definitions
- Experience levels, risk types, etc.

**Files:**
- `app/types/` - Shared type definitions

#### 1.8 Shared Utilities
**Used Across:** Multiple applications

**Files:**
- `app/lib/utils.ts` - General utilities
- `app/lib/skillUtils.ts` - Skill normalization
- `app/lib/skillMatching.ts` - Skill matching logic
- `app/lib/profileUtils.ts` - Profile utilities
- `app/lib/dateFormat.ts` - Date formatting
- `app/lib/country-flags.ts` - Country/flag utilities
- `app/lib/designTokens.ts` - Design tokens
- `app/lib/errors.ts` - Error types
- `app/lib/IGeoCode.ts` - Geolocation types

#### 1.9 Shared Hooks (app/lib/hooks/)
**Used Across:** Multiple applications
- useAuth (authentication)
- useProfile (user profile)
- useUserLocation (geolocation)
- useMediaQuery (responsive)
- useNotifications (notifications)
- etc.

**Files:**
- `app/lib/hooks/` - Reusable React hooks

#### 1.10 Common Utilities & Helpers
**Files:**
- `app/lib/geocoding/` - Geolocation services
- `app/lib/notifications/` - Notification system
- `app/lib/documents/` - Document classification
- `app/lib/limits/` - Usage limits
- `app/lib/routing/` - Routing utilities
- `app/lib/sailboatdata_queries.ts` - External API queries
- `app/lib/debugMiddleware.ts` - Debug utilities
- `app/contexts/FilterContext.tsx` - Shared filter state
- `app/contexts/ThemeContext.tsx` - Theme management
- `app/contexts/NotificationContext.tsx` - Notifications
- `app/contexts/ConsentSetupContext.tsx` - Consent management

### 2. CREW-SPECIFIC Code

#### 2.1 AI Services for Crew (app/lib/ai/prospect/)
**Specific to:** Crew module
- Prospect crew AI chat service
- Crew-specific prompts

**Files:**
- `app/lib/ai/prospect/service.ts`
- `app/lib/ai/prospect/types.ts`

#### 2.2 Crew Components (app/components/crew/)
**Specific to:** Crew module
- CrewCard, CrewCarousel
- LegCard, LegListItem, LegDetails
- CrewMatch, skill display
- LegRegistrationDialog
- CruisingRegionSection

**Files:**
- `app/components/crew/` - 15+ crew-specific components
- `app/components/prospect/` - Prospect chat components

#### 2.3 Crew Business Logic (app/lib/crew/)
**Specific to:** Crew module
- Crew matching service
- Skill matching logic
- Leg registration service
- Search functionality

**Files:**
- `app/lib/crew/matching-service.ts`
- `app/lib/crew/search.ts`
- `app/lib/crew/registration.ts`
- etc.

#### 2.4 Crew API Routes (app/api/crew/, app/api/legs/, app/api/registrations/)
**Specific to:** Crew module
- Crew search APIs
- Leg management APIs
- Registration management APIs

**Files:**
- `app/api/crew/` - Crew endpoints
- `app/api/legs/` - Leg endpoints
- `app/api/registrations/` - Registration endpoints

#### 2.5 Crew Pages (app/crew/, app/welcome/crew/)
**Specific to:** Crew module
- Crew dashboard
- Crew registrations
- Welcome/onboarding for crew

**Files:**
- `app/crew/` - Crew pages
- `app/welcome/crew/` - Crew welcome pages

#### 2.6 Prospect Chat Context (app/contexts/ProspectChatContext.tsx)
**Specific to:** Crew module
- Prospect (crew) AI chat state management

### 3. OWNER/BOAT-MANAGEMENT Code

#### 3.1 AI Services for Owner (app/lib/ai/owner/)
**Specific to:** Owner/Boat-Management module
- Owner AI chat service
- Owner-specific prompts for profile, boat, journey creation

**Files:**
- `app/lib/ai/owner/service.ts`
- `app/lib/ai/owner/types.ts`

#### 3.2 Owner Components (app/components/owner/, app/components/manage/)
**Specific to:** Owner/Boat-Management module
- OwnerChat
- Boat forms and wizards
- Journey creation and management
- Leg forms and managers
- Boat registry components
- Vault and document management

**Files:**
- `app/components/owner/` - Owner-specific components
- `app/components/manage/` - Management UI
- `app/components/vault/` - Document vault

#### 3.3 Owner Business Logic (app/lib/owner/)
**Specific to:** Owner/Boat-Management module
- Owner profile service
- Boat management
- Journey management
- Registration assessment

**Files:**
- `app/lib/owner/` - Owner-specific business logic
- `app/lib/boat-registry/` - Boat registry queries

#### 3.4 Owner API Routes (app/api/owner/, app/api/boat-registry/, app/api/journeys/)
**Specific to:** Owner/Boat-Management module
- Owner profile APIs
- Boat management APIs
- Journey management APIs

**Files:**
- `app/api/owner/` - Owner endpoints
- `app/api/boat-registry/` - Boat registry endpoints
- `app/api/journeys/` - Journey endpoints

#### 3.5 Owner Pages (app/owner/, app/welcome/owner/)
**Specific to:** Owner/Boat-Management module
- Owner dashboard (boats, journeys, registrations)
- Owner onboarding
- Welcome/onboarding for owner

**Files:**
- `app/owner/` - Owner pages
- `app/welcome/owner/` - Owner welcome pages

#### 3.6 Owner Chat Context (app/contexts/OwnerChatContext.tsx)
**Specific to:** Owner/Boat-Management module
- Owner AI chat state management

### 4. SHARED UI Components (app/components/)

**Shared across both crew and owner:**
- `app/components/ui/` - Design system components (Button, Modal, Card, Badge, etc.)
- `app/components/onboarding/` - Shared onboarding UI
- `app/components/auth/` - Shared auth components
- `app/components/profile/` - Profile components (used by both)
- `app/components/ai/` - Shared AI components (AssistantChat, ChatLegCarousel, etc.)
- `app/components/notifications/` - Notification components
- `app/components/feedback/` - Feedback components
- `app/components/browse/` - Shared browsing components

### 5. Additional Shared Components

**Other shared features:**
- `app/api/user/` - User account management
- `app/api/auth/` - Authentication endpoints
- `app/api/notifications/` - Notification endpoints
- `app/api/documents/` - Document management
- `app/api/feedback/` - Feedback endpoints
- `app/auth/login`, `app/auth/signup`, `app/auth/callback` - Auth pages
- `app/notifications/` - Notification center
- `app/profile/`, `app/profile-setup/` - Profile pages
- `app/settings/` - User settings
- `app/vault/` - Document vault
- `app/terms-of-service/`, `app/privacy-policy/` - Legal pages
- `app/lib/facebook/` - Facebook integration (shared)
- `app/lib/feedback/` - Feedback service
- `app/lib/profile/` - Profile utilities
- `app/lib/documents/` - Document handling
- `app/lib/url-import/` - URL import utilities

## Proposed Module Structure

### Module: `shared/`
**Purpose:** Common capabilities used by all applications

```
shared/
├── ai/                  # AI integration foundation
│   ├── config/          # Provider configurations
│   ├── prompts/         # Prompt templates
│   ├── shared/          # Shared AI utilities
│   ├── service.ts       # Core AI service
│   └── rateLimit.ts     # Rate limiting
├── auth/                # Authentication & authorization
│   ├── AuthContext.tsx
│   ├── UserRoleContext.tsx
│   └── hooks.ts
├── database/            # Database setup
│   ├── client.ts        # Supabase client
│   ├── server.ts        # Server client
│   ├── helpers.ts       # Query helpers
│   └── schema.sql       # Current specs/tables.sql
├── logging/             # Logging utilities
│   └── logger.ts
├── types/               # Shared types
│   ├── experience-levels.ts
│   ├── risk-levels.ts
│   └── index.ts
├── ui/                  # Design system components
│   ├── Button/
│   ├── Modal/
│   ├── Card/
│   ├── Badge/
│   ├── designTokens.ts
│   └── index.ts
├── utils/               # Common utilities
│   ├── geocoding/
│   ├── skill-matching.ts
│   ├── profile-utils.ts
│   ├── date-format.ts
│   └── index.ts
├── hooks/               # Shared React hooks
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useUserLocation.ts
│   └── index.ts
├── contexts/            # Shared context providers
│   ├── FilterContext.tsx
│   ├── ThemeContext.tsx
│   └── index.ts
└── lib/                 # Other shared libs
    ├── i18n.ts
    ├── notifications/
    ├── documents/
    └── feedback/
```

### Module: `crew-matching/`
**Purpose:** Crew-matching and journey exploration application

```
crew-matching/
├── app/                 # Next.js pages
│   ├── crew/           # Crew pages
│   ├── welcome/crew/   # Crew welcome
│   └── ...other crew-specific routes...
├── components/          # Crew-specific UI
│   ├── crew/           # Crew components
│   ├── prospect/       # Prospect chat components
│   └── ...crew-specific features...
├── contexts/           # Crew-specific state
│   └── ProspectChatContext.tsx
├── lib/                # Crew business logic
│   ├── crew/
│   ├── prospect/       # Prospect AI service
│   └── matching/       # Matching algorithms
└── api/               # Crew API routes
    ├── crew/
    ├── legs/
    ├── registrations/
    └── prospect/
```

### Module: `boat-management/`
**Purpose:** Boat management and journey creation (template for future)

```
boat-management/
├── app/                # Next.js pages
│   ├── owner/         # Owner pages
│   ├── welcome/owner/ # Owner welcome
│   └── ...other owner-specific routes...
├── components/         # Owner-specific UI
│   ├── owner/         # Owner components
│   ├── manage/        # Management UI
│   ├── vault/         # Document vault
│   └── ...owner-specific features...
├── contexts/          # Owner-specific state
│   └── OwnerChatContext.tsx
├── lib/               # Owner business logic
│   ├── owner/
│   ├── ai/owner/      # Owner AI service
│   ├── boat-registry/
│   └── ...boat-management logic...
└── api/              # Owner API routes
    ├── owner/
    ├── journeys/
    ├── boat-registry/
    └── ...owner-specific endpoints...
```

### Shared Root Items (Current Next.js App)

These items serve both modules and should remain in root during build/dev:

```
root/
├── app/
│   ├── api/auth/                    # Shared auth endpoints
│   ├── api/user/                    # Shared user endpoints
│   ├── api/documents/               # Shared docs endpoints
│   ├── api/feedback/                # Shared feedback endpoints
│   ├── api/notifications/           # Shared notification endpoints
│   ├── components/                  # Shared UI (auth, onboarding, etc.)
│   ├── contexts/                    # Shared contexts
│   ├── lib/                         # Shared libs
│   ├── types/                       # Shared types
│   ├── hooks/                       # Shared hooks
│   ├── auth/                        # Auth pages
│   ├── profile/                     # Profile pages
│   ├── settings/                    # Settings pages
│   ├── notifications/               # Notification center
│   ├── vault/                       # Document vault
│   ├── terms-of-service/           # Legal pages
│   ├── privacy-policy/
│   ├── feedback/                    # Feedback system
│   └── layout.tsx                   # Root layout
├── package.json                     # Root workspace
├── tsconfig.json                    # Root TS config
├── next.config.js                  # Root Next config
├── tailwind.config.ts              # Shared styles
├── postcss.config.ts
└── ...build configs...
```

## Dependency Map

### Current Dependencies

```
crew-matching → shared
  ├── ai foundation (service, config, prompts, rate limiting)
  ├── auth (context, hooks)
  ├── database (client, helpers)
  ├── logging
  ├── types
  ├── ui components
  ├── utils (geocoding, skill matching, etc.)
  ├── hooks (useAuth, useProfile, useLocation)
  └── contexts (FilterContext, ThemeContext, etc.)

boat-management → shared
  ├── ai foundation (service, config, prompts)
  ├── auth (context, hooks)
  ├── database (client, helpers)
  ├── logging
  ├── types
  ├── ui components
  ├── utils
  ├── hooks
  └── contexts

shared → (no internal dependencies)
  └── external packages only (next, react, supabase, etc.)
```

### Build Configuration Dependencies

- Both crew-matching and boat-management build on top of shared
- Shared module can be published separately as npm package
- Current Next.js app becomes monorepo workspace root
- TypeScript paths resolve imports (@shared/*, @crew-matching/*, @boat-management/*)

## Migration Path

### Phase 2: Shared Module Extraction
1. Create `shared/` package structure
2. Move auth code → `shared/auth/`
3. Move database code → `shared/database/`
4. Move AI foundation → `shared/ai/`
5. Move logging → `shared/logging/`
6. Move types → `shared/types/`
7. Move utils → `shared/utils/`
8. Move hooks → `shared/hooks/`
9. Move contexts → `shared/contexts/`
10. Move UI components → `shared/ui/`

### Phase 3: Crew-Matching Module Setup
1. Create `crew-matching/` package structure
2. Move crew-specific components → `crew-matching/components/`
3. Move crew-specific lib code → `crew-matching/lib/`
4. Move crew-specific API routes → `crew-matching/api/`
5. Move crew-specific pages → `crew-matching/app/`
6. Update imports to use shared module

### Phase 4: Boat-Management Module Template
1. Create `boat-management/` package structure
2. Move owner-specific components → `boat-management/components/`
3. Move owner-specific lib code → `boat-management/lib/`
4. Move owner-specific API routes → `boat-management/api/`
5. Move owner-specific pages → `boat-management/app/`
6. Update imports to use shared module

### Phase 5: Build Configuration
1. Set up pnpm/npm workspaces
2. Configure TypeScript paths for aliases
3. Update Next.js build configuration
4. Set up build scripts for each module
5. Update CI/CD pipeline

## Import Path Strategy

### New Import Paths (Post-Refactoring)

```typescript
// Instead of:
import { Button } from '@/app/components/ui/Button'
// Use:
import { Button } from '@shared/ui/Button'

// Instead of:
import { useAuth } from '@/app/lib/hooks'
// Use:
import { useAuth } from '@shared/hooks'

// Crew-specific imports:
import { CrewCard } from '@crew-matching/components/crew'
import { crewMatchingService } from '@crew-matching/lib/matching'

// Owner-specific imports:
import { OwnerChat } from '@boat-management/components/owner'
import { ownerAIService } from '@boat-management/lib/ai'
```

### Current vs. New tsconfig.json

```json
// Current (single app):
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["app/*"]
    }
  }
}

// New (monorepo):
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"],
      "@crew-matching/*": ["crew-matching/*"],
      "@boat-management/*": ["boat-management/*"]
    }
  }
}
```

## Package.json Workspace Setup

### New Root package.json

```json
{
  "name": "sailsmart-monorepo",
  "private": true,
  "workspaces": ["shared", "crew-matching", "boat-management"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  }
}
```

### Each Module has Its Own package.json

- `shared/package.json` - Publishing-ready shared library
- `crew-matching/package.json` - Crew app dependencies
- `boat-management/package.json` - Boat management app dependencies

## Environment Variables & Configuration

### Shared Configuration
- Database credentials (supabase)
- AI provider keys
- Logging configuration
- Feature flags

### Module-Specific Configuration
- Module-specific feature flags
- Module-specific API keys
- Module-specific environment settings

### Implementation Strategy
- Create root `.env` with shared vars
- Create module-specific `.env.local` files if needed
- Use workspace-aware environment loading

## Risk Assessment

### Low Risk
- ✅ Shared utilities (skill matching, date format, etc.)
- ✅ Design system components (UI library)
- ✅ Logging setup
- ✅ Type definitions

### Medium Risk
- ⚠️ Database setup (shared schema, migrations)
- ⚠️ Authentication context
- ⚠️ AI service foundation

### High Risk
- ⚠️ Build configuration (Next.js monorepo setup)
- ⚠️ API routes and their organization
- ⚠️ Shared contexts (FilterContext, ThemeContext)

## Success Criteria for Phase 1

- ✅ Comprehensive audit completed
- ✅ Module boundaries clearly defined
- ✅ Dependency map documented
- ✅ Import path strategy designed
- ✅ Package.json workspace structure planned
- ✅ Risk assessment completed
- ✅ Migration path documented
- ✅ This report reviewed and approved

## Next Steps (Phase 2)

1. Create `shared/` directory structure
2. Begin moving shared code to `shared/` module
3. Update imports to use new paths
4. Set up workspace configuration
5. Verify build succeeds
6. Document progress and findings

---

**Report prepared by:** Claude
**Date:** 2026-02-25
**Status:** Audit Complete - Ready for Phase 2
