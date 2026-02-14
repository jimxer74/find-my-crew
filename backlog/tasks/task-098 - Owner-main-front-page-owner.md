---
id: TASK-098
title: Owner main front page (/owner)
status: To Do
assignee: []
created_date: '2026-02-13 13:32'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
What are important information from onwers point of view, this needs some proper concepting still, What are the main concerns of owner / skipper:

- Are there any pending registrations / reviews to be managed
- Are there other good candidates as crew that have not registered (but would be excellent matches, from skills, availability, location... etc)
- Upcoming journeys and preparation for them
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

### Overview
Create a dedicated owner front page (`/owner`) that serves as a dashboard/command center for owners. This page will display actionable information prioritized by urgency and relevance, helping owners manage their journeys, registrations, and discover potential crew members.

### Current State Analysis
- **Existing routes**:
  - `/owner/dashboard` → Currently just redirects to `/owner/boats`
  - `/owner/boats` → Lists owner's boats
  - `/owner/journeys` → Lists owner's journeys
  - `/owner/registrations` → Lists all registrations across all journeys
  - `/owner/journeys/[journeyId]/registrations` → Journey-specific registrations
- **Main front page** (`app/page.tsx`): Currently shows dual-column view for both crew and owner, with owner side having a compact search box

### Page Structure

#### 1. Layout & Navigation
- **Route**: `/owner` (new page or repurpose `/owner/dashboard`)
- **Component**: `app/owner/page.tsx` (create new) or update `app/owner/dashboard/page.tsx`
- **Layout**: Full-width page with header visible (per workspace rules)
- **Sections** (top to bottom priority):

### Core Sections

#### 2. Pending Actions / Quick Actions Card
**Priority: Highest**
- **Pending Registrations**:
  - Count badge: Number of registrations awaiting review
  - List: Up to 3-5 most recent pending registrations (with journey/leg name, crew name, date)
  - "View All" link → `/owner/registrations?status=Pending approval`
  - Quick actions: Approve/Reject buttons (inline or modal)
- **Upcoming Journeys** (next 30 days):
  - Count: Number of journeys starting soon
  - List: Journey name, start date, crew needed count, registrations count
  - "View Journey" link → `/owner/journeys/[journeyId]`
- **Design**: Card-based layout with clear visual hierarchy, amber color scheme (owner branding)

#### 3. Suggested Crew Matches
**Priority: High**
- **Concept**: AI-powered suggestions of crew members who haven't registered but match well
- **Data Sources**:
  - Active published journeys/legs with `crew_needed > 0`
  - Crew profiles matching journey requirements (skills, experience, risk level)
  - Location preferences (if task-099 implemented)
  - Availability filters
- **Display**:
  - Section title: "Potential Crew Matches" or "You might be interested in..."
  - Cards: Crew profile cards (avatar, name, skills, experience, match percentage)
  - Filter: By journey/leg
  - "View Profile" → Link to crew profile (if public) or registration flow
  - "Invite to Register" → Trigger invitation/notification
- **API**: New endpoint `/api/owner/suggested-crew` or extend existing matching service
- **Implementation**: 
  - Use existing `app/lib/ai/assistant/matching.ts` logic
  - Query published legs with crew needed
  - Match against crew profiles (consider privacy settings)
  - Return top matches with match scores

#### 4. Upcoming Journeys Overview
**Priority: Medium**
- **Timeline View**:
  - Group by: This Week, This Month, Next 3 Months
  - For each journey:
    - Journey name, boat name, start date
    - Status: Published/In planning
    - Crew status: X/Y needed, Z registered
    - Progress indicator: Registration progress bar
    - Quick actions: Edit, View Registrations, Publish/Unpublish
- **Design**: Calendar-style or list view with visual indicators
- **Data**: Query `journeys` table filtered by `owner_id`, ordered by `start_date`

#### 5. Journey Preparation Checklist
**Priority: Medium**
- **For upcoming journeys** (within 30 days):
  - Checklist items:
    - [ ] Journey published?
    - [ ] All legs have requirements set?
    - [ ] Sufficient crew registered?
    - [ ] Crew approved/confirmed?
    - [ ] Journey details complete?
  - Visual indicators: Green checkmark, yellow warning, red alert
  - Links to relevant edit pages

#### 6. Statistics / Summary Cards
**Priority: Low**
- **Quick Stats**:
  - Total active journeys
  - Total pending registrations
  - Total approved crew
  - Average match score of registered crew
- **Design**: Small stat cards at top or sidebar

### API Endpoints

#### 7. New/Enhanced Endpoints

**`GET /api/owner/dashboard/summary`**
- Returns:
  - Pending registrations count and list
  - Upcoming journeys
  - Quick stats
- Response structure:
  ```typescript
  {
    pendingRegistrations: {
      count: number;
      items: Array<{
        id: string;
        journeyName: string;
        legName: string;
        crewName: string;
        createdAt: string;
        matchScore?: number;
      }>;
    };
    upcomingJourneys: Array<{
      id: string;
      name: string;
      startDate: string;
      crewNeeded: number;
      crewRegistered: number;
      status: string;
    }>;
    stats: {
      activeJourneys: number;
      pendingRegistrations: number;
      approvedCrew: number;
      averageMatchScore: number;
    };
  }
  ```

**`GET /api/owner/suggested-crew?journeyId=xxx&limit=10`**
- Returns suggested crew matches for owner's journeys
- Uses existing matching logic from `app/lib/ai/assistant/matching.ts`
- Considers:
  - Journey/leg requirements
  - Crew profile skills, experience, risk level
  - Location preferences (if available)
  - Availability (if crew has set availability filters)

### UI Components

#### 8. Component Structure
- **Main Page**: `app/owner/page.tsx`
  - Fetches dashboard summary on mount
  - Renders sections in priority order
  - Handles loading and error states

- **Pending Actions Card**: `app/components/owner/PendingActionsCard.tsx`
  - Displays pending registrations and upcoming journeys
  - Inline quick actions

- **Suggested Crew Card**: `app/components/owner/SuggestedCrewCard.tsx`
  - Displays AI-suggested crew matches
  - Crew profile cards with match indicators
  - Filter by journey dropdown

- **Journey Timeline**: `app/components/owner/JourneyTimeline.tsx`
  - Timeline view of upcoming journeys
  - Grouped by time periods

- **Preparation Checklist**: `app/components/owner/PreparationChecklist.tsx`
  - Checklist for each upcoming journey
  - Visual status indicators

- **Stats Cards**: `app/components/owner/StatsCards.tsx`
  - Summary statistics display

### Data Fetching Strategy

#### 9. Performance Considerations
- **Initial Load**: Fetch summary data in parallel
  - Use `Promise.all()` to fetch pending registrations, upcoming journeys, and stats simultaneously
- **Lazy Load**: Suggested crew matches
  - Load on demand or after initial render (lower priority)
  - Can be filtered by journey, so load when user selects journey filter
- **Caching**: Consider caching dashboard summary for 30-60 seconds
  - Use React Query or SWR if available, or simple state management
- **Real-time Updates**: Consider Supabase real-time subscriptions for:
  - New registrations (pending count)
  - Registration status changes
  - Journey updates

### Integration Points

#### 10. Existing Systems
- **Registration Management**: Link to existing `/owner/registrations` page
- **Journey Management**: Link to existing `/owner/journeys` page
- **Matching Logic**: Reuse `app/lib/ai/assistant/matching.ts` for crew suggestions
- **Profile Data**: Use existing profile queries and `useProfile` hook
- **Authentication**: Use existing `useAuth` context and role checks

### Design Considerations

#### 11. UI/UX
- **Color Scheme**: Amber/orange theme (owner branding, consistent with existing owner pages)
- **Responsive**: Mobile-friendly layout (stack sections vertically on mobile)
- **Loading States**: Skeleton loaders for each section
- **Empty States**: Helpful messages when no data (e.g., "No pending registrations - great job!")
- **Actionable**: Every item should have clear next steps/actions
- **Visual Hierarchy**: Most urgent items at top, less urgent below

### Translation Support

#### 12. i18n
- Add translations to `messages/en.json` and `messages/fi.json`:
  - `owner.dashboard.title`
  - `owner.dashboard.pendingRegistrations`
  - `owner.dashboard.upcomingJourneys`
  - `owner.dashboard.suggestedCrew`
  - `owner.dashboard.preparationChecklist`
  - `owner.dashboard.stats`
  - `owner.dashboard.viewAll`
  - `owner.dashboard.noPendingActions`
  - `owner.dashboard.crewNeeded`
  - `owner.dashboard.matchScore`

### Implementation Order

1. **Phase 1: Basic Dashboard Structure**
   - Create `/owner` page component
   - Add API endpoint for dashboard summary
   - Display pending registrations and upcoming journeys
   - Basic layout and styling

2. **Phase 2: Enhanced Features**
   - Add suggested crew matches section
   - Implement crew matching API
   - Add journey timeline view

3. **Phase 3: Preparation & Stats**
   - Add preparation checklist component
   - Add statistics cards
   - Enhance with real-time updates (optional)

4. **Phase 4: Polish & Optimization**
   - Add translations
   - Optimize data fetching
   - Add loading/error states
   - Mobile responsiveness
   - Performance testing

### Open Questions / Decisions Needed

1. **Route**: Should `/owner` be a new route or replace `/owner/dashboard`?
2. **Suggested Crew Privacy**: Should we show full crew profiles or require registration first?
3. **Real-time Updates**: Should we implement Supabase real-time subscriptions for live updates?
4. **Default View**: Should page default to showing all journeys or filter to "upcoming" only?
5. **Crew Invitations**: How should "Invite to Register" work? Email notification? In-app notification?
6. **Integration with Task-099**: If location preferences are implemented, how should they factor into crew suggestions?
