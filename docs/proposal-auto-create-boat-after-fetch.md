# Proposal: Auto-call create_boat after fetch_boat_details success (owner chat)

## Question

Should we hardcode logic so that when `fetch_boat_details_from_sailboatdata` returns success with sailboat data, the code **directly** calls `create_boat` (without asking the AI again), then prompts the AI only to continue with journey creation?

## Current flow

1. User provides boat info (e.g. "Grand Soleil 43 – Admiral Fyodor").
2. AI calls `fetch_boat_details_from_sailboatdata` with `make_model` (e.g. "Grand Soleil 43").
3. Tool returns: `type`, `capacity`, `loa_m`, `beam_m`, specs, etc. (no boat **name**).
4. AI is expected to: show summary → user confirms → AI calls `create_boat` with `name`, `type`, `make_model`, `capacity`.
5. Often the AI fails to call `create_boat` (wrong format, or says "created" without calling), so we added nudges and server-side state fixes.

## What we’d need for “auto create_boat”

- **create_boat** requires at least: `name`, `type`, `make_model`, `capacity` (and `owner_id`).
- **fetch_boat_details** gives us: `type`, `capacity`, and we have `make_model` from the fetch **request** args. It does **not** return a boat name.
- **Boat name** (e.g. "Admiral Fyodor") comes only from the user/conversation, not from SailboatData.

So we cannot fully auto-call `create_boat` without a **name**. We have two options:

- **A) Default name = make_model**  
  After a successful fetch, auto-call `create_boat` with `name: make_model` (e.g. "Grand Soleil 43"). No user confirmation. Then ask AI to continue to journey. User can rename the boat later in app if they want (e.g. "Admiral Fyodor").
- **B) Heuristic name from conversation**  
  When we’re about to auto-create, try to derive a name from the current or recent user message (e.g. "Grand Soleil 43 – Admiral Fyodor" → name "Admiral Fyodor"; or "boat name: X"). If we find one, use it; otherwise fall back to `make_model`. Then auto-call `create_boat` and prompt AI for journey.

---

## Option A: Auto create_boat with name = make_model

**Logic:** In the owner chat tool loop, after `executeOwnerTools` runs: if there is a successful `fetch_boat_details_from_sailboatdata` result, no `create_boat` in this turn, and we have `authenticatedUserId` and step is `add_boat`, then:

1. Build create_boat args: `name = make_model` (from fetch call args), `type`, `capacity`, `make_model` from fetch result/args.
2. Call `create_boat` programmatically (same path as when AI calls it).
3. Append the create_boat result to tool results, then prompt the AI with: “Boat has been created. Tell the user and suggest creating their first journey.”

**Pros**

- Removes dependence on the AI actually calling `create_boat` (no more “created successfully” without a real call).
- One less round-trip and no tool-call parsing for create_boat.
- Onboarding state can be updated reliably (boat_pending → journey_pending) because creation is deterministic in code.
- Simpler, predictable behavior.

**Cons**

- Boat is created with **name = make_model** (e.g. "Grand Soleil 43") instead of the user’s preferred name (e.g. "Admiral Fyodor") unless they rename later.
- No explicit “confirm boat summary” step; we skip straight to “boat created, now journey.” Some users might want to see the summary and confirm before creation.
- If fetch returns success but create_boat fails (e.g. duplicate boat, validation), we must surface that error and possibly let the AI explain; flow becomes a bit more complex than “always show summary then confirm.”

---

## Option B: Heuristic name + auto create_boat

Same as A, but we try to set `name` from conversation:

- Scan current user message (and maybe last 1–2 user messages) for patterns like:
  - `"make/model – Name"` (e.g. "Grand Soleil 43 – Admiral Fyodor" → name "Admiral Fyodor"),
  - or "boat name: X", "name: X", etc.
- If we find a plausible name (e.g. not empty, not identical to make_model), use it; else use `make_model`.

**Pros**

- When the user already said a name, we keep it without an extra confirmation step.
- Fewer boats named only by make/model.

**Cons**

- Heuristics can be wrong (e.g. wrong phrase extracted as name, or name from an old message).
- More code and edge cases; need to define “plausible” and which messages to scan.
- Still need a fallback (e.g. make_model) when no name is found.

---

## Option C: Keep current flow (no auto create_boat)

Rely on AI to call `create_boat` after fetch + summary, with existing nudges and server-side onboarding_state updates when create_boat actually runs.

**Pros**

- User explicitly confirms the boat summary and can correct name/details in natural language before creation.
- No new hardcoded naming logic; AI can use full conversation context for name.
- No risk of creating a boat with a wrong/heuristic name.

**Cons**

- AI may still occasionally fail to call the tool (format/parsing); we mitigate with nudges and “tool call failed” note, but it’s not 100% deterministic.
- Extra turn (summary → confirm → create_boat).

---

## Recommendation

- **Short term:** Prefer **Option C** (keep current flow). We’ve already improved reliability (nudges, server-side onboarding_state, “don’t hallucinate” note). Auto-creating with `name = make_model` (Option A) is a noticeable UX change (no confirmation, different default name) and may surprise users who expect to confirm or set a boat name first.
- **If we want to eliminate AI create_boat failures entirely:** **Option A** is the most robust and simple: auto create_boat with `name = make_model` after fetch success, then prompt AI only for journey. We should then:
  - Document that the boat is created with the make/model as name and can be renamed in the app.
  - Optionally add a single, optional AI step before auto-create: “Here’s the boat we found: [summary]. If you want a different name, say it now; otherwise we’ll create it as ‘Grand Soleil 43’.” That keeps one chance to set the name without relying on the AI to call create_boat.
- **Option B** is possible but adds complexity and risk of wrong names; only consider if we strongly want to preserve user-stated names without confirmation and are willing to maintain heuristics.

**Summary:** It is **possible** to hardcode “fetch success → create_boat → then AI for journey.” The main design choice is how to set **name** (make_model only vs heuristic from conversation). Recommendation: either keep current flow (C) or introduce auto-create with name = make_model (A) and document/optional quick “name?” step; avoid heuristic name extraction (B) unless we have a clear, narrow pattern set and product buy-in.
