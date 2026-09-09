import { NextResponse } from 'next/server';

/**
 * POST /api/subscription/select-plan
 * 
 * Request Body:
 * {
 *   "planType": "trial" | "premium",
 *   "paymentRef"?: string
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "subscription": {
 *     "planType": "trial" | "premium",
 *     "subscriptionStatus": "trialing" | "active" | "pending_payment",
 *     "trialStartDate"?: string,
 *     "trialEndDate"?: string,
 *     "hasSelectedPlan": true,
 *     "activatedAt": string
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { planType, paymentRef } = body || {};

    if (!planType || (planType !== 'trial' && planType !== 'premium')) {
      return NextResponse.json(
        { success: false, error: 'Invalid planType. Must be "trial" or "premium".' },
        { status: 400 }
      );
    }

    const now = new Date();
    let subscription;

    if (planType === 'trial') {
      const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      subscription = {
        planType: 'trial',
        subscriptionStatus: 'trialing',
        trialStartDate: now.toISOString(),
        trialEndDate,
        hasSelectedPlan: true,
        activatedAt: now.toISOString(),
      };
    } else {
      const monthlyEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      subscription = {
        planType: 'premium',
        subscriptionStatus: paymentRef ? 'active' : 'pending_payment',
        hasSelectedPlan: true,
        paidAmount: 299,
        paymentRef: paymentRef || null,
        billingCycle: 'monthly',
        subscriptionStartDate: now.toISOString(),
        subscriptionEndDate: monthlyEndDate,
        activatedAt: now.toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      subscription,
      message: planType === 'trial' 
        ? '15-day trial activated successfully.' 
        : 'Premium plan selected. Proceed with payment verification.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
