# Plan: Owner Front Page ComboSearch Box Implementation

## Overview
Create an owner-side ComboSearch box similar to the crew side, with two sections: **Journey details** and **Skipper and Crew profiles**. This will provide a consistent UX pattern across both user types while addressing owner-specific needs.

## Current State Analysis

### Crew Side Implementation
- **Component**: `app/components/ui/ComboSearchBox.tsx`
- **Usage**: `app/page.tsx` (crew column)
- **Features**:
  - Desktop and mobile variants
  - Compact mode for dual-column layout
  - Segments: Where From, Where To, Availability, Profile
  - Opens dialogs for each segment
  - Uses `LocationAutocomplete` with cruising regions support

### Owner Side Current State
- **Location**: `app/page.tsx` (owner column)
- **Current Implementation**: Simple button that opens `OwnerPostDialog`
- **Dialog**: Textarea for crew demand + AI consent toggle
- **Missing**: Journey details input, waypoint support, structured search

### LocationAutocomplete Current State
- **File**: `app/components/ui/LocationAutocomplete.tsx`
- **Current Behavior**: Includes predefined cruising regions (lines 129-201)
- **Regions Source**: `app/lib/geocoding/locations.ts` (`getAllRegions()`)
- **Issue**: Cruising regions are too ambiguous/large for specific journey start/end points

### Owner Journey Propose Page
- **File**: `app/owner/journeys/propose/page.tsx`
- **Features**: Start/end location, waypoints, dates, speed planning
- **Uses**: `LocationAutocomplete` (lines 336, 350, 390)
- **Issue**: Same cruising regions problem

## Requirements

### 1. Owner ComboSearch Box Component
- **Two sections**:
  1. **Journey details** → Opens dialog with journey form
  2. **Skipper and Crew profiles** → Opens existing dialog (enhanced)

### 2. Journey Details Dialog
- **Fields**:
  - Start location (LocationAutocomplete, NO cruising regions)
  - End location (LocationAutocomplete, NO cruising regions)
  - Start date (date picker)
  - End date (date picker)
  - Additional waypoints (same functionality as `/owner/journeys/propose`)
    - Add/remove waypoints dynamically
    - Each waypoint uses LocationAutocomplete (NO cruising regions)

### 3. LocationAutocomplete Enhancement
- **Option**: Add prop to exclude cruising regions
- **Approach**: Either:
  - **Option A**: Add `excludeCruisingRegions?: boolean` prop
  - **Option B**: Create separate `LocationAutocompleteSpecific` component
- **Recommendation**: Option A (parametrize existing component)
- **Implementation**: Skip cruising region search when prop is `true`

### 4. Skipper and Crew Profiles Dialog Enhancement
- **Current**: Textarea + AI consent toggle
- **Enhancements**:
  - More descriptive header/title
  - Enhanced placeholder text
  - Instructions for:
    - Skipper profile information
    - Boat details
    - Crew requirements and prefrences
    - Additional information regarding crew, boat or journey

### 5. Update Owner Journey Propose Page
- **Change**: Use restricted LocationAutocomplete (exclude cruising regions)
- **Locations**: Start location, end location, all waypoints

## Implementation Plan

### Phase 1: Enhance LocationAutocomplete Component

**File**: `app/components/ui/LocationAutocomplete.tsx`

**Changes**:
1. Add prop `excludeCruisingRegions?: boolean` to `LocationAutocompleteProps` (default: `false`)
2. Modify `fetchLocationSuggestions` function:
   - When `excludeCruisingRegions === true`, skip cruising region search (lines 129-201)
   - Only search Mapbox API for specific locations
3. Update component signature to accept new prop
4. Pass prop through to internal logic

**Code Changes**:
```typescript
export type LocationAutocompleteProps = {
  // ... existing props
  excludeCruisingRegions?: boolean; // NEW
};

export function LocationAutocomplete({
  // ... existing props
  excludeCruisingRegions = false, // NEW
}: LocationAutocompleteProps) {
  // In fetchLocationSuggestions:
  if (!excludeCruisingRegions) {
    // Existing cruising region search logic (lines 129-201)
  }
  // Continue with Mapbox search...
}
```

**Testing**:
- Verify cruising regions still show when prop is `false` (default)
- Verify cruising regions are excluded when prop is `true`
- Test in crew ComboSearchBox (should still show regions)
- Test in owner contexts (should exclude regions)

---

### Phase 2: Create Owner ComboSearch Box Component

**New File**: `app/components/ui/OwnerComboSearchBox.tsx`

**Structure**:
- Similar to `ComboSearchBox.tsx` but owner-specific
- In default front page mode where both crew and owner columns are visible, display the current simple search box. Click search box closes the crew column and displays the OwnereComboSearch (similar concept as in crew side)
- Mobile: use similar full width wizard approach as in crew side (first Journey details, next Skipper Crew profile..)
- Two sections:
  1. Journey details button → Opens `JourneyDetailsDialog`
  2. Skipper and Crew profiles button → Opens `SkipperCrewProfilesDialog`

**Props Interface**:
```typescript
interface OwnerComboSearchBoxProps {
  onSubmit: (data: OwnerComboSearchData) => void;
  className?: string;
  onFocusChange?: (isFocused: boolean) => void;
  isFocusedControlled?: boolean;
  compactMode?: boolean;
}

export interface OwnerComboSearchData {
  journeyDetails: {
    startLocation: Location | null;
    endLocation: Location | null;
    startDate: string | null;
    endDate: string | null;
    waypoints: Location[];
  };
  skipperCrewProfiles: {
    text: string;
    aiProcessingConsent: boolean;
  };
}
```

**Components to Create**:
1. **DesktopOwnerComboSearchBox**: Desktop layout with two segments
2. **MobileOwnerComboSearchBox**: Mobile layout with two segments
3. **JourneyDetailsDialog**: Journey form dialog
4. **SkipperCrewProfilesDialog**: Enhanced existing dialog

**Desktop Layout**:
- Two side-by-side buttons/segments
- Similar styling to crew ComboSearchBox
- Compact mode support

**Mobile Layout**:
- Stacked buttons
- Full-screen dialogs when opened
- Similar to crew mobile implementation

---

### Phase 3: Create Journey Details Dialog

**Component**: `JourneyDetailsDialog` (within `OwnerComboSearchBox.tsx` or separate file)

**Fields**:
1. **Start Location**
   - `LocationAutocomplete` with `excludeCruisingRegions={true}`
   - Required field
   - Placeholder: "e.g., Barcelona, Spain"

2. **End Location**
   - `LocationAutocomplete` with `excludeCruisingRegions={true}`
   - Required field
   - Placeholder: "e.g., Palma, Mallorca"

3. **Start Date**
   - HTML5 date input
   - Optional but recommended

4. **End Date**
   - HTML5 date input
   - Optional but recommended
   - Min date: start date (if provided)

5. **Intermediate Waypoints**
   - Dynamic list (same as `/owner/journeys/propose`)
   - "Add Waypoint" button
   - Each waypoint:
     - `LocationAutocomplete` with `excludeCruisingRegions={true}`
     - Remove button
   - Optional field

**Dialog Structure**:
- Header: "Journey Details"
- Content: Form fields
- Footer: Cancel + Save buttons
- Validation: Start and end locations required

**State Management**:
```typescript
const [startLocation, setStartLocation] = useState<Location | null>(null);
const [endLocation, setEndLocation] = useState<Location | null>(null);
const [startDate, setStartDate] = useState<string>('');
const [endDate, setEndDate] = useState<string>('');
const [waypoints, setWaypoints] = useState<Location[]>([]);
```

**Validation**:
- Start location: Required, must have valid lat/lng
- End location: Required, must have valid lat/lng
- Waypoints: Optional, but if added must have valid lat/lng
- Dates: Optional, but end date must be >= start date

---

### Phase 4: Enhance Skipper and Crew Profiles Dialog

**Component**: `SkipperCrewProfilesDialog` (enhance existing `OwnerPostDialog`)

**Current File**: `app/page.tsx` (lines 20-137)

**Enhancements**:

1. **Header**:
   - Current: Generic title prop
   - New: More descriptive title
   - Example: "Skipper Profile & Crew Requirements"

2. **Instructions Section** (add above textarea):
   - Brief instructions explaining what to include:
     - Skipper profile information
     - Crew requirements (skills, experience, etc.)
     - Crew preferences
     - Additional important information

3. **Placeholder Text**:
   - Current: Generic placeholder prop
   - New: More descriptive placeholder
   - Example: "Describe your skipper profile, crew requirements, preferences, and any additional important information for potential crew members..."

**Structure**:
```typescript
<div className="space-y-4">
  {/* Instructions */}
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
      What to include:
    </h3>
    <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
      <li>Your skipper profile and sailing experience</li>
      <li>Crew requirements (skills, experience level, etc.)</li>
      <li>Crew preferences and expectations</li>
      <li>Any additional important information</li>
    </ul>
  </div>
  
  {/* Textarea */}
  <textarea
    placeholder="Describe your skipper profile, crew requirements, preferences, and any additional important information for potential crew members..."
    // ... existing props
  />
  
  {/* AI Consent */}
  // ... existing AI consent toggle
</div>
```

**Translation Keys** (add to `messages/en.json`):
```json
{
  "welcome": {
    "owner": {
      "skipperCrewDialogTitle": "Skipper Profile & Crew Requirements",
      "skipperCrewDialogInstructions": "What to include:",
      "skipperCrewDialogPlaceholder": "Describe your skipper profile, crew requirements, preferences, and any additional important information for potential crew members...",
      "skipperCrewDialogInstructionsList": [
        "Your skipper profile and sailing experience",
        "Crew requirements (skills, experience level, etc.)",
        "Crew preferences and expectations",
        "Any additional important information"
      ]
    }
  }
}
```

---

### Phase 5: Update Owner Journey Propose Page

**File**: `app/owner/journeys/propose/page.tsx`

**Changes**:
1. Update all `LocationAutocomplete` components to include `excludeCruisingRegions={true}`
   - Line 336: Start location
   - Line 350: End location
   - Line 390: Waypoints (in map function)

**Code Changes**:
```typescript
<LocationAutocomplete
  excludeCruisingRegions={true} // NEW
  id="start_location"
  label="Start Location"
  // ... existing props
/>

<LocationAutocomplete
  excludeCruisingRegions={true} // NEW
  id="end_location"
  label="End Location"
  // ... existing props
/>

// In waypoints map:
<LocationAutocomplete
  excludeCruisingRegions={true} // NEW
  id={`waypoint_${index}`}
  // ... existing props
/>
```

---

### Phase 6: Integrate Owner ComboSearch Box into Front Page

**File**: `app/page.tsx`

**Changes**:
1. Import `OwnerComboSearchBox` component
2. Replace current owner post button with `OwnerComboSearchBox`
3. Handle `onSubmit` to navigate to `/welcome/owner` with query params
4. Add state for combo search mode (similar to crew side)

**State Management**:
```typescript
const [isOwnerComboSearchMode, setIsOwnerComboSearchMode] = useState(false);
```

**Handler**:
```typescript
const handleOwnerComboSearch = (data: OwnerComboSearchData) => {
  const params = new URLSearchParams();
  
  // Journey details
  if (data.journeyDetails.startLocation) {
    params.set('startLocation', JSON.stringify(data.journeyDetails.startLocation));
  }
  if (data.journeyDetails.endLocation) {
    params.set('endLocation', JSON.stringify(data.journeyDetails.endLocation));
  }
  if (data.journeyDetails.startDate) {
    params.set('startDate', data.journeyDetails.startDate);
  }
  if (data.journeyDetails.endDate) {
    params.set('endDate', data.journeyDetails.endDate);
  }
  if (data.journeyDetails.waypoints.length > 0) {
    params.set('waypoints', JSON.stringify(data.journeyDetails.waypoints));
  }
  
  // Skipper/Crew profiles
  if (data.skipperCrewProfiles.text) {
    params.set('crewDemand', data.skipperCrewProfiles.text);
  }
  if (data.skipperCrewProfiles.aiProcessingConsent) {
    params.set('aiProcessingConsent', 'true');
  }
  
  router.push(`/welcome/owner?${params.toString()}`);
};
```

**UI Integration**:
- Replace owner post button (lines 749-761) with `OwnerComboSearchBox`
- Add focus mode handling (similar to crew side)
- Maintain existing owner column styling and layout

---

### Phase 7: Update Welcome Owner Page to Handle New Params

**File**: `app/welcome/owner/page.tsx` (if exists, or check where owner welcome flow is)

**Changes**:
1. Parse new query params:
   - `startLocation`, `endLocation`, `waypoints` (JSON strings)
   - `startDate`, `endDate` (date strings)
   - `crewDemand` (existing)
   - `aiProcessingConsent` (existing)

2. Pre-populate owner chat context with journey details if provided
3. Pre-populate crew demand text if provided

**Note**: May need to check how owner welcome flow currently works and adapt accordingly.

---

## File Structure

### New Files
- `app/components/ui/OwnerComboSearchBox.tsx` (or integrate into existing ComboSearchBox with variant prop)

### Modified Files
- `app/components/ui/LocationAutocomplete.tsx` (add `excludeCruisingRegions` prop)
- `app/page.tsx` (integrate OwnerComboSearchBox)
- `app/owner/journeys/propose/page.tsx` (use restricted LocationAutocomplete)
- `messages/en.json` (add translation keys)
- `messages/fi.json` (add translation keys)

---

## Testing Checklist

### LocationAutocomplete Enhancement
- [ ] Cruising regions show by default (crew side)
- [ ] Cruising regions excluded when `excludeCruisingRegions={true}` (owner side)
- [ ] Mapbox suggestions still work correctly
- [ ] No regressions in existing usage

### Owner ComboSearch Box
- [ ] Desktop layout displays correctly
- [ ] Mobile layout displays correctly
- [ ] Compact mode works
- [ ] Focus mode works
- [ ] Both sections open correct dialogs

### Journey Details Dialog
- [ ] Start/end location autocomplete works (no cruising regions)
- [ ] Date pickers work correctly
- [ ] Waypoints can be added/removed
- [ ] Validation works (required fields)
- [ ] Form submission works

### Skipper/Crew Profiles Dialog
- [ ] Enhanced header displays
- [ ] Instructions section displays
- [ ] Placeholder text is descriptive
- [ ] AI consent toggle works
- [ ] Form submission works

### Owner Journey Propose Page
- [ ] All LocationAutocomplete instances exclude cruising regions
- [ ] No regressions in existing functionality

### Integration
- [ ] Front page owner column displays OwnerComboSearchBox
- [ ] Navigation to `/welcome/owner` with params works
- [ ] Welcome owner page handles new params correctly

---

## Design Considerations

### Desktop Layout
- Two segments side-by-side (similar to crew)
- Consistent styling with crew ComboSearchBox
- Responsive breakpoints

### Mobile Layout
- Stacked segments
- Full-screen dialogs
- Touch-friendly targets (min 44px)

### Accessibility
- ARIA labels for dialogs
- Keyboard navigation support
- Focus management
- Screen reader support

### Performance
- Debounced location search (already implemented)
- Lazy loading of dialogs
- Efficient re-renders

---

## Implementation Order

1. **Phase 1**: Enhance LocationAutocomplete (foundation)
2. **Phase 2**: Create OwnerComboSearchBox component structure
3. **Phase 3**: Create Journey Details Dialog
4. **Phase 4**: Enhance Skipper/Crew Profiles Dialog
5. **Phase 5**: Update Owner Journey Propose Page
6. **Phase 6**: Integrate into Front Page
7. **Phase 7**: Update Welcome Owner Page

---

## Notes

- **Reusability**: Consider if OwnerComboSearchBox can share code with ComboSearchBox (variant prop vs. separate component)
- **Consistency**: Maintain similar UX patterns between crew and owner sides
- **Backward Compatibility**: Ensure existing owner post flow still works during transition
- **Translation**: All new text should be translatable (i18n support)
