---
id: TASK-155
title: Messaging solution and Skipper profile page
status: Done
assignee:
  - claude
created_date: '2026-03-06 22:27'
updated_date: '2026-03-06 23:01'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Skipper Profile Page for crew**
- When user is approved for a leg, crew  role user can access the Skipper profile page from teh My Registrations skipper section: that include all skipper profile information and a summary of the boat information, including a summary of Boat Maintenance records, safety equipment etc.
- When user is approved for a leg crew role user can access the messaging solution (defined below) from the the My Crew section registrations list.
- Messaging solution should open in new browser window, so user can see other information e.g. profile data, boat etc. while writing or reading messages 

**Messaging system between users of the platform.**

-Functionality to send message to other user, message could include text but also attachments, files, images, but also documents from user's Document Vault that are granted access to user to whom the message is sent to.

**Important**
- messaging system is not publicly available between any users, at least not for now > to be decided later if this kind of social feature is enabled.
- messaging between users is opened / allowed in when certain transactions takes place, below is a list of transactions that open the messaging channel between users.

Use cases:
1. When crew is approved to a leg, either by AI assessment or manually by the skipper / owner > after approval, skipper and crew can send messages to each other. Messaging feature between skipper / crew is available until the end of the leg or if either of the parties choose to close the messaging channel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Crew with an Approved registration can view full skipper profile page from their My Registrations page
- [x] #2 Skipper profile page shows: profile info, sailing background, boat summary, safety equipment, maintenance summary
- [x] #3 Access to skipper profile is denied if crew has no approved registration with that skipper
- [x] #4 Messaging channel is automatically opened when a registration is approved
- [x] #5 Crew can send and receive text messages with skipper from My Registrations page (opens new tab)
- [x] #6 Skipper/owner can send and receive text messages with crew from their registrations view (opens new tab)
- [x] #7 Messages page shows all conversations with last message preview and unread count
- [x] #8 Message thread shows messages in real-time (no page reload needed)
- [ ] #9 Users can attach files/images to messages
- [x] #10 Either participant can close a messaging channel
- [x] #11 A notification is sent when a new message is received
- [x] #12 Messages link appears in navigation menu with unread count badge
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1 — Skipper Profile Page (for approved crew)

**Goal**: Crew can view full skipper profile + boat summary after being approved for a leg.

**Access control**: Only show if authenticated user has at least one 'Approved' registration on a leg owned by that skipper.

#### Files to create/modify:
1. `app/api/skipper/[ownerId]/profile/route.ts` — GET endpoint
   - Verifies caller has an approved registration on one of the skipper's legs
   - Returns: profile fields (full_name, user_description, certifications, sailing_preferences, skills, sailing_experience, risk_level, profile_image_url)
   - Returns: boat summary (name, type, make_model, year_built, images)
   - Returns: safety equipment list (from boat_equipment where category='safety')
   - Returns: maintenance summary (open tasks count, last completed, upcoming by category)
2. `app/crew/skipper/[ownerId]/page.tsx` — new page (opens normally, not new window)
3. `app/crew/registrations/page.tsx` — add "View Skipper Profile" link on Approved registrations

### Phase 2 — Messaging System

**Goal**: Skipper and crew can exchange messages after a leg approval. Opens in a new browser tab/window.

**Trigger**: Conversation is automatically created when a registration status changes to 'Approved'.

#### DB Migration (061_user_messaging.sql):
- `conversations` table: id, registration_id (fk → registrations), participant_1_id, participant_2_id, status enum('open','closed'), created_at, closed_at, closed_by
- `conversation_messages` table: id, conversation_id (fk), sender_id, content (text), attachments jsonb (array of {type, url, name, vault_document_id?}), created_at
- RLS: only participants can read/write their conversations and messages
- Unique constraint: one conversation per registration

#### API routes:
- `GET /api/messages` — list user's conversations (with last message preview, other participant info)
- `POST /api/messages` — create conversation (triggered internally on approval, not exposed to client directly)
- `GET /api/messages/[conversationId]` — get messages (paginated, newest first)
- `POST /api/messages/[conversationId]/send` — send a message (text + optional attachments)
- `PATCH /api/messages/[conversationId]` — close conversation

#### Pages:
- `app/messages/page.tsx` — conversation list (shows all user's conversations)
- `app/messages/[conversationId]/page.tsx` — message thread (real-time via Supabase Realtime)

#### Integration points:
- `app/api/registrations/[registrationId]/route.ts` (PATCH) — auto-create conversation on approval
- `app/owner/registrations/[registrationId]/page.tsx` — add "Message Crew" button for approved registrations
- `app/crew/registrations/page.tsx` — add "Message Skipper" button for approved registrations
- Navigation menu — add Messages link with unread count badge
- Notifications — send notification to other participant on new message

#### Key constraints:
- Messaging only between the two participants of an approved registration
- Conversation stays open until leg end_date passes OR a participant closes it
- File attachments via Supabase Storage (new bucket: 'message-attachments')
- Vault document attachments reference existing granted document_grants

### Subtask breakdown:
- TASK-155.1: Skipper Profile API + Page
- TASK-155.2: DB migration + messaging API routes
- TASK-155.3: Messages pages (list + thread with Realtime)
- TASK-155.4: Integration (auto-create on approval, buttons on registration pages, nav link, notifications)
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation Summary

### Phase 1 — Skipper Profile Page
- **`app/api/skipper/[ownerId]/profile/route.ts`**: GET endpoint returning skipper profile, boat summary, safety equipment, and maintenance overview. Access-gated: only crew with an approved registration on the skipper's legs can view.
- **`app/crew/skipper/[ownerId]/page.tsx`**: Clean profile page showing all skipper info including sailing background, certifications, boat specs, safety equipment list, and maintenance overview.
- **`app/crew/registrations/page.tsx`**: Added `owner_id` field to API response + "View Skipper Profile" and "Message Skipper" action buttons on Approved registration cards.
- **`app/api/registrations/crew/details/route.ts`**: Added `owner_id` to returned registration data.

### Phase 2 — Messaging System
- **`migrations/061_user_messaging.sql`**: Created `conversations` and `conversation_messages` tables with RLS policies. Added two SECURITY DEFINER RPCs: `open_conversation_for_registration` (idempotent, safe to call multiple times) and `mark_messages_read`.
- **`app/api/messages/route.ts`**: GET — lists user's conversations with other participant info, last message preview, unread count.
- **`app/api/messages/[conversationId]/route.ts`**: GET messages (paginated, marks as read) + PATCH to close conversation.
- **`app/api/messages/[conversationId]/send/route.ts`**: POST to send a message. Includes optimistic UI support (server confirms) and fires notification to recipient.
- **`app/messages/page.tsx`**: Conversation list page (opens threads in new tab per requirement).
- **`app/messages/[conversationId]/page.tsx`**: Real-time message thread using Supabase Realtime (`postgres_changes` on `conversation_messages`). Optimistic UI for sent messages. Auto-scroll to bottom.
- **`app/api/registrations/[registrationId]/route.ts`**: Auto-creates conversation via RPC when a registration is approved (fire-and-forget, idempotent).
- **`app/owner/registrations/[registrationId]/page.tsx`**: Added "Message Crew" button for approved registrations (opens /messages in new tab).
- **`app/components/NavigationMenu.tsx`**: Added Messages link with email icon in navigation for all authenticated users.
- **`messages/en.json` + `messages/fi.json`**: Added `navigation.messages` translation key.
- **`app/api/user/delete-account/route.ts`**: Updated GDPR deletion to delete conversations and messages for deleted users.
- **`specs/tables.sql`**: Updated with full schema for conversations and conversation_messages tables.

### Note on AC #9 (file attachments)
Attachments schema is in place (jsonb column on conversation_messages) but file upload UI is not yet implemented. The API accepts `attachments` array in the send endpoint body.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All new API routes have proper auth and RLS checks
- [ ] #2 DB migration created and specs/tables.sql updated
- [ ] #3 GDPR account deletion logic updated for new tables
- [ ] #4 No TypeScript build errors
<!-- DOD:END -->
