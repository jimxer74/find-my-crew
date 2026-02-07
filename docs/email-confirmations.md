Current Issue

  After email signup, users are immediately redirected to the home page and see the consent modal, but receive no indication that they need to check their email for verification. This creates a    
  poor user experience where users might be confused about next steps.

  Proposed Solution

  Create a two-step confirmation flow:
  1. Immediate confirmation message after signup form submission
  2. Persistent email verification banner on the home page until email is confirmed

  Implementation Steps

  Step 1: Create Email Verification Status Hook

  - Location: /app/hooks/useEmailVerificationStatus.ts
  - Check auth.users.email_confirmed_at to determine verification status
  - Return verification state and helper functions

  Step 2: Create Email Confirmation Modal Component

  - Location: /app/components/EmailConfirmationModal.tsx
  - Display immediately after successful signup
  - Show clear message: "Please check your email to verify your account"
  - Include email address and resend verification button
  - Provide option to dismiss and continue

  Step 3: Create Persistent Email Verification Banner

  - Location: /app/components/EmailVerificationBanner.tsx
  - Display on home page when email not verified
  - Non-blocking banner with clear CTA
  - Include resend verification functionality

  Step 4: Update Signup Page Logic

  - Location: /app/auth/signup/page.tsx
  - After successful signUp(), show confirmation modal instead of immediate redirect
  - Only redirect after user acknowledges the confirmation message
  - Pass user email to modal for personalized messaging

  Step 5: Create Resend Verification API Route

  - Location: /app/api/auth/resend-verification/route.ts
  - Endpoint to resend email verification
  - Include rate limiting to prevent abuse
  - Return success/failure status

  Step 6: Update Database Schema (Optional)

  - Consider adding email_verification_reminders_sent counter to profiles table
  - Track verification status more explicitly if needed

  User Experience Flow

  1. User submits signup form
             ↓
  2. Supabase signup successful
             ↓
  3. EmailConfirmationModal appears
     - "Please check your email to verify your account"
     - Shows user's email address
     - "Resend Verification" button (with rate limiting)
     - "Continue to App" button
             ↓
  4. User clicks "Continue to App"
             ↓
  5. Redirect to home page (/)
             ↓
  6. EmailVerificationBanner appears (if not verified)
     - "Your email is not yet verified"
     - "Resend verification email" button
     - "Learn more about email verification" link
             ↓
  7. User can still use app (with consent modal)
     - OR can choose to verify email

  Technical Implementation Details

  EmailConfirmationModal Features:

  - Modal appears immediately after signup success
  - Shows user's email address for confirmation
  - "Resend Verification" button with 60-second cooldown
  - "Continue to App" button to dismiss and proceed
  - Auto-dismiss after 10 seconds with visual countdown

  EmailVerificationBanner Features:

  - Persistent banner on home page when email not verified
  - Non-blocking - allows app usage while reminding about verification
  - "Resend Verification" button with rate limiting
  - "Learn More" link to help documentation
  - Disappears automatically once email is verified

  Resend Verification API:

  // POST /api/auth/resend-verification
  {
    email: string
  }
  - Rate limit: 3 attempts per hour per email
  - Return: success status and next allowed resend time

  Integration Points

  1. Signup Page: Modify to show modal instead of immediate redirect
  2. Home Page: Add banner component conditionally
  3. Layout Components: Ensure banner appears on all main pages for unverified users
  4. Consent Modal: May need to show after email verification acknowledgment

  Success Criteria

  - ✅ Users immediately understand they need to check their email
  - ✅ Clear messaging about what to expect in their inbox
  - ✅ Easy way to resend verification if needed
  - ✅ Users can still access and use the app while waiting for verification
  - ✅ Persistent but non-intrusive reminders until verification is complete
  - ✅ Rate limiting prevents abuse of resend functionality

  This plan provides a comprehensive solution that improves user experience while maintaining the current app functionality. The two-step approach (immediate modal + persistent banner) ensures     
  users are informed without being blocked from using the application.