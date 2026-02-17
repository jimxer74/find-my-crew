# Production-Safe Logging Guide

## Overview

The logger provides structured logging with dynamic debug control for AI flows and other critical operations. This enables verbose logging in production when needed for issue analysis without affecting performance.

## Quick Start

### Basic Usage

```typescript
import { logger } from '@/app/lib/logger';

// Always logged
logger.info('User authenticated', { userId: user.id });
logger.warn('Quota limit approaching', { current: 95, max: 100 });
logger.error('Database connection failed', { error: err.message });

// Logged only when debug is enabled
logger.debug('Query parameters', { filters: req.query });

// Trace level - most verbose, for detailed flow tracking
logger.trace('Processing step 1', { input: data });
```

### AI Flow Logging

For AI operations, use the specialized AI flow logger:

```typescript
import { logger } from '@/app/lib/logger';

logger.aiFlow('prompt_generation', 'Building prompt from user data', {
  dataSize: facebookData.posts.length,
});

logger.aiFlow('ai_call', 'Sending request to Claude', {
  model: 'claude-3-sonnet',
  tokenEstimate: 2500,
});

logger.aiFlow('response_parsing', 'Parsing AI response', {
  responseLength: response.length,
});

logger.aiFlow('validation', 'Validating parsed result', {
  fields: Object.keys(result),
});
```

## Debug Control

### Environment Variable (Startup)

Set `LOG_LEVEL` environment variable:

```bash
# Development - verbose
LOG_LEVEL=TRACE npm run dev

# Production - normal
LOG_LEVEL=INFO npm start

# Production - quiet
LOG_LEVEL=WARN npm start
```

### Request Headers (Runtime)

Control logging per-request using headers:

```bash
# Enable TRACE level for this request
curl -H "X-Debug-Level: TRACE" https://api.example.com/api/ai/generate-profile

# Enable TRACE and AI flow debug
curl -H "X-Debug-Level: TRACE" -H "X-AI-Flow-Debug: true" https://api.example.com/api/ai/generate-profile

# Mark route as verbose for all future requests
curl -H "X-Verbose-Route: true" https://api.example.com/api/ai/generate-profile
```

### In API Routes

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { applyDebugLevel } from '@/app/lib/debugMiddleware';
import { logger } from '@/app/lib/logger';

export async function POST(request: NextRequest) {
  // Apply debug level from request headers
  applyDebugLevel(request);

  logger.aiFlow('request_received', 'Processing AI request', {
    contentLength: request.headers.get('content-length'),
    userAgent: request.headers.get('user-agent'),
  });

  try {
    // ... process request
    logger.aiFlow('processing', 'Step completed', { result: 'success' });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('AI processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
```

## Log Levels

### TRACE
Most verbose. Use for:
- Function entry/exit
- Variable state changes
- Loop iterations
- Detailed flow tracking

```typescript
logger.trace('Processing item', { index: i, id: item.id });
```

### DEBUG
Detailed information. Use for:
- Data transformations
- Query results
- Conditional logic
- Function parameters

```typescript
logger.debug('Query executed', { rows: result.length, duration: '45ms' });
```

### INFO
General information. Use for:
- Request received
- Operation completed
- Important state changes

```typescript
logger.info('User profile created', { userId: user.id });
```

### WARN
Warning information. Always logged. Use for:
- Unexpected conditions
- Performance concerns
- Deprecated usage

```typescript
logger.warn('Slow query detected', { duration: 5000, query: 'users_search' });
```

### ERROR
Error information. Always logged. Use for:
- Exceptions
- Failed operations
- System issues

```typescript
logger.error('Failed to save profile', { error: err.message });
```

## AI Flow Example

Here's a complete example of AI flow logging:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { applyDebugLevel } from '@/app/lib/debugMiddleware';
import { logger } from '@/app/lib/logger';
import { callAI } from '@/app/lib/ai/service';

export async function POST(request: NextRequest) {
  // Enable debug control for this request
  applyDebugLevel(request);

  const body = await request.json();

  logger.aiFlow('start', 'AI profile generation started');

  try {
    // Step 1: Prepare data
    logger.aiFlow('prepare_data', 'Extracting Facebook data', {
      hasProfile: !!body.profile,
      postCount: body.posts?.length || 0,
      likeCount: body.likes?.length || 0,
    });

    const prompt = buildPrompt(body);
    logger.trace('Generated prompt', { length: prompt.length });

    // Step 2: Call AI
    logger.aiFlow('call_ai', 'Calling Claude API', {
      model: 'claude-3-sonnet',
      promptTokens: Math.ceil(prompt.length / 4),
    });

    const aiResponse = await callAI(prompt);
    logger.trace('AI response received', { length: aiResponse.length });

    // Step 3: Parse response
    logger.aiFlow('parse_response', 'Parsing AI response', {
      responsePreview: aiResponse.substring(0, 100),
    });

    const result = parseAIResponse(aiResponse);
    logger.trace('Parsed successfully', {
      fields: Object.keys(result),
    });

    // Step 4: Validate
    logger.aiFlow('validate', 'Validating parsed result', {
      hasUsername: !!result.username,
      skillCount: result.skills?.length || 0,
    });

    // Return result
    logger.aiFlow('complete', 'Profile generation completed');
    return NextResponse.json(result);

  } catch (error) {
    logger.error('Profile generation failed', {
      stage: error instanceof Error ? (error as any).stage : 'unknown',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Profile generation failed' },
      { status: 500 }
    );
  }
}
```

## Production Debugging Workflow

When an issue is reported in production:

1. **Identify the endpoint**: Note the API route that failed
2. **Enable debug logging**:
   ```bash
   curl -H "X-Debug-Level: TRACE" -H "X-AI-Flow-Debug: true" <endpoint>
   ```
3. **Reproduce the issue**: Make the request with debug headers enabled
4. **Check logs**: Review detailed logs with full context
5. **Disable debug**: Debug logging is per-request, no restart needed

## Performance Impact

- **Production (INFO level)**: Minimal - only necessary logs
- **Debug level**: ~10% overhead, suitable for troubleshooting
- **TRACE level**: ~20% overhead, use only when deeply debugging

## Best Practices

1. **Use appropriate levels**: Don't log everything at INFO level
2. **Include context**: Always pass relevant data in the context object
3. **AI flows**: Use `logger.aiFlow()` for AI operations
4. **Sensitive data**: Don't log passwords, API keys, or PII
5. **Production**: Keep default to INFO level for performance

## Configuration

Edit `app/lib/logger.ts` to:
- Change default log level
- Add custom formatters
- Add integrations (e.g., to Sentry, LogRocket)
- Add request ID tracking

## Future Enhancements

- [ ] Integration with external logging services (Sentry, LogRocket)
- [ ] Request ID tracking for tracing
- [ ] Performance metrics logging
- [ ] Structured logging with field indexing
- [ ] Sampling for high-volume logs
