"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  ArrowUpDown,
  Download,
  Receipt,
  User,
  Phone,
  Calendar,
  Clock,
  Bed,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import type { UnifiedEncounter } from "@/lib/utils/analyticsAggregations";
import RecordPaymentModal from "@/components/RecordPaymentModal";

export interface AnalyticsDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  encounters: UnifiedEncounter[];
  badgeColor?: string;
  onRefreshData?: () => void;
}

type SortField = "date-desc" | "date-asc" | "due-desc" | "due-asc" | "billed-desc" | "name-asc";

export default function AnalyticsDrilldownModal({
  isOpen,
  onClose,
  title,
  subtitle,
  encounters,
  badgeColor = "var(--primary)",
  onRefreshData,
}: AnalyticsDrilldownModalProps) {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "WITH_DUES" | "SETTLED">("ALL");
  const [sortField, setSortField] = useState<SortField>("date-desc");

  // Record payment sub-modal state
  const [paymentTarget, setPaymentTarget] = useState<UnifiedEncounter | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setSearch("");
      setStatusFilter("ALL");
      setSortField("date-desc");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Filtered & Sorted encounters
  const displayedEncounters = useMemo(() => {
    let result = [...encounters];

    // Status filter
    if (statusFilter === "WITH_DUES") {
      result = result.filter((e) => e.balanceDue > 0);
    } else if (statusFilter === "SETTLED") {
      result = result.filter((e) => e.balanceDue <= 0 && e.paidAmount > 0);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.patientName.toLowerCase().includes(q) ||
          (e.patientMobile || "").includes(q) ||
          (e.diagnosis || "").toLowerCase().includes(q) ||
          (e.category || "").toLowerCase().includes(q) ||
          (e.bedOrRoom || "").toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortField === "date-desc") return b.date.localeCompare(a.date);
      if (sortField === "date-asc") return a.date.localeCompare(b.date);
      if (sortField === "due-desc") return b.balanceDue - a.balanceDue;
      if (sortField === "due-asc") return a.balanceDue - b.balanceDue;
      if (sortField === "billed-desc") return b.billedAmount - a.billedAmount;
      if (sortField === "name-asc") return a.patientName.localeCompare(b.patientName);
      return 0;
    });

    return result;
  }, [encounters, search, statusFilter, sortField]);

  // Summary Metrics of the slice
  const summary = useMemo(() => {
    const totalBilled = displayedEncounters.reduce((s, e) => s + e.billedAmount, 0);
    const totalCollected = displayedEncounters.reduce((s, e) => s + e.paidAmount, 0);
    const totalDues = displayedEncounters.reduce((s, e) => s + e.balanceDue, 0);
    return {
      count: displayedEncounters.length,
      totalBilled,
      totalCollected,
      totalDues,
    };
  }, [displayedEncounters]);

  // Export slice to CSV
  const handleExportCSV = () => {
    if (displayedEncounters.length === 0) return;
    const headers = [
      "Type",
      "Category",
      "Date",
      "Patient Name",
      "Age",
      "Gender",
      "Mobile",
      "Diagnosis",
      "Bed / Room",
      "Billed (Rs)",
      "Paid (Rs)",
      "Balance Due (Rs)",
    ];

    const rows = displayedEncounters.map((e) => [
      e.type,
      e.category,
      new Date(e.date).toLocaleString("en-IN"),
      `"${e.patientName}"`,
      e.patientAge || "",
      e.patientGender || "",
      e.patientMobile || "",
      `"${e.diagnosis || ""}"`,
      e.bedOrRoom || "",
      e.billedAmount,
      e.paidAmount,
      e.balanceDue,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Analytics_Drilldown_${title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.76)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 10px",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.2 }}
          style={{
            background: "var(--surface-solid, #151824)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 18,
            width: "100%",
            maxWidth: 1040,
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px rgba(0, 0, 0, 0.55)",
            overflow: "hidden",
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "rgba(255, 255, 255, 0.03)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200, flex: 1 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: badgeColor,
                  flexShrink: 0,
                  boxShadow: `0 0 10px ${badgeColor}`,
                }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "1.08rem",
                    color: "var(--text-primary)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </div>
                {subtitle && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleExportCSV}
                title="Export this drill-down list to CSV"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px" }}
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                style={{ borderRadius: "50%", padding: 6 }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
              gap: 10,
              padding: "12px 20px",
              background: "rgba(255, 255, 255, 0.02)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                MATCHING PATIENTS
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {summary.count} Encounters
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                TOTAL BILLED
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
                ₹{summary.totalBilled.toLocaleString("en-IN")}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                COLLECTED REVENUE
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981" }}>
                ₹{summary.totalCollected.toLocaleString("en-IN")}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>
                PENDING DUES
              </span>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: summary.totalDues > 0 ? "#f59e0b" : "var(--text-secondary)",
                }}
              >
                ₹{summary.totalDues.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {/* Search Box */}
            <div style={{ position: "relative", minWidth: 220, flex: 1, maxWidth: 360 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                className="form-input form-input-sm"
                placeholder="Search patient, mobile, diagnosis, bed…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30, width: "100%" }}
              />
            </div>

            {/* Status Pills & Sort Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", background: "rgba(255, 255, 255, 0.04)", borderRadius: 8, padding: 2, border: "1px solid var(--border)" }}>
                <button
                  type="button"
                  className={`btn btn-xs ${statusFilter === "ALL" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setStatusFilter("ALL")}
                >
                  All ({encounters.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${statusFilter === "WITH_DUES" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setStatusFilter("WITH_DUES")}
                >
                  Has Dues
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${statusFilter === "SETTLED" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setStatusFilter("SETTLED")}
                >
                  Settled
                </button>
              </div>

              {/* Sorting */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowUpDown size={14} style={{ color: "var(--text-muted)" }} />
                <select
                  className="form-select form-select-sm"
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  style={{ width: "auto" }}
                >
                  <option value="date-desc">Date (Newest First)</option>
                  <option value="date-asc">Date (Oldest First)</option>
                  <option value="due-desc">Balance Due (Highest)</option>
                  <option value="due-asc">Balance Due (Lowest)</option>
                  <option value="billed-desc">Billed Amount (Highest)</option>
                  <option value="name-asc">Patient Name (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Encounters Table View (Responsive Horizontally Scrollable) */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
            {displayedEncounters.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 16px",
                  color: "var(--text-muted)",
                }}
              >
                <AlertCircle size={36} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                  No encounters match your search criteria
                </div>
                <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                  Try adjusting your search query or status filter.
                </div>
              </div>
            ) : (
              <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table className="table" style={{ marginTop: 8, minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: 160 }}>Patient Name &amp; Contact</th>
                      <th style={{ minWidth: 100 }}>Category</th>
                      <th style={{ minWidth: 110 }}>Date &amp; Time</th>
                      <th style={{ minWidth: 130 }}>Diagnosis / Bed</th>
                      <th style={{ minWidth: 150, textAlign: "right" }}>Financials (Billed / Paid / Due)</th>
                      <th style={{ minWidth: 110, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedEncounters.map((enc) => {
                      const hasDues = enc.balanceDue > 0;
                      return (
                        <tr key={`${enc.type}-${enc.id}`}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  background: enc.type === "IPD" ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                                  color: enc.type === "IPD" ? "#10b981" : "var(--primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: "0.82rem",
                                  flexShrink: 0,
                                }}
                              >
                                {enc.patientName.charAt(0)}
                              </div>
                              <div>
                                <Link
                                  href={`/patients/${enc.patientId}`}
                                  onClick={onClose}
                                  style={{
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  {enc.patientName}
                                  <ExternalLink size={11} style={{ opacity: 0.6 }} />
                                </Link>
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                  {enc.patientAge ? `${enc.patientAge}y · ` : ""}
                                  {enc.patientGender ? `${enc.patientGender} · ` : ""}
                                  {enc.patientMobile || "No mobile"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`badge ${
                                enc.category.toUpperCase() === "EMERGENCY"
                                  ? "badge-red"
                                  : enc.category.toUpperCase() === "IPD"
                                  ? "badge-green"
                                  : enc.category.toUpperCase() === "OPD"
                                  ? "badge-blue"
                                  : "badge-teal"
                              }`}
                              style={{ fontWeight: 700, fontSize: "0.72rem" }}
                            >
                              {enc.category}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                              {new Date(enc.date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              {new Date(enc.date).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>

                          <td>
                            <div style={{ fontSize: "0.82rem", maxWidth: 170, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {enc.diagnosis || enc.status || "—"}
                            </div>
                            {enc.bedOrRoom && (
                              <div style={{ fontSize: "0.72rem", color: "#10b981", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                                <Bed size={12} /> {enc.bedOrRoom}
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                              ₹{enc.billedAmount.toLocaleString("en-IN")}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#10b981" }}>
                              Paid: ₹{enc.paidAmount.toLocaleString("en-IN")}
                            </div>
                            {hasDues ? (
                              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f59e0b" }}>
                                Due: ₹{enc.balanceDue.toLocaleString("en-IN")}
                              </div>
                            ) : (
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                Settled ✓
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              {hasDues && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-primary"
                                  onClick={() => setPaymentTarget(enc)}
                                  title="Record payment for this patient"
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <Receipt size={12} /> Settle
                                </button>
                              )}

                              {hasDues && enc.patientMobile && (
                                <a
                                  href={`https://wa.me/91${enc.patientMobile.replace(/\D/g, "")}?text=${encodeURIComponent(
                                    `Dear ${enc.patientName}, your remaining balance of ₹${enc.balanceDue} for visit on ${new Date(
                                      enc.date
                                    ).toLocaleDateString("en-IN")} is pending. Kindly clear your dues at your convenience.`
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-xs btn-ghost"
                                  title="Send WhatsApp Payment Reminder"
                                  style={{ color: "#22c55e" }}
                                >
                                  <MessageCircle size={14} />
                                </a>
                              )}

                              <Link
                                href={`/patients/${enc.patientId}`}
                                onClick={onClose}
                                className="btn btn-xs btn-ghost"
                                title="Open Patient Profile"
                              >
                                <User size={13} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Record Payment Sub-Modal */}
      {paymentTarget && (
        <RecordPaymentModal
          isOpen={!!paymentTarget}
          onClose={() => setPaymentTarget(null)}
          billId={paymentTarget.rawVisit?.bill?.id || paymentTarget.id}
          billNumber={paymentTarget.rawVisit?.bill?.billNumber || `BILL-${paymentTarget.id.slice(-6)}`}
          patientName={paymentTarget.patientName}
          balanceDue={paymentTarget.balanceDue}
          totalAmount={paymentTarget.billedAmount}
          paidAmount={paymentTarget.paidAmount}
          onSuccess={() => {
            setPaymentTarget(null);
            if (onRefreshData) onRefreshData();
          }}
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
