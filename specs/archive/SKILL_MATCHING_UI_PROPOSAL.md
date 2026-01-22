# Skills Matching UI - Proposal

## Current Implementation
- **Strict Filtering**: Only shows legs where user has ALL required skills
- **Toggle**: Users can enable/disable skill matching
- **Problem**: Legs that are close matches (missing 1-2 skills) are completely hidden

## Proposed Solutions

### Option 1: Match Percentage with Color Coding (Recommended)
**Approach**: Show all legs, calculate match percentage, display with visual indicators

**Implementation**:
1. **Remove skills filtering** from API/RPC (or make it optional)
2. **Calculate match percentage** on frontend:
   - Match % = (User skills matching leg skills) / (Total leg skills) × 100
   - If leg has no skills: 100% match (or show as "No requirements")
3. **Visual Indicators**:
   - **Map Markers**: Color-code markers based on match percentage
     - Green (80-100%): Excellent match
     - Yellow (50-79%): Good match
     - Orange (25-49%): Partial match
     - Red (0-24%): Poor match / No match
   - **Leg Details Panel**: Show match badge/percentage prominently
     - Badge at top: "85% Match" with color
     - List missing skills: "Missing: Navigation, Night Sailing"
     - List matching skills: "You have: First Aid, Cooking"
4. **Sorting Options**: Allow users to sort by match percentage

**Pros**:
- Users see all opportunities
- Clear visual feedback on match quality
- Encourages users to add missing skills to profile
- More transparent matching process

**Cons**:
- More visual complexity
- Requires frontend calculation logic

---

### Option 2: Match Badge with Filter Toggle
**Approach**: Show all legs with match badges, keep toggle for filtering

**Implementation**:
1. **Default**: Show all legs with match badges
2. **Toggle**: "Show only matches" - when enabled, filters to 80%+ matches
3. **Badge Display**:
   - Small badge on map markers: "85%"
   - Prominent badge in leg details panel
   - Color-coded: Green/Yellow/Orange/Red
4. **Missing Skills Tooltip**: Hover/click to see what skills are missing

**Pros**:
- Best of both worlds (see all vs. filter)
- Less overwhelming than showing everything always
- Users can choose their preference

**Cons**:
- Still need to calculate match percentage
- Toggle adds complexity

---

### Option 3: Match Score with Star Rating
**Approach**: Use star rating (1-5 stars) instead of percentage

**Implementation**:
1. **Calculate Match Score**:
   - 5 stars: 100% match (all skills)
   - 4 stars: 80-99% match
   - 3 stars: 60-79% match
   - 2 stars: 40-59% match
   - 1 star: 20-39% match
   - 0 stars: <20% match
2. **Display**:
   - Stars on map markers
   - Stars in leg details panel
   - Sort by star rating option

**Pros**:
- Intuitive visual indicator
- Less precise but easier to understand
- Familiar UI pattern

**Cons**:
- Less granular than percentage
- May need to show percentage on hover

---

### Option 4: Hybrid Approach (Recommended)
**Approach**: Combine percentage with smart defaults

**Implementation**:
1. **Default View**: Show all legs with match percentage badges
2. **Smart Filtering**: 
   - If user has skills: Show all legs, highlight 80%+ matches
   - If user has no skills: Show all legs, no filtering
3. **Visual Hierarchy**:
   - **Map Markers**: 
     - Size: Larger for better matches
     - Color: Green → Yellow → Orange → Red gradient
     - Badge: Small percentage badge on marker
   - **Leg Details Panel**:
     - Match badge at top: "85% Match" with color
     - Skills section shows:
       - ✅ Matching skills (green checkmarks)
       - ❌ Missing skills (red X or grayed out)
       - "Add [skill] to profile" links for missing skills
4. **Sorting**: Default sort by match percentage (best matches first)

**Pros**:
- Most informative
- Guides users to improve their profile
- Clear visual feedback
- Flexible filtering options

**Cons**:
- Most complex to implement
- Requires careful UI design

---

## Recommended Implementation: Option 4 (Hybrid)

### Phase 1: Basic Match Percentage
1. Remove skills filtering from API (or make optional)
2. Calculate match percentage on frontend
3. Display percentage badge in leg details panel
4. Color-code based on percentage ranges

### Phase 2: Enhanced Visual Indicators
1. Add color-coded map markers
2. Show matching/missing skills in leg details
3. Add sorting by match percentage

### Phase 3: Advanced Features
1. Add "Add missing skills" quick actions
2. Show match percentage on map markers
3. Add filter presets (e.g., "Show 80%+ matches")

---

## Technical Implementation Details

### Match Percentage Calculation
```typescript
function calculateMatchPercentage(userSkills: string[], legSkills: string[]): number {
  if (legSkills.length === 0) return 100; // No requirements = perfect match
  
  const matchingSkills = userSkills.filter(skill => legSkills.includes(skill));
  return Math.round((matchingSkills.length / legSkills.length) * 100);
}
```

### Color Coding
```typescript
function getMatchColor(percentage: number): string {
  if (percentage >= 80) return 'green';
  if (percentage >= 50) return 'yellow';
  if (percentage >= 25) return 'orange';
  return 'red';
}
```

### UI Components Needed
1. **MatchBadge**: Reusable badge component showing percentage and color
2. **SkillsMatchList**: Component showing matching/missing skills
3. **MatchFilter**: Toggle/select for filtering by match percentage

---

## Questions to Resolve
1. **Default Behavior**: Show all legs by default, or filter to 50%+ matches?
2. **Marker Styling**: Use color, size, or both for match indication?
3. **Sorting**: Default sort by match percentage or keep date-based sorting?
4. **Empty Skills**: How to handle legs with no skill requirements? (100% match or special indicator?)
