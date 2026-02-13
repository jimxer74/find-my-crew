# Proposal: Better LLM Models for Owner-Chat Tool Calling

## Current Situation

**Current Model:** `meta-llama/llama-3.1-8b-instruct` (8B parameters)
**Issues Observed:**
- Shows example tool call syntax instead of making actual tool calls
- Uses placeholder text (`{...}`) instead of complete arguments
- Hallucinates success when tools aren't actually called
- Struggles with structured JSON output

## Model Selection Criteria for Tool Calling

1. **Instruction Following**: Must reliably follow tool calling format instructions
2. **Structured Output**: Must generate valid JSON consistently
3. **Reasoning Capability**: Must understand when to call tools and with what arguments
4. **Context Window**: Must handle long conversations with tool results
5. **Cost**: Balance between quality and cost
6. **Availability**: Must be available via existing providers (OpenRouter, Groq, DeepSeek, Gemini)

## Recommended Models (Ranked by Priority)

### Option 1: Claude 3.5 Sonnet (via OpenRouter) ⭐ **RECOMMENDED**

**Model ID:** `anthropic/claude-3.5-sonnet`

**Why This Model:**
- ✅ **Excellent tool calling**: Claude models are specifically optimized for tool use
- ✅ **Superior instruction following**: Best-in-class at following complex instructions
- ✅ **Reliable JSON output**: Consistently generates valid, complete JSON
- ✅ **Strong reasoning**: Understands context and makes logical decisions
- ✅ **Large context window**: 200K tokens (handles long conversations)
- ✅ **Available via OpenRouter**: Already configured in your setup

**Trade-offs:**
- ⚠️ **Higher cost**: ~$3-15 per 1M input tokens, ~$15 per 1M output tokens
- ⚠️ **Slower**: Not as fast as smaller models

**Best For:** Production use where reliability and correctness matter most

**Configuration:**
```typescript
'owner-chat': {
  providers: [{
    provider: 'openrouter',
    models: ['anthropic/claude-3.5-sonnet'],
    temperature: 0.3,  // Lower for more deterministic tool calls
    maxTokens: 8000
  }],
  temperature: 0.3,
  maxTokens: 8000
}
```

---

### Option 2: GPT-4o (via OpenRouter) ⭐ **STRONG ALTERNATIVE**

**Model ID:** `openai/gpt-4o` or `openai/gpt-4o-2024-11-20`

**Why This Model:**
- ✅ **Excellent tool calling**: OpenAI models excel at function calling
- ✅ **Reliable structured output**: Very consistent JSON generation
- ✅ **Fast**: Optimized for speed while maintaining quality
- ✅ **Good instruction following**: Strong at following complex prompts
- ✅ **128K context window**: Handles long conversations
- ✅ **Available via OpenRouter**: Already configured

**Trade-offs:**
- ⚠️ **Cost**: ~$2.50-5 per 1M input tokens, ~$10 per 1M output tokens
- ⚠️ **Slightly less capable than Claude 3.5 Sonnet** for complex reasoning

**Best For:** Production use where you need speed + reliability

**Configuration:**
```typescript
'owner-chat': {
  providers: [{
    provider: 'openrouter',
    models: ['openai/gpt-4o'],
    temperature: 0.3,
    maxTokens: 8000
  }],
  temperature: 0.3,
  maxTokens: 8000
}
```

---

### Option 3: GPT-4o Mini (via OpenRouter) 💰 **COST-EFFECTIVE**

**Model ID:** `openai/gpt-4o-mini`

**Why This Model:**
- ✅ **Good tool calling**: Strong function calling capabilities
- ✅ **Much cheaper**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- ✅ **Fast**: Very fast response times
- ✅ **Reliable**: More reliable than 8B models for structured output
- ✅ **128K context window**: Handles long conversations

**Trade-offs:**
- ⚠️ **Less capable than GPT-4o/Claude**: May struggle with very complex reasoning
- ⚠️ **Still more expensive than Llama 3.1 8B**: But much better quality

**Best For:** Development/testing or cost-sensitive production use

**Configuration:**
```typescript
'owner-chat': {
  providers: [{
    provider: 'openrouter',
    models: ['openai/gpt-4o-mini'],
    temperature: 0.3,
    maxTokens: 8000
  }],
  temperature: 0.3,
  maxTokens: 8000
}
```

---

### Option 4: Llama 3.1 70B Instruct (via Groq) ⚡ **FAST & FREE TIER**

**Model ID:** `llama-3.1-70b` (via Groq)

**Why This Model:**
- ✅ **Much better than 8B**: 70B parameters = significantly better reasoning
- ✅ **Fast**: Groq provides very fast inference
- ✅ **Free tier available**: Groq offers generous free tier
- ✅ **Good tool calling**: Better structured output than 8B version
- ✅ **Already configured**: Groq provider is already set up

**Trade-offs:**
- ⚠️ **Still not as reliable as Claude/GPT-4**: May still show example syntax occasionally
- ⚠️ **Smaller context window**: 8K tokens (may need to manage conversation length)

**Best For:** Development/testing or when cost is a major concern

**Configuration:**
```typescript
'owner-chat': {
  providers: [{
    provider: 'groq',
    models: ['llama-3.1-70b'],
    temperature: 0.3,  // Lower for more deterministic tool calls
    maxTokens: 8000
  }],
  temperature: 0.3,
  maxTokens: 8000
}
```

---

### Option 5: Llama 3.3 70B (via Groq) 🆕 **NEWER VERSION**

**Model ID:** `llama-3.3-70b` (via Groq)

**Why This Model:**
- ✅ **Newer than 3.1**: Improved instruction following
- ✅ **Better tool calling**: Enhanced structured output capabilities
- ✅ **Fast**: Groq inference speed
- ✅ **Free tier available**: Groq free tier

**Trade-offs:**
- ⚠️ **Newer model**: Less battle-tested than 3.1
- ⚠️ **Still not Claude/GPT-4 level**: But better than 8B

**Best For:** Development/testing with newer model capabilities

**Configuration:**
```typescript
'owner-chat': {
  providers: [{
    provider: 'groq',
    models: ['llama-3.3-70b'],
    temperature: 0.3,
    maxTokens: 8000
  }],
  temperature: 0.3,
  maxTokens: 8000
}
```

---

### Option 6: Qwen2.5 72B (via OpenRouter) 🌏 **ALTERNATIVE**

**Model ID:** `qwen/qwen-2.5-72b-instruct`

**Why This Model:**
- ✅ **Large model**: 72B parameters = good reasoning
- ✅ **Good tool calling**: Strong structured output
- ✅ **Cost-effective**: Lower cost than Claude/GPT-4
- ✅ **Available via OpenRouter**: Already configured

**Trade-offs:**
- ⚠️ **Less proven**: Not as widely tested as Claude/GPT-4
- ⚠️ **May have quirks**: Different training may have unexpected behaviors

**Best For:** Cost-conscious production use with good quality

**Configuration:**
```typescript
'owner-chat': {
  providers: [{
    provider: 'openrouter',
    models: ['qwen/qwen-2.5-72b-instruct'],
    temperature: 0.3,
    maxTokens: 8000
  }],
  temperature: 0.3,
  maxTokens: 8000
}
```

---

## Hybrid Approach: Fallback Chain

**Recommended Strategy:** Use a fallback chain - try premium model first, fallback to cheaper if needed

```typescript
'owner-chat': {
  providers: [
    {
      provider: 'openrouter',
      models: [
        'anthropic/claude-3.5-sonnet',  // Primary: Best quality
        'openai/gpt-4o-mini'            // Fallback: Good quality, cheaper
      ],
      temperature: 0.3,
      maxTokens: 8000
    },
    {
      provider: 'groq',
      models: ['llama-3.1-70b'],        // Fallback: Fast, free tier
      temperature: 0.3,
      maxTokens: 8000
    }
  ],
  temperature: 0.3,
  maxTokens: 8000
}
```

This ensures:
- Best quality when available
- Cost savings when premium models fail/rate limit
- Reliability through multiple providers

---

## Cost Comparison (Approximate)

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Quality | Speed |
|-------|---------------------|---------------------|---------|-------|
| Llama 3.1 8B (current) | ~$0.05 | ~$0.05 | ⭐⭐ | ⚡⚡⚡ |
| Llama 3.1 70B (Groq) | Free tier | Free tier | ⭐⭐⭐ | ⚡⚡⚡ |
| GPT-4o Mini | ~$0.15 | ~$0.60 | ⭐⭐⭐⭐ | ⚡⚡ |
| GPT-4o | ~$2.50-5 | ~$10 | ⭐⭐⭐⭐⭐ | ⚡⚡ |
| Claude 3.5 Sonnet | ~$3-15 | ~$15 | ⭐⭐⭐⭐⭐ | ⚡ |
| Qwen2.5 72B | ~$0.20 | ~$0.20 | ⭐⭐⭐⭐ | ⚡⚡ |

---

## Recommended Implementation Plan

### Phase 1: Immediate (Development)
**Use:** GPT-4o Mini or Llama 3.1 70B (Groq)
- **Reason**: Good balance of quality and cost
- **Goal**: Fix tool calling issues while keeping costs low
- **Expected improvement**: 70-80% reduction in tool calling failures

### Phase 2: Production (Initial)
**Use:** GPT-4o Mini with Claude 3.5 Sonnet fallback
- **Reason**: Reliable quality with cost optimization
- **Goal**: Ensure tool calling works correctly in production
- **Expected improvement**: 90-95% reduction in tool calling failures

### Phase 3: Production (Optimized)
**Use:** Claude 3.5 Sonnet primary, GPT-4o Mini fallback
- **Reason**: Best quality for critical user-facing features
- **Goal**: Maximize reliability and user experience
- **Expected improvement**: 95-99% reduction in tool calling failures

---

## Testing Strategy

After switching models:

1. **Test Tool Calling:**
   - Test journey creation flow (the exact scenario that failed)
   - Verify tool calls are parsed correctly
   - Verify complete arguments (no `{...}` placeholders)

2. **Test Hallucination:**
   - Verify AI doesn't claim success when tools fail
   - Verify AI waits for tool results before claiming success

3. **Monitor Metrics:**
   - Track tool call parse success rate
   - Track tool execution success rate
   - Track user-reported issues

4. **Cost Monitoring:**
   - Track token usage per conversation
   - Track cost per successful journey creation
   - Compare against previous model costs

---

## Additional Recommendations

### 1. Lower Temperature for Tool Calls
**Current:** `temperature: 0.7`  
**Recommended:** `temperature: 0.3`

**Why:** Lower temperature = more deterministic, less creative = better structured output

### 2. Add Model-Specific Instructions
Some models respond better to different instruction formats:
- **Claude/GPT-4**: Work well with explicit examples
- **Llama**: May need more explicit "DO NOT" instructions

### 3. Consider Tool Calling Format
Some models support native function calling:
- **Claude/GPT-4**: Support OpenAI-compatible function calling
- **Llama**: Requires JSON-in-text format (current approach)

If switching to Claude/GPT-4, consider using native function calling API instead of JSON parsing.

---

## Conclusion

**Top Recommendation:** **Claude 3.5 Sonnet** (via OpenRouter) for production, with **GPT-4o Mini** as fallback.

**Reasoning:**
- Claude models are specifically optimized for tool use
- Best instruction following = fewer tool calling failures
- Reliable JSON output = fewer parsing errors
- Strong reasoning = better argument gathering

**Cost-Benefit:** The cost increase is justified by:
- Reduced support burden (fewer failed tool calls)
- Better user experience (journeys actually get created)
- Reduced debugging time (fewer edge cases)

**Quick Win:** Start with **GPT-4o Mini** - it's a significant upgrade from Llama 3.1 8B at reasonable cost, then evaluate if Claude 3.5 Sonnet is needed.
