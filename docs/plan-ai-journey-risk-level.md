# Plan: AI-Assessed Journey Risk Level (generate_journey)

## Goal
Add a feature so that the **generate_journey** flow asks the AI to assess and return a **journey-level risk classification** (Coastal Sailing, Offshore Sailing, or Extreme Sailing). Use this AI-proposed risk level when creating the journey in:
1. **Owner AI chat** (after `generate_journey_route` → `createJourneyAndLegsFromRoute`)
2. **Propose Journey dialog** (when the user accepts the generated journey and saves it)

Risk is assessed **for the journey as a whole**, not per leg.

---

## Current state

- **`app/lib/ai/generateJourney.ts`**: Builds a prompt and calls AI; expects JSON with `journeyName`, `description`, `legs[]`. Does **not** ask for or parse a journey risk level.
- **`app/lib/ai/owner/service.ts`**: On `generate_journey_route` success, calls `createJourneyAndLegsFromRoute(..., routeData, { risk_level: normalizedRiskLevel, ... })`. `normalizedRiskLevel` comes only from **tool args** (`args.risk_level`), not from the generate result.
- **`app/owner/journeys/propose/page.tsx`**: Calls `/api/ai/generate-journey`, then on "Accept" inserts a journey via `supabase.from('journeys').insert(journeyInsertData)`. **Does not set `risk_level`** on the journey (so it stays default/empty).
- **DB**: `journeys.risk_level` exists (array or scalar depending on migration; RPC `insert_journey_with_risk` takes `text[]` and uses first valid value). Valid values: `'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing'`.

---

## Implementation plan

### 1. Generate journey: prompt and response shape (`app/lib/ai/generateJourney.ts`)

- **Prompt**
  - Add a short instruction block asking the AI to **assess the overall journey risk** and return a single classification:
    - **Coastal sailing**: near-shore, sheltered, short passages.
    - **Offshore sailing**: open water, multi-day passages, out of sight of land.
    - **Extreme sailing**: high latitude, heavy weather, remote areas, etc.
  - State that this is for the **whole journey**, not per leg.

- **JSON schema in prompt**
  - Add a top-level field: `"riskLevel": "Coastal sailing"` (or `"Offshore sailing"` or `"Extreme sailing"`).
  - Specify that the value must be exactly one of these three strings.

- **Types**
  - Extend `GenerateJourneyResult['data']` with optional `riskLevel?: string`.

- **Parsing / validation**
  - After parsing the AI JSON, if `riskLevel` is present, validate it against `['Coastal sailing', 'Offshore sailing', 'Extreme sailing']`.
  - If invalid or missing, leave `riskLevel` undefined (do not fail the whole response).

### 2. Owner AI: use AI-assessed risk in create journey (`app/lib/ai/owner/service.ts`)

- In the `generate_journey_route` handler, when calling `createJourneyAndLegsFromRoute`:
  - Compute risk for metadata as: **prefer `routeData.riskLevel` from the generate result, fallback to existing `normalizedRiskLevel` from tool args.**
  - Example: `risk_level: (routeData.riskLevel && validRiskLevels.includes(routeData.riskLevel)) ? [routeData.riskLevel] : normalizedRiskLevel`.

- Optionally include the chosen risk level in the tool result message to the AI (e.g. “Journey created with risk level: Offshore sailing”) so the assistant can mention it to the user.

### 3. Propose Journey dialog (`app/owner/journeys/propose/page.tsx`)

- **Save journey**
  - In `handleAccept`, when building `journeyInsertData`, set `risk_level` from the generated journey when present:
    - e.g. `risk_level: generatedJourney.riskLevel && validRiskLevels.includes(generatedJourney.riskLevel) ? [generatedJourney.riskLevel] : []`  
    - Use the same enum list as elsewhere: `['Coastal sailing', 'Offshore sailing', 'Extreme sailing']`.
  - Ensure the insert still complies with the DB (e.g. if the column is `risk_level[]`, pass an array; if RPC is used elsewhere for journeys, we keep direct insert but with the same risk values).

- **UI (optional but recommended)**
  - When showing the generated journey summary (after “Generate”), display the AI-assessed risk level if present, e.g. “Risk level: Offshore sailing”.

### 4. API route (`app/api/ai/generate-journey/route.ts`)

- No change required. It already returns `result.data`; once `generateJourneyRoute` includes `riskLevel` in `data`, the API response will expose it automatically.

### 5. Tool definition (`app/lib/ai/shared/tools/definitions.ts`)

- Optional: in the `generate_journey_route` tool description, add a line that the tool returns an **AI-assessed journey risk level** (Coastal / Offshore / Extreme) which is used when creating the journey, so the AI can inform the user. No new parameters required.

---

## Files to touch

| File | Changes |
|------|--------|
| `app/lib/ai/generateJourney.ts` | Prompt + JSON schema for `riskLevel`; type `GenerateJourneyResult.data`; validate and pass through `riskLevel`. |
| `app/lib/ai/owner/service.ts` | Use `routeData.riskLevel` when calling `createJourneyAndLegsFromRoute`; optionally include risk in tool result message. |
| `app/owner/journeys/propose/page.tsx` | Set `risk_level` in `journeyInsertData` from `generatedJourney.riskLevel`; optionally show risk in summary UI. |
| `app/api/ai/generate-journey/route.ts` | No change. |
| `app/lib/ai/shared/tools/definitions.ts` | Optional: short note in `generate_journey_route` description about returned risk level. |

---

## Testing (manual)

1. **Owner AI**
   - Run through onboarding until “post journey”; trigger `generate_journey_route` with a route (e.g. Palma → Ibiza).
   - Confirm a journey is created and, in DB or UI, that its `risk_level` is set (e.g. “Coastal sailing” or “Offshore sailing” as appropriate).
   - Confirm the AI can say something like “Journey created with risk level: Coastal sailing” when the tool result includes it.

2. **Propose Journey**
   - Open Propose Journey, select boat and route, generate.
   - Confirm the summary shows the AI-assessed risk level if we add that UI.
   - Accept and save; confirm the created journey has `risk_level` set correctly in the DB / journey detail.

3. **Edge cases**
   - Generate a journey; if the AI omits or returns invalid `riskLevel`, creation should still succeed (owner flow uses args or empty; propose uses empty array).

---

## Summary

- **generate_journey** (prompt + parsing): ask for and parse a single **riskLevel** for the journey; add to `GenerateJourneyResult.data`.
- **Owner AI**: pass `routeData.riskLevel` into `createJourneyAndLegsFromRoute` (with fallback to args); optionally surface it in the tool result text.
- **Propose Journey**: set `risk_level` on the inserted journey from `generatedJourney.riskLevel` and optionally show it in the summary.

No DB migrations required; we only set existing `journeys.risk_level` from the AI output.
