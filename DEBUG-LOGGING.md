# Debug Logging Setup

## Quick Reference

### Vercel Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables**:

```
LOG_LEVEL = DEBUG
NEXT_PUBLIC_LOG_LEVEL = DEBUG
```

**Important**: After adding/changing these variables, you MUST **redeploy** for changes to take effect.

---

## How It Works

### Server-Side Logs (Vercel Function Logs)
- **Variable**: `LOG_LEVEL=DEBUG`
- **Where**: API routes, server components, middleware
- **Examples**:
  - `/api/auth/callback` → Session linking logs
  - `/api/onboarding/after-consent` → Consent processing
  - `/api/ai/owner/chat` → AI conversation handling
- **View**: Vercel Dashboard → Deployments → [Your deployment] → Functions → View logs

### Client-Side Logs (Browser Console)
- **Variable**: `NEXT_PUBLIC_LOG_LEVEL=DEBUG`
- **Where**: Client components, browser-side code
- **Examples**:
  - `ConsentSetupModal` → Consent UI interactions
  - `OwnerChatContext` → Chat interface events
  - `ProspectChatContext` → Crew onboarding flow
- **View**: Browser DevTools → Console tab

---

## Log Levels

Available levels (most to least verbose):

1. **`TRACE`** - Everything (very verbose)
2. **`DEBUG`** - Debug + Info + Warn + Error ← **Recommended for troubleshooting**
3. **`INFO`** - Info + Warn + Error (default production setting)
4. **`WARN`** - Warnings + Errors only
5. **`ERROR`** - Errors only

---

## What You'll See with DEBUG Enabled

### Auth/OAuth Flow Logs
```
[INFO] LOGIN CALLBACK: Successfully exchanged code for session
[INFO] LOGIN CALLBACK: Checking for NULL user_id sessions to link
[INFO] LOGIN CALLBACK: Linking NULL owner_session to user
[INFO] LOGIN CALLBACK: Successfully linked owner_session
[INFO] LOGIN CALLBACK: Session detection results
[DEBUG] [RedirectService] pending_owner_onboarding (priority 1): /welcome/owner
```

### Consent Modal Logs
```
[DEBUG] [ConsentSetupModal] Checking consent setup
[DEBUG] [ConsentSetupModal] Active AI session detected, defaulting AI processing to true
[DEBUG] [ConsentSetupModal] handleSave starting
[DEBUG] [ConsentSetupModal] Consent saved, closing modal
[DEBUG] [ConsentSetupModal] Navigating with query params to trigger profile completion
```

### Session Context Logs
```
[DEBUG] [ConsentSetupContext] Checking consent setup
[DEBUG] [ConsentSetupContext] Consent query result
[DEBUG] [ConsentSetupContext] Render condition check
[DEBUG] [ConsentSetupContext] Rendering ConsentSetupModal
```

---

## Temporarily Enable Debug (Without Redeploy)

You can also enable debug logging at runtime via browser console:

```javascript
// Check current config
window.loggerState?.getConfig()

// Enable debug level temporarily
window.loggerState?.setDebugLevel('DEBUG')

// Enable AI flow debug
window.loggerState?.setAIFlowDebug(true)
```

**Note**: This only works for client-side code and resets on page refresh.

---

## Production Best Practices

### Normal Operation
```
LOG_LEVEL = INFO
NEXT_PUBLIC_LOG_LEVEL = INFO
```

### Investigation/Debugging
```
LOG_LEVEL = DEBUG
NEXT_PUBLIC_LOG_LEVEL = DEBUG
```

### Performance Issues (Reduce Noise)
```
LOG_LEVEL = WARN
NEXT_PUBLIC_LOG_LEVEL = WARN
```

---

## Troubleshooting

### "I set DEBUG but still see only INFO logs"

**Check**:
1. ✅ Did you add **both** `LOG_LEVEL` and `NEXT_PUBLIC_LOG_LEVEL`?
2. ✅ Did you **redeploy** after adding the variables?
3. ✅ Are you looking in the right place?
   - Server logs → Vercel Function logs
   - Client logs → Browser console
4. ✅ Did you hard refresh the page? (Ctrl+Shift+R)

### "Server logs are DEBUG but client logs are still INFO"

You likely forgot to set `NEXT_PUBLIC_LOG_LEVEL=DEBUG`. Client-side code **requires** the `NEXT_PUBLIC_` prefix.

### "I see too many logs, it's overwhelming"

Set specific routes to verbose instead of everything:

```javascript
// In browser console
window.loggerState?.addVerboseRoute('/welcome/owner')
```

Or reduce log level to `WARN` to see only warnings and errors.

---

## Related Files

- **Logger Implementation**: `app/lib/logger.ts`
- **Auth Callback Logging**: `app/auth/callback/route.ts`
- **Consent Modal Logging**: `app/components/auth/ConsentSetupModal.tsx`
- **Redirect Service Logging**: `app/lib/routing/redirectHelpers.server.ts`

---

Last Updated: 2026-02-21
