---
id: TASK-097
title: Combo SearchBox in front page
status: To Do
assignee: []
created_date: '2026-02-11 09:44'
updated_date: '2026-02-11 10:32'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Combo search box for front page that looks like a single search input field divided in 4 segments (Where from | Where to | Availability | Profile) and "search" icon button within it. Button should be disabled if no inputs are provided and active if any of the inputs are given.

Desktop / General:

Functionality:
Where from: Click and Focus active the field and user can start typing location, uses LocationAutocomplete 

Where to: Click and Focus active the field and user can start typing location, uses LocationAutocomplete. 

Availability: Click and Focus active the field and user can type in free text e.g. "next summer", "June to August" , "asap". This is just free text that is provided to AI model to reason the user intent. It also opens the DateRange picker, so user can use that if so wants to define a more stricter availability limits. 

Profile: Click and Focus open a dialog with textarea where user can copy-paste existing profile for example from Facebook post, etc. or fill in the profile information. Free text

All fields in SearchCombo should have a clean "x" functionality to clear the input from the ComboBox. ComboBox should clearly display the value user has inputted in each. Truncated if necessary to fit.

Search: When user clicks the search button the input are passed to /welcome/chat for AI to use in forming the response to use
 
IMPORTANT: In locations there can be predefined cruising areas where geocoded bounding boxes are defined, those should be used and passed forward to AI in next step to facilitate the search of legs.

IMPORTANT: check and verify if prospect chat AI promting requires some changes due this

Mobile: 
In mobile version, display just one Search input box with Search button. Clicking in opens a full width dialog, where user can provide input in wizard like fashion: 
First page:
- Where from: LocationAutocomplete and 
- Where to: LocationAutocomplete and "next" button"

Second page:
- Availability: same is in Deskop, free text and data range picker

Third Page:
-Profile and Search button that routes to /welcome/chat and provides all the information to AI prospect assitant
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Overview
Replace the current single textarea search input on the landing page (`app/page.tsx`) with a segmented combo search box containing 4 fields: Where from, Where to, Availability, and Profile. The component should integrate seamlessly with existing LocationAutocomplete and DateRangePicker components, and pass structured data to the prospect chat AI.

**Key Requirements:**
- **Desktop**: Single segmented input field with 4 segments visible side-by-side
- **Mobile**: Single search input that opens a full-width dialog with wizard-like multi-page flow
- Both versions should pass the same structured data to `/welcome/chat`

### Phase 1: Component Architecture

#### 1.1 Create ComboSearchBox Component
**File:** `app/components/ui/ComboSearchBox.tsx`

**Structure (Desktop):**
- Main container with segmented appearance (4 segments + search button)
- Each segment is clickable and expands when focused
- Search button positioned at the end (disabled when all fields empty)
- All segments visible in single horizontal row

**Structure (Mobile):**
- Single search input box with search icon button
- Clicking input opens full-width dialog overlay
- Dialog contains wizard with 3 pages
- Responsive detection: Show desktop version on >= 768px, mobile version on < 768px

**State Management:**
```typescript
interface ComboSearchState {
  whereFrom: Location | null;
  whereTo: Location | null;
  availability: {
    freeText: string;
    dateRange: DateRange | null;
  };
  profile: string;
  focusedSegment: 'whereFrom' | 'whereTo' | 'availability' | 'profile' | null;
}
```

**Props:**
```typescript
interface ComboSearchBoxProps {
  onSubmit: (data: ComboSearchData) => void;
  className?: string;
}
```

**Key Features (Desktop):**
- Visual dividers between segments (vertical lines)
- Each segment shows placeholder when empty, truncated value when filled
- Clear button ("x") appears on hover/focus for each filled segment
- Smooth transitions for focus states
- All segments visible in single row

**Key Features (Mobile):**
- Single search input box with search button
- Clicking input opens full-width dialog overlay
- Wizard-like multi-page flow within dialog
- Each page has "Next" button (except last page which has "Search")
- Back button to navigate between pages

#### 1.2 Segment Components

**Where From / Where To Segments:**
- Use existing `LocationAutocomplete` component
- When focused, show autocomplete dropdown
- Display selected location name (truncate if needed)
- Show "Cruising location" badge if `isCruisingRegion === true`
- Store full `Location` object including `bbox` if cruising region

**Availability Segment:**
- Free text input field
- Calendar icon button that opens DateRangePicker in dialog
- Display format:
  - If dateRange exists: "MMM DD - MMM DD, YYYY" or "MMM DD - MMM DD, YYYY" + freeText
  - If only freeText: show freeText
- When clicking calendar icon, open DateRangePicker dialog
- Both freeText and dateRange can coexist

**Profile Segment (Desktop):**
- Click opens dialog with textarea
- Dialog title: "Add Profile Information"
- Textarea with placeholder: "Paste your profile or describe your sailing experience..."
- Character counter (optional)
- Save/Cancel buttons
- Display truncated preview in segment (e.g., first 30 chars + "...")

**Mobile Wizard Structure:**
- **Page 1 - Locations:**
  - Where from: Full-width LocationAutocomplete
  - Where to: Full-width LocationAutocomplete
  - Next button (bottom, full-width or prominent)
  - Page indicator at top
  
- **Page 2 - Availability:**
  - Free text input (full-width)
  - Calendar icon button to open DateRangePicker
  - DateRangePicker opens in nested dialog
  - Back button (left) and Next button (right)
  - Page indicator at top
  
- **Page 3 - Profile:**
  - Textarea (full-width, multi-line)
  - Placeholder: "Paste your profile or describe your sailing experience..."
  - Back button (left) and Search button (right)
  - Page indicator at top
  - Search button submits and navigates to `/welcome/chat`

### Phase 2: Integration with Existing Components

#### 2.1 LocationAutocomplete Integration
**File:** `app/components/ui/LocationAutocomplete.tsx` (already exists)

**Modifications Needed:**
- Verify it handles cruising regions correctly (already supports `bbox`)
- Ensure it works in segmented context (may need `className` prop adjustments)
- Test autocomplete dropdown positioning in combo box context

**Usage:**
```typescript
<LocationAutocomplete
  value={whereFrom?.name || ''}
  onChange={(location) => setWhereFrom(location)}
  placeholder="Where from"
  className="combo-segment-input"
/>
```

#### 2.2 DateRangePicker Integration
**File:** `app/components/ui/DateRangePicker.tsx` (already exists)

**Modifications Needed:**
- Verify `isInDialog` prop works correctly
- Ensure it can be used in a dialog overlay
- Test date selection and closing behavior

**Usage:**
```typescript
<Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
  <DateRangePicker
    value={availability.dateRange || { start: null, end: null }}
    onChange={(range) => setAvailability({ ...availability, dateRange: range })}
    onClose={() => setIsDatePickerOpen(false)}
    isInDialog={true}
  />
</Dialog>
```

#### 2.3 Profile Dialog Component
**New File:** `app/components/ui/ProfileDialog.tsx` (or inline in ComboSearchBox)

**Structure:**
- Dialog component (use shadcn/ui Dialog or custom)
- Textarea for profile input
- Character limit: None (or 2000 chars)
- Save/Cancel buttons
- Auto-focus textarea on open

### Phase 3: Data Structure and Serialization

#### 3.1 Define Data Structure
**File:** `app/components/ui/ComboSearchBox.tsx`

```typescript
export interface ComboSearchData {
  whereFrom: {
    name: string;
    lat: number;
    lng: number;
    isCruisingRegion?: boolean;
    bbox?: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  } | null;
  whereTo: {
    name: string;
    lat: number;
    lng: number;
    isCruisingRegion?: boolean;
    bbox?: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    };
  } | null;
  availability: {
    freeText: string;
    dateRange: {
      start: string | null; // ISO date string
      end: string | null;    // ISO date string
    } | null;
  };
  profile: string;
}
```

#### 3.2 URL Parameter Serialization
**File:** `app/page.tsx`

**Format:**
- Encode as URLSearchParams
- Structure: `?whereFrom=...&whereTo=...&availabilityText=...&availabilityStart=...&availabilityEnd=...&profile=...`
- For locations: encode as JSON string with all location data
- For cruising regions: include bbox in JSON

**Example:**
```
/welcome/chat?whereFrom={"name":"Mediterranean","lat":38,"lng":15,"isCruisingRegion":true,"bbox":{"minLng":-6,"minLat":30,"maxLng":36,"maxLat":46}}&availabilityText=next%20summer&profile=I%20am%20an%20experienced%20sailor...
```

**Alternative (Cleaner):**
- Use base64 encoding for complex data
- Or use separate query params: `whereFromName`, `whereFromLat`, `whereFromLng`, `whereFromBbox` (JSON string)

### Phase 4: Landing Page Integration

#### 4.1 Replace Current Search Input
**File:** `app/page.tsx`

**Changes:**
- Remove existing textarea search input (lines 334-365)
- Import and add `ComboSearchBox` component
- Handle `onSubmit` to construct URL and navigate to `/welcome/chat`

**Implementation:**
```typescript
const handleComboSearch = (data: ComboSearchData) => {
  const params = new URLSearchParams();
  
  if (data.whereFrom) {
    params.set('whereFrom', JSON.stringify(data.whereFrom));
  }
  if (data.whereTo) {
    params.set('whereTo', JSON.stringify(data.whereTo));
  }
  if (data.availability.freeText) {
    params.set('availabilityText', data.availability.freeText);
  }
  if (data.availability.dateRange?.start) {
    params.set('availabilityStart', data.availability.dateRange.start.toISOString());
  }
  if (data.availability.dateRange?.end) {
    params.set('availabilityEnd', data.availability.dateRange.end.toISOString());
  }
  if (data.profile) {
    params.set('profile', data.profile);
  }
  
  router.push(`/welcome/chat?${params.toString()}`);
};
```

#### 4.2 Maintain Existing Session Logic
- Keep existing session detection and "Continue conversation" UI
- ComboSearchBox should only show when no existing session (or replace textarea)
- Consider showing both: combo box for new searches, continue button for existing sessions

### Phase 5: Prospect Chat Integration

#### 5.1 Update ProspectChatContext
**File:** `app/contexts/ProspectChatContext.tsx`

**Changes:**
- Extend initial query processing (line ~1455) to handle structured parameters
- Parse URL parameters: `whereFrom`, `whereTo`, `availabilityText`, `availabilityStart`, `availabilityEnd`, `profile`
- Construct initial message that includes structured data

**Implementation:**
```typescript
// In useEffect that processes initial query
const whereFromParam = searchParams?.get('whereFrom');
const whereToParam = searchParams?.get('whereTo');
const availabilityTextParam = searchParams?.get('availabilityText');
const availabilityStartParam = searchParams?.get('availabilityStart');
const availabilityEndParam = searchParams?.get('availabilityEnd');
const profileParam = searchParams?.get('profile');

if (whereFromParam || whereToParam || availabilityTextParam || profileParam) {
  // Construct structured initial message
  const parts: string[] = [];
  
  if (profileParam) {
    parts.push(`Profile: ${profileParam}`);
  }
  if (whereFromParam) {
    const location = JSON.parse(whereFromParam);
    parts.push(`Looking to sail from: ${location.name}`);
  }
  if (whereToParam) {
    const location = JSON.parse(whereToParam);
    parts.push(`Looking to sail to: ${location.name}`);
  }
  if (availabilityTextParam || availabilityStartParam) {
    let availText = availabilityTextParam || '';
    if (availabilityStartParam && availabilityEndParam) {
      const start = new Date(availabilityStartParam);
      const end = new Date(availabilityEndParam);
      availText = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
    parts.push(`Available: ${availText}`);
  }
  
  const initialMessage = parts.join('\n');
  sendMessage(initialMessage);
}
```

#### 5.2 Update AI Prompting (if needed)
**File:** `app/lib/ai/prospect/service.ts`

**Review:**
- Check if current prompt handles location names well (should be fine)
- Verify bounding box data is passed correctly when searching legs
- Ensure date ranges are parsed correctly

**Potential Changes:**
- If structured data is passed, could enhance prompt to explicitly mention cruising regions
- Add context about bounding boxes for better leg matching
- Example prompt addition:
  ```
  USER PROVIDED LOCATIONS:
  - Departure: [location name] (Cruising Region: [region name], Bounding Box: [bbox])
  - Arrival: [location name] (Cruising Region: [region name], Bounding Box: [bbox])
  
  Use these bounding boxes when searching for matching legs to ensure accurate geographic matching.
  ```

### Phase 6: Mobile Wizard Implementation

#### 6.1 Mobile Search Input and Dialog Component
**File:** `app/components/ui/ComboSearchBox.tsx` (or separate `ComboSearchMobileWizard.tsx`)

**Mobile Input (Initial State):**
- Single search input box (similar to current textarea but styled as input)
- Search icon button on the right
- Placeholder: "Search for sailing opportunities..." or similar
- When clicked/focused, opens full-width dialog (does NOT allow typing in the input itself)
- Input is read-only - serves as trigger for dialog

**Dialog Structure:**
- Full-width dialog overlay (fixed positioning, `inset-0`)
- Backdrop with blur/opacity
- Multi-page wizard with page indicators
- Smooth page transitions (slide animation)
- Back/Next navigation buttons
- Close button (X) in top-right corner
- Dialog should be focus-trapped (Tab navigation stays within dialog)

#### 6.2 Wizard Pages

**Page 1: Locations**
- Where from: LocationAutocomplete (full width)
- Where to: LocationAutocomplete (full width)
- "Next" button (enabled if at least one location filled)
- Page indicator: "Step 1 of 3"

**Page 2: Availability**
- Free text input field (full width)
- Calendar icon button to open DateRangePicker
- DateRangePicker opens in nested dialog/modal
- "Back" button (left side)
- "Next" button (right side, enabled if availability filled or user can skip)
- Page indicator: "Step 2 of 3"

**Page 3: Profile**
- Textarea for profile input (full width, multi-line)
- Placeholder: "Paste your profile or describe your sailing experience..."
- "Back" button (left side)
- "Search" button (right side, enabled if profile filled or user can skip)
- Page indicator: "Step 3 of 3"

#### 6.3 Wizard State Management
```typescript
interface WizardState {
  currentPage: 1 | 2 | 3;
  whereFrom: Location | null;
  whereTo: Location | null;
  availability: {
    freeText: string;
    dateRange: DateRange | null;
  };
  profile: string;
}
```

**Navigation Logic:**
- Next button: Validate current page, move to next page
- Back button: Move to previous page, preserve data
- Close button: Close dialog, optionally save draft to localStorage
- Search button: Validate all pages, submit and close dialog

#### 6.4 Responsive Detection
- Use `useMediaQuery` or `window.innerWidth` to detect mobile vs desktop
- Breakpoint: `< 768px` (or `< 640px` for tablet)
- Show appropriate component based on screen size

### Phase 7: Styling and UX

#### 7.1 Desktop Visual Design
- Segmented appearance: subtle borders/dividers between segments
- Focus state: highlighted border, slight elevation/shadow
- Disabled search button: grayed out, non-clickable
- Active search button: blue background, white icon
- Consistent with existing landing page styling

#### 7.2 Mobile Visual Design
- Dialog: Full-width overlay with backdrop blur
- Page transitions: Slide animation between pages
- Page indicators: Dots or "Step X of 3" text at top
- Buttons: Full-width or prominent placement
- Inputs: Full-width with proper spacing
- Close button: Fixed top-right, always visible

#### 7.3 Desktop Interactions
- Click segment → focus and activate input
- Click outside → blur and collapse (if applicable)
- Clear button ("x"): appears on hover/focus, clears that segment
- Search button: only enabled if at least one field has value
- Keyboard navigation: Tab between segments, Enter to submit

#### 7.4 Mobile Interactions
- Click search input → open dialog
- Swipe gestures: Optional swipe left/right to navigate pages
- Back button: Navigate to previous page
- Next button: Navigate to next page (with validation)
- Close button: Close dialog, optionally show "Discard changes?" confirmation
- DateRangePicker: Opens in nested modal/dialog overlay

#### 7.5 Accessibility
- Proper ARIA labels for each segment/page
- Keyboard navigation support (Tab, Enter, Escape)
- Screen reader announcements for page changes
- Focus indicators
- Mobile: Ensure dialog is focus-trapped
- Mobile: Announce page changes to screen readers

### Phase 8: Testing

#### 8.1 Desktop Component Testing
- Test each segment independently
- Test clearing functionality ("x" buttons)
- Test form submission with various combinations
- Test keyboard navigation (Tab, Enter)
- Test focus states and transitions
- Test truncation of long values

#### 8.2 Mobile Component Testing
- Test dialog opening/closing
- Test wizard page navigation (Next/Back)
- Test page validation (Next button enabled/disabled)
- Test data persistence across page navigation
- Test DateRangePicker in nested dialog
- Test ProfileDialog textarea
- Test swipe gestures (if implemented)
- Test close button with unsaved changes

#### 8.3 Responsive Testing
- Test breakpoint detection (< 768px)
- Test switching between desktop/mobile views
- Test on various screen sizes (phone, tablet, desktop)
- Test orientation changes (portrait/landscape)

#### 8.4 Integration Testing
- Test navigation to `/welcome/chat` with parameters (both desktop and mobile)
- Test parameter parsing in ProspectChatContext
- Test AI receives correct structured data
- Test with cruising regions (verify bbox is passed)
- Test with date ranges
- Test with profile text
- Verify both desktop and mobile paths produce same URL parameters

#### 8.5 Edge Cases
- Empty form submission (should be disabled)
- Only one field filled
- All fields filled
- Very long profile text
- Special characters in inputs
- Invalid date ranges
- Location autocomplete edge cases
- Mobile: Closing dialog mid-wizard (should preserve data or show confirmation)
- Mobile: Browser back button during wizard (should close dialog)
- Mobile: Very long location names (truncation)

### Phase 9: Documentation

#### 8.1 Component Documentation
- JSDoc comments for ComboSearchBox component
- Props interface documentation
- Usage examples

#### 8.2 Update Task Documentation
- Document any changes to AI prompting
- Document URL parameter format
- Document data structure

### Implementation Order

**Phase 1: Core Components**
1. **Create ComboSearchBox component** (Desktop version first)
2. **Create ProfileDialog component** (Phase 2.3)
3. **Integrate LocationAutocomplete** (Phase 2.1)
4. **Integrate DateRangePicker** (Phase 2.2)
5. **Define data structure** (Phase 3)

**Phase 2: Mobile Implementation**
6. **Create mobile wizard dialog component** (Phase 6)
7. **Implement wizard page navigation** (Phase 6.2)
8. **Add responsive detection** (Phase 6.4)
9. **Integrate mobile wizard with main component**

**Phase 3: Integration**
10. **Replace search input in landing page** (Phase 4)
11. **Update ProspectChatContext** (Phase 5)
12. **Review/update AI prompting** (Phase 5.2)

**Phase 4: Polish**
13. **Desktop styling and polish** (Phase 7.1-7.3)
14. **Mobile styling and polish** (Phase 7.2-7.4)
15. **Accessibility improvements** (Phase 7.5)

**Phase 5: Quality Assurance**
16. **Desktop testing** (Phase 8.1)
17. **Mobile testing** (Phase 8.2)
18. **Responsive testing** (Phase 8.3)
19. **Integration testing** (Phase 8.4)
20. **Edge case testing** (Phase 8.5)

**Phase 6: Documentation**
21. **Component documentation** (Phase 9)
22. **Update task documentation**

### Dependencies

- `app/components/ui/LocationAutocomplete.tsx` - Already exists, verify compatibility
- `app/components/ui/DateRangePicker.tsx` - Already exists, verify dialog mode
- `app/lib/geocoding/locations.ts` - For cruising regions and bounding boxes
- `app/contexts/ProspectChatContext.tsx` - Needs updates for parameter parsing
- `app/lib/ai/prospect/service.ts` - May need prompt updates

### Notes

- **Mobile-First Consideration**: Mobile version is significantly different from desktop - treat as separate component with shared data structure
- **Dialog Component**: Use existing Dialog component from shadcn/ui or create custom full-width overlay
- **Wizard Navigation**: Consider using a state machine or step-based navigation library for cleaner code
- **Data Persistence**: Consider saving wizard progress to localStorage if user closes dialog mid-flow
- **Session Logic**: Preserve existing session detection logic - combo box should only show when no existing session
- **Analytics**: Consider adding analytics tracking for combo search usage (desktop vs mobile, completion rates)
- **Future Enhancements**: 
  - Save recent searches/locations
  - Allow skipping optional fields in mobile wizard
  - Add progress indicator showing which fields are filled
  - Add "Clear all" functionality
  - Add draft saving for mobile wizard
<!-- SECTION:PLAN:END -->
