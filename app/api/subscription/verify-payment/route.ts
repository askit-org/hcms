import { NextResponse } from 'next/server';

/**
 * POST /api/subscription/verify-payment
 * 
 * Request Body:
 * {
 *   "paymentRef": "UTR / Transaction ID or Razorpay Payment ID",
 *   "amount": 299,
 *   "planType": "premium",
 *   
 *   // FUTURE RAZORPAY VERIFICATION FIELDS:
 *   // "razorpay_order_id": "order_xxx",
 *   // "razorpay_payment_id": "pay_xxx",
 *   // "razorpay_signature": "hex_signature"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "subscription": { ... },
 *   "transactionId": string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentRef, amount = 299, planType = 'premium' } = body || {};

    if (!paymentRef || typeof paymentRef !== 'string' || !paymentRef.trim()) {
      return NextResponse.json(
        { success: false, error: 'Payment Reference / Transaction ID is required.' },
        { status: 400 }
      );
    }

    /*
    ===================================================================
    FUTURE RAZORPAY INTEGRATION STEP 3: SERVER-SIDE SIGNATURE VERIFICATION
    ===================================================================
    When switching from QR code to Razorpay:

    1. Import crypto:
       import crypto from 'crypto';

    2. Extract razorpay payload fields:
       const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    3. Verify Signature:
       const generated_signature = crypto
         .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
         .update(`${razorpay_order_id}|${razorpay_payment_id}`)
         .digest('hex');

       if (generated_signature !== razorpay_signature) {
         return NextResponse.json({ success: false, error: 'Invalid Razorpay signature' }, { status: 400 });
       }
    ===================================================================
    */

    const now = new Date();
    const monthlyEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const subscription = {
      planType: 'premium',
      subscriptionStatus: 'active',
      hasSelectedPlan: true,
      paidAmount: amount,
      paymentRef: paymentRef.trim(),
      billingCycle: 'monthly',
      subscriptionStartDate: now.toISOString(),
      subscriptionEndDate: monthlyEndDate,
      activatedAt: now.toISOString(),
    };

    return NextResponse.json({
      success: true,
      subscription,
      transactionId: `TXN_${Date.now()}`,
      message: 'Payment verified and Premium subscription activated successfully!',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
