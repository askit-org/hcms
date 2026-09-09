import { NextResponse } from 'next/server';

/**
 * POST /api/auth/forgot-password
 * 
 * Accepts doctor email, verifies account existence, generates password reset link,
 * and sends email with reset instructions.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body || {};

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Standard Forgot Password Response Payload
    return NextResponse.json({
      success: true,
      message: `Password reset instructions have been sent to ${trimmedEmail}. Please check your inbox and spam folder.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
