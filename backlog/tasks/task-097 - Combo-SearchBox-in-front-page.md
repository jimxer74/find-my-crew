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

### Phase 1: Component Architecture

#### 1.1 Create ComboSearchBox Component
**File:** `app/components/ui/ComboSearchBox.tsx`

**Structure:**
- Main container with segmented appearance (4 segments + search button)
- Each segment is clickable and expands when focused
- Search button positioned at the end (disabled when all fields empty)
- Responsive design (mobile-friendly)

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

**Key Features:**
- Visual dividers between segments (vertical lines)
- Each segment shows placeholder when empty, truncated value when filled
- Clear button ("x") appears on hover/focus for each filled segment
- Smooth transitions for focus states
- Mobile: Stack segments vertically or use horizontal scroll

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

**Profile Segment:**
- Click opens dialog with textarea
- Dialog title: "Add Profile Information"
- Textarea with placeholder: "Paste your profile or describe your sailing experience..."
- Character counter (optional)
- Save/Cancel buttons
- Display truncated preview in segment (e.g., first 30 chars + "...")

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

### Phase 6: Styling and UX

#### 6.1 Visual Design
- Segmented appearance: subtle borders/dividers between segments
- Focus state: highlighted border, slight elevation/shadow
- Disabled search button: grayed out, non-clickable
- Active search button: blue background, white icon
- Mobile: Consider horizontal scroll or stacked layout

#### 6.2 Interactions
- Click segment → focus and activate input
- Click outside → blur and collapse (if applicable)
- Clear button ("x"): appears on hover/focus, clears that segment
- Search button: only enabled if at least one field has value
- Keyboard navigation: Tab between segments, Enter to submit

#### 6.3 Accessibility
- Proper ARIA labels for each segment
- Keyboard navigation support
- Screen reader announcements
- Focus indicators

### Phase 7: Testing

#### 7.1 Component Testing
- Test each segment independently
- Test clearing functionality
- Test form submission with various combinations
- Test mobile responsiveness

#### 7.2 Integration Testing
- Test navigation to `/welcome/chat` with parameters
- Test parameter parsing in ProspectChatContext
- Test AI receives correct structured data
- Test with cruising regions (verify bbox is passed)
- Test with date ranges
- Test with profile text

#### 7.3 Edge Cases
- Empty form submission (should be disabled)
- Only one field filled
- All fields filled
- Very long profile text
- Special characters in inputs
- Invalid date ranges
- Location autocomplete edge cases

### Phase 8: Documentation

#### 8.1 Component Documentation
- JSDoc comments for ComboSearchBox component
- Props interface documentation
- Usage examples

#### 8.2 Update Task Documentation
- Document any changes to AI prompting
- Document URL parameter format
- Document data structure

### Implementation Order

1. **Create ComboSearchBox component** (Phase 1)
2. **Create ProfileDialog component** (Phase 2.3)
3. **Integrate LocationAutocomplete** (Phase 2.1)
4. **Integrate DateRangePicker** (Phase 2.2)
5. **Define data structure** (Phase 3)
6. **Replace search input in landing page** (Phase 4)
7. **Update ProspectChatContext** (Phase 5)
8. **Review/update AI prompting** (Phase 5.2)
9. **Styling and polish** (Phase 6)
10. **Testing** (Phase 7)
11. **Documentation** (Phase 8)

### Dependencies

- `app/components/ui/LocationAutocomplete.tsx` - Already exists, verify compatibility
- `app/components/ui/DateRangePicker.tsx` - Already exists, verify dialog mode
- `app/lib/geocoding/locations.ts` - For cruising regions and bounding boxes
- `app/contexts/ProspectChatContext.tsx` - Needs updates for parameter parsing
- `app/lib/ai/prospect/service.ts` - May need prompt updates

### Notes

- Consider reusing existing Dialog component from shadcn/ui if available
- Ensure mobile experience is smooth (may need horizontal scroll for segments)
- Preserve existing session detection logic
- Consider adding analytics tracking for combo search usage
- Future enhancement: Save recent searches/locations
<!-- SECTION:PLAN:END -->
