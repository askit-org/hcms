"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";
import { useSubscriptionMutations } from "@/lib/hooks/useQueries";
import { useAuth, type AuthUser } from "@/lib/hooks/useAuth";
import { type UserSubscription } from "@/lib/providers/types";
import { getQueryClient } from "@/lib/queryClient";

/**
 * Self-contained helper to fetch the latest auth user profile directly from /auth/me.
 * Avoids any circular dependency on axios/api client instances.
 */
async function fetchCurrentMeProfile(): Promise<{ user?: AuthUser; subscription?: UserSubscription } | null> {
  try {
    const token = useAuth.getState().token;
    if (!token) return null;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      user: data?.user,
      subscription: data?.user?.subscription,
    };
  } catch {
    return null;
  }
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  planType?: "premium" | "trial";
}

type PaymentStatus = "idle" | "preparing" | "verifying" | "success";

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  planType = "premium",
}: PaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [mounted, setMounted] = useState(false);
  const isVerifyingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const isOpenRef = useRef(false);
  const router = useRouter();
  const { verifyPayment, createRazorpayOrder } = useSubscriptionMutations();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePaymentSuccess = (latestUser?: AuthUser, sub?: UserSubscription) => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    isVerifyingRef.current = false;

    // Log the user in with latest details from the database
    const currentToken = useAuth.getState().token || "";
    if (latestUser) {
      useAuth.getState().login({ user: latestUser, token: currentToken });
    } else if (sub) {
      useAuth.getState().updateSubscription(sub);
    }

    try {
      getQueryClient().invalidateQueries();
    } catch {
      // ignore
    }

    setStatus("success");
    toast(
      planType === "trial"
        ? "Payment verified! 15-Day Trial activated successfully."
        : "Payment verified! Premium Plan activated successfully.",
      "success"
    );

    // Hold user on the success confirmation screen briefly, then redirect cleanly to dashboard
    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
      router.replace("/dashboard");
      router.refresh();
      if (typeof window !== "undefined") {
        window.location.replace("/dashboard");
      }
    }, 1200);
  };

  /**
   * Poll in the background for 20 seconds (1 second interval) to check if the
   * webhook arrived and the database confirms this user is active/premium.
   */
  const startBackgroundPolling = async (maxAttempts = 20) => {
    for (let i = 0; i < maxAttempts; i++) {
      if (isCompletedRef.current || !isOpenRef.current) return;

      // Wait 1 second between attempts
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isCompletedRef.current || !isOpenRef.current) return;

      try {
        const meData = await fetchCurrentMeProfile();
        const latestUser = meData?.user;
        const sub = latestUser?.subscription || meData?.subscription;

        const isActivated =
          sub?.subscriptionStatus === "active" ||
          sub?.subscriptionStatus === "trialing";

        if (isActivated && sub) {
          handlePaymentSuccess(latestUser, sub);
          return;
        }
      } catch {
        // Network fluctuation during polling, continue trying
      }
    }

    // If 20 seconds elapsed without activation
    if (!isCompletedRef.current && isVerifyingRef.current) {
      isVerifyingRef.current = false;
      setStatus("idle");
      toast(
        "Payment is still processing with your bank. If your account was debited, your subscription will activate shortly.",
        "info"
      );
    }
  };

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      document.body.style.overflow = "hidden";
      isCompletedRef.current = false;
      setStatus("idle");
      isVerifyingRef.current = false;

      // Check if the DB already says the user is active (e.g. from prior webhook)
      fetchCurrentMeProfile()
        .then((meData) => {
          const latestUser = meData?.user;
          const sub = latestUser?.subscription || meData?.subscription;
          if (
            sub &&
            (sub.subscriptionStatus === "active" ||
              sub.subscriptionStatus === "trialing")
          ) {
            handlePaymentSuccess(latestUser, sub);
          }
        })
        .catch(() => {
          // ignore, user can click Proceed to Pay manually
        });
    } else {
      document.body.style.overflow = "";
      setStatus("idle");
      isVerifyingRef.current = false;
      isCompletedRef.current = false;
    }
    return () => {
      document.body.style.overflow = "";
      isOpenRef.current = false;
    };
  }, [isOpen]);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleConfirmPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifyingRef.current || isCompletedRef.current) return;
    setStatus("preparing");

    try {
      // 1. Load Razorpay script
      const res = await loadRazorpay();
      if (!res) {
        toast("Razorpay SDK failed to load. Are you online?", "error");
        setStatus("idle");
        return;
      }

      const isTrial = planType === "trial";
      // 2. Create Order via Backend API
      const orderRes = await createRazorpayOrder.mutateAsync({
        planType: isTrial ? "trial" : "premium",
      });

      if (!orderRes.success) {
        toast("Failed to create payment order.", "error");
        setStatus("idle");
        return;
      }

      // 3. Keep loading animation visible and begin background polling for 20 seconds
      isVerifyingRef.current = true;
      setStatus("verifying");
      startBackgroundPolling(20);

      // 4. Open Razorpay Checkout popup
      const options = {
        key: orderRes.key,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: isTrial ? "HCMS 15-Day Trial" : "HCMS Premium",
        description: isTrial ? "Activate 15-Day Trial" : "Upgrade to Premium Plan",
        order_id: orderRes.orderId,
        handler: async function (response: any) {
          isVerifyingRef.current = true;
          setStatus("verifying");

          try {
            await verifyPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType: isTrial ? "trial" : "premium",
            });

            // Re-fetch latest user profile and finish
            const meData = await fetchCurrentMeProfile();
            handlePaymentSuccess(meData?.user, meData?.subscription);
          } catch (err: any) {
            // Check if webhook already activated it in DB
            const meData = await fetchCurrentMeProfile();
            const sub = meData?.subscription || meData?.user?.subscription;
            if (
              sub &&
              (sub.subscriptionStatus === "active" ||
                sub.subscriptionStatus === "trialing")
            ) {
              handlePaymentSuccess(meData?.user, sub);
            }
          }
        },
        theme: { color: "#0d9488" },
        modal: {
          ondismiss: function () {
            // When user closes Razorpay popup (e.g. after paying via UPI QR on mobile),
            // stay in verifying animation while the 20-second polling continues
            if (!isCompletedRef.current) {
              setStatus("verifying");
            }
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        isVerifyingRef.current = false;
        setStatus("idle");
        toast(`Payment failed: ${response?.error?.description || "Transaction failed"}`, "error");
      });
      rzp.open();
    } catch (err: any) {
      isVerifyingRef.current = false;
      setStatus("idle");
      toast(getErrorMessage(err, "Failed to initiate payment."), "error");
    }
  };

  if (!mounted || !isOpen) return null;

  const isLockedState = status === "verifying" || status === "success";

  return createPortal(
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          zIndex: 1000010,
          background: "rgba(10, 15, 30, 0.9)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
        onClick={(e) => {
          if (isLockedState) {
            e.stopPropagation();
          }
        }}
      >
        <motion.div
          className="modal payment-modal"
          style={{ zIndex: 1000020, maxWidth: 440 }}
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {/* Top Decorative Glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 320,
              height: 120,
              background:
                status === "success"
                  ? "radial-gradient(ellipse at center, rgba(16, 185, 129, 0.35), transparent 70%)"
                  : "radial-gradient(ellipse at center, var(--accent-glow), transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Close Button - hidden during verification and success */}
          {!isLockedState && (
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                zIndex: 20,
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          )}

          {/* STATE 1: VERIFYING PAYMENT (LOADING ANIMATION) */}
          {status === "verifying" ? (
            <div style={{ textAlign: "center", padding: "36px 16px 24px" }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  background: "rgba(13, 148, 136, 0.12)",
                  border: "2px solid var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 22px",
                  boxShadow: "0 0 35px var(--accent-glow)",
                  position: "relative",
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Loader2 size={42} color="var(--accent)" />
                </motion.div>
              </div>

              <h2
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: "0 0 10px 0",
                  letterSpacing: "-0.01em",
                }}
              >
                Confirming Payment...
              </h2>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-secondary)",
                  margin: "0 0 22px 0",
                  lineHeight: 1.5,
                  maxWidth: 360,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Please wait while we verify your transaction and activate your{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {planType === "trial" ? "15-Day Trial" : "Premium Subscription"}
                </strong>
                .
              </p>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 18px",
                  borderRadius: 20,
                  background: "rgba(13, 148, 136, 0.08)",
                  border: "1px solid rgba(13, 148, 136, 0.25)",
                  fontSize: "0.82rem",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                <ShieldCheck size={16} /> Verifying with Bank • Do not refresh or close
              </div>
            </div>
          ) : status === "success" ? (
            /* STATE 2: SUCCESS CONFIRMATION & REDIRECTING */
            <div style={{ textAlign: "center", padding: "36px 16px 24px" }}>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 14, stiffness: 220 }}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "2px solid var(--green)",
                  color: "var(--green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 22px",
                  boxShadow: "0 0 35px rgba(16, 185, 129, 0.35)",
                }}
              >
                <CheckCircle2 size={46} />
              </motion.div>

              <h2
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: "0 0 10px 0",
                  letterSpacing: "-0.01em",
                }}
              >
                Payment Confirmed!
              </h2>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary)",
                  margin: "0 0 22px 0",
                  lineHeight: 1.5,
                  maxWidth: 360,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Your{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {planType === "trial" ? "15-Day Trial" : "Premium Subscription"}
                </strong>{" "}
                is now active. Redirecting you to your dashboard...
              </p>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 16px",
                  borderRadius: 20,
                  background: "var(--surface-2)",
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{ display: "flex" }}
                >
                  <Loader2 size={14} color="var(--accent)" />
                </motion.div>
                Opening Dashboard...
              </div>
            </div>
          ) : status === "preparing" ? (
            /* STATE 3: PREPARING GATEWAY */
            <div style={{ textAlign: "center", padding: "40px 16px 30px" }}>
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  background: "rgba(13, 148, 136, 0.12)",
                  border: "2px solid var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  boxShadow: "0 0 25px var(--accent-glow)",
                }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                  style={{ display: "flex" }}
                >
                  <Loader2 size={36} color="var(--accent)" />
                </motion.div>
              </div>

              <h2
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: "0 0 8px 0",
                }}
              >
                Opening Secure Checkout...
              </h2>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                Please wait a moment while we connect to Razorpay.
              </p>
            </div>
          ) : (
            /* STATE 4: IDLE / RETRY FORM */
            <>
              {/* Header */}
              <div
                style={{ textAlign: "center", marginBottom: 20, paddingRight: 24 }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 12px",
                    borderRadius: 20,
                    background: "var(--accent-glow)",
                    color: "var(--accent)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: 10,
                    border: "1px solid rgba(13, 148, 136, 0.2)",
                  }}
                >
                  <Sparkles size={14} /> {planType === "trial" ? "HCMS 15-Day Trial" : "HCMS Premium Upgrade"}
                </div>
                <h2
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    margin: "0 0 6px 0",
                    color: "var(--text-primary)",
                    lineHeight: 1.3,
                  }}
                >
                  {planType === "trial" ? "Start 15-Day Trial" : "Upgrade to Premium Plan"}
                </h2>
                <p
                  style={{
                    fontSize: "0.84rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  Complete your payment securely via Razorpay to activate instantly.
                </p>
              </div>

              <div
                className="payment-grid"
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <div
                  style={{
                    background: "var(--surface-1)",
                    padding: 18,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 10,
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Subscription Plan:
                    </span>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {planType === "trial" ? "15-Day Trial Access" : "Premium Access"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Validity:
                    </span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {planType === "trial" ? "15 Days" : "1 Month / 30 Days"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: 12,
                      borderTop: "1px dashed var(--border)",
                      fontSize: "0.95rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                      Total Amount:
                    </span>
                    <span style={{ fontWeight: 800, color: "var(--green)", fontSize: "1.1rem" }}>
                      ₹{planType === "trial" ? "22" : "299"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleConfirmPayment()}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background:
                      "linear-gradient(135deg, var(--accent), var(--accent-light))",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px var(--accent-glow)",
                    minHeight: 50,
                  }}
                >
                  <CheckCircle2 size={18} /> Proceed to Pay (₹{planType === "trial" ? "22" : "299"})
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  <ShieldCheck size={16} color="var(--green)" /> 100% Encrypted &
                  Secure Payment
                </div>
              </div>

              {/* Developer Notice Note */}
              <div
                style={{
                  fontSize: "0.74rem",
                  color: "var(--text-muted)",
                  textAlign: "center",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 10,
                  marginTop: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <CreditCard size={12} /> Powered by Razorpay Secure Gateway
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}

