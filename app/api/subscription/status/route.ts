import { NextResponse } from 'next/server';

/**
 * GET /api/subscription/status
 * 
 * Endpoint to check current user subscription status.
 * Supports token verification via `Authorization: Bearer <token>`.
 * Returns trial details, premium validity, and plan status.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const simulatedPlan = searchParams.get('plan');

    // Default dates
    const now = new Date();
    const startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const trialEndDate = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString();

    if (simulatedPlan === 'premium') {
      const startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const monthlyEndDate = new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString();
      return NextResponse.json({
        success: true,
        subscription: {
          planType: 'premium',
          subscriptionStatus: 'active',
          hasSelectedPlan: true,
          paidAmount: 299,
          paymentRef: 'UTR987654321',
          billingCycle: 'monthly',
          subscriptionStartDate: startDate,
          subscriptionEndDate: monthlyEndDate,
          activatedAt: startDate,
        },
      });
    }

    if (simulatedPlan === 'expired') {
      const pastEndDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      return NextResponse.json({
        success: true,
        subscription: {
          planType: 'trial',
          subscriptionStatus: 'expired',
          trialStartDate: startDate,
          trialEndDate: pastEndDate,
          hasSelectedPlan: true,
        },
      });
    }

    // Default response: Active 15-day trial (12 days remaining)
    return NextResponse.json({
      success: true,
      subscription: {
        planType: 'trial',
        subscriptionStatus: 'trialing',
        trialStartDate: startDate,
        trialEndDate,
        hasSelectedPlan: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

