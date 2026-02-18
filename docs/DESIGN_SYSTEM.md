# Design System Documentation

**Status**: Foundation Phase (TASK-118.02)
**Last Updated**: 2026-02-18
**Reference**: TASK-118 - UI/UX Consistency, Design System, and Component Refactoring

## Overview

This document defines the design system foundation for the Find My Crew application. It establishes centralized design tokens, component patterns, and guidelines to ensure consistency across the entire application.

## Design Tokens

All design tokens are defined in `app/lib/designTokens.ts` and should be imported and used throughout the application instead of hardcoded values.

### Colors

#### Feedback/Issue Types

Used for feedback badges and status indicators:

- **Bug**: `#dc2626` (red)
- **Feature**: `#a855f7` (purple)
- **Improvement**: `#3b82f6` (blue)
- **Other**: `#6b7280` (gray)

**Usage**:
```typescript
import { COLOR_TOKENS, getFeedbackColorClasses } from '@/app/lib/designTokens';

const bugColor = getFeedbackColorClasses('bug');
// Returns: { light: 'bg-red-100 text-red-800', dark: '...', badge: '...' }
```

#### Risk Level Colors

Used for sailing experience classification:

- **Coastal sailing**: Green (`#10b981`)
- **Offshore sailing**: Blue (`#3b82f6`)
- **Extreme sailing**: Red (`#ef4444`)

**Usage**:
```typescript
import { getRiskLevelColorClasses } from '@/app/lib/designTokens';

const color = getRiskLevelColorClasses('offshore sailing');
// Returns: { name: 'Offshore sailing', badge: 'bg-blue-100 ...', tailwind: 'bg-blue-100' }
```

#### Match Score Colors

Used to indicate compatibility percentage:

| Score Range | Color | Label |
|---|---|---|
| 80%+ | Green | Excellent Match |
| 50-79% | Yellow | Good Match |
| 25-49% | Orange | Moderate Match |
| <25% | Red | Poor Match |

**Usage**:
```typescript
import { getMatchScoreColor } from '@/app/lib/designTokens';

const scoreInfo = getMatchScoreColor(72);
// Returns: { threshold: 50, badge: 'bg-yellow-300/80 ...', label: 'Good Match' }
```

#### Status Colors

Used for registration and general status indicators:

- **Pending**: `#eab308` (yellow)
- **Approved**: `#22c55e` (green)
- **Not Approved**: `#ef4444` (red)
- **Cancelled**: `#6b7280` (gray)

### Z-Index Scale

Centralized z-index management prevents stacking conflicts and establishes clear layering hierarchy.

```typescript
import { Z_INDEX } from '@/app/lib/designTokens';

// Examples:
Z_INDEX.dropdown      // 10  - dropdowns, popovers
Z_INDEX.sticky        // 20  - sticky navigation
Z_INDEX.modal         // 50  - standard dialogs
Z_INDEX.header        // 100 - main navigation
Z_INDEX.sidebar       // 110 - side panels (filters, notifications)
Z_INDEX.toast         // 120 - notifications/toasts
```

**Z-Index Guidelines**:
- Use semantic names instead of arbitrary values
- Keep backdrops one level below their content (e.g., modal at 50, backdrop at 40)
- Never use z-index > 121 except in true emergency cases

### Typography

Standard typography scale based on Tailwind defaults:

```typescript
import { TYPOGRAPHY } from '@/app/lib/designTokens';

// Headings
TYPOGRAPHY.h1 // text-2xl md:text-3xl font-bold
TYPOGRAPHY.h2 // text-xl md:text-2xl font-bold
TYPOGRAPHY.h3 // text-lg md:text-xl font-semibold

// Body
TYPOGRAPHY.body      // text-base
TYPOGRAPHY.bodySm    // text-sm
TYPOGRAPHY.bodyXs    // text-xs
```

### Spacing

4px-based spacing grid ensures consistent visual rhythm:

```typescript
import { SPACING } from '@/app/lib/designTokens';

// Padding/Margin shortcuts
SPACING.xs  // p-1  (4px)
SPACING.sm  // p-2  (8px)
SPACING.md  // p-3  (12px)
SPACING.lg  // p-4  (16px)

// Gap (flexbox)
SPACING.gap.sm  // gap-2  (8px)
SPACING.gap.md  // gap-3  (12px)
SPACING.gap.lg  // gap-4  (16px)

// Section spacing
SPACING.sectionGap    // gap-4 (between major sections)
SPACING.subsectionGap // gap-2 (between subsections)
SPACING.itemGap       // gap-1 (between items)
```

**Touch Target Minimum**:
```typescript
SPACING.touchTarget // min-h-[44px] min-w-[44px]
// Apply to all interactive elements for accessibility
```

## Component Sizing

Consistent sizing for common components:

```typescript
import { COMPONENT_SIZES } from '@/app/lib/designTokens';

// Buttons
COMPONENT_SIZES.button.sm
COMPONENT_SIZES.button.md
COMPONENT_SIZES.button.lg
COMPONENT_SIZES.button.touchTarget

// Inputs
COMPONENT_SIZES.input.default
COMPONENT_SIZES.input.touchTarget

// Badges
COMPONENT_SIZES.badge.sm
COMPONENT_SIZES.badge.md
COMPONENT_SIZES.badge.lg

// Avatars
COMPONENT_SIZES.avatar.xs   // w-6 h-6
COMPONENT_SIZES.avatar.sm   // w-8 h-8
COMPONENT_SIZES.avatar.md   // w-10 h-10
COMPONENT_SIZES.avatar.lg   // w-12 h-12
```

## Responsive Design

Standard Tailwind breakpoints:

```typescript
import { BREAKPOINTS } from '@/app/lib/designTokens';

BREAKPOINTS.sm   // 640px  - mobile landscape
BREAKPOINTS.md   // 768px  - tablet
BREAKPOINTS.lg   // 1024px - desktop
BREAKPOINTS.xl   // 1280px - large desktop
BREAKPOINTS['2xl'] // 1536px - very large screens
```

**Mobile-First Approach**:
- Start with mobile/default styles
- Use responsive prefixes for larger screens
- Example: `text-sm md:text-base lg:text-lg`

## Accessibility

### Color Contrast

Ensure all text meets WCAG AA standards:

- **Normal text**: 4.5:1 contrast ratio (minimum)
- **Large text** (18pt+): 3:1 contrast ratio (minimum)
- **AAA level**: 7:1 and 4.5:1 respectively

**Validation**:
```typescript
import { ACCESSIBILITY } from '@/app/lib/designTokens';

ACCESSIBILITY.contrastRatios.wcagAANormalText  // 4.5
ACCESSIBILITY.contrastRatios.wcagAALargeText   // 3
```

### Focus Indicators

All interactive elements must have visible focus states:

```typescript
import { ACCESSIBILITY } from '@/app/lib/designTokens';

// Apply to interactive elements
className={`... ${ACCESSIBILITY.focusRing}`}
// Results in: focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
```

### Touch Targets

Minimum 44x44px for mobile:

```typescript
// Apply to buttons, links, and interactive elements
min-h-[44px] min-w-[44px]
```

### ARIA & Semantic HTML

- Use semantic HTML tags (`<button>`, `<nav>`, `<article>`, etc.)
- Add `aria-label` to icon-only buttons
- Use `role` attributes for custom interactive elements
- Link form labels to inputs with `htmlFor`
- Include `aria-expanded` and `aria-haspopup` for dropdowns

## Usage Examples

### Creating a Button

```typescript
import { Z_INDEX, COMPONENT_SIZES, ACCESSIBILITY } from '@/app/lib/designTokens';

function MyButton() {
  return (
    <button
      className={`
        ${COMPONENT_SIZES.button.md}
        bg-primary text-primary-foreground
        rounded-md font-medium
        ${ACCESSIBILITY.focusRing}
        hover:opacity-90 transition-opacity
      `}
      style={{ zIndex: Z_INDEX.dropdown }}
    >
      Click me
    </button>
  );
}
```

### Creating a Status Badge

```typescript
import { COLOR_TOKENS, getRegistrationStatusColor, COMPONENT_SIZES } from '@/app/lib/designTokens';

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colorClass = getRegistrationStatusColor(status);
  return (
    <div className={`${colorClass} ${COMPONENT_SIZES.badge.sm} rounded`}>
      {label}
    </div>
  );
}
```

### Creating a Modal

```typescript
import { Z_INDEX, SPACING } from '@/app/lib/designTokens';

function MyModal() {
  return (
    <div style={{ zIndex: Z_INDEX.modal }}>
      <div style={{ zIndex: Z_INDEX.modalBackdrop }} className="fixed inset-0 bg-black/60" />
      <div style={{ zIndex: Z_INDEX.modal }} className={`fixed inset-0 flex items-center justify-center ${SPACING.px.md}`}>
        <div className={`bg-white rounded-lg ${SPACING.lg}`}>
          {/* Content */}
        </div>
      </div>
    </div>
  );
}
```

## Migration Guide

### Before (Hardcoded)

```typescript
// ❌ Hardcoded color strings
const badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

// ❌ Arbitrary z-index
div style={{ zIndex: 9999 }}

// ❌ Inconsistent spacing
<div className="p-2 gap-3 mt-1">
```

### After (Design Tokens)

```typescript
// ✅ Imported tokens
import { COLOR_TOKENS, Z_INDEX, SPACING } from '@/app/lib/designTokens';

const badgeColor = COLOR_TOKENS.feedback.bug.badge;

// ✅ Semantic z-index
div style={{ zIndex: Z_INDEX.modal }}

// ✅ Consistent spacing
<div className={`${SPACING.sm} ${SPACING.gap.md} ${SPACING.mt.sm}`}>
```

## Next Steps

### Phase 2: Core Components Library (TASK-118.03)
- Build reusable Button, Card, Modal, Input components
- All components use design tokens
- Implement accessibility best practices

### Phase 3: Specialized Components (TASK-118.04)
- Consolidate domain-specific components
- Remove duplicate implementations
- Establish reusable patterns

### Phase 4: Color Refactoring (TASK-118.06)
- Replace all hardcoded colors with tokens
- Update all components to use COLOR_TOKENS
- Ensure consistent theming

### Phase 5: Accessibility Audit (TASK-118.07)
- Test color contrast ratios
- Verify keyboard navigation
- Screen reader testing

### Phase 6: Migration (TASK-118.08)
- Update all pages to use new design tokens
- Remove legacy styling
- Finalize design system

## References

- **Audit Findings**: See TASK-118.01 final summary
- **Design Tokens Source**: `app/lib/designTokens.ts`
- **Tailwind CSS**: https://tailwindcss.com
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
- **Accessibility**: See ACCESSIBILITY section above

## Maintainers

This design system is maintained as part of TASK-118. For questions or updates, reference the backlog tasks and audit findings.
