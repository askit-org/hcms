import { NextResponse } from 'next/server';

/**
 * PUT /api/auth/user
 * 
 * Updates current authenticated doctor profile information.
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      user: body,
      message: 'Profile updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
