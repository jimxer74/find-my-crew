---
id: TASK-030
title: Staging and Production Deployment
status: To Do
assignee: []
created_date: '2026-01-25 17:04'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Production Deployment Guide - Step-by-Step Instructions
Prerequisites checklist
[ ] Vercel account (Pro plan recommended)
[ ] Supabase account (Pro plan recommended)
[ ] GitHub repository access
[ ] Resend account for email (already integrated)
[ ] All API keys and secrets ready
Phase 1: Pre-deployment security
Step 1.1: Rotate API keys and secrets
Generate new API keys for:
Supabase (if needed)
Mapbox
Resend
AI services (DeepSeek, Groq, Google Gemini)
ScraperAPI (if used)
Document old keys (for rollback if needed)
Phase 2: Supabase database setup
Step 2.1: Apply RLS migration
Open Supabase Dashboard → SQL Editor
Copy contents of migrations/008_registrations_rls.sql
Run the migration:
   -- The migration enables RLS and creates 7 policies
Verify policies:
Go to Database → Policies
Confirm 7 policies exist on registrations table
Test with a test user account
Step 2.2: Verify database configuration
[ ] RLS enabled on registrations table
[ ] All required tables exist
[ ] Storage buckets configured (profile-images, etc.)
[ ] Database backups enabled
Phase 3: Vercel project setup
Step 3.1: Create/connect Vercel project
Go to Vercel Dashboard
Click "Add New Project"
Import your GitHub repository
Configure:
Framework Preset: Next.js
Root Directory: ./ (default)
Build Command: npm run build
Output Directory: .next (default)
Step 3.2: Configure environment variables
Add these in Vercel Dashboard → Settings → Environment Variables:
Required variables:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_urlNEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_keyNEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_tokenRELEASE_TYPE=pilot
Optional but recommended:
RESEND_API_KEY=your_resend_keyEMAIL_FROM=Sail Smart <notifications@sailsm.art>DEEPSEEK_API_KEY=your_deepseek_keyGROQ_API_KEY=your_groq_keyGOOGLE_GEMINI_API_KEY=your_gemini_keySCRAPERAPI_API_KEY=your_scraperapi_key (if used)
For each environment:
Production: Set all variables
Preview: Set all variables (for staging)
Development: Optional (for local dev)
Step 3.3: Get Vercel project IDs
Go to Project Settings → General
Copy:
Organization ID (VERCEL_ORG_ID)
Project ID (VERCEL_PROJECT_ID)
Save these for GitHub secrets
Phase 4: GitHub Actions configuration
Step 4.1: Create Vercel token
Go to Vercel Account Settings → Tokens
Click "Create Token"
Name: github-actions-deployment
Scope: Full Account
Expiration: Set appropriate (or no expiration)
Copy the token (you won't see it again)
Step 4.2: Configure GitHub secrets
Go to GitHub repository → Settings → Secrets and variables → Actions
Add these secrets:
Secret Name	Value	Where to Get It
VERCEL_TOKEN	Your Vercel token	Vercel Account Settings → Tokens
VERCEL_ORG_ID	Your org ID	Vercel Project Settings → General
VERCEL_PROJECT_ID	Your project ID	Vercel Project Settings → General
Optional: Add other secrets if needed:
NEXT_PUBLIC_SUPABASE_URL (if different from Vercel env vars)
NEXT_PUBLIC_SUPABASE_ANON_KEY (if different from Vercel env vars)
Step 4.3: Configure GitHub environments
Go to Settings → Environments
Create environments:
staging (for staging deployments)
production (for production deployments)
For production:
Add required reviewers (optional)
Set deployment protection rules (optional)
Phase 5: Test staging deployment
Step 5.1: Trigger staging deployment
Push to main branch:
   git checkout main   git pull origin main   # Make a small change or just push   git push origin main
Check GitHub Actions:
Go to Actions tab
Watch Deploy to Staging workflow
Verify it completes successfully
Step 5.2: Verify staging deployment
Check Vercel Dashboard → Deployments
Verify staging URL is accessible
Test critical features:
[ ] User signup/login
[ ] Boat creation (should respect limits)
[ ] Journey creation (should respect limits)
[ ] Registration flow
[ ] Map functionality
[ ] Email notifications
Step 5.3: Fix any issues
Check Vercel logs for errors
Check Supabase logs
Review GitHub Actions logs
Phase 6: Production deployment
Step 6.1: Prepare for production
Ensure all tests pass:
   npm run lint   npm run test:run   npm run build
Update version if needed:
Check package.json version
Consider updating for production release
Review pilot limits (in app/lib/limits/config.ts):
maxBoatsPerUser: 1
maxJourneysPerUser: 2
maxLegsPerJourney: 10
maxRegisteredUsers: 50
maxWaypointsPerLeg: 20
maxImagesPerBoat: 5
Step 6.2: Deploy to production
Go to GitHub → Actions
Select "Deploy to Production" workflow
Click "Run workflow"
Fill in parameters:
Release type: pilot (for first deployment)
Create tag: true
Tag name: v1.0.0-pilot (follow semver: v1.0.0, v1.0.0-pilot, etc.)
Click "Run workflow"
Wait for:
Validation
CI checks
Deployment
Step 6.3: Verify production deployment
Check deployment URL in GitHub Actions summary
Test production site:
[ ] Homepage loads
[ ] Authentication works
[ ] Core features function
[ ] Limits are enforced
[ ] Security headers present (check browser DevTools → Network → Response Headers)
Check Vercel Analytics (if enabled)
Phase 7: Post-deployment
Step 7.1: Monitor deployment
Check Vercel Dashboard:
Deployment status
Function logs
Analytics
Check Supabase Dashboard:
Database performance
Auth logs
Storage usage
Monitor error rates:
Vercel logs
Browser console errors
User reports
Step 7.2: Set up monitoring (optional)
Sentry integration (if desired):
   npm install @sentry/nextjs   npx @sentry/wizard@latest -i nextjs
Follow Sentry wizard instructions
Add SENTRY_DSN to Vercel environment variables
Vercel Analytics:
Enable in Vercel Dashboard → Analytics
Monitor performance metrics
Step 7.3: Update documentation
[ ] Update README with production URL
[ ] Document deployment process
[ ] Update team on production status
Phase 8: Rollback plan (if needed)
If deployment fails:
In Vercel Dashboard:
Go to Deployments
Find last working deployment
Click "..." → "Promote to Production"
If database migration caused issues:
Revert migration in Supabase SQL Editor
Check specs/tables.sql for previous state
If environment variables are wrong:
Update in Vercel Dashboard
Redeploy
Quick reference: Environment variables checklist
Required:
[ ] NEXT_PUBLIC_SUPABASE_URL
[ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
[ ] NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
[ ] RELEASE_TYPE (set to pilot for first deployment)
Recommended:
[ ] RESEND_API_KEY
[ ] EMAIL_FROM
[ ] DEEPSEEK_API_KEY (if using AI features)
[ ] GROQ_API_KEY (if using AI features)
[ ] GOOGLE_GEMINI_API_KEY (if using AI features)
GitHub Secrets:
[ ] VERCEL_TOKEN
[ ] VERCEL_ORG_ID
[ ] VERCEL_PROJECT_ID
Troubleshooting
Common issues:
Build fails:
Check Vercel build logs
Verify all environment variables are set
Check TypeScript errors locally first
RLS policies blocking access:
Verify migration was applied correctly
Check Supabase logs for policy violations
Test with different user roles
Rate limiting too strict:
Adjust limits in middleware.ts
Consider upgrading to Vercel KV for production
Limits not working:
Verify RELEASE_TYPE is set correctly
Check app/lib/limits/config.ts
Review form validation in BoatFormModal.tsx and JourneyFormModal.tsx
Next steps after pilot deployment
Monitor usage and performance
Gather user feedback
Plan beta release (update RELEASE_TYPE=beta when ready)
Scale limits as needed
Consider upgrading to Vercel KV for rate limiting
Add Sentry for error tracking
Set up automated backups
This guide covers the manual steps from the task. Start with Phase 1 and proceed sequentially. If you need help with a specific step, ask.
<!-- SECTION:DESCRIPTION:END -->
