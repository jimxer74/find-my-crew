# SailSmart Monorepo Architecture

## Overview

SailSmart is organized as a monorepo containing multiple applications and a shared module, enabling code reuse, independent development, and scalable architecture.

## Module Structure

### 1. `shared/` - Platform-Wide Services

Core functionality available to all applications.

#### Subdirectories:
- **`ai/`** - AI integration and services
  - Assistant framework
  - Tool definitions and execution
  - AI configuration and provider setup

- **`auth/`** - Authentication and authorization
  - Auth context and hooks
  - User role management
  - Feature access control

- **`database/`** - Database services
  - Supabase client setup (browser and server)
  - Database helpers and utilities
  - Error response handling

- **`logging/`** - Logging utilities
  - Logger instance
  - Debug and error logging

- **`types/`** - Shared TypeScript types
  - Cost models
  - Experience levels
  - Consent types

- **`ui/`** - Design system components
  - Reusable UI components (Button, Modal, Card, etc.)
  - Design tokens and theming

- **`hooks/`** - Shared React hooks
  - `useProfile` - User profile management
  - `useUserLocation` - Geolocation
  - `useMediaQuery` - Responsive design
  - `useNotifications` - Notifications

- **`contexts/`** - Shared React contexts
  - Theme context
  - Notification context
  - Filter context
  - Consent setup context

- **`utils/`** - Utility functions
  - Skill matching and normalization
  - Geocoding and location services
  - Date formatting
  - Error handling

- **`lib/`** - Platform libraries
  - **`boat-registry/`** - Boat database and registry
  - **`documents/`** - Document vault and management
  - **`feedback/`** - Feedback and review system
  - **`owner/`** - Owner onboarding and sessions
  - **`prospect/`** - Prospect onboarding and sessions

### 2. `crew-matching/` - Crew Matching Application

Crew search and matching specific functionality.

#### Subdirectories:
- **`lib/`**
  - `matching-service.ts` - Crew search and matching algorithms

### 3. `boat-management/` - Future Module Template

Reserved for future boat management application module.

### 4. `app/` - Next.js Application

Main Next.js application structure containing:
- API routes (`app/api/`)
- Pages (`app/crew/`, `app/owner/`, etc.)
- Components (`app/components/`)
- Contexts (`app/contexts/`)
- Lib (`app/lib/` - crew-matching specific utilities)

## Import Guidelines

### Using Path Aliases

All modules support TypeScript path aliases for clean imports:

```typescript
// Shared module imports
import { useAuth } from '@shared/auth';
import { useProfile } from '@shared/hooks';
import { logger } from '@shared/logging';
import { Button } from '@shared/ui';
import { searchMatchingCrew } from '@shared/lib';

// Crew-matching specific imports
import { calculateCrewMatchScore } from '@crew-matching/lib';

// Direct component imports
import { CrewCard } from '@/app/components/crew';
```

### Import Paths by Module

| Module | Path Alias | Usage |
|--------|-----------|-------|
| Shared | `@shared/*` | Platform-wide utilities, types, hooks, UI |
| Crew-Matching | `@crew-matching/*` | Crew search and matching logic |
| Boat-Management | `@boat-management/*` | Future boat management specific code |
| App Root | `@/*` | Application-specific code |
| Relative | `./` or `../` | Within same file or directory tree |

## Module Dependencies

```
app/ ──┐
       ├──> crew-matching/ ──┐
       └──> app/lib/ ────────┼──> shared/
                             │
boat-management/ ───────────┘
```

**Key Rule:** All modules depend on `shared/`, but `shared/` has no external dependencies.

## Creating New Features

### Adding to Shared Module

If creating a new feature used by multiple apps:

1. Create directory in `shared/lib/` or appropriate subdirectory
2. Export types and functions in module's `index.ts`
3. Export from `shared/index.ts` for convenience
4. Use `@shared/*` path alias in imports

Example:
```typescript
// shared/lib/my-feature/service.ts
export async function myFeatureService() { ... }

// shared/lib/my-feature/index.ts
export * from './service';

// shared/lib/index.ts
export * from './my-feature';

// Usage anywhere
import { myFeatureService } from '@shared/lib';
```

### Adding to Crew-Matching Module

If creating crew-matching specific functionality:

1. Create in `crew-matching/lib/`
2. Export from `crew-matching/lib/index.ts`
3. Use `@crew-matching/lib` path alias
4. Or use relative imports within app/

## File Organization Best Practices

### Within Modules
```
module-name/
├── index.ts           # Re-exports public API
├── service.ts         # Main service/business logic
├── types.ts           # TypeScript type definitions
├── utils.ts           # Helper functions
├── hooks/
│   └── useFeature.ts
└── __tests__/
    └── service.test.ts
```

### Naming Conventions
- Files: `camelCase.ts` or `kebab-case.ts`
- Exports: `camelCase` for functions/variables, `PascalCase` for types/components
- Directories: `kebab-case`

## Build Configuration

### TypeScript Path Aliases

Configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@shared/*": ["./shared/*"],
      "@crew-matching/*": ["./crew-matching/*"],
      "@boat-management/*": ["./boat-management/*"]
    }
  }
}
```

### Next.js

- Next.js app router handles routing
- All modules are TypeScript compatible
- Build output includes all modules

## Adding a New Application Module

To create a new module (e.g., `boat-management/`):

1. Create directory structure:
   ```
   boat-management/
   ├── lib/
   ├── components/
   ├── hooks/
   └── index.ts
   ```

2. Create `index.ts` with public exports:
   ```typescript
   export * from './lib';
   ```

3. Update imports to use `@boat-management/*`

4. All shared services automatically available via `@shared/*`

## Common Tasks

### Import a Shared Service
```typescript
import { logger } from '@shared/logging';
import { getSupabaseBrowserClient } from '@shared/database';
import { useAuth } from '@shared/auth';
```

### Create a New Hook in Shared
```typescript
// shared/hooks/useMyHook.ts
export function useMyHook() { ... }

// shared/hooks/index.ts (add export)
export { useMyHook } from './useMyHook';

// Usage in any module
import { useMyHook } from '@shared/hooks';
```

### Access Crew-Matching Specific Code
```typescript
import { calculateCrewMatchScore } from '@crew-matching/lib';
```

### Import App-Specific Components
```typescript
import { CrewCard } from '@/app/components/crew';
import { Header } from '@/app/components';
```

## Troubleshooting

### "Cannot find module" Error

1. Check path alias is correct in `tsconfig.json`
2. Verify file exists at import path
3. Ensure module exports the imported item
4. Check for circular dependencies

### Import Conflicts

If multiple modules export same name:
```typescript
// Use namespace imports
import * as shared from '@shared/lib';
import * as crew from '@crew-matching/lib';

shared.myFunction();
crew.myFunction();
```

### Relative Path Issues

When moving files between modules:
- Update relative imports to use `@shared/*` or `@crew-matching/*`
- Avoid `../` chains that cross module boundaries

## Architecture Principles

1. **Separation of Concerns** - Each module has clear responsibility
2. **DRY (Don't Repeat Yourself)** - Shared code in `shared/` module
3. **One-Way Dependencies** - Apps depend on shared, not vice versa
4. **Scalability** - Easy to add new application modules
5. **Reusability** - Shared services used by multiple apps
6. **Maintainability** - Clear boundaries and module ownership

## Future Enhancements

- [ ] pnpm/npm workspace configuration
- [ ] Module-level testing setup
- [ ] CI/CD pipeline for multi-module builds
- [ ] Shared documentation generation
- [ ] Module dependency visualization
