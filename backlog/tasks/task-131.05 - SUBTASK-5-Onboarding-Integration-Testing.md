---
id: TASK-131.05
title: 'SUBTASK 5: Onboarding Integration & Testing'
status: Done
assignee: []
created_date: '2026-02-24 11:49'
updated_date: '2026-02-24 17:31'
labels: []
dependencies: []
parent_task_id: TASK-131
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Integrate URL import functionality into onboarding flow and comprehensive testing.

## Implementation Files
- `app/contexts/OwnerChatContext.tsx` (update to handle imported profile)
- `app/lib/ai/owner/service.ts` (update prompts for imported context)
- Update type definitions in `app/lib/ai/owner/types.ts`
- Test files (unit + integration tests)

## Requirements

### 1. OwnerChatContext Integration
Update OwnerChatContext to:
1. Add `importedProfile` to OwnerChatState:
   ```typescript
   importedProfile?: {
     url: string;
     source: 'facebook' | 'generic';
     content: string;
     metadata: any;
   };
   ```
2. When imported profile received:
   - Store in state
   - Create labeled context block: [IMPORTED_PROFILE]
   - Include in initial AI message along with journey/skipper/crew details
3. Format initial message with all context sections:
   ```
   [IMPORTED_PROFILE]:
   Source: facebook
   URL: https://facebook.com/...
   Content: ...
   
   [JOURNEY DETAILS]:
   ...
   
   [SKIPPER PROFILE]:
   ...
   
   [CREW REQUIREMENTS]:
   ...
   ```

### 2. AI Service Prompt Updates
Update `app/lib/ai/owner/service.ts` to:
1. Add `importedProfile` parameter to buildOwnerPromptForStep()
2. Inject into system prompts for relevant steps
3. Update `create_profile` step to use [IMPORTED_PROFILE] for extracting skipper info
4. Example instruction:
   ```
   **[IMPORTED_PROFILE] CONTEXT:** The user shared content from {source}. 
   Use this information to pre-fill profile details, but ask user to confirm/refine.
   Do NOT use this for crew requirements - only for the skipper's own profile.
   ```

### 3. Type Definition Updates
Update `app/lib/ai/owner/types.ts`:
- Add `importedProfile` to OwnerSession interface
- Update OwnerMessage metadata to support imported profile data
- Ensure all types are properly exported

### 4. Testing

**Unit Tests:**
- URL detection: All platform types + edge cases
- URL validation: Valid/invalid URLs
- Content fetcher: Mock API/scraper responses
- Component rendering: All states (input, loading, preview, error)

**Integration Tests:**
- Full flow: URL input → API call → Preview → Success
- Error flow: Invalid URL → Error message → Retry
- Onboarding context: Imported profile → AI message format

**Test Structure:**
- `app/lib/url-import/__tests__/detectResourceType.test.ts`
- `app/lib/url-import/__tests__/fetchResourceContent.test.ts`
- `app/components/onboarding/__tests__/URLImportForm.test.tsx`
- Integration tests for onboarding flow

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 OwnerChatContext stores and handles importedProfile
- [x] #2 Initial message includes [IMPORTED_PROFILE] when available
- [x] #3 AI service receives imported profile in prompts
- [x] #4 create_profile step uses imported content
- [x] #5 Types updated and exported correctly
- [x] #6 Unit tests for detectResourceType (all platforms + edge cases)
- [x] #7 Unit tests for fetchResourceContent (success + fallbacks)
- [x] #8 Unit tests for URLImportForm (all states)
- [x] #9 Integration test: Full URL import flow
- [x] #10 Integration test: Error handling and retry
- [x] #11 Integration test: Onboarding with imported profile
- [x] #12 All tests passing
- [x] #13 >80% code coverage for new code
- [x] #14 No console errors or warnings in tests
<!-- SECTION:DESCRIPTION:END -->
<!-- AC:END -->
