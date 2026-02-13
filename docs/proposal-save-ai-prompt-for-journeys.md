# Proposal: Save AI Prompt When Creating Journeys

## Problem Statement

When `create_journey` tool is called (or when `generate_journey_route` creates a journey), the AI prompt that was used to generate the journey is **not saved** to the database, even though:

1. The `journeys` table has an `ai_prompt` field (text, nullable)
2. The `journeys` table has an `is_ai_generated` field (boolean, default false)
3. The AI prompt is available in the `ownerChat` function context
4. Other parts of the codebase (e.g., `app/owner/journeys/propose/page.tsx`) already save the prompt when creating journeys

## Current State Analysis

### Database Schema
The `journeys` table includes:
- `ai_prompt` (text, nullable) - Field exists but is not being populated
- `is_ai_generated` (boolean, default false) - Field exists but is not being set to true

### Current Implementation

**1. `generate_journey_route` tool execution:**
- Location: `app/lib/ai/owner/service.ts` line ~1534
- Calls: `createJourneyAndLegsFromRoute()` function
- Which calls: `supabase.rpc('insert_journey_with_risk', {...})`
- **Issue**: Prompt is not passed to the function

**2. `create_journey` tool execution:**
- Location: `app/lib/ai/owner/service.ts` line ~1741
- Calls: `supabase.rpc('insert_journey_with_risk', {...})` directly
- **Issue**: Prompt is not passed to the RPC

**3. RPC Function:**
- Location: `migrations/030_create_insert_journey_rpc.sql`
- Function: `insert_journey_with_risk`
- **Issue**: Does not accept `ai_prompt` or `is_ai_generated` parameters
- Current parameters: `(p_boat_id, p_name, p_description, p_start_date, p_end_date, p_risk_level, p_skills, p_min_experience_level, p_cost_model, p_cost_info, p_state)`

**4. Available Context:**
- System prompt is available at: `app/lib/ai/owner/service.ts` line ~2056 (`systemPrompt` variable)
- Full conversation messages available at: line ~2082 (`currentMessages` array)
- The prompt includes: system instructions, tool instructions, conversation history

## Proposed Solution

### Phase 1: Update RPC Function

**File:** `migrations/034_add_ai_prompt_to_insert_journey_rpc.sql` (new migration)

**Changes:**
1. Add `p_ai_prompt` parameter (text, nullable)
2. Add `p_is_ai_generated` parameter (boolean, default false)
3. Update INSERT statement to include these fields
4. Update function signature and grants

**Implementation:**
```sql
DROP FUNCTION IF EXISTS public.insert_journey_with_risk(
  uuid, text, text, date, date, text[], text[], integer, text, text, text
);

CREATE OR REPLACE FUNCTION public.insert_journey_with_risk(
  p_boat_id uuid,
  p_name text,
  p_description text,
  p_start_date date,
  p_end_date date,
  p_risk_level text[],
  p_skills text[],
  p_min_experience_level integer,
  p_cost_model text,
  p_cost_info text,
  p_state text DEFAULT 'In planning',
  p_ai_prompt text DEFAULT NULL,
  p_is_ai_generated boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journey_id uuid;
  v_owner_id uuid;
  v_risk_level risk_level;
BEGIN
  -- Verify boat ownership
  SELECT owner_id INTO v_owner_id FROM boats WHERE id = p_boat_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Boat not found: %', p_boat_id;
  END IF;
  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this boat';
  END IF;

  -- Take first valid risk_level from array
  SELECT (array_agg(r::risk_level))[1] INTO v_risk_level
  FROM unnest(COALESCE(p_risk_level, ARRAY[]::text[])) AS r
  WHERE r IN ('Coastal sailing', 'Offshore sailing', 'Extreme sailing');

  INSERT INTO journeys (
    boat_id, name, description, start_date, end_date,
    risk_level, skills, min_experience_level, cost_model, cost_info, state,
    ai_prompt, is_ai_generated
  )
  VALUES (
    p_boat_id, p_name, p_description, p_start_date, p_end_date,
    v_risk_level,
    COALESCE(p_skills, '{}'),
    COALESCE(p_min_experience_level, 1),
    COALESCE(p_cost_model, 'Not defined')::cost_model,
    p_cost_info,
    COALESCE(p_state, 'In planning')::journey_state,
    p_ai_prompt,
    p_is_ai_generated
  )
  RETURNING id INTO v_journey_id;

  RETURN v_journey_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_journey_with_risk(
  uuid, text, text, date, date, text[], text[], integer, text, text, text, text, boolean
) TO authenticated;

COMMENT ON FUNCTION public.insert_journey_with_risk IS
'Inserts a journey with risk_level as text[] (cast to risk_level[] in SQL).
Bypasses PostgREST enum[] serialization issues.
Now includes ai_prompt and is_ai_generated fields.
Authorization: Caller must own the boat.';
```

### Phase 2: Update `createJourneyAndLegsFromRoute` Function

**File:** `app/lib/ai/owner/service.ts`

**Changes:**
1. Add `aiPrompt` parameter to function signature
2. Pass `aiPrompt` and `is_ai_generated: true` to RPC call

**Implementation:**
```typescript
async function createJourneyAndLegsFromRoute(
  supabase: SupabaseClient,
  authenticatedUserId: string,
  boatId: string,
  routeData: {
    journeyName: string;
    description?: string;
    legs: Array<{...}>;
  },
  metadata: {
    risk_level?: string[];
    skills?: string[];
    min_experience_level?: number;
    cost_model?: string;
    cost_info?: string;
    startDate?: string;
    endDate?: string;
  },
  aiPrompt?: string  // NEW PARAMETER
): Promise<{ journeyId: string; journeyName: string; legsCreated: number; error?: string }> {
  // ... existing validation code ...

  const { data: journeyId, error: rpcError } = await supabase.rpc('insert_journey_with_risk', {
    p_boat_id: boatId,
    p_name: routeData.journeyName,
    p_description: routeData.description || null,
    p_start_date: firstLeg?.start_date ?? metadata.startDate ?? null,
    p_end_date: lastLeg?.end_date ?? metadata.endDate ?? null,
    p_risk_level: riskLevelArray,
    p_skills: metadata.skills || [],
    p_min_experience_level: metadata.min_experience_level ?? 1,
    p_cost_model: costModel,
    p_cost_info: metadata.cost_info || null,
    p_state: 'In planning',
    p_ai_prompt: aiPrompt || null,  // NEW
    p_is_ai_generated: !!aiPrompt,  // NEW: true if prompt provided
  });

  // ... rest of function ...
}
```

### Phase 3: Update `generate_journey_route` Tool Execution

**File:** `app/lib/ai/owner/service.ts` (around line ~1534)

**Changes:**
1. Build the AI prompt from `currentMessages` (system prompt + conversation)
2. Pass prompt to `createJourneyAndLegsFromRoute`

**Implementation:**
```typescript
// Inside generate_journey_route tool execution block
if (toolCall.name === 'generate_journey_route') {
  // ... existing argument parsing ...

  // Build AI prompt from current conversation context
  // Include system prompt + conversation history up to this point
  const aiPrompt = currentMessages
    .map(m => `${m.role === 'system' ? 'system' : m.role}: ${m.content}`)
    .join('\n\n');

  // Static code: create journey and legs directly from JSON
  const createResult = await createJourneyAndLegsFromRoute(
    supabase,
    authenticatedUserId!,
    boatId,
    routeData,
    {
      risk_level: normalizedRiskLevel,
      skills: normalizedSkills,
      min_experience_level: args.min_experience_level as number | undefined,
      cost_model: args.cost_model as string | undefined,
      cost_info: args.cost_info as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    },
    aiPrompt  // NEW: Pass the prompt
  );

  // ... rest of code ...
}
```

**Note:** `currentMessages` is available in the `executeOwnerTools` function scope, but we need to pass it or reconstruct the prompt. The best approach is to pass the full prompt text from the `ownerChat` function.

### Phase 4: Update `create_journey` Tool Execution

**File:** `app/lib/ai/owner/service.ts` (around line ~1741)

**Changes:**
1. Accept prompt parameter (needs to be passed from `ownerChat` function)
2. Pass prompt to RPC call

**Implementation:**
```typescript
// Update executeOwnerTools function signature
async function executeOwnerTools(
  supabase: SupabaseClient,
  toolCalls: ToolCall[],
  authenticatedUserId: string | null,
  hasProfile: boolean,
  hasBoat: boolean,
  hasJourney: boolean,
  aiPrompt?: string  // NEW PARAMETER
): Promise<ToolResult[]> {
  // ... existing code ...

  if (toolCall.name === 'create_journey') {
    // ... existing validation ...

    const { data: journeyId, error: rpcError } = await supabase.rpc('insert_journey_with_risk', {
      p_boat_id: args.boat_id as string,
      p_name: args.name as string,
      p_start_date: (args.start_date as string) || null,
      p_end_date: (args.end_date as string) || null,
      p_description: (args.description as string) || null,
      p_risk_level: journeyRiskLevel,
      p_skills: journeySkills,
      p_min_experience_level: (args.min_experience_level as number) ?? 1,
      p_cost_model: costModel,
      p_cost_info: (args.cost_info as string) || null,
      p_state: 'In planning',
      p_ai_prompt: aiPrompt || null,  // NEW
      p_is_ai_generated: !!aiPrompt,  // NEW
    });

    // ... rest of code ...
  }
}
```

### Phase 5: Update `ownerChat` Function to Pass Prompt

**File:** `app/lib/ai/owner/service.ts` (around line ~2146)

**Changes:**
1. Build prompt text from `currentMessages` before tool execution
2. Pass prompt to `executeOwnerTools`

**Implementation:**
```typescript
// Inside the tool execution loop, before calling executeOwnerTools
const promptText = currentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n');

// When calling executeOwnerTools
const toolResults = await executeOwnerTools(
  supabase, 
  toolCalls, 
  authenticatedUserId, 
  hasProfile, 
  hasBoat, 
  hasJourney,
  promptText  // NEW: Pass the full prompt
);

// Also update the generate_journey_route call site
// Inside generate_journey_route execution:
const createResult = await createJourneyAndLegsFromRoute(
  supabase,
  authenticatedUserId!,
  boatId,
  routeData,
  metadata,
  promptText  // Pass the prompt from currentMessages
);
```

## Alternative Approach: Simpler Implementation

Instead of passing the full conversation, we could:
1. Only save the system prompt (simpler, less data)
2. Save a summary of the user's request
3. Save both system prompt and user's last message

**Recommendation:** Save the full prompt (system + conversation) as it provides complete context for debugging and understanding how the journey was generated.

## Implementation Order

1. **Create migration** to update RPC function
2. **Update `createJourneyAndLegsFromRoute`** function signature and call
3. **Update `executeOwnerTools`** function signature and `create_journey` execution
4. **Update `ownerChat`** to build and pass prompt
5. **Update `generate_journey_route`** execution to pass prompt

## Testing Strategy

1. **Test `generate_journey_route`:**
   - Create journey via AI chat
   - Verify `ai_prompt` field is populated
   - Verify `is_ai_generated` is `true`

2. **Test `create_journey` (if still used):**
   - Create journey via direct tool call
   - Verify `ai_prompt` field is populated
   - Verify `is_ai_generated` is `true`

3. **Verify existing functionality:**
   - Ensure journeys created manually (not via AI) still work
   - Ensure `is_ai_generated` is `false` for manual journeys
   - Ensure `ai_prompt` is `null` for manual journeys

## Benefits

1. **Debugging:** Can see exactly what prompt was used to generate a journey
2. **Reproducibility:** Can recreate journeys using the same prompt
3. **Analytics:** Can analyze which prompts lead to better journeys
4. **User Experience:** Users can see how their conversation led to journey creation
5. **Consistency:** Matches the behavior in `app/owner/journeys/propose/page.tsx`

## Considerations

1. **Prompt Size:** Full conversation prompts can be large. Consider:
   - Truncating very long conversations
   - Storing only last N messages
   - Storing compressed/encoded prompts

2. **Privacy:** Prompts contain user conversation data. Ensure:
   - RLS policies prevent unauthorized access
   - GDPR compliance (prompts are user data)

3. **Performance:** Large prompts may impact:
   - Database storage
   - Query performance
   - API response times

**Recommendation:** Start with full prompt storage, monitor size, and add truncation if needed.
