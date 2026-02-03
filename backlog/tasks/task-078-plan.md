## IMPLEMENTATION PLAN: Cost Management System

Based on my analysis of the codebase, here's a comprehensive plan to implement the cost management features:

### **Phase 1: Database Schema Updates**

**1.1 Create Cost Model Types Configuration**
- Create `/app/config/cost-models-config.json` following the same pattern as skills-config.json
- Define the 5 cost models: Shared Contribution, Owner Covers All, Crew Pays a Fee, Delivery/Paid Crew, Not Defined

**1.2 Database Migrations**
- Create migration to add `cost_model` field to `journeys` table (enum type)

**1.3 Update Type Definitions**
- Add TypeScript types for CostModel in `/app/types/`

### **Phase 2: UI Implementation - Journey Edit Page**

**2.1 Refactor Journey Edit Page into Collapsible Sections**
- Wrap existing form fields into `CollapsibleSection` components similar to profile edit
- Create 4-5 collapsible sections:
  1. **Basic Information** (name, dates, description)
  2. **Cost Management** (NEW - cost model selection)
  3. **Skills & Experience** (risk level, skills, experience level)
  4. **Boat & Images** (boat selection, images)
  5. **Requirements** (existing requirements manager)

**2.2 Add Cost Model Selection Component**
- Create `CostModelSelector` component similar to `RiskLevelSelector`
- Display cost models with icons and descriptions
- Include validation and help tooltips

### **Phase 3: LegDetailsPane Updates**

**3.1 Add Cost Model Badge**
- Add cost model badge to the top of LegDetailsPane (similar to match percentage badge)
- Position it as an overlay on the images carousel
- Use color-coded styling based on cost model type

**3.2 Fix Missing Match Percentage Badge**
- The MatchBadge component exists but isn't being displayed in LegDetailsPane
- Add the MatchBadge to the top-left corner of the images section
- Ensure it shows the skill match percentage when available

**3.3 Cost Model Information Display**
- Add detailed cost model information in the journey details section
- Include explanation of what each cost model means
- Add context about financial responsibilities

### **Phase 4: Backend API Updates**

**4.1 Update Journey API Routes**
- Modify journey creation/update endpoints to handle cost_model field
- Add validation for cost model selection
- Include cost model in journey details responses

### **Phase 5: Frontend Components**

**5.1 Cost Model Display Components**
- Create `CostModelBadge` component similar to `MatchBadge`
- Create `CostModelInfoDialog` for detailed explanations
- Add cost model icons and visual indicators

**5.2 Integration with Existing Components**
- Update `LegDetailsPanel` to display cost information
- Modify `CrewBrowseMap` to show cost model indicators
- Add cost-related notifications and alerts

### **Technical Implementation Details**

**Database Schema Changes:**
```sql
-- Add cost model enum
CREATE TYPE cost_model AS ENUM ('Shared contribution', 'Owner covers all costs', 'Crew pays a fee', 'Delivery/paid crew', 'Not defined');

-- Add to journeys table
ALTER TABLE journeys ADD COLUMN cost_model cost_model DEFAULT 'Not defined';
```

**Frontend Architecture:**
- Follow existing patterns for form components
- Use `CollapsibleSection` for organizing journey edit fields
- Implement cost model selection with proper validation
- Add cost badges using the existing badge component pattern

**Key Files to Modify:**
1. `/app/owner/journeys/[journeyId]/edit/page.tsx` - Add collapsible sections and cost model selection
2. `/app/components/crew/LegDetailsPanel.tsx` - Add cost model badge and fix match percentage badge
3. `/app/config/cost-models-config.json` - New cost model configuration
4. `/app/components/ui/CostModelSelector.tsx` - New cost model selection component
5. `/app/components/ui/CostModelBadge.tsx` - New cost model badge component

**Validation & Business Rules:**
- Cost model selection is optional (defaults to "Not defined")
- When cost model is set, provide appropriate UI for cost information display
- Ensure proper authorization (only boat owners can modify cost models)
- Maintain backward compatibility with existing journeys

This plan follows the existing codebase patterns and architecture while adding the requested cost management functionality. The implementation will be modular and consistent with the current design system.