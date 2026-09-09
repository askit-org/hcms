import { NextResponse } from 'next/server';

/**
 * POST /api/auth/signup
 * 
 * Registers a new doctor profile and initializes a 15-day free trial.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { doctorName, email, degree, clinicName, address, phone, regNo, city } = body || {};

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email address is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

    const user = {
      id: `usr_${Date.now()}`,
      doctorName: doctorName?.trim() || 'Doctor',
      email: email.trim(),
      degree: degree?.trim() || 'MBBS',
      clinicName: clinicName?.trim() || 'My Clinic',
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      regNo: regNo?.trim() || '',
      city: city?.trim() || '',
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
      message: 'Account created successfully',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Signup failed' },
      { status: 500 }
    );
  }
}
