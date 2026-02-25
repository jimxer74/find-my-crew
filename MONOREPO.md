# Monorepo Structure Documentation

**Last Updated:** 2026-02-25
**Status:** Production Ready
**Build Time:** ~11.8 seconds
**Pages Compiling:** 82/82 ✅

## Overview

This is a modular monorepo architecture with a clear separation of concerns:
- **shared/** - Platform-wide capabilities (used by all modules)
- **app/** - Crew-matching specific implementation (main Next.js app)
- **crew-matching/** - Crew-matching module structure (ready for expansion)

**Core Principle:** One-way dependency flow: `app → shared` (no cross-module dependencies)

---

## Module Structure

### 1. **shared/** - Platform Foundation (150+ files)

Universal code used across all current and future modules.

#### **shared/components/** (35+ components)
Platform-wide UI components and features organized by category:
- **auth/** - ConsentSetupModal, FeatureGate
- **ai/** - AssistantButton, AssistantChat, AssistantSidebar, ChatLegCarousel
- **feedback/** - FeedbackButton, FeedbackCard, FeedbackList, FeedbackModal, etc.
- **notifications/** - NotificationBell, NotificationCenter, ActionModal, etc.
- **vault/** - DocumentCard, DocumentUploadModal, GrantManagementModal, SecureDocumentViewer
- **onboarding/** - OnboardingSteps, OnboardingStickyBar, URLImportModal, etc.
- **owner/** - OwnerChat, CrewSummaryCard, PassportVerificationSection
- **prospect/** - ProspectChat, ProfileExtractionModal
- **profile/** - ProfileCompletionBar, ProfileCreationWizard

#### **shared/lib/** (40+ modules)
Core business logic and services:
- **auth/** - Authentication, roles, feature access
- **database/** - Supabase client setup, database helpers
- **ai/** - AI service providers, prompts, tools, assistant logic
- **logging/** - Structured logging
- **hooks/** - Reusable React hooks
- **contexts/** - Global state contexts
- **types/** - Shared TypeScript types
- **utils/** - General utilities
- **boat-registry/** - Boat database service
- **documents/** - Document types and audit utilities
- **facebook/** - Facebook Graph API integration
- **feedback/** - Feedback/review service
- **notifications/** - Notification service
- **limits/** - Rate limiting
- **routing/** - Redirect helpers
- **url-import/** - URL content detection
- **owner/** - Owner session service
- **prospect/** - Prospect session service
- **profile/** - Profile utilities

#### **shared/ui/** (25+ components)
Design system components: Button, Modal, Card, Badge, Input, Select, etc.

---

### 2. **app/** - Crew-Matching Main Application (82 pages)

The primary Next.js application implementing crew-matching functionality.

#### **app/pages/** (82 pages)
- `/` - Homepage
- `/crew/**` - Crew browsing and dashboard
- `/owner/**` - Owner journey management
- `/assistant/**` - AI assistant
- `/feedback/**` - Feedback system
- `/vault/**` - Document vault
- And more...

#### **app/api/**
API routes for crew-matching features organized by domain.

#### **app/components/**
Crew-matching specific UI components:
- **crew/** - Crew cards, carousels, registration
- **manage/** - Journey/boat management
- **browse/** - Browsing UI
- **registrations/** - Registration management

#### **app/lib/**
Crew-matching specific business logic:
- **crew/** - Crew matching algorithms

---

### 3. **crew-matching/** - Module Template

Minimal structure set up for future expansion with crew-matching specific code.

---

## Import Path Strategy

### Path Aliases (configured in tsconfig.json)

```typescript
// Shared modules
import { Button } from '@shared/ui/Button';
import { getAuth } from '@shared/auth';
import { useAuth } from '@shared/hooks';

// Current app code (relative imports)
import { CrewCard } from '@/app/components/crew/CrewCard';
```

### Import Rules

✅ **Allowed:**
- `app/` → `shared/`
- `app/` → `app/`
- `shared/` → `shared/`

❌ **NOT Allowed:**
- `shared/` → `app/`
- Cross-module dependencies

---

## Adding New Code

### Adding a Shared Component

1. Create in `shared/components/{category}/ComponentName.tsx`
2. Export in `shared/components/{category}/index.ts`
3. Update `shared/components/index.ts` if needed
4. Import as: `import { ComponentName } from '@shared/components/{category}'`

### Adding a Shared Service

1. Create in `shared/lib/{service}/service.ts`
2. Export in `shared/lib/{service}/index.ts`
3. Update `shared/lib/index.ts` if needed
4. Import as: `import { functionName } from '@shared/lib/{service}'`

### Adding Crew-Matching Code

Create in `app/components/`, `app/lib/`, `app/api/`, or `app/pages/` as appropriate.
**Do NOT move to shared** unless it becomes platform-wide.

---

## Build & Deployment

### Commands
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run linter
```

### Build Info
- Framework: Next.js 16+ with Turbopack
- Build Time: ~11.8 seconds
- Pages: 82 total
- Status: All compile successfully ✅

---

## Architecture Principles

### 1. Separation of Concerns
- **Shared:** Platform features, reusable services, design system
- **App:** Crew-matching specific implementation
- **Future Modules:** Independent implementations

### 2. One-Way Dependencies
```
app → shared (always allowed)
shared → app (NEVER allowed)
```

### 3. Module Independence
- Modules don't depend on each other
- Common code lives in shared
- Each module independently deployable

### 4. Clear Interfaces
- Modules export clean, documented interfaces
- Internal details are private
- Public APIs defined in index.ts

### 5. Type Safety
- All shared code fully typed
- No `any` types in public APIs
- Types in `shared/types/`

---

## File Organization

### Naming Conventions
- **Components:** PascalCase (`UserProfile.tsx`)
- **Functions/Utilities:** camelCase (`getUserRoles.ts`)
- **Types:** PascalCase (`User.ts`)
- **Hooks:** camelCase with `use` prefix (`useAuth.ts`)
- **Services:** camelCase with `service` suffix (`authService.ts`)

### Directory Structure
```
feature/
├── index.ts                 # Barrel export
├── ComponentName.tsx        # React components
├── serviceName.ts           # Business logic
├── types.ts                 # Type definitions
└── __tests__/               # Tests
    └── feature.test.ts
```

### Always Export via index.ts
```typescript
export { ComponentName } from './ComponentName';
export { functionName } from './service';
export type { TypeName } from './types';
```

---

## Migration Path for Future Modules

### Adding boat-management Module

1. **Create structure** under `boat-management/`
2. **Import from shared** - never from app
3. **Configure path aliases** in tsconfig.json
4. **Deploy independently** with shared as dependency

---

## Troubleshooting

### Import Not Found
- Check path alias in tsconfig.json
- Verify file and index.ts exports
- Check path case sensitivity

### Circular Dependencies
- Run `npm run build` to see errors
- Ensure one-way: `app → shared`
- Move common code to shared

### Type Errors
- Use `import type` for type-only imports
- Use `export type` in index files
- Check public API definitions

---

## Summary

This monorepo architecture provides:
✅ **Clear separation** - Shared vs crew-matching specific
✅ **Scalability** - Ready for boat-management and future modules
✅ **Type safety** - Full TypeScript with proper exports
✅ **Performance** - Fast builds (~11.8s) and code splitting
✅ **Maintainability** - One-way dependencies, clean interfaces
✅ **Reusability** - Shared platform foundation

**Ready for:** Crew-matching app + future modules + expansion
