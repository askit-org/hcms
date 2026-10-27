"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Download,
  Printer,
  Share2,
  Calendar,
  CheckCircle2,
  Receipt,
  CheckSquare,
  Square,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSettings } from "@/lib/hooks/useQueries";
import type { Patient, Visit } from "@/lib/providers/types";
import { toast } from "./Toast";
import { jsPDF } from "jspdf";

interface MultiDayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  visits: Visit[];
}

export default function MultiDayBillModal({
  isOpen,
  onClose,
  patient,
  visits,
}: MultiDayBillModalProps) {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const [mounted, setMounted] = useState(false);

  // Selected visit IDs for inclusion in multi-day statement
  const [selectedVisitIds, setSelectedVisitIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize selected visits to all visits that have billing info or treatments
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const validIds = visits
        .filter((v) => v.bill || v.treatment || v.billingStatus === "BILLED")
        .map((v) => String(v.id));
      setSelectedVisitIds(new Set(validIds.length > 0 ? validIds : visits.map((v) => String(v.id))));
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen, visits]);

  const toggleSelectAll = () => {
    if (selectedVisitIds.size === visits.length) {
      setSelectedVisitIds(new Set());
    } else {
      setSelectedVisitIds(new Set(visits.map((v) => String(v.id))));
    }
  };

  const toggleVisit = (id: string) => {
    setSelectedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedVisits = useMemo(() => {
    return visits
      .filter((v) => selectedVisitIds.has(String(v.id)))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [visits, selectedVisitIds]);

  // Aggregate items and calculations
  const breakdownRows = useMemo(() => {
    const rows: Array<{
      date: string;
      description: string;
      category: string;
      quantity: number;
      amount: number;
    }> = [];

    selectedVisits.forEach((v) => {
      const dateStr = new Date(v.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      if (v.bill) {
        // Add consultation fee from bill
        if (Number(v.bill.consultationFee) > 0) {
          rows.push({
            date: dateStr,
            description: `Doctor Consultation ${v.diagnosis ? `(Dx: ${v.diagnosis})` : ""}`,
            category: "Consultation",
            quantity: 1,
            amount: Number(v.bill.consultationFee),
          });
        }
        // Add itemized procedures
        (v.bill.items || []).forEach((it) => {
          rows.push({
            date: dateStr,
            description: it.name,
            category: "Procedure / Treatment",
            quantity: Number(it.quantity) || 1,
            amount: Number(it.totalPrice) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
          });
        });
      } else {
        // Unbilled visit fallback
        rows.push({
          date: dateStr,
          description: `OPD Consultation ${v.diagnosis ? `(${v.diagnosis})` : ""}`,
          category: "Consultation",
          quantity: 1,
          amount: 500,
        });
        if (v.treatment) {
          rows.push({
            date: dateStr,
            description: v.treatment,
            category: "Treatment",
            quantity: 1,
            amount: 0,
          });
        }
      }

      // Add multi-day treatment logs if recorded on visit
      if (v.dayWiseTreatments && Array.isArray(v.dayWiseTreatments)) {
        v.dayWiseTreatments.forEach((dt) => {
          rows.push({
            date: dt.date || dateStr,
            description: `Day ${dt.dayNumber}: ${dt.treatment || "Treatment"} ${dt.notes ? `(${dt.notes})` : ""}`,
            category: "Multi-Day OPD",
            quantity: 1,
            amount: Number(dt.charges) || 0,
          });
        });
      }
    });

    return rows;
  }, [selectedVisits]);

  const financialSummary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalPaid = 0;

    selectedVisits.forEach((v) => {
      if (v.bill) {
        subtotal += Number(v.bill.subtotal || v.bill.totalAmount + (v.bill.discount || 0));
        totalDiscount += Number(v.bill.discount || 0);
        totalPaid += Number(v.bill.paidAmount || 0);
      } else {
        subtotal += 500;
        totalPaid += 0;
      }
    });

    const netPayable = Math.max(0, subtotal - totalDiscount);
    const balanceDue = Math.max(0, netPayable - totalPaid);

    return {
      subtotal,
      totalDiscount,
      netPayable,
      totalPaid,
      balanceDue,
    };
  }, [selectedVisits]);

  // PDF Generation via jsPDF
  const handleDownloadPdf = () => {
    if (selectedVisits.length === 0) {
      toast("Please select at least one visit to generate statement", "error");
      return;
    }

    try {
      const doc = new jsPDF();
      const clinicName = user?.clinicName || settings?.clinicName || "HOSPITAL CLINIC OPD";
      const doctorName = user?.doctorName || settings?.doctorName || "Doctor";
      const address = user?.address || settings?.address || "";
      const phone = user?.phone || settings?.phone || "";

      // Header Banner
      doc.setFillColor(13, 148, 136); // Teal primary
      doc.rect(0, 0, 210, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(clinicName.toUpperCase(), 14, 12);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Dr. ${doctorName} | Consolidated Multi-Day Statement`, 14, 19);
      if (phone) doc.text(`Contact: ${phone} ${address ? `| ${address}` : ""}`, 14, 25);

      // Patient Info Box
      doc.setTextColor(33, 41, 54);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("PATIENT BILLING STATEMENT", 14, 38);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Patient Name: ${patient.name}`, 14, 45);
      doc.text(`Patient ID: ${patient.patientId}`, 14, 51);
      doc.text(`Mobile: ${patient.mobile}`, 14, 57);

      const startDate = selectedVisits[0]?.date ? new Date(selectedVisits[0].date).toLocaleDateString("en-IN") : "-";
      const endDate = selectedVisits[selectedVisits.length - 1]?.date
        ? new Date(selectedVisits[selectedVisits.length - 1].date).toLocaleDateString("en-IN")
        : "-";

      doc.text(`Statement Period: ${startDate} to ${endDate}`, 120, 45);
      doc.text(`Total Visits Included: ${selectedVisits.length}`, 120, 51);
      doc.text(`Generated On: ${new Date().toLocaleDateString("en-IN")}`, 120, 57);

      // Table Header
      let y = 66;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);

      doc.text("Date", 18, y + 5.5);
      doc.text("Service / Procedure Description", 45, y + 5.5);
      doc.text("Category", 125, y + 5.5);
      doc.text("Qty", 155, y + 5.5);
      doc.text("Amount (INR)", 175, y + 5.5);

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);

      breakdownRows.forEach((row, idx) => {
        if (y > 265) {
          doc.addPage();
          y = 20;
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y, 182, 7, "F");
        }

        doc.text(row.date, 18, y + 4.5);
        doc.text(doc.splitTextToSize(row.description, 75)[0], 45, y + 4.5);
        doc.text(row.category, 125, y + 4.5);
        doc.text(String(row.quantity), 158, y + 4.5);
        doc.text(`${row.amount.toFixed(0)}`, 185, y + 4.5, { align: "right" });

        y += 7;
      });

      // Horizontal separator
      y += 4;
      doc.setDrawColor(203, 213, 225);
      doc.line(14, y, 196, y);
      y += 8;

      // Summary Box
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(110, y, 86, 38, 3, 3, "F");

      doc.setFontSize(8.5);
      doc.text("Gross Charges Subtotal:", 116, y + 8);
      doc.text(`INR ${financialSummary.subtotal.toFixed(0)}`, 190, y + 8, { align: "right" });

      doc.text("Total Discounts / Concession:", 116, y + 14);
      doc.text(`- INR ${financialSummary.totalDiscount.toFixed(0)}`, 190, y + 14, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.text("Net Payable Total:", 116, y + 21);
      doc.text(`INR ${financialSummary.netPayable.toFixed(0)}`, 190, y + 21, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.text("Total Payments Received:", 116, y + 27);
      doc.text(`INR ${financialSummary.totalPaid.toFixed(0)}`, 190, y + 27, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(financialSummary.balanceDue > 0 ? 220 : 22, financialSummary.balanceDue > 0 ? 38 : 163, financialSummary.balanceDue > 0 ? 38 : 74);
      doc.text("Net Balance Remaining Due:", 116, y + 34);
      doc.text(`INR ${financialSummary.balanceDue.toFixed(0)}`, 190, y + 34, { align: "right" });

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("This is an electronically generated consolidated hospital OPD statement.", 14, 285);
      doc.text(`Authorized by Dr. ${doctorName}`, 196, 285, { align: "right" });

      const fileName = `${patient.name.replace(/\s+/g, "_")}_Consolidated_Statement.pdf`;
      doc.save(fileName);
      toast("Downloaded Consolidated Multi-Day Statement PDF!", "success");
    } catch (err) {
      toast("Failed to generate PDF statement", "error");
    }
  };

  const handleWhatsAppShare = () => {
    if (selectedVisits.length === 0) return;
    const clinicName = user?.clinicName || settings?.clinicName || "Clinic OPD";
    const doctorName = user?.doctorName || settings?.doctorName || "Doctor";

    const lines = breakdownRows
      .slice(0, 10)
      .map((r) => `• ${r.date}: ${r.description} - ₹${r.amount}`)
      .join("\n");

    const message = `*CONSOLIDATED MULTI-DAY STATEMENT*\n*${clinicName}* (Dr. ${doctorName})\n----------------------------------\n*Patient:* ${patient.name} (${patient.patientId})\n*Period:* ${selectedVisits.length} visits\n\n*Statement Entries:*\n${lines}\n${breakdownRows.length > 10 ? `...and ${breakdownRows.length - 10} more items\n` : ""}----------------------------------\n*Gross Charges:* ₹${financialSummary.subtotal}\n*Total Discount:* -₹${financialSummary.totalDiscount}\n*Net Payable:* ₹${financialSummary.netPayable}\n*Total Paid:* ₹${financialSummary.totalPaid}\n*Balance Due:* ₹${financialSummary.balanceDue}\n----------------------------------\nThank you!`;

    const phone = patient.mobile.replace(/\D/g, "");
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`, "_blank");
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
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          style={{
            background: "var(--surface-solid)",
            color: "var(--text-primary)",
            borderRadius: 16,
            maxWidth: 820,
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(13, 148, 136, 0.12)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Receipt size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Consolidated Multi-Day Bill</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {patient.name} ({patient.mobile}) · {visits.length} OPD visits recorded
                </div>
              </div>
            </div>
            <button type="button" className="btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Visit selector bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Select Visits to Include in Statement:</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={toggleSelectAll}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {selectedVisitIds.size === visits.length ? (
                    <>
                      <CheckSquare size={13} /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square size={13} /> Select All ({visits.length})
                    </>
                  )}
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {visits.map((v) => {
                  const isSelected = selectedVisitIds.has(String(v.id));
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => toggleVisit(String(v.id))}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: "0.8rem",
                        border: isSelected ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(13, 148, 136, 0.08)" : "var(--surface-1)",
                        color: isSelected ? "var(--primary)" : "var(--text-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      <span>
                        {new Date(v.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      {v.bill ? (
                        <span style={{ fontSize: "0.72rem", opacity: 0.85 }}>₹{v.bill.totalAmount}</span>
                      ) : (
                        <span style={{ fontSize: "0.72rem", opacity: 0.85 }}>OPD</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date-wise Itemized Table */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "10px 14px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Date-Wise Billing & Treatment Entries ({breakdownRows.length})</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                  {selectedVisits.length} visits selected
                </span>
              </div>

              {breakdownRows.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No visit selected. Please check at least one visit above.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)" }}>
                      <th style={{ padding: "8px 12px" }}>Date</th>
                      <th style={{ padding: "8px 12px" }}>Description</th>
                      <th style={{ padding: "8px 12px" }}>Category</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 50 }}>Qty</th>
                      <th style={{ padding: "8px 12px", textAlign: "right" }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{row.date}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 500 }}>{row.description}</td>
                        <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "0.78rem" }}>{row.category}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>{row.quantity}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>₹{row.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Consolidated Breakdown Card */}
            <div
              style={{
                background: "var(--surface-1)",
                borderRadius: 12,
                padding: "16px 20px",
                border: "1px solid var(--border)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 14,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Gross Charges</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: 2 }}>₹{financialSummary.subtotal}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Discounts</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#16a34a", marginTop: 2 }}>-₹{financialSummary.totalDiscount}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Net Payable</div>
                <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--primary)", marginTop: 2 }}>₹{financialSummary.netPayable}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Paid</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#16a34a", marginTop: 2 }}>₹{financialSummary.totalPaid}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Balance Due</div>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: financialSummary.balanceDue > 0 ? "#ef4444" : "#16a34a", marginTop: 2 }}>
                  ₹{financialSummary.balanceDue}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleWhatsAppShare}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#25D366", color: "#fff", border: "none" }}
              >
                <Share2 size={15} /> WhatsApp Statement
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={15} /> Download PDF Bill
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
