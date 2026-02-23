---
id: TASK-126
title: Refactor owner onboarding AI assistant
status: To Do
assignee: []
created_date: '2026-02-22 12:12'
updated_date: '2026-02-23 08:21'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Main principle is that user is not given a free chat capabality, but instead a context specific action or input control is displayed to user based on AI assessment and proposed step.

AI should allways respond in either of the options:
A) Ask clarification to fill or correct missing information --> This is implemented in context specific UI control to user, e.g. if AI asks user to specify Experiece level (Beginner, Comptentent crew, Coastal Skipper, Offshore Skipper)  this is displayd to user as Radiobutton selection, where user selects the approriate radiobutton and clicks Confirm
or if AI ask user to provide the boat makemodel, an input textbox is displayed where user can type in the boat makemodel

B) Ask to confirm that the gathered data is relevant and ok. e.g. display user profile, boat or journey data. User can either "Confirm" or "Cancel" and if confirmed the action is executed

C) Sign-up or Logi-in function to nudge user to sign-in if not already done so

Remove the current SUGGESTION functionality
Add exit onboarding assistant button to header after user has signed-in
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# TASK-126: Refactor Owner Onboarding AI Assistant - Implementation Plan

## Overview
Transform the owner onboarding from free-form chat with suggestions to a guided, context-specific interaction model. AI assessment determines next action; users interact through purpose-built UI controls (radio buttons, text inputs, refinement feedback).

## Three Response Types

**A) CLARIFICATION REQUEST** → Context-specific UI input
- AI asks: "What's your experience level?" 
- UI auto-detects: Radio buttons for options, text input for open questions, date picker for dates
- User selects/enters → AI processes → Next step

**B) CONFIRMATION REQUEST** → Data review + refinement loop
- AI asks: "Confirm your profile?"
- UI shows collected data with [Confirm] [Edit] buttons
- Cancel opens feedback text: "What would you like to change?"
- AI analyzes feedback → Updates data → Shows confirmation again (iterative refinement)

**C) AUTH NUDGE** → Sign-in/signup
- AI: "Please sign in to continue"
- UI: Triggers auth modals

## Implementation Phases

### Phase 1: Remove Suggestion Functionality
- Delete `SuggestedPrompts` component from OwnerChat.tsx
- Remove `extractSuggestedPrompts()` and `removeSuggestionsFromContent()` from message-parsing.ts
- Update AI prompts to NOT use [SUGGESTIONS] format

### Phase 2: Create Context-Specific UI Components
- **ClarificationInput.tsx**: Auto-detects control type from question context (radio/text/date/multi-select)
- **ConfirmationDisplay.tsx**: Shows data + Confirm/Edit buttons; Edit opens feedback loop
- **AuthNudge.tsx**: Sign-in/signup encouragement
- **ExitConfirmationDialog.tsx**: "Are you sure?" confirmation for exit button

### Phase 3: Update Message Response Handling
- Extend OwnerMessage metadata with:
  - `responseType: 'clarification' | 'confirmation' | 'auth_nudge' | 'info'`
  - `questionType`: For auto-detection logic
  - `dataType`: For confirmation rendering
- Update OwnerChat.tsx message rendering to check metadata and render appropriate component

### Phase 4: Update AI Service & Prompts
- Restructure prompts in buildOwnerPromptForStep() to guide AI toward CLARIFICATION/CONFIRMATION format
- Update backend parsing to extract response type and subtype metadata
- Example format: `CLARIFICATION:text:boat_name` or `CONFIRMATION:profile-summary`

### Phase 5: Add Exit Button to Header
- Add button visible only when: authenticated + on onboarding page
- On click: Show confirmation dialog "Are you sure you want to exit?"
- If confirmed: Close session (like normal completion) → Navigate to `/owner/profile`

## Critical Files
| File | Action |
|------|--------|
| OwnerChat.tsx | Remove suggestions, add component rendering logic |
| ClarificationInput.tsx | NEW - Auto-detect UI control type |
| ConfirmationDisplay.tsx | NEW - Data display + refinement loop |
| AuthNudge.tsx | NEW - Sign-in encouragement |
| ExitConfirmationDialog.tsx | NEW - Exit confirmation |
| Header.tsx | Add exit button (authenticated users only) |
| service.ts | Update prompts, change response format |
| message-parsing.ts | Remove suggestion functions |
| OwnerChatContext.tsx | Add closeSession() function |
| types.ts | Extend OwnerMessage metadata |

## Confirmation Refinement Loop Detail
```
User sees confirmation display with data
    ↓ clicks "Edit"
Text input: "What would you like to change?"
    ↓ user types feedback
"Change name to Jane, remove skill X"
    ↓ submit
AI analyzes and updates profile
    ↓
Show confirmation again with updated data
    ↓ user can Confirm or Edit again (loop continues)
```

## Testing Checklist
- [ ] No suggested prompts appear anywhere
- [ ] Clarification inputs auto-detect: radio for choices, text for open, date for dates
- [ ] Answer clarification → next question appears
- [ ] Confirmation display shows gathered data correctly
- [ ] Click Edit → feedback input appears → type feedback → AI updates → re-confirms
- [ ] Can iterate feedback multiple times
- [ ] Confirm data → proceeds to next step
- [ ] Auth sign-in → continues from that point
- [ ] After authentication → exit button shows in header
- [ ] Click exit → dialog appears → confirm → navigates to profile
- [ ] Intermediate messages (blue boxes) still work
- [ ] Pending action approvals still work
- [ ] Session cleanup/archiving still works

## Acceptance Criteria
- All suggestion UI removed; free-form chat not available
- All three response types (clarification, confirmation, auth) display with proper UI
- Confirmation refinement loop functional: edit feedback updates data iteratively
- Exit button functional: shows only when authenticated, requires confirmation, navigates to profile
- No breaking changes to existing features (intermediate messages, pending actions, auth)
- Session cleanup and GDPR archiving unchanged
<!-- SECTION:PLAN:END -->
