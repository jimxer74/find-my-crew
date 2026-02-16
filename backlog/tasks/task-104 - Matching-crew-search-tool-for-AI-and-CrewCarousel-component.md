---
id: TASK-104
title: Matching crew search tool for AI and CrewCarousel component
status: To Do
assignee: []
created_date: '2026-02-16 18:49'
updated_date: '2026-02-16 19:13'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
create a new tool for /welcome/owner AI assistant to search for the matching crew role users based on the given crew profile. Matching needs to be done againts all crew profile data, including the their availability location preferences, so that search would return best matching crew users for skippers needs and requirements that they have statated. This tool would be used preferably already in very beginning of the AI assistant flow, immediately after skipper has provided the initial information to AI before the sing-up to show the platform value and matching capabilities to convince skippers to continue the sign-in process.

Also a CrewCarousel component to be created, to display the matching crew in carousel format. Information to be displayed are at least image, name, experience level, comfort level, skills.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1: Backend API & Tool (Priority: High)

**1.1 Create Crew Search API Route**
- File: `app/api/crew/search-matches/route.ts`
- Endpoint: `POST /api/crew/search-matches`
- Input parameters:
  ```typescript
  {
    experienceLevel?: number; // 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper
    riskLevels?: string[]; // Array of: "Coastal sailing", "Offshore sailing", "Extreme sailing"
    location?: { lat: number; lng: number; radius?: number }; // radius in km
    dateRange?: { start: Date; end: Date };
    skills?: string[]; // Array of skill names from config (e.g., "navigation", "heavy_weather")
    limit?: number; // default 10, max 50
  }
  ```
- Output:
  ```typescript
  {
    matches: Array<{
      id: string;
      name: string;
      image_url?: string;
      experience_level: number; // 1-4
      risk_levels: string[]; // ["Coastal sailing", "Offshore sailing", etc.]
      skills: string[]; // Array of skill names
      location: string;
      matchScore: number;
      availability?: string;
    }>;
    totalCount: number;
  }
  ```

**1.2 Create Matching Service**
- File: `app/lib/crew/matching-service.ts`
- Functions:
  - `searchMatchingCrew()` - Main search function
  - `calculateCrewMatchScore()` - Score calculation
  - `filterByLocation()` - Geographic filtering
  - `filterByAvailability()` - Date range filtering
  - `normalizeCrewProfile()` - Format for API response

**1.3 Register AI Tool**
- File: `app/lib/ai/owner/tools.ts` (or create if doesn't exist)
- Tool name: `search_matching_crew`
- Tool description: "Search for crew members that match the skipper's requirements including experience level, location preferences, availability dates, and required skills"
- Parameters schema matching API input
- Call the API route and return formatted results

**1.4 Update Owner AI Service**
- File: `app/lib/ai/owner/service.ts`
- Register the new tool in the tool registry
- Add tool to early conversation flow (after initial info gathering)
- Handle tool responses and format for user display

### Phase 2: Frontend CrewCarousel Component (Priority: High)

**2.1 Create CrewCarousel Component**
- File: `app/components/crew/CrewCarousel.tsx`
- Features:
  - Horizontal scrolling carousel
  - Touch/swipe support for mobile
  - Keyboard navigation (arrow keys)
  - Responsive grid on desktop (show 3-4 cards)
  - Loading states
  - Empty state when no matches
- Props:
  ```typescript
  {
    crewMembers: CrewMatch[];
    loading?: boolean;
    onCrewClick?: (crewId: string) => void;
  }
  ```

**2.2 Create CrewCard Component**
- File: `app/components/crew/CrewCard.tsx`
- Display:
  - Profile image (with fallback)
  - Name (first name + last initial for privacy)
  - Experience level (1-4) with display name and icon
  - Risk level indicators (Coastal/Offshore/Extreme sailing badges)
  - Top 3-4 skills as badges (from skills config)
  - Match score percentage
  - Location (city/region only)
- Design: Card-based, consistent with existing UI

**2.3 Integrate into Owner Chat UI**
- File: Modify owner AI chat display components
- Show CrewCarousel when AI tool returns crew matches
- Add special message type for crew matches
- Position carousel in chat flow
- Display crew cards with:
  - Experience level icon and name (e.g., "3. Coastal Skipper")
  - Risk level badges (Coastal/Offshore/Extreme sailing icons)
  - Skills from config as readable labels
- Add "Sign up to connect with these crew" CTA

### Phase 3: Testing & Polish (Priority: Medium)

**3.1 Testing**
- Unit tests for matching algorithm
- API endpoint tests
- Component visual tests
- AI tool integration tests
- Performance testing with large datasets

**3.2 Database Optimization**
- Add indexes if needed:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_profiles_experience 
    ON profiles(experience_level);
  CREATE INDEX IF NOT EXISTS idx_profiles_location 
    ON profiles(home_port_lat, home_port_lng);
  ```
- Query optimization for fast searches

**3.3 Polish**
- Animations for carousel scrolling
- Loading skeletons
- Error handling and user feedback
- Accessibility (ARIA labels, keyboard nav)
- Mobile optimization

### Phase 4: Privacy & Analytics (Priority: Medium)

**4.1 Privacy Controls**
- Respect profile visibility settings
- Only show public information
- Add audit logging for searches
- Implement rate limiting to prevent scraping

**4.2 Analytics**
- Track crew search usage
- Monitor match quality metrics
- A/B test different matching algorithms
- Conversion tracking (searches → signups)

## Database Schema Considerations

### Required Profile Fields
Current `profiles` table should have:
- ✓ `experience_level` - Integer (1-4) for skill matching
- ✓ `home_port` / `home_port_lat` / `home_port_lng` - For location
- ✓ `image_url` - For display
- ✓ `availability` - Date ranges
- ✓ `skills` - Array of text (skill names from config)
- ✓ `risk_level` - Array of risk_level enum ('Coastal sailing', 'Offshore sailing', 'Extreme sailing')
- ? `visibility` or `is_public` - Privacy settings

### Potential New Fields
May need to add:
- `profile_visibility` ENUM('public', 'members_only', 'private')
- `show_in_search` BOOLEAN DEFAULT true
- Last updated timestamp for caching

## API Design

### POST /api/crew/search-matches

**Request:**
```json
{
  "experienceLevel": 2,
  "riskLevels": ["Coastal sailing", "Offshore sailing"],
  "location": {
    "lat": 60.1699,
    "lng": 24.9384,
    "radius": 500
  },
  "dateRange": {
    "start": "2026-06-01",
    "end": "2026-08-31"
  },
  "skills": ["navigation", "heavy_weather", "watch_keeping"],
  "limit": 10
}
```

**Response:**
```json
{
  "matches": [
    {
      "id": "uuid",
      "name": "John D.",
      "image_url": "https://...",
      "experience_level": 3,
      "risk_levels": ["Coastal sailing", "Offshore sailing"],
      "skills": ["navigation", "heavy_weather", "watch_keeping", "first_aid"],
      "location": "Helsinki, Finland",
      "matchScore": 87,
      "availability": "June - August 2026"
    }
  ],
  "totalCount": 23
}
```

## AI Tool Definition

```typescript
{
  name: "search_matching_crew",
  description: "Search for crew members that match specific requirements. Returns a list of qualified crew members with their profiles and match scores. Use this tool early in the conversation to show skippers the value of the platform.",
  parameters: {
    type: "object",
    properties: {
      experience_level: {
        type: "number",
        enum: [1, 2, 3, 4],
        description: "Minimum experience level required: 1=Beginner, 2=Competent Crew, 3=Coastal Skipper, 4=Offshore Skipper"
      },
      risk_levels: {
        type: "array",
        items: {
          type: "string",
          enum: ["Coastal sailing", "Offshore sailing", "Extreme sailing"]
        },
        description: "Acceptable risk/comfort levels for the crew. Coastal sailing = protected waters, Offshore sailing = bluewater passages, Extreme sailing = polar expeditions"
      },
      location: {
        type: "object",
        properties: {
          name: { type: "string" },
          lat: { type: "number" },
          lng: { type: "number" },
          radius: { type: "number", description: "Search radius in km, default 500" }
        },
        description: "Location and search radius for crew availability"
      },
      dates: {
        type: "object",
        properties: {
          start: { type: "string", format: "date" },
          end: { type: "string", format: "date" }
        },
        description: "Date range for crew availability"
      },
      skills: {
        type: "array",
        items: { 
          type: "string",
          description: "Skill names from config: safety_and_mob, heavy_weather, night_sailing, watch_keeping, navigation, sailing_experience, certifications, physical_fitness, seasickness_management, first_aid, technical_skills, cooking, survival_skills"
        },
        description: "Required or preferred skills"
      },
      limit: {
        type: "number",
        default: 10,
        maximum: 50,
        description: "Maximum number of matches to return"
      }
    }
  }
}
```

## Files to Create/Modify

### New Files
1. `app/api/crew/search-matches/route.ts` - API endpoint
2. `app/lib/crew/matching-service.ts` - Matching logic
3. `app/components/crew/CrewCarousel.tsx` - Carousel component
4. `app/components/crew/CrewCard.tsx` - Card component
5. `app/lib/ai/owner/tools.ts` - Tool definitions (if doesn't exist)

### Files to Modify
1. `app/lib/ai/owner/service.ts` - Register new tool
2. `app/components/owner/OwnerChat.tsx` - Display crew matches
3. `app/lib/ai/owner/types.ts` - Add types for crew search
4. `migrations/xxx_add_profile_visibility.sql` - Database changes (if needed)

## Success Criteria

### Functional Requirements
- ✅ AI assistant can search for matching crew
- ✅ Search works for unauthenticated users
- ✅ Crew carousel displays match results
- ✅ Matching algorithm considers all specified criteria
- ✅ Response time < 2 seconds for typical searches
- ✅ Mobile and desktop responsive

### User Experience
- ✅ Smooth carousel scrolling
- ✅ Clear match score indicators
- ✅ Professional crew card design
- ✅ Compelling CTA to encourage signup
- ✅ Privacy-respectful information display

### Technical Requirements
- ✅ Secure API (no data leaks)
- ✅ GDPR compliant
- ✅ Performant database queries
- ✅ Proper error handling
- ✅ Accessible UI components

## Risks & Mitigations

### Risk: Performance with Large Dataset
**Mitigation:** 
- Add database indexes
- Implement caching for common searches
- Limit result sets
- Consider pagination

### Risk: Privacy Concerns
**Mitigation:**
- Only show public profile information
- Respect privacy settings
- Audit logging
- Rate limiting

### Risk: Low Match Quality
**Mitigation:**
- Tune matching algorithm
- Collect feedback
- A/B test different approaches
- Allow manual refinement

### Risk: Complex AI Integration
**Mitigation:**
- Start with simple tool definition
- Iterate based on AI usage patterns
- Fallback to manual search if needed
- Clear error messages

## Timeline Estimate

- **Phase 1 (Backend):** 8-10 hours
  - API route: 2 hours
  - Matching service: 4 hours
  - AI tool integration: 2-3 hours
  - Testing: 2 hours

- **Phase 2 (Frontend):** 6-8 hours
  - CrewCarousel component: 3 hours
  - CrewCard component: 2 hours
  - Integration: 2 hours
  - Styling/polish: 1-2 hours

- **Phase 3 (Testing & Polish):** 4-5 hours
  - Database optimization: 1 hour
  - Testing: 2 hours
  - Polish/accessibility: 2 hours

- **Phase 4 (Privacy & Analytics):** 2-3 hours
  - Privacy controls: 1 hour
  - Analytics: 1-2 hours

**Total Estimate:** 20-26 hours

## Dependencies

- Existing skill matching logic (`app/lib/skillMatching.ts`)
- Profiles database table with required fields
- Owner AI assistant system
- Authentication system (for privacy controls)
- Image storage/CDN for profile photos
<!-- SECTION:PLAN:END -->

## Analysis

### Current State
- Owner AI assistant exists at `/welcome/owner` for onboarding skippers
- Crew matching system exists but is only accessible after authentication
- Skill matching logic exists in `app/lib/skillMatching.ts`
- No tool currently exists for AI to search for matching crew members
- No pre-authentication crew showcase component exists

### Requirements Analysis

**1. AI Tool for Crew Search**
- Must be accessible to unauthenticated users (pre-signup)
- Should search against all crew profiles in database
- Matching criteria should include:
  - Experience level compatibility
  - Location preferences and availability
  - Skills matching
  - Comfort levels (risk tolerance)
  - Date availability
- Return top matching crew members with match scores
- Fast response time (< 2 seconds) for good UX

**2. CrewCarousel Component**
- Display crew members in horizontal scrollable carousel
- Show key information: image, name, experience, comfort level, skills
- Responsive design (mobile and desktop)
- Should work for unauthenticated users
- Privacy-aware (only show public profile information)
- Clickable to show more details (optional)

### Technical Considerations

**Database Queries**
- Existing `profiles` table has crew information
- Need to query across multiple fields efficiently
- Consider performance with large number of profiles
- May need database indexes on commonly queried fields

**Matching Algorithm**
- Leverage existing `calculateMatchPercentage` from `skillMatching.ts`
- Consider geographic distance for location matching
- Weight different factors appropriately
- Return results sorted by match score

**Experience Levels** (from `app/config/experience-levels-config.json`):
- `1` - "1. Beginner" / Display: "Beginner"
- `2` - "2. Competent Crew" / Display: "Competent Crew"
- `3` - "3. Coastal Skipper" / Display: "Coastal Skipper"
- `4` - "4. Offshore Skipper" / Display: "Offshore Skipper"

**Risk Levels / Comfort Levels** (from database enum `risk_level`):
- `"Coastal sailing"` - Protected waters, close to land
- `"Offshore sailing"` - Bluewater, days from land
- `"Extreme sailing"` - Polar expeditions, high-latitude

**Skills Categories** (from `app/config/skills-config.json`):
- General: safety_and_mob, heavy_weather, night_sailing, watch_keeping, navigation, sailing_experience, certifications, physical_fitness, seasickness_management, first_aid, technical_skills, cooking, survival_skills

**Privacy & Security**
- Only expose public profile information
- Don't leak email addresses or sensitive data
- Respect user privacy settings
- GDPR compliant data exposure

**AI Integration**
- Tool should be registered in owner AI assistant
- Should accept flexible natural language parameters
- Return structured data for carousel display
- Handle edge cases (no matches, too many matches, etc.)

## Notes

- Consider showing crew carousel even before skipper provides detailed requirements (show popular/featured crew)
- Could add "Featured Crew" section to landing page using same component
- Match algorithm can be improved over time based on actual connection success rates
- Consider adding crew testimonials to carousel cards
- Future enhancement: Allow crew to opt-in/out of search visibility
