"use client";

import { useState } from "react";
import Link from "next/link";
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
  Building2,
  ShieldCheck,
  UserCheck,
  Trash2,
  Plus,
  Mail,
  Phone,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  useDashboardStats,
  useOrganizationInfo,
  useStaffMutations,
} from "@/lib/hooks/useQueries";
import { useAuth } from "@/lib/hooks/useAuth";
import PageTransition from "@/components/PageTransition";
import LoadingScreen from "@/components/LoadingScreen";
import ErrorState from "@/components/ErrorState";
import OnboardStaffModal from "@/components/OnboardStaffModal";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";

export default function DashboardPage() {
  const { data: stats, isLoading: loading, error } = useDashboardStats();
  const { data: orgInfo, isLoading: orgLoading } = useOrganizationInfo();
  const { deleteStaff } = useStaffMutations();
  const { user } = useAuth();

  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (loading || !stats)
    return <LoadingScreen message="Loading today's summary…" />;
  if (error)
    return <ErrorState message="Could not load your dashboard stats." />;

  const s = stats;
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const rootAdmin = orgInfo?.rootAdmin || {
    name: user?.doctorName || "Doctor (Root Admin)",
    email: user?.email || "doctor@clinic.com",
    degree: user?.degree || "MBBS",
    regNo: user?.regNo || "REG-101",
    role: "SUPER_ADMIN",
  };

  const organizationName =
    orgInfo?.organization?.name || user?.clinicName || "My Clinic & Hospital";
  const staffList = orgInfo?.staff || [];

  const handleRevokeStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${staffName}?`))
      return;
    setRevokingId(staffId);
    try {
      await deleteStaff.mutateAsync(staffId);
      toast(`Access for ${staffName} has been revoked.`, "success");
    } catch (err: any) {
      toast(getErrorMessage(err, "Failed to revoke staff access."), "error");
    } finally {
      setRevokingId(null);
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Good Morning 👋</div>
          <div className="page-subtitle">{today}</div>
        </div>
        <div className="flex-wrap-header-actions">
          <Link href="/patients/new" className="btn btn-secondary btn-sm">
            <UserPlus size={15} /> Register Patient
          </Link>
          <Link href="/visits/new" className="btn btn-primary btn-sm">
            <Stethoscope size={15} /> New Visit
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div
        className="dashboard-stats-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <Link
            href="/reports"
            className="stat-card"
            style={
              {
                "--stat-color": "var(--accent)",
                "--stat-bg": "var(--accent-glow)",
              } as React.CSSProperties
            }
          >
            <div className="stat-icon">
              <Activity />
            </div>
            <div className="stat-info">
              <div className="stat-value">{s.todayTotal}</div>
              <div className="stat-label">Patients Today</div>
              <div className="stat-sub">
                {s.todayNew} new · {s.todayReturning} returning
              </div>
            </div>
          </Link>
        </motion.div>
        <motion.div variants={item}>
          <Link
            href="/patients"
            className="stat-card"
            style={
              {
                "--stat-color": "var(--blue)",
                "--stat-bg": "rgba(59,130,246,0.1)",
              } as React.CSSProperties
            }
          >
            <div
              className="stat-icon"
              style={{ "--stat-color": "var(--blue)" } as React.CSSProperties}
            >
              <Users style={{ color: "var(--blue)" }} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{s.totalPatients}</div>
              <div className="stat-label">Total Patients</div>
              <div className="stat-sub">Registered in system</div>
            </div>
          </Link>
        </motion.div>
        <motion.div variants={item}>
          <Link
            href="/followup"
            className="stat-card"
            style={
              {
                "--stat-color": "var(--amber)",
                "--stat-bg": "rgba(245,158,11,0.1)",
              } as React.CSSProperties
            }
          >
            <div
              className="stat-icon"
              style={{ "--stat-color": "var(--amber)" } as React.CSSProperties}
            >
              <Calendar style={{ color: "var(--amber)" }} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{s.followUpsToday}</div>
              <div className="stat-label">Follow-ups Today</div>
              <div className="stat-sub">
                {s.upcomingFollowUps} in next 7 days
              </div>
            </div>
          </Link>
        </motion.div>
        <motion.div variants={item}>
          <Link
            href="/patients/new"
            className="stat-card"
            style={
              {
                "--stat-color": "var(--green)",
                "--stat-bg": "rgba(16,185,129,0.1)",
              } as React.CSSProperties
            }
          >
            <div
              className="stat-icon"
              style={{ "--stat-color": "var(--green)" } as React.CSSProperties}
            >
              <TrendingUp style={{ color: "var(--green)" }} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{s.todayNew}</div>
              <div className="stat-label">New Patients Today</div>
              <div className="stat-sub">
                {s.todayTotal > 0
                  ? Math.round((s.todayNew / s.todayTotal) * 100)
                  : 0}
                % of today
              </div>
            </div>
          </Link>
        </motion.div>
      </motion.div>

      {/* ── Hospital Organization & Staff Onboarding Section ────────────────── */}
      <div className="card" style={{ marginTop: 24, padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--accent-glow)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={22} />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  Hospital Organization & Staff Management
                </h3>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Manage hospital staff onboarding
                </div>
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setShowOnboardModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 700,
              padding: "10px 16px",
              background:
                "linear-gradient(135deg, var(--accent), var(--accent-light))",
            }}
          >
            <UserPlus size={16} /> Onboard
          </button>
        </div>

        {/* Root Account Owner Banner */}
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "16px 20px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "var(--blue)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "1.2rem",
                }}
              >
                {rootAdmin.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {rootAdmin.name}
                  </span>
                  <span
                    className="badge badge-teal"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      fontSize: "0.74rem",
                    }}
                  >
                    <ShieldCheck size={13} /> Root Admin / Super Admin
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    marginTop: 4,
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    🏥 <strong>Clinic:</strong> {organizationName}
                  </span>
                  <span>
                    🎓 <strong>Degree:</strong> {rootAdmin.degree || "MBBS"}
                  </span>
                  <span>
                    📜 <strong>Reg No:</strong> {rootAdmin.regNo || "N/A"}
                  </span>
                  <span>✉️ {rootAdmin.email}</span>
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                background: "var(--surface-2)",
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid var(--border)",
              }}
            >
              👑 Organization Creator
            </div>
          </div>
        </div>

        {/* Staff Members List */}
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "var(--text-primary)",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Users size={16} color="var(--accent)" /> Onboarded Clinic Staff (
            {staffList.length})
          </div>

          {staffList.length === 0 ? (
            <div
              className="empty-state"
              style={{
                padding: "32px 16px",
                background: "var(--surface-1)",
                borderRadius: 14,
                border: "1.5px dashed var(--border)",
              }}
            >
              <UserCheck size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
              <h4 style={{ fontSize: "0.95rem", margin: "0 0 4px 0" }}>
                No Receptionist Onboarded Yet
              </h4>
              <p style={{ fontSize: "0.82rem", margin: 0, maxWidth: 380 }}>
                Invite your front-desk receptionist to handle patient
                registrations and manage daily OPD visit queues.
              </p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowOnboardModal(true)}
                style={{
                  marginTop: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={14} /> Add Receptionist Now
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Role</th>
                    <th>Email Address</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "rgba(13, 148, 136, 0.15)",
                              color: "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.85rem",
                            }}
                          >
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          {s.name}
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge badge-blue"
                          style={{
                            textTransform: "capitalize",
                            fontWeight: 600,
                          }}
                        >
                          📋{" "}
                          {(s?.roleName || s?.roleCode || s?.role || "Staff")
                            .toString()
                            .toLowerCase()}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {s.email}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {s.phone}
                      </td>
                      <td>
                        <span
                          className="badge badge-green"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Active
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRevokeStaff(s.id, s.name)}
                          disabled={revokingId === s.id}
                          style={{
                            color: "var(--red)",
                            borderColor: "rgba(239, 68, 68, 0.3)",
                          }}
                          title="Revoke Staff Access"
                        >
                          <Trash2 size={13} />{" "}
                          {revokingId === s.id ? "Revoking…" : "Revoke"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="form-grid-2" style={{ marginTop: 24 }}>
        {/* Today Follow-ups */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">
              <Calendar size={18} /> Today's Follow-ups
            </div>
            <Link
              href="/followup"
              style={{
                fontSize: "0.8rem",
                color: "var(--accent-light)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {s.todayFollowUpList.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              <CheckCircle2 />
              <h4>No Follow-ups Today</h4>
              <p>All clear for today!</p>
            </div>
          ) : (
            s.todayFollowUpList.slice(0, 6).map(({ visit, patient }) => (
              <div key={visit.id} className="followup-item">
                <div className="followup-avatar">
                  {patient?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    {patient?.name || "Unknown"}
                  </div>
                  <div
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                  >
                    {patient?.mobile} · {visit.diagnosis || "No diagnosis"}
                  </div>
                </div>
                <Link
                  href={`/patients/${visit.patientId}`}
                  className="btn btn-ghost btn-sm"
                >
                  View
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Recent Visits */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">
              <Clock size={18} /> Recent Visits
            </div>
            <Link
              href="/patients"
              style={{
                fontSize: "0.8rem",
                color: "var(--accent-light)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              All patients <ArrowRight size={14} />
            </Link>
          </div>
          {s.recentVisits.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 10px" }}>
              <Stethoscope />
              <h4>No visits yet</h4>
              <p>Start by adding your first OPD visit</p>
            </div>
          ) : (
            s.recentVisits.map(({ visit, patient }) => (
              <div key={visit.id} className="followup-item">
                <div
                  className="followup-avatar"
                  style={{
                    background: "rgba(99,102,241,0.15)",
                    color: "var(--indigo)",
                  }}
                >
                  {patient?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                    {patient?.name || "Patient"}
                  </div>
                  <div
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                  >
                    {visit.diagnosis || visit.chiefComplaints || "—"} ·{" "}
                    {new Date(visit.date).toLocaleDateString("en-IN")}
                  </div>
                </div>
                {visit.followUpDate && (
                  <span className="badge badge-amber">F/U</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Quick Actions</div>
        <div
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}
        >
          <button
            onClick={() => setShowOnboardModal(true)}
            className="btn btn-primary"
          >
            <UserPlus size={16} /> Onboard Receptionist
          </button>
          <Link href="/patients/new" className="btn btn-secondary">
            <UserPlus size={16} /> Register New Patient
          </Link>
          <Link href="/visits/new" className="btn btn-secondary">
            <Stethoscope size={16} /> Start OPD Visit
          </Link>
          <Link href="/followup" className="btn btn-secondary">
            <Calendar size={16} /> Follow-up Tracker
          </Link>
          <Link href="/reports" className="btn btn-secondary">
            <TrendingUp size={16} /> View Reports
          </Link>
        </div>
      </div>

      {/* Onboard Staff Modal */}
      <OnboardStaffModal
        isOpen={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
      />
    </PageTransition>
  );
}
