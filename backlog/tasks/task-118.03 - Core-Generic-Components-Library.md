---
id: TASK-118.03
title: Core Generic Components Library
status: In Progress
assignee: []
created_date: '2026-02-18 21:10'
updated_date: '2026-02-18 22:08'
labels:
  - Components
  - Core
  - Refactoring
dependencies: []
parent_task_id: TASK-118
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a comprehensive library of reusable, generic UI components that use design tokens and serve as the foundation for the entire application.

## Scope
Build core, domain-agnostic UI components that enforce design system consistency. These components will be used across all pages and domain-specific components throughout the application.

## What This Task Produces
- Button component (all variants)
- Card component
- Input/Form components (text, checkbox, radio, select)
- Modal and Dialog components
- Badge component
- Alert/Toast components
- All components fully typed with TypeScript
- Storybook documentation for each component
- Complete test coverage for each component

## Dependencies
- **Depends on**: TASK-118.02 (Design System Foundation & Token Creation)
- This task uses design tokens and theme configuration created in TASK-118.02

## Key Responsibilities
1. Create Button component with variants: primary, secondary, destructive, ghost, outline
2. Create Card component with options for different layouts
3. Create Input components: text input, checkbox, radio, select dropdown
4. Create Modal/Dialog components with consistent styling
5. Create Badge component for status/label display
6. Create Alert/Toast components for notifications
7. Implement TypeScript types for all components
8. Write Storybook stories for each component variant
9. Create component documentation with usage examples
10. Ensure all components use design tokens (zero hardcoded colors)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Button component created with all required variants (primary, secondary, destructive, ghost, outline) with proper styling and interactions
- [ ] #2 Card component created with consistent styling and composable sections
- [ ] #3 Form components created: text input, checkbox, radio, select dropdown with proper accessibility
- [ ] #4 Modal and Dialog components created with appropriate sizing, positioning, and overlay handling
- [ ] #5 Badge component created for status, labels, and tags
- [ ] #6 Alert/Toast notification components created
- [ ] #7 All components have proper TypeScript types and PropTypes
- [ ] #8 Storybook documentation created for each component showing all variants and usage examples
- [ ] #9 All components use design tokens - no hardcoded colors or spacing values
- [ ] #10 Component accessibility verified (ARIA labels, keyboard navigation, focus states)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan: Core Generic Components Library

### Phase 1: Foundation (Current)
1. Create component directory structure
2. Set up component exports and types
3. Create base component utilities/hooks

### Phase 2: Core Components (Week 1)
1. **Button Component** - All variants (primary, secondary, destructive, ghost, outline)
   - Features: loading state, disabled, size variants, icon support
   - Uses: COMPONENT_SIZES.button, ACCESSIBILITY.focusRing from designTokens
   
2. **Card Component** - Flexible card with composable sections
   - Features: header, body, footer sections, padding options
   - Uses: SPACING constants
   
3. **Input Component** - Text input with validation states
   - Features: label, error message, placeholder, disabled state
   - Uses: COMPONENT_SIZES.input, ACCESSIBILITY

### Phase 3: Form Components (Week 1-2)
1. **Checkbox Component**
2. **Radio Component**
3. **Select/Dropdown Component**
4. **Form Wrapper Component** - Context-based form state management

### Phase 4: Complex Components (Week 2)
1. **Modal/Dialog Component** - Overlay with focus management
   - Uses: Z_INDEX.modal, Z_INDEX.modalBackdrop
   
2. **Badge Component** - Status/label display
   - Uses: COMPONENT_SIZES.badge, COLOR_TOKENS

3. **Alert/Toast Component** - Notification display
   - Uses: Z_INDEX.toast

### Phase 5: Documentation & Testing
1. Create component index/exports
2. Document usage examples
3. Add accessibility testing
4. Set up visual regression tests

### File Structure
```
app/components/ui/
├── Button/
│   ├── Button.tsx
│   ├── Button.types.ts
│   ├── Button.test.tsx
│   └── index.ts
├── Card/
├── Input/
├── Checkbox/
├── Radio/
├── Select/
├── Modal/
├── Badge/
├── Alert/
└── index.ts (barrel export)
```

### Key Principles
- All components use design tokens (ZERO hardcoded colors/spacing)
- Fully typed with TypeScript
- Accessibility-first (ARIA labels, keyboard nav, focus management)
- Consistent with design system
- Reusable and composable
- Error states and loading states supported
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All components tested in browser for visual consistency
- [ ] #2 Storybook builds and displays all component stories
- [ ] #3 Components exported from single entry point for easy importing
<!-- DOD:END -->
