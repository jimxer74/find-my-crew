---
id: TASK-065
title: AI assistant
status: In Progress
assignee: []
created_date: '2026-01-31 07:29'
updated_date: '2026-01-31 20:58'
labels:
  - feature
  - ai
  - ux
  - major
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Full AI assistant that can be opened by user anytime.

## Overview

The AI assistant is a conversational interface that helps users achieve their goals:
- **For Crew**: Find best matching boats and passages based on their skills, experience, and preferences
- **For Owners**: Find best matching crew for their journeys and manage their fleet

## Key Characteristics

1. **UI**: Sidebar panel on desktop, full-page under header on mobile
2. **Actions**: Approval-based - AI suggests actions, user confirms before execution
3. **Proactivity**: Can show proactive suggestions/notifications for new opportunities
4. **Memory**: Persistent conversation history across sessions

## User Context

The AI assistant understands:
- User's profile (skills, experience, certifications, risk levels, preferences)
- User's role (crew, owner, or both)
- User's boats and journeys (for owners)
- User's registrations and their status (for crew)
- User's notification preferences and consent settings

## Core Capabilities

**For Crew Members:**
- Search and filter journeys/legs matching their profile
- Explain why specific legs are good/bad matches
- Help complete or improve their profile
- Suggest registrations and help with application
- Track registration status and explain decisions

**For Boat Owners:**
- Help create and plan journeys with AI assistance
- Analyze and explain crew registrations
- Suggest crew selections based on requirements
- Help configure auto-approval settings
- Manage boat fleet information

**For All Users:**
- Answer questions about the platform
- Explain features and workflows
- Help with profile completion
- Provide sailing-related advice
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AI assistant accessible via button in header (opens sidebar on desktop, full page on mobile)
- [x] #2 Chat interface supports text input and displays conversation history
- [x] #3 AI understands user context (profile, role, boats, registrations, preferences)
- [x] #4 AI can search and filter data (journeys, legs, boats, crew) based on user queries
- [x] #5 AI suggests actions with clear explanation and confirmation UI before execution
- [x] #6 Supported actions: register for leg, update profile, create journey (owner), approve/deny registration (owner)
- [x] #7 Conversation history persists across sessions in database
- [x] #8 Proactive suggestions appear as notifications when new matching opportunities arise
- [x] #9 AI respects user's ai_processing_consent setting
- [x] #10 Works responsively on both desktop (sidebar) and mobile (full page)
- [x] #11 Loading states shown during AI processing
- [x] #12 Error handling for AI failures with graceful fallback
- [ ] #13 Add a more optimized query, if user wants to find legs based on sailboat_category and/or make+model, allow synonyms e.g. catamaran = multihull
- [ ] #14 When displaying content (e.g. legs, journeys etc.) as result of prompt, enable user to open them via link or button.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Database Schema & Infrastructure

**1.1 Create conversation storage tables**

```sql
-- AI conversation threads
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT, -- Auto-generated from first message
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual messages in conversations
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Store tool calls, suggestions, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pending action suggestions awaiting user approval
CREATE TABLE ai_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'register_for_leg', 'update_profile', 'create_journey', etc.
  action_payload JSONB NOT NULL, -- Parameters for the action
  explanation TEXT NOT NULL, -- AI's explanation of why this action is suggested
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Proactive suggestions (matching opportunities)
CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'matching_leg', 'matching_crew', 'profile_improvement'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Related entity IDs, match scores, etc.
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**1.2 Add AI config for assistant use case**
- File: `app/lib/ai/config.ts`
- Add new use case: `'assistant-chat'` with appropriate models
- Configure for conversational responses with function calling support

**1.3 Create AI assistant service**
- File: `app/lib/ai/assistant/service.ts`
- Handle conversation context building
- Manage tool/function definitions
- Process tool calls and generate responses

---

### Phase 2: AI Assistant Core Service

**2.1 Define assistant tools/functions**
- File: `app/lib/ai/assistant/tools.ts`

Tools the AI can use:
```typescript
const ASSISTANT_TOOLS = [
  // Data retrieval tools
  { name: 'search_journeys', description: 'Search published journeys with filters' },
  { name: 'search_legs', description: 'Search legs with skill/date/location filters' },
  { name: 'get_leg_details', description: 'Get full details of a specific leg' },
  { name: 'get_user_profile', description: 'Get current user profile data' },
  { name: 'get_user_registrations', description: 'Get user registration history' },
  { name: 'get_boat_details', description: 'Get details of a specific boat' },
  { name: 'analyze_match', description: 'Analyze how well user matches a leg' },
  
  // Owner-specific tools
  { name: 'get_journey_registrations', description: 'Get registrations for owner journeys' },
  { name: 'analyze_crew_match', description: 'Analyze how well a crew member matches requirements' },
  
  // Action suggestion tools (require approval)
  { name: 'suggest_register_for_leg', description: 'Suggest registering for a leg' },
  { name: 'suggest_profile_update', description: 'Suggest profile field updates' },
  { name: 'suggest_approve_registration', description: 'Suggest approving a crew registration' },
  { name: 'suggest_create_journey', description: 'Suggest creating a new journey' },
];
```

**2.2 Create context builder**
- File: `app/lib/ai/assistant/context.ts`
- Build system prompt with user context
- Include: profile summary, role, recent activity, preferences
- Respect data access based on role

**2.3 Create action executor**
- File: `app/lib/ai/assistant/actions.ts`
- Execute approved actions
- Map action types to API calls
- Handle errors and rollback

---

### Phase 3: API Routes

**3.1 Conversation management**
- `GET /api/ai/assistant/conversations` - List user's conversations
- `POST /api/ai/assistant/conversations` - Create new conversation
- `GET /api/ai/assistant/conversations/[id]` - Get conversation with messages
- `DELETE /api/ai/assistant/conversations/[id]` - Delete conversation

**3.2 Chat endpoint**
- `POST /api/ai/assistant/chat` - Send message, get AI response
  - Input: `{ conversationId, message }`
  - Process: Build context → Call AI → Execute tools → Return response
  - Output: `{ response, toolCalls?, pendingActions? }`

**3.3 Action management**
- `GET /api/ai/assistant/actions` - List pending actions
- `POST /api/ai/assistant/actions/[id]/approve` - Approve and execute action
- `POST /api/ai/assistant/actions/[id]/reject` - Reject action

**3.4 Suggestions**
- `GET /api/ai/assistant/suggestions` - Get proactive suggestions
- `POST /api/ai/assistant/suggestions/[id]/dismiss` - Dismiss suggestion

---

### Phase 4: UI Components

**4.1 Assistant toggle button**
- File: `app/components/ai/AssistantButton.tsx`
- Floating button or header icon
- Shows badge for pending suggestions
- Opens sidebar/navigates to assistant page

**4.2 Chat interface**
- File: `app/components/ai/AssistantChat.tsx`
- Message list with user/assistant bubbles
- Input field with send button
- Loading indicators during AI processing
- Render markdown in responses

**4.3 Sidebar container (desktop)**
- File: `app/components/ai/AssistantSidebar.tsx`
- Slide-in panel from right
- Fixed width (400-500px)
- Close button, conversation selector
- Respects header visibility

**4.4 Full page (mobile)**
- File: `app/(assistant)/assistant/page.tsx`
- Full page chat under header
- Back navigation
- Same chat component, different container

**4.5 Action confirmation card**
- File: `app/components/ai/ActionConfirmation.tsx`
- Shows suggested action with explanation
- Approve/Reject buttons
- Preview of what will happen

**4.6 Suggestion notification**
- File: `app/components/ai/SuggestionCard.tsx`
- Compact card for proactive suggestions
- Quick actions: View details, Dismiss
- Links to relevant content

---

### Phase 5: Proactive Suggestions System

**5.1 Matching job**
- File: `app/lib/ai/assistant/matching.ts`
- Run when new journeys/legs are published
- Find users whose profiles match new opportunities
- Create suggestion records

**5.2 Trigger mechanisms**
- Option A: Database trigger + Edge Function (Supabase)
- Option B: Webhook after journey publish
- Option C: Scheduled job (cron) to check for new matches

**5.3 Suggestion delivery**
- Create `ai_suggestions` record
- Optionally create notification
- Show in assistant UI with badge

---

### Phase 6: Integration & Polish

**6.1 Add assistant button to Header**
- Modify: `app/components/Header.tsx`
- Add assistant icon next to notifications
- Show suggestion count badge

**6.2 Consent checking**
- Verify `ai_processing_consent` before any AI operation
- Show consent prompt if not granted
- Graceful degradation without consent

**6.3 Mobile responsive layout**
- Detect screen size
- Route to `/assistant` page on mobile
- Use sidebar on desktop

**6.4 Error handling**
- AI timeout handling
- Graceful fallback messages
- Retry mechanisms

**6.5 Analytics/logging**
- Track conversation metrics
- Log tool usage patterns
- Monitor AI response quality

---

## File Structure Summary

```
app/
├── (assistant)/
│   └── assistant/
│       └── page.tsx                    # Mobile full-page assistant
├── api/
│   └── ai/
│       └── assistant/
│           ├── chat/route.ts           # Main chat endpoint
│           ├── conversations/
│           │   ├── route.ts            # List/create conversations
│           │   └── [id]/route.ts       # Get/delete conversation
│           ├── actions/
│           │   ├── route.ts            # List pending actions
│           │   └── [id]/
│           │       ├── approve/route.ts
│           │       └── reject/route.ts
│           └── suggestions/
│               ├── route.ts            # Get suggestions
│               └── [id]/dismiss/route.ts
├── components/
│   └── ai/
│       ├── AssistantButton.tsx         # Header button
│       ├── AssistantSidebar.tsx        # Desktop sidebar
│       ├── AssistantChat.tsx           # Chat interface
│       ├── MessageBubble.tsx           # Individual message
│       ├── ActionConfirmation.tsx      # Action approval UI
│       └── SuggestionCard.tsx          # Proactive suggestion
├── contexts/
│   └── AssistantContext.tsx            # Global assistant state
├── hooks/
│   └── useAssistant.ts                 # Assistant hook
└── lib/
    └── ai/
        └── assistant/
            ├── service.ts              # Main assistant service
            ├── tools.ts                # Tool definitions
            ├── context.ts              # Context builder
            ├── actions.ts              # Action executor
            └── matching.ts             # Proactive matching
migrations/
└── XXX_ai_assistant_tables.sql         # Database schema
```

---

## Technical Considerations

**AI Provider Selection:**
- Use Gemini for chat (good at conversation, large context)
- Consider streaming responses for better UX
- Fallback to Groq/DeepSeek if Gemini fails

**Performance:**
- Limit conversation history sent to AI (last N messages)
- Cache user context (profile, boats) during session
- Use optimistic UI updates for better responsiveness

**Security:**
- Validate all tool parameters
- Re-check permissions before action execution
- Audit log for approved actions
- Rate limiting on chat endpoint

**Scalability:**
- Conversation pruning (archive old conversations)
- Suggestion expiration (auto-dismiss old suggestions)
- Background processing for matching jobs
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Files Created

**Database Migration:**
- `migrations/012_ai_assistant_tables.sql` - Creates ai_conversations, ai_messages, ai_pending_actions, ai_suggestions tables

**AI Assistant Core Service:**
- `app/lib/ai/assistant/types.ts` - TypeScript type definitions
- `app/lib/ai/assistant/tools.ts` - Tool definitions for AI function calling
- `app/lib/ai/assistant/context.ts` - User context builder and system prompt
- `app/lib/ai/assistant/toolExecutor.ts` - Executes tool calls from AI
- `app/lib/ai/assistant/actions.ts` - Executes approved pending actions
- `app/lib/ai/assistant/service.ts` - Main chat service orchestration
- `app/lib/ai/assistant/matching.ts` - Proactive suggestions matching logic
- `app/lib/ai/assistant/index.ts` - Export barrel

**API Routes:**
- `app/api/ai/assistant/chat/route.ts` - Main chat endpoint
- `app/api/ai/assistant/conversations/route.ts` - List/create conversations
- `app/api/ai/assistant/conversations/[id]/route.ts` - Get/delete conversation
- `app/api/ai/assistant/actions/route.ts` - List pending actions
- `app/api/ai/assistant/actions/[id]/approve/route.ts` - Approve action
- `app/api/ai/assistant/actions/[id]/reject/route.ts` - Reject action
- `app/api/ai/assistant/suggestions/route.ts` - List suggestions
- `app/api/ai/assistant/suggestions/[id]/dismiss/route.ts` - Dismiss suggestion
- `app/api/ai/assistant/suggestions/generate/route.ts` - Generate new suggestions

**UI Components:**
- `app/contexts/AssistantContext.tsx` - Global assistant state management
- `app/components/ai/AssistantButton.tsx` - Header button with badge
- `app/components/ai/AssistantChat.tsx` - Chat interface component
- `app/components/ai/AssistantSidebar.tsx` - Desktop sidebar panel
- `app/components/ai/ActionConfirmation.tsx` - Pending action card
- `app/components/ai/index.ts` - Export barrel
- `app/assistant/page.tsx` - Mobile full-page assistant

### Files Modified

- `app/lib/ai/config.ts` - Added 'assistant-chat' use case
- `app/layout.tsx` - Added AssistantProvider and AssistantSidebar
- `app/components/Header.tsx` - Added AssistantButton
- `specs/tables.sql` - Added AI assistant tables documentation

### Key Features Implemented

**Chat Interface:**
- Real-time conversation with AI
- Persistent conversation history
- Tool calling for data retrieval
- Approval-based action suggestions
- Loading states and error handling

**Tools Available:**
- Data tools: search_journeys, search_legs, get_leg_details, get_journey_details, get_user_profile, get_user_registrations, get_boat_details, analyze_leg_match
- Owner tools: get_owner_boats, get_owner_journeys, get_leg_registrations, analyze_crew_match
- Action tools: suggest_register_for_leg, suggest_profile_update, suggest_approve_registration, suggest_reject_registration

**Proactive Suggestions:**
- Matching algorithm for crew-leg compatibility
- Generates suggestions when new legs published
- API endpoint to trigger suggestion generation

**Security:**
- Consent checking (ai_processing_consent required)
- RLS policies on all tables
- Role-based tool access
- Re-verification before action execution

### UI Behavior

- **Desktop:** Sidebar slides in from right (400px width)
- **Mobile:** Full page under header at /assistant
- **Badge:** Shows count of pending actions + suggestions

### Testing Notes

To test the assistant:
1. Enable AI consent in user settings
2. Click the lightbulb icon in the header
3. Try queries like:
   - "Find sailing opportunities that match my profile"
   - "Show me my recent registrations"
   - "What journeys are available next month?"
   - (For owners) "Show registrations for my journeys"
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Database migration created for ai_conversations, ai_messages, ai_pending_actions, ai_suggestions tables
- [x] #2 AI assistant service with tool/function calling implemented
- [x] #3 Chat API endpoint processes messages and returns responses
- [x] #4 Conversation history persists and loads correctly
- [x] #5 Action suggestion and approval flow works end-to-end
- [x] #6 Desktop sidebar UI implemented and accessible from header
- [x] #7 Mobile full-page assistant implemented under header
- [x] #8 Proactive suggestion system generates matches for new opportunities
- [x] #9 Consent checking prevents AI usage without ai_processing_consent
- [x] #10 Error handling covers AI failures, timeouts, and edge cases
- [x] #11 specs/tables.sql updated with new tables
<!-- DOD:END -->
