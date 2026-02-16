---
id: TASK-100
title: Refactor owner AI assistant flow
status: Done
assignee: []
created_date: '2026-02-14 10:39'
updated_date: '2026-02-16 05:45'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor owner AI assistant prompting to follow strict flow: 1. sign-u2p 2. Create profile 3. Add boat 4 Post Journey

Restrict the only required tools for AI to use. e.g for 2. Create profile only create_profile tool is available. and e.g 4 Post Journey only generate__journey tool is available.

AI model is not using the profile, boat or journey status fetching tools at all, but the these are checked in code deterministically and the correct statuses are provided to AI to understand the current state of flow. 

Simplify if possible the prompting to AI only give instructions to fullfill and complete the currently active step, with main goal in step is to get if completed and move to next as efficiently as possible.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### 1. Define Canonical Steps (code-only, no DB change)

Map deterministic state to a single "current step" used for prompt and tool selection:

| Step ID              | Condition (code)                                                                 | Next step when…                          |
|----------------------|-----------------------------------------------------------------------------------|------------------------------------------|
| `signup`             | `!authenticatedUserId`                                                            | User authenticates                       |
| `create_profile`     | Authenticated, no profile or profile missing owner role / required fields         | Profile created with `roles` including owner |
| `add_boat`           | Has profile (owner), no boats                                                     | `create_boat` succeeds                   |
| `post_journey`       | Has profile and at least one boat, no journeys                                    | `generate_journey_route` succeeds        |
| `completed`          | Has profile, boat(s), and at least one journey                                    | N/A (onboarding done)                    |

- Keep computing `hasProfile`, `hasBoat`, `hasJourney` in `ownerChat()` as today (queries to `profiles`, `boats`, `journeys`).
- Derive a single `currentStep: 'signup' | 'create_profile' | 'add_boat' | 'post_journey' | 'completed'` from that state.
- Optionally align naming with existing `onboarding_state` in sessions (e.g. `profile_pending`, `boat_pending`, `journey_pending`) for consistency with frontend; implementation can use either a local enum or those strings.

### 2. Step-Based Tool Sets (restrict tools per step)

Define a small set of tools per step; AI receives **only** these tools in the prompt (and in any future tool-calling API).

- **signup**
  - Tools: none (or only public definition tools if needed for answers, e.g. `get_experience_level_definitions`, `get_risk_level_definitions`, `get_skills_definitions`). No profile/boat/journey tools.
- **create_profile**
  - Tools: `update_user_profile` (required). Optionally: definition tools so the AI can answer "what’s experience level 2?" without guessing.
- **add_boat**
  - Tools: `fetch_boat_details_from_sailboatdata`, `create_boat`. No journey or profile-creation tools.
- **post_journey**
  - Tools: `generate_journey_route` only (journey + legs created by this tool; no `create_journey` / `create_leg`).
- **completed**
  - Tools: none (or a minimal set for "what can I do next?" e.g. link to journeys list). No creation tools.

Implementation:

- Add a function e.g. `getToolsForOwnerStep(step: OwnerStep): ToolDefinition[]` that returns only the tools for that step (either by filtering `TOOL_DEFINITIONS` by name or maintaining a step → tool names map). Use this in `ownerChat()` instead of `getToolsForUser(['owner'])` + ad-hoc filtering.
- In `executeOwnerTools`, continue to enforce rules server-side: reject tool calls that don’t match the current step (e.g. if step is `create_profile` and AI somehow asks for `create_boat`, return a clear error). This keeps the system safe even if the model misbehaves.

### 3. Inject Current State in Prompt (no AI status tools)

- Remove all instructions that tell the AI to "call `get_profile_completion_status` / `get_boat_completion_status` / … first".
- In the system prompt, add a single short block that **code** fills in every time, for example:

  - **Signup**: "User is not signed in. Goal: encourage sign up. No profile/boat/journey tools available."
  - **Create profile**: "Current step: Create profile. State: Profile not created. Boat: none. Journey: none. Use only the update_user_profile tool to create the profile with roles including 'owner'. Once the profile is created, the next step will be adding a boat."
  - **Add boat**: "Current step: Add boat. State: Profile created. Boat: none. Journey: none. Use fetch_boat_details_from_sailboatdata then create_boat. Once the boat is created, the next step will be posting a journey."
  - **Post journey**: "Current step: Post journey. State: Profile created. Boat: [boat name/id from get_owner_boats]. Journey: none. Use only generate_journey_route with boatId, startLocation, endLocation, etc. Do not call create_journey or create_leg."
  - **Completed**: "Onboarding complete. Profile, boat(s), and journey(s) exist. No further creation tools."

- For `post_journey`, the backend already has `hasBoat` and can load the user’s boats once; pass boat id/name into the prompt so the AI doesn’t need to "fetch" it via a tool. If we fully remove `get_owner_boats` from the AI’s tool list, the prompt must include the boat id (and optionally name) for `generate_journey_route`.

### 4. Simplify System Prompt per Step

- Replace the single large `buildOwnerSystemPrompt` + `buildToolInstructions` with a **step-specific** builder, e.g. `buildOwnerPromptForStep(step, options)`.
- Each step’s prompt should contain:
  - One short "Current step" and "State" block (injected as above).
  - One short "Goal" line: complete this step and move to the next.
  - Only the tools available for this step (name + short description + required args).
  - Minimal rules: e.g. for profile "gather full_name, user_description, sailing_experience, then call update_user_profile with roles: ['owner']"; for boat "get make/model, call fetch_boat_details_from_sailboatdata, then create_boat with name, type, make_model, capacity"; for journey "call generate_journey_route with boatId, startLocation, endLocation (and optional waypoints/dates)."
- Remove long tool-call examples and duplicate "CRITICAL" sections that span all steps; keep one or two very short examples only for the current step’s tool if needed.
- Keep tool-call format (e.g. \`\`\`tool_call\n{ "name": "...", "arguments": {...} }\n\`\`\`) in one place only, or keep as-is if the model already uses it correctly.

### 5. API and Execution Consistency

- **Route** `app/api/ai/owner/chat/route.ts`: No change to request/response shape; still pass `authenticatedUserId`, `conversationHistory`, etc. All changes are inside `ownerChat()`.
- **ownerChat()**:
  - Compute `hasProfile`, `hasBoat`, `hasJourney` as today.
  - Compute `currentStep` from that.
  - Build prompt with `buildOwnerPromptForStep(currentStep, …)`.
  - Pass to AI only the tool set from `getToolsForOwnerStep(currentStep)` (in prompt text; if later the stack supports structured tool calls, pass the same set there).
  - On approved action: ensure the approved tool is allowed for `currentStep`; if not, return a friendly error.
- **executeOwnerTools**: Keep existing logic for definition tools, `update_user_profile`, `create_boat`, `generate_journey_route`, and journey/leg creation. Add guards that reject tool calls not in the current step’s set (e.g. return "This action is not available in the current step.").

### 6. Optional: Align with Session onboarding_state

- If the frontend or session already uses `onboarding_state` (e.g. `profile_pending`, `boat_pending`, `journey_pending`), the derived `currentStep` can be mapped from or written back to that so the stepper UI stays in sync. This is optional and can be a follow-up.

### 7. Testing and Rollout

- **Unit tests**: For `getToolsForOwnerStep(step)` assert the exact tool names per step. For `currentStep` derivation, test with mocked DB (no profile, no boat; profile no boat; profile + boat no journey; all present).
- **Integration**: Send messages for each step and assert the AI only receives the right tools and state text, and that completion (profile created, boat created, journey created) advances the step.
- **Regression**: Ensure existing flows (profile completion mode, approved actions) still work and that journey creation via `generate_journey_route` still creates journey + legs.

### 8. Files to Touch

| File | Changes |
|------|--------|
| `app/lib/ai/owner/service.ts` | Compute `currentStep`; add `getToolsForOwnerStep(step)`; replace prompt building with step-specific `buildOwnerPromptForStep`; inject state text; remove instructions to call status tools; optionally pass boat id/name for post_journey in prompt. |
| `app/lib/ai/shared/tools/registry.ts` or `app/lib/ai/assistant/tools.ts` | Add `getToolsForOwnerStep` (or keep it in owner/service and import tool definitions from shared). |
| `app/lib/ai/owner/types.ts` | Optionally add `OwnerStep` type and export it. |

### 9. Out of Scope (do not start)

- Changing the crew/prospect assistant flow.
- Adding new tools or new steps.
- Changing DB schema for sessions or profiles for this task.
- Migrating owner chat to a different AI API (e.g. structured tool calls) unless required for the above.

---

## Implementation Order

1. Add `OwnerStep` type and `currentStep` derivation in `ownerChat()`.
2. Implement `getToolsForOwnerStep(step)` and wire it so only these tools are documented in the prompt (and rejected in `executeOwnerTools` if called out of step).
3. Add step-specific prompt builder `buildOwnerPromptForStep(step, …)` with injected state; remove status-tool instructions.
4. For `post_journey`, load boat id (and name) in code and inject into prompt; remove `get_owner_boats` from AI tool set for this step.
5. Simplify `buildToolInstructions` (or remove and fold into step prompt) so it only describes the current step’s tools.
6. Add tests and manual checks for each step; then deploy.
<!-- SECTION:PLAN:END -->

## Review Summary

### Current Behaviour
- **Owner chat service** (`app/lib/ai/owner/service.ts`): Builds a single large system prompt that lists all owner tools and instructs the AI to "check completion status first" by calling `get_profile_completion_status`, `get_boat_completion_status`, `get_journey_completion_status`, `get_owner_boats`, `get_owner_journeys`. Completion state (`hasProfile`, `hasBoat`, `hasJourney`) is already computed **deterministically in code** (lines 1993–2032) before the prompt is built, but the AI is still told to call status tools, which wastes turns and adds complexity.
- **Tool filtering**: Tools are filtered post-completion (e.g. hide `update_user_profile` if `hasProfile`, hide `create_boat` if `hasBoat`), but the AI still sees many tools (definitions, status fetchers, create tools for later steps) and long instructions for all steps.
- **Prompt size**: `buildOwnerSystemPrompt` and `buildToolInstructions` together produce a very long prompt covering signup, profile, boat, and journey in one go, with many tool-call examples and rules.

### Desired Behaviour (per task)
1. **Strict linear flow**: Sign up → Create profile → Add boat → Post journey. Only one "active" step at a time.
2. **Tool restriction per step**: Expose only the tools needed for the **current** step (e.g. step "Create profile" → only `update_user_profile` plus optional definition helpers; step "Post journey" → only `generate_journey_route`).
3. **No status tools for AI**: Do not expose or instruct the AI to call `get_profile_completion_status`, `get_boat_completion_status`, `get_journey_completion_status`, `get_owner_boats`, `get_owner_journeys`. Status is computed in code and passed as plain text in the system prompt (e.g. "Current step: Create profile. Profile: not created. Boat: not created. Journey: not created.").
4. **Simpler prompts**: One short block per step: goal of current step, current state (injected by code), and the one (or few) tools available for that step. Goal: complete current step and move to next as efficiently as possible.

---
