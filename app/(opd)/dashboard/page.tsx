"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Calendar,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Activity,
  CheckCircle2,
  Plus,
  Receipt,
  Wallet,
  Banknote,
  Printer,
  X,
  AlertCircle,
  RefreshCw,
  Bed,
  Sparkles,
  Edit2,
  Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useDashboardStats,
  useVisitMutations,
  usePendingDues,
  useIpdAdmissions,
  useSettings,
  useReports,
} from "@/lib/hooks/useQueries";
import { useAuth } from "@/lib/hooks/useAuth";
import PageTransition from "@/components/PageTransition";
import LoadingScreen from "@/components/LoadingScreen";
import ErrorState from "@/components/ErrorState";
import RecordPaymentModal from "@/components/RecordPaymentModal";
import CreateBillModal from "@/components/CreateBillModal";
import IpdDayLogModal from "@/components/IpdDayLogModal";
import IpdDischargeModal from "@/components/IpdDischargeModal";
import IpdPatientJourneyModal from "@/components/IpdPatientJourneyModal";
import type { Patient, Visit, IpdAdmission } from "@/lib/providers/types";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: settings } = useSettings();

  const {
    data: stats,
    isLoading: loading,
    error,
    refetch: refetchStats,
  } = useDashboardStats();

  const { data: pendingDuesData, refetch: refetchDues } = usePendingDues();
  const { data: allIpdAdmissions = [], refetch: refetchIpd } = useIpdAdmissions();
  const { updateFollowUpStatus } = useVisitMutations();

  // Month-to-Date (MTD) Range & Query
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const monthStartISO = useMemo(
    () => `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`,
    [currentYear, currentMonth]
  );
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthName = useMemo(
    () => now.toLocaleDateString("en-IN", { month: "long" }),
    [now]
  );

  // Fetch month visits for total month earnings calculation
  const { data: monthVisitPage } = useReports(monthStartISO, todayISO);
  const monthVisits = monthVisitPage?.data ?? [];

  // Filter State
  const [opdFilter, setOpdFilter] = useState<"ALL" | "PAID" | "DUES" | "UNBILLED">("ALL");

  // Modals state
  const [billingVisit, setBillingVisit] = useState<{
    visit: Visit;
    patient: Patient;
  } | null>(null);

  const [activePaymentModal, setActivePaymentModal] = useState<{
    billId: string;
    billNumber: string;
    patientName: string;
    balanceDue: number;
    totalAmount?: number;
    paidAmount?: number;
  } | null>(null);

  const [rescheduleTarget, setRescheduleTarget] = useState<{
    visitId: string;
    patientName: string;
    currentDate?: string;
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");

  const [activeIpdModal, setActiveIpdModal] = useState<IpdAdmission | null>(null);
  const [dashboardDischargeTarget, setDashboardDischargeTarget] = useState<IpdAdmission | null>(null);
  const [journeyAdmission, setJourneyAdmission] = useState<IpdAdmission | null>(null);

  // Financial Summary from Backend
  const fin = useMemo(() => {
    return (
      stats?.financialSummary || {
        todayBilled: 0,
        todayCollected: 0,
        totalPendingDues: pendingDuesData?.summary?.totalDuesToCollect || 0,
        patientsWithDuesCount: pendingDuesData?.summary?.totalPatientsWithDues || 0,
      }
    );
  }, [stats?.financialSummary, pendingDuesData?.summary]);

  // Month-to-Date (MTD) Earnings Calculation
  const monthToDateEarnings = useMemo(() => {
    let opdPaid = 0;
    (monthVisits || []).forEach((v) => {
      if (v.bill?.paidAmount) {
        opdPaid += Number(v.bill.paidAmount) || 0;
      }
    });

    let ipdPaid = 0;
    (allIpdAdmissions || []).forEach((adm) => {
      const admDate = (adm.admissionDate || adm.createdAt || "").slice(0, 10);
      const disDate = adm.dischargeDate ? adm.dischargeDate.slice(0, 10) : null;
      if (admDate >= monthStartISO || (disDate && disDate >= monthStartISO)) {
        ipdPaid += Number(adm.totalPaid) || 0;
      }
    });

    const totalCalculated = opdPaid + ipdPaid;
    return Math.max(totalCalculated, fin.todayCollected || 0);
  }, [monthVisits, allIpdAdmissions, monthStartISO, fin.todayCollected]);

  // Today's IPD Live Census
  const ipdStats = useMemo(() => {
    const activeInpatients = allIpdAdmissions.filter((a) => a.status === "ADMITTED");
    const todayAdmissions = allIpdAdmissions.filter(
      (a) => (a.admissionDate || a.createdAt || "").slice(0, 10) === todayISO
    );
    const todayDischarges = allIpdAdmissions.filter(
      (a) => a.status === "DISCHARGED" && a.dischargeDate?.slice(0, 10) === todayISO
    );

    let completedRoundsCount = 0;
    let pendingRoundsCount = 0;

    const inpatientsWithRoundStatus = activeInpatients.map((admission) => {
      const logs = admission.dayWiseLogs || [];
      const todayLog = logs.find((l) => l.date === todayISO);
      const hasRoundToday = Boolean(todayLog);
      if (hasRoundToday) completedRoundsCount++;
      else pendingRoundsCount++;

      const stayDays = Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(admission.admissionDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      return {
        admission,
        hasRoundToday,
        todayLog,
        stayDays,
      };
    });

    const totalBeds = (settings?.ipdRooms || []).reduce(
      (acc, r) => acc + (r.beds || []).length,
      0
    );
    const occupiedBeds = activeInpatients.length;
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const occupancyPercent =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      activeInpatients,
      inpatientsWithRoundStatus,
      todayAdmissions,
      todayDischarges,
      completedRoundsCount,
      pendingRoundsCount,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyPercent,
    };
  }, [allIpdAdmissions, settings?.ipdRooms, todayISO]);

  // Follow-up status update
  const handleStatusChange = async (
    visitId: string,
    status: "ATTENDED" | "NOT_ATTENDED" | "RESCHEDULED",
    newDate?: string
  ) => {
    try {
      await updateFollowUpStatus.mutateAsync({
        id: visitId,
        status,
        newDate,
      });
      await refetchStats();
      if (status === "ATTENDED") toast("Marked follow-up as attended!", "success");
      else if (status === "NOT_ATTENDED") toast("Marked as Did Not Come", "info");
      else if (status === "RESCHEDULED") toast(`Rescheduled follow-up to ${newDate}`, "success");
    } catch (err) {
      toast(getErrorMessage(err, "Failed to update follow-up status"), "error");
    }
  };

  const openRescheduleModal = (
    visitId: string,
    patientName: string,
    currentDate?: string
  ) => {
    const defaultNext = new Date();
    defaultNext.setDate(defaultNext.getDate() + 7);
    setRescheduleTarget({
      visitId,
      patientName,
      currentDate,
    });
    setRescheduleDate(defaultNext.toISOString().slice(0, 10));
  };

  if (loading || !stats) return <LoadingScreen message="Loading clinic command center…" />;
  if (error) return <ErrorState message="Could not load your dashboard stats." />;

  const s = stats;
  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Today's OPD Visits List
  const todayVisitsList =
    s.todayVisits && s.todayVisits.length > 0
      ? s.todayVisits
      : (s.recentVisits || []).filter((item) => {
          if (!item.visit?.date) return false;
          return (
            new Date(item.visit.date).toDateString() === new Date().toDateString()
          );
        });

  // Filtered OPD Visits
  const filteredTodayVisits = todayVisitsList.filter(({ visit }) => {
    const bill = visit.bill;
    if (opdFilter === "PAID") return bill && (bill.paymentStatus === "PAID" || Number(bill.balanceDue) === 0);
    if (opdFilter === "DUES") return bill && Number(bill.balanceDue) > 0;
    if (opdFilter === "UNBILLED") return !bill || visit.billingStatus !== "BILLED";
    return true;
  });

  // Doctor greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const doctorName = user?.doctorName || settings?.doctorName || "Doctor";

  return (
    <PageTransition>
      {/* ─── Hero & Practice Command Header ─── */}
      <div
        className="page-header"
        style={{
          marginBottom: 20,
          background: "var(--surface-card, #ffffff)",
          padding: "18px 22px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {greeting}, Dr. {doctorName}
            </span>
            <span
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 8,
              }}
            >
              CLINIC LIVE
            </span>
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
            {todayFormatted} · Practice revenue, inpatient census &amp; patient consultations
          </div>
        </div>

        <div className="flex-wrap-header-actions" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              refetchStats();
              refetchDues();
              refetchIpd();
              toast("Dashboard refreshed", "info");
            }}
            title="Refresh Live Data"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <Link href="/patients/new" className="btn btn-secondary btn-sm">
            <UserPlus size={14} /> Register Patient
          </Link>
          <Link href="/visits/new" className="btn btn-primary btn-sm">
            <Plus size={14} /> New Visit
          </Link>
          <Link
            href="/visits/new?category=IPD"
            className="btn btn-secondary btn-sm"
            style={{ color: "#8b5cf6", borderColor: "rgba(139, 92, 246, 0.35)" }}
          >
            <Bed size={14} /> Admit to IPD
          </Link>
        </div>
      </div>

      {/* ─── Elevated Practice Revenue & Clinical KPI Grid (6 Top Cards) ─── */}
      <motion.div
        className="dashboard-kpi-grid"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Card 1: Month-to-Date Total Earnings (Highlighted Primary Revenue) */}
        <Link
          href="/reports"
          className="kpi-card kpi-card-revenue-mtd"
          style={{ "--kpi-accent": "#10b981", "--kpi-bg": "rgba(16, 185, 129, 0.15)" } as React.CSSProperties}
          title="View detailed financial reports for this month"
        >
          <div className="kpi-header">
            <span
              className="kpi-tag"
              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}
            >
              MTD EARNINGS
            </span>
            <div className="kpi-icon-wrap">
              <TrendingUp size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: "#10b981" }}>
              ₹{monthToDateEarnings.toLocaleString("en-IN")}
            </div>
            <div className="kpi-label">Total Earning This Month</div>
            <div className="kpi-sub">
              Till today · {monthName} {currentYear}
            </div>
          </div>
        </Link>

        {/* Card 2: Today's Total Collections */}
        <div
          className="kpi-card kpi-card-revenue-today"
          style={{ "--kpi-accent": "#059669", "--kpi-bg": "rgba(5, 150, 105, 0.12)" } as React.CSSProperties}
        >
          <div className="kpi-header">
            <span
              className="kpi-tag"
              style={{ background: "rgba(5, 150, 105, 0.15)", color: "#059669" }}
            >
              TODAY INFLOW
            </span>
            <div className="kpi-icon-wrap">
              <Banknote size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: "#059669" }}>
              ₹{fin.todayCollected.toLocaleString("en-IN")}
            </div>
            <div className="kpi-label">Today Collected</div>
            <div className="kpi-sub">
              Billed: ₹{fin.todayBilled.toLocaleString("en-IN")} today
            </div>
          </div>
        </div>

        {/* Card 3: Outstanding Balance Dues */}
        <div
          className="kpi-card kpi-card-dues"
          style={{ "--kpi-accent": "#ef4444", "--kpi-bg": "rgba(239, 68, 68, 0.12)", cursor: "pointer" } as React.CSSProperties}
          onClick={() => router.push("/followup?tab=payments")}
          title="Click to view pending patient dues register"
        >
          <div className="kpi-header">
            <span
              className="kpi-tag"
              style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
            >
              OUTSTANDING
            </span>
            <div className="kpi-icon-wrap">
              <Wallet size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: "#ef4444" }}>
              ₹{fin.totalPendingDues.toLocaleString("en-IN")}
            </div>
            <div className="kpi-label">Pending Dues</div>
            <div className="kpi-sub">
              {fin.patientsWithDuesCount} patients with dues · Click to collect
            </div>
          </div>
        </div>

        {/* Card 4: Today's OPD Consultations */}
        <div
          className="kpi-card"
          style={{ "--kpi-accent": "var(--accent)", "--kpi-bg": "var(--accent-glow)", cursor: "pointer" } as React.CSSProperties}
          onClick={() => {
            const el = document.getElementById("opd-queue-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          title="Click to view today's OPD consultation queue"
        >
          <div className="kpi-header">
            <span
              className="kpi-tag"
              style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
            >
              OUTPATIENT
            </span>
            <div className="kpi-icon-wrap">
              <Activity size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: "var(--accent)" }}>
              {s.todayTotal}
            </div>
            <div className="kpi-label">Today's OPD Visits</div>
            <div className="kpi-sub">
              {s.todayNew} new · {s.todayReturning} returning
            </div>
          </div>
        </div>

        {/* Card 5: Inpatient (IPD) Live Census */}
        <div
          className="kpi-card kpi-card-ipd"
          style={{ "--kpi-accent": "#8b5cf6", "--kpi-bg": "rgba(139, 92, 246, 0.12)", cursor: "pointer" } as React.CSSProperties}
          onClick={() => router.push("/ipd")}
          title="Click to view IPD ward bed grid"
        >
          <div className="kpi-header">
            <span
              className="kpi-tag"
              style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}
            >
              INPATIENT CARE
            </span>
            <div className="kpi-icon-wrap">
              <Bed size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: "#8b5cf6" }}>
              {ipdStats.occupiedBeds} Beds
            </div>
            <div className="kpi-label">Today's IPD Patients</div>
            <div className="kpi-sub">
              {ipdStats.pendingRoundsCount > 0
                ? `⚠️ ${ipdStats.pendingRoundsCount} rounds pending`
                : "✅ All rounds charted"}{" "}
              · {ipdStats.vacantBeds} vacant
            </div>
          </div>
        </div>

        {/* Card 6: Today's Follow-up Appointments */}
        <div
          className="kpi-card"
          style={{ "--kpi-accent": "#f59e0b", "--kpi-bg": "rgba(245, 158, 11, 0.12)", cursor: "pointer" } as React.CSSProperties}
          onClick={() => router.push("/followup")}
          title="Click to view scheduled follow-up appointments"
        >
          <div className="kpi-header">
            <span
              className="kpi-tag"
              style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}
            >
              FOLLOW-UPS
            </span>
            <div className="kpi-icon-wrap">
              <Calendar size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: "#f59e0b" }}>
              {s.followUpsToday}
            </div>
            <div className="kpi-label">Follow-ups Today</div>
            <div className="kpi-sub">
              {s.upcomingFollowUps} upcoming in next 7 days
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── WORKSPACE (Unified Responsive Clinical Hub) ─── */}
      <div className="dashboard-main-grid">
          {/* Left Column: Today's OPD Consultations Queue */}
          <div
            id="opd-queue-section"
            className="card"
            style={{
              padding: 20,
              background: "var(--surface-card, #ffffff)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
                  <Stethoscope size={18} style={{ color: "var(--accent)" }} />
                  <span>Today's OPD Consultations</span>
                  <span className="badge badge-blue" style={{ fontSize: "0.72rem" }}>
                    {todayVisitsList.length} patients
                  </span>
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Outpatient consultations &amp; clinical charting for today
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {/* Filter Pills */}
                <div
                  style={{
                    display: "inline-flex",
                    background: "var(--surface-2)",
                    padding: 2,
                    borderRadius: 8,
                    gap: 2,
                  }}
                >
                  {(["ALL", "PAID", "DUES", "UNBILLED"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      style={{
                        padding: "3px 8px",
                        fontSize: "0.72rem",
                        fontWeight: opdFilter === filter ? 700 : 500,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background: opdFilter === filter ? "var(--accent)" : "transparent",
                        color: opdFilter === filter ? "#ffffff" : "var(--text-secondary)",
                      }}
                      onClick={() => setOpdFilter(filter)}
                    >
                      {filter === "ALL"
                        ? "All"
                        : filter === "PAID"
                        ? "Paid"
                        : filter === "DUES"
                        ? "With Dues"
                        : "Unbilled"}
                    </button>
                  ))}
                </div>

                <Link href="/visits/new" className="btn btn-primary btn-xs" style={{ whiteSpace: "nowrap" }}>
                  <Plus size={12} /> New Visit
                </Link>
              </div>
            </div>

            {/* OPD Patient Cards List */}
            {filteredTodayVisits.length === 0 ? (
              <div className="empty-state" style={{ padding: "36px 12px" }}>
                <Stethoscope size={32} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
                <h4 style={{ margin: "4px 0" }}>No OPD Consultations in this View</h4>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {todayVisitsList.length === 0
                    ? "Your outpatient clinic queue is clear. Click below to begin a consultation."
                    : "No visits matched the selected filter."}
                </p>
                <div style={{ marginTop: 12 }}>
                  <Link href="/visits/new" className="btn btn-primary btn-sm">
                    <Plus size={14} /> Start Consultation
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredTodayVisits.map(({ visit, patient }) => {
                  const bill = visit.bill;
                  const hasDues = bill && Number(bill.balanceDue) > 0;
                  return (
                    <div key={visit.id} className="patient-queue-item">
                      <div className="patient-queue-info">
                        <div
                          className="followup-avatar"
                          style={{
                            width: 38,
                            height: 38,
                            fontSize: "0.92rem",
                            background: "var(--accent-glow)",
                            color: "var(--accent-light)",
                          }}
                        >
                          {patient?.name?.charAt(0)?.toUpperCase() || "P"}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Link
                              href={`/patients/${visit.patientId}`}
                              style={{
                                fontWeight: 700,
                                fontSize: "0.92rem",
                                color: "var(--text-primary)",
                                textDecoration: "none",
                              }}
                            >
                              {patient?.name || "Patient"}
                            </Link>
                            {patient?.age && (
                              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                                ({patient.age}y / {patient.gender})
                              </span>
                            )}
                            <span className="badge badge-blue" style={{ fontSize: "0.68rem" }}>
                              OPD
                            </span>
                          </div>

                          <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2 }}>
                            {patient?.mobile}
                            {visit.diagnosis ? ` · Dx: ${visit.diagnosis}` : ""}
                          </div>

                          {/* Vitals Strip */}
                          {(visit.bp || visit.pulse || visit.temp || visit.spo2) && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                              {visit.bp && <span className="badge badge-red" style={{ fontSize: "0.68rem" }}>BP: {visit.bp}</span>}
                              {visit.pulse && <span className="badge badge-blue" style={{ fontSize: "0.68rem" }}>P: {visit.pulse}</span>}
                              {visit.temp && <span className="badge badge-amber" style={{ fontSize: "0.68rem" }}>{visit.temp}°F</span>}
                              {visit.spo2 && <span className="badge badge-green" style={{ fontSize: "0.68rem" }}>SpO2: {visit.spo2}%</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Billing Badge & Actions */}
                      <div className="patient-queue-actions">
                        {bill ? (
                          hasDues ? (
                            <span className="badge badge-red" style={{ fontSize: "0.72rem" }}>
                              Due ₹{bill.balanceDue}
                            </span>
                          ) : (
                            <span className="badge badge-green" style={{ fontSize: "0.72rem" }}>
                              Paid ₹{bill.paidAmount}
                            </span>
                          )
                        ) : (
                          <span className="badge badge-amber" style={{ fontSize: "0.72rem" }}>
                            Unbilled
                          </span>
                        )}

                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          <Link
                            href={`/visits/${visit.id}/print`}
                            className="btn btn-ghost btn-xs"
                            title="Print Rx / Bill"
                          >
                            <Printer size={13} />
                          </Link>
                          <Link
                            href={`/visits/${visit.id}/edit`}
                            className="btn btn-secondary btn-xs"
                            title="Edit Consultation"
                          >
                            <Edit2 size={12} />
                          </Link>
                          {hasDues && (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() =>
                                setActivePaymentModal({
                                  billId: bill.id,
                                  billNumber: bill.billNumber,
                                  patientName: patient?.name || "Patient",
                                  balanceDue: Number(bill.balanceDue),
                                  totalAmount: Number(bill.totalAmount),
                                  paidAmount: Number(bill.paidAmount),
                                })
                              }
                            >
                              Settle Due
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Inpatient Ward Census on Top + Today's Follow-ups / Dues */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Dedicated Inpatient (IPD) Bed Census & Rounds Hub */}
            <div
              className="card"
              style={{
                padding: 18,
                background: "var(--surface-card, #ffffff)",
                border: "1.5px solid rgba(139, 92, 246, 0.3)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.98rem", display: "flex", alignItems: "center", gap: 7 }}>
                    <Bed size={17} style={{ color: "#8b5cf6" }} />
                    <span>Inpatient (IPD) Ward Beds</span>
                    <span
                      style={{
                        background: "rgba(139, 92, 246, 0.15)",
                        color: "#8b5cf6",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 6,
                      }}
                    >
                      {ipdStats.occupiedBeds} / {ipdStats.totalBeds} Occupied
                    </span>
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {ipdStats.pendingRoundsCount > 0
                      ? `⚠️ ${ipdStats.pendingRoundsCount} doctor rounds pending today`
                      : "✅ All active inpatient rounds charted"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <Link
                    href="/visits/new?category=IPD"
                    className="btn btn-primary btn-xs"
                    style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
                  >
                    <Plus size={12} /> Admit
                  </Link>
                  <Link href="/ipd" className="btn btn-ghost btn-xs">
                    Wards →
                  </Link>
                </div>
              </div>

              {/* Inpatients Cards */}
              {ipdStats.activeInpatients.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 12px",
                    background: "var(--surface-1)",
                    borderRadius: 10,
                    border: "1px dashed var(--border)",
                  }}
                >
                  <Bed size={24} style={{ color: "var(--text-muted)", margin: "0 auto 6px" }} />
                  <div style={{ fontSize: "0.86rem", fontWeight: 700 }}>All Ward Beds Available</div>
                  <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", margin: "4px 0 10px" }}>
                    There are no admitted inpatients in the ward right now.
                  </p>
                  <Link
                    href="/visits/new?category=IPD"
                    className="btn btn-primary btn-xs"
                    style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
                  >
                    <Plus size={12} /> Admit Patient to Bed
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ipdStats.inpatientsWithRoundStatus.slice(0, 3).map(({ admission: adm, hasRoundToday, stayDays }) => (
                    <div
                      key={adm.id}
                      style={{
                        background: "var(--surface-1)",
                        border: hasRoundToday
                          ? "1px solid var(--border)"
                          : "1.5px solid rgba(245, 158, 11, 0.45)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                background: "rgba(139, 92, 246, 0.15)",
                                color: "#8b5cf6",
                                padding: "2px 6px",
                                borderRadius: 5,
                                fontSize: "0.7rem",
                                fontWeight: 800,
                              }}
                            >
                              {adm.bedOrRoom}
                            </span>
                            <Link
                              href={`/patients/${adm.patientId}`}
                              style={{
                                fontWeight: 700,
                                fontSize: "0.88rem",
                                color: "var(--text-primary)",
                                textDecoration: "none",
                              }}
                            >
                              {adm.patient?.name || "Patient"}
                            </Link>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              (Day {stayDays})
                            </span>
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                            Dx: {adm.diagnosis || "Inpatient Care"}
                            {adm.attendingDoctor ? ` · Dr. ${adm.attendingDoctor}` : ""}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            color: hasRoundToday ? "#10b981" : "#f59e0b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          {hasRoundToday ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                          {hasRoundToday ? "Round Done" : "Round Pending"}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 6,
                          borderTop: "1px dashed var(--border)",
                          paddingTop: 8,
                        }}
                      >
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          Due: <strong style={{ color: Number(adm.balanceDue) > 0 ? "#ef4444" : "#10b981" }}>₹{adm.balanceDue}</strong>
                        </span>

                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setJourneyAdmission(adm)}
                            style={{
                              color: "#8b5cf6",
                              borderColor: "rgba(139, 92, 246, 0.4)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                            title="Interactive Bedside Journey"
                          >
                            <Sparkles size={11} /> Journey
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${hasRoundToday ? "btn-secondary" : "btn-primary"}`}
                            onClick={() => setActiveIpdModal(adm)}
                            style={hasRoundToday ? {} : { background: "#10b981", borderColor: "#10b981" }}
                          >
                            <Stethoscope size={11} /> {hasRoundToday ? "View" : "Round"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setDashboardDischargeTarget(adm)}
                          >
                            Discharge
                          </button>
                          <Link
                            href={`/ipd/${adm.id}/print`}
                            className="btn btn-ghost btn-xs"
                            title="Print Sheet"
                            style={{ padding: "3px 6px" }}
                          >
                            <Printer size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                  {ipdStats.activeInpatients.length > 3 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => router.push("/ipd")}
                      style={{ color: "#8b5cf6" }}
                    >
                      View all {ipdStats.activeInpatients.length} admitted inpatients →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Today's Follow-ups Widget */}
            <div
              className="card"
              style={{
                padding: 18,
                background: "var(--surface-card, #ffffff)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 7 }}>
                  <Calendar size={17} style={{ color: "#f59e0b" }} />
                  <span>Today's Follow-ups</span>
                  <span className="badge badge-amber" style={{ fontSize: "0.7rem" }}>
                    {s.todayFollowUpList.length}
                  </span>
                </div>
                <Link
                  href="/followup"
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    textDecoration: "none",
                  }}
                >
                  Tracker <ArrowRight size={13} />
                </Link>
              </div>

              {s.todayFollowUpList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "18px 8px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  <CheckCircle2 size={20} style={{ color: "#10b981", margin: "0 auto 4px" }} />
                  <div>All scheduled follow-ups clear for today.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.todayFollowUpList.slice(0, 3).map(({ visit, patient }) => (
                    <div
                      key={visit.id}
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{patient?.name || "Patient"}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {patient?.mobile}
                          {visit.diagnosis ? ` · Dx: ${visit.diagnosis}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-success btn-xs"
                          onClick={() => handleStatusChange(String(visit.id || ""), "ATTENDED")}
                          title="Mark Attended"
                        >
                          Attended
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            openRescheduleModal(
                              String(visit.id || ""),
                              patient?.name || "Patient",
                              visit.followUpDate
                            )
                          }
                          title="Reschedule"
                        >
                          Reschedule
                        </button>
                      </div>
                    </div>
                  ))}
                  {s.todayFollowUpList.length > 3 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => router.push("/followup")}
                      style={{ color: "var(--accent)" }}
                    >
                      View all {s.todayFollowUpList.length} follow-ups →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Pending Dues Widget (if any) */}
            {fin.totalPendingDues > 0 && (
              <div
                className="card"
                style={{
                  padding: 16,
                  background: "var(--surface-card, #ffffff)",
                  border: "1.5px solid rgba(239, 68, 68, 0.25)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 6 }}>
                    <Wallet size={16} style={{ color: "#ef4444" }} />
                    <span>Pending Patient Dues</span>
                    <span className="badge badge-red" style={{ fontSize: "0.7rem" }}>
                      ₹{fin.totalPendingDues.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <Link
                    href="/followup?tab=payments"
                    style={{
                      fontSize: "0.76rem",
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    All Dues Register →
                  </Link>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(pendingDuesData?.patients || []).slice(0, 3).map((p) => (
                    <div
                      key={p.patientId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        background: "var(--surface-1)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>{p.patientName}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {p.mobile} · {p.bills?.length || 1} bill(s)
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 800, color: "#ef4444", fontSize: "0.88rem" }}>
                          ₹{p.totalPendingAmount}
                        </span>
                        {p.bills && p.bills[0] && (
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() =>
                              setActivePaymentModal({
                                billId: p.bills[0].id,
                                billNumber: p.bills[0].billNumber,
                                patientName: p.patientName,
                                balanceDue: Number(p.bills[0].balanceDue),
                                totalAmount: Number(p.bills[0].totalAmount),
                                paidAmount: Number(p.bills[0].paidAmount),
                              })
                            }
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* ─── Reschedule Modal Popup ─── */}
      {rescheduleTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setRescheduleTarget(null)}
        >
          <div
            style={{
              background: "var(--surface-solid)",
              borderRadius: 14,
              padding: 22,
              maxWidth: 420,
              width: "100%",
              border: "1px solid var(--border)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={18} style={{ color: "var(--accent)" }} />
                <span>Reschedule Follow-up</span>
              </div>
              <button type="button" className="btn-icon" onClick={() => setRescheduleTarget(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>
              Choose a new follow-up date for <strong>{rescheduleTarget.patientName}</strong>:
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[
                { label: "+3 Days", days: 3 },
                { label: "+7 Days", days: 7 },
                { label: "+14 Days", days: 14 },
                { label: "+1 Month", days: 30 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + preset.days);
                    setRescheduleDate(d.toISOString().slice(0, 10));
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <input
              type="date"
              className="form-input"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              style={{ marginBottom: 16, width: "100%" }}
            />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRescheduleTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  if (!rescheduleDate) {
                    toast("Please select a date", "error");
                    return;
                  }
                  await handleStatusChange(rescheduleTarget.visitId, "RESCHEDULED", rescheduleDate);
                  setRescheduleTarget(null);
                }}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals Integration ─── */}
      {/* Record Payment Modal */}
      {activePaymentModal && (
        <RecordPaymentModal
          isOpen={!!activePaymentModal}
          onClose={() => setActivePaymentModal(null)}
          billId={activePaymentModal.billId}
          billNumber={activePaymentModal.billNumber}
          patientName={activePaymentModal.patientName}
          balanceDue={activePaymentModal.balanceDue}
          totalAmount={activePaymentModal.totalAmount}
          paidAmount={activePaymentModal.paidAmount}
          onSuccess={() => {
            setActivePaymentModal(null);
            refetchStats();
            refetchDues();
          }}
        />
      )}

      {/* Create / Edit Bill Modal */}
      {billingVisit && (
        <CreateBillModal
          isOpen={!!billingVisit}
          onClose={() => setBillingVisit(null)}
          patientId={billingVisit.patient.patientId}
          patientName={billingVisit.patient.name}
          visitId={String(billingVisit.visit.id)}
          visitDate={billingVisit.visit.date}
          initialTreatments={
            billingVisit.visit.treatment?.trim()
              ? [
                  {
                    name: billingVisit.visit.treatment.trim(),
                    unitPrice: 100,
                    quantity: 1,
                  },
                ]
              : []
          }
          onSuccess={() => {
            refetchStats();
            refetchDues();
          }}
        />
      )}

      {/* Inpatient Daily Doctor Rounds Modal */}
      {activeIpdModal && (
        <IpdDayLogModal
          isOpen={!!activeIpdModal}
          onClose={() => setActiveIpdModal(null)}
          admission={activeIpdModal}
          onSuccess={() => {
            refetchStats();
            refetchIpd();
          }}
        />
      )}

      {/* Inpatient Discharge & Settlement Modal */}
      {dashboardDischargeTarget && (
        <IpdDischargeModal
          isOpen={!!dashboardDischargeTarget}
          onClose={() => setDashboardDischargeTarget(null)}
          admission={dashboardDischargeTarget}
          onSuccess={() => {
            setDashboardDischargeTarget(null);
            refetchStats();
            refetchIpd();
          }}
        />
      )}

      {/* Interactive Multi-Day IPD Patient Journey Modal */}
      {journeyAdmission && (
        <IpdPatientJourneyModal
          isOpen={!!journeyAdmission}
          admission={journeyAdmission}
          onClose={() => setJourneyAdmission(null)}
          onOpenDayLog={() => {
            setActiveIpdModal(journeyAdmission);
          }}
          onOpenDischarge={() => {
            setDashboardDischargeTarget(journeyAdmission);
          }}
          onOpenTransfer={() => {
            router.push("/ipd");
          }}
        />
      )}
    </PageTransition>
  );
}
