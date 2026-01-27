---
id: TASK-037
title: Waiting indicator component
status: To Do
assignee: []
created_date: '2026-01-27 15:40'
updated_date: '2026-01-27 15:43'
labels:
  - ui
  - component
  - ux
  - accessibility
dependencies: []
references:
  - app/components/ui/WorkingIndicator..tsx
  - app/owner/journeys/propose/page.tsx
  - app/globals.css
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A reusable UI component to display to users when there is a long-running synchronous action ongoing. The component should provide clear visual feedback that a process is in progress, optionally show progress or status messages, and maintain a consistent user experience across the application.

**Use Cases Identified:**
- AI journey generation (generating routes, calculating distances)
- AI registration assessment (evaluating crew qualifications)
- Fetching boat data on initial page load
- Loading journeys list
- Saving complex forms with multiple database operations
- Any API calls that take more than a few seconds

**Current State:**
- Existing `WorkingIndicator` component (`app/components/ui/WorkingIndicator..tsx`) is an image skeleton/shimmer effect, not a general-purpose loading indicator
- Most pages use simple button text changes ("Saving...", "Generating...")
- No consistent overlay or modal-style indicator for blocking operations
- No progress indication or status messages during long operations

**Requirements:**
1. Should be visually distinct and prominent for blocking operations
2. Should support optional progress percentage or indeterminate state
3. Should support optional status/message text that can be updated
4. Should work as both inline (replacing content) and overlay (modal-style) variants
5. Should be accessible (ARIA labels, focus management)
6. Should use existing design system colors and tokens
7. Should be themeable (work with dark/light mode)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Component renders a visible loading indicator with animation (spinner or pulse)
- [ ] #2 Supports customizable message text that can be updated during operation
- [ ] #3 Supports both 'inline' and 'overlay' display modes
- [ ] #4 Supports both 'determinate' (percentage) and 'indeterminate' progress states
- [ ] #5 Uses existing CSS variables and theme tokens for consistent styling
- [ ] #6 Works correctly in both light and dark modes
- [ ] #7 Includes proper ARIA attributes for accessibility (role, aria-busy, aria-label)
- [ ] #8 Component is exported and documented for reuse
- [ ] #9 At least one existing page is updated to use the new component
- [ ] #10 Unit tests cover basic rendering and prop variations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Component Design and Creation (Core)
1. **Rename existing file**: Fix the typo `WorkingIndicator..tsx` → `ImageSkeleton.tsx` (since it's specifically for image loading)
2. **Create new component**: `app/components/ui/WaitingIndicator.tsx`
3. **Design props interface**:
   - `variant`: 'inline' | 'overlay' (default: 'inline')
   - `message`: string (optional status message)
   - `progress`: number | null (0-100 for determinate, null for indeterminate)
   - `size`: 'sm' | 'md' | 'lg' (default: 'md')
   - `className`: string (optional additional classes)

### Phase 2: Core Implementation
1. **Spinner component**: Create animated SVG spinner using Tailwind's `animate-spin`
2. **Inline variant**: Centered spinner with optional message below
3. **Overlay variant**: Fixed/absolute positioned backdrop with centered spinner and message
4. **Progress bar**: Optional linear progress bar for determinate operations
5. **Accessibility**: Add `role="status"`, `aria-busy="true"`, and `aria-label`

### Phase 3: Styling
1. Use existing CSS variables: `--primary`, `--foreground`, `--muted-foreground`, `--background`
2. Add backdrop blur for overlay variant
3. Ensure proper z-index layering
4. Test in both light and dark modes

### Phase 4: Integration
1. Update `app/owner/journeys/propose/page.tsx` to use new component during AI generation
2. Update import in propose page from old `WorkingIndicator.` to new component
3. Consider adding to other long-running operations as optional enhancement

### Phase 5: Testing and Documentation
1. Create unit tests in `app/components/ui/WaitingIndicator.test.tsx`
2. Test: renders with default props
3. Test: renders with custom message
4. Test: renders inline vs overlay variants
5. Test: renders determinate vs indeterminate progress
6. Add JSDoc comments for component and props

### File Changes
- **New**: `app/components/ui/WaitingIndicator.tsx`
- **New**: `app/components/ui/WaitingIndicator.test.tsx`
- **Rename**: `app/components/ui/WorkingIndicator..tsx` → `app/components/ui/ImageSkeleton.tsx`
- **Modify**: `app/owner/journeys/propose/page.tsx` (update import and usage)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Technical Notes

### Component API Design
```typescript
interface WaitingIndicatorProps {
  /** Display variant - inline replaces content, overlay covers parent/screen */
  variant?: 'inline' | 'overlay';
  /** Status message to display */
  message?: string;
  /** Progress percentage (0-100) or null for indeterminate */
  progress?: number | null;
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** For overlay: whether to cover entire screen or just parent */
  fullScreen?: boolean;
}
```

### Spinner Sizes
- sm: 16px (w-4 h-4) - for button loading states
- md: 32px (w-8 h-8) - for section loading
- lg: 48px (w-12 h-12) - for page loading

### Usage Examples
```tsx
// Simple inline usage
<WaitingIndicator message="Generating journey..." />

// Overlay with indeterminate progress
<WaitingIndicator 
  variant="overlay" 
  message="Processing AI assessment..." 
/>

// Determinate progress
<WaitingIndicator 
  message="Uploading images..." 
  progress={uploadProgress} 
/>
```

### Existing Loading Patterns to Preserve
The app currently uses button text changes ("Saving...", "Creating...") which should remain for quick operations. The new WaitingIndicator is for:
- Operations > 2-3 seconds
- Operations where user should wait before interacting
- AI-powered features that take significant time

### Accessibility Requirements
- `role="status"` to announce loading state to screen readers
- `aria-busy="true"` during operation
- `aria-label` describing what's loading
- For overlay: trap focus and prevent background interaction

### Shimmer Animation
Add to globals.css if not present:
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.animate-shimmer {
  animation: shimmer 2s ease-in-out infinite;
}
```
<!-- SECTION:NOTES:END -->
