---
id: TASK-006
title: AI driven onboarding / prospect user support for crew
status: To Do
assignee: []
created_date: '2026-01-23 17:13'
updated_date: '2026-02-08 17:40'
labels: []
dependencies: []
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In order gain traction in highly competitive app marker space, there needs to be fast and immediate value creation for users. This means that crew users need to be shown the value the app can bring fast and without cumbersome signup and profile creationg flows supporting basic sailing opportunities searching based on their given preferences and aspirations immeadiately and without need to identify themselves through sign-up -> login -> profile creation long flow. The main idea here is the show users value early and be able to gather just enough information to show matching sailing opportunities, so that after seeing the value the app can bring, users would be willing sign-up.

No changes should be done in current sign-up, log-in and profile creation flows, this is an additional new enhancement that can be used alongside the existing more traditional onboarding.

No changes should be done in the current app landing page as of now, the new one will be created as an optional landing page for, which may in future replace the old, but not for now yet.

Here is the idea of the new user flow:
1. New user comes in the app landing page, interested in crew positions and looking for sailing opportunities

2. In new Landing page there is a very clear starting point for unidentified crew onboarding flow, user clicks to start the onboarding
** New landing page concept: We'll start with the basis of the current landing page, but remove the header component (no header or navigation visible). The landing page has the main logo, main hero texts and the current background image as now and Log-in button. It is split in two sides or columns for full height of the screen. Use different transparent color layers on top of the background image to enable this dualistic motif. Left hand side is for Owers / Skippers and we'll implement that in later task. Right hand side is for crew and it should have clear value proposition for crews to able find best matching sailing opportunites and button to start this new onboarding process. Page structure could also be vertically stacked in mobile, so that crew value prop is first then owners, --> propose a solution based on good UX and screen size limitations on mobile.

3. User clicks the button to start onboarding process and it opens up very simplistic just bare screen with no header, but footer should be visible with acces to important legal texts. Page should have the AI assistant component in it for user to able to start discussing with AI assistant that will guide the user through the onboarding process.

4. AI assisted flow 1. step: Gain understanding of user's aspirations, goals and what kind persons they are in general.
- AI assistant's only target is to obtain just enough information from user to be able to show matching legs from database. MOST IMPORTANT is to understand the user's aspirations, goals and kind of sailing he/she is looking for
- Show the matching legs as early as possible: Here propose a solution and give pros and cons: option A) Userflow retained in AI chat like UX, e.g provide legs in the AI response flow as badge links that open the Legs view on map op option B) User is shown separate UI out from AI chat flow: e.g show legs in left pane for desktop or bottom sheet for mobile
- Ask users additional clarifying questions as needed to gain enough understanding what they are most probably looking for --> aim to gather the information required to create a full user profile based on the obtained information,
- Ask when user is planning the sailing and  also where from or where to he/she wants to sail  and constantly update the shown legs based on new obtained knowldge from user
- IMPORTANT: gathered information needs to be stored in database --> for this assess current setup and propose solution options! Also very IMPORTANT is to user to be able to suspend the flow, leave the flow and maybe come back later to continue where they left, e.g. maybe storing some reference to prospect profile data and AI conversation in cookies or such --> please also propose a solution for this.
- AI should try to convince user to sign-up by asking necessary information either for email based sign-up or facebook based sign-up. Sign-up process should be started if user approves to start it.
- IMPORTANT: We dont know users behaviour before hand and solution cannot be fixed to certain sequence or flog logic, e.g. some users may know very well what they want and can for example copy-paste existing posting from facebook sailing group etc. to AI chat, so AI chat needs to be very flexible and responsive to different variations of sequence. Or for users the location or dates when they are on vacation are the most important thing for selection of the sailing trip.  

5. User comes back later to site
- User may come back later to continue the flow and if the cookie reference is availble to existing gathered data, user must be directed to continue the flow where it last time was left
- When user sign-up process is complete, the AI should analyze the gathered data and create a user profile out from it, including all the profile date fields.
- IMPORTANT question is that should user be kept in the single AI assisted chat flow all the time, e.g user could finalize the whole flow from information gathering, sign-up, log-in and profile creation and finally registration to a leg in a single chat session, or should user be directed to for some of the more complex operations to app UI, provide here pros and cons for both of the options and ask questions if needed.

This is very complex feature and will probably require iterations, so propose a good way to approach this and in which kind of packages this is relevant to plan and implement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New landing page with dual-column layout (Crew/Owner) is accessible without header
- [ ] #2 Prospect users can start AI chat without authentication
- [ ] #3 AI gathers user preferences through natural conversation
- [ ] #4 Matching legs are displayed inline as clickable badges
- [ ] #5 Session persists via cookie+localStorage for returning users
- [ ] #6 Users can sign up within the chat flow (email or Facebook)
- [ ] #7 Profile is auto-populated from AI-gathered information
- [ ] #8 Signed-up users can immediately register for discovered legs
- [ ] #9 Mobile responsive design with vertically stacked layout
- [ ] #10 Footer with legal links always visible
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Architecture Decisions (2026-02-08)

### 1. Leg Display: Inline in Chat
- Show matching legs as clickable badges within AI responses
- Simpler UX, keeps user focused on conversation
- Reuses existing `[[leg:UUID:Name]]` pattern from AssistantChat

### 2. Session Storage: Cookie + LocalStorage
- Store session ID in HttpOnly cookie
- Store conversation history and gathered preferences in localStorage
- Key: `prospect_session_{sessionId}`
- Simple implementation, works offline
- Note: Data lost if user clears browser - acceptable for MVP

### 3. Flow Scope: Full Chat Flow
- Everything happens within the chat interface
- Sign-up forms rendered inline or as overlays within chat page
- No redirects to external pages during onboarding
- Seamless user experience

### 4. Implementation: MVP First Approach
- Phase 1: Basic prospect AI chat + leg display
- Phase 2: Session persistence + returning users
- Phase 3: Sign-up integration
- Phase 4: Full registration + profile creation

---

## Current Codebase Analysis

### Existing Infrastructure to Leverage:
- `AssistantChat` component with inline leg references `[[leg:UUID:Name]]`
- `ai_conversations` and `ai_messages` tables (need anonymous variant)
- Supabase Auth with email signup
- `profiles` table with detailed sailing preferences

### New Components Required:
1. **New Landing Page** (`/welcome` or `/start`)
   - Dual-column layout (Crew left, Owner right)
   - No header, footer only
   - Mobile: vertically stacked (Crew first)

2. **Prospect Session Management**
   - Cookie-based session ID
   - LocalStorage for conversation/preferences
   - No database writes until sign-up

3. **Prospect AI Chat**
   - Modified AssistantChat for unauthenticated users
   - Different API endpoint that doesn't require auth
   - Same UI patterns but simplified

4. **In-Chat Sign-up Components**
   - Email signup form within chat
   - Facebook OAuth button within chat
   - Profile creation from gathered data
<!-- SECTION:NOTES:END -->
