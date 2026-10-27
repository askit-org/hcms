"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Stethoscope,
  Calendar,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
  Plus,
  Search,
  Receipt,
  Wallet,
  Banknote,
  Printer,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardStats, useVisitMutations, usePendingDues } from "@/lib/hooks/useQueries";
import { useProviderStore } from "@/lib/providers";
import { useAuth } from "@/lib/hooks/useAuth";
import PageTransition from "@/components/PageTransition";
import LoadingScreen from "@/components/LoadingScreen";
import ErrorState from "@/components/ErrorState";
import RecordPaymentModal from "@/components/RecordPaymentModal";
import CreateBillModal from "@/components/CreateBillModal";
import type { Patient, Visit } from "@/lib/providers/types";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";

export default function DashboardPage() {
  const router = useRouter();
  const { data: stats, isLoading: loading, error, refetch: refetchStats } = useDashboardStats();
  const { data: pendingDuesData, refetch: refetchDues } = usePendingDues();
  const { updateFollowUpStatus } = useVisitMutations();
  const provider = useProviderStore((s) => s.provider);
  const { user } = useAuth();

  // Universal Quick Patient Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Universal Search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await provider.listPatients({ search: searchQuery.trim(), limit: 6 });
        setSearchResults(data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, provider]);

  const handleStatusChange = async (visitId: string, status: "ATTENDED" | "NOT_ATTENDED" | "RESCHEDULED", newDate?: string) => {
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

  const openRescheduleModal = (visitId: string, patientName: string, currentDate?: string) => {
    const defaultNext = new Date();
    defaultNext.setDate(defaultNext.getDate() + 7);
    setRescheduleTarget({
      visitId,
      patientName,
      currentDate,
    });
    setRescheduleDate(defaultNext.toISOString().slice(0, 10));
  };

  if (loading || !stats) return <LoadingScreen message="Loading hospital dashboard…" />;
  if (error) return <ErrorState message="Could not load your dashboard stats." />;

  const s = stats;
  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const fin = s.financialSummary || {
    todayBilled: 0,
    todayCollected: 0,
    totalPendingDues: pendingDuesData?.summary?.totalDuesToCollect || 0,
    patientsWithDuesCount: pendingDuesData?.summary?.totalPatientsWithDues || 0,
  };

  // Filter for today's visits list only
  const todayVisitsList = s.todayVisits && s.todayVisits.length > 0
    ? s.todayVisits
    : (s.recentVisits || []).filter((item) => {
        if (!item.visit?.date) return false;
        return new Date(item.visit.date).toDateString() === new Date().toDateString();
      });

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title">OPD Dashboard</div>
          <div className="page-subtitle">{todayFormatted}</div>
        </div>
        <div className="flex-wrap-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => { refetchStats(); refetchDues(); toast("Dashboard refreshed", "info"); }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link href="/patients/new" className="btn btn-secondary btn-sm">
            <UserPlus size={15} /> Register Patient
          </Link>
          <Link href="/visits/new" className="btn btn-primary btn-sm">
            <Plus size={15} /> New OPD Visit
          </Link>
        </div>
      </div>

      {/* Universal Patient Quick Search Bar */}
      <div style={{ position: "relative", zIndex: 100, marginBottom: 20 }}>
        <div className="search-input-wrap" style={{ background: "var(--surface-solid)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <span className="s-icon">
            <Search size={18} />
          </span>
          <input
            className="search-input"
            placeholder="Quick Search patient by name, mobile, or ID to view records / bill…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: "0.95rem", height: 44 }}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-icon"
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              style={{ position: "absolute", right: 12, top: 10 }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {searchQuery.trim() !== "" && (
          <div className="search-dropdown" style={{ top: "100%", marginTop: 4 }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                {isSearching ? "Searching patients..." : `No patient found matching "${searchQuery}"`}
              </div>
            ) : (
              searchResults.map((p) => (
                <div
                  key={p.id}
                  className="search-result"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    router.push(`/patients/${p.patientId}`);
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div className="sr-name">{p.name}</div>
                    <div className="sr-meta">
                      {p.mobile} · {p.gender}, {p.age}y · ID: {p.patientId}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link
                      href={`/visits/new?patientId=${p.patientId}`}
                      className="btn btn-primary btn-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus size={12} /> New Visit
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Top Metric Cards Grid */}
      <motion.div
        className="dashboard-stats-grid"
        variants={container}
        initial="hidden"
        animate="show"
        style={{ marginBottom: 24 }}
      >
        {/* Card 1: Today's OPD Total */}
        <motion.div variants={itemAnim}>
          <Link
            href="/reports"
            className="stat-card"
            style={{ "--stat-color": "var(--accent)", "--stat-bg": "var(--accent-glow)" } as React.CSSProperties}
          >
            <div className="stat-icon">
              <Activity />
            </div>
            <div className="stat-info">
              <div className="stat-value">{s.todayTotal}</div>
              <div className="stat-label">Today's OPD Patients</div>
              <div className="stat-sub">
                {s.todayNew} new · {s.todayReturning} returning
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Card 2: Today's Follow-ups */}
        <motion.div variants={itemAnim}>
          <Link
            href="/followup"
            className="stat-card"
            style={{ "--stat-color": "var(--amber)", "--stat-bg": "rgba(245,158,11,0.1)" } as React.CSSProperties}
          >
            <div className="stat-icon" style={{ "--stat-color": "var(--amber)" } as React.CSSProperties}>
              <Calendar style={{ color: "var(--amber)" }} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{s.followUpsToday}</div>
              <div className="stat-label">Follow-ups Today</div>
              <div className="stat-sub">{s.upcomingFollowUps} upcoming in 7 days</div>
            </div>
          </Link>
        </motion.div>

        {/* Card 3: Daily Billing & Collection Summary */}
        <motion.div variants={itemAnim}>
          <div
            className="stat-card"
            style={{ "--stat-color": "var(--green)", "--stat-bg": "rgba(16,185,129,0.1)" } as React.CSSProperties}
          >
            <div className="stat-icon" style={{ "--stat-color": "var(--green)" } as React.CSSProperties}>
              <Banknote style={{ color: "var(--green)" }} />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: "var(--green)" }}>
                ₹{fin.todayCollected.toLocaleString("en-IN")}
              </div>
              <div className="stat-label">Today Collected</div>
              <div className="stat-sub">Billed: ₹{fin.todayBilled.toLocaleString("en-IN")} today</div>
            </div>
          </div>
        </motion.div>

        {/* Card 4: Total Pending Dues */}
        <motion.div variants={itemAnim}>
          <Link
            href="/followup"
            className="stat-card"
            style={{ "--stat-color": "#ef4444", "--stat-bg": "rgba(239,68,68,0.1)" } as React.CSSProperties}
          >
            <div className="stat-icon" style={{ "--stat-color": "#ef4444" } as React.CSSProperties}>
              <Wallet style={{ color: "#ef4444" }} />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: "#ef4444" }}>
                ₹{fin.totalPendingDues.toLocaleString("en-IN")}
              </div>
              <div className="stat-label">Pending Dues</div>
              <div className="stat-sub">
                {fin.patientsWithDuesCount} patients with dues
              </div>
            </div>
          </Link>
        </motion.div>
      </motion.div>

      {/* Main Two-Column Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.3fr", gap: 20 }}>
        {/* Left Column: Today's OPD Patients Only */}
        <div className="card" style={{ padding: 18 }}>
          <div className="section-header" style={{ marginBottom: 14 }}>
            <div>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Stethoscope size={18} style={{ color: "var(--primary)" }} />
                <span>Today&apos;s OPD Patients Queue</span>
                <span className="badge badge-blue" style={{ fontSize: "0.72rem" }}>
                  {todayVisitsList.length} today
                </span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2 }}>
                Showing visits recorded today only ({new Date().toLocaleDateString("en-IN")})
              </div>
            </div>
            <Link
              href="/patients"
              style={{ fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}
            >
              All patients <ArrowRight size={14} />
            </Link>
          </div>

          {todayVisitsList.length === 0 ? (
            <div className="empty-state" style={{ padding: "40px 10px" }}>
              <CheckCircle2 />
              <h4>No Patients Recorded Today</h4>
              <p>No OPD visits logged yet for today.</p>
              <Link href="/visits/new" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                <Plus size={14} /> Start First Visit
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayVisitsList.map(({ visit, patient }) => {
                const bill = visit.bill;
                const hasDues = bill && Number(bill.balanceDue) > 0;
                return (
                  <div
                    key={visit.id}
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 200 }}>
                      <div className="followup-avatar" style={{ width: 40, height: 40, fontSize: "0.95rem" }}>
                        {patient?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                            {patient?.name || "Patient"}
                          </span>
                          {patient?.age && (
                            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                              ({patient.age}y / {patient.gender})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {patient?.mobile} {visit.diagnosis ? `· Dx: ${visit.diagnosis}` : ""}
                        </div>
                        {visit.bp && (
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 2 }}>
                            BP: {visit.bp} · Pulse: {visit.pulse || "-"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Badge & Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div>
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
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <Link
                          href={`/visits/${visit.id}/print`}
                          className="btn btn-ghost btn-xs"
                          title="Print Rx / Bill"
                        >
                          <Printer size={13} />
                        </Link>
                        {hasDues ? (
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
                            <Banknote size={12} /> Settle ₹{bill.balanceDue}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              if (patient) {
                                setBillingVisit({ visit, patient });
                              }
                            }}
                          >
                            <Receipt size={12} /> {bill ? "Bill" : "Create Bill"}
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

        {/* Right Column: Separate Follow-up Patients & Dues Widget */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Today's Follow-ups (Dedicated Section) */}
          <div className="card" style={{ padding: 18 }}>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={18} style={{ color: "var(--amber)" }} />
                <span>Today&apos;s Follow-ups</span>
                <span className="badge badge-amber" style={{ fontSize: "0.72rem" }}>
                  {s.todayFollowUpList.length}
                </span>
              </div>
              <Link
                href="/followup"
                style={{ fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}
              >
                Tracker <ArrowRight size={14} />
              </Link>
            </div>

            {s.todayFollowUpList.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 10px" }}>
                <CheckCircle2 />
                <h4>No Follow-ups for Today</h4>
                <p>All scheduled follow-ups are clear.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {s.todayFollowUpList.map(({ visit, patient }) => (
                  <div
                    key={visit.id}
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                          {patient?.name || "Patient"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {patient?.mobile} {visit.diagnosis ? `· Dx: ${visit.diagnosis}` : ""}
                        </div>
                      </div>
                      {visit.followUpStatus === "NOT_ATTENDED" ? (
                        <span className="badge badge-amber" style={{ fontSize: "0.7rem" }}>Did Not Come</span>
                      ) : visit.followUpStatus === "RESCHEDULED" ? (
                        <span className="badge badge-blue" style={{ fontSize: "0.7rem" }}>Rescheduled</span>
                      ) : (
                        <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>Pending</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Link
                        href={`/visits/new?patientId=${visit.patientId}`}
                        className="btn btn-secondary btn-xs"
                      >
                        <Stethoscope size={12} /> Consult
                      </Link>
                      <button
                        type="button"
                        className="btn btn-success btn-xs"
                        onClick={() => handleStatusChange(String(visit.id || ''), "ATTENDED")}
                        title="Mark as Attended"
                      >
                        Attended
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => handleStatusChange(String(visit.id || ''), "NOT_ATTENDED")}
                        style={{ color: "var(--amber)", border: "1px solid rgba(245, 158, 11, 0.3)" }}
                        title="Did Not Come"
                      >
                        Did Not Come
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => openRescheduleModal(String(visit.id || ''), patient?.name || "Patient", visit.followUpDate)}
                        style={{ color: "var(--primary)", border: "1px solid rgba(13, 148, 136, 0.3)" }}
                        title="Reschedule Date"
                      >
                        Reschedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Dues Quick Collector Widget */}
          <div className="card" style={{ padding: 18 }}>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wallet size={18} style={{ color: "#ef4444" }} />
                <span>Pending Balance Dues</span>
              </div>
              <Link
                href="/followup?tab=payments"
                style={{ fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: 4 }}
              >
                All dues <ArrowRight size={14} />
              </Link>
            </div>

            {fin.totalPendingDues === 0 ? (
              <div className="empty-state" style={{ padding: "24px 10px" }}>
                <CheckCircle2 />
                <h4>All Dues Cleared</h4>
                <p>No outstanding balances pending collection.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(pendingDuesData?.patients || []).slice(0, 4).map((p) => (
                  <div
                    key={p.patientId}
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.patientName}</div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{p.mobile}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#ef4444" }}>
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
                          Collect
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
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
              padding: 20,
              maxWidth: 420,
              width: "100%",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={18} style={{ color: "var(--primary)" }} />
                <span>Reschedule Follow-up</span>
              </div>
              <button type="button" className="btn-icon" onClick={() => setRescheduleTarget(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>
              Select new follow-up date for <strong>{rescheduleTarget.patientName}</strong>:
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
                onClick={() => {
                  if (!rescheduleDate) {
                    toast("Please select a follow-up date", "error");
                    return;
                  }
                  handleStatusChange(rescheduleTarget.visitId, "RESCHEDULED", rescheduleDate);
                  setRescheduleTarget(null);
                }}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

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
              ? [{ name: billingVisit.visit.treatment.trim(), unitPrice: 100, quantity: 1 }]
              : []
          }
          onSuccess={() => {
            refetchStats();
            refetchDues();
          }}
        />
      )}
    </PageTransition>
  );
}
