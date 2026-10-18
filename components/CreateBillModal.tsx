"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Receipt,
  Plus,
  Trash2,
  Banknote,
  QrCode,
  CheckCircle2,
  Clock,
  Printer,
  Share2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSettings, useBillingMutations, useSettingsMutations, useBillForVisit } from "@/lib/hooks/useQueries";
import { toast } from "./Toast";
import { getErrorMessage } from "@/lib/utils/error";
import UpiQrCode from "./UpiQrCode";
import type { Bill, CreateBillInput, CreateBillItemInput } from "@/lib/providers/types";

interface CreateBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  visitId?: string;
  visitDate?: string;
  initialTreatments?: Array<{ name: string; unitPrice: number; quantity?: number }>;
  onSuccess?: (bill: Bill) => void;
  onSkip?: () => void;
}

interface ItemRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

const COMMON_TREATMENTS = [
  { name: "Injection", price: 100 },
  { name: "Saline / IV Fluid", price: 350 },
  { name: "Wound Dressing", price: 200 },
  { name: "Nebulization", price: 150 },
  { name: "ECG", price: 300 },
  { name: "Suture / Stitching", price: 500 },
  { name: "Blood Sugar (GRBS)", price: 80 },
];

export default function CreateBillModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  visitId,
  visitDate,
  initialTreatments = [],
  onSuccess,
  onSkip,
}: CreateBillModalProps) {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { createBill, updateBill } = useBillingMutations();
  const { update: updateSettings } = useSettingsMutations();
  const { data: existingBill, isLoading: billLoading } = useBillForVisit(isOpen && visitId ? visitId : undefined);

  const [mounted, setMounted] = useState(false);
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [settlementType, setSettlementType] = useState<"FULL" | "PARTIAL" | "UNPAID">("FULL");
  const [customPaidAmount, setCustomPaidAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBill, setCreatedBill] = useState<Bill | null>(null);

  // Set default consultation fee from settings if available
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setCreatedBill(null);

      if (existingBill) {
        setConsultationFee(Number(existingBill.consultationFee));
        setDiscount(Number(existingBill.discount || 0));
        setPaymentMethod((existingBill.paymentMethod as "CASH" | "UPI") || "CASH");
        setNotes(existingBill.notes || "");

        if (existingBill.items && existingBill.items.length > 0) {
          setItems(
            existingBill.items.map((t, idx) => ({
              id: t.id || `item-${idx}`,
              name: t.name,
              quantity: Number(t.quantity) || 1,
              unitPrice: Number(t.unitPrice) || 0,
            }))
          );
        } else if (initialTreatments && initialTreatments.length > 0) {
          setItems(
            initialTreatments.map((t, idx) => ({
              id: `init-${idx}`,
              name: t.name,
              quantity: t.quantity || 1,
              unitPrice: Number(t.unitPrice) || 0,
            }))
          );
        } else {
          setItems([]);
        }

        if (Number(existingBill.balanceDue) === 0) {
          setSettlementType("FULL");
          setCustomPaidAmount("");
        } else if (Number(existingBill.paidAmount) > 0) {
          setSettlementType("PARTIAL");
          setCustomPaidAmount(String(existingBill.paidAmount));
        } else {
          setSettlementType("UNPAID");
          setCustomPaidAmount("");
        }
      } else {
        const defaultFee = settings?.consultationFee !== undefined ? Number(settings.consultationFee) : 500;
        setConsultationFee(defaultFee);
        setDiscount(0);
        setPaymentMethod("CASH");
        setSettlementType("FULL");
        setCustomPaidAmount("");
        setNotes("");

        if (initialTreatments && initialTreatments.length > 0) {
          setItems(
            initialTreatments.map((t, idx) => ({
              id: `init-${idx}`,
              name: t.name,
              quantity: t.quantity || 1,
              unitPrice: Number(t.unitPrice) || 0,
            }))
          );
        } else {
          setItems([]);
        }
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, existingBill, settings, initialTreatments]);

  // Totals calculations
  const itemsTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0), 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return (Number(consultationFee) || 0) + itemsTotal;
  }, [consultationFee, itemsTotal]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0));
  }, [subtotal, discount]);

  const paidAmount = useMemo(() => {
    if (settlementType === "FULL") return totalAmount;
    if (settlementType === "UNPAID") return 0;
    const custom = parseFloat(customPaidAmount);
    return isNaN(custom) ? 0 : Math.min(totalAmount, Math.max(0, custom));
  }, [settlementType, totalAmount, customPaidAmount]);

  const balanceDue = useMemo(() => {
    return Math.max(0, totalAmount - paidAmount);
  }, [totalAmount, paidAmount]);

  const handleAddItem = (nameToAdd?: string, priceToAdd?: number) => {
    const name = (nameToAdd !== undefined ? nameToAdd : newItemName).trim();
    const price = priceToAdd !== undefined ? priceToAdd : parseFloat(newItemPrice);

    if (!name) {
      toast("Please enter a treatment / service name", "error");
      return;
    }
    if (isNaN(price) || price < 0) {
      toast("Please enter a valid amount", "error");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name,
        quantity: 1,
        unitPrice: price,
      },
    ]);

    if (nameToAdd === undefined) {
      setNewItemName("");
      setNewItemPrice("");
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: "name" | "unitPrice" | "quantity", value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: field === "name" ? value : Number(value) || 0,
        };
      })
    );
  };

  const handleSaveUpiId = async (newUpiId: string) => {
    try {
      await updateSettings.mutateAsync({ upiId: newUpiId });
    } catch {
      // silently handle, already toasted in component
    }
  };

  const handleSubmit = async () => {
    if (!patientId) {
      toast("Patient ID is required to generate a bill", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const billPayload: CreateBillInput = {
        patientId,
        visitId,
        consultationFee: Number(consultationFee) || 0,
        discount: Number(discount) || 0,
        paidAmount,
        paymentMethod,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice || 0,
        })),
      };

      let result: Bill;
      if (existingBill) {
        result = await updateBill.mutateAsync({ id: existingBill.id, input: billPayload });
        toast("Payment & bill updated successfully!", "success");
      } else {
        result = await createBill.mutateAsync(billPayload);
        toast("Bill generated successfully!", "success");
      }
      setCreatedBill(result);
      onSuccess?.(result);
    } catch (err) {
      toast(getErrorMessage(err, "Failed to save bill & payment"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (visitId) {
      window.open(`/visits/${visitId}/print?bill=true`, "_blank");
    }
  };

  const handleWhatsAppShare = () => {
    if (!createdBill) return;
    const clinicName = user?.clinicName || "Clinic OPD";
    const doctorName = user?.doctorName || "Doctor";
    const billItemsText = createdBill.items
      .map((it) => `• ${it.name} (Qty: ${it.quantity}): ₹${it.totalPrice}`)
      .join("\n");

    const message = `*INVOICE / BILL - ${clinicName}*\nDr. ${doctorName}\n----------------------------------\n*Bill No:* ${createdBill.billNumber}\n*Date:* ${new Date(createdBill.date).toLocaleDateString("en-IN")}\n*Patient:* ${patientName}\n\n*Charges:*\n• Consultation Fee: ₹${createdBill.consultationFee}\n${billItemsText ? billItemsText + "\n" : ""}*Total Amount:* ₹${createdBill.totalAmount}\n*Paid:* ₹${createdBill.paidAmount} (${createdBill.paymentMethod})\n*Balance Due:* ₹${createdBill.balanceDue}\n*Status:* ${createdBill.paymentStatus}\n----------------------------------\nThank you for visiting!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
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
            maxWidth: 760,
            width: "100%",
            maxHeight: "92vh",
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
              padding: "18px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--surface-1)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  background: "rgba(13, 148, 136, 0.12)",
                  color: "var(--accent)",
                  padding: 8,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Receipt size={22} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                    {existingBill ? "Update Bill & Payment" : "OPD Billing & Settlement"}
                  </h3>
                  {existingBill && (
                    <span className="badge badge-purple" style={{ fontSize: "0.74rem" }}>
                      {existingBill.billNumber}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                  Patient: <strong style={{ color: "var(--text-primary)" }}>{patientName}</strong>
                  {visitDate && ` • Visit: ${new Date(visitDate).toLocaleDateString("en-IN")}`}
                </div>
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
                borderRadius: 6,
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
            {createdBill ? (
              /* Success confirmation state */
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 6px 0" }}>
                  Bill Generated Successfully!
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
                  Invoice Number: <strong>{createdBill.billNumber}</strong>
                </p>

                {/* Bill Summary Card */}
                <div
                  style={{
                    maxWidth: 420,
                    margin: "0 auto 24px",
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 16,
                    textAlign: "left",
                    fontSize: "0.88rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Total Bill Amount:</span>
                    <span style={{ fontWeight: 700 }}>₹{createdBill.totalAmount}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Amount Paid:</span>
                    <span style={{ fontWeight: 700, color: "#10b981" }}>
                      ₹{createdBill.paidAmount} ({createdBill.paymentMethod})
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: 8,
                      borderTop: "1px dashed var(--border)",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Balance Remaining:</span>
                    <span
                      style={{
                        fontWeight: 800,
                        color: createdBill.balanceDue > 0 ? "#ef4444" : "#10b981",
                      }}
                    >
                      ₹{createdBill.balanceDue}
                      {createdBill.balanceDue > 0 ? " (Pending Due)" : " (Settled)"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePrint}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Printer size={16} /> Print Bill
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleWhatsAppShare}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#25D366",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    <Share2 size={16} /> WhatsApp Bill
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onClose}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Bill Creation Form */
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* 1. Doctor's Consultation Fee */}
                <div
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "14px 18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Doctor Consultation Fee</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Default fee configured in clinic settings (editable)
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        className="form-input"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(Math.max(0, parseFloat(e.target.value) || 0))}
                        style={{ width: 110, fontWeight: 700, fontSize: "1rem" }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Treatments Performed Section */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        Treatments & Procedures Performed
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Add injections, salines, dressings, or other procedures done during this visit
                      </div>
                    </div>
                  </div>

                  {/* Quick Pills */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    {COMMON_TREATMENTS.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => handleAddItem(t.name, t.price)}
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: 20,
                          padding: "4px 10px",
                          fontSize: "0.76rem",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      >
                        <Plus size={12} style={{ color: "var(--accent)" }} />
                        <span>{t.name}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                          (₹{t.price})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Treatment Items Table / List */}
                  {items.length > 0 && (
                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        overflow: "hidden",
                        marginBottom: 12,
                      }}
                    >
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                        <thead>
                          <tr
                            style={{
                              background: "var(--surface-2)",
                              borderBottom: "1px solid var(--border)",
                              textAlign: "left",
                              color: "var(--text-secondary)",
                            }}
                          >
                            <th style={{ padding: "8px 12px" }}>Treatment / Item</th>
                            <th style={{ padding: "8px 12px", width: 75, textAlign: "center" }}>Qty</th>
                            <th style={{ padding: "8px 12px", width: 110, textAlign: "right" }}>Rate (₹)</th>
                            <th style={{ padding: "8px 12px", width: 110, textAlign: "right" }}>Total (₹)</th>
                            <th style={{ padding: "8px 8px", width: 40 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr
                              key={item.id}
                              style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-1)" }}
                            >
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                                  className="form-input"
                                  style={{ height: 32, fontSize: "0.85rem" }}
                                />
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(item.id, "quantity", e.target.value)}
                                  className="form-input"
                                  style={{ height: 32, fontSize: "0.85rem", textAlign: "center" }}
                                />
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={item.unitPrice}
                                  onChange={(e) => handleUpdateItem(item.id, "unitPrice", e.target.value)}
                                  className="form-input"
                                  style={{ height: 32, fontSize: "0.85rem", textAlign: "right" }}
                                />
                              </td>
                              <td
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "right",
                                  fontWeight: 600,
                                }}
                              >
                                ₹{(item.quantity * item.unitPrice).toFixed(0)}
                              </td>
                              <td style={{ padding: "8px 8px", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--red, #ef4444)",
                                    cursor: "pointer",
                                    padding: 4,
                                    borderRadius: 4,
                                  }}
                                  title="Remove item"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Add New Custom Treatment Row */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      background: "var(--surface-1)",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px dashed var(--border)",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Enter custom treatment (e.g. Suture removal, IV Paracetamol)"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="form-input"
                      style={{ flex: 2, height: 34, fontSize: "0.85rem" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>₹</span>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        className="form-input"
                        style={{ height: 34, fontSize: "0.85rem" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddItem()}
                      style={{ height: 34, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                </div>

                {/* 3. Discount & Total Breakdown */}
                <div
                  style={{
                    background: "var(--surface-2)",
                    borderRadius: 12,
                    padding: 16,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.88rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Consultation Fee:</span>
                    <span style={{ fontWeight: 600 }}>₹{consultationFee}</span>
                  </div>
                  {items.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.88rem" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Treatments ({items.length}):</span>
                      <span style={{ fontWeight: 600 }}>₹{itemsTotal}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      margin: "8px 0",
                      paddingTop: 8,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      Discount / Concession:
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: "0.85rem" }}>- ₹</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={discount}
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="form-input"
                        style={{ width: 85, height: 30, fontSize: "0.85rem", textAlign: "right" }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: 8,
                      borderTop: "2px solid var(--border)",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "1rem" }}>Total Bill Amount:</span>
                    <span style={{ fontWeight: 800, fontSize: "1.25rem", color: "var(--accent)" }}>
                      ₹{totalAmount}
                    </span>
                  </div>
                </div>

                {/* 4. Payment Method: Strictly Cash or UPI */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: "block" }}>
                    Payment Mode
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("CASH")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "12px 16px",
                        borderRadius: 10,
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
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Banknote size={18} />
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
                        padding: "12px 16px",
                        borderRadius: 10,
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
                        transition: "all 0.15s ease",
                      }}
                    >
                      <QrCode size={18} />
                      <span>UPI (QR Code)</span>
                    </button>
                  </div>
                </div>

                {/* 5. Live UPI QR Code if UPI selected */}
                {paymentMethod === "UPI" && (
                  <div style={{ marginTop: 4 }}>
                    <UpiQrCode
                      upiId={settings?.upiId || ""}
                      payeeName={user?.clinicName || user?.doctorName || "Clinic"}
                      amount={paidAmount > 0 ? paidAmount : totalAmount}
                      note={`Medical Bill ${patientName}`}
                      onUpiIdChange={handleSaveUpiId}
                    />
                  </div>
                )}

                {/* Existing Payments Summary if already billed */}
                {existingBill && existingBill.payments && existingBill.payments.length > 0 && (
                  <div
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                      <span>Payment History ({existingBill.payments.length} installment{existingBill.payments.length > 1 ? "s" : ""})</span>
                      <span style={{ color: "var(--accent)" }}>Paid So Far: ₹{existingBill.paidAmount}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {existingBill.payments.map((p, idx) => (
                        <div key={p.id || idx} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                          <span>• {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} via {p.paymentMethod} {p.notes ? `(${p.notes})` : ""}</span>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>₹{p.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Settlement Mode (Full / Half / Unpaid) */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                      Payment Settlement
                    </label>
                    {existingBill && Number(existingBill.balanceDue) > 0 && (
                      <span style={{ fontSize: "0.8rem", color: "#ef4444", fontWeight: 600 }}>
                        Current Due: ₹{existingBill.balanceDue}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => setSettlementType("FULL")}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 8,
                        border:
                          settlementType === "FULL"
                            ? "2px solid #10b981"
                            : "1px solid var(--border)",
                        background:
                          settlementType === "FULL"
                            ? "rgba(16, 185, 129, 0.12)"
                            : "var(--surface-1)",
                        color:
                          settlementType === "FULL" ? "#10b981" : "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "0.84rem",
                        cursor: "pointer",
                      }}
                    >
                      Full Paid (₹{totalAmount})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSettlementType("PARTIAL");
                        if (!customPaidAmount) {
                          setCustomPaidAmount(String(Math.floor(totalAmount / 2)));
                        }
                      }}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 8,
                        border:
                          settlementType === "PARTIAL"
                            ? "2px solid #f59e0b"
                            : "1px solid var(--border)",
                        background:
                          settlementType === "PARTIAL"
                            ? "rgba(245, 158, 11, 0.12)"
                            : "var(--surface-1)",
                        color:
                          settlementType === "PARTIAL" ? "#f59e0b" : "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "0.84rem",
                        cursor: "pointer",
                      }}
                    >
                      Partial / Half
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettlementType("UNPAID")}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 8,
                        border:
                          settlementType === "UNPAID"
                            ? "2px solid #ef4444"
                            : "1px solid var(--border)",
                        background:
                          settlementType === "UNPAID"
                            ? "rgba(239, 68, 68, 0.12)"
                            : "var(--surface-1)",
                        color:
                          settlementType === "UNPAID" ? "#ef4444" : "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "0.84rem",
                        cursor: "pointer",
                      }}
                    >
                      No Payment (Due)
                    </button>
                  </div>

                  {settlementType === "PARTIAL" && (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.08)",
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Amount Paid Now:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>₹</span>
                        <input
                          type="number"
                          min="0"
                          max={totalAmount}
                          value={customPaidAmount}
                          onChange={(e) => setCustomPaidAmount(e.target.value)}
                          className="form-input"
                          style={{ width: 110, height: 34, fontWeight: 700 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Summary of balance remaining */}
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: "0.82rem",
                      display: "flex",
                      justifyContent: "space-between",
                      color: balanceDue > 0 ? "#ef4444" : "#10b981",
                      fontWeight: 600,
                    }}
                  >
                    <span>Status: {balanceDue === 0 ? "PAID IN FULL" : balanceDue < totalAmount ? "PARTIALLY PAID" : "UNPAID / OVERDUE"}</span>
                    <span>Remaining Due: ₹{balanceDue}</span>
                  </div>
                </div>

                {/* 7. Notes */}
                <div>
                  <label className="form-label" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Billing Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid in 2 installments, balance to pay next week"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-input"
                    style={{ height: 36, fontSize: "0.85rem" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {!createdBill && (
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface-1)",
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {onSkip ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onSkip}
                  disabled={isSubmitting}
                  style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}
                >
                  Skip / Bill Later
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {existingBill && paidAmount > Number(existingBill.paidAmount || 0)
                      ? "Collecting Now"
                      : "Total Paid Amount"}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--accent)" }}>
                    ₹{existingBill && paidAmount > Number(existingBill.paidAmount || 0)
                      ? paidAmount - Number(existingBill.paidAmount || 0)
                      : paidAmount}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{ minWidth: 160, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {isSubmitting ? (
                    "Processing..."
                  ) : (
                    <>
                      <span>{existingBill ? "Update Payment & Bill" : "Save & Complete"}</span>
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
