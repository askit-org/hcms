import { NextResponse } from 'next/server';

/**
 * POST /api/subscription/razorpay-order
 * 
 * Request Body:
 * {
 *   "planId": "premium",
 *   "amount": 29900 // in paise (₹299.00)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "orderId": "order_mock123456",
 *   "amount": 29900,
 *   "currency": "INR",
 *   "key": "rzp_test_xxxxxxx"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount = 29900, currency = 'INR' } = body || {};

    /*
    ===================================================================
    FUTURE RAZORPAY INTEGRATION STEP 1: CREATE ORDER
    ===================================================================
    When initializing Razorpay Node SDK:

    1. npm install razorpay
    2. Import Razorpay:
       import Razorpay from 'razorpay';
       const razorpay = new Razorpay({
         key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
         key_secret: process.env.RAZORPAY_KEY_SECRET!,
       });
    3. Create order:
       const order = await razorpay.orders.create({
         amount: 29900, // 299 * 100
         currency: 'INR',
         receipt: `receipt_${Date.now()}`,
         notes: { plan: 'premium' }
       });
    ===================================================================
    */

    return NextResponse.json({
      success: true,
      orderId: `order_mock_${Date.now()}`,
      amount: amount,
      currency: currency,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock_key',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
