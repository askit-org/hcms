"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Pill,
  Search,
  Plus,
  Trash2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  HeartPulse,
  Clock,
  ArrowRight,
  Printer,
  Share2,
  Banknote,
  QrCode,
  Bed,
  Sparkles,
  ChevronRight,
  User,
  Calendar,
  FileText,
  Edit2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useIpdMutations,
  useMedicines,
  useMedicineMutations,
  useTemplates,
  useSettings,
  useBillingMutations,
} from "@/lib/hooks/useQueries";
import { useAuth } from "@/lib/hooks/useAuth";
import type {
  IpdAdmission,
  PrescribedMedicine,
  Medicine,
  Template,
  DischargeIpdInput,
  Bill,
  CreateBillItemInput,
} from "@/lib/providers/types";
import DoseSelector, { DurationSelect } from "@/components/DoseSelector";
import InstructionPicker from "@/components/InstructionPicker";
import UpiQrCode from "@/components/UpiQrCode";
import { parseDoseToWords } from "@/lib/medicationInstructions";
import { getDayRounds, getBedDailyRate } from "@/lib/utils/ipd";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";

interface IpdDischargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: IpdAdmission;
  onSuccess?: (updated: IpdAdmission) => void;
}

interface ItemRow {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  dayNumber?: number;
  roundType?: string;
}

const COMMON_IPD_SERVICES = [
  { name: "Saline / IV Fluid (500ml)", price: 350 },
  { name: "IV Cannulation & Infusion Set", price: 250 },
  { name: "IV Injection Administration", price: 100 },
  { name: "Wound Dressing & Bandaging", price: 200 },
  { name: "Nebulization Session", price: 150 },
  { name: "ECG (12-Lead)", price: 300 },
  { name: "Blood Sugar Monitoring (GRBS)", price: 80 },
  { name: "Daily Nursing & Vitals Care", price: 300 },
];

export default function IpdDischargeModal({
  isOpen,
  onClose,
  admission,
  onSuccess,
}: IpdDischargeModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { discharge } = useIpdMutations();
  const { createBill } = useBillingMutations();
  const { data: medicinesData = [] } = useMedicines();
  const { create: createMedMut } = useMedicineMutations();
  const { data: templates = [] } = useTemplates();

  const isAlreadyDischarged = String(admission?.status || "").trim().toUpperCase() === "DISCHARGED";

  // Workflow steps:
  // - 'VIEW_STATEMENT': Read-only settled statement view when admission is already discharged (NO discharge buttons!)
  // - 'CONFIRM': Pre-discharge prompt for active patients asking to move to billing
  // - 'BILLING': Itemized billing & discharge handover screen
  // - 'SUCCESS': Post-discharge settlement receipt
  const [step, setStep] = useState<"VIEW_STATEMENT" | "CONFIRM" | "BILLING" | "SUCCESS">(
    isAlreadyDischarged ? "VIEW_STATEMENT" : "CONFIRM"
  );

  // Hard safety guard: if patient is already discharged, STRICTLY lock to read-only statement view
  const effectiveStep = isAlreadyDischarged ? "VIEW_STATEMENT" : step;

  // Itemized Billing Rows
  const [items, setItems] = useState<ItemRow[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [consultationFee, setConsultationFee] = useState<number>(0);

  // Discount
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discountVal, setDiscountVal] = useState<string>("0");
  const [discountPercent, setDiscountPercent] = useState<string>("0");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [settlementType, setSettlementType] = useState<"FULL" | "PARTIAL" | "UNPAID">("FULL");
  const [customPaidAmount, setCustomPaidAmount] = useState<string>("");

  // Clinical Discharge Handover
  const [dischargeRxMeds, setDischargeRxMeds] = useState<PrescribedMedicine[]>([]);
  const [dischargeMedQuery, setDischargeMedQuery] = useState("");
  const [showDischargeTemplateModal, setShowDischargeTemplateModal] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({
    dischargeDate: new Date().toISOString().slice(0, 16),
    dischargeSummary: "",
    dischargeNotes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settledBill, setSettledBill] = useState<Bill | null>(null);

  // Length of stay
  const stayDays = useMemo(() => {
    if (!admission?.admissionDate) return 1;
    const start = new Date(admission.admissionDate).getTime();
    const end = admission.dischargeDate
      ? new Date(admission.dischargeDate).getTime()
      : dischargeForm.dischargeDate
      ? new Date(dischargeForm.dischargeDate).getTime()
      : Date.now();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }, [admission?.admissionDate, admission?.dischargeDate, dischargeForm.dischargeDate]);

  // Total doctor rounds charted
  const totalRoundsCount = useMemo(() => {
    if (!admission?.dayWiseLogs) return 0;
    return admission.dayWiseLogs.reduce((acc, log) => {
      const rounds = getDayRounds(log);
      return acc + (rounds.length > 0 ? rounds.length : 1);
    }, 0);
  }, [admission?.dayWiseLogs]);

  // Initialize on open
  useEffect(() => {
    if (!isOpen || !admission) {
      setStep(admission?.status === "DISCHARGED" ? "VIEW_STATEMENT" : "CONFIRM");
      setSettledBill(null);
      setIsSubmitting(false);
      return;
    }

    // If already discharged, open in read-only statement view! NEVER show discharge buttons!
    if (admission.status === "DISCHARGED") {
      setStep("VIEW_STATEMENT");
    } else {
      setStep("CONFIRM");
    }

    // Set discharge date & notes
    setDischargeForm({
      dischargeDate: admission.dischargeDate
        ? new Date(admission.dischargeDate).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      dischargeSummary:
        admission.dischargeSummary ||
        "Patient recovered satisfactorily. Afebrile and hemodynamically stable at time of discharge.",
      dischargeNotes:
        admission.dischargeNotes ||
        "Review in OPD after 5-7 days. Continue prescribed discharge home medications. Maintain adequate oral fluids.",
    });

    setDiscountVal(String(admission.discount || 0));
    setDiscountPercent("0");
    setDiscountType("FLAT");
    setPaymentMethod("CASH");
    setSettlementType("FULL");

    // Preload Discharge Home Medications
    if (admission.dischargeMedications) {
      try {
        const parsed = JSON.parse(admission.dischargeMedications);
        if (Array.isArray(parsed)) {
          setDischargeRxMeds(parsed);
        } else {
          setDischargeRxMeds([]);
        }
      } catch {
        setDischargeRxMeds([]);
      }
    } else {
      // Preload from last day log's medications if present
      const logs = admission.dayWiseLogs || [];
      if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        const rounds = getDayRounds(lastLog);
        const lastRound = rounds[rounds.length - 1];
        const sourceMeds = lastRound?.medications || lastLog.medications || [];

        if (sourceMeds.length > 0) {
          setDischargeRxMeds(
            sourceMeds.map((m) => ({
              name: m.name,
              dose: m.dose || "1-0-1",
              duration: "5 days",
              instructions: m.instructions || "After Food",
            }))
          );
        } else {
          setDischargeRxMeds([]);
        }
      } else {
        setDischargeRxMeds([]);
      }
    }

    // ── Compile Itemized Billing Rows from All Day Logs and Visits ──
    const compiledRows: ItemRow[] = [];

    // 1. Calculate & Include Admitted Bed / Room Charges
    const dailyBedRate = getBedDailyRate(admission.bedOrRoom, settings?.ipdRooms);
    compiledRows.push({
      id: "bed_charge_auto",
      name: `Bed / Room Care: ${admission.bedOrRoom} (${stayDays} ${stayDays === 1 ? "day" : "days"} @ ₹${dailyBedRate}/day)`,
      quantity: stayDays,
      unitPrice: dailyBedRate,
    });

    // 2. Compile procedures from all day logs
    const logs = [...(admission.dayWiseLogs || [])].sort((a, b) => a.dayNumber - b.dayNumber);

    logs.forEach((log) => {
      const rounds = getDayRounds(log);
      if (rounds.length > 0) {
        rounds.forEach((round, rIdx) => {
          (round.procedures || []).forEach((p, pIdx) => {
            const qty = Number(p.quantity) || 1;
            const unit = p.unitPrice !== undefined ? Number(p.unitPrice) : Number(p.totalPrice || 0) / qty;
            compiledRows.push({
              id: `proc_${log.dayNumber}_${round.id || rIdx}_${pIdx}`,
              name: `[Day ${log.dayNumber} · ${round.roundType || "Round"}] ${p.name}`,
              quantity: qty,
              unitPrice: unit,
              dayNumber: log.dayNumber,
              roundType: round.roundType,
            });
          });
        });
      } else if (log.procedures && log.procedures.length > 0) {
        log.procedures.forEach((p, pIdx) => {
          const qty = Number(p.quantity) || 1;
          const unit = p.unitPrice !== undefined ? Number(p.unitPrice) : Number(p.totalPrice || 0) / qty;
          compiledRows.push({
            id: `proc_${log.dayNumber}_legacy_${pIdx}`,
            name: `[Day ${log.dayNumber}] ${p.name}`,
            quantity: qty,
            unitPrice: unit,
            dayNumber: log.dayNumber,
          });
        });
      }
    });

    setItems(compiledRows);
  }, [isOpen, admission?.id, admission?.status, settings?.ipdRooms, stayDays]);

  // Keep Bed Charge line item in sync when stayDays changes (e.g. if doctor adjusts discharge date)
  useEffect(() => {
    if (!admission || isAlreadyDischarged) return;
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === "bed_charge_auto");
      if (idx === -1) return prev;
      const current = prev[idx];
      if (current.quantity === stayDays) return prev;
      const unit = current.unitPrice;
      const next = [...prev];
      next[idx] = {
        ...current,
        quantity: stayDays,
        name: `Bed / Room Care: ${admission.bedOrRoom} (${stayDays} ${stayDays === 1 ? "day" : "days"} @ ₹${unit}/day)`,
      };
      return next;
    });
  }, [stayDays, admission?.bedOrRoom, isAlreadyDischarged]);

  // Add Item Row
  const handleAddItem = (name: string, price: number, qty = 1) => {
    if (!name.trim()) return;
    const newItem: ItemRow = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      quantity: qty,
      unitPrice: price,
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemName("");
    setNewItemPrice("");
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
  };

  // Medicine Prescription Management
  const addDischargeMedicine = (m: Medicine | { name: string; defaultDose?: string; defaultDuration?: string }) => {
    setDischargeRxMeds((prev) => [
      ...prev,
      {
        medicineId: (m as any).id,
        name: m.name,
        dose: m.defaultDose || "1-0-1",
        duration: m.defaultDuration || "5 days",
        instructions: "After Food",
      },
    ]);
    setDischargeMedQuery("");
  };

  const updateDischargeMed = (i: number, k: keyof PrescribedMedicine, v: any) => {
    setDischargeRxMeds((prev) => prev.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));
  };

  const removeDischargeMed = (i: number) => {
    setDischargeRxMeds((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleAddNewDischargeMedicineDirectly = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const newMed = await createMedMut.mutateAsync({
        name: trimmed,
        category: "Other",
        defaultDose: "1-0-1",
        defaultDuration: "5 days",
      });
      addDischargeMedicine(newMed);
      toast(`Added "${trimmed}" to prescription & master catalog.`, "success");
    } catch {
      addDischargeMedicine({
        name: trimmed,
        defaultDose: "1-0-1",
        defaultDuration: "5 days",
      });
    }
  };

  const applyDischargeTemplate = (t: Template) => {
    if (t.medicines && Array.isArray(t.medicines)) {
      setDischargeRxMeds((prev) => [...prev, ...t.medicines]);
    }
    setShowDischargeTemplateModal(false);
    toast(`Prescription template "${t.name}" applied!`, "success");
  };

  const filteredDischargeMeds = useMemo(() => {
    if (!dischargeMedQuery.trim()) return [];
    return medicinesData
      .filter(
        (m) =>
          m.name.toLowerCase().includes(dischargeMedQuery.toLowerCase()) &&
          !dischargeRxMeds.find((r) => r.name.toLowerCase() === m.name.toLowerCase())
      )
      .slice(0, 20);
  }, [dischargeMedQuery, medicinesData, dischargeRxMeds]);

  // ── Financial Calculations ──
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0), 0);
  }, [items]);

  const grossHospitalCharges = useMemo(() => {
    if (isAlreadyDischarged) {
      return Number(admission.cumulativeCharges || 0);
    }
    return itemsSubtotal + (Number(consultationFee) || 0);
  }, [isAlreadyDischarged, admission?.cumulativeCharges, itemsSubtotal, consultationFee]);

  const advancePaidAlready = Number(admission?.advancePaid || 0);

  const calculatedDiscount = useMemo(() => {
    if (isAlreadyDischarged) {
      return Number(admission.discount || 0);
    }
    if (discountType === "PERCENT") {
      const pct = parseFloat(discountPercent) || 0;
      return Math.round((grossHospitalCharges * Math.min(100, Math.max(0, pct))) / 100);
    }
    return Math.min(grossHospitalCharges, parseFloat(discountVal) || 0);
  }, [isAlreadyDischarged, admission?.discount, discountType, discountPercent, discountVal, grossHospitalCharges]);

  // Balance due after deducting advance deposit already paid and discount
  const netBalanceDue = useMemo(() => {
    if (isAlreadyDischarged) {
      return Number(admission.balanceDue || 0);
    }
    return Math.max(0, grossHospitalCharges - advancePaidAlready - calculatedDiscount);
  }, [isAlreadyDischarged, admission?.balanceDue, grossHospitalCharges, advancePaidAlready, calculatedDiscount]);

  // Final payment to collect now
  const amountToCollectNow = useMemo(() => {
    if (settlementType === "UNPAID") return 0;
    if (settlementType === "PARTIAL") return parseFloat(customPaidAmount) || 0;
    return netBalanceDue;
  }, [settlementType, customPaidAmount, netBalanceDue]);

  // Total patient settlement for the entire admission (Advance + Final Payment)
  const totalSettlementAmount = useMemo(() => {
    if (isAlreadyDischarged) {
      return Number(admission.totalPaid || 0);
    }
    return advancePaidAlready + amountToCollectNow;
  }, [isAlreadyDischarged, admission?.totalPaid, advancePaidAlready, amountToCollectNow]);

  // Balance due remaining after this discharge transaction
  const remainingDueAfterDischarge = useMemo(() => {
    return Math.max(0, netBalanceDue - amountToCollectNow);
  }, [netBalanceDue, amountToCollectNow]);

  // ── Complete Discharge & Billing Execution ──
  const handleConfirmDischargeAndSettle = async () => {
    if (!admission || isAlreadyDischarged) return;
    setIsSubmitting(true);

    try {
      // 1. Prepare itemized bill items
      const billItems: CreateBillItemInput[] = items.map((it) => ({
        name: it.name,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      }));

      // Add consultation fee if present
      const fee = Number(consultationFee) || 0;

      // 2. Create official Bill record in billing system
      const billPayload = {
        patientId: admission.patientId,
        consultationFee: fee,
        items: billItems,
        discount: calculatedDiscount,
        paidAmount: totalSettlementAmount,
        paymentMethod,
        notes: `Inpatient Admission #${admission.admissionNumber} Final Settlement · Bed: ${admission.bedOrRoom} (${stayDays} days stay) · Advance Deposit: ₹${advancePaidAlready} + Final Settlement: ₹${amountToCollectNow}`,
      };

      const billResult = await createBill.mutateAsync(billPayload);
      setSettledBill(billResult);

      // 3. Discharge IPD Admission in backend
      const medsJson = dischargeRxMeds.length > 0 ? JSON.stringify(dischargeRxMeds) : undefined;
      const dischargePayload: DischargeIpdInput = {
        dischargeDate: dischargeForm.dischargeDate
          ? new Date(dischargeForm.dischargeDate).toISOString()
          : new Date().toISOString(),
        dischargeSummary: dischargeForm.dischargeSummary.trim() || undefined,
        dischargeMedications: medsJson,
        dischargeNotes: dischargeForm.dischargeNotes.trim() || undefined,
        discount: calculatedDiscount,
        finalPayment: amountToCollectNow,
        paymentMethod,
        cumulativeCharges: grossHospitalCharges,
      };

      const updated = await discharge.mutateAsync({
        id: admission.id,
        input: dischargePayload,
      });

      toast("Patient successfully discharged & official bill created!", "success");
      onSuccess?.(updated);
      setStep("SUCCESS");
    } catch (err) {
      toast(getErrorMessage(err, "Failed to complete discharge & billing."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    onClose();
    router.push(`/ipd/${admission.id}/print`);
  };

  const handleWhatsAppShare = () => {
    if (!admission?.patient?.mobile) {
      toast("Patient mobile number not available for WhatsApp", "error");
      return;
    }
    const clinicName = user?.clinicName || "Hospital / Clinic";
    const doctorName = user?.doctorName || "Doctor";
    const billItemsText = items.length > 0
      ? items
          .map((it) => `• ${it.name} (Qty: ${it.quantity}): ₹${(it.quantity * it.unitPrice).toFixed(0)}`)
          .join("\n")
      : "• Hospital Room & Inpatient Medical Care";

    const message = `*${clinicName}*
*INPATIENT DISCHARGE & FINAL SETTLEMENT*
IPD #${admission.admissionNumber} | Bill #${settledBill?.billNumber || "SETTLED"}

*Patient:* ${admission.patient?.name}
*Bed/Room:* ${admission.bedOrRoom}
*Stay:* ${stayDays} Days (${new Date(admission.admissionDate).toLocaleDateString("en-IN")} to ${new Date(dischargeForm.dischargeDate || admission.dischargeDate || new Date()).toLocaleDateString("en-IN")})
*Attending Doctor:* Dr. ${admission.attendingDoctor || doctorName}

*Itemized Stay Charges:*
${billItemsText}

*Gross Charges:* ₹${grossHospitalCharges}
*Advance Deposit Paid:* -₹${advancePaidAlready}
*Discount:* -₹${calculatedDiscount}
*Total Paid:* ₹${totalSettlementAmount}
*Remaining Balance:* ₹${isAlreadyDischarged ? admission.balanceDue : remainingDueAfterDischarge}

${dischargeForm.dischargeSummary ? `*Discharge Condition:* ${dischargeForm.dischargeSummary}\n` : ""}${dischargeForm.dischargeNotes ? `*Advice:* ${dischargeForm.dischargeNotes}\n` : ""}
Thank you for trusting our care. Wish you a speedy recovery!`;

    const encoded = encodeURIComponent(message);
    const cleanPhone = admission.patient.mobile.replace(/\D/g, "");
    const url = `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}?text=${encoded}`;
    window.open(url, "_blank");
  };

  if (!isOpen || !admission) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-solid)",
          borderRadius: 16,
          padding: 24,
          maxWidth: effectiveStep === "CONFIRM" ? 540 : 920,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.5)",
          transition: "all 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── STEP 0: READ-ONLY SETTLEMENT & SUMMARY VIEW (WHEN ALREADY DISCHARGED) ─── */}
        {effectiveStep === "VIEW_STATEMENT" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Receipt size={20} style={{ color: "#10b981" }} />
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                    Inpatient Settlement Statement &amp; Discharge Summary
                  </h3>
                  <span className="badge badge-green" style={{ fontSize: "0.74rem", fontWeight: 800 }}>
                    DISCHARGED &amp; SETTLED
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Patient: <strong style={{ color: "var(--text-primary)" }}>{admission.patient?.name}</strong> ({admission.patient?.age}y / {admission.patient?.gender}) · IPD #{admission.admissionNumber} · Bed: <strong>{admission.bedOrRoom}</strong> · Stay: <strong>{stayDays} Days</strong>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={onClose} title="Close">
                <X size={18} />
              </button>
            </div>

            {/* Financial Overview Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
                background: "var(--surface-1)",
                padding: "14px 18px",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Hospital Charges</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text-primary)", marginTop: 2 }}>
                  ₹{admission.cumulativeCharges || grossHospitalCharges}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Advance Deposit Credited</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#16a34a", marginTop: 2 }}>
                  -₹{admission.advancePaid || advancePaidAlready}
                </div>
              </div>
              {Boolean(admission.discount) && (
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Discount Given</div>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#16a34a", marginTop: 2 }}>
                    -₹{admission.discount}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Settled &amp; Paid</div>
                <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "#10b981", marginTop: 2 }}>
                  ₹{admission.totalPaid || totalSettlementAmount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Final Balance Due</div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "1.15rem",
                    color: Number(admission.balanceDue) > 0 ? "#ef4444" : "#10b981",
                    marginTop: 2,
                  }}
                >
                  {Number(admission.balanceDue) > 0 ? `₹${admission.balanceDue}` : "Settled (₹0)"}
                </div>
              </div>
            </div>

            {/* Inpatient Stay Timing Details */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                background: "var(--surface-2)",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                fontSize: "0.82rem",
              }}
            >
              <div>
                <span style={{ color: "var(--text-muted)" }}>Admission Date: </span>
                <strong>
                  {new Date(admission.admissionDate).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Discharge Date: </span>
                <strong>
                  {admission.dischargeDate
                    ? new Date(admission.dischargeDate).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Completed"}
                </strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Attending Doctor: </span>
                <strong>Dr. {admission.attendingDoctor || "Attending Physician"}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Diagnosis: </span>
                <strong style={{ color: "var(--primary)" }}>{admission.diagnosis || "Inpatient Care"}</strong>
              </div>
            </div>

            {/* Itemized Procedures Breakdown (Read-Only) */}
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Receipt size={16} style={{ color: "var(--primary)" }} />
                Itemized Inpatient Charges ({items.length > 0 ? items.length : 1} items)
              </div>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--surface-solid)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 1fr 1.2fr 1.2fr",
                    gap: 8,
                    padding: "8px 14px",
                    background: "var(--surface-2)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Description</span>
                  <span style={{ textAlign: "center" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Unit Price</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                </div>

                <div style={{ maxHeight: 180, overflowY: "auto" }}>
                  {items.length === 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "3fr 1fr 1.2fr 1.2fr",
                        gap: 8,
                        padding: "10px 14px",
                        fontSize: "0.84rem",
                      }}
                    >
                      <span>Inpatient Hospital Accommodation &amp; Clinical Care ({stayDays}d)</span>
                      <span style={{ textAlign: "center" }}>{stayDays}</span>
                      <span style={{ textAlign: "right" }}>₹{(Number(admission.cumulativeCharges || 0) / stayDays).toFixed(0)}</span>
                      <span style={{ textAlign: "right", fontWeight: 700 }}>₹{admission.cumulativeCharges}</span>
                    </div>
                  ) : (
                    items.map((it) => (
                      <div
                        key={it.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "3fr 1fr 1.2fr 1.2fr",
                          gap: 8,
                          padding: "8px 14px",
                          borderBottom: "1px solid var(--border)",
                          fontSize: "0.82rem",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{it.name}</span>
                        <span style={{ textAlign: "center" }}>{it.quantity}</span>
                        <span style={{ textAlign: "right", color: "var(--text-muted)" }}>₹{it.unitPrice}</span>
                        <span style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>
                          ₹{(it.quantity * it.unitPrice).toFixed(0)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Clinical Discharge Summary & Home Medications */}
            {(admission.dischargeSummary || dischargeRxMeds.length > 0 || admission.dischargeNotes) && (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {admission.dischargeSummary && (
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                      Hospital Course &amp; Condition at Discharge
                    </div>
                    <div style={{ background: "var(--surface-solid)", borderLeft: "4px solid #10b981", borderRadius: 6, padding: "8px 12px", fontSize: "0.86rem", lineHeight: 1.5 }}>
                      {admission.dischargeSummary}
                    </div>
                  </div>
                )}

                {dischargeRxMeds.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                      Prescribed Discharge Home Medications ({dischargeRxMeds.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                      {dischargeRxMeds.map((med, idx) => (
                        <div key={idx} style={{ background: "var(--surface-solid)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: "0.82rem" }}>
                          <strong style={{ color: "var(--text-primary)" }}>{med.name}</strong>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                            {med.dose} · {med.duration}
                            {med.instructions ? ` · ${med.instructions}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {admission.dischargeNotes && (
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                      Post-Discharge Instructions &amp; Follow-Up Advice
                    </div>
                    <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", background: "var(--surface-solid)", borderRadius: 6, padding: "8px 12px", border: "1px solid var(--border)" }}>
                      {admission.dischargeNotes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Read-Only Action Bar: Print, WhatsApp, and Done */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePrint}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Printer size={16} /> Print Discharge Statement
                </button>
                {admission.patient?.mobile && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleWhatsAppShare}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#25D366",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    <Share2 size={16} /> WhatsApp Statement
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                Close Statement
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 1: PRE-DISCHARGE CONFIRMATION PROMPT (FOR ACTIVE PATIENTS ONLY) ─── */}
        {effectiveStep === "CONFIRM" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Receipt size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800 }}>
                    Discharge Inpatient &amp; Proceed to Billing
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    Move to final financial settlement and clinical discharge handover.
                  </p>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={onClose} title="Cancel">
                <X size={18} />
              </button>
            </div>

            {/* Inpatient Stay Summary Card */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                    {admission.patient?.name || "Inpatient"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {admission.patient?.age}y / {admission.patient?.gender || "Unknown"} · IPD #{admission.admissionNumber}
                  </div>
                </div>
                <span className="badge badge-purple" style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
                  <Bed size={13} style={{ marginRight: 4 }} /> Bed: {admission.bedOrRoom}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 10,
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Stay Duration</div>
                  <div style={{ fontWeight: 800, fontSize: "0.98rem", marginTop: 2 }}>Day {stayDays} ({stayDays}d stayed)</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Doctor Visits Charted</div>
                  <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "var(--primary)", marginTop: 2 }}>
                    {totalRoundsCount} {totalRoundsCount === 1 ? "Round" : "Rounds"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Recorded Charges</div>
                  <div style={{ fontWeight: 800, fontSize: "0.98rem", marginTop: 2 }}>₹{admission.cumulativeCharges}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Advance Deposit</div>
                  <div style={{ fontWeight: 800, fontSize: "0.98rem", color: "#16a34a", marginTop: 2 }}>₹{advancePaidAlready}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.84rem",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                background: "rgba(13, 148, 136, 0.06)",
                border: "1px solid rgba(13, 148, 136, 0.2)",
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <Sparkles size={18} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Automatic Inpatient Billing:</strong> Proceeding will automatically pull every procedure, injection, saline, and treatment charted during rounds into an itemized bill, deduct the advance deposit (<strong>₹{advancePaidAlready}</strong>), and complete clinical discharge.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel / Keep Admitted
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setStep("BILLING")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                Proceed to Billing &amp; Discharge <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: INPATIENT ITEMIZED BILLING & CLINICAL HANDOVER (FOR ACTIVE DISCHARGE) ─── */}
        {effectiveStep === "BILLING" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                    Inpatient Final Settlement &amp; Discharge
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: "0.74rem" }}>
                    Day {stayDays} · Bed: {admission.bedOrRoom}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 3 }}>
                  Patient: <strong style={{ color: "var(--text-primary)" }}>{admission.patient?.name}</strong> ({admission.patient?.age}y / {admission.patient?.gender}) · IPD #{admission.admissionNumber}
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={onClose} title="Close">
                <X size={18} />
              </button>
            </div>

            {/* Top Financial Breakdown Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
                background: "var(--surface-1)",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Gross Stay Charges</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text-primary)", marginTop: 2 }}>
                  ₹{grossHospitalCharges}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Advance Deposit</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#16a34a", marginTop: 2 }}>
                  -₹{advancePaidAlready}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Discount</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: calculatedDiscount > 0 ? "#16a34a" : "var(--text-muted)", marginTop: 2 }}>
                  -₹{calculatedDiscount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Net Balance Due</div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "1.15rem",
                    color: netBalanceDue > 0 ? "#ef4444" : "#10b981",
                    marginTop: 2,
                  }}
                >
                  ₹{netBalanceDue}
                </div>
              </div>
            </div>

            {/* 1. Itemized Stay Charges Table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <Receipt size={16} style={{ color: "var(--primary)" }} />
                  Itemized Stay Procedures &amp; Services ({items.length})
                </label>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Auto-compiled from all doctor rounds
                </span>
              </div>

              {/* Items List */}
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "var(--surface-solid)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 1fr 1.2fr 1.2fr 40px",
                    gap: 8,
                    padding: "8px 12px",
                    background: "var(--surface-2)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Procedure / Service Description</span>
                  <span style={{ textAlign: "center" }}>Qty</span>
                  <span style={{ textAlign: "right" }}>Unit Price</span>
                  <span style={{ textAlign: "right" }}>Total</span>
                  <span></span>
                </div>

                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px 12px", color: "var(--text-muted)", fontSize: "0.84rem" }}>
                      No procedures charted yet. Add procedures or daily charges below.
                    </div>
                  ) : (
                    items.map((it) => {
                      const lineTotal = (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0);
                      return (
                        <div
                          key={it.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "3fr 1fr 1.2fr 1.2fr 40px",
                            gap: 8,
                            padding: "8px 12px",
                            alignItems: "center",
                            borderBottom: "1px solid var(--border)",
                            fontSize: "0.82rem",
                          }}
                        >
                          <input
                            className="form-input form-input-sm"
                            value={it.name}
                            onChange={(e) => handleUpdateItem(it.id, { name: e.target.value })}
                            placeholder="Service name..."
                            style={{ fontSize: "0.82rem", padding: "4px 8px" }}
                          />
                          <input
                            type="number"
                            min="1"
                            className="form-input form-input-sm"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(it.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={{ textAlign: "center", fontSize: "0.82rem", padding: "4px 6px" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              className="form-input form-input-sm"
                              value={it.unitPrice}
                              onChange={(e) => handleUpdateItem(it.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                              style={{ textAlign: "right", fontSize: "0.82rem", padding: "4px 6px", width: 80 }}
                            />
                          </div>
                          <div style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>
                            ₹{lineTotal.toFixed(0)}
                          </div>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleRemoveItem(it.id)}
                            style={{ color: "var(--red)", padding: 4 }}
                            title="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Inline Add Item Row */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "8px 12px",
                    background: "var(--surface-1)",
                    borderTop: "1px solid var(--border)",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    className="form-input form-input-sm"
                    placeholder="Add custom hospital charge / procedure..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    style={{ flex: 1, minWidth: 200, fontSize: "0.82rem" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>₹</span>
                    <input
                      type="number"
                      placeholder="Price"
                      className="form-input form-input-sm"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      style={{ width: 80, fontSize: "0.82rem" }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleAddItem(newItemName, parseFloat(newItemPrice) || 0)}
                    disabled={!newItemName.trim()}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                  >
                    <Plus size={14} /> Add Line
                  </button>
                </div>
              </div>

              {/* Quick Pick Standard Hospital Services */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center", fontWeight: 600 }}>
                  Quick Add:
                </span>
                {COMMON_IPD_SERVICES.map((srv, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleAddItem(srv.name, srv.price)}
                    style={{ fontSize: "0.72rem", padding: "2px 8px", background: "var(--surface-1)", border: "1px solid var(--border)" }}
                  >
                    + {srv.name} (₹{srv.price})
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Financial Reconciliation & Payment */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              {/* Doctor Consultation Fee & Discount */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                    Inpatient Doctor Visit / Consultation Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", margin: 0 }}>
                      Discount
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`btn btn-xs ${discountType === "FLAT" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setDiscountType("FLAT")}
                        style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                      >
                        Flat (₹)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${discountType === "PERCENT" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setDiscountType("PERCENT")}
                        style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                      >
                        Percent (%)
                      </button>
                    </div>
                  </div>

                  {discountType === "FLAT" ? (
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      placeholder="0"
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-input"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="e.g. 10%"
                    />
                  )}
                </div>
              </div>

              {/* Settlement Mode & Collection */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                    Payment Collection Today
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementType === "FULL" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setSettlementType("FULL")}
                      style={{ fontSize: "0.78rem", fontWeight: 700 }}
                    >
                      Full (₹{netBalanceDue})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementType === "PARTIAL" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => {
                        setSettlementType("PARTIAL");
                        setCustomPaidAmount(String(netBalanceDue));
                      }}
                      style={{ fontSize: "0.78rem" }}
                    >
                      Partial
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${settlementType === "UNPAID" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setSettlementType("UNPAID")}
                      style={{ fontSize: "0.78rem" }}
                    >
                      Record Due
                    </button>
                  </div>
                </div>

                {settlementType === "PARTIAL" && (
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                      Amount Being Collected Now (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={netBalanceDue}
                      className="form-input"
                      value={customPaidAmount}
                      onChange={(e) => setCustomPaidAmount(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                    Payment Method
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${paymentMethod === "CASH" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setPaymentMethod("CASH")}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Banknote size={15} /> Cash
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${paymentMethod === "UPI" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setPaymentMethod("UPI")}
                      style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <QrCode size={15} /> UPI (QR Code)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* UPI QR Code Preview if UPI selected */}
            {paymentMethod === "UPI" && amountToCollectNow > 0 && (
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <UpiQrCode
                  upiId={settings?.upiId || ""}
                  payeeName={settings?.clinicName || user?.clinicName || "Hospital"}
                  amount={amountToCollectNow}
                  note={`IPD #${admission.admissionNumber} Settlement`}
                />
              </div>
            )}

            {/* 3. Clinical Discharge Handover (Summary & Home Medications) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                    Discharge Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={dischargeForm.dischargeDate}
                    onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeDate: e.target.value }))}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem", margin: 0 }}>
                      Condition at Discharge
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                        onClick={() =>
                          setDischargeForm((f) => ({
                            ...f,
                            dischargeSummary: "Patient recovered satisfactorily. Afebrile and hemodynamically stable.",
                          }))
                        }
                      >
                        + Satisfactory
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                        onClick={() =>
                          setDischargeForm((f) => ({
                            ...f,
                            dischargeSummary: "Patient stable on oral medication. Discharged upon patient / family request.",
                          }))
                        }
                      >
                        + On Request
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={dischargeForm.dischargeSummary}
                    onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeSummary: e.target.value }))}
                    placeholder="Clinical condition at discharge, recovery summary..."
                  />
                </div>
              </div>

              {/* Discharge Home Prescription (OPD-Style with DoseSelector) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <Pill size={16} style={{ color: "var(--primary)" }} />
                    Discharge Home Prescription ({dischargeRxMeds.length})
                  </label>
                  {templates.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowDischargeTemplateModal(true)}
                      style={{ fontSize: "0.74rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Layers size={13} /> Apply Prescription Template
                    </button>
                  )}
                </div>

                {/* Medicine Search Box */}
                <div style={{ position: "relative", zIndex: 100, marginBottom: 8 }}>
                  <div className="search-input-wrap">
                    <span className="s-icon">
                      <Search size={15} />
                    </span>
                    <input
                      className="search-input"
                      placeholder="Search home medicine to prescribe (e.g. Paracetamol, Cefixime, Pantoprazole)…"
                      value={dischargeMedQuery}
                      onChange={(e) => setDischargeMedQuery(e.target.value)}
                    />
                  </div>
                  {dischargeMedQuery.trim() !== "" && (
                    <div className="search-dropdown">
                      {filteredDischargeMeds.map((m) => (
                        <div key={m.id} className="search-result" onClick={() => addDischargeMedicine(m)}>
                          <div className="sr-name">{m.name}</div>
                          <div className="sr-meta">
                            {m.category} · {parseDoseToWords(m.defaultDose).en || m.defaultDose} · {m.defaultDuration}
                          </div>
                        </div>
                      ))}
                      <div
                        className="search-result"
                        style={{
                          color: "var(--primary)",
                          fontWeight: 700,
                          borderTop: filteredDischargeMeds.length > 0 ? "1px solid var(--border)" : "none",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(13, 148, 136, 0.06)",
                          cursor: "pointer",
                        }}
                        onClick={() => handleAddNewDischargeMedicineDirectly(dischargeMedQuery)}
                      >
                        <Plus size={15} /> Add &quot;{dischargeMedQuery.trim()}&quot; as new medicine
                      </div>
                    </div>
                  )}
                </div>

                {/* Medicine Rows */}
                {dischargeRxMeds.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: "var(--text-muted)",
                      fontSize: "0.82rem",
                      border: "1px dashed var(--border)",
                      borderRadius: 10,
                      background: "var(--surface-1)",
                    }}
                  >
                    No discharge home medications added yet. Search and select above.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                    <div
                      className="med-row-header"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2.2fr 1.1fr 1.1fr 2.5fr auto",
                        gap: 8,
                        padding: "4px 6px",
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      <span>Medicine</span>
                      <span>Dose</span>
                      <span>Duration</span>
                      <span>Instructions</span>
                      <span></span>
                    </div>

                    {dischargeRxMeds.map((m, i) => (
                      <div key={i} className="med-row" style={{ marginBottom: 0 }}>
                        <div className="med-row-field">
                          <input
                            className="form-input"
                            placeholder="Medicine Name"
                            value={m.name}
                            onChange={(e) => updateDischargeMed(i, "name", e.target.value)}
                          />
                        </div>

                        <div className="med-row-field">
                          <DoseSelector value={m.dose} onChange={(v) => updateDischargeMed(i, "dose", v)} />
                        </div>

                        <div className="med-row-field">
                          <DurationSelect value={m.duration} onChange={(v) => updateDischargeMed(i, "duration", v)} />
                        </div>

                        <div className="med-row-field">
                          <InstructionPicker
                            instructionKeys={m.instructionKeys}
                            customInstruction={m.customInstruction}
                            languages={m.instructionLangs as any}
                            onChange={({ instructionKeys, customInstruction, languages, formattedText }) => {
                              setDischargeRxMeds((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? {
                                        ...item,
                                        instructions: formattedText,
                                        instructionKeys,
                                        customInstruction,
                                        instructionLangs: languages as any,
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--red)", padding: 6 }}
                            onClick={() => removeDischargeMed(i)}
                            title="Remove"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Follow-Up & Discharge Instructions */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: "0.84rem" }}>
                  Post-Discharge Instructions &amp; Follow-Up Advice
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={dischargeForm.dischargeNotes}
                  onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeNotes: e.target.value }))}
                  placeholder="e.g. Review in OPD after 5 days with fresh blood reports. SOS if fever occurs..."
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                borderTop: "1px solid var(--border)",
                paddingTop: 14,
              }}
            >
              <button type="button" className="btn btn-ghost" onClick={() => setStep("CONFIRM")} disabled={isSubmitting}>
                ← Back
              </button>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmDischargeAndSettle}
                  disabled={isSubmitting}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#10b981",
                    borderColor: "#10b981",
                    fontWeight: 800,
                  }}
                >
                  <CheckCircle2 size={18} />
                  {isSubmitting
                    ? "Settling & Discharging…"
                    : `Confirm Payment & Discharge Patient (₹${amountToCollectNow})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: POST-DISCHARGE SUCCESS RECEIPT ─── */}
        {effectiveStep === "SUCCESS" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, textAlign: "center", padding: "10px 4px" }}>
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
                margin: "0 auto",
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 800 }}>
                Discharge Completed &amp; Bill Settled!
              </h3>
              <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-muted)" }}>
                Patient status updated to <strong>DISCHARGED</strong>. Bed <strong>{admission.bedOrRoom}</strong> has been vacated and freed.
              </p>
            </div>

            {/* Official Summary Card */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 16,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Patient Name:</span>
                <strong style={{ fontSize: "0.94rem" }}>{admission.patient?.name}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Official Bill Number:</span>
                <span className="badge badge-purple" style={{ fontWeight: 800 }}>
                  {settledBill?.billNumber || "INV-IPD"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Length of Stay:</span>
                <span>{stayDays} Days</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Total Hospital Charges:</span>
                <span>₹{grossHospitalCharges}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Advance Deposit Credited:</span>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>-₹{advancePaidAlready}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Discount:</span>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>-₹{calculatedDiscount}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 8,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>Total Settled:</span>
                <strong style={{ fontSize: "1.1rem", color: "#10b981" }}>₹{totalSettlementAmount}</strong>
              </div>
            </div>

            {/* Print & Share Actions */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrint}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Printer size={16} /> Print Discharge Bill
              </button>
              {admission.patient?.mobile && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleWhatsAppShare}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#25D366",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  <Share2 size={16} /> WhatsApp Bill
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                Done &amp; Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OPD Prescription Template Modal */}
      <AnimatePresence>
        {showDischargeTemplateModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10001,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={() => setShowDischargeTemplateModal(false)}
          >
            <div
              style={{
                background: "var(--surface-solid)",
                borderRadius: 12,
                padding: 20,
                maxWidth: 480,
                width: "100%",
                maxHeight: "80vh",
                overflowY: "auto",
                border: "1px solid var(--border)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>Apply Prescription Template</div>
                <button type="button" className="btn-icon" onClick={() => setShowDischargeTemplateModal(false)}>
                  <X size={16} />
                </button>
              </div>

              {templates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                  No prescription templates available.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      style={{
                        padding: "10px 12px",
                        background: "var(--surface-1)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onClick={() => applyDischargeTemplate(tpl)}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{tpl.name}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                          {tpl.medicines?.length || 0} medicines included
                        </div>
                      </div>
                      <span className="btn btn-secondary btn-xs">Apply</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
