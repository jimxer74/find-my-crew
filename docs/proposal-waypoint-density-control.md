# Proposal: Waypoint Density Control for Journey Route Generation

## Problem Statement

When using sophisticated LLMs (e.g., Claude Opus) for `generate_journey_route`, the AI creates very detailed routes with many waypoints. This is excessive for the use case, which is:
- **High-level journey planning** for crew exchange opportunities
- **Not** a full navigation planning tool
- Focus should be on **crew exchange points** (ports, marinas, towns) rather than detailed routing waypoints

## Current Behavior

The current prompt in `app/lib/ai/generateJourney.ts` instructs:
- Leg start/end must be at ports/towns/cities/marinas (crew exchange points) ✅
- Intermediate waypoints can be "anywhere relevant for navigation" ⚠️
- "Include intermediate waypoints ONLY if they add value" ⚠️ (too vague)

Sophisticated LLMs interpret this as permission to add many detailed waypoints for optimal routing, resulting in:
- 10-20+ waypoints per leg
- Overly detailed navigation planning
- Cluttered journey visualization
- Not aligned with the high-level planning use case

## Proposed Solution

### Approach 1: Prompt-Based Control (Recommended)

Add explicit waypoint density guidance in the prompt based on a `waypointDensity` parameter.

**Parameters:**
- `waypointDensity`: `'minimal' | 'moderate' | 'detailed'` (default: `'moderate'`)

**Implementation:**
1. Add `waypointDensity` parameter to `GenerateJourneyInput` interface
2. Add corresponding instructions to the prompt based on density level
3. Update tool definition to include this parameter
4. Update AI instructions to guide the model on waypoint limits

**Prompt Instructions by Density:**

```typescript
const waypointDensityInstructions = {
  minimal: `
WAYPOINT DENSITY: MINIMAL (High-level planning only)
- Create ONLY crew exchange points (ports, marinas, towns, cities)
- NO intermediate waypoints between leg start and end
- Each leg should have exactly 2 waypoints: start port and end port
- Focus on major ports/cities where crew can join/leave
- This is for high-level journey planning, not detailed navigation
- Maximum waypoints per leg: 2 (start + end only)
`,

  moderate: `
WAYPOINT DENSITY: MODERATE (Balanced planning)
- Primary focus: Crew exchange points (ports, marinas, towns, cities)
- Include intermediate waypoints ONLY for:
  * Major routing decisions (e.g., passing through a strait, avoiding dangerous area)
  * Significant stops where crew might want to join/leave
  * Major landmarks or islands that define the route
- Do NOT add waypoints for minor navigation adjustments
- Maximum waypoints per leg: 4 (start + end + up to 2 intermediate)
- Prefer fewer waypoints - quality over quantity
`,

  detailed: `
WAYPOINT DENSITY: DETAILED (Comprehensive routing)
- Include crew exchange points AND navigation waypoints
- Add intermediate waypoints for:
  * Safe routing around hazards
  * Navigation waypoints for optimal passage
  * Interesting stops or landmarks
- Maximum waypoints per leg: 8
- Use when detailed navigation planning is needed
`
};
```

**Benefits:**
- Simple to implement
- Works with any LLM model
- Clear guidance for AI
- Backward compatible (default to 'moderate')

**Limitations:**
- LLM might still ignore instructions (especially sophisticated models)
- No hard enforcement, only guidance

---

### Approach 2: Post-Processing Filtering

Add post-processing step to reduce waypoints after AI generation.

**Implementation:**
1. After AI generates route, analyze waypoint density
2. If waypoints exceed threshold for density level, filter them:
   - Keep start and end waypoints (always)
   - For intermediate waypoints:
     - Calculate distance between waypoints
     - Keep only waypoints that are:
       * At least X nautical miles apart (configurable)
       * At ports/towns/cities (crew exchange points)
       * At major routing points (straits, channels, etc.)
3. Re-index waypoints after filtering

**Filtering Rules:**

```typescript
function filterWaypointsByDensity(
  waypoints: Waypoint[],
  density: 'minimal' | 'moderate' | 'detailed'
): Waypoint[] {
  if (waypoints.length <= 2) return waypoints;
  
  const [start, ...intermediates, end] = waypoints;
  const filtered = [start];
  
  const minDistance = {
    minimal: 200,    // 200+ nm between waypoints
    moderate: 100,   // 100+ nm between waypoints
    detailed: 50     // 50+ nm between waypoints
  }[density];
  
  // Keep only waypoints that are far enough apart
  let lastKept = start;
  for (const wp of intermediates) {
    const distance = calculateDistance(lastKept, wp);
    if (distance >= minDistance || isCrewExchangePoint(wp)) {
      filtered.push(wp);
      lastKept = wp;
    }
  }
  
  filtered.push(end);
  return filtered.map((wp, idx) => ({ ...wp, index: idx }));
}
```

**Benefits:**
- Hard enforcement of waypoint limits
- Works regardless of LLM behavior
- Can be combined with prompt-based approach

**Limitations:**
- More complex implementation
- Requires distance calculation logic
- Might remove waypoints user actually wanted
- Need to detect "crew exchange points" vs navigation waypoints

---

### Approach 3: Model-Specific Configuration

Configure waypoint density based on the LLM model being used.

**Implementation:**
1. In AI config, add `waypointDensity` per model/use case
2. Sophisticated models (Opus, GPT-4) → default to 'minimal' or 'moderate'
3. Simpler models → can use 'detailed' if needed
4. Allow override via parameter

**Example Config:**

```typescript
// app/lib/ai/config/dev.ts
export const devConfig: EnvironmentConfig = {
  useCases: {
    'generate-journey': {
      models: [
        {
          provider: 'anthropic',
          model: 'claude-3-opus-20240229',
          waypointDensity: 'minimal', // Override default for Opus
        },
        {
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          waypointDensity: 'moderate', // Default for simpler models
        },
      ],
    },
  },
};
```

**Benefits:**
- Automatic optimization per model
- No user input needed
- Can be fine-tuned per model behavior

**Limitations:**
- Less flexible - user can't override
- Requires model-specific tuning
- Doesn't solve the core issue if model ignores instructions

---

### Approach 4: Hybrid Approach (Recommended)

Combine **Approach 1 (Prompt-Based)** + **Approach 2 (Post-Processing)** + **Approach 3 (Model Config)**.

**Implementation Strategy:**

1. **Add `waypointDensity` parameter** to `GenerateJourneyInput`:
   ```typescript
   export interface GenerateJourneyInput {
     // ... existing fields
     waypointDensity?: 'minimal' | 'moderate' | 'detailed';
   }
   ```

2. **Update prompt** with explicit density instructions (Approach 1)

3. **Add post-processing filter** as safety net (Approach 2):
   - Only activate if waypoints exceed density threshold
   - Log when filtering occurs for monitoring

4. **Add model-specific defaults** in AI config (Approach 3):
   - Sophisticated models default to 'minimal'
   - Can be overridden per use case

5. **Update tool definition** to include `waypointDensity` parameter:
   ```typescript
   {
     name: "generate_journey_route",
     parameters: {
       // ... existing parameters
       waypointDensity: {
         type: "string",
         enum: ["minimal", "moderate", "detailed"],
         description: "Control waypoint density: 'minimal' for high-level planning (2 waypoints/leg), 'moderate' for balanced (max 4/leg), 'detailed' for comprehensive routing (max 8/leg)"
       }
     }
   }
   ```

6. **Update AI instructions** in `buildToolInstructions`:
   ```typescript
   **generate_journey_route WAYPOINT DENSITY:**
   - **waypointDensity** (string, optional, defaults to 'moderate'): Controls how many waypoints are created
     - 'minimal': High-level planning only - 2 waypoints per leg (start + end ports)
     - 'moderate': Balanced - max 4 waypoints per leg (start + end + up to 2 intermediate)
     - 'detailed': Comprehensive routing - max 8 waypoints per leg
   - For crew exchange planning, prefer 'minimal' or 'moderate'
   - Use 'detailed' only when full navigation planning is needed
   ```

## Implementation Plan

### Phase 1: Core Parameter Support
1. ✅ Add `waypointDensity` to `GenerateJourneyInput` interface
2. ✅ Add prompt instructions based on density level
3. ✅ Update `generate_journey_route` tool definition
4. ✅ Update AI instructions in `buildToolInstructions`

### Phase 2: Post-Processing Safety Net
1. ✅ Implement waypoint filtering function
2. ✅ Add distance calculation utility
3. ✅ Integrate filtering into `generateJourneyRoute` function
4. ✅ Add logging for monitoring

### Phase 3: Model-Specific Configuration
1. ✅ Add `waypointDensity` to model config
2. ✅ Set defaults per model sophistication
3. ✅ Allow override via parameter

### Phase 4: Testing & Validation
1. ✅ Test with different LLM models
2. ✅ Verify waypoint counts match density settings
3. ✅ Test edge cases (very long journeys, short journeys)
4. ✅ Monitor production usage

## Configuration Examples

### Default Behavior (Backward Compatible)
```typescript
// No parameter provided → defaults to 'moderate'
generateJourneyRoute({
  startLocation: {...},
  endLocation: {...},
  boatId: '...',
  // waypointDensity not specified → 'moderate'
});
```

### High-Level Planning (Recommended for Crew Exchange)
```typescript
generateJourneyRoute({
  startLocation: {...},
  endLocation: {...},
  boatId: '...',
  waypointDensity: 'minimal', // Only crew exchange points
});
```

### Model-Specific Default
```typescript
// In AI config
{
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  waypointDensity: 'minimal', // Opus tends to over-generate waypoints
}
```

## Expected Outcomes

### Before (Current)
- Opus generates 15-20 waypoints per leg
- Overly detailed navigation planning
- Cluttered visualization
- Not aligned with use case

### After (With 'minimal' density)
- 2-4 waypoints per leg
- Focus on crew exchange points
- Clean, high-level journey visualization
- Aligned with use case

## Migration Strategy

1. **Backward Compatible**: Default to 'moderate' if not specified
2. **Gradual Rollout**: Start with prompt-based approach, add post-processing if needed
3. **Monitoring**: Track waypoint counts per density setting to validate effectiveness
4. **User Feedback**: Allow users to adjust density if needed

## Open Questions

1. Should `waypointDensity` be user-configurable in the UI, or only via AI chat?
2. Should we add a "smart" density that auto-detects journey length?
3. Should post-processing be always-on or only when threshold exceeded?
4. How to handle user-specified intermediate waypoints? (Should they count toward density limit?)

## Recommendation

**Implement Hybrid Approach (Approach 4)** with:
- Primary: Prompt-based control (Approach 1)
- Safety net: Post-processing filter (Approach 2) - only activate if waypoints exceed threshold
- Optimization: Model-specific defaults (Approach 3)

This provides:
- ✅ Clear guidance for AI
- ✅ Hard enforcement if AI ignores instructions
- ✅ Automatic optimization per model
- ✅ Backward compatibility
- ✅ Flexibility for future needs
