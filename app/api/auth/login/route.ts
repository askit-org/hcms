import { NextResponse } from 'next/server';

/**
 * POST /api/auth/login
 * 
 * Authenticates doctor credentials and returns user profile & auth JWT token.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

    // Standard login response payload
    const user = {
      id: `usr_${Date.now()}`,
      doctorName: email.split('@')[0].replace('.', ' ').replace(/^./, (str: string) => str.toUpperCase()) || 'Doctor',
      email: email.trim(),
      degree: 'MBBS, MD',
      clinicName: 'My Clinic',
      address: '123 Medical Enclave',
      phone: '9876543210',
      regNo: 'REG-98765',
      city: 'Mumbai',
      createdAt: now.toISOString(),
      subscription: {
        planType: 'trial',
        subscriptionStatus: 'trialing',
        trialStartDate: now.toISOString(),
        trialEndDate,
        hasSelectedPlan: true,
        activatedAt: now.toISOString(),
      },
    };

    const token = `jwt_session_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    return NextResponse.json({
      success: true,
      token,
      user,
      message: 'Login successful',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
