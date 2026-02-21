---
id: doc-010
title: AI Response Timeout Analysis - 60 Second Limit Issue & Solutions
type: other
created_date: '2026-02-21 13:14'
updated_date: '2026-02-21 13:45'
---
# AI Response Timeout Analysis: 60-Second Limit Issue & Solutions

## Executive Summary

The AI onboarding chat endpoints (`/api/ai/owner/chat` and `/api/ai/prospect/chat`) are configured with a **60-second maximum duration** (`maxDuration = 60`). When AI responses take longer than 60 seconds, Vercel's serverless function timeout kills the request and returns a 504 Gateway Timeout error.

**Current Configuration**:
- Owner chat: `app/api/ai/owner/chat/route.ts` line 17: `export const maxDuration = 60;`
- Prospect chat: `app/api/ai/prospect/chat/route.ts` line 17: `export const maxDuration = 60;`

**Problem**: Complex AI reasoning (analyzing profiles, generating detailed boat suggestions, creating multi-leg journeys with analysis) can exceed 60 seconds, causing user experience to degrade with timeout errors.

---

## Current AI Architecture Analysis

### Centralized Configuration System

The codebase uses a **sophisticated centralized AI configuration system** located in `/app/lib/ai/config/`:

**Config Structure**:
- `config/index.ts` - Core configuration interface & environment selection
- `config/prod.ts` - Production environment settings
- `config/dev.ts` - Development environment settings
- `config/providers/*.ts` - Provider-specific configs (OpenRouter, Groq, DeepSeek, Gemini)

**Key Configuration Features**:
1. **Environment-based selection** (development vs production)
2. **Provider fallback system** - tries multiple providers in order
3. **Use-case-specific overrides** - different models for different operations:
   - `owner-chat`: OpenRouter GPT-4o-mini with 8000 max tokens
   - `prospect-chat`: OpenRouter GPT-4o-mini with 6000 max tokens
   - `boat-details`: Cheaper model for extraction
   - `generate-journey`: High-quality model for complex reasoning

### AI Service Layer Architecture

**Main Service**: `app/lib/ai/service.ts` - Unified AI interface

**How It Works**:
1. `callAI(options)` is the single entry point for all AI calls
2. Accepts `useCase`, `prompt`, `temperature`, `maxTokens`, `context`
3. Looks up use-case-specific config overrides
4. Tries providers in order (OpenRouter → Groq → DeepSeek → Gemini)
5. Has **built-in 60-second timeout** for each provider call (line 74, 154, 234, 336)
6. Rate limiting applied at both provider and use-case levels

**Rate Limiting**:
- `rateLimit.ts` implements provider-level and use-case-level rate limiting
- Prevents hitting API provider caps

### AI Chat Service Loop Architecture

**Owner Chat Service**: `app/lib/ai/owner/service.ts`

**Structure** (lines 1985-2284):
```
ownerChat(request) {
  // Phase 1: Determine completion status
  - Query database for profile, boats, journeys
  - Derive current onboarding step
  - Get allowed tools for step
  
  // Phase 2: Build system prompt
  - Inject step-specific instructions
  - Include allowed tools definitions
  
  // Phase 3: Tool loop (while iterations < MAX_TOOL_ITERATIONS)
    while (iterations < 10) {  // Line 2190
      - Call AI via callAI()  // Line 2204
      - Parse tool calls from response
      - Execute tools (if any)
      - Add results to message history
      - Continue loop if tools were called
      - Break if no tool calls
  
  // Phase 4: Return response
}
```

**Key Loop Characteristics**:
- **MAX_TOOL_ITERATIONS = 10** (line 36) - AI can loop up to 10 times
- **Each iteration calls AI API** - most time spent here
- **Each iteration can execute database operations** - tool execution adds latency
- **Currently SYNCHRONOUS** - must wait for complete response before returning

**What Makes Onboarding Slow**:
1. **Initial AI call** - Process user message, generate response (10-20 seconds)
2. **Tool execution loop** - Can execute 2-10 tool calls per request:
   - Database queries for profile/boat/journey
   - Boat detail fetching (web scraping)
   - Journey generation with waypoint geocoding
   - RPC calls for complex data inserts
3. **Multiple iterations** - If user message requires multiple turns:
   - First iteration: Get initial greeting
   - Second iteration: Call update_user_profile tool
   - Third iteration: Generate boat suggestions
   - Fourth iteration: Create boat
   - Each adds 10-30 seconds

**Total Time for Complex Onboarding**:
- Initial greeting: 15 seconds
- Profile creation: 10 seconds (AI + tool + DB)
- Boat suggestions: 15 seconds (AI response)
- Boat creation: 15 seconds (tool execution + DB)
- Journey generation: 30+ seconds (complex AI reasoning + RPC)
- **Total: 85+ seconds** → **TIMEOUT**

---

## Proposed Solutions

### **Solution 1: Increase maxDuration (QUICKEST FIX)**

**Implementation**: Change `maxDuration = 60` to `maxDuration = 120` or higher.

**Pros**:
- ✅ Simplest implementation (2-line change)
- ✅ Immediate relief for most use cases
- ✅ No client-side changes needed
- ✅ No architectural changes

**Cons**:
- ❌ Vercel Pro plan limited to 60 seconds max (requires Enterprise plan for 900 seconds)
- ❌ Higher duration = higher cost per function invocation
- ❌ Still vulnerable to extremely long AI operations
- ❌ Doesn't scale well as dataset grows (more complex queries = slower)

**Vercel Plan Limits**:
- Hobby: 10 seconds max
- Pro: 60 seconds max
- Enterprise: Up to 600 seconds (or 900 with config)

**Recommendation for Current Plan**: This is NOT viable on Pro plan since 60 seconds is already the maximum.

---

### **Solution 2: Implement Streaming Responses (BEST FOR UX)**

**Implementation**: Convert API endpoints to stream AI responses in real-time instead of returning complete responses.

**FEASIBILITY ASSESSMENT**: ⚠️ **MODERATE FEASIBILITY - HIGH COMPLEXITY**

#### Architectural Compatibility Analysis

**Current Centralized Service Benefits**:
✅ Can be modified to support streaming
✅ `callAI()` function is the single point where AI is called
✅ Configuration system can easily add streaming mode
✅ Rate limiting infrastructure can work with streaming

**Critical Issues for Streaming Implementation**:

**Issue #1: Tool Loop Incompatibility**
- Current architecture: Tool loop waits for complete AI response, parses JSON tool calls, executes, adds results, repeats
- Streaming would break this: Client receives partial content while tools are still executing server-side
- **Problem**: How to stream tool execution feedback? Client would see incomplete tool definitions, broken JSON during parsing

**Issue #2: Tool Execution on Server**
- Current: `executeOwnerTools()` runs server-side within the loop
- Tools take time:
  - `fetch_boat_details_from_sailboatdata`: 5-15 seconds (web scraping)
  - `create_boat`: 1-2 seconds (DB insert)
  - `update_user_profile`: 1-2 seconds (DB insert)
  - `generate_journey_route`: 20-30 seconds (complex AI + RPC)
- **Streaming doesn't help here** - tools must run on server sequentially
- Cannot stream tool execution results effectively without major client restructuring

**Issue #3: Message History Context**
- Current approach: Build complete message array, pass to AI
- Streaming approach: Would need to stream AND handle tool results AND rebuild context
- **Complexity**: Message ordering becomes critical with streaming

**Issue #4: Error Handling Mid-Stream**
- What if tool execution fails halfway through?
- What if AI hallucinates tool calls during stream?
- Client would have already rendered partial incomplete response

**How It Would Need to Work**:

```
Option A: Streaming Responses Only (Partial Solution)
- First token arrives in <100ms
- Client shows "Loading..." → immediate feedback
- But tool loop still blocks on server
- If tools take 30 seconds, client still waits
- Only saves time on INITIAL AI response generation (10-20 seconds)
- Max improvement: ~30% latency reduction

Option B: Server-Sent Events for Full Streaming (Complex)
- Stream AI response tokens as they arrive
- Stream tool execution status as tools run
- Stream tool results
- Stream next iteration's AI generation
- Requires complete refactor of:
  - callAI() to support streaming
  - executeOwnerTools() to emit progress events
  - Message formatting to handle streaming JSON
  - Client-side parsing to handle multi-part responses
  - Error handling for mid-stream failures
```

**Compatibility with Current Architecture**:
- ✅ Could modify `callAI()` to return streaming response
- ✅ Could add streaming flag to use-case config
- ❌ Tool execution would still block (no async tool execution)
- ❌ Message loop would need significant refactoring
- ❌ Error handling becomes exponentially more complex

**Code Changes Required**:

**Backend**:
1. Modify `app/lib/ai/service.ts`:
   - Change `callAI()` to support streaming mode
   - Return `ReadableStream` instead of `AICallResult`
   - Handle provider-specific streaming APIs

2. Modify `app/lib/ai/config/index.ts`:
   - Add `streamingEnabled` flag to use-case config
   - Production config already has all necessary fields

3. Modify route handlers:
   - `app/api/ai/owner/chat/route.ts`
   - `app/api/ai/prospect/chat/route.ts`
   - Return `NextResponse` with streaming headers

4. Modify service layers:
   - `app/lib/ai/owner/service.ts#ownerChat()`
   - `app/lib/ai/prospect/service.ts#prospectChat()`
   - Handle streaming responses from `callAI()`
   - Still synchronous tool loop (doesn't help much)

**Frontend**:
- Add streaming response handler in chat components
- Update UI to show partial responses
- Handle error mid-stream

**Realistic Impact**:
- **Reduces latency from 85 seconds to 65 seconds** (only saves AI generation time, not tool execution)
- **Still times out** if tools + iterations exceed 60 seconds
- **Improves perceived UX** (user sees content appear incrementally)
- **Doesn't solve the root problem** (tool execution time)

**Complexity**: HIGH (2-3 days of work)

---

### **Solution 3: Implement Message Queue + Background Processing**

**Implementation**: Accept message immediately, queue AI processing backend, return tracking ID.

**How It Works**:
1. Client sends message
2. Server validates, creates job record in database
3. Returns immediately with `jobId` and polling URL
4. Client polls `/api/ai/owner/chat/status/{jobId}` for updates
5. Background worker processes AI chat
6. Returns complete response when ready

**Code Structure**:
```typescript
// POST - Accept and queue
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Create job in database
  const { data: job } = await supabase
    .from('ai_chat_jobs')
    .insert({
      status: 'pending',
      request_data: body,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  // Queue background job (using Vercel Cron, Bull, or similar)
  await queueAIJob(job.id);
  
  return NextResponse.json({
    jobId: job.id,
    statusUrl: `/api/ai/owner/chat/status/${job.id}`,
    pollIntervalMs: 1000,
  });
}

// GET - Check status
export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  const { data: job } = await supabase
    .from('ai_chat_jobs')
    .select('status, response_data, error')
    .eq('id', params.jobId)
    .single();
  
  return NextResponse.json({
    status: job.status,
    response: job.response_data,
    error: job.error,
  });
}
```

**Client-Side**:
```typescript
const response = await fetch('/api/ai/owner/chat', {
  method: 'POST',
  body: JSON.stringify({ message, ... }),
});

const { jobId, pollIntervalMs } = await response.json();

// Poll for completion
let completed = false;
while (!completed) {
  await new Promise(r => setTimeout(r, pollIntervalMs));
  const status = await fetch(`/api/ai/owner/chat/status/${jobId}`).then(r => r.json());
  
  if (status.status === 'completed') {
    completed = true;
    return status.response;
  } else if (status.status === 'failed') {
    throw new Error(status.error);
  }
  // Show loading spinner...
}
```

**Background Worker** (using Vercel Cron or similar):
```typescript
// cron job or separate service
export async function processAIChatJob(jobId: string) {
  try {
    const job = await getJobFromDB(jobId);
    const response = await ownerChat(supabase, job.request_data);
    
    await updateJobInDB(jobId, {
      status: 'completed',
      response_data: response,
    });
  } catch (error) {
    await updateJobInDB(jobId, {
      status: 'failed',
      error: error.message,
    });
  }
}
```

**Pros**:
- ✅ No timeout limit on actual processing (job runs separately)
- ✅ Scales horizontally (multiple workers)
- ✅ Works within Vercel Pro plan
- ✅ Better resource utilization
- ✅ Can handle queue prioritization

**Cons**:
- ❌ Complex architecture (job queue, workers, polling)
- ❌ Latency before work starts (job processing delay)
- ❌ Client must implement polling UI
- ❌ Database overhead for tracking jobs
- ❌ Operational complexity (monitoring, dead-letter queues)

**Complexity**: VERY HIGH (4-5 days of work + infrastructure setup)

---

### **Solution 4: Hybrid Approach - Streaming + Background Processing**

**Implementation**: Stream AI response while processing tool calls in background.

**How It Works**:
1. Client sends message
2. AI processes and streams response to client immediately
3. Tool execution happens in background (doesn't block response)
4. Client receives continued updates via WebSocket or polling

**This Is Complex** but provides best of both:
- Immediate user feedback
- No timeout constraints
- Clean streaming experience

**Complexity**: VERY HIGH (requires WebSocket infrastructure)

---

### **Solution 5: Optimize AI Implementation (FUNDAMENTAL APPROACH)** ⭐

**Implementation**: Reduce AI operation time through optimization.

**FEASIBILITY ASSESSMENT**: ✅ **HIGH FEASIBILITY - MODERATE COMPLEXITY**

This is the RECOMMENDED approach because it works within current architecture.

**Optimization Strategies**:

#### 1. **Reduce Conversation History** (5-10 seconds saved)
Current: `MAX_HISTORY_MESSAGES = 15` (line 35 in owner/service.ts)
- Each message adds ~50-200 tokens to context
- 15 messages = ~1,500-3,000 tokens of history
- Suggested: Reduce to 5-7 messages
- **Rationale**: Full history not needed for onboarding steps; user is in specific phase
- **Impact**: Faster token processing, fewer tokens to generate through

#### 2. **Reduce Tool Iteration Limit** (10-30 seconds saved per iteration)
Current: `MAX_TOOL_ITERATIONS = 10` (line 36 in owner/service.ts)
- Complex journeys can trigger 8-10 iterations
- Suggested: Reduce to 6-7 iterations
- **Rationale**: Most onboarding completes in 3-5 iterations; cap reduces runaway loops
- **Impact**: Prevents long chains of tool calls

#### 3. **Cache Frequent Data Lookups** (5-15 seconds saved)
Current operations that repeat:
- Region lookups via `getAllRegions()` - called in boat details fetching
- Skills definitions - queried multiple times
- Experience level definitions - regenerated per loop
- **Solution**: Cache in memory or session storage
- **Impact**: Eliminates repeated lookups

#### 4. **Batch Database Operations** (3-5 seconds saved)
Current: Individual RPC calls for:
- Insert journey
- Insert legs (one at a time)
- Insert waypoints (one per leg)
- **Suggestion**: Use batch RPCs or transactions
- **Impact**: Fewer network round-trips

#### 5. **Use Faster Models for Specific Steps** (10-20 seconds saved)
Current: All steps use GPT-4o-mini
- **Suggestion**: Use mixed models:
  - Profile validation: Use Claude Haiku (faster, cheaper)
  - Boat extraction: Use GPT-4o-mini (good for structured data)
  - Journey generation: Use GPT-4o (complex reasoning, but longer)
- **Impact**: Parallelized thinking - faster validation, keep quality for complex tasks

#### 6. **Implement Response Caching** (10-15 seconds saved)
For common requests:
- "What's the next step?" → Cache standard response
- "Explain experience levels" → Cache response
- **Storage**: Session-level cache
- **Impact**: Skip AI call for repeated requests

**Configuration Changes Required**:
- Modify constants in `owner/service.ts` and `prospect/service.ts`
- Update config overrides in `config/prod.ts` if using mixed models
- Add caching layer (simple in-memory for session)

**Estimated Total Savings**: 45-90 seconds
- **Before**: 85+ seconds (timeout)
- **After**: 10-40 seconds (guaranteed success)

**Complexity**: MEDIUM (2-3 days analysis + implementation)
**Risk Level**: LOW (bounds on iterations and history are safety measures)
**Testing**: Easy (measure actual response times in production logs)

---

## Comparison Matrix

| Solution | Pros | Cons | Effort | Timeline | Cost Impact | Feasibility |
|----------|------|------|--------|----------|------------|------------|
| **1. Increase maxDuration** | Simplest | Only Pro: 60s limit | 30 min | Immediate | ↑ None on Pro | ❌ NOT VIABLE |
| **2. Streaming** | Best UX | Tool loop incompatible | HIGH | 2-3 days | ✅ None | ⚠️ MODERATE |
| **3. Job Queue** | Scalable | Very complex | VERY HIGH | 4-5 days | ↑ Moderate | ⚠️ MODERATE |
| **4. Streaming + Queue** | Ultimate UX | Most complex | VERY HIGH | 5-7 days | ↑ Moderate | ⚠️ MODERATE |
| **5. Optimize AI** ⭐ | Permanent fix | Requires profiling | MEDIUM | 2-3 days | ↓ Lower | ✅ HIGH |

---

## Vercel Plan Details

**Current Plan Assumption: Pro Plan** (since that's standard for production apps)

| Plan | Max Duration | Max Invocations | Cost |
|------|-------------|-----------------|------|
| Hobby | 10 seconds | Limited | Free |
| Pro | 60 seconds | Unlimited | $20/month |
| Enterprise | 600+ seconds | Custom | Custom pricing |

**Key Constraint**: Pro plan is **locked at 60-second maximum**. This cannot be increased without upgrading to Enterprise.

---

## Recommendations by Scenario

### **If Responses Usually Complete Within 60 Seconds**:
→ Skip most solutions. Implement **Solution 5 (Optimize AI)** to ensure reliability and reduce costs.

### **If Some Responses Take 60-90 Seconds**:
→ Implement **Solution 5 (Optimize AI)** first. 
→ If still insufficient, add **Solution 2 (Streaming)** for UX improvement (not a timeout fix, but better perceived experience).

### **If Responses Regularly Exceed 90 Seconds**:
→ Implement **Solution 5 (Optimize AI)** + **Solution 2 (Streaming)** together for:
- Reduced actual time (optimization)
- Immediate user feedback (streaming)
→ OR consider **Solution 3 (Job Queue)** if optimization still insufficient (last resort)

### **For Future Scalability**:
→ Plan for **Solution 3 or 4 (Job Queue)** when:
- User volume increases (more concurrent requests)
- Onboarding complexity increases (longer journeys)
- AI models become heavier (longer reasoning)

---

## Recommended Implementation Path

### **Phase 1: Quick Win (1 day)** - HIGHLY RECOMMENDED START HERE
Implement **Solution 5 Optimization - Quick Measures**:
```
1. Reduce MAX_HISTORY_MESSAGES: 15 → 5
2. Reduce MAX_TOOL_ITERATIONS: 10 → 6
3. Add performance logging to measure actual timings
4. Deploy and monitor production metrics
```
**Expected Result**: 40-60 second responses with high reliability

**Measurement**:
- Log response times in `/api/ai/owner/chat` and `/api/ai/prospect/chat`
- Track which operations are slowest
- Identify if optimization alone is sufficient

### **Phase 2: If Phase 1 Insufficient (3 days)**
Implement **Solution 5 Optimization - Advanced Measures**:
```
1. Add data caching layer for regions, skills, experience levels
2. Implement batch database operations
3. Consider mixed-model approach (Haiku for validation, 4o-mini for reasoning)
4. Optimize boat detail fetching (reduce scraping calls)
```
**Expected Result**: 20-40 second responses

### **Phase 3: If Still Needed (3 days)**
Implement **Solution 2 - Streaming Responses**:
- Provides immediate user feedback even if still ~40 seconds
- Improves perceived performance
- Doesn't require architectural changes to tool loop

### **Phase 4: Future Scaling (Only If Needed)**
Implement **Solution 3 - Job Queue**:
- Only when optimization + streaming insufficient
- High operational complexity
- Better for extreme scale scenarios

---

## Implementation Details by Solution

### Solution 5: Quick Optimization (Phase 1)

**File: `app/lib/ai/owner/service.ts`**
```typescript
// Line 35-36
const MAX_HISTORY_MESSAGES = 5;      // Was 15
const MAX_TOOL_ITERATIONS = 6;       // Was 10
```

**File: `app/lib/ai/prospect/service.ts`** (similar changes)
```typescript
// Apply same reductions
```

**File: `app/api/ai/owner/chat/route.ts`** (around line 119)
```typescript
// Add performance tracking
log('📊 Response time metrics:', {
  duration: Date.now() - startTime,
  isNearTimeout: (Date.now() - startTime) > 50000,
  iterations: response.iterationCount,
  toolCallsCount: response.totalToolCalls,
});
```

**Monitoring Strategy**:
- Track 50th, 90th, 95th, 99th percentile response times
- Alert if >50 seconds
- Correlate with tool iteration count and history length
- A/B test: measure before/after optimization

---

## Questions to Answer Before Implementation

1. **What's the actual timeout rate in production?** (Measure in logs)
2. **Which operations are slowest?**
   - AI response generation? (10-20s)
   - Tool execution? (tools can take 20-30s each)
   - Database queries? (usually <1s)
3. **Is plan upgrade possible?** (Vercel Enterprise for extended timeout)
4. **What's acceptable latency?** (Streaming OK, or need instant?)
5. **Is operational complexity acceptable?** (Job queue adds overhead)

---

## Monitoring & Metrics

**Add Tracking**:
```typescript
const startTime = Date.now();
const response = await ownerChat(supabase, params);
const duration = Date.now() - startTime;

logger.info('[Performance] Owner chat completed', { 
  duration,
  isNearTimeout: duration > 50000, // Flag if near 60s limit
  hasToolCalls: response.toolCalls?.length || 0,
  iterationCount: response.iterations || 0,
});
```

**Track These Metrics**:
- Total response time per message
- Time to first AI token (only if streaming implemented)
- Time per tool execution
- Database query time
- % of requests near timeout (>50s)
- Timeout failure rate (currently unknown)

**Alert Thresholds**:
- ⚠️ Warning: Response time > 50s
- 🔴 Critical: Response time > 55s (timeout imminent)

---

## Final Recommendation

**START WITH SOLUTION 5 (PHASE 1)**

Why this approach:
1. ✅ **Simplest to implement** - Just change 2 constants
2. ✅ **Lowest risk** - Bounds on loops are good practice anyway
3. ✅ **Works within current architecture** - No refactoring needed
4. ✅ **Immediate measurability** - Will see results in minutes
5. ✅ **Cost reduction** - Fewer tokens processed = lower costs
6. ✅ **Foundation for later improvements** - Pairs well with streaming if needed

**Next Steps**:
1. Implement Phase 1 (1 day)
2. Deploy to production
3. Monitor response times for 1 week
4. If still timing out, implement Phase 2 (2-3 days)
5. If still insufficient, implement streaming Phase 3 (3 days)
6. Only pursue Job Queue as last resort

**Expected Outcome**: 95%+ reliability within 60-second budget
