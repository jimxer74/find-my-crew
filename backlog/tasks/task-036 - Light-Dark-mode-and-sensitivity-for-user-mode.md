---
id: TASK-036
title: Light / Dark mode and sensitivity for user mode
status: To Do
assignee: []
created_date: '2026-01-27 15:10'
updated_date: '2026-01-27 15:13'
labels:
  - ui
  - accessibility
  - mobile
  - theming
dependencies: []
references:
  - app/globals.css
  - app/layout.tsx
  - app/components/NavigationMenu.tsx
  - app/contexts/AuthContext.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement proper dark/light mode support that respects the user's device settings and allows manual override. Currently, the app has CSS variables defined for both modes but lacks the mechanism to detect device preferences and toggle between themes.

## Problem Statement
The mobile version of the app is not readable when the user's device is set to dark mode. The app has dark mode CSS defined (`.dark` class) but no mechanism to:
1. Detect the user's OS/device color scheme preference
2. Apply the correct theme class to the document
3. Allow users to manually override with a preference setting

## Current State
- CSS variables for light/dark modes exist in `globals.css`
- `.dark` class selector defined but never applied
- No theme context or provider
- No theme toggle UI
- No persistence of user preference
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 App automatically detects and respects user's OS/device color scheme preference on first load
- [ ] #2 Dark mode is properly applied - all UI elements are readable with appropriate contrast
- [ ] #3 Light mode remains fully functional with no regressions
- [ ] #4 Users can manually override the automatic theme detection via a settings toggle
- [ ] #5 Theme preference persists across browser sessions (localStorage)
- [ ] #6 Theme preference syncs to user account when logged in (database)
- [ ] #7 No flash of wrong theme on page load (FOUC prevention)
- [ ] #8 Theme toggle is accessible from navigation menu on both mobile and desktop
- [ ] #9 All existing components render correctly in both themes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Theme Context & Provider

**File:** `app/contexts/ThemeContext.tsx`

```typescript
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;           // User's preference (light/dark/system)
  resolvedTheme: 'light' | 'dark';  // Actual applied theme
  setTheme: (theme: Theme) => void;
}
```

**Features:**
- Manages theme state (user preference + resolved value)
- Syncs with localStorage for persistence
- Listens to OS preference changes via `matchMedia`
- Applies/removes `.dark` class on `<html>` element

---

### Phase 2: FOUC Prevention Script

**File:** `app/components/ThemeScript.tsx`

Inline script that runs before React hydration to prevent flash of unstyled content:

```typescript
// Injects into <head> before body renders
const themeScript = `
  (function() {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (stored === 'dark' || (stored === 'system' && prefersDark) || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  })();
`;
```

**Integration:** Add to `app/layout.tsx` in `<head>` section.

---

### Phase 3: Layout Integration

**File:** `app/layout.tsx`

**Changes:**
1. Add `ThemeScript` component in `<head>`
2. Wrap app with `ThemeProvider`
3. Add `suppressHydrationWarning` to `<html>` to prevent hydration mismatch warnings

```tsx
<html lang="en" suppressHydrationWarning>
  <head>
    <ThemeScript />
  </head>
  <body>
    <ThemeProvider>
      <AuthProvider>
        {/* existing providers */}
      </AuthProvider>
    </ThemeProvider>
  </body>
</html>
```

---

### Phase 4: Theme Toggle Component

**File:** `app/components/ui/ThemeToggle.tsx`

**UI Options:**

1. **Simple Toggle** (recommended for mobile)
   - Three states: Light ☀️ | System 💻 | Dark 🌙
   - Segmented button or dropdown

2. **Icon Button** (for header)
   - Single button that cycles through modes
   - Shows current state icon

```tsx
interface ThemeToggleProps {
  variant?: 'dropdown' | 'segmented' | 'icon';
}
```

---

### Phase 5: Navigation Menu Integration

**File:** `app/components/NavigationMenu.tsx`

**Desktop (Dropdown Menu):**
- Add "Appearance" or "Theme" section
- Show current theme with toggle/selector

**Mobile (Menu Page):**
- Add theme selector to settings section
- Full-width segmented control

```tsx
// Add to menu items
<div className="border-t border-border pt-4 mt-4">
  <div className="flex items-center justify-between px-4">
    <span className="text-sm font-medium">Appearance</span>
    <ThemeToggle variant="segmented" />
  </div>
</div>
```

---

### Phase 6: Database Persistence (Optional Enhancement)

**Migration:** `migrations/013_add_theme_preference.sql`

**Option A: Add column to existing table**
```sql
ALTER TABLE email_preferences 
ADD COLUMN theme VARCHAR(10) DEFAULT 'system' 
CHECK (theme IN ('light', 'dark', 'system'));
```

**Option B: Create user_settings table**
```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme VARCHAR(10) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  -- Future settings can go here
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only access their own settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
ON user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
ON user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Sync Logic:**
- On login: fetch theme from DB → update localStorage + context
- On theme change (logged in): update DB + localStorage
- On theme change (logged out): update localStorage only

---

### Phase 7: CSS Audit & Fixes

**Potential Issues to Check:**

1. **Hardcoded colors** - Search for hex codes not using CSS variables
   ```bash
   grep -r "#[0-9a-fA-F]\{3,6\}" app/components/
   ```

2. **Missing dark variants** - Components using `bg-white` instead of `bg-background`

3. **Images/Icons** - May need dark mode variants or filters

4. **Maps/External embeds** - MapLibre may need separate dark style

**Files to Audit:**
- All components in `app/components/`
- Page components in `app/*/page.tsx`
- Any inline styles

---

## File Structure

```
app/
├── contexts/
│   └── ThemeContext.tsx       # NEW: Theme state management
├── components/
│   ├── ui/
│   │   └── ThemeToggle.tsx    # NEW: Theme selector component
│   ├── ThemeScript.tsx        # NEW: FOUC prevention
│   └── NavigationMenu.tsx     # MODIFIED: Add theme toggle
├── layout.tsx                 # MODIFIED: Add ThemeProvider
└── globals.css                # EXISTING: Already has dark mode vars

migrations/
└── 013_add_theme_preference.sql  # NEW: DB persistence

specs/
└── tables.sql                 # UPDATED: Add user_settings table
```

---

## Implementation Order

1. **ThemeScript.tsx** - Prevents FOUC, can deploy immediately
2. **ThemeContext.tsx** - Core state management
3. **layout.tsx changes** - Wire up provider
4. **ThemeToggle.tsx** - UI component
5. **NavigationMenu.tsx** - Integration
6. **CSS Audit** - Fix any hardcoded colors
7. **Database persistence** - Optional, can be phase 2

---

## Testing Checklist

### Manual Testing
- [ ] Load app with OS in light mode → app shows light theme
- [ ] Load app with OS in dark mode → app shows dark theme
- [ ] Toggle to dark mode → immediate change, no flicker
- [ ] Toggle to light mode → immediate change, no flicker
- [ ] Toggle to system → follows OS preference
- [ ] Refresh page → theme persists
- [ ] Open in new tab → theme persists
- [ ] Change OS preference while on "system" → app updates
- [ ] Login/logout → theme preference maintained

### Components to Verify
- [ ] Header (navigation, dropdowns)
- [ ] Footer
- [ ] Cards (boat cards, journey cards)
- [ ] Forms (inputs, selects, checkboxes)
- [ ] Modals (all modal types)
- [ ] Maps (MapLibre integration)
- [ ] Tables
- [ ] Notifications
- [ ] Loading states

### Accessibility
- [ ] Contrast ratios meet WCAG 2.1 AA (4.5:1 for text)
- [ ] Focus indicators visible in both modes
- [ ] Theme toggle is keyboard accessible

---

## Dependencies

| Component | Dependency | Notes |
|-----------|------------|-------|
| ThemeContext | React Context API | No external deps |
| ThemeScript | None | Pure JS, no React |
| localStorage | Browser API | Fallback needed for SSR |
| matchMedia | Browser API | For OS preference detection |
| Database sync | Supabase client | Optional enhancement |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Theme Context & Script | 2 hours |
| Layout Integration | 1 hour |
| Theme Toggle Component | 2 hours |
| Navigation Integration | 1 hour |
| CSS Audit & Fixes | 3 hours |
| Database Persistence | 2 hours |
| Testing | 2 hours |
| **Total** | **~13 hours** |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Technical Decisions

### Why not use `next-themes` package?
- App is small enough that custom implementation is simple
- Avoids additional dependency
- Full control over behavior
- `next-themes` is ~3KB but we can do it in ~1KB

### Why `system` as default?
- Respects user's existing OS preference
- No jarring experience on first load
- Industry standard approach

### Why localStorage over cookies?
- Theme is UI-only preference, not needed server-side
- Simpler implementation
- No cookie consent implications

### Why inline script for FOUC prevention?
- Must run before React hydrates
- Cannot be async/deferred
- Needs to be in `<head>` to prevent flash

### CSS Variable Architecture (already in place)
The existing setup using CSS custom properties is ideal:
- Single source of truth for colors
- Easy to maintain both themes
- Works with Tailwind's `@theme` inline config
- OKLCH color space provides better perceptual uniformity in dark mode

## Potential Issues

### MapLibre Dark Mode
The map component may need a separate dark style. Options:
1. Use a dark map style URL for dark mode
2. Apply CSS filter to invert map colors (hacky)
3. Keep map style constant regardless of app theme

### Images with Transparency
Some images may look bad on dark backgrounds. Consider:
- Adding background to image containers
- Using different image variants
- CSS `mix-blend-mode` adjustments

### Third-party Embeds
Any iframes or external content won't respect app theme.

## Future Enhancements

1. **Custom accent colors** - Let users pick primary color
2. **High contrast mode** - For accessibility
3. **Scheduled theme** - Auto switch at sunset/sunrise
4. **Per-device sync** - Different preferences per device
<!-- SECTION:NOTES:END -->
