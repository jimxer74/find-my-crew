import { logger } from '@/app/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user is authenticated
    // Since we're not using cookies, we need to handle this differently
    // For now, we'll return an error if no user is found
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if email is already verified
    if (user.email_confirmed_at) {
      return NextResponse.json(
        {
          success: false,
          message: 'Email is already verified',
          isVerified: true
        },
        { status: 200 }
      );
    }

    // Check rate limiting (simple in-memory solution)
    const lastResendKey = `last_resend_${user.id}`;
    const lastResendTime = cookieStore.get(lastResendKey)?.value;
    const now = Date.now();
    const cooldownPeriod = 60000; // 60 seconds

    if (lastResendTime && now - parseInt(lastResendTime) < cooldownPeriod) {
      const remainingTime = Math.ceil((cooldownPeriod - (now - parseInt(lastResendTime))) / 1000);
      return NextResponse.json(
        {
          success: false,
          message: `Please wait ${remainingTime} seconds before trying again`,
          nextAllowedResend: new Date(now + cooldownPeriod).toISOString()
        },
        { status: 429 }
      );
    }

    // Resend verification email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email!,
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to send verification email',
          error: error.message
        },
        { status: 500 }
      );
    }

    // Set rate limiting cookie
    cookieStore.set(lastResendKey, now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.',
      nextAllowedResend: new Date(now + cooldownPeriod).toISOString()
    });

  } catch (error) {
    logger.error('Error resending verification email:', error instanceof Error ? { error: error.message } : { error: String(error) });
    return NextResponse.json(
      {
        success: false,
        message: 'An unexpected error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}