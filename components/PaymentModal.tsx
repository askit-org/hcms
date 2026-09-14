"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";
import { useSubscriptionMutations } from "@/lib/hooks/useQueries";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { verifyPayment, createRazorpayOrder } = useSubscriptionMutations();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      handleConfirmPayment();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleConfirmPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsVerifying(true);

    try {
      // 1. Load Razorpay script
      const res = await loadRazorpay();
      if (!res) {
        toast("Razorpay SDK failed to load. Are you online?", "error");
        setIsVerifying(false);
        return;
      }

      // 2. Create Order via Backend API (Backend determines price via SUBSCRIPTION_PRICE & key)
      const orderRes = await createRazorpayOrder.mutateAsync({
        planType: "premium",
      });

      if (!orderRes.success) {
        toast("Failed to create payment order.", "error");
        setIsVerifying(false);
        return;
      }

      // 3. Open Razorpay Checkout popup
      const options = {
        key: orderRes.key,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: "HCMS Premium",
        description: "Upgrade to Premium Plan",
        order_id: orderRes.orderId,
        handler: async function (response: any) {
          try {
            await verifyPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType: "premium",
            });
            toast(
              "Payment verified! Premium Plan activated successfully.",
              "success",
            );
            if (onSuccess) onSuccess();
            onClose();
          } catch (err: any) {
            toast(
              getErrorMessage(err, "Payment verification failed on server."),
              "error",
            );
          } finally {
            setIsVerifying(false);
          }
        },
        theme: { color: "#0d9488" },
        modal: {
          ondismiss: function () {
            setIsVerifying(false);
            onClose();
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        toast(`Payment failed: ${response.error.description}`, "error");
        setIsVerifying(false);
      });
      rzp.open();
    } catch (err: any) {
      toast(getErrorMessage(err, "Failed to initiate payment."), "error");
      setIsVerifying(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          zIndex: 1000010,
          background: "rgba(10, 15, 30, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <motion.div
          className="modal payment-modal"
          style={{ zIndex: 1000020 }}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
                "radial-gradient(ellipse at center, var(--accent-glow), transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Close Button */}
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
              <Sparkles size={14} /> HCMS Premium Upgrade
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
              Upgrade to Premium Plan
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
            {/* Form Box */}
            <div
              style={{
                background: "var(--surface-1)",
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: "0.9rem",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>
                  Subscription Plan:
                </span>
                <span style={{ fontWeight: 700, color: "var(--green)" }}>
                  Premium Access
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.9rem",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>
                  Validity:
                </span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  1 Month / 30 Days
                </span>
              </div>
            </div>

            <button
              onClick={() => handleConfirmPayment()}
              disabled={isVerifying}
              className="btn btn-primary"
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent-light))",
                border: "none",
                color: "#ffffff",
                cursor: isVerifying ? "wait" : "pointer",
                boxShadow: "0 4px 14px var(--accent-glow)",
                minHeight: 50,
              }}
            >
              {isVerifying ? (
                "Processing Payment…"
              ) : (
                <>
                  <CheckCircle2 size={18} /> Proceed to Pay Securely
                </>
              )}
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

          {/* Developer Notice Note / Future Integration Marker */}
          <div
            style={{
              fontSize: "0.74rem",
              color: "var(--text-muted)",
              textAlign: "center",
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <CreditCard size={12} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
}
