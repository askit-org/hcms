"use client";

import { useEffect, useState, useMemo } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Stethoscope,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Plus,
  Eye,
  Printer,
  Trash2,
  Activity,
  ClipboardList,
  MessageCircle,
  Edit2,
  Save,
  X,
  UserPlus,
  HeartPulse,
  Receipt,
  CheckCircle2,
  Bed,
  Pill,
  AlertCircle,
  Building,
  Clock,
  ChevronRight,
  FileText,
} from "lucide-react";
import {
  usePatient,
  usePatientVisits,
  useIpdAdmissions,
  useIpdMutations,
  usePatientMutations,
  useVisitMutations,
  useSettings,
} from "@/lib/hooks/useQueries";
import type {
  Visit,
  Patient,
  IpdAdmission,
  PrescribedMedicine,
} from "@/lib/providers/types";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";
import { jsPDF } from "jspdf";
import { motion } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import LoadingScreen from "@/components/LoadingScreen";
import ErrorState from "@/components/ErrorState";
import { DoseDisplay } from "@/components/DoseSelector";
import ConfirmModal from "@/components/ConfirmModal";
import CreateBillModal from "@/components/CreateBillModal";
import MultiDayBillModal from "@/components/MultiDayBillModal";
import RecordPaymentModal from "@/components/RecordPaymentModal";
import IpdDischargeModal from "@/components/IpdDischargeModal";
import { getBedDailyRate } from "@/lib/utils/ipd";

const COMMON_CONDITIONS = [
  "Hypertension (BP)",
  "Diabetes (Sugar)",
  "Asthma",
  "Thyroid",
  "Heart Disease",
  "Allergies",
];

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();

  const { data: patient, isLoading: patientLoading } = usePatient(patientId);
  const resolvedPatientId =
    patient?.patientId || (patient?.id ? String(patient.id) : patientId);
  const {
    data: visits = [],
    isLoading: visitsLoading,
    refetch: refetchVisits,
  } = usePatientVisits(patientId);
  const {
    data: ipdAdmissions = [],
    isLoading: ipdLoading,
    refetch: refetchIpd,
  } = useIpdAdmissions({ patientId: resolvedPatientId });

  // Whenever patient details load, ensure fresh inpatient admissions & visits are fetched
  useEffect(() => {
    if (patient) {
      refetchIpd();
      refetchVisits();
    }
  }, [patient?.id, patient?.patientId, refetchIpd, refetchVisits]);
  const { data: settings } = useSettings();
  const { remove: removePatient, update: updatePatientMut } =
    usePatientMutations();
  const { update: updateVisit, remove: removeVisit } = useVisitMutations();
  const { deleteAdmission, deleteDayLog } = useIpdMutations();

  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [billingVisit, setBillingVisit] = useState<Visit | null>(null);
  const [showMultiDayBill, setShowMultiDayBill] = useState(false);
  const [activePaymentModal, setActivePaymentModal] = useState<{
    billId: string;
    billNumber: string;
    balanceDue: number;
    totalAmount?: number;
    paidAmount?: number;
  } | null>(null);
  const [tab, setTab] = useState<"overview" | "visits">("overview");
  const [visitFilter, setVisitFilter] = useState<"OPD" | "IPD">(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("stayType");
      if (param === "IPD") return "IPD";
    }
    return "OPD";
  });

  const handleSetVisitFilter = (filter: "OPD" | "IPD") => {
    setVisitFilter(filter);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("stayType", filter);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [activeIpdId, setActiveIpdId] = useState<string | null>(null);
  const [selectedDischargeModal, setSelectedDischargeModal] =
    useState<IpdAdmission | null>(null);

  // Active or most recent discharged IPD admissions
  const activeAdmission = useMemo(() => {
    return ipdAdmissions.find((a) => a.status === "ADMITTED") || null;
  }, [ipdAdmissions]);

  const activeAdmissionStats = useMemo(() => {
    if (!activeAdmission) return null;
    const days = Math.max(
      1,
      Math.ceil(
        (Date.now() - new Date(activeAdmission.admissionDate).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const rate = getBedDailyRate(activeAdmission.bedOrRoom, settings?.ipdRooms);
    const bedCharges = days * rate;
    const totalRunning =
      bedCharges + Number(activeAdmission.cumulativeCharges || 0);
    const balanceDue = Math.max(
      0,
      totalRunning -
        Number(activeAdmission.discount || 0) -
        Number(activeAdmission.totalPaid || 0),
    );
    return { days, rate, bedCharges, totalRunning, balanceDue };
  }, [activeAdmission, settings?.ipdRooms]);

  const lastDischargedAdmission = useMemo(() => {
    if (activeAdmission) return null;
    return ipdAdmissions.filter((a) => a.status === "DISCHARGED")[0] || null;
  }, [ipdAdmissions, activeAdmission]);

  const opdVisits = useMemo(
    () =>
      visits.filter(
        (v) => (v.category || "OPD").trim().toUpperCase() !== "IPD",
      ),
    [visits],
  );

  // Automatically show IPD Stays tab if patient has inpatient stays but no OPD visits
  useEffect(() => {
    if (opdVisits.length === 0 && ipdAdmissions.length > 0) {
      setVisitFilter("IPD");
    }
  }, [opdVisits.length, ipdAdmissions.length]);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    age: "",
    dob: "",
    gender: "Male",
    mobile: "",
    relation: "Self",
    guardianName: "",
    address: "",
    occupation: "",
    abhaNumber: "",
  });
  const [editConditions, setEditConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState("");

  const addCustomCondition = () => {
    const trimmed = customCondition.trim();
    if (!trimmed) return;
    if (
      !editConditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setEditConditions((prev) => [...prev, trimmed]);
    }
    setCustomCondition("");
  };

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    variant: "danger",
    onConfirm: async () => {},
  });

  useEffect(() => {
    if (patient) {
      setEditForm({
        name: patient.name || "",
        age: patient.age ? String(patient.age) : "",
        dob: patient.dob || "",
        gender: patient.gender || "Male",
        mobile: patient.mobile || "",
        relation: patient.relation || "Self",
        guardianName: patient.guardianName || "",
        address: patient.address || "",
        occupation: patient.occupation || "",
        abhaNumber: patient.abhaNumber || "",
      });
      setEditConditions(patient.permanentConditions || []);
    }
  }, [patient]);

  const handleUpdatePatient = async () => {
    if (!editForm.name.trim()) {
      toast("Patient name is required.", "error");
      return;
    }
    const mobileDigits = editForm.mobile.replace(/\D/g, "");
    if (mobileDigits.length < 10) {
      toast("Please enter a valid 10-digit mobile number.", "error");
      return;
    }
    if (
      editForm.abhaNumber.trim() &&
      !/^\d{14}$/.test(editForm.abhaNumber.trim())
    ) {
      toast("ABHA number must be exactly 14 numeric digits.", "error");
      return;
    }

    try {
      await updatePatientMut.mutateAsync({
        id: patient!.patientId,
        input: {
          name: editForm.name.trim(),
          age: editForm.age ? parseInt(editForm.age) : undefined,
          dob: editForm.dob || undefined,
          gender: editForm.gender,
          mobile: editForm.mobile.trim(),
          relation: editForm.relation,
          guardianName:
            editForm.relation !== "Self"
              ? editForm.guardianName.trim()
              : undefined,
          address: editForm.address.trim() || undefined,
          occupation: editForm.occupation.trim() || undefined,
          abhaNumber: editForm.abhaNumber.trim() || undefined,
          permanentConditions: editConditions,
        },
      });
      toast("Patient details updated successfully!", "success");
      setIsEditing(false);
    } catch (err: any) {
      toast(getErrorMessage(err, "Failed to update patient."), "error");
    }
  };

  const deletePatient = () => {
    if (!patient) return;
    setConfirmModalState({
      isOpen: true,
      title: "Delete Patient",
      description: `Are you sure you want to delete patient ${patient.name}? The patient and their visits will be hidden, and can be restored later from "Recently deleted" on the Patients page.`,
      confirmText: "Delete Patient",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        await removePatient.mutateAsync(patient.patientId);
        toast("Patient moved to Recently deleted.", "info");
        router.push("/patients");
      },
    });
  };

  const handleDeleteVisit = (v: Visit) => {
    if (!v.id) return;
    setConfirmModalState({
      isOpen: true,
      title: "Delete OPD Visit",
      description: `Are you sure you want to delete the OPD visit on ${new Date(v.date).toLocaleDateString("en-IN")}? This action cannot be undone.`,
      confirmText: "Delete Visit",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        await removeVisit.mutateAsync(v.id!);
        toast("OPD Visit deleted successfully.", "info");
      },
    });
  };

  const handleDeleteAdmission = (adm: IpdAdmission) => {
    if (!adm.id) return;
    setConfirmModalState({
      isOpen: true,
      title: "Delete IPD Inpatient Stay",
      description: `Are you sure you want to delete the inpatient stay (#${adm.admissionNumber}) admitted on ${new Date(adm.admissionDate).toLocaleDateString("en-IN")}? This will delete all charted day logs and stay records. This action cannot be undone.`,
      confirmText: "Delete Stay",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteAdmission.mutateAsync(adm.id);
          toast("Inpatient stay record deleted successfully.", "info");
          refetchIpd();
        } catch (err) {
          toast(
            getErrorMessage(err, "Failed to delete inpatient stay"),
            "error",
          );
        }
      },
    });
  };

  const loading = patientLoading || visitsLoading;

  if (loading) return <LoadingScreen message="Loading patient details..." />;
  if (!patient)
    return (
      <ErrorState
        title="Patient Not Found"
        message="The requested patient ID does not exist in the system."
      />
    );

  const age =
    patient.age ||
    (patient.dob
      ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
      : null);
  const lastVisit = visits[0];

  const containerAnimations = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemAnimations = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  };

  const handleSharePDF = (v: Visit) => {
    if (v.id) {
      router.push(`/visits/${v.id}/print`);
    }
  };

  return (
    <PageTransition>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <Link
          href="/patients"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            marginBottom: 12,
          }}
        >
          <ChevronLeft size={15} /> Back to Patients
        </Link>
      </div>
      <div
        className="page-header"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--accent-glow)",
              color: "var(--accent-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.4rem",
              flexShrink: 0,
            }}
          >
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="page-title">{patient.name}</div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 4,
                flexWrap: "wrap",
              }}
            >
              <span className="badge badge-blue">{patient.gender}</span>
              {age && <span className="badge">{age} yrs</span>}
              {lastVisit && (
                <span className="text-muted text-sm">
                  Last visit:{" "}
                  {new Date(lastVisit.date).toLocaleDateString("en-IN")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          {visits.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMultiDayBill(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Receipt size={14} /> Multi-Day Bill
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <>
                <X size={14} /> Cancel
              </>
            ) : (
              <>
                <Edit2 size={14} /> Edit Patient
              </>
            )}
          </button>
          <Link
            href={`/visits/new?patientId=${patientId}`}
            className="btn btn-primary"
          >
            <Stethoscope size={15} /> New Visit
          </Link>
          <button className="btn btn-danger btn-sm" onClick={deletePatient}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Dynamic Inpatient (IPD) Status Banner */}
      {activeAdmission && (
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(59, 130, 246, 0.05) 100%)",
            border: "1.5px solid rgba(16, 185, 129, 0.45)",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            boxShadow: "0 4px 15px -3px rgba(16, 185, 129, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bed size={24} />
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
                    fontWeight: 800,
                    fontSize: "1.05rem",
                    color: "var(--text-primary)",
                  }}
                >
                  Currently Admitted Inpatient
                </span>
                <span
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 10,
                  }}
                >
                  {activeAdmission.bedOrRoom}
                </span>
                <span
                  style={{
                    background: "rgba(59, 130, 246, 0.12)",
                    color: "var(--blue)",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 8,
                  }}
                >
                  Day{" "}
                  {Math.max(
                    1,
                    Math.ceil(
                      (Date.now() -
                        new Date(activeAdmission.admissionDate).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  )}{" "}
                  of stay
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                Admitted:{" "}
                <strong>
                  {new Date(activeAdmission.admissionDate).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </strong>
                {activeAdmission.attendingDoctor
                  ? ` · Attending: Dr. ${activeAdmission.attendingDoctor}`
                  : ""}
                {activeAdmission.diagnosis
                  ? ` · Dx: ${activeAdmission.diagnosis}`
                  : ""}
              </div>
              <div
                style={{
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                Running Charges:{" "}
                <strong>
                  ₹
                  {activeAdmissionStats?.totalRunning ??
                    activeAdmission.cumulativeCharges}
                </strong>{" "}
                (Bed: ₹{activeAdmissionStats?.bedCharges} + Care: ₹
                {activeAdmission.cumulativeCharges}) · Deposit:{" "}
                <strong style={{ color: "#10b981" }}>
                  ₹{activeAdmission.totalPaid}
                </strong>{" "}
                · Due:{" "}
                <strong
                  style={{
                    color:
                      (activeAdmissionStats?.balanceDue ??
                        Number(activeAdmission.balanceDue)) > 0
                        ? "#ef4444"
                        : "#10b981",
                  }}
                >
                  ₹
                  {activeAdmissionStats?.balanceDue ??
                    activeAdmission.balanceDue}
                </strong>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href={`/ipd/${activeAdmission.id}`}
              className="btn btn-primary btn-sm"
              title="Open Inpatient Bedside Case Sheet"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Bed size={14} /> Open Bedside Sheet →
            </Link>
            <Link
              href="/ipd"
              className="btn btn-ghost btn-sm"
              title="Open Ward Floor Plan"
            >
              Ward View →
            </Link>
          </div>
        </div>
      )}

      {!activeAdmission && lastDischargedAdmission && (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <Bed size={17} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: "0.86rem" }}>
                  Discharged Inpatient Stay: {lastDischargedAdmission.bedOrRoom}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 6,
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                  }}
                >
                  DISCHARGED
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.76rem",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Stay:{" "}
                {new Date(
                  lastDischargedAdmission.admissionDate,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                –{" "}
                {new Date(
                  lastDischargedAdmission.dischargeDate!,
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {lastDischargedAdmission.diagnosis
                  ? ` · Dx: ${lastDischargedAdmission.diagnosis}`
                  : ""}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => router.push(`/ipd/${lastDischargedAdmission.id}`)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Receipt size={13} /> View Sheet &amp; Bill →
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() =>
                router.push(`/ipd/${lastDischargedAdmission.id}/print`)
              }
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Printer size={13} /> Print Discharge Sheet
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${tab === "visits" ? "active" : ""}`}
          onClick={() => setTab("visits")}
        >
          Visit History ({opdVisits.length + ipdAdmissions.length})
        </button>
      </div>

      {tab === "overview" && (
        <div className="form-grid-2">
          <div className="card">
            <div
              className="card-title"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Patient Information</span>
              {isEditing && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleUpdatePatient}
                  disabled={updatePatientMut.isPending}
                >
                  <Save size={14} /> Save Changes
                </button>
              )}
            </div>

            {isEditing ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <div>
                  <label className="form-label">
                    Full Name <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <label className="form-label">Age (years)</label>
                    <input
                      className="form-input"
                      type="number"
                      value={editForm.age}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, age: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="form-label">Gender</label>
                    <select
                      className="form-select"
                      value={editForm.gender}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, gender: e.target.value }))
                      }
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">
                    Mobile Number <span className="required">*</span>
                  </label>
                  <input
                    className="form-input"
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={editForm.mobile}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, mobile: e.target.value }))
                    }
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <label className="form-label">Relation</label>
                    <select
                      className="form-select"
                      value={editForm.relation}
                      onChange={(e) => {
                        setEditForm((f) => ({
                          ...f,
                          relation: e.target.value,
                        }));
                        if (e.target.value === "Self")
                          setEditForm((f) => ({ ...f, guardianName: "" }));
                      }}
                    >
                      <option value="Self">Self</option>
                      <option value="Parent">Parent</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {editForm.relation !== "Self" && (
                    <div>
                      <label className="form-label">
                        Guardian Name <span className="required">*</span>
                      </label>
                      <input
                        className="form-input"
                        placeholder="Guardian's name"
                        value={editForm.guardianName}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            guardianName: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">ABHA Number</label>
                  <input
                    className="form-input"
                    placeholder="14-digit ABHA number"
                    maxLength={14}
                    value={editForm.abhaNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        abhaNumber: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <input
                    className="form-input"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="form-label">Occupation</label>
                  <input
                    className="form-input"
                    value={editForm.occupation}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, occupation: e.target.value }))
                    }
                  />
                </div>
                <div style={{ marginTop: 4 }}>
                  <label
                    className="form-label"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <HeartPulse size={15} style={{ color: "var(--amber)" }} />
                    Permanent Medical Conditions & Chronic Diseases
                  </label>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 6,
                    }}
                  >
                    {COMMON_CONDITIONS.map((cond) => {
                      const active = editConditions.includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => {
                            setEditConditions((prev) =>
                              prev.includes(cond)
                                ? prev.filter((c) => c !== cond)
                                : [...prev, cond],
                            );
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            border: active
                              ? "1px solid var(--accent)"
                              : "1px solid var(--border)",
                            background: active
                              ? "var(--accent-glow)"
                              : "var(--surface-1)",
                            color: active
                              ? "var(--accent)"
                              : "var(--text-secondary)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {active ? "✓ " : "+ "}
                          {cond}
                        </button>
                      );
                    })}

                    {/* Any custom conditions already in editConditions */}
                    {editConditions
                      .filter((c) => !COMMON_CONDITIONS.includes(c))
                      .map((cond) => (
                        <span
                          key={cond}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 20,
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            border: "1px solid var(--accent)",
                            background: "var(--accent-glow)",
                            color: "var(--accent)",
                          }}
                        >
                          ✓ {cond}
                          <button
                            type="button"
                            onClick={() =>
                              setEditConditions((prev) =>
                                prev.filter((c) => c !== cond),
                              )
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              color: "var(--accent)",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                  </div>

                  {/* Add custom condition input */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 10,
                      maxWidth: 440,
                    }}
                  >
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                      placeholder="Add other condition or allergy…"
                      value={customCondition}
                      onChange={(e) => setCustomCondition(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomCondition();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addCustomCondition}
                      disabled={!customCondition.trim()}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {[
                  {
                    icon: <Phone size={15} />,
                    label: "Mobile",
                    value: `${patient.mobile} ${patient.relation !== "Self" ? `(${patient.relation})` : ""}`,
                  },
                  ...(patient.relation !== "Self" && patient.guardianName
                    ? [
                        {
                          icon: <UserPlus size={15} />,
                          label: "Guardian",
                          value: patient.guardianName,
                        },
                      ]
                    : []),
                  {
                    icon: <ClipboardList size={15} />,
                    label: "ABHA No.",
                    value: patient.abhaNumber || "—",
                  },
                  {
                    icon: <MapPin size={15} />,
                    label: "Address",
                    value: patient.address || "—",
                  },
                  {
                    icon: <Briefcase size={15} />,
                    label: "Occupation",
                    value: patient.occupation || "—",
                  },
                  {
                    icon: <Calendar size={15} />,
                    label: "DOB",
                    value: patient.dob
                      ? new Date(patient.dob).toLocaleDateString("en-IN")
                      : "—",
                  },
                  {
                    icon: <Activity size={15} />,
                    label: "Registered",
                    value: new Date(patient.createdAt).toLocaleDateString(
                      "en-IN",
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>
                      {item.icon}
                    </span>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.82rem",
                        minWidth: 80,
                      }}
                    >
                      {item.label}
                    </span>
                    <span style={{ fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}

                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--text-muted)",
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <HeartPulse size={16} style={{ color: "var(--amber)" }} />
                    Permanent Medical Conditions & Chronic Diseases
                  </div>
                  {patient.permanentConditions &&
                  patient.permanentConditions.length > 0 ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {patient.permanentConditions.map((cond) => (
                        <span
                          key={cond}
                          className="badge badge-amber"
                          style={{
                            fontSize: "0.82rem",
                            padding: "5px 12px",
                            fontWeight: 600,
                            borderRadius: 16,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Activity size={13} /> {cond}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface-1)",
                        border: "1px dashed var(--border)",
                        borderRadius: 8,
                        padding: "10px 14px",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.84rem",
                        }}
                      >
                        No permanent medical conditions or chronic diseases
                        recorded
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "0.78rem", color: "var(--accent)" }}
                        onClick={() => setIsEditing(true)}
                      >
                        + Add Conditions
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Visit Summary</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 12,
              }}
            >
              {[
                {
                  label: "OPD Visits",
                  value: opdVisits.length,
                  color: "var(--accent-light)",
                  action: () => {
                    setTab("visits");
                    setVisitFilter("OPD");
                  },
                },
                {
                  label: "IPD Inpatient Stays",
                  value: ipdAdmissions.length,
                  color: "#8b5cf6",
                  action: () => {
                    setTab("visits");
                    setVisitFilter("IPD");
                  },
                },
                {
                  label: "Last Diagnosis",
                  value:
                    lastVisit?.diagnosis || activeAdmission?.diagnosis || "—",
                  color: "var(--text-primary)",
                },
                {
                  label: "Follow-up Pending",
                  value: visits.filter(
                    (v) => v.followUpDate && !v.followUpAttended,
                  ).length,
                  color: "var(--amber)",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "var(--surface-1)",
                    borderRadius: 8,
                    padding: "14px",
                    border: "1px solid var(--border)",
                    cursor: s.action ? "pointer" : "default",
                    transition: "all 0.15s ease",
                  }}
                  onClick={s.action}
                  title={s.action ? `Click to view ${s.label}` : undefined}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "1.05rem",
                      color: s.color,
                      marginTop: 4,
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "visits" && (
        <motion.div
          variants={containerAnimations}
          initial="hidden"
          animate="show"
        >
          {/* Sub-filter tab switcher & primary actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {/* Two Dedicated Tabs: OPD vs IPD only */}
            <div
              style={{
                display: "inline-flex",
                background: "var(--surface-2)",
                padding: 4,
                borderRadius: 10,
                border: "1px solid var(--border)",
                gap: 4,
                maxWidth: "100%",
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${visitFilter === "OPD" ? "btn-primary" : "btn-ghost"}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: visitFilter === "OPD" ? 700 : 500,
                  padding: "6px 14px",
                }}
                onClick={() => handleSetVisitFilter("OPD")}
              >
                <Stethoscope size={15} />
                <span>OPD Consultations</span>
                <span
                  style={{
                    background:
                      visitFilter === "OPD"
                        ? "rgba(255, 255, 255, 0.25)"
                        : "var(--surface-3)",
                    color:
                      visitFilter === "OPD" ? "#fff" : "var(--text-secondary)",
                    padding: "1px 7px",
                    borderRadius: 10,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {opdVisits.length}
                </span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${visitFilter === "IPD" ? "btn-primary" : "btn-ghost"}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: visitFilter === "IPD" ? 700 : 500,
                  padding: "6px 14px",
                  ...(visitFilter === "IPD"
                    ? {
                        background: "#8b5cf6",
                        borderColor: "#8b5cf6",
                        color: "#fff",
                      }
                    : {}),
                }}
                onClick={() => handleSetVisitFilter("IPD")}
              >
                <Bed size={15} />
                <span>IPD Inpatient Stays</span>
                <span
                  style={{
                    background:
                      visitFilter === "IPD"
                        ? "rgba(255, 255, 255, 0.25)"
                        : "var(--surface-3)",
                    color:
                      visitFilter === "IPD" ? "#fff" : "var(--text-secondary)",
                    padding: "1px 7px",
                    borderRadius: 10,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {ipdAdmissions.length}
                </span>
              </button>
            </div>

            {/* Quick Action Button for the Selected Tab */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {visitFilter === "OPD" ? (
                <Link
                  href={`/visits/new?patientId=${patientId}`}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus size={15} /> New OPD Visit
                </Link>
              ) : (
                <Link
                  href={`/visits/new?patientId=${patientId}&category=IPD`}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#8b5cf6",
                    borderColor: "#8b5cf6",
                  }}
                >
                  <Plus size={15} /> Admit Patient to IPD
                </Link>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: OPD CONSULTATIONS VIEW                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {visitFilter === "OPD" && (
            <div>
              {opdVisits.length === 0 ? (
                <div className="empty-state" style={{ padding: "48px 16px" }}>
                  <Stethoscope
                    size={40}
                    style={{
                      color: "var(--text-muted)",
                      margin: "0 auto 12px",
                    }}
                  />
                  <h4>No OPD Consultations Recorded</h4>
                  <p>
                    This patient has no recorded outpatient consultations yet.
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <Link
                      href={`/visits/new?patientId=${patientId}`}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus size={15} /> Start First OPD Consultation
                    </Link>
                  </div>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {opdVisits.map((v) => {
                    const isCardOpen = activeVisit?.id === v.id;
                    const isToday =
                      new Date(v.date).toDateString() ===
                      new Date().toDateString();
                    const hasDues = v.bill && Number(v.bill.balanceDue) > 0;

                    return (
                      <motion.div
                        variants={itemAnimations}
                        key={`opd-${v.id}`}
                        className="card card-sm"
                        style={{
                          cursor: "pointer",
                          transition: "all 0.18s ease",
                        }}
                        onClick={() => setActiveVisit(isCardOpen ? null : v)}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div>
                            <div
                              style={{ fontWeight: 700, fontSize: "0.96rem" }}
                            >
                              {new Date(v.date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                              {isToday && (
                                <span
                                  className="badge badge-green"
                                  style={{ marginLeft: 8 }}
                                >
                                  Today
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 4,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <span
                                className="badge badge-blue"
                                style={{ fontWeight: 700 }}
                              >
                                OPD
                              </span>
                              {v.bill ? (
                                hasDues ? (
                                  Number(v.bill.paidAmount) > 0 ? (
                                    <span
                                      className="badge badge-amber"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                      }}
                                    >
                                      <Receipt size={11} /> Paid ₹
                                      {v.bill.paidAmount} · Due ₹
                                      {v.bill.balanceDue}
                                    </span>
                                  ) : (
                                    <span
                                      className="badge badge-red"
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 3,
                                      }}
                                    >
                                      <Receipt size={11} /> Due ₹
                                      {v.bill.balanceDue}
                                    </span>
                                  )
                                ) : (
                                  <span
                                    className="badge badge-green"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                    }}
                                  >
                                    <CheckCircle2 size={11} /> Paid (₹
                                    {v.bill.totalAmount})
                                  </span>
                                )
                              ) : (
                                <span
                                  className="badge badge-amber"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <Receipt size={11} /> Unbilled
                                </span>
                              )}

                              {v.diagnosis && (
                                <span
                                  style={{
                                    color: "var(--text-secondary)",
                                    fontSize: "0.82rem",
                                  }}
                                >
                                  Dx: <strong>{v.diagnosis}</strong>
                                </span>
                              )}

                              {v.followUpDate && (
                                <span
                                  className={`badge ${v.followUpAttended ? "badge-green" : "badge-amber"}`}
                                >
                                  F/U:{" "}
                                  {new Date(v.followUpDate).toLocaleDateString(
                                    "en-IN",
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            {v.bp && (
                              <span className="badge badge-red">
                                BP: {v.bp}
                              </span>
                            )}
                            {v.pulse && (
                              <span className="badge badge-blue">
                                P: {v.pulse}
                              </span>
                            )}
                            {v.temp && (
                              <span className="badge badge-amber">
                                T: {v.temp}°F
                              </span>
                            )}
                            {v.spo2 && (
                              <span className="badge badge-green">
                                SpO2: {v.spo2}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expandable OPD Consultation Clinical Details */}
                        {isCardOpen && (
                          <div
                            style={{
                              marginTop: 14,
                              borderTop: "1px solid var(--border)",
                              paddingTop: 14,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: 10,
                                marginBottom: 12,
                              }}
                            >
                              {[
                                { l: "Chief Complaints", v: v.chiefComplaints },
                                { l: "Diagnosis", v: v.diagnosis },
                                {
                                  l: "Treatment",
                                  v: v.treatment
                                    ? `${v.treatment}${v.hideTreatmentInRx ? " (Hidden on Rx)" : ""}`
                                    : "",
                                },
                                { l: "BP", v: v.bp },
                                { l: "Pulse", v: v.pulse },
                                { l: "Temp", v: v.temp },
                                { l: "SpO₂", v: v.spo2 },
                              ]
                                .filter((i) => i.v)
                                .map((item) => (
                                  <div key={item.l}>
                                    <div
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "var(--text-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                      }}
                                    >
                                      {item.l}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        marginTop: 2,
                                      }}
                                    >
                                      {item.v}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {v.medicines && v.medicines.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.82rem",
                                    color: "var(--text-secondary)",
                                    marginBottom: 6,
                                  }}
                                >
                                  Prescription ({v.medicines.length} medicines)
                                </div>
                                {v.medicines.map((m, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: "0.84rem",
                                      padding: "6px 0",
                                      borderBottom:
                                        "1px dashed var(--border-light)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 2,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                      }}
                                    >
                                      <div>
                                        <span
                                          style={{
                                            color: "var(--accent-light)",
                                            fontWeight: 700,
                                            marginRight: 6,
                                          }}
                                        >
                                          {i + 1}.
                                        </span>
                                        <span style={{ fontWeight: 600 }}>
                                          {m.name}
                                        </span>
                                      </div>
                                      <span
                                        style={{
                                          color: "var(--accent-light)",
                                          fontWeight: 600,
                                          fontSize: "0.8rem",
                                        }}
                                      >
                                        <DoseDisplay dose={m.dose} /> ·{" "}
                                        {m.duration}
                                      </span>
                                    </div>
                                    {m.instructions && (
                                      <div
                                        style={{
                                          color: "var(--text-muted)",
                                          fontSize: "0.78rem",
                                          fontStyle: "italic",
                                          paddingLeft: 20,
                                        }}
                                      >
                                        👉 {m.instructions}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {v.prescriptionNotes && (
                              <div
                                style={{
                                  marginTop: 10,
                                  background: "var(--surface-1)",
                                  borderRadius: 8,
                                  padding: "10px",
                                  fontSize: "0.84rem",
                                  color: "var(--text-secondary)",
                                  marginBottom: 12,
                                }}
                              >
                                <strong>Notes:</strong> {v.prescriptionNotes}
                              </div>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 12,
                                flexWrap: "wrap",
                              }}
                            >
                              {hasDues && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setActivePaymentModal({
                                      billId: v.bill!.id,
                                      billNumber: v.bill!.billNumber,
                                      balanceDue: Number(v.bill!.balanceDue),
                                      totalAmount: Number(v.bill!.totalAmount),
                                      paidAmount: Number(v.bill!.paidAmount),
                                    });
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Receipt size={14} /> Collect Due (₹
                                  {v.bill!.balanceDue})
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setBillingVisit(v)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Receipt size={14} />{" "}
                                {v.billingStatus === "BILLED" || v.bill
                                  ? "Full Bill / Edit"
                                  : "Generate Bill"}
                              </button>
                              <Link
                                href={`/visits/${v.id}/print`}
                                className="btn btn-secondary btn-sm"
                              >
                                <Printer size={14} /> Print / Share Rx
                              </Link>
                              <Link
                                href={`/visits/${v.id}/edit`}
                                className="btn btn-primary btn-sm"
                              >
                                <Edit2 size={14} /> Edit Visit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: "var(--red)" }}
                                onClick={() => handleDeleteVisit(v)}
                              >
                                <Trash2 size={14} /> Delete Visit
                              </button>
                              {v.followUpDate && !v.followUpAttended && (
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={async () => {
                                    if (v.id) {
                                      await updateVisit.mutateAsync({
                                        id: v.id,
                                        input: { followUpAttended: true },
                                      });
                                      toast(
                                        "Follow-up marked as attended.",
                                        "success",
                                      );
                                      setActiveVisit({
                                        ...v,
                                        followUpAttended: true,
                                      });
                                    }
                                  }}
                                >
                                  Mark Follow-up Done
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: IPD INPATIENT STAYS VIEW (Parent Episode + Day-wise Tree)    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {visitFilter === "IPD" && (
            <div>
              {ipdAdmissions.length === 0 ? (
                <div className="empty-state" style={{ padding: "48px 16px" }}>
                  <Bed
                    size={40}
                    style={{ color: "#8b5cf6", margin: "0 auto 12px" }}
                  />
                  <h4>No Inpatient Stays Recorded</h4>
                  <p>
                    This patient has never been admitted to an inpatient
                    hospital ward.
                  </p>
                  <div style={{ marginTop: 14 }}>
                    <Link
                      href={`/visits/new?patientId=${patientId}&category=IPD`}
                      className="btn btn-primary btn-sm"
                      style={{ background: "#8b5cf6", borderColor: "#8b5cf6" }}
                    >
                      <Plus size={15} /> Admit Patient to IPD Ward
                    </Link>
                  </div>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {ipdAdmissions.map((adm) => {
                    const isAdmitted = adm.status === "ADMITTED";
                    const isToday =
                      new Date(adm.admissionDate).toDateString() ===
                      new Date().toDateString();
                    const isCardOpen = activeIpdId === adm.id;
                    const stayDays = isAdmitted
                      ? Math.max(
                          1,
                          Math.ceil(
                            (Date.now() -
                              new Date(adm.admissionDate).getTime()) /
                              (1000 * 60 * 60 * 24),
                          ),
                        )
                      : Math.max(
                          1,
                          Math.ceil(
                            (new Date(
                              adm.dischargeDate ||
                                adm.updatedAt ||
                                adm.admissionDate,
                            ).getTime() -
                              new Date(adm.admissionDate).getTime()) /
                              (1000 * 60 * 60 * 24),
                          ),
                        );

                    const bedRate = getBedDailyRate(
                      adm.bedOrRoom,
                      settings?.ipdRooms,
                    );
                    const bedCharges = stayDays * bedRate;
                    const effectiveCharges = isAdmitted
                      ? bedCharges + Number(adm.cumulativeCharges || 0)
                      : Number(adm.cumulativeCharges || 0);
                    const effectiveBalanceDue = isAdmitted
                      ? Math.max(
                          0,
                          effectiveCharges -
                            Number(adm.discount || 0) -
                            Number(adm.totalPaid || adm.advancePaid || 0),
                        )
                      : Number(adm.balanceDue || 0);
                    const hasBalanceDue = effectiveBalanceDue > 0;

                    // Extract latest vitals if charted in any day logs
                    const logs = adm.dayWiseLogs || [];
                    const lastLog =
                      logs.length > 0 ? logs[logs.length - 1] : null;
                    const lastRounds = lastLog?.rounds || [];
                    const lastRound =
                      lastRounds.length > 0
                        ? lastRounds[lastRounds.length - 1]
                        : null;
                    const vitals = lastRound?.vitals || lastLog?.vitals || {};

                    return (
                      <motion.div
                        variants={itemAnimations}
                        key={`ipd-${adm.id}`}
                        className="card card-sm"
                        style={{
                          cursor: "pointer",
                          transition: "all 0.18s ease",
                        }}
                        onClick={() =>
                          setActiveIpdId(isCardOpen ? null : adm.id)
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div>
                            {/* Date Line — Exact same visual hierarchy as OPD visits */}
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: "0.96rem",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span>
                                {new Date(adm.admissionDate).toLocaleDateString(
                                  "en-IN",
                                  {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                              {adm.dischargeDate && (
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontWeight: 500,
                                    fontSize: "0.84rem",
                                  }}
                                >
                                  –{" "}
                                  {new Date(
                                    adm.dischargeDate,
                                  ).toLocaleDateString("en-IN", {
                                    weekday: "short",
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                              {isToday && (
                                <span className="badge badge-green">Today</span>
                              )}
                              {isAdmitted ? (
                                <span className="badge badge-green">
                                  Currently Admitted · Day {stayDays}
                                </span>
                              ) : (
                                <span className="badge badge-gray">
                                  Discharged ({stayDays}d stay)
                                </span>
                              )}
                            </div>

                            {/* Badge row — Exact same pill format and styling as OPD visits */}
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 4,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <span
                                className="badge"
                                style={{
                                  background: "rgba(139, 92, 246, 0.15)",
                                  color: "#8b5cf6",
                                  fontWeight: 700,
                                }}
                              >
                                IPD
                              </span>

                              {hasBalanceDue ? (
                                Number(adm.totalPaid || adm.advancePaid || 0) >
                                0 ? (
                                  <span
                                    className="badge badge-amber"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                    }}
                                  >
                                    <Receipt size={11} /> Paid ₹
                                    {adm.totalPaid || adm.advancePaid} · Due ₹
                                    {effectiveBalanceDue}
                                  </span>
                                ) : (
                                  <span
                                    className="badge badge-red"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                    }}
                                  >
                                    <Receipt size={11} /> Due ₹
                                    {effectiveBalanceDue}
                                  </span>
                                )
                              ) : (
                                <span
                                  className="badge badge-green"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <CheckCircle2 size={11} /> Paid (₹
                                  {adm.totalPaid || effectiveCharges || 0})
                                </span>
                              )}

                              <span className="badge badge-blue">
                                Bed: {adm.bedOrRoom}
                              </span>

                              {adm.diagnosis && (
                                <span
                                  style={{
                                    color: "var(--text-secondary)",
                                    fontSize: "0.82rem",
                                  }}
                                >
                                  Dx: <strong>{adm.diagnosis}</strong>
                                </span>
                              )}

                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: "0.78rem",
                                }}
                              >
                                #{adm.admissionNumber}
                              </span>

                              {adm.attendingDoctor && (
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: "0.78rem",
                                  }}
                                >
                                  Dr. {adm.attendingDoctor}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Side: Vitals badges */}
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            {vitals.bp && (
                              <span className="badge badge-red">
                                BP: {vitals.bp}
                              </span>
                            )}
                            {vitals.pulse && (
                              <span className="badge badge-blue">
                                P: {vitals.pulse}
                              </span>
                            )}
                            {vitals.temp && (
                              <span className="badge badge-amber">
                                T: {vitals.temp}°F
                              </span>
                            )}
                            {vitals.spo2 && (
                              <span className="badge badge-green">
                                SpO2: {vitals.spo2}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expandable IPD Inpatient Stay Clinical Details */}
                        {isCardOpen && (
                          <div
                            style={{
                              marginTop: 14,
                              borderTop: "1px solid var(--border)",
                              paddingTop: 14,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: 10,
                                marginBottom: 12,
                              }}
                            >
                              {[
                                {
                                  l: "Admission No",
                                  v: `#${adm.admissionNumber}`,
                                },
                                { l: "Bed / Ward", v: adm.bedOrRoom },
                                {
                                  l: "Attending Doctor",
                                  v: adm.attendingDoctor
                                    ? `Dr. ${adm.attendingDoctor}`
                                    : "",
                                },
                                { l: "Primary Diagnosis", v: adm.diagnosis },
                                {
                                  l: "Stay Duration",
                                  v: isAdmitted
                                    ? `Currently Admitted (Day ${stayDays})`
                                    : `${stayDays} day(s) stay`,
                                },
                                {
                                  l: "Admission Date",
                                  v: new Date(
                                    adm.admissionDate,
                                  ).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  }),
                                },
                                adm.dischargeDate
                                  ? {
                                      l: "Discharge Date",
                                      v: new Date(
                                        adm.dischargeDate,
                                      ).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      }),
                                    }
                                  : null,
                                {
                                  l: "Total Charges",
                                  v: `₹${effectiveCharges}`,
                                },
                                {
                                  l: "Advance / Paid",
                                  v: `₹${adm.totalPaid || adm.advancePaid || 0}`,
                                },
                                {
                                  l: "Settlement Status",
                                  v: hasBalanceDue
                                    ? `Balance Due: ₹${effectiveBalanceDue}`
                                    : "Settled in Full",
                                },
                              ]
                                .filter((i): i is { l: string; v: string } =>
                                  Boolean(i && i.v),
                                )
                                .map((item) => (
                                  <div key={item.l}>
                                    <div
                                      style={{
                                        fontSize: "0.68rem",
                                        color: "var(--text-muted)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                      }}
                                    >
                                      {item.l}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.875rem",
                                        fontWeight: 500,
                                        marginTop: 2,
                                      }}
                                    >
                                      {item.v}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {(lastRound?.doctorNotes ||
                              lastLog?.doctorNotes) && (
                              <div style={{ marginBottom: 10 }}>
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    marginBottom: 2,
                                  }}
                                >
                                  Doctor Round Notes
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  {lastRound?.doctorNotes ||
                                    lastLog?.doctorNotes}
                                </div>
                              </div>
                            )}

                            {(lastRound?.nursingNotes ||
                              lastLog?.nursingNotes) && (
                              <div style={{ marginBottom: 10 }}>
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    marginBottom: 2,
                                  }}
                                >
                                  Nursing Notes
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  {lastRound?.nursingNotes ||
                                    lastLog?.nursingNotes}
                                </div>
                              </div>
                            )}

                            {adm.dischargeNotes && (
                              <div
                                style={{
                                  marginBottom: 12,
                                  background: "var(--surface-1)",
                                  borderRadius: 8,
                                  padding: "10px 12px",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px",
                                    marginBottom: 2,
                                  }}
                                >
                                  Discharge Advice &amp; Instructions
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.875rem",
                                    fontWeight: 500,
                                  }}
                                >
                                  {adm.dischargeNotes}
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 14,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => router.push(`/ipd/${adm.id}`)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Bed size={14} /> Open Bedside Case Sheet &amp;
                                Rounds
                              </button>

                              <Link
                                href={`/ipd/${adm.id}/print`}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Printer size={14} /> Print Inpatient File /
                                Statement
                              </Link>

                              {adm.status === "DISCHARGED" ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setSelectedDischargeModal(adm)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Receipt size={14} /> View Settlement &amp;
                                  Summary
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setSelectedDischargeModal(adm)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    color: "#10b981",
                                    borderColor: "rgba(16, 185, 129, 0.4)",
                                  }}
                                >
                                  <Receipt size={14} /> Discharge &amp; Settle
                                  Bill
                                </button>
                              )}

                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{
                                  color: "var(--red)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                                onClick={() => handleDeleteAdmission(adm)}
                              >
                                <Trash2 size={14} /> Delete Stay
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      <ConfirmModal
        {...confirmModalState}
        onClose={() =>
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {billingVisit && patient && (
        <CreateBillModal
          isOpen={!!billingVisit}
          onClose={() => setBillingVisit(null)}
          patientId={patient.patientId}
          patientName={patient.name}
          visitId={String(billingVisit.id)}
          visitDate={billingVisit.date}
          initialTreatments={
            billingVisit.treatment?.trim()
              ? [
                  {
                    name: billingVisit.treatment.trim(),
                    unitPrice: 100,
                    quantity: 1,
                  },
                ]
              : []
          }
          onSuccess={() => {
            refetchVisits();
          }}
        />
      )}

      {showMultiDayBill && patient && (
        <MultiDayBillModal
          isOpen={showMultiDayBill}
          onClose={() => setShowMultiDayBill(false)}
          patient={patient}
          visits={visits}
        />
      )}

      {activePaymentModal && patient && (
        <RecordPaymentModal
          isOpen={!!activePaymentModal}
          onClose={() => setActivePaymentModal(null)}
          billId={activePaymentModal.billId}
          billNumber={activePaymentModal.billNumber}
          patientName={patient.name}
          balanceDue={activePaymentModal.balanceDue}
          totalAmount={activePaymentModal.totalAmount}
          paidAmount={activePaymentModal.paidAmount}
          onSuccess={() => {
            refetchVisits();
          }}
        />
      )}

      {selectedDischargeModal && (
        <IpdDischargeModal
          isOpen={!!selectedDischargeModal}
          onClose={() => setSelectedDischargeModal(null)}
          admission={selectedDischargeModal}
          onSuccess={() => {
            setSelectedDischargeModal(null);
            refetchIpd();
            refetchVisits();
          }}
        />
      )}
    </PageTransition>
  );
}
