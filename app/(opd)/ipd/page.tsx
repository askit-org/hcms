"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Bed,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Receipt,
  Banknote,
  Printer,
  Share2,
  X,
  ChevronRight,
  Download,
  FileText,
  Settings,
  Grid,
  List,
  Trash2,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIpdAdmissions, useIpdMutations, useSettings, useSettingsMutations } from "@/lib/hooks/useQueries";
import { useProviderStore } from "@/lib/providers";
import { useAuth } from "@/lib/hooks/useAuth";
import type {
  IpdAdmission,
  Patient,
  CreateIpdAdmissionInput,
  AddIpdDayLogInput,
  DischargeIpdInput,
  IpdRoom,
  IpdBed,
} from "@/lib/providers/types";
import PageTransition from "@/components/PageTransition";
import LoadingScreen from "@/components/LoadingScreen";
import ErrorState from "@/components/ErrorState";
import SettingsIpdRooms from "@/components/SettingsIpdRooms";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";

export default function IpdPage() {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { update: updateSettingsMutation } = useSettingsMutations();
  const provider = useProviderStore((s) => s.provider);

  const [tab, setTab] = useState<"ADMITTED" | "DISCHARGED" | "ALL">("ADMITTED");
  const { data: admissions = [], isLoading, error } = useIpdAdmissions({ status: tab });
  const { createAdmission, addDayLog, discharge, recordPayment, deleteAdmission } = useIpdMutations();

  // View state: Graphical Bed Floor Plan vs Inpatient List Table
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>("ALL");
  const [bedStatusFilter, setBedStatusFilter] = useState<"ALL" | "VACANT" | "OCCUPIED">("ALL");

  // Modals state
  const [showNewAdmissionModal, setShowNewAdmissionModal] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<IpdAdmission | null>(null);
  const [showAddDayLogModal, setShowAddDayLogModal] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showBedConfigModal, setShowBedConfigModal] = useState(false);

  // 100% Real Hospital Rooms & Beds (Strictly configured by hospital, zero fake/hardcoded data)
  const rooms: IpdRoom[] = useMemo(() => {
    if (settings?.ipdRooms && Array.isArray(settings.ipdRooms)) {
      return settings.ipdRooms;
    }
    return [];
  }, [settings?.ipdRooms]);

  // Real Configured Clinic Procedures for treatment logging
  const availableProcedures = useMemo(() => {
    const list: Array<{ name: string; price: number }> = [];
    const rates = settings?.serviceRates || {};
    const stdMap: Record<string, string> = {
      ivInjection: "IV Injection",
      imInjection: "IM Injection",
      saline: "IV Fluid / Saline (500ml)",
      nebulization: "Nebulization Session",
      dressing: "Wound Dressing",
      ecg: "ECG (12-Lead)",
      suture: "Suture / Stitching",
      grbs: "Blood Sugar (GRBS)",
    };
    Object.entries(stdMap).forEach(([key, label]) => {
      if (rates[key] !== undefined && Number(rates[key]) > 0) {
        list.push({ name: label, price: Number(rates[key]) });
      }
    });
    (settings?.customServices || []).forEach((cs) => {
      const p = cs.defaultPrice ?? (cs as any).price ?? 0;
      list.push({ name: cs.name, price: Number(p) });
    });
    return list;
  }, [settings?.serviceRates, settings?.customServices]);

  // New Admission Form State (Real data only: clean fields)
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [admissionForm, setAdmissionForm] = useState({
    bedOrRoom: "",
    customBedText: "",
    isCustomBed: false,
    admissionDate: new Date().toISOString().slice(0, 16),
    diagnosis: "",
    attendingDoctor: user?.doctorName || "",
    advancePaid: "",
    advancePaymentMethod: "CASH" as "CASH" | "UPI",
    notes: "",
  });

  // Patient search for admission
  useEffect(() => {
    if (!patientQuery.trim()) {
      setPatientResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await provider.listPatients({ search: patientQuery.trim(), limit: 6 });
      setPatientResults(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [patientQuery, provider]);

  // Day Log Form State (Real clinical logs: vitals & procedures start blank)
  const [dayLogForm, setDayLogForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    doctorNotes: "",
    nursingNotes: "",
    vitals: { bp: "", pulse: "", temp: "", spo2: "" },
    medicinesAdministered: "",
    procedureName: "",
    procedureCharge: "",
  });

  // Discharge Form State (Zero fake text, clean clinical notes)
  const [dischargeForm, setDischargeForm] = useState({
    dischargeDate: new Date().toISOString().slice(0, 16),
    dischargeSummary: "",
    dischargeMedications: "",
    dischargeNotes: "",
    discount: "0",
    paymentMethod: "CASH" as "CASH" | "UPI",
  });

  // Advance Deposit Form State
  const [advanceAmount, setAdvanceAmount] = useState("");

  // Keep selectedAdmission updated with latest admission data
  useEffect(() => {
    if (selectedAdmission) {
      const updated = admissions.find((a) => a.id === selectedAdmission.id);
      if (updated) setSelectedAdmission(updated);
    }
  }, [admissions, selectedAdmission]);

  // Active admissions list
  const activeAdmissions = useMemo(
    () => admissions.filter((a) => a.status === "ADMITTED"),
    [admissions]
  );

  // Map of bed to occupied admission (Strict token & label match, no substring collisions)
  const bedOccupancyMap = useMemo(() => {
    const map = new Map<string, IpdAdmission>();

    rooms.forEach((room) => {
      (room.beds || []).forEach((bed) => {
        const bedKey = `${room.id}___${bed.id}`;
        const match = activeAdmissions.find((admission) => {
          const admBed = (admission.bedOrRoom || "").trim().toLowerCase();
          const bedNum = (bed.bedNumber || "").trim().toLowerCase();
          const roomName = (room.name || "").trim().toLowerCase();
          const roomCode = (room.roomCode || "").trim().toLowerCase();

          if (!admBed || !bedNum) return false;

          // Exact full labels
          if (admBed === `${roomName} - bed ${bedNum}`) return true;
          if (admBed === `${roomName} - ${bedNum}`) return true;
          if (roomCode && (admBed === `${roomCode} - bed ${bedNum}` || admBed === `${roomCode} - ${bedNum}` || admBed === `${roomCode}${bedNum}`)) return true;
          if (admBed === `bed ${bedNum}` || admBed === bedNum) return true;

          // If admission explicitly mentions room name, check for exact bed suffix/token
          if (roomName && admBed.includes(roomName)) {
            const remainder = admBed.replace(roomName, "").trim();
            if (
              remainder === bedNum ||
              remainder === `- ${bedNum}` ||
              remainder === `bed ${bedNum}` ||
              remainder === `- bed ${bedNum}` ||
              remainder.endsWith(` ${bedNum}`)
            ) {
              return true;
            }
          }

          return false;
        });

        if (match) {
          map.set(bedKey, match);
        }
      });
    });

    return map;
  }, [rooms, activeAdmissions]);

  // Live Hospital Bed Counters
  const liveStats = useMemo(() => {
    let total = 0;
    rooms.forEach((r) => {
      total += (r.beds || []).length;
    });

    const occupied = bedOccupancyMap.size;
    const vacant = Math.max(0, total - occupied);
    const occupancyPercent = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const totalRevenue = admissions.reduce(
      (sum, a) => sum + (Number(a.cumulativeCharges) || 0),
      0
    );
    const totalAdvances = admissions.reduce(
      (sum, a) => sum + (Number(a.advancePaid) || 0),
      0
    );

    return {
      totalBeds: total,
      occupiedBeds: occupied,
      vacantBeds: vacant,
      occupancyPercent,
      totalRevenue,
      totalAdvances,
      activeAdmissionsCount: activeAdmissions.length,
    };
  }, [rooms, bedOccupancyMap, admissions, activeAdmissions]);

  // List of real vacant beds for admission dropdown
  const vacantBedOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; rate?: number }> = [];
    rooms.forEach((r) => {
      (r.beds || []).forEach((b) => {
        const bedKey = `${r.id}___${b.id}`;
        if (!bedOccupancyMap.has(bedKey)) {
          options.push({
            value: `${r.name} - Bed ${b.bedNumber}`,
            label: `${r.name} · Bed ${b.bedNumber} (₹${r.dailyRate || 500}/d)`,
            rate: r.dailyRate,
          });
        }
      });
    });
    return options;
  }, [rooms, bedOccupancyMap]);

  // Filter admissions for table view
  const filteredAdmissions = useMemo(() => {
    if (!searchQuery.trim()) return admissions;
    const q = searchQuery.toLowerCase();
    return admissions.filter((a) => {
      const pName = a.patient?.name || (a as any).patientName || "";
      const pMob = a.patient?.mobile || (a as any).patientMobile || "";
      return (
        pName.toLowerCase().includes(q) ||
        pMob.includes(q) ||
        a.bedOrRoom.toLowerCase().includes(q) ||
        a.admissionNumber.toLowerCase().includes(q) ||
        (a.diagnosis && a.diagnosis.toLowerCase().includes(q))
      );
    });
  }, [admissions, searchQuery]);

  // Filter rooms for graphical layout
  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (selectedWardFilter !== "ALL") {
      list = list.filter((r) => r.id === selectedWardFilter || r.type === selectedWardFilter);
    }
    return list;
  }, [rooms, selectedWardFilter]);

  // Click on vacant bed -> Quick Admit
  const handleSelectVacantBed = (room: IpdRoom, bed: IpdBed) => {
    setAdmissionForm((f) => ({
      ...f,
      isCustomBed: false,
      customBedText: "",
      bedOrRoom: `${room.name} - Bed ${bed.bedNumber}`,
    }));
    setShowNewAdmissionModal(true);
  };

  // Click on occupied bed -> Open Patient Sheet
  const handleSelectOccupiedBed = (admission: IpdAdmission) => {
    setSelectedAdmission(admission);
  };

  // Submit New Admission
  const handleCreateAdmission = async () => {
    if (!selectedPatient) {
      toast("Please select a registered patient", "error");
      return;
    }
    const chosenBed = admissionForm.isCustomBed
      ? admissionForm.customBedText.trim()
      : admissionForm.bedOrRoom.trim();

    if (!chosenBed) {
      toast("Please select or enter a real hospital bed/room", "error");
      return;
    }

    try {
      const payload: CreateIpdAdmissionInput = {
        patientId: selectedPatient.patientId,
        bedOrRoom: chosenBed,
        diagnosis: admissionForm.diagnosis.trim() || "Inpatient Care",
        attendingDoctor: admissionForm.attendingDoctor.trim() || undefined,
        admissionDate: admissionForm.admissionDate,
        advancePaid: parseFloat(admissionForm.advancePaid) || 0,
      };

      const result = await createAdmission.mutateAsync(payload);
      toast(`Patient admitted successfully to ${payload.bedOrRoom}!`, "success");
      setShowNewAdmissionModal(false);
      setSelectedPatient(null);
      setAdmissionForm({
        bedOrRoom: "",
        customBedText: "",
        isCustomBed: false,
        admissionDate: new Date().toISOString().slice(0, 16),
        diagnosis: "",
        attendingDoctor: user?.doctorName || "",
        advancePaid: "",
        advancePaymentMethod: "CASH",
        notes: "",
      });
      setSelectedAdmission(result);
    } catch (err) {
      toast(getErrorMessage(err, "Failed to admit patient"), "error");
    }
  };

  // Submit Day Log
  const handleAddDayLog = async () => {
    if (!selectedAdmission) return;
    try {
      const charge = parseFloat(dayLogForm.procedureCharge) || 0;
      const vitalsParts: string[] = [];
      if (dayLogForm.vitals.bp?.trim()) vitalsParts.push(`BP ${dayLogForm.vitals.bp.trim()}`);
      if (dayLogForm.vitals.pulse?.trim()) vitalsParts.push(`Pulse ${dayLogForm.vitals.pulse.trim()} bpm`);
      if (dayLogForm.vitals.temp?.trim()) vitalsParts.push(`Temp ${dayLogForm.vitals.temp.trim()}°F`);
      if (dayLogForm.vitals.spo2?.trim()) vitalsParts.push(`SpO2 ${dayLogForm.vitals.spo2.trim()}%`);

      const combinedNursingNotes = [
        dayLogForm.nursingNotes.trim(),
        vitalsParts.length > 0 ? `Vitals: ${vitalsParts.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const payload: AddIpdDayLogInput = {
        date: dayLogForm.date,
        doctorNotes: dayLogForm.doctorNotes.trim() || undefined,
        nursingNotes: combinedNursingNotes || undefined,
        medicinesAdministered: dayLogForm.medicinesAdministered.trim() || undefined,
        procedures: dayLogForm.procedureName.trim()
          ? [
              {
                name: dayLogForm.procedureName.trim(),
                quantity: 1,
                unitPrice: charge,
                totalPrice: charge,
              },
            ]
          : [],
        dailyCharges: charge,
      };

      const updated = await addDayLog.mutateAsync({
        id: selectedAdmission.id,
        input: payload,
      });

      setSelectedAdmission(updated);
      setShowAddDayLogModal(false);
      setDayLogForm({
        date: new Date().toISOString().slice(0, 10),
        doctorNotes: "",
        nursingNotes: "",
        vitals: { bp: "", pulse: "", temp: "", spo2: "" },
        medicinesAdministered: "",
        procedureName: "",
        procedureCharge: "",
      });
      toast(`Recorded Day treatment log!`, "success");
    } catch (err) {
      toast(getErrorMessage(err, "Failed to add day log"), "error");
    }
  };

  // Record Extra Advance Deposit
  const handleRecordAdvance = async () => {
    if (!selectedAdmission) return;
    const amount = parseFloat(advanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast("Please enter a valid deposit amount", "error");
      return;
    }

    try {
      const updated = await recordPayment.mutateAsync({
        id: selectedAdmission.id,
        amount,
      });
      setSelectedAdmission(updated);
      setShowAdvanceModal(false);
      setAdvanceAmount("");
      toast(`Recorded ₹${amount} advance deposit!`, "success");
    } catch (err) {
      toast(getErrorMessage(err, "Failed to record advance deposit"), "error");
    }
  };

  // Submit Discharge
  const handleDischarge = async () => {
    if (!selectedAdmission) return;
    try {
      const disc = parseFloat(dischargeForm.discount) || 0;
      const netPayable = Math.max(0, (selectedAdmission.cumulativeCharges || 0) - disc);
      const remainingBalance = Math.max(0, netPayable - (selectedAdmission.totalPaid || 0));

      const payload: DischargeIpdInput = {
        dischargeDate: dischargeForm.dischargeDate,
        dischargeSummary: dischargeForm.dischargeSummary.trim() || undefined,
        dischargeMedications: dischargeForm.dischargeMedications.trim() || undefined,
        dischargeNotes: dischargeForm.dischargeNotes.trim() || undefined,
        discount: disc,
        finalPayment: remainingBalance,
        paymentMethod: dischargeForm.paymentMethod,
      };

      const updated = await discharge.mutateAsync({
        id: selectedAdmission.id,
        input: payload,
      });

      setSelectedAdmission(updated);
      setShowDischargeModal(false);
      toast(`Patient discharged successfully! Final bill settled.`, "success");
    } catch (err) {
      toast(getErrorMessage(err, "Failed to discharge patient"), "error");
    }
  };

  // Open Unified Printable Statement & PDF View (reusing OPD letterhead & styling)
  const handleOpenPrintDocument = (adm: IpdAdmission, view: "both" | "bill" | "summary" = "both") => {
    window.open(`/ipd/${adm.id}/print?view=${view}`, "_blank");
  };

  const handleWhatsAppShare = (adm: IpdAdmission) => {
    const clinicName = user?.clinicName || settings?.clinicName || "Hospital Inpatient";
    const doctorName = adm.attendingDoctor || user?.doctorName || "Doctor";
    const pName = adm.patient?.name || (adm as any).patientName || "Patient";
    const pMob = adm.patient?.mobile || (adm as any).patientMobile || "";

    const message = `*INPATIENT DISCHARGE & BILL STATEMENT*\n*${clinicName}* (Dr. ${doctorName})\n----------------------------------\n*Patient:* ${pName} (${pMob})\n*IPD No:* ${adm.admissionNumber} | *Bed:* ${adm.bedOrRoom}\n*Admitted:* ${new Date(adm.admissionDate).toLocaleDateString("en-IN")}\n*Discharged:* ${adm.dischargeDate ? new Date(adm.dischargeDate).toLocaleDateString("en-IN") : "Active"}\n\n*Diagnosis:* ${adm.diagnosis || "N/A"}\n*Summary:* ${adm.dischargeSummary || "Condition stable"}\n----------------------------------\n*Total Hospital Charges:* ₹${adm.cumulativeCharges}\n*Advance Deposits Paid:* -₹${adm.advancePaid}\n*Discount Given:* -₹${adm.discount}\n*Total Settled:* ₹${adm.totalPaid}\n*Balance Due:* ₹${adm.balanceDue}\n----------------------------------\nThank you for trusting us with your healthcare!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Delete / Cancel Inpatient Admission
  const handleDeleteAdmission = async (adm: IpdAdmission) => {
    const pName = adm.patient?.name || (adm as any).patientName || "Patient";
    const confirmed = window.confirm(
      `Delete admission for ${pName} (${adm.bedOrRoom})?\n\nThis will remove the inpatient admission and immediately vacate the bed.`
    );
    if (!confirmed) return;

    try {
      await deleteAdmission.mutateAsync(adm.id);
      toast(`Admission deleted and ${adm.bedOrRoom} is now vacant!`, "success");
      if (selectedAdmission?.id === adm.id) {
        setSelectedAdmission(null);
      }
    } catch (err) {
      toast(getErrorMessage(err, "Failed to delete admission"), "error");
    }
  };

  if (isLoading) return <LoadingScreen message="Loading Inpatient (IPD) department..." />;
  if (error) return <ErrorState message="Could not load Inpatient admissions." />;

  return (
    <PageTransition>
      {/* ─── Page Header ─── */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Inpatient Department (IPD)</span>
            {liveStats.totalBeds > 0 ? (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(13, 148, 136, 0.12)",
                  color: "var(--primary)",
                  fontWeight: 700,
                }}
              >
                {liveStats.occupiedBeds} / {liveStats.totalBeds} Beds Occupied ({liveStats.occupancyPercent}%)
              </span>
            ) : (
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#d97706",
                  fontWeight: 600,
                }}
              >
                No Rooms Setup Yet
              </span>
            )}
          </div>
          <div className="page-subtitle">
            Live bed floor matrix, real hospital bed roll numbers, day-wise rounds &amp; running bill settlement
          </div>
        </div>

        <div className="flex-wrap-header-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowBedConfigModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Settings size={14} /> Configure Rooms &amp; Beds
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewAdmissionModal(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Bed size={15} /> + Admit Patient
          </button>
        </div>
      </div>

      {/* ─── Live Hospital Bed Counters ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {/* Total Beds */}
        <div
          className="card"
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "rgba(100, 116, 139, 0.12)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Bed size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, lineHeight: 1.1 }}>{liveStats.totalBeds}</div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Total Real Beds
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {rooms.length > 0 ? `In ${rooms.length} configured rooms` : "0 rooms configured"}
            </div>
          </div>
        </div>

        {/* Available / Vacant Beds */}
        <div
          className="card"
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(16, 185, 129, 0.05)",
            border: "1.5px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#10b981", lineHeight: 1.1 }}>
              {liveStats.vacantBeds}
            </div>
            <div style={{ fontSize: "0.74rem", color: "#10b981", fontWeight: 700, textTransform: "uppercase" }}>
              Vacant Beds
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Available to admit</div>
          </div>
        </div>

        {/* Occupied Beds */}
        <div
          className="card"
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(244, 63, 94, 0.05)",
            border: "1.5px solid rgba(244, 63, 94, 0.3)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "rgba(244, 63, 94, 0.15)",
              color: "#f43f5e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f43f5e", lineHeight: 1.1 }}>
              {liveStats.occupiedBeds}
            </div>
            <div style={{ fontSize: "0.74rem", color: "#f43f5e", fontWeight: 700, textTransform: "uppercase" }}>
              Occupied Beds
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              {liveStats.occupancyPercent}% occupancy
            </div>
          </div>
        </div>

        {/* Running IPD Revenue */}
        <div
          className="card"
          style={{
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "rgba(59, 130, 246, 0.12)",
              color: "var(--blue)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Receipt size={22} />
          </div>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, lineHeight: 1.1 }}>
              ₹{liveStats.totalRevenue.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              Running IPD Charges
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              ₹{liveStats.totalAdvances.toLocaleString("en-IN")} advances held
            </div>
          </div>
        </div>
      </div>

      {/* ─── Control Toolbar: Mode Switcher & Filter Pills ─── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Left: View Mode Toggle & Ward Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* View Toggle */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--surface-2)",
              padding: 3,
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className={`btn btn-xs ${viewMode === "grid" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setViewMode("grid")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Grid size={13} /> Bed Floor Plan
            </button>
            <button
              type="button"
              className={`btn btn-xs ${viewMode === "table" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setViewMode("table")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <List size={13} /> Inpatient List Table
            </button>
          </div>

          {/* Graphical Layout Ward / Bed Status Filter */}
          {viewMode === "grid" && rooms.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="form-select"
                style={{ fontSize: "0.8rem", padding: "4px 8px", width: "auto" }}
                value={selectedWardFilter}
                onChange={(e) => setSelectedWardFilter(e.target.value)}
              >
                <option value="ALL">All Wards &amp; Rooms ({rooms.length})</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.beds?.length || 0} Beds)
                  </option>
                ))}
              </select>

              <div
                style={{
                  display: "inline-flex",
                  background: "var(--surface-1)",
                  padding: 2,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  className={`btn btn-xs ${bedStatusFilter === "ALL" ? "btn-secondary" : "btn-ghost"}`}
                  onClick={() => setBedStatusFilter("ALL")}
                >
                  All Beds
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${bedStatusFilter === "VACANT" ? "btn-secondary" : "btn-ghost"}`}
                  onClick={() => setBedStatusFilter("VACANT")}
                  style={{ color: "#10b981" }}
                >
                  🟢 Vacant ({liveStats.vacantBeds})
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${bedStatusFilter === "OCCUPIED" ? "btn-secondary" : "btn-ghost"}`}
                  onClick={() => setBedStatusFilter("OCCUPIED")}
                  style={{ color: "#f43f5e" }}
                >
                  🔴 Occupied ({liveStats.occupiedBeds})
                </button>
              </div>
            </div>
          ) : viewMode === "table" ? (
            /* Table Mode Tabs */
            <div className="tabs" style={{ margin: 0 }}>
              <button
                className={`tab-btn ${tab === "ADMITTED" ? "active" : ""}`}
                onClick={() => setTab("ADMITTED")}
              >
                Active Inpatients ({admissions.filter((a) => a.status === "ADMITTED").length})
              </button>
              <button
                className={`tab-btn ${tab === "DISCHARGED" ? "active" : ""}`}
                onClick={() => setTab("DISCHARGED")}
              >
                Discharged ({admissions.filter((a) => a.status === "DISCHARGED").length})
              </button>
              <button className={`tab-btn ${tab === "ALL" ? "active" : ""}`} onClick={() => setTab("ALL")}>
                All History ({admissions.length})
              </button>
            </div>
          ) : null}
        </div>

        {/* Right: Search Box */}
        <div className="search-input-wrap" style={{ maxWidth: 260, width: "100%" }}>
          <span className="s-icon">
            <Search size={14} />
          </span>
          <input
            className="search-input"
            placeholder="Search patient, bed, IPD #…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: "0.82rem" }}
          />
        </div>
      </div>

      {/* ─── Graphical Bed Layout (Floor Plan) ─── */}
      {viewMode === "grid" ? (
        rooms.length === 0 ? (
          /* Empty State: Prompt to configure real rooms & beds */
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "48px 24px",
              background: "var(--surface-solid)",
              border: "1.5px dashed var(--border)",
              borderRadius: 16,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(13, 148, 136, 0.12)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Bed size={28} />
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px" }}>
              No Hospital Rooms or Beds Configured Yet
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: 480, margin: "0 auto 20px" }}>
              Configure your clinic or hospital&apos;s real wards (e.g. Male General Ward, ICU, Deluxe Room) and bed serial numbers
              matching the physical marks or stickers on your real beds.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowBedConfigModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={16} /> + Setup Real Rooms &amp; Beds
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filteredRooms.map((room) => {
              const roomBeds = room.beds || [];
              const occupiedInRoom = roomBeds.filter((b) => bedOccupancyMap.has(`${room.id}___${b.id}`)).length;
              const vacantInRoom = roomBeds.length - occupiedInRoom;

              // Apply bed status filter
              const visibleBeds = roomBeds.filter((b) => {
                const isOccupied = bedOccupancyMap.has(`${room.id}___${b.id}`);
                if (bedStatusFilter === "VACANT") return !isOccupied;
                if (bedStatusFilter === "OCCUPIED") return isOccupied;
                return true;
              });

              if (visibleBeds.length === 0 && bedStatusFilter !== "ALL") return null;

              return (
                <div
                  key={room.id}
                  className="card"
                  style={{
                    background: "var(--surface-solid)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: "16px 20px",
                  }}
                >
                  {/* Room Header Banner */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                      marginBottom: 14,
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div
                        style={{
                          background: "rgba(13, 148, 136, 0.12)",
                          color: "var(--primary)",
                          padding: "6px 10px",
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: "0.85rem",
                        }}
                      >
                        {room.roomCode || "WARD"}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>{room.name}</h3>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                          {room.type || "GENERAL"} · Daily Rate: ₹{room.dailyRate || 500} / day
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          background: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                          fontWeight: 700,
                        }}
                      >
                        {vacantInRoom} Available
                      </span>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 12,
                          background: "rgba(244, 63, 94, 0.1)",
                          color: "#f43f5e",
                          fontWeight: 700,
                        }}
                      >
                        {occupiedInRoom} Occupied
                      </span>
                    </div>
                  </div>

                  {/* BookMyShow Style Beds Matrix Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(125px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {visibleBeds.map((bed) => {
                      const bedKey = `${room.id}___${bed.id}`;
                      const occupant = bedOccupancyMap.get(bedKey);
                      const isOccupied = !!occupant;

                      const daysStayed = occupant
                        ? Math.max(
                            1,
                            Math.ceil(
                              (new Date().getTime() - new Date(occupant.admissionDate).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          )
                        : 0;

                      return (
                        <div
                          key={bed.id}
                          onClick={() => {
                            if (isOccupied) {
                              handleSelectOccupiedBed(occupant);
                            } else {
                              handleSelectVacantBed(room, bed);
                            }
                          }}
                          style={{
                            borderRadius: 12,
                            border: isOccupied
                              ? "1.5px solid rgba(244, 63, 94, 0.45)"
                              : "1.5px solid rgba(16, 185, 129, 0.45)",
                            background: isOccupied ? "rgba(244, 63, 94, 0.04)" : "rgba(16, 185, 129, 0.04)",
                            padding: "10px 12px",
                            cursor: "pointer",
                            transition: "all 0.18s ease-in-out",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            minHeight: 115,
                            position: "relative",
                            overflow: "hidden",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow = "0 8px 18px rgba(0,0,0,0.12)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {/* Bed Headboard Graphic Bar */}
                          <div
                            style={{
                              height: 4,
                              width: "60%",
                              margin: "0 auto 6px",
                              borderRadius: 4,
                              background: isOccupied ? "#f43f5e" : "#10b981",
                              opacity: 0.8,
                            }}
                          />

                          {/* Top: Real Bed Serial Number & Status Indicator */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: "0.92rem",
                                color: isOccupied ? "#e11d48" : "#059669",
                                letterSpacing: "0.3px",
                              }}
                            >
                              {bed.bedNumber}
                            </span>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: isOccupied ? "#f43f5e" : "#10b981",
                                boxShadow: isOccupied ? "0 0 8px #f43f5e" : "0 0 8px #10b981",
                              }}
                            />
                          </div>

                          {/* Middle: Patient / Bed Info */}
                          <div style={{ margin: "6px 0", flex: 1 }}>
                            {isOccupied ? (
                              <div>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: "0.84rem",
                                    color: "var(--text-primary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {occupant.patient?.name || (occupant as any).patientName || "Admitted"}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                                  Day {daysStayed} · ₹{occupant.cumulativeCharges}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                  {bed.label || "Available"}
                                </div>
                                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#10b981", marginTop: 2 }}>
                                  ₹{room.dailyRate || 500}/day
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bottom: Action Pill */}
                          <div
                            style={{
                              textAlign: "center",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              padding: "3px 0",
                              borderRadius: 6,
                              background: isOccupied ? "rgba(244, 63, 94, 0.12)" : "rgba(16, 185, 129, 0.12)",
                              color: isOccupied ? "#e11d48" : "#059669",
                              textTransform: "uppercase",
                              letterSpacing: "0.4px",
                            }}
                          >
                            {isOccupied ? "View Patient" : "+ Admit Here"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ─── Inpatient List Table View ─── */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredAdmissions.length === 0 ? (
            <div className="empty-state">
              <Bed />
              <h4>No Admissions Found</h4>
              <p>
                {tab === "ADMITTED"
                  ? "No patients currently admitted in the inpatient ward."
                  : "No admission history records."}
              </p>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setShowNewAdmissionModal(true)}
              >
                <Plus size={14} /> Admit Patient
              </button>
            </div>
          ) : (
            filteredAdmissions.map((adm) => {
              const isAdmitted = adm.status === "ADMITTED";
              const pName = adm.patient?.name || (adm as any).patientName || "Patient";
              const pMob = adm.patient?.mobile || (adm as any).patientMobile || "-";
              const pAge = adm.patient?.age || (adm as any).patientAge || "-";
              const pGen = adm.patient?.gender || (adm as any).patientGender || "-";
              const daysStayed = Math.max(
                1,
                Math.ceil((new Date().getTime() - new Date(adm.admissionDate).getTime()) / (1000 * 60 * 60 * 24))
              );

              return (
                <div
                  key={adm.id}
                  className="card card-sm"
                  style={{
                    cursor: "pointer",
                    borderLeft: `4px solid ${isAdmitted ? "var(--primary)" : "var(--border)"}`,
                  }}
                  onClick={() => setSelectedAdmission(adm)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: isAdmitted ? "rgba(13, 148, 136, 0.12)" : "var(--surface-2)",
                          color: isAdmitted ? "var(--primary)" : "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        <Bed size={22} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem" }}>{pName}</span>
                          <span className="badge badge-blue">Bed: {adm.bedOrRoom}</span>
                          <span className={`badge ${isAdmitted ? "badge-green" : "badge-gray"}`}>
                            {isAdmitted ? `Day ${daysStayed}` : "Discharged"}
                          </span>
                          <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                            #{adm.admissionNumber}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 3 }}>
                          {pMob} · {pAge}y/{pGen}
                          {adm.diagnosis ? ` · Dx: ${adm.diagnosis}` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                          Charges: ₹{adm.cumulativeCharges} · Advance: ₹{adm.advancePaid}
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            color: adm.balanceDue > 0 ? "#ef4444" : "#16a34a",
                          }}
                        >
                          {adm.balanceDue > 0 ? `₹${adm.balanceDue} Due` : "Settled"}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAdmission(adm);
                        }}
                      >
                        View Sheet &amp; Bill <ChevronRight size={14} />
                      </button>

                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: "var(--red)" }}
                        title="Delete admission & free bed"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAdmission(adm);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Inpatient Detail Sheet & Treatment Log Drawer ─── */}
      {selectedAdmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setSelectedAdmission(null)}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{
              background: "var(--surface-solid)",
              width: "100%",
              maxWidth: 780,
              height: "100%",
              overflowY: "auto",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--surface-1)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "1.15rem" }}>
                    {selectedAdmission.patient?.name || (selectedAdmission as any).patientName || "Patient"}
                  </span>
                  <span className="badge badge-blue">Bed: {selectedAdmission.bedOrRoom}</span>
                  <span
                    className={`badge ${
                      selectedAdmission.status === "ADMITTED" ? "badge-green" : "badge-gray"
                    }`}
                  >
                    {selectedAdmission.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                  IPD #{selectedAdmission.admissionNumber} · Admitted on{" "}
                  {new Date(selectedAdmission.admissionDate).toLocaleString("en-IN")}
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedAdmission(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
              {/* Running Bill Breakdown Card */}
              <div
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 12,
                  textAlign: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Advance Paid
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--primary)" }}>
                    ₹{selectedAdmission.advancePaid}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Daily Charges
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    ₹{selectedAdmission.cumulativeCharges}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Discount
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#16a34a" }}>
                    -₹{selectedAdmission.discount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Total Settled
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#16a34a" }}>
                    ₹{selectedAdmission.totalPaid}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Running Due
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "1.15rem",
                      color: selectedAdmission.balanceDue > 0 ? "#ef4444" : "#16a34a",
                    }}
                  >
                    ₹{selectedAdmission.balanceDue}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedAdmission.status === "ADMITTED" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowAddDayLogModal(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        <Plus size={14} /> Log Day Treatment
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowAdvanceModal(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                      >
                        <Banknote size={14} /> + Advance Deposit
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenPrintDocument(selectedAdmission)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Printer size={14} /> Print / PDF Document
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleWhatsAppShare(selectedAdmission)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "#25D366",
                      color: "#fff",
                      border: "none",
                    }}
                  >
                    <Share2 size={14} /> WhatsApp
                  </button>
                  {selectedAdmission.status === "ADMITTED" && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowDischargeModal(true)}
                      style={{ background: "var(--red)", borderColor: "var(--red)" }}
                    >
                      Discharge &amp; Settle
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteAdmission(selectedAdmission)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      color: "var(--red)",
                    }}
                    title="Delete this admission record and free bed"
                  >
                    <Trash2 size={14} /> Delete Admission
                  </button>
                </div>
              </div>

              {/* Day-Wise Treatment Log Timeline */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    Inpatient Treatment Sheet ({selectedAdmission.dayWiseLogs?.length || 0} Days Logged)
                  </div>
                </div>

                {(!selectedAdmission.dayWiseLogs || selectedAdmission.dayWiseLogs.length === 0) ? (
                  <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No day treatment logs recorded yet. Click <strong>&quot;+ Log Day Treatment&quot;</strong> above to record
                    doctor rounds, vitals &amp; procedures.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedAdmission.dayWiseLogs.map((log) => (
                      <div
                        key={log.dayNumber}
                        style={{
                          background: "var(--surface-1)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: "12px 16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span
                              style={{
                                background: "var(--primary)",
                                color: "#fff",
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: "0.75rem",
                              }}
                            >
                              Day {log.dayNumber}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {new Date(log.date).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.9rem" }}>
                            ₹{log.dailyCharges}
                          </span>
                        </div>

                        {log.doctorNotes && (
                          <div style={{ fontSize: "0.84rem", marginBottom: 4 }}>
                            <strong style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Doctor Notes: </strong>
                            {log.doctorNotes}
                          </div>
                        )}

                        {log.nursingNotes && (
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 4 }}>
                            <strong>Nursing &amp; Vitals: </strong>
                            {log.nursingNotes}
                          </div>
                        )}

                        {log.medicinesAdministered && (
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 4 }}>
                            <strong>Meds Administered: </strong>
                            {log.medicinesAdministered}
                          </div>
                        )}

                        {log.procedures && log.procedures.length > 0 && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                            {log.procedures.map((p, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: "var(--surface-2)",
                                  border: "1px solid var(--border)",
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {p.name} (₹{p.totalPrice})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Real Hospital Rooms & Beds Configurator Modal ─── */}
      {showBedConfigModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowBedConfigModal(false)}
        >
          <div
            style={{
              background: "var(--surface-solid)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 780,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowBedConfigModal(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <SettingsIpdRooms isModal={true} onSaved={() => setShowBedConfigModal(false)} />
          </div>
        </div>
      )}

      {/* ─── New Inpatient Admission Modal (Smart Real Bed Selector) ─── */}
      {showNewAdmissionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowNewAdmissionModal(false)}
        >
          <div
            style={{
              background: "var(--surface-solid)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 540,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
                <Bed size={18} style={{ color: "var(--primary)" }} /> Inpatient Admission Entry
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowNewAdmissionModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Select Patient */}
            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Select Patient <span style={{ color: "var(--red)" }}>*</span>
              </label>
              {selectedPatient ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "var(--surface-1)",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                      {selectedPatient.mobile} · {selectedPatient.gender}, {selectedPatient.age}y
                    </div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelectedPatient(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    placeholder="Search patient by name or mobile…"
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                  />
                  {patientResults.length > 0 && (
                    <div className="search-dropdown">
                      {patientResults.map((p) => (
                        <div
                          key={p.id}
                          className="search-result"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientQuery("");
                            setPatientResults([]);
                          }}
                        >
                          <div className="sr-name">{p.name}</div>
                          <div className="sr-meta">
                            {p.mobile} · {p.gender}, {p.age}y
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bed / Room Selector (Select from Real Configured Vacant Beds or Enter Custom) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Select Hospital Bed / Room <span style={{ color: "var(--red)" }}>*</span>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setShowNewAdmissionModal(false);
                    setShowBedConfigModal(true);
                  }}
                  style={{ fontSize: "0.72rem", color: "var(--primary)" }}
                >
                  + Setup / Manage Beds
                </button>
              </div>

              {rooms.length === 0 ? (
                <div
                  style={{
                    background: "var(--surface-1)",
                    border: "1px dashed var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: 6 }}>
                    No hospital wards or beds configured yet. Setup your real rooms or enter custom bed roll number below:
                  </div>
                  <input
                    className="form-input"
                    placeholder="e.g. Ward A - Bed 01, Room 204"
                    value={admissionForm.customBedText}
                    onChange={(e) =>
                      setAdmissionForm((f) => ({ ...f, isCustomBed: true, customBedText: e.target.value }))
                    }
                  />
                </div>
              ) : vacantBedOptions.length > 0 ? (
                <div>
                  <select
                    className="form-select"
                    value={admissionForm.isCustomBed ? "__CUSTOM__" : admissionForm.bedOrRoom}
                    onChange={(e) => {
                      if (e.target.value === "__CUSTOM__") {
                        setAdmissionForm((f) => ({ ...f, isCustomBed: true, bedOrRoom: "" }));
                      } else {
                        setAdmissionForm((f) => ({
                          ...f,
                          isCustomBed: false,
                          customBedText: "",
                          bedOrRoom: e.target.value,
                        }));
                      }
                    }}
                  >
                    <option value="">-- Choose Vacant Hospital Bed --</option>
                    {vacantBedOptions.map((opt, idx) => (
                      <option key={idx} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    <option value="__CUSTOM__">➕ Enter Custom Bed Number (e.g. Extra Cot)</option>
                  </select>

                  {admissionForm.isCustomBed && (
                    <input
                      className="form-input"
                      style={{ marginTop: 8 }}
                      placeholder="Enter real custom bed serial or roll number"
                      value={admissionForm.customBedText}
                      onChange={(e) =>
                        setAdmissionForm((f) => ({ ...f, customBedText: e.target.value }))
                      }
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "0.76rem", color: "#ef4444", marginBottom: 6, fontWeight: 600 }}>
                    All configured beds are currently occupied!
                  </div>
                  <input
                    className="form-input"
                    placeholder="Enter extra bed number (e.g. Extra Cot 01)"
                    value={admissionForm.customBedText}
                    onChange={(e) =>
                      setAdmissionForm((f) => ({ ...f, isCustomBed: true, customBedText: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Admission Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={admissionForm.admissionDate}
                  onChange={(e) => setAdmissionForm((f) => ({ ...f, admissionDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Attending Doctor</label>
                <input
                  className="form-input"
                  placeholder="Doctor Name"
                  value={admissionForm.attendingDoctor}
                  onChange={(e) => setAdmissionForm((f) => ({ ...f, attendingDoctor: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Initial Diagnosis / Reason for Admission</label>
              <input
                className="form-input"
                placeholder="e.g. Acute Gastroenteritis, Dengue with Thrombocytopenia"
                value={admissionForm.diagnosis}
                onChange={(e) => setAdmissionForm((f) => ({ ...f, diagnosis: e.target.value }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Advance Deposit (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  value={admissionForm.advancePaid}
                  onChange={(e) => setAdmissionForm((f) => ({ ...f, advancePaid: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Payment Mode</label>
                <select
                  className="form-select"
                  value={admissionForm.advancePaymentMethod}
                  onChange={(e) => setAdmissionForm((f) => ({ ...f, advancePaymentMethod: e.target.value as any }))}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI (QR Code)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowNewAdmissionModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreateAdmission}>
                Admit Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Day Log Modal ─── */}
      {showAddDayLogModal && selectedAdmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowAddDayLogModal(false)}
        >
          <div
            style={{
              background: "var(--surface-solid)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                Log Treatment: Day {(selectedAdmission.dayWiseLogs || []).length + 1}
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowAddDayLogModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Date of Treatment</label>
              <input
                type="date"
                className="form-input"
                value={dayLogForm.date}
                onChange={(e) => setDayLogForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Doctor Rounds &amp; Clinical Progress</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Afebrile today, hydration improved, lungs clear."
                value={dayLogForm.doctorNotes}
                onChange={(e) => setDayLogForm((f) => ({ ...f, doctorNotes: e.target.value }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.7rem" }}>BP</label>
                <input
                  className="form-input"
                  placeholder="e.g. 120/80"
                  value={dayLogForm.vitals.bp}
                  onChange={(e) => setDayLogForm((f) => ({ ...f, vitals: { ...f.vitals, bp: e.target.value } }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: "0.7rem" }}>Pulse (bpm)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 76"
                  value={dayLogForm.vitals.pulse}
                  onChange={(e) => setDayLogForm((f) => ({ ...f, vitals: { ...f.vitals, pulse: e.target.value } }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: "0.7rem" }}>Temp (°F)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 98.4"
                  value={dayLogForm.vitals.temp}
                  onChange={(e) => setDayLogForm((f) => ({ ...f, vitals: { ...f.vitals, temp: e.target.value } }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: "0.7rem" }}>SpO2 (%)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 99"
                  value={dayLogForm.vitals.spo2}
                  onChange={(e) => setDayLogForm((f) => ({ ...f, vitals: { ...f.vitals, spo2: e.target.value } }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Medicines Administered</label>
              <input
                className="form-input"
                placeholder="e.g. Inj. Ceftriaxone 1g IV, Inj. Pantop 40mg IV"
                value={dayLogForm.medicinesAdministered}
                onChange={(e) => setDayLogForm((f) => ({ ...f, medicinesAdministered: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Procedure / Treatment Given
                </label>
                {availableProcedures.length > 0 && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    Real configured clinic rates
                  </span>
                )}
              </div>

              {availableProcedures.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <select
                    className="form-select"
                    style={{ fontSize: "0.82rem", height: 32 }}
                    onChange={(e) => {
                      const found = availableProcedures.find((p) => p.name === e.target.value);
                      if (found) {
                        setDayLogForm((f) => ({
                          ...f,
                          procedureName: found.name,
                          procedureCharge: String(found.price),
                        }));
                      }
                    }}
                  >
                    <option value="">-- Quick Select Configured Clinic Procedure --</option>
                    {availableProcedures.map((proc, idx) => (
                      <option key={idx} value={proc.name}>
                        {proc.name} (₹{proc.price})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                <input
                  className="form-input"
                  placeholder="e.g. IV Fluid Saline 500ml, Nebulization"
                  value={dayLogForm.procedureName}
                  onChange={(e) => setDayLogForm((f) => ({ ...f, procedureName: e.target.value }))}
                />
                <input
                  type="number"
                  className="form-input"
                  placeholder="Charges (₹)"
                  value={dayLogForm.procedureCharge}
                  onChange={(e) => setDayLogForm((f) => ({ ...f, procedureCharge: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddDayLogModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleAddDayLog}>
                Save Day Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Interim Advance Deposit Modal ─── */}
      {showAdvanceModal && selectedAdmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowAdvanceModal(false)}
        >
          <div
            style={{
              background: "var(--surface-solid)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 420,
              width: "100%",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Record Advance Deposit</div>
              <button type="button" className="btn-icon" onClick={() => setShowAdvanceModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Deposit Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 2000"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdvanceModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleRecordAdvance}>
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Discharge & Final Bill Settlement Modal ─── */}
      {showDischargeModal && selectedAdmission && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowDischargeModal(false)}
        >
          <div
            style={{
              background: "var(--surface-solid)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 580,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Discharge &amp; Final Bill Settlement</div>
              <button type="button" className="btn-icon" onClick={() => setShowDischargeModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Financial Overview Banner */}
            <div
              style={{
                background: "var(--surface-1)",
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Running Charges</div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>₹{selectedAdmission.cumulativeCharges}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Already Paid</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#16a34a" }}>₹{selectedAdmission.totalPaid}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Net Balance Due</div>
                <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#ef4444" }}>
                  ₹{selectedAdmission.balanceDue}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Discharge Date &amp; Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={dischargeForm.dischargeDate}
                onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeDate: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Discharge Summary / Hospital Course
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                    onClick={() =>
                      setDischargeForm((f) => ({
                        ...f,
                        dischargeSummary: "Patient recovered satisfactorily. Afebrile and vitals stable at discharge.",
                      }))
                    }
                  >
                    + Satisfactory Recovery
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                    onClick={() =>
                      setDischargeForm((f) => ({
                        ...f,
                        dischargeSummary: "Patient hemodynamically stable. Discharged on patient / attender request.",
                      }))
                    }
                  >
                    + Stable on Request
                  </button>
                </div>
              </div>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Enter patient course during admission, clinical recovery, or procedure notes..."
                value={dischargeForm.dischargeSummary}
                onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeSummary: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Discharge Prescription / Home Medications</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Tab. Cefixime 200mg 1-0-1 for 5 days&#10;Tab. Pantop 40mg 1-0-0 for 5 days"
                value={dischargeForm.dischargeMedications}
                onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeMedications: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                  Discharge Advice &amp; Follow-Up Instructions
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                    onClick={() =>
                      setDischargeForm((f) => ({
                        ...f,
                        dischargeNotes: "Review in OPD after 5-7 days or SOS in case of acute symptoms.",
                      }))
                    }
                  >
                    + Review in 5-7d
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: "0.7rem", padding: "1px 6px" }}
                    onClick={() =>
                      setDischargeForm((f) => ({
                        ...f,
                        dischargeNotes: "Strict bed rest, light diet, plenty of fluids. Review with fresh reports.",
                      }))
                    }
                  >
                    + Rest &amp; Diet
                  </button>
                </div>
              </div>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Review in OPD after 5 days, wound care, diet advice, warning signs..."
                value={dischargeForm.dischargeNotes}
                onChange={(e) => setDischargeForm((f) => ({ ...f, dischargeNotes: e.target.value }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Discount (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={dischargeForm.discount}
                  onChange={(e) => setDischargeForm((f) => ({ ...f, discount: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Settlement Mode</label>
                <select
                  className="form-select"
                  value={dischargeForm.paymentMethod}
                  onChange={(e) => setDischargeForm((f) => ({ ...f, paymentMethod: e.target.value as any }))}
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI (QR Code)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowDischargeModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDischarge}>
                Complete Discharge
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
