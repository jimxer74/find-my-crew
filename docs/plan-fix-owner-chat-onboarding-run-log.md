# Plan: Fix Owner Chat Onboarding (from run.log analysis)

## Problems identified

1. **AI does not call `create_boat` after user confirmation**  
   User said “Confirm the boat details for Soulstice”; the AI replied in text only. The nudge (“Call the create_boat tool now…”) was sent repeatedly but the AI still did not reliably call `create_boat` (or called the wrong tool).

2. **AI calls `create_journey` while step is still `add_boat`**  
   In `add_boat`, only `fetch_boat_details_from_sailboatdata` and `create_boat` are allowed. The AI tried `create_journey`, which was correctly rejected with “This action is not available in the current step.” The model was confused about which step it was in.

3. **Wrong `create_journey` arguments**  
   When the AI did call `create_journey`, it used invalid parameters (`journey_name`, `starting_point`, `destination`, `waypoint_density`) instead of the real schema (`boat_id`, `name`, plus route/leg data). For route-based journeys the correct flow is **`generate_journey_route`** (in `post_journey` step), not `create_journey` with placeholders.

4. **Duplicate `create_boat` → dead end**  
   After the boat “Soulstice” already existed, the AI called `create_boat` again and got “A boat named ‘Soulstice’ already exists.” The backend correctly rejects duplicates, but the conversation has no way to “succeed” and advance, so the user stays stuck.

---

## Proposed fixes (no code changes until approved)

### Fix 1: Treat “boat already exists” as success and advance step

**Where:** `app/lib/ai/owner/service.ts` – `create_boat` tool execution and completion detection.

**What:**

- When `create_boat` fails with an error message that indicates a **duplicate name** (e.g. “already exists” / “A boat named … already exists”):
  - **Option A (recommended):** Return a **success-like result** to the AI instead of an error, e.g.  
    `{ boatAlreadyExists: true, message: "This boat is already in your fleet. You can proceed to create your journey." }`  
    and in the same request, set **`boatCreated = true`** so the route persists `onboarding_state` to `journey_pending`.
  - **Option B:** Keep returning an error to the AI but **still set `boatCreated = true`** when we detect duplicate-by-name (so the **next** request has `hasBoat = true` and step becomes `post_journey`). The current request would still end with the error in the reply.

**Rationale:** Once the boat exists in the DB, the goal of “add boat” is satisfied. Treating duplicate as “already done” unblocks the user and avoids the AI retrying `create_boat` forever.

**Implementation detail:** In the loop where we set `boatResult` / `boatCreated`, add a branch: if the tool was `create_boat` and the result is an error whose message matches the duplicate-name pattern, treat it as “boat step complete” (set `boatCreated = true` and optionally return a success-style message to the AI as in Option A).

---

### Fix 2: Stronger nudge and single-tool focus in `add_boat`

**Where:** `app/lib/ai/owner/service.ts` – step prompt for `add_boat` and nudge message when user confirms but no tool call.

**What:**

- **Prompt:** In the `add_boat` step instructions, add one explicit line:  
  **“In this step you may ONLY use fetch_boat_details_from_sailboatdata and create_boat. Do NOT call create_journey or generate_journey_route.”**
- **Nudge:** Make the nudge more directive and include a concrete example:
  - Current: *“The user confirmed. Call the create_boat tool now with the boat details you just summarized (name, type, make_model, capacity). Use valid JSON in a tool_call block.”*
  - New (example): *“The user confirmed. You MUST call the create_boat tool in this response. Use exactly this structure with the boat details from your last message: \`\`\`tool_call\n{"name": "create_boat", "arguments": {"name": "...", "type": "...", "make_model": "...", "capacity": ...}}\n\`\`\` Replace the ... with the actual name, type, make_model, and capacity you already showed. No other tool is allowed in this step.”*

**Rationale:** Reduces confusion about which step the AI is in and what to do after confirmation; the example reduces parsing errors and increases the chance the model actually emits a valid `create_boat` call.

---

### Fix 3: Clarify journey creation in `post_journey` (and tool definitions)

**Where:**  
- `app/lib/ai/owner/service.ts` – `post_journey` step instructions.  
- `app/lib/ai/shared/tools/definitions.ts` – `generate_journey_route` and optionally `create_journey` descriptions.

**What:**

- **Step prompt (`post_journey`):** State clearly:  
  **“To create a journey from a route (e.g. Jamaica to San Blas), you MUST call generate_journey_route with startLocation, endLocation, boatId, and optional waypoints/dates. Do NOT call create_journey for route-based journeys; create_journey is not available in this step.”**  
  (Since `post_journey` only exposes `generate_journey_route`, the AI cannot call `create_journey` here; the prompt prevents the model from “trying” the wrong tool when it later moves to this step.)
- **Tool definition (`generate_journey_route`):** Add one sentence:  
  **“For any journey that has a start and end location (e.g. ‘Jamaica to San Blas’), use this tool with startLocation, endLocation, boatId; it creates the journey and legs in one go.”**
- **Tool definition (`create_journey`):** Add a note (for when it is exposed elsewhere):  
  **“Only for creating a journey without route/legs. For start-to-end routes, use generate_journey_route instead.”**

**Rationale:** Aligns the AI with the actual API: route-based journeys → `generate_journey_route` with the correct parameters; no `create_journey` with `journey_name` / `starting_point` / `destination`.

---

### Fix 4 (optional): Limit nudge iterations for add_boat

**Where:** `app/lib/ai/owner/service.ts` – loop where we detect “user confirmed but no create_boat” and push the nudge.

**What:** Track how many times we have already nudged for “confirm boat” in this request (e.g. a counter or “nudge already sent” flag). After 1–2 nudges, instead of nudging again:
- Either inject a **system-style message** that says the boat already exists and the user can proceed to “Create your first journey”, **or**
- Rely on Fix 1: if the AI then calls `create_boat` and gets “already exists”, we treat it as success and advance (so we don’t need to nudge forever).

**Rationale:** Avoids long loops of repeated identical nudges and can help the conversation move on (especially combined with Fix 1).

---

## Summary table

| # | Fix | Purpose |
|---|-----|--------|
| 1 | Treat “boat already exists” as step success | Unblock user when boat is already in DB; allow advancing to journey step. |
| 2 | Stronger add_boat prompt + nudge with example | Increase chance the AI calls `create_boat` after confirmation and only uses allowed tools. |
| 3 | Clarify post_journey + generate_journey_route vs create_journey | Prevent wrong tool and wrong parameters for route-based journeys. |
| 4 | (Optional) Cap add_boat nudge iterations | Avoid infinite nudge loop; combine with Fix 1 for clean advance. |

---

## Implementation order

1. **Fix 1** – Duplicate boat → success (and optionally success-style message to AI).  
2. **Fix 2** – add_boat prompt and nudge text.  
3. **Fix 3** – post_journey prompt and tool descriptions.  
4. **Fix 4** – Optional nudge cap.

No code has been changed yet; implement after approval.
