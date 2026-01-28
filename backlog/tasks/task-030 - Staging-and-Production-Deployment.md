---
id: TASK-030
title: Staging and Production Deployment
status: Done
assignee: []
created_date: '2026-01-25 17:04'
updated_date: '2026-01-28 13:21'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Production Deployment Guide - Step-by-Step Instructions

This guide provides comprehensive instructions for deploying Find My Crew to staging and production environments.

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Vercel account (Pro plan recommended)
- [ ] Supabase account (Pro plan recommended)
- [ ] GitHub repository access
- [ ] Resend account for email (already integrated)
- [ ] All API keys and secrets ready

---

## Phase 1: Pre-deployment Security

### Step 1.1: Rotate API Keys and Secrets

1. Generate new API keys for:
   - Supabase (if needed)
   - Mapbox
   - Resend
   - AI services (DeepSeek, Groq, Google Gemini)
   - ScraperAPI (if used)

2. Document old keys (for rollback if needed)

---

## Phase 2: Supabase Database Setup

### Step 2.1: Apply RLS Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `migrations/008_registrations_rls.sql`
3. Run the migration:
   ```sql
   -- The migration enables RLS and creates 7 policies
   ```
4. Verify policies:
   - Go to Database → Policies
   - Confirm 7 policies exist on `registrations` table
   - Test with a test user account

### Step 2.2: Verify Database Configuration

- [ ] RLS enabled on `registrations` table
- [ ] All required tables exist
- [ ] Storage buckets configured (profile-images, etc.)
- [ ] Database backups enabled

---

## Phase 3: Vercel Project Setup

### Step 3.1: Create/Connect Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - Framework Preset: Next.js
   - Root Directory: `./` (default)
   - Build Command: `npm run build`
   - Output Directory: `.next` (default)

### Step 3.2: Configure Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

#### Required Variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
RELEASE_TYPE=pilot
```

#### Optional but Recommended:
```
RESEND_API_KEY=your_resend_key
EMAIL_FROM=Sail Smart <notifications@sailsm.art>
DEEPSEEK_API_KEY=your_deepseek_key
GROQ_API_KEY=your_groq_key
GOOGLE_GEMINI_API_KEY=your_gemini_key
SCRAPERAPI_API_KEY=your_scraperapi_key (if used)
```

#### For Each Environment:
- **Production**: Set all variables
- **Preview**: Set all variables (for staging)
- **Development**: Optional (for local dev)

### Step 3.3: Get Vercel Project IDs

1. Go to Project Settings → General
2. Copy:
   - Organization ID (`VERCEL_ORG_ID`)
   - Project ID (`VERCEL_PROJECT_ID`)
3. Save these for GitHub secrets

---

## Phase 4: GitHub Actions Configuration

### Step 4.1: Create Vercel Token

1. Go to [Vercel Account Settings → Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name: `github-actions-deployment`
4. Scope: Full Account
5. Expiration: Set appropriate (or no expiration)
6. Copy the token (you won't see it again)

### Step 4.2: Configure GitHub Secrets

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add these secrets:

| Secret Name | Value | Where to Get It |
|------------|-------|-----------------|
| `VERCEL_TOKEN` | Your Vercel token | Vercel Account Settings → Tokens |
| `VERCEL_ORG_ID` | Your org ID | Vercel Project Settings → General |
| `VERCEL_PROJECT_ID` | Your project ID | Vercel Project Settings → General |

3. Optional: Add other secrets if needed:
   - `NEXT_PUBLIC_SUPABASE_URL` (if different from Vercel env vars)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (if different from Vercel env vars)

### Step 4.3: Configure GitHub Environments

1. Go to Settings → Environments
2. Create environments:
   - `staging` (for staging deployments)
   - `production` (for production deployments)
3. For `production`:
   - Add required reviewers (optional)
   - Set deployment protection rules (optional)

---

## Phase 5: Test Staging Deployment

### Step 5.1: Trigger Staging Deployment

1. Push to `main` branch:
   ```bash
   git checkout main
   git pull origin main
   # Make a small change or just push
   git push origin main
   ```
2. Check GitHub Actions:
   - Go to Actions tab
   - Watch `Deploy to Staging` workflow
   - Verify it completes successfully

### Step 5.2: Verify Staging Deployment

1. Check Vercel Dashboard → Deployments
2. Verify staging URL is accessible
3. Test critical features:
   - [ ] User signup/login
   - [ ] Boat creation (should respect limits)
   - [ ] Journey creation (should respect limits)
   - [ ] Registration flow
   - [ ] Map functionality
   - [ ] Email notifications

### Step 5.3: Fix Any Issues

- Check Vercel logs for errors
- Check Supabase logs
- Review GitHub Actions logs

---

## Phase 6: Production Deployment

### Step 6.1: Prepare for Production

1. Ensure all tests pass:
   ```bash
   npm run lint
   npm run test:run
   npm run build
   ```

2. Update version if needed:
   - Check `package.json` version
   - Consider updating for production release

3. Review pilot limits (in `app/lib/limits/config.ts`):
   - maxBoatsPerUser: 1
   - maxJourneysPerUser: 2
   - maxLegsPerJourney: 10
   - maxRegisteredUsers: 50
   - maxWaypointsPerLeg: 20
   - maxImagesPerBoat: 5

### Step 6.2: Deploy to Production

1. Go to GitHub → Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Fill in parameters:
   - **Release type**: `pilot` (for first deployment)
   - **Create tag**: `true`
   - **Tag name**: `v1.0.0-pilot` (follow semver: `v1.0.0`, `v1.0.0-pilot`, etc.)
5. Click "Run workflow"
6. Wait for:
   - Validation
   - CI checks
   - Deployment

### Step 6.3: Verify Production Deployment

1. Check deployment URL in GitHub Actions summary
2. Test production site:
   - [ ] Homepage loads
   - [ ] Authentication works
   - [ ] Core features function
   - [ ] Limits are enforced
   - [ ] Security headers present (check browser DevTools → Network → Response Headers)

3. Check Vercel Analytics (if enabled)

---

## Phase 7: Post-deployment

### Step 7.1: Monitor Deployment

1. Check Vercel Dashboard:
   - Deployment status
   - Function logs
   - Analytics

2. Check Supabase Dashboard:
   - Database performance
   - Auth logs
   - Storage usage

3. Monitor error rates:
   - Vercel logs
   - Browser console errors
   - User reports

### Step 7.2: Set Up Monitoring (Optional)

1. **Sentry integration** (if desired):
   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs
   ```
   - Follow Sentry wizard instructions
   - Add `SENTRY_DSN` to Vercel environment variables

2. **Vercel Analytics**:
   - Enable in Vercel Dashboard → Analytics
   - Monitor performance metrics

### Step 7.3: Update Documentation

- [ ] Update README with production URL
- [ ] Document deployment process
- [ ] Update team on production status

---

## Phase 8: Rollback Plan (If Needed)

### If Deployment Fails:

1. **In Vercel Dashboard**:
   - Go to Deployments
   - Find last working deployment
   - Click "..." → "Promote to Production"

2. **If database migration caused issues**:
   - Revert migration in Supabase SQL Editor
   - Check `specs/tables.sql` for previous state

3. **If environment variables are wrong**:
   - Update in Vercel Dashboard
   - Redeploy

---

## Quick Reference: Environment Variables Checklist

### Required:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- [ ] `RELEASE_TYPE` (set to `pilot` for first deployment)

### Recommended:
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM`
- [ ] `DEEPSEEK_API_KEY` (if using AI features)
- [ ] `GROQ_API_KEY` (if using AI features)
- [ ] `GOOGLE_GEMINI_API_KEY` (if using AI features)

### GitHub Secrets:
- [ ] `VERCEL_TOKEN`
- [ ] `VERCEL_ORG_ID`
- [ ] `VERCEL_PROJECT_ID`

---

## Troubleshooting

### Common Issues:

1. **Build fails**:
   - Check Vercel build logs
   - Verify all environment variables are set
   - Check TypeScript errors locally first

2. **RLS policies blocking access**:
   - Verify migration was applied correctly
   - Check Supabase logs for policy violations
   - Test with different user roles

3. **Rate limiting too strict**:
   - Adjust limits in `middleware.ts`
   - Consider upgrading to Vercel KV for production

4. **Limits not working**:
   - Verify `RELEASE_TYPE` is set correctly
   - Check `app/lib/limits/config.ts`
   - Review form validation in `BoatFormModal.tsx` and `JourneyFormModal.tsx`

---

## Next Steps After Pilot Deployment

1. Monitor usage and performance
2. Gather user feedback
3. Plan beta release (update `RELEASE_TYPE=beta` when ready)
4. Scale limits as needed
5. Consider upgrading to Vercel KV for rate limiting
6. Add Sentry for error tracking
7. Set up automated backups

---

## Related Files

- Migration: `migrations/008_registrations_rls.sql`
- Limits Config: `app/lib/limits/config.ts`
- CI/CD Workflows:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy-staging.yml`
  - `.github/workflows/deploy-production.yml`
- Security Headers: `next.config.ts`
- Rate Limiting: `middleware.ts`

---

This guide covers the manual steps required for deployment. Start with Phase 1 and proceed sequentially. If you need help with a specific step, refer to the relevant documentation or contact the development team.
<!-- SECTION:DESCRIPTION:END -->
