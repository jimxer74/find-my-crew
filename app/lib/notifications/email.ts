/**
 * Email Notification Service
 *
 * Handles sending email notifications for important events.
 *
 * To enable email sending:
 * 1. Install Resend: npm install resend
 * 2. Add RESEND_API_KEY to your environment variables
 * 3. Update the sendEmail function to use Resend
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailPreferences } from './types';

// ============================================================================
// Configuration
// ============================================================================

const EMAIL_FROM = process.env.EMAIL_FROM || 'Find My Crew <notifications@findmycrew.app>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Check if email sending is enabled
const isEmailEnabled = (): boolean => {
  return !!RESEND_API_KEY;
};

// ============================================================================
// Email Sending Core
// ============================================================================

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Core email sending function
 * Currently logs to console. Enable Resend by installing the package and setting RESEND_API_KEY.
 */
async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error: string | null }> {
  const { to, subject, html, text } = params;

  if (!isEmailEnabled()) {
    console.log('[EmailService] Email sending disabled (RESEND_API_KEY not set)');
    console.log('[EmailService] Would send email:', { to, subject });
    return { success: true, error: null }; // Return success in dev mode
  }

  try {
    // Dynamically import Resend only when needed
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_API_KEY);

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('[EmailService] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('[EmailService] Email sent successfully to:', to);
    return { success: true, error: null };
  } catch (err: any) {
    console.error('[EmailService] Error sending email:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// Email Preferences
// ============================================================================

/**
 * Gets email preferences for a user, with defaults if not set
 */
export async function getEmailPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<EmailPreferences> {
  const { data } = await supabase
    .from('email_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) {
    return data as EmailPreferences;
  }

  // Return defaults if no preferences set
  return {
    user_id: userId,
    registration_updates: true,
    journey_updates: true,
    profile_reminders: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Checks if user wants to receive a specific type of email
 */
export async function shouldSendEmail(
  supabase: SupabaseClient,
  userId: string,
  emailType: 'registration_updates' | 'journey_updates' | 'profile_reminders'
): Promise<boolean> {
  const preferences = await getEmailPreferences(supabase, userId);
  return preferences[emailType];
}

// ============================================================================
// Email Templates
// ============================================================================

/**
 * Sends registration approved email to crew member
 */
export async function sendRegistrationApprovedEmail(
  supabase: SupabaseClient,
  userEmail: string,
  userId: string,
  journeyName: string,
  ownerName: string,
  journeyLink: string
): Promise<{ success: boolean; error: string | null }> {
  // Check preferences
  if (!(await shouldSendEmail(supabase, userId, 'registration_updates'))) {
    console.log('[EmailService] User opted out of registration updates:', userId);
    return { success: true, error: null };
  }

  const subject = `Welcome aboard! Your registration for "${journeyName}" is approved`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Welcome Aboard!</h1>
      <p>Great news! <strong>${ownerName}</strong> has approved your registration for <strong>"${journeyName}"</strong>.</p>
      <p>You're now part of the crew. Check the journey details to see what's next:</p>
      <p style="margin: 30px 0;">
        <a href="${journeyLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Journey Details</a>
      </p>
      <p>Fair winds and following seas!</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">Find My Crew - Connecting sailors worldwide</p>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

/**
 * Sends registration denied email to crew member
 */
export async function sendRegistrationDeniedEmail(
  supabase: SupabaseClient,
  userEmail: string,
  userId: string,
  journeyName: string,
  ownerName: string,
  reason?: string
): Promise<{ success: boolean; error: string | null }> {
  // Check preferences
  if (!(await shouldSendEmail(supabase, userId, 'registration_updates'))) {
    console.log('[EmailService] User opted out of registration updates:', userId);
    return { success: true, error: null };
  }

  const subject = `Update on your registration for "${journeyName}"`;
  const reasonText = reason
    ? `<p><strong>Reason:</strong> ${reason}</p>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333;">Registration Update</h1>
      <p>Unfortunately, your registration for <strong>"${journeyName}"</strong> was not approved by ${ownerName}.</p>
      ${reasonText}
      <p>Don't be discouraged! There are many other journeys looking for crew members like you.</p>
      <p style="margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/journeys" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Browse Other Journeys</a>
      </p>
      <p>Keep sailing!</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">Find My Crew - Connecting sailors worldwide</p>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

/**
 * Sends new registration notification email to journey owner
 */
export async function sendNewRegistrationEmail(
  supabase: SupabaseClient,
  ownerEmail: string,
  ownerId: string,
  crewName: string,
  journeyName: string,
  registrationLink: string
): Promise<{ success: boolean; error: string | null }> {
  // Check preferences
  if (!(await shouldSendEmail(supabase, ownerId, 'registration_updates'))) {
    console.log('[EmailService] User opted out of registration updates:', ownerId);
    return { success: true, error: null };
  }

  const subject = `New crew application for "${journeyName}"`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">New Crew Application</h1>
      <p><strong>${crewName}</strong> has applied to join your journey <strong>"${journeyName}"</strong>.</p>
      <p>Review their profile and application to make a decision:</p>
      <p style="margin: 30px 0;">
        <a href="${registrationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Application</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">Find My Crew - Connecting sailors worldwide</p>
    </body>
    </html>
  `;

  return sendEmail({ to: ownerEmail, subject, html });
}

/**
 * Sends journey updated email to crew member
 */
export async function sendJourneyUpdatedEmail(
  supabase: SupabaseClient,
  userEmail: string,
  userId: string,
  journeyName: string,
  changes: string[],
  journeyLink: string
): Promise<{ success: boolean; error: string | null }> {
  // Check preferences
  if (!(await shouldSendEmail(supabase, userId, 'journey_updates'))) {
    console.log('[EmailService] User opted out of journey updates:', userId);
    return { success: true, error: null };
  }

  const subject = `Journey update: "${journeyName}"`;
  const changesList = changes.length > 0
    ? `<ul>${changes.map(c => `<li>${c}</li>`).join('')}</ul>`
    : '<p>The journey details have been updated.</p>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Journey Updated</h1>
      <p>The journey <strong>"${journeyName}"</strong> that you're registered for has been updated.</p>
      <p><strong>Changes:</strong></p>
      ${changesList}
      <p style="margin: 30px 0;">
        <a href="${journeyLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Updated Journey</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">Find My Crew - Connecting sailors worldwide</p>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

/**
 * Sends profile completion reminder email
 */
export async function sendProfileReminderEmail(
  supabase: SupabaseClient,
  userEmail: string,
  userId: string,
  missingFields: string[],
  completionPercentage: number
): Promise<{ success: boolean; error: string | null }> {
  // Check preferences
  if (!(await shouldSendEmail(supabase, userId, 'profile_reminders'))) {
    console.log('[EmailService] User opted out of profile reminders:', userId);
    return { success: true, error: null };
  }

  const subject = `Complete your profile to get approved faster`;
  const fieldsList = missingFields.length > 0
    ? `<ul>${missingFields.map(f => `<li>${f}</li>`).join('')}</ul>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb;">Complete Your Profile</h1>
      <p>Your profile is <strong>${completionPercentage}%</strong> complete.</p>
      <p>A complete profile helps boat owners learn more about you and increases your chances of being approved for journeys.</p>
      ${fieldsList ? `<p><strong>Missing information:</strong></p>${fieldsList}` : ''}
      <p style="margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/profile" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Complete Your Profile</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">Find My Crew - Connecting sailors worldwide</p>
    </body>
    </html>
  `;

  return sendEmail({ to: userEmail, subject, html });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Gets user email from profile or auth
 */
export async function getUserEmail(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // Try to get email from auth.users (requires service role)
  // Fall back to checking if email is stored elsewhere

  // For now, we'll need to pass the email directly or store it in profiles
  // This is a placeholder that would need to be implemented based on your auth setup
  console.log('[EmailService] getUserEmail not fully implemented - need to pass email directly');
  return null;
}
