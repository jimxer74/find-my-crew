# Journey Creation Flow - Complete Walkthrough

This document traces the complete flow when a user initiates journey creation in the owner chat.

## Overview

The journey creation process involves multiple steps:
1. User sends message about creating a journey
2. AI processes request and calls tools
3. Tools execute and create database records
4. AI continues iterating until all legs are created
5. Final response returned to user

---

## 1. Entry Point: API Route

**File:** `app/api/ai/owner/chat/route.ts`

### Flow:
```
POST /api/ai/owner/chat
  ↓
Parse request body (message, sessionId, conversationHistory, etc.)
  ↓
Create Supabase client (supports authenticated & unauthenticated)
  ↓
Check authentication (optional for owner chat)
  ↓
Call ownerChat() service function
  ↓
Return response
```

### Key Code:
```typescript
const response = await ownerChat(supabase, {
  sessionId: body.sessionId,
  message,
  conversationHistory: body.conversationHistory,
  gatheredPreferences: body.gatheredPreferences,
  profileCompletionMode: body.profileCompletionMode,
  authenticatedUserId,
  userProfile,
});
```

---

## 2. Main Service Function: ownerChat()

**File:** `app/lib/ai/owner/service.ts`  
**Function:** `ownerChat()` (line ~1568)

### Initial Setup:
1. **Check completion status** (if authenticated):
   - `hasProfile`: Check if profile exists
   - `hasBoat`: Check if user has boats
   - `hasJourney`: Check if user has journeys

2. **Build system prompt**:
   - `buildOwnerSystemPrompt()` - Contains journey creation instructions
   - `buildToolInstructions()` - Lists available tools (filters out completed items)

3. **Build message history**:
   - System prompt
   - Conversation history (last N messages)
   - Current user message

### Key Code:
```typescript
let hasProfile = false;
let hasBoat = false;
let hasJourney = false;

if (authenticatedUserId) {
  // Check profile, boats, journeys
}

const systemPrompt = buildOwnerSystemPrompt(...);
systemPrompt += buildToolInstructions(!!authenticatedUserId, hasProfile, hasBoat, hasJourney);
```

---

## 3. AI Processing Loop

**File:** `app/lib/ai/owner/service.ts`  
**Function:** `ownerChat()` - Tool iteration loop (line ~1753)

### Loop Structure:
```
MAX_TOOL_ITERATIONS = 10 (increased from 5)

while (iterations < MAX_TOOL_ITERATIONS) {
  1. Call AI with current messages
  2. Parse AI response for tool calls
  3. If no tool calls → break (final response)
  4. Execute tools
  5. Add tool results to conversation
  6. Continue to next iteration
}
```

### Each Iteration:
1. **Call AI** (`callAI()`):
   - Sends: System prompt + conversation history + user message
   - Receives: AI response text (may contain tool calls)

2. **Parse Tool Calls** (`parseToolCalls()`):
   - Extracts tool calls from AI response
   - Supports multiple formats: JSON blocks, XML tags, token format, plain JSON

3. **Execute Tools** (`executeOwnerTools()`):
   - Executes each tool call
   - Returns results/errors

4. **Add Results to Conversation**:
   - Adds AI response to messages
   - Adds tool results as user message
   - Continues loop for next iteration

### Key Code:
```typescript
while (iterations < MAX_TOOL_ITERATIONS) {
  const result = await callAI({ useCase: 'owner-chat', prompt: promptText });
  const { content, toolCalls } = parseToolCalls(result.text);
  
  if (toolCalls.length === 0) {
    finalContent = content;
    break; // Done!
  }
  
  const toolResults = await executeOwnerTools(...);
  // Add results and continue
}
```

---

## 4. Journey Creation Tools

### Tool 1: `generate_journey_route`

**Purpose:** Generate journey structure with legs and waypoints, then **automatically create journey and all legs in the database** (no AI involvement for creation)

**Location:** `app/lib/ai/owner/service.ts` (line ~1161)

**Flow:**
```
1. Validate authentication
2. Extract arguments:
   - startLocation, endLocation
   - intermediateWaypoints (optional)
   - boatId, startDate, endDate
   - useSpeedPlanning, boatSpeed
   - risk_level, skills, min_experience_level (optional, for journey metadata)
3. Get boat speed if needed
4. Call internal API: POST /api/ai/generate-journey
5. Parse JSON response
6. **STATIC CODE: createJourneyAndLegsFromRoute()** - creates journey + all legs directly
7. Return summary to AI (journey and legs already created)
```

**Auto-Creation (Static Code):**
When the API returns successfully, `createJourneyAndLegsFromRoute()`:
- Creates journey record in `journeys` table
- Creates each leg in `legs` table
- Creates waypoints via `insert_leg_waypoints` RPC
- No AI model involvement for creation

**Returns to AI:**
```json
{
  "journeyCreated": true,
  "journeyId": "uuid",
  "journeyName": "Caribbean Passage 2026",
  "legsCreated": 5,
  "message": "Journey \"Caribbean Passage 2026\" and 5 leg(s) have been created successfully. [SYSTEM: Proceed with responding to the user - inform them their journey is ready. No need to call create_journey or create_leg tools.]"
}
```

**Internal API:** `app/api/ai/generate-journey/route.ts`
- Uses AI to generate route structure
- Validates waypoints
- Returns structured journey data

---

### Tool 2: `create_journey`

**Purpose:** Create journey record in database

**Location:** `app/lib/ai/owner/service.ts` (line ~1374)

**Flow:**
```
1. Validate authentication
2. Extract arguments:
   - boat_id, name (required)
   - start_date, end_date, description (optional)
   - risk_level, skills, min_experience_level (optional)
3. Verify boat ownership (RLS check)
4. Insert into journeys table
5. Return journey ID and name
```

**Database Operation:**
```typescript
const { data, error } = await supabase
  .from('journeys')
  .insert({
    boat_id,
    name,
    start_date,
    end_date,
    description,
    risk_level: (args.risk_level as string[]) || [],
    skills: (args.skills as string[]) || [],
    min_experience_level: args.min_experience_level || 1,
    state: 'In planning',
  })
  .select('id, name')
  .single();
```

**Returns:**
```json
{
  "success": true,
  "journeyId": "uuid-here",
  "journeyName": "Caribbean Passage 2026",
  "message": "Journey \"Caribbean Passage 2026\" created successfully"
}
```

---

### Tool 3: `create_leg`

**Purpose:** Create leg record with waypoints

**Location:** `app/lib/ai/owner/service.ts` (line ~1440)

**Flow:**
```
1. Validate authentication
2. Extract arguments:
   - journey_id, name (required)
   - waypoints[] (required, min 2)
   - start_date, end_date, crew_needed (optional)
3. Verify journey ownership (RLS check)
4. Insert leg into legs table
5. Create waypoints using RPC function
6. Return leg ID and waypoint count
```

**Database Operations:**

**Step 1: Create Leg**
```typescript
const { data: leg, error: legError } = await supabase
  .from('legs')
  .insert({
    journey_id,
    name,
    start_date: start_date || null,
    end_date: end_date || null,
    crew_needed,
  })
  .select('id, name')
  .single();
```

**Step 2: Create Waypoints (using RPC)**
```typescript
const waypointsForRPC = waypoints.map(wp => ({
  index: wp.index,
  name: wp.name,
  lng: wp.geocode.coordinates[0],
  lat: wp.geocode.coordinates[1],
}));

const { error: waypointsError } = await supabase.rpc('insert_leg_waypoints', {
  leg_id_param: leg.id,
  waypoints_param: waypointsForRPC,
});
```

**RPC Function:** `insert_leg_waypoints()` (defined in `specs/tables.sql`)
- Converts coordinates to PostGIS geometry
- Inserts waypoints with proper spatial indexing
- Handles authorization checks

**Returns:**
```json
{
  "success": true,
  "legId": "uuid-here",
  "legName": "Guadeloupe to Dominica",
  "waypointCount": 2,
  "message": "Leg \"Guadeloupe to Dominica\" created successfully with 2 waypoint(s)"
}
```

---

## 5. Typical Journey Creation Sequence (Updated Flow)

### New Flow (Single Iteration):

**Iteration 1:**
```
User: "I want to create a journey from Guadeloupe to Grenada"
  ↓
AI calls: get_owner_boats (to get boat ID)
AI calls: generate_journey_route (with route details, optional risk_level/skills/min_experience_level)
  ↓
Tool execution:
  1. generate_journey_route calls /api/ai/generate-journey → returns JSON
  2. createJourneyAndLegsFromRoute() parses JSON and creates:
     - 1 journey record
     - N leg records (one per leg)
     - Waypoints for each leg via insert_leg_waypoints RPC
  ↓
Tool Results:
  - get_owner_boats: Returns boat list
  - generate_journey_route: "Journey X and 5 leg(s) created. [SYSTEM: Proceed with responding to user...]"
  ↓
AI Response: "Your journey 'Caribbean Passage 2026' with 5 legs is ready!"
  ↓
No more tool calls → Loop exits
```

### Key Change:
- **Before:** AI called generate_journey_route → create_journey → create_leg (×5) across multiple iterations
- **After:** AI calls generate_journey_route → static code creates journey + all legs in one go → AI receives summary and responds

---

## 6. Error Handling

### Common Issues:

1. **Waypoint Creation Failure:**
   - **Problem:** Using `geocode` column instead of PostGIS `location`
   - **Solution:** Use `insert_leg_waypoints` RPC function
   - **Status:** ✅ Fixed

2. **Not All Legs Created:**
   - **Problem:** Iteration limit too low (was 5)
   - **Solution:** Increased to 10 iterations
   - **Status:** ✅ Fixed

3. **Duplicate Journey Creation:**
   - **Problem:** AI could create duplicate journeys
   - **Solution:** Filter out `create_journey` tool if `hasJourney === true`
   - **Status:** ✅ Fixed

4. **Invalid Journey ID in Leg Creation:**
   - **Problem:** AI uses placeholder `<journey_id>` instead of actual ID
   - **Solution:** AI receives journeyId from previous tool result
   - **Status:** ⚠️ Requires AI to properly use tool results

---

## 7. Database Schema

### Tables Involved:

**journeys:**
- `id` (uuid, PK)
- `boat_id` (uuid, FK → boats)
- `name`, `description`
- `start_date`, `end_date`
- `risk_level[]`, `skills[]`, `min_experience_level`
- `state` ('In planning', etc.)

**legs:**
- `id` (uuid, PK)
- `journey_id` (uuid, FK → journeys)
- `name`
- `start_date`, `end_date`
- `crew_needed`
- `bbox` (PostGIS Polygon - auto-calculated)

**waypoints:**
- `id` (uuid, PK)
- `leg_id` (uuid, FK → legs)
- `index` (integer - order within leg)
- `name` (text)
- `location` (PostGIS Point geometry, SRID 4326)

### Relationships:
```
boats → journeys (1:many)
journeys → legs (1:many)
legs → waypoints (1:many)
```

---

## 8. Key Functions Reference

| Function | Location | Purpose |
|----------|----------|---------|
| `ownerChat()` | `app/lib/ai/owner/service.ts:1568` | Main service function |
| `executeOwnerTools()` | `app/lib/ai/owner/service.ts:511` | Execute tool calls |
| `buildOwnerSystemPrompt()` | `app/lib/ai/owner/service.ts:200` | Build AI system prompt |
| `buildToolInstructions()` | `app/lib/ai/owner/service.ts:386` | Build tool list for AI |
| `parseToolCalls()` | `app/lib/ai/shared/tool-utils.ts:316` | Parse tool calls from AI response |
| `insert_leg_waypoints()` | `specs/tables.sql:433` | RPC function for waypoint creation |

---

## 9. Important Notes

1. **Authentication:** Journey creation requires authentication. Unauthenticated users see tools but get errors when calling them.

2. **Tool Filtering:** If `hasJourney === true`, the `create_journey` tool is filtered out from the AI's available tools list.

3. **Iteration Limit:** Currently 10 iterations max. Each iteration can include multiple tool calls.

4. **Waypoint Format:** Waypoints use GeoJSON format (`{type: "Point", coordinates: [lng, lat]}`) but are stored as PostGIS geometry in the database.

5. **Ownership Verification:** All tools verify ownership:
   - `create_journey`: Verifies boat ownership
   - `create_leg`: Verifies journey ownership (via boat ownership)

6. **RLS Policies:** Database Row Level Security ensures users can only create journeys/legs for their own boats.

---

## 10. Debugging Tips

### Check Logs:
- `[API Owner Chat Route]` - API entry point
- `[Owner Chat Service]` - Main service function
- `[AI Tool Utils]` - Tool parsing
- `[Response Parsing]` - JSON parsing from AI

### Common Log Patterns:
```
🔄 ITERATION X/10
📥 AI RESPONSE: X chars from provider/model
🔧 PARSED TOOL CALLS: X
📊 TOOL RESULTS:
  [0] tool_name: ✅/❌ result/error
🎉 Journey created successfully!
```

### Verify Database:
```sql
-- Check journey
SELECT * FROM journeys WHERE boat_id IN (
  SELECT id FROM boats WHERE owner_id = 'user-id'
);

-- Check legs
SELECT * FROM legs WHERE journey_id = 'journey-id';

-- Check waypoints
SELECT * FROM waypoints WHERE leg_id = 'leg-id';
```
