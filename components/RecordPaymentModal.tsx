"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Banknote, QrCode, AlertCircle, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSettings, useBillingMutations } from "@/lib/hooks/useQueries";
import { toast } from "./Toast";
import { getErrorMessage } from "@/lib/utils/error";
import UpiQrCode from "./UpiQrCode";
import type { Bill } from "@/lib/providers/types";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  billId: string;
  billNumber: string;
  patientName: string;
  balanceDue: number;
  totalAmount?: number;
  paidAmount?: number;
  onSuccess?: (updatedBill: Bill) => void;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  billId,
  billNumber,
  patientName,
  balanceDue,
  totalAmount,
  paidAmount,
  onSuccess,
}: RecordPaymentModalProps) {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { recordPayment } = useBillingMutations();

  const [mounted, setMounted] = useState(false);
  const [amountToPay, setAmountToPay] = useState<number>(balanceDue);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setAmountToPay(balanceDue);
      setPaymentMethod("CASH");
      setNotes("");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, balanceDue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billId) return;

    const numAmount = Number(amountToPay);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast("Please enter a valid payment amount", "error");
      return;
    }
    if (numAmount > balanceDue) {
      toast(`Amount cannot exceed the balance due of ₹${balanceDue}`, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await recordPayment.mutateAsync({
        billId,
        input: {
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
        },
      });
      toast("Payment recorded successfully!", "success");
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      toast(getErrorMessage(err, "Failed to record payment"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          backdropFilter: "blur(6px)",
          padding: 16,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          style={{
            background: "var(--surface-solid)",
            color: "var(--text-primary)",
            borderRadius: 16,
            maxWidth: 520,
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            border: "1px solid var(--border)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface-1)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                Collect Outstanding Payment
              </h3>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Patient: <strong>{patientName}</strong> • Bill: {billNumber}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Balance Card */}
            <div
              style={{
                background: "var(--surface-2)",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Total Outstanding Balance</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ef4444", marginTop: 2 }}>
                  ₹{balanceDue}
                </div>
              </div>
              {totalAmount !== undefined && (
                <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <div>Total Bill: ₹{totalAmount}</div>
                  <div>Already Paid: ₹{paidAmount || 0}</div>
                </div>
              )}
            </div>

            {/* Amount input */}
            <div>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Collection Amount (₹)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min="1"
                  max={balanceDue}
                  step="1"
                  value={amountToPay}
                  onChange={(e) => setAmountToPay(parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ fontSize: "1.1rem", fontWeight: 700 }}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAmountToPay(balanceDue)}
                  style={{ height: 42, whiteSpace: "nowrap" }}
                >
                  Pay Full (₹{balanceDue})
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Payment Method
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CASH")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border:
                      paymentMethod === "CASH"
                        ? "2px solid var(--accent)"
                        : "1px solid var(--border)",
                    background:
                      paymentMethod === "CASH"
                        ? "rgba(13, 148, 136, 0.08)"
                        : "var(--surface-1)",
                    color:
                      paymentMethod === "CASH"
                        ? "var(--accent)"
                        : "var(--text-primary)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Banknote size={16} />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("UPI")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border:
                      paymentMethod === "UPI"
                        ? "2px solid var(--accent)"
                        : "1px solid var(--border)",
                    background:
                      paymentMethod === "UPI"
                        ? "rgba(13, 148, 136, 0.08)"
                        : "var(--surface-1)",
                    color:
                      paymentMethod === "UPI"
                        ? "var(--accent)"
                        : "var(--text-primary)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <QrCode size={16} />
                  <span>UPI (QR Code)</span>
                </button>
              </div>
            </div>

            {/* UPI QR Display */}
            {paymentMethod === "UPI" && amountToPay > 0 && (
              <div style={{ marginTop: 4 }}>
                <UpiQrCode
                  upiId={settings?.upiId || ""}
                  payeeName={user?.clinicName || user?.doctorName || "Clinic"}
                  amount={amountToPay}
                  note={`Due payment ${billNumber}`}
                />
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="form-label" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Payment Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Paid in cash at reception counter"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input"
                style={{ height: 36, fontSize: "0.85rem" }}
              />
            </div>

            {/* Submit */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 8,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || amountToPay <= 0}
                style={{ minWidth: 140 }}
              >
                {isSubmitting ? "Recording..." : `Collect ₹${amountToPay}`}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
