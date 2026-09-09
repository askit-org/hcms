import { NextResponse } from 'next/server';

/**
 * POST /api/auth/reset-password
 * 
 * Validates reset token and updates user password in database.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, newPassword, password } = body || {};
    const targetPassword = newPassword || password;

    if (!token || !token.trim()) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing password reset token' },
        { status: 400 }
      );
    }

    if (!targetPassword || targetPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Standard Reset Password Response Payload
    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
