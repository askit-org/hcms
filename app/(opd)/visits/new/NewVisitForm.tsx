"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Search,
  Stethoscope,
  Pill,
  X,
  Sun,
  Moon,
  Sunrise,
  HeartPulse,
  History,
  Copy,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Check,
  CalendarCheck,
  Bed,
  Building,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useProviderStore } from "@/lib/providers";
import {
  useMedicines,
  useMedicineMutations,
  useVisitMutations,
  usePatient,
  usePatientVisits,
  useAppOptions,
  useTemplates,
  useAppOptionMutations,
  useQueue,
  useQueueMutations,
  useIpdAdmissions,
  useIpdMutations,
  useSettings,
} from "@/lib/hooks/useQueries";
import { useAuth } from "@/lib/hooks/useAuth";
import type {
  Patient,
  Medicine,
  PrescribedMedicine,
  Template,
  IpdAdmission,
  IpdRoom,
  IpdBed,
  IpdDayLog,
} from "@/lib/providers/types";
import { toast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/utils/error";
import PageTransition from "@/components/PageTransition";
import { motion, AnimatePresence } from "framer-motion";
import VoiceInputButton from "@/components/VoiceInputButton";
import InstructionPicker from "@/components/InstructionPicker";
import DoseSelector, { DurationSelect } from "@/components/DoseSelector";
import ChiefComplaintsPicker from "@/components/ChiefComplaintsPicker";
import { parseDoseToWords } from "@/lib/medicationInstructions";
import { visitSchema, validateForm } from "@/lib/validations/schemas";
import ConfirmModal from "@/components/ConfirmModal";
import CreateBillModal from "@/components/CreateBillModal";
import IpdDayLogModal from "@/components/IpdDayLogModal";
import SettingsIpdRooms from "@/components/SettingsIpdRooms";

const QUICK_COMPLAINTS = [
  "Fever",
  "Cough",
  "Cold",
  "Body Ache",
  "Headache",
  "Vomiting",
  "Diarrhoea",
  "Chest Pain",
  "Breathlessness",
  "Sore Throat",
  "Fatigue",
  "Dizziness",
  "Abdominal Pain",
  "Joint Pain",
];

const DOSE_OPTIONS = [
  "1-0-1",
  "1-1-1",
  "0-0-1",
  "1-0-0",
  "0-1-0",
  "1/2-0-1/2",
  "SOS",
  "As needed",
  "Stat",
];
const DURATION_OPTIONS = [
  "1 day",
  "3 days",
  "5 days",
  "7 days",
  "10 days",
  "14 days",
  "30 days",
  "90 days",
];

export default function NewVisitForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const prePatientId = sp.get("patientId") || "";

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medQuery, setMedQuery] = useState("");
  const [rxMeds, setRxMeds] = useState<PrescribedMedicine[]>([]);
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [savedVisitInfo, setSavedVisitInfo] = useState<{
    id: string;
    date: string;
  } | null>(null);
  const [showBillingPrompt, setShowBillingPrompt] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  const todayISO = new Date().toISOString().slice(0, 10);
  const [visitDate, setVisitDate] = useState<string>(todayISO);

  const [form, setForm] = useState({
    category: "",
    chiefComplaints: "",
    diagnosis: "",
    bp: "",
    pulse: "",
    temp: "",
    spo2: "",
    weight: "",
    treatment: "",
    prescriptionNotes: "",
    followUpDate: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const provider = useProviderStore((s) => s.provider);
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { create: createVisit } = useVisitMutations();
  const { createAdmission } = useIpdMutations();
  const { data: activeAdmissions = [] } = useIpdAdmissions({
    status: "ADMITTED",
  });
  const { create: createOption } = useAppOptionMutations();
  const { data: medicinesData = [] } = useMedicines();
  const { data: complaintOptions = [] } = useAppOptions("CHIEF_COMPLAINT");
  const { data: diseaseOptions = [] } = useAppOptions("DISEASE");
  const { data: categoryOptions = [] } = useAppOptions("CATEGORY");
  const { data: templates = [] } = useTemplates();
  const { data: dbQueue, refetch: refetchQueue } = useQueue();
  const { updateStatus: updateStatusMut, removeFromQueue: removeMut } =
    useQueueMutations();

  // IPD Encounter Integration State
  const [isIpdAdmission, setIsIpdAdmission] = useState(false);
  const [ipdForm, setIpdForm] = useState({
    bedOrRoom: "",
    customBedText: "",
    isCustomBed: false,
    admissionDate: new Date().toISOString().slice(0, 16),
    diagnosis: "",
    attendingDoctor: "",
    advancePaid: "",
    advancePaymentMethod: "CASH" as "CASH" | "UPI",
  });
  const [selectedWardFilter, setSelectedWardFilter] = useState("ALL");
  const [showBedConfigModal, setShowBedConfigModal] = useState(false);
  const [showAdmissionSuccessModal, setShowAdmissionSuccessModal] =
    useState(false);
  const [newlyAdmittedRecord, setNewlyAdmittedRecord] =
    useState<IpdAdmission | null>(null);
  const [showDay1LogModal, setShowDay1LogModal] = useState(false);

  // Sync default attending doctor
  useEffect(() => {
    if (
      !ipdForm.attendingDoctor &&
      (user?.doctorName || settings?.doctorName)
    ) {
      setIpdForm((f) => ({
        ...f,
        attendingDoctor: user?.doctorName || settings?.doctorName || "",
      }));
    }
  }, [user?.doctorName, settings?.doctorName, ipdForm.attendingDoctor]);

  // Sync diagnosis from OPD form
  useEffect(() => {
    if (form.diagnosis && !ipdForm.diagnosis) {
      setIpdForm((f) => ({ ...f, diagnosis: form.diagnosis }));
    }
  }, [form.diagnosis, ipdForm.diagnosis]);

  // 100% Real Hospital Rooms & Beds
  const rooms: IpdRoom[] = useMemo(() => {
    if (settings?.ipdRooms && Array.isArray(settings.ipdRooms)) {
      return settings.ipdRooms;
    }
    return [];
  }, [settings?.ipdRooms]);

  // Bed Occupancy Map (Strict matching against active admissions)
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

          if (admBed === `${roomName} - bed ${bedNum}`) return true;
          if (admBed === `${roomName} - ${bedNum}`) return true;
          if (
            roomCode &&
            (admBed === `${roomCode} - bed ${bedNum}` ||
              admBed === `${roomCode} - ${bedNum}` ||
              admBed === `${roomCode}${bedNum}`)
          )
            return true;
          if (admBed === `bed ${bedNum}` || admBed === bedNum) return true;

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

  // Real Vacant Beds
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

  const activeComplaints = [
    ...new Set([...QUICK_COMPLAINTS, ...complaintOptions.map((o) => o.value)]),
  ];
  const activeDiseases = diseaseOptions.map((o) => o.value);
  const [showExitModal, setShowExitModal] = useState(false);
  const [hideTreatmentInRx, setHideTreatmentInRx] = useState(false);

  // Requirement 1: Previous visit clinical history
  const { data: pastVisits = [] } = usePatientVisits(
    selectedPatient?.patientId || "",
  );
  const lastVisit = pastVisits && pastVisits.length > 0 ? pastVisits[0] : null;
  const [showHistoryPanel, setShowHistoryPanel] = useState(true);

  // Requirement 8: Multi-day OPD Treatment logs state
  const [dayWiseTreatments, setDayWiseTreatments] = useState<
    Array<{
      dayNumber: number;
      date: string;
      notes?: string;
      treatment?: string;
      procedures: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }>;
      charges: number;
    }>
  >([]);
  const [showMultiDaySection, setShowMultiDaySection] = useState(false);
  const [newDayNotes, setNewDayNotes] = useState("");
  const [newDayTreatment, setNewDayTreatment] = useState("");
  const [newDayCharge, setNewDayCharge] = useState("");

  const handleCopyLastPrescriptions = () => {
    if (!lastVisit?.medicines || lastVisit.medicines.length === 0) {
      toast("No previous medicines found on last visit.", "info");
      return;
    }
    const newMeds: PrescribedMedicine[] = lastVisit.medicines.map((m) => ({
      name: m.name,
      dose: m.dose || "1-0-1",
      duration: m.duration || "5 days",
      instructions: m.instructions || "",
      category: m.category || "Other",
      strength: m.strength,
      unit: m.unit,
    }));
    setRxMeds((prev) => [...prev, ...newMeds]);
    toast(
      `Copied ${newMeds.length} medicines from visit dated ${new Date(lastVisit.date).toLocaleDateString("en-IN")}`,
      "success",
    );
  };

  const handleCopyLastVitals = () => {
    if (!lastVisit) return;
    setForm((f) => ({
      ...f,
      bp: lastVisit.bp || f.bp,
      pulse: lastVisit.pulse || f.pulse,
      temp: lastVisit.temp || f.temp,
      spo2: lastVisit.spo2 || f.spo2,
      weight: lastVisit.weight || f.weight,
    }));
    toast("Copied previous vitals", "success");
  };

  const handleCopyLastDiagnosis = () => {
    if (!lastVisit?.diagnosis) return;
    setForm((f) => ({
      ...f,
      diagnosis: f.diagnosis
        ? `${f.diagnosis}, ${lastVisit.diagnosis}`
        : lastVisit.diagnosis,
    }));
    toast("Copied last diagnosis", "success");
  };

  const handleAddDayTreatment = () => {
    const charge = parseFloat(newDayCharge) || 0;
    const nextDayNum = dayWiseTreatments.length + 1;
    const newEntry = {
      dayNumber: nextDayNum,
      date: new Date().toISOString().slice(0, 10),
      notes: newDayNotes.trim() || undefined,
      treatment: newDayTreatment.trim() || undefined,
      procedures: newDayTreatment.trim()
        ? [
            {
              name: newDayTreatment.trim(),
              quantity: 1,
              unitPrice: charge,
              totalPrice: charge,
            },
          ]
        : [],
      charges: charge,
    };
    setDayWiseTreatments((prev) => [...prev, newEntry]);
    setNewDayNotes("");
    setNewDayTreatment("");
    setNewDayCharge("");
    toast(`Added Day ${nextDayNum} treatment entry`, "success");
  };

  const handleRemoveDayTreatment = (idx: number) => {
    setDayWiseTreatments((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, dayNumber: i + 1 })),
    );
  };

  useEffect(() => {
    try {
      const pref = localStorage.getItem("hcms_pref_hide_treatment_in_rx");
      if (pref !== null) {
        setHideTreatmentInRx(JSON.parse(pref));
      }
    } catch (e) {}
  }, []);

  const handleToggleHideTreatment = (checked: boolean) => {
    setHideTreatmentInRx(checked);
    try {
      localStorage.setItem(
        "hcms_pref_hide_treatment_in_rx",
        JSON.stringify(checked),
      );
    } catch (e) {}
  };

  const hasFormChanges = Boolean(
    !savedVisitInfo &&
    (selectedPatient ||
      form.chiefComplaints ||
      form.diagnosis ||
      form.treatment ||
      form.prescriptionNotes ||
      rxMeds.length > 0 ||
      isIpdAdmission ||
      ipdForm.bedOrRoom ||
      ipdForm.customBedText),
  );

  const handleSubmitRef = useRef<any>(null);

  useEffect(() => {
    (window as any).__hcms_has_unsaved_visit = hasFormChanges;
    (window as any).__hcms_save_visit_handler = (e?: any) => {
      const fakeEvent = e || { preventDefault: () => {} };
      return handleSubmitRef.current
        ? handleSubmitRef.current(fakeEvent)
        : Promise.resolve(false);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasFormChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved visit changes.";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      (window as any).__hcms_has_unsaved_visit = false;
      delete (window as any).__hcms_save_visit_handler;
    };
  }, [hasFormChanges]);

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasFormChanges) {
      setShowExitModal(true);
    } else {
      router.push("/patients");
    }
  };

  // Load pre-selected patient if URL param exists
  useEffect(() => {
    if (!prePatientId) return;
    provider.getPatient(prePatientId).then((p) => {
      if (p) setSelectedPatient(p);
    });
  }, [prePatientId, provider]);

  // Patient search
  useEffect(() => {
    if (!patientQuery.trim()) {
      setPatientResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data: r } = await provider.listPatients({
        search: patientQuery,
        limit: 6,
      });
      setPatientResults(r.slice(0, 6));
    }, 200);
    return () => clearTimeout(t);
  }, [patientQuery, provider]);

  const toggleComplaint = (c: string) => {
    setSelectedComplaints((prev) => {
      const isSelected = prev.includes(c);
      const next = isSelected ? prev.filter((x) => x !== c) : [...prev, c];

      // Update the chiefComplaints string
      let currentText = form.chiefComplaints;
      if (!isSelected) {
        // Add
        if (currentText && !currentText.trim().endsWith(",")) {
          currentText += ", " + c;
        } else if (currentText) {
          currentText += " " + c;
        } else {
          currentText = c;
        }
      } else {
        // Remove - handle various delimiters and spaces
        const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(^|,\\s*)${escaped}(?=\\s*,|$)`, "g");
        currentText = currentText
          .replace(regex, "")
          .replace(/^,\s*/, "")
          .replace(/,\s*$/, "")
          .replace(/,\s*,/g, ",");
      }

      setForm((f) => ({ ...f, chiefComplaints: currentText.trim() }));
      return next;
    });
  };

  const syncComplaints = (val: string) => {
    set("chiefComplaints", val);
    const active = activeComplaints.filter((c) =>
      val.toLowerCase().includes(c.toLowerCase()),
    );
    setSelectedComplaints(active);
  };

  const applyTemplate = (tId: string) => {
    if (!tId) return;
    const t = templates.find((x) => x.id?.toString() === tId);
    if (!t) return;

    setForm((f) => ({
      ...f,
      diagnosis: f.diagnosis ? `${f.diagnosis}, ${t.diagnosis}` : t.diagnosis,
      prescriptionNotes: f.prescriptionNotes
        ? `${f.prescriptionNotes}\n${t.notes || ""}`
        : t.notes || "",
    }));

    if (t.medicines && Array.isArray(t.medicines)) {
      setRxMeds((prev) => [...prev, ...t.medicines!]);
    }
    toast("Template applied", "success");
  };

  const addMedicine = (m: Medicine) => {
    setRxMeds((prev) => [
      ...prev,
      {
        medicineId: m.id,
        name: m.name,
        dose: m.defaultDose,
        duration: m.defaultDuration,
        instructions: "",
      },
    ]);
    setMedQuery("");
  };

  const updateMed = (i: number, k: keyof PrescribedMedicine, v: string) => {
    setRxMeds((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)),
    );
  };

  const removeMed = (i: number) =>
    setRxMeds((prev) => prev.filter((_, idx) => idx !== i));

  const { create: createMedMut } = useMedicineMutations();

  const handleAddNewMedicineDirectly = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const newMed = await createMedMut.mutateAsync({
        name: trimmed,
        category: "Other",
        defaultDose: "1-0-1",
        defaultDuration: "5 days",
      });
      addMedicine(newMed);
      toast(`Added "${trimmed}" to prescription & master list.`, "success");
    } catch (err) {
      // Fallback: add directly to current prescription even if saving to DB fails
      addMedicine({
        name: trimmed,
        category: "Other",
        defaultDose: "1-0-1",
        defaultDuration: "5 days",
      });
    }
  };

  const filteredMeds = medicinesData
    .filter(
      (m) =>
        m.name.toLowerCase().includes(medQuery.toLowerCase()) &&
        !rxMeds.find((r) => r.name === m.name),
    )
    .slice(0, 50);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const scrollToError = (fieldName: string) => {
    setTimeout(() => {
      const el = document.querySelector(
        `[data-field="${fieldName}"]`,
      ) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }, 50);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const visitPayload = {
      patientId: selectedPatient?.patientId || "",
      category: form.category,
      chiefComplaints: form.chiefComplaints,
      diagnosis: form.diagnosis,
      bp: form.bp,
      pulse: form.pulse,
      temp: form.temp,
      spo2: form.spo2,
      weight: form.weight,
    };

    const { isValid, errors: validationErrors } = await validateForm(
      visitSchema,
      visitPayload,
    );
    const newErrors: Record<string, string> = {
      ...(validationErrors as Record<string, string>),
    };

    if (!selectedPatient) {
      newErrors.patient = "Please search and select a patient first.";
    }

    if (isIpdAdmission) {
      const chosenBed = ipdForm.isCustomBed
        ? ipdForm.customBedText.trim()
        : ipdForm.bedOrRoom.trim();
      if (!chosenBed) {
        newErrors.ipdBed =
          "Please select a hospital bed or enter a room for IPD admission.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorField = Object.keys(newErrors)[0];
      if (firstErrorField && newErrors[firstErrorField]) {
        toast(newErrors[firstErrorField], "error");
        scrollToError(
          firstErrorField === "ipdBed" ? "ipd-bed" : firstErrorField,
        );
      }
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const now = new Date();
      let visitDateTime = now.toISOString();
      if (visitDate && visitDate !== todayISO) {
        const [y, m, d] = visitDate.split("-").map(Number);
        const customDate = new Date(
          y,
          m - 1,
          d,
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
        );
        visitDateTime = customDate.toISOString();
      }

      const savedVisit = await createVisit.mutateAsync({
        patientId: selectedPatient!.patientId,
        category: form.category || (isIpdAdmission ? "IPD" : "OPD"),
        date: visitDateTime,
        chiefComplaints: form.chiefComplaints.trim(),
        diagnosis: form.diagnosis.trim(),
        bp: form.bp.trim() || undefined,
        pulse: form.pulse.trim() || undefined,
        temp: form.temp.trim() || undefined,
        spo2: form.spo2.trim() || undefined,
        weight: form.weight.trim() || undefined,
        treatment: form.treatment.trim() || undefined,
        hideTreatmentInRx,
        prescriptionNotes: form.prescriptionNotes.trim() || undefined,
        medicines: rxMeds,
        followUpDate: form.followUpDate || undefined,
        followUpAttended: false,
        followUpStatus: "PENDING",
        dayWiseTreatments:
          dayWiseTreatments.length > 0 ? dayWiseTreatments : undefined,
      });

      if (savedVisit?.id) {
        if (hideTreatmentInRx) {
          localStorage.setItem(`hcms_hide_tx_${savedVisit.id}`, "true");
        } else {
          localStorage.removeItem(`hcms_hide_tx_${savedVisit.id}`);
        }
      }

      // Check if patient is in queue and dequeue
      if (Array.isArray(dbQueue)) {
        const queuedPatient = dbQueue.find(
          (q: any) => q.patientId === selectedPatient!.patientId,
        );
        if (queuedPatient) {
          try {
            await updateStatusMut.mutateAsync({
              id: queuedPatient.id,
              status: "COMPLETED",
            });
            await removeMut.mutateAsync(queuedPatient.id);
            await refetchQueue();
          } catch (e) {
            console.error("Failed to dequeue patient", e);
          }
        }
      }

      let admittedAdmission: IpdAdmission | null = null;
      if (isIpdAdmission) {
        const chosenBed = ipdForm.isCustomBed
          ? ipdForm.customBedText.trim()
          : ipdForm.bedOrRoom.trim();
        try {
          admittedAdmission = await createAdmission.mutateAsync({
            patientId: selectedPatient!.patientId,
            bedOrRoom: chosenBed,
            diagnosis:
              ipdForm.diagnosis.trim() ||
              form.diagnosis.trim() ||
              "Inpatient Admission",
            attendingDoctor:
              ipdForm.attendingDoctor.trim() ||
              user?.doctorName ||
              settings?.doctorName ||
              undefined,
            admissionDate: ipdForm.admissionDate
              ? new Date(ipdForm.admissionDate).toISOString()
              : visitDateTime,
            advancePaid: parseFloat(ipdForm.advancePaid) || 0,
          });
        } catch (ipdErr: any) {
          console.error("Failed to create IPD admission", ipdErr);
          toast(
            getErrorMessage(
              ipdErr,
              "OPD Visit saved, but failed to create IPD admission.",
            ),
            "error",
          );
        }
      }

      (window as any).__hcms_has_unsaved_visit = false;
      setSavedVisitInfo({ id: String(savedVisit.id), date: visitDateTime });

      if (isIpdAdmission && admittedAdmission) {
        setNewlyAdmittedRecord(admittedAdmission);
        toast(
          `Patient admitted to ${admittedAdmission.bedOrRoom} & OPD Visit saved!`,
          "success",
        );
        setShowAdmissionSuccessModal(true);
      } else {
        toast("OPD Visit saved successfully!", "success");
        setShowBillingPrompt(true);
      }
      setSaving(false);
      return true;
    } catch (err: any) {
      toast(getErrorMessage(err, "Failed to save visit."), "error");
      setSaving(false);
      return false;
    }
  };
  handleSubmitRef.current = handleSubmit;

  return (
    <PageTransition
      className="page-transition"
      style={{ maxWidth: 900, margin: "0 auto" }}
    >
      <div className="page-header">
        <div>
          <button
            type="button"
            onClick={handleCancelClick}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              marginBottom: 6,
            }}
          >
            <ChevronLeft size={15} /> Back
          </button>
          <div className="page-title">New Visit</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Patient Selection */}
        <div
          className="card"
          style={{ marginBottom: 16, position: "relative", zIndex: 50 }}
        >
          <div className="card-title" style={{ marginBottom: 12 }}>
            Patient
          </div>
          {selectedPatient ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  background: "var(--surface-1)",
                  borderRadius: 10,
                  padding: "12px 16px",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="followup-avatar">
                  {selectedPatient.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{selectedPatient.name}</div>
                  <div
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {selectedPatient.mobile} · {selectedPatient.gender},{" "}
                    {selectedPatient.age}y
                  </div>
                  {selectedPatient.permanentConditions &&
                    selectedPatient.permanentConditions.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 6,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--amber)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <HeartPulse size={12} /> Conditions:
                        </span>
                        {selectedPatient.permanentConditions.map((cond) => (
                          <span
                            key={cond}
                            className="badge badge-amber"
                            style={{ fontSize: "0.72rem", padding: "2px 8px" }}
                          >
                            {cond}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedPatient(null)}
                >
                  Change
                </button>
              </div>

              {lastVisit && (
                <div
                  style={{
                    marginTop: 12,
                    background: "rgba(59, 130, 246, 0.05)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    borderRadius: 10,
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: "#1d4ed8",
                      }}
                    >
                      <Clock size={16} /> Previous Visit:{" "}
                      {new Date(lastVisit.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {lastVisit.diagnosis && (
                        <span
                          className="badge badge-blue"
                          style={{ fontSize: "0.72rem" }}
                        >
                          {lastVisit.diagnosis}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowHistoryPanel(!showHistoryPanel)}
                      style={{ fontSize: "0.75rem" }}
                    >
                      {showHistoryPanel
                        ? "Hide History"
                        : "View History & Copy"}
                    </button>
                  </div>

                  {showHistoryPanel && (
                    <div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: 10,
                          fontSize: "0.8rem",
                          marginBottom: 10,
                        }}
                      >
                        {lastVisit.chiefComplaints && (
                          <div>
                            <span
                              style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: "0.72rem",
                              }}
                            >
                              Complaints:
                            </span>
                            <span style={{ fontWeight: 500 }}>
                              {lastVisit.chiefComplaints}
                            </span>
                          </div>
                        )}
                        {(lastVisit.bp ||
                          lastVisit.pulse ||
                          lastVisit.temp ||
                          lastVisit.weight) && (
                          <div>
                            <span
                              style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: "0.72rem",
                              }}
                            >
                              Vitals:
                            </span>
                            <span>
                              BP: {lastVisit.bp || "-"} · Pulse:{" "}
                              {lastVisit.pulse || "-"} · Temp:{" "}
                              {lastVisit.temp || "-"} · Wt:{" "}
                              {lastVisit.weight || "-"}kg
                            </span>
                          </div>
                        )}
                        {lastVisit.medicines &&
                          lastVisit.medicines.length > 0 && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  display: "block",
                                  fontSize: "0.72rem",
                                  marginBottom: 4,
                                }}
                              >
                                Last Prescribed Medicines (
                                {lastVisit.medicines.length}):
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                }}
                              >
                                {lastVisit.medicines.map((m, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      background: "var(--surface-solid)",
                                      border: "1px solid var(--border)",
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    <strong>{m.name}</strong> {m.dose} (
                                    {m.duration})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          borderTop: "1px solid rgba(59, 130, 246, 0.15)",
                          paddingTop: 8,
                        }}
                      >
                        {lastVisit.medicines &&
                          lastVisit.medicines.length > 0 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={handleCopyLastPrescriptions}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Copy size={13} /> Copy All Prescriptions
                            </button>
                          )}
                        {(lastVisit.bp ||
                          lastVisit.pulse ||
                          lastVisit.temp) && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={handleCopyLastVitals}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Copy size={13} /> Copy Vitals
                          </button>
                        )}
                        {lastVisit.diagnosis && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={handleCopyLastDiagnosis}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Copy size={13} /> Copy Diagnosis
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: "relative", zIndex: 100 }}>
              <div className="search-input-wrap">
                <span className="s-icon">
                  <Search />
                </span>
                <input
                  className="search-input"
                  placeholder="Search patient by name or mobile…"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
              </div>
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
              <div
                style={{
                  textAlign: "center",
                  marginTop: 8,
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                }}
              >
                Patient not found?{" "}
                <Link
                  href="/patients/new"
                  style={{ color: "var(--accent-light)" }}
                >
                  Register new patient
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Visit Details & Encounter Type */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div className="card-title" style={{ margin: 0 }}>
              Visit Details &amp; Encounter Type
            </div>
            {isIpdAdmission && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  padding: "3px 10px",
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                }}
              >
                <Bed size={14} /> Inpatient Admission Mode Active
              </span>
            )}
          </div>

          {/* Interactive Encounter Mode Selector Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              onClick={() => {
                set("category", "OPD");
                setIsIpdAdmission(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                textAlign: "left",
                border:
                  !isIpdAdmission && form.category !== "Emergency"
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                background:
                  !isIpdAdmission && form.category !== "Emergency"
                    ? "rgba(59, 130, 246, 0.08)"
                    : "var(--surface-1)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background:
                    !isIpdAdmission && form.category !== "Emergency"
                      ? "var(--primary)"
                      : "var(--surface-2)",
                  color:
                    !isIpdAdmission && form.category !== "Emergency"
                      ? "#fff"
                      : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Stethoscope size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                  OPD Consultation
                </div>
                <div
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  Regular outpatient consultation
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                set("category", "IPD");
                setIsIpdAdmission(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                textAlign: "left",
                border: isIpdAdmission
                  ? "2px solid #10b981"
                  : "1px solid var(--border)",
                background: isIpdAdmission
                  ? "rgba(16, 185, 129, 0.12)"
                  : "var(--surface-1)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: isIpdAdmission ? "#10b981" : "var(--surface-2)",
                  color: isIpdAdmission ? "#fff" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bed size={18} />
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    color: isIpdAdmission ? "#10b981" : "inherit",
                  }}
                >
                  IPD Admission
                </div>
                <div
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  Admit patient to ward &amp; assign bed
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                set("category", "Emergency");
                setIsIpdAdmission(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                textAlign: "left",
                border:
                  !isIpdAdmission && form.category === "Emergency"
                    ? "2px solid var(--amber)"
                    : "1px solid var(--border)",
                background:
                  !isIpdAdmission && form.category === "Emergency"
                    ? "rgba(245, 158, 11, 0.08)"
                    : "var(--surface-1)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background:
                    !isIpdAdmission && form.category === "Emergency"
                      ? "var(--amber)"
                      : "var(--surface-2)",
                  color:
                    !isIpdAdmission && form.category === "Emergency"
                      ? "#fff"
                      : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                  Emergency
                </div>
                <div
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  Casualty / urgent care
                </div>
              </div>
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            <div className="form-group">
              <label className="form-label">
                Visit Date <span className="required">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                max={todayISO}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className={`btn btn-xs ${visitDate === todayISO ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setVisitDate(todayISO)}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${
                    visitDate ===
                    new Date(Date.now() - 86400000).toISOString().slice(0, 10)
                      ? "btn-primary"
                      : "btn-ghost"
                  }`}
                  onClick={() =>
                    setVisitDate(
                      new Date(Date.now() - 86400000)
                        .toISOString()
                        .slice(0, 10),
                    )
                  }
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${
                    visitDate ===
                    new Date(Date.now() - 2 * 86400000)
                      .toISOString()
                      .slice(0, 10)
                      ? "btn-primary"
                      : "btn-ghost"
                  }`}
                  onClick={() =>
                    setVisitDate(
                      new Date(Date.now() - 2 * 86400000)
                        .toISOString()
                        .slice(0, 10),
                    )
                  }
                >
                  2 Days Ago
                </button>
              </div>
              {visitDate !== todayISO && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--amber)",
                    marginTop: 4,
                    display: "block",
                    fontWeight: 500,
                  }}
                >
                  ⚠️ Backfilling visit for{" "}
                  {new Date(visitDate + "T00:00:00").toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Visit Category <span className="required">*</span>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => {
                    const val = e.target.value;
                    set("category", val);
                    setIsIpdAdmission(val === "IPD");
                  }}
                >
                  <option value="" disabled>
                    Select category...
                  </option>
                  <option value="OPD">OPD</option>
                  <option value="IPD">IPD (Inpatient Admission)</option>
                  <option value="Emergency">Emergency</option>
                  {categoryOptions
                    .filter(
                      (o) =>
                        !["OPD", "IPD", "Emergency"].includes(o.value) &&
                        o.value.toUpperCase() !== "IPD",
                    )
                    .map((c) => (
                      <option key={c.id} value={c.value}>
                        {c.value}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    const val = prompt("Enter new category name:");
                    if (val?.trim()) {
                      await createOption.mutateAsync({
                        optionType: "CATEGORY",
                        value: val.trim(),
                      });
                      set("category", val.trim());
                      toast("Category added", "success");
                    }
                  }}
                >
                  <Plus size={16} /> New
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive IPD Admission & Bed Allocation Window */}
        <AnimatePresence>
          {isIpdAdmission && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ overflow: "hidden", marginBottom: 16 }}
            >
              <div
                className="card"
                style={{
                  border: "2px solid rgba(16, 185, 129, 0.45)",
                  boxShadow: "0 8px 24px -6px rgba(16, 185, 129, 0.12)",
                  background:
                    "linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, var(--surface-solid) 100%)",
                }}
              >
                {/* Window Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Bed size={22} />
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                          Inpatient Admission &amp; Bed Allocation
                        </span>
                        <span
                          style={{
                            background: "#10b981",
                            color: "#fff",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 10,
                            letterSpacing: "0.5px",
                          }}
                        >
                          IPD ACTIVE
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Assign an inpatient bed and record admission details
                        directly with this visit
                      </span>
                    </div>
                  </div>

                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: "var(--surface-1)",
                        border: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <strong>{vacantBedOptions.length}</strong> Vacant /{" "}
                      <strong>
                        {rooms.reduce(
                          (acc, r) => acc + (r.beds || []).length,
                          0,
                        )}
                      </strong>{" "}
                      Total Beds
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowBedConfigModal(true)}
                      style={{
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Plus size={14} /> Manage Beds
                    </button>
                  </div>
                </div>

                {/* Bed Selection Visual Matrix */}
                <div style={{ marginBottom: 18 }} data-field="ipd-bed">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <label
                      className="form-label"
                      style={{ fontWeight: 600, margin: 0 }}
                    >
                      Select Inpatient Bed <span className="required">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setIpdForm((f) => ({
                          ...f,
                          isCustomBed: !f.isCustomBed,
                        }))
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        fontWeight: 500,
                        textDecoration: "underline",
                      }}
                    >
                      {ipdForm.isCustomBed
                        ? "← Select from configured beds"
                        : "+ Enter custom bed / stretcher"}
                    </button>
                  </div>

                  {errors.ipdBed && (
                    <div
                      style={{
                        color: "var(--red)",
                        fontSize: "0.76rem",
                        marginBottom: 8,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <AlertCircle size={14} /> {errors.ipdBed}
                    </div>
                  )}

                  {ipdForm.isCustomBed ? (
                    <div
                      style={{
                        background: "var(--surface-1)",
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <label
                        className="form-label"
                        style={{ fontSize: "0.75rem", marginBottom: 4 }}
                      >
                        Custom Bed / Room / Stretcher Label
                      </label>
                      <input
                        className="form-input"
                        placeholder="e.g. Emergency Stretcher 02, Extra Cot Female Ward"
                        value={ipdForm.customBedText}
                        onChange={(e) => {
                          setIpdForm((f) => ({
                            ...f,
                            customBedText: e.target.value,
                          }));
                          if (errors.ipdBed)
                            setErrors((err) => {
                              const c = { ...err };
                              delete c.ipdBed;
                              return c;
                            });
                        }}
                        autoFocus
                      />
                    </div>
                  ) : rooms.length === 0 ? (
                    <div
                      style={{
                        background: "var(--surface-1)",
                        border: "1px dashed var(--border)",
                        borderRadius: 10,
                        padding: "16px",
                        textAlign: "center",
                      }}
                    >
                      <Bed
                        size={28}
                        style={{
                          color: "var(--text-muted)",
                          margin: "0 auto 8px",
                        }}
                      />
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.88rem",
                          marginBottom: 4,
                        }}
                      >
                        No Hospital Wards or Beds Configured Yet
                      </div>
                      <p
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          maxWidth: 400,
                          margin: "0 auto 12px",
                        }}
                      >
                        Configure your clinic rooms &amp; beds once in settings,
                        or enter a custom bed roll number below.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => setShowBedConfigModal(true)}
                        >
                          <Plus size={14} /> Setup Clinic Rooms &amp; Beds
                        </button>
                      </div>
                      <input
                        className="form-input"
                        style={{ maxWidth: 360, margin: "0 auto" }}
                        placeholder="Or enter bed name (e.g. Ward A - Bed 01)"
                        value={ipdForm.customBedText}
                        onChange={(e) => {
                          setIpdForm((f) => ({
                            ...f,
                            isCustomBed: true,
                            customBedText: e.target.value,
                          }));
                          if (errors.ipdBed)
                            setErrors((err) => {
                              const c = { ...err };
                              delete c.ipdBed;
                              return c;
                            });
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      {/* Ward Filter Pills */}
                      {rooms.length > 1 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            marginBottom: 12,
                          }}
                        >
                          <button
                            type="button"
                            className={`btn btn-xs ${selectedWardFilter === "ALL" ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setSelectedWardFilter("ALL")}
                          >
                            All Wards (
                            {rooms.reduce(
                              (acc, r) => acc + (r.beds || []).length,
                              0,
                            )}
                            )
                          </button>
                          {rooms.map((room) => (
                            <button
                              key={room.id}
                              type="button"
                              className={`btn btn-xs ${selectedWardFilter === room.id ? "btn-primary" : "btn-ghost"}`}
                              onClick={() => setSelectedWardFilter(room.id)}
                            >
                              {room.name} ({(room.beds || []).length})
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Bed Cards Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(140px, 1fr))",
                          gap: 10,
                          maxHeight: 280,
                          overflowY: "auto",
                          padding: 4,
                        }}
                      >
                        {rooms
                          .filter(
                            (r) =>
                              selectedWardFilter === "ALL" ||
                              r.id === selectedWardFilter,
                          )
                          .flatMap((room) =>
                            (room.beds || []).map((bed) => {
                              const bedKey = `${room.id}___${bed.id}`;
                              const occupant = bedOccupancyMap.get(bedKey);
                              const bedFullName = `${room.name} - Bed ${bed.bedNumber}`;
                              const isSelected =
                                !ipdForm.isCustomBed &&
                                ipdForm.bedOrRoom === bedFullName;
                              const isOccupied = Boolean(occupant);

                              return (
                                <button
                                  key={bedKey}
                                  type="button"
                                  disabled={isOccupied}
                                  onClick={() => {
                                    setIpdForm((f) => ({
                                      ...f,
                                      bedOrRoom: bedFullName,
                                      isCustomBed: false,
                                      customBedText: "",
                                    }));
                                    if (errors.ipdBed)
                                      setErrors((err) => {
                                        const c = { ...err };
                                        delete c.ipdBed;
                                        return c;
                                      });
                                  }}
                                  style={{
                                    textAlign: "left",
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                    position: "relative",
                                    border: isSelected
                                      ? "2px solid #10b981"
                                      : isOccupied
                                        ? "1px solid rgba(239, 68, 68, 0.25)"
                                        : "1px solid var(--border)",
                                    background: isSelected
                                      ? "rgba(16, 185, 129, 0.12)"
                                      : isOccupied
                                        ? "rgba(239, 68, 68, 0.04)"
                                        : "var(--surface-1)",
                                    cursor: isOccupied
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity: isOccupied ? 0.65 : 1,
                                    transition: "all 0.15s ease",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    minHeight: 80,
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: 4,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 5,
                                        }}
                                      >
                                        <Bed
                                          size={15}
                                          style={{
                                            color: isSelected
                                              ? "#10b981"
                                              : isOccupied
                                                ? "#ef4444"
                                                : "var(--text-muted)",
                                          }}
                                        />
                                        <strong
                                          style={{
                                            fontSize: "0.86rem",
                                            color: isSelected
                                              ? "#10b981"
                                              : "var(--text-primary)",
                                          }}
                                        >
                                          Bed {bed.bedNumber}
                                        </strong>
                                      </div>
                                      {isSelected && (
                                        <CheckCircle2
                                          size={16}
                                          style={{ color: "#10b981" }}
                                        />
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.72rem",
                                        color: "var(--text-muted)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {room.name}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 6,
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.7rem",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      ₹{room.dailyRate || 500}/d
                                    </span>
                                    {isOccupied ? (
                                      <span
                                        style={{
                                          fontSize: "0.66rem",
                                          color: "#ef4444",
                                          fontWeight: 600,
                                          background: "rgba(239, 68, 68, 0.1)",
                                          padding: "1px 5px",
                                          borderRadius: 4,
                                        }}
                                      >
                                        Occupied
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: "0.66rem",
                                          color: "#10b981",
                                          fontWeight: 600,
                                          background: "rgba(16, 185, 129, 0.1)",
                                          padding: "1px 5px",
                                          borderRadius: 4,
                                        }}
                                      >
                                        Vacant
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            }),
                          )}
                      </div>
                    </div>
                  )}

                  {/* Active Selected Bed Banner */}
                  {(ipdForm.bedOrRoom ||
                    (ipdForm.isCustomBed && ipdForm.customBedText)) && (
                    <div
                      style={{
                        marginTop: 10,
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: "0.82rem",
                        }}
                      >
                        <CheckCircle2 size={16} style={{ color: "#10b981" }} />
                        <span>
                          Selected Bed:{" "}
                          <strong>
                            {ipdForm.isCustomBed
                              ? ipdForm.customBedText
                              : ipdForm.bedOrRoom}
                          </strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setIpdForm((f) => ({
                            ...f,
                            bedOrRoom: "",
                            customBedText: "",
                            isCustomBed: false,
                          }))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          fontSize: "0.74rem",
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Admission Metadata Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Admission Date &amp; Time{" "}
                      <span className="required">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={ipdForm.admissionDate}
                      onChange={(e) =>
                        setIpdForm((f) => ({
                          ...f,
                          admissionDate: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Attending Doctor</label>
                    <input
                      className="form-input"
                      placeholder="Doctor Name"
                      value={ipdForm.attendingDoctor}
                      onChange={(e) =>
                        setIpdForm((f) => ({
                          ...f,
                          attendingDoctor: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Admission Diagnosis</label>
                    <input
                      className="form-input"
                      placeholder={
                        form.diagnosis || "Provisional inpatient diagnosis"
                      }
                      value={ipdForm.diagnosis}
                      onChange={(e) =>
                        setIpdForm((f) => ({ ...f, diagnosis: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      Initial Advance Deposit (₹)
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        placeholder="e.g. 2000"
                        value={ipdForm.advancePaid}
                        onChange={(e) =>
                          setIpdForm((f) => ({
                            ...f,
                            advancePaid: e.target.value,
                          }))
                        }
                      />
                      <select
                        className="form-select"
                        style={{ maxWidth: 90 }}
                        value={ipdForm.advancePaymentMethod}
                        onChange={(e) =>
                          setIpdForm((f) => ({
                            ...f,
                            advancePaymentMethod: e.target.value as any,
                          }))
                        }
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vitals */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            Vitals
          </div>
          <div className="vitals-grid">
            {[
              { label: "BP (mmHg)", key: "bp", placeholder: "120/80" },
              { label: "Pulse (/min)", key: "pulse", placeholder: "72" },
              { label: "Temp (°F)", key: "temp", placeholder: "98.6" },
              { label: "SpO₂ (%)", key: "spo2", placeholder: "99" },
            ].map((v) => (
              <div
                key={v.key}
                className="vital-card"
                style={{ textAlign: "left" }}
              >
                <div className="vital-label">{v.label}</div>
                <input
                  data-field={v.key}
                  className={`form-input ${errors[v.key] ? "has-error" : ""}`}
                  placeholder={v.placeholder}
                  value={form[v.key as keyof typeof form]}
                  onChange={(e) => {
                    const val =
                      v.key === "bp"
                        ? e.target.value
                        : e.target.value.replace(/-/g, "");
                    set(v.key, val);
                    if (errors[v.key]) {
                      setErrors((err) => {
                        const c = { ...err };
                        delete c[v.key];
                        return c;
                      });
                    }
                  }}
                  style={{
                    marginTop: 4,
                    ...(errors[v.key]
                      ? { border: "2px solid var(--red)" }
                      : {}),
                  }}
                />
                {errors[v.key] && (
                  <span
                    style={{
                      color: "var(--red)",
                      fontSize: "0.72rem",
                      marginTop: 2,
                      display: "block",
                    }}
                  >
                    {errors[v.key]}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginTop: 12, maxWidth: 200 }}>
            <label className="form-label">Weight (kg)</label>
            <input
              data-field="weight"
              className={`form-input ${errors.weight ? "has-error" : ""}`}
              style={errors.weight ? { border: "2px solid var(--red)" } : {}}
              placeholder="e.g. 65"
              type="number"
              min="0"
              value={form.weight}
              onChange={(e) => {
                set("weight", e.target.value.replace(/-/g, ""));
                if (errors.weight) {
                  setErrors((err) => {
                    const c = { ...err };
                    delete c.weight;
                    return c;
                  });
                }
              }}
            />
            {errors.weight && (
              <span
                style={{
                  color: "var(--red)",
                  fontSize: "0.72rem",
                  marginTop: 2,
                  display: "block",
                }}
              >
                {errors.weight}
              </span>
            )}
          </div>
        </div>

        {/* Chief Complaints */}
        <ChiefComplaintsPicker
          value={form.chiefComplaints}
          onChange={(val) => {
            set("chiefComplaints", val);
            if (errors.chiefComplaints) {
              setErrors((err) => {
                const c = { ...err };
                delete c.chiefComplaints;
                return c;
              });
            }
          }}
          error={errors.chiefComplaints}
          onClearError={() => {
            if (errors.chiefComplaints) {
              setErrors((err) => {
                const c = { ...err };
                delete c.chiefComplaints;
                return c;
              });
            }
          }}
          required
        />

        {/* Diagnosis & Treatment */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div className="card-title" style={{ marginBottom: 0 }}>
              Diagnosis & Treatment
            </div>
            {templates.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowTemplateModal(true)}
              >
                <Pill size={14} /> Select Template
              </button>
            )}
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Diagnosis
                </label>
                <VoiceInputButton
                  title="Dictate Diagnosis"
                  onTranscript={(text) => {
                    set("diagnosis", text);
                  }}
                />
              </div>
              {activeDiseases.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 8,
                  }}
                >
                  {activeDiseases.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="quick-btn"
                      onClick={() =>
                        set(
                          "diagnosis",
                          form.diagnosis ? `${form.diagnosis}, ${d}` : d,
                        )
                      }
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                className="form-textarea"
                placeholder="Clinical diagnosis…"
                value={form.diagnosis}
                onChange={(e) => set("diagnosis", e.target.value)}
                style={{ minHeight: 100 }}
              />
            </div>
            <div className="form-group">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Treatment Given
                  </label>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.76rem",
                      color: hideTreatmentInRx
                        ? "var(--amber)"
                        : "var(--text-secondary)",
                      cursor: "pointer",
                      userSelect: "none",
                      background: hideTreatmentInRx
                        ? "rgba(245, 158, 11, 0.12)"
                        : "var(--surface-1)",
                      padding: "3px 8px",
                      borderRadius: 6,
                      border: `1px solid ${hideTreatmentInRx ? "var(--amber)" : "var(--border)"}`,
                      transition: "all 0.15s ease",
                    }}
                    title="If checked, Treatment Given notes will be hidden from printed PDF and WhatsApp share"
                  >
                    <input
                      type="checkbox"
                      checked={hideTreatmentInRx}
                      onChange={(e) =>
                        handleToggleHideTreatment(e.target.checked)
                      }
                      style={{
                        cursor: "pointer",
                        accentColor: "var(--accent)",
                      }}
                    />
                    <span>Hide on PDF & WhatsApp</span>
                  </label>
                </div>
                <VoiceInputButton
                  title="Dictate Treatment Given"
                  onTranscript={(text) => {
                    set("treatment", text);
                  }}
                />
              </div>
              <textarea
                className="form-textarea"
                placeholder="Procedures, injections, etc."
                value={form.treatment}
                onChange={(e) => set("treatment", e.target.value)}
                style={{ minHeight: 100 }}
              />

              {/* Multi-Day Treatment Protocol (OPD) - Only for standard OPD encounters */}
              {!isIpdAdmission ? (
                <div
                  style={{
                    marginTop: 16,
                    borderTop: "1px solid var(--border)",
                    paddingTop: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                        Multi-Day Treatment Protocol (OPD)
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-muted)",
                          marginLeft: 8,
                        }}
                      >
                        Log Day 1, Day 2, Day 3... treatment procedures &amp; charges
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowMultiDaySection(!showMultiDaySection)}
                    >
                      {showMultiDaySection
                        ? "Hide Protocol"
                        : `View / Add (${dayWiseTreatments.length} days)`}
                    </button>
                  </div>

                  {showMultiDaySection && (
                    <div
                      style={{
                        background: "var(--surface-1)",
                        borderRadius: 8,
                        padding: 12,
                        border: "1px solid var(--border)",
                      }}
                    >
                      {dayWiseTreatments.length > 0 ? (
                        <div style={{ marginBottom: 12 }}>
                          <table
                            style={{
                              width: "100%",
                              fontSize: "0.82rem",
                              borderCollapse: "collapse",
                            }}
                          >
                            <thead>
                              <tr
                                style={{
                                  borderBottom: "1px solid var(--border)",
                                  color: "var(--text-muted)",
                                  textAlign: "left",
                                }}
                              >
                                <th style={{ padding: "6px 8px" }}>Day</th>
                                <th style={{ padding: "6px 8px" }}>Date</th>
                                <th style={{ padding: "6px 8px" }}>
                                  Procedure / Treatment
                                </th>
                                <th style={{ padding: "6px 8px" }}>Notes</th>
                                <th
                                  style={{
                                    padding: "6px 8px",
                                    textAlign: "right",
                                  }}
                                >
                                  Charges (₹)
                                </th>
                                <th
                                  style={{ padding: "6px 8px", width: 40 }}
                                ></th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayWiseTreatments.map((entry, idx) => (
                                <tr
                                  key={idx}
                                  style={{
                                    borderBottom: "1px solid var(--border)",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "6px 8px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Day {entry.dayNumber}
                                  </td>
                                  <td style={{ padding: "6px 8px" }}>
                                    {entry.date}
                                  </td>
                                  <td style={{ padding: "6px 8px" }}>
                                    {entry.treatment || "-"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "6px 8px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    {entry.notes || "-"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "right",
                                      fontWeight: 600,
                                    }}
                                  >
                                    ₹{entry.charges}
                                  </td>
                                  <td
                                    style={{
                                      padding: "6px 8px",
                                      textAlign: "center",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn-icon"
                                      onClick={() =>
                                        handleRemoveDayTreatment(idx)
                                      }
                                      style={{
                                        color: "var(--danger)",
                                        padding: 2,
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <td
                                  colSpan={4}
                                  style={{
                                    padding: "8px",
                                    textAlign: "right",
                                    fontWeight: 700,
                                  }}
                                >
                                  Total Multi-Day Charges:
                                </td>
                                <td
                                  style={{
                                    padding: "8px",
                                    textAlign: "right",
                                    fontWeight: 700,
                                    color: "var(--primary)",
                                  }}
                                >
                                  ₹
                                  {dayWiseTreatments.reduce(
                                    (sum, item) => sum + item.charges,
                                    0,
                                  )}
                                </td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            marginBottom: 12,
                            textAlign: "center",
                          }}
                        >
                          No multi-day treatment logged yet. Add Day 1 treatment
                          below if this visit spans multiple days.
                        </div>
                      )}

                      {/* Add new day input - Responsive flexible layout */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <input
                            className="form-input"
                            placeholder={`Day ${dayWiseTreatments.length + 1} Treatment / Procedure (e.g. Saline, Dressing)`}
                            value={newDayTreatment}
                            onChange={(e) => setNewDayTreatment(e.target.value)}
                            style={{ flex: "2 1 200px", fontSize: "0.82rem" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>₹</span>
                            <input
                              className="form-input"
                              type="number"
                              placeholder="Charges"
                              value={newDayCharge}
                              onChange={(e) => setNewDayCharge(e.target.value)}
                              style={{ width: 90, fontSize: "0.82rem" }}
                            />
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleAddDayTreatment}
                            disabled={!newDayTreatment.trim() && !newDayCharge}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, whiteSpace: "nowrap" }}
                          >
                            <Plus size={14} /> Add Day {dayWiseTreatments.length + 1}
                          </button>
                        </div>
                        <input
                          className="form-input"
                          placeholder="Clinical Notes / Observation (optional)"
                          value={newDayNotes}
                          onChange={(e) => setNewDayNotes(e.target.value)}
                          style={{ fontSize: "0.8rem" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    fontSize: "0.82rem",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Bed size={16} />
                  <span>
                    <strong>Inpatient Department Care:</strong> Daily doctor rounds, vitals, procedures, and bed charges will be logged on the <strong>Inpatient Case Sheet</strong> once admitted.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prescription */}
        <div
          className="card"
          style={{ marginBottom: 16, position: "relative", zIndex: 40 }}
        >
          <div className="card-title" style={{ marginBottom: 12 }}>
            Prescription
          </div>

          {/* Medicine Search */}
          <div style={{ position: "relative", zIndex: 100, marginBottom: 14 }}>
            <div className="search-input-wrap">
              <span className="s-icon">
                <Search />
              </span>
              <input
                className="search-input"
                placeholder="Search medicine to add…"
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
              />
            </div>
            {medQuery.trim() !== "" && (
              <div className="search-dropdown">
                {filteredMeds.map((m) => (
                  <div
                    key={m.id}
                    className="search-result"
                    onClick={() => addMedicine(m)}
                  >
                    <div className="sr-name">{m.name}</div>
                    <div className="sr-meta">
                      {m.category} ·{" "}
                      {parseDoseToWords(m.defaultDose).en || m.defaultDose} ·{" "}
                      {m.defaultDuration}
                    </div>
                  </div>
                ))}
                <div
                  className="search-result"
                  style={{
                    color: "var(--primary)",
                    fontWeight: 600,
                    borderTop:
                      filteredMeds.length > 0
                        ? "1px solid var(--border)"
                        : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(13, 148, 136, 0.05)",
                  }}
                  onClick={() => handleAddNewMedicineDirectly(medQuery)}
                >
                  <Plus size={15} /> Add &quot;{medQuery.trim()}&quot; as new
                  medicine
                </div>
              </div>
            )}
          </div>

          {/* Medicine Rows */}
          {rxMeds.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "20px",
                color: "var(--text-muted)",
                fontSize: "0.84rem",
                border: "1px dashed var(--border)",
                borderRadius: 8,
              }}
            >
              Search and add medicines above
            </div>
          ) : (
            <>
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
                  letterSpacing: "0.5px",
                  marginBottom: 4,
                }}
              >
                <span>Medicine</span>
                <span>Dose</span>
                <span>Duration</span>
                <span>Instructions</span>
                <span></span>
              </div>
              <datalist id="dose-options">
                {DOSE_OPTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              <datalist id="duration-options">
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              {rxMeds.map((m, i) => (
                <div key={i} className="med-row">
                  <div className="med-row-field">
                    <span
                      className="med-row-field-label"
                      style={{ display: "none" }}
                    >
                      Medicine Name
                    </span>
                    <input
                      className="form-input"
                      placeholder="Medicine Name"
                      value={m.name}
                      onChange={(e) => updateMed(i, "name", e.target.value)}
                    />
                  </div>

                  <div className="med-row-field">
                    <span
                      className="med-row-field-label"
                      style={{ display: "none" }}
                    >
                      Dose
                    </span>
                    <DoseSelector
                      value={m.dose}
                      onChange={(v) => updateMed(i, "dose", v)}
                    />
                  </div>
                  <div className="med-row-field">
                    <span
                      className="med-row-field-label"
                      style={{ display: "none" }}
                    >
                      Duration
                    </span>
                    <DurationSelect
                      value={m.duration}
                      onChange={(v) => updateMed(i, "duration", v)}
                    />
                  </div>

                  <div className="med-row-field">
                    <span
                      className="med-row-field-label"
                      style={{ display: "none" }}
                    >
                      Instructions
                    </span>
                    <InstructionPicker
                      instructionKeys={m.instructionKeys}
                      customInstruction={m.customInstruction}
                      languages={m.instructionLangs}
                      onChange={({
                        instructionKeys,
                        customInstruction,
                        languages,
                        formattedText,
                      }) => {
                        setRxMeds((prev) =>
                          prev.map((item, idx) =>
                            idx === i
                              ? {
                                  ...item,
                                  instructions: formattedText,
                                  instructionKeys,
                                  customInstruction,
                                  instructionLangs: languages,
                                }
                              : item,
                          ),
                        );
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 2,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--red)" }}
                      onClick={() => removeMed(i)}
                    >
                      <Trash2 size={15} />{" "}
                      <span className="mobile-only-inline">
                        Remove Medicine
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="form-group" style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <label className="form-label" style={{ marginBottom: 0 }}>
                Prescription Notes
              </label>
              <VoiceInputButton
                title="Dictate Prescription Notes"
                onTranscript={(text) => {
                  set(
                    "prescriptionNotes",
                    form.prescriptionNotes
                      ? `${form.prescriptionNotes}\n${text}`
                      : text,
                  );
                }}
              />
            </div>
            <textarea
              className="form-textarea"
              placeholder="Additional instructions, advice, diet, rest…"
              value={form.prescriptionNotes}
              onChange={(e) => set("prescriptionNotes", e.target.value)}
              style={{ minHeight: 70 }}
            />
          </div>
        </div>

        {/* Follow-up - Only for OPD visits, not during IPD admission */}
        {!isIpdAdmission && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>
              Follow-up
            </div>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label">Next Visit Date</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="form-input"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={form.followUpDate}
                  onChange={(e) => set("followUpDate", e.target.value)}
                />
                {form.followUpDate && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => set("followUpDate", "")}
                    style={{ padding: "6px", color: "var(--text-muted)" }}
                    title="Clear Date"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <span className="form-hint">
                Leave blank if no follow-up needed
              </span>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancelClick}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={saving}
            style={
              isIpdAdmission
                ? { background: "#10b981", borderColor: "#10b981" }
                : {}
            }
          >
            {isIpdAdmission ? <Bed size={18} /> : <Stethoscope size={18} />}{" "}
            {saving
              ? "Saving…"
              : isIpdAdmission
                ? "Save & Admit to IPD"
                : "Save OPD Visit"}
          </button>
        </div>
      </form>

      {/* Bed Configuration Modal */}
      {showBedConfigModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--surface-solid)",
              borderRadius: 14,
              border: "1px solid var(--border)",
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowBedConfigModal(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <SettingsIpdRooms
              isModal={true}
              onSaved={() => setShowBedConfigModal(false)}
            />
          </div>
        </div>
      )}

      {/* IPD Admission Confirmation & Inpatient Workflow Modal */}
      <AnimatePresence>
        {showAdmissionSuccessModal && newlyAdmittedRecord && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(5px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              style={{
                backgroundColor: "var(--surface-solid)",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                width: "100%",
                maxWidth: "560px",
                padding: "24px",
                boxShadow: "0 24px 60px -10px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Bed size={28} />
                </div>
                <div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.25rem",
                        fontWeight: 700,
                      }}
                    >
                      Patient Admitted to Inpatient Ward!
                    </h3>
                    <span
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#10b981",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                      }}
                    >
                      ADMITTED
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    Admission ID:{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {newlyAdmittedRecord.admissionNumber ||
                        newlyAdmittedRecord.id}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Patient & Bed Summary Card */}
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  border: "1px solid var(--border)",
                  marginBottom: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      display: "block",
                    }}
                  >
                    Patient
                  </span>
                  <strong style={{ fontSize: "0.92rem" }}>
                    {selectedPatient?.name}
                  </strong>
                  <div
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                  >
                    {selectedPatient?.gender}, {selectedPatient?.age}y ·{" "}
                    {selectedPatient?.mobile}
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      display: "block",
                    }}
                  >
                    Assigned Bed / Ward
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Bed size={15} style={{ color: "#10b981" }} />
                    <strong style={{ fontSize: "0.92rem", color: "#10b981" }}>
                      {newlyAdmittedRecord.bedOrRoom}
                    </strong>
                  </div>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      display: "block",
                    }}
                  >
                    Attending Doctor
                  </span>
                  <span style={{ fontSize: "0.84rem" }}>
                    {newlyAdmittedRecord.attendingDoctor || "Primary Physician"}
                  </span>
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      display: "block",
                    }}
                  >
                    Admission Time
                  </span>
                  <span style={{ fontSize: "0.84rem" }}>
                    {new Date(newlyAdmittedRecord.admissionDate).toLocaleString(
                      "en-IN",
                      {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                </div>

                {Boolean(newlyAdmittedRecord.advancePaid) && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      borderTop: "1px dashed var(--border)",
                      paddingTop: 8,
                      marginTop: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      Advance Deposit Recorded:{" "}
                    </span>
                    <strong style={{ color: "#10b981" }}>
                      ₹{newlyAdmittedRecord.advancePaid}
                    </strong>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {/* 1. Open Day 1 Doctor Rounds */}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px 18px",
                    fontSize: "0.92rem",
                    fontWeight: 600,
                    background: "#10b981",
                    borderColor: "#10b981",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                  }}
                  onClick={() => {
                    setShowAdmissionSuccessModal(false);
                    router.push(`/ipd/${newlyAdmittedRecord.id}/visit?day=1`);
                  }}
                >
                  <Stethoscope size={18} />
                  Open Day 1 Doctor Rounds &amp; Inpatient Chart
                </button>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {/* Print Admission Sheet */}
                  <Link
                    href={`/ipd/${newlyAdmittedRecord.id}/print`}
                    className="btn btn-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: "0.84rem",
                      textDecoration: "none",
                    }}
                  >
                    <FileText size={15} />
                    Print Admission Sheet
                  </Link>

                  {/* Go to Inpatient Ward */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontSize: "0.84rem",
                    }}
                    onClick={() => {
                      setShowAdmissionSuccessModal(false);
                      router.push("/ipd");
                    }}
                  >
                    <Building size={15} />
                    Go to Inpatient Ward
                  </button>
                </div>

                {/* Return to patient profile */}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.84rem", marginTop: 4, width: "100%", fontWeight: 600 }}
                  onClick={() => {
                    setShowAdmissionSuccessModal(false);
                    if (selectedPatient?.patientId) {
                      router.push(`/patients/${selectedPatient.patientId}`);
                    } else {
                      router.push("/patients");
                    }
                  }}
                >
                  Done &amp; Return to Patient Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Day 1 Inpatient Doctor Rounds Fullscreen Workspace */}
      {showDay1LogModal && newlyAdmittedRecord && (
        <IpdDayLogModal
          isOpen={showDay1LogModal}
          onClose={() => {
            setShowDay1LogModal(false);
            if (selectedPatient?.patientId) {
              router.push(`/patients/${selectedPatient.patientId}`);
            } else {
              router.push("/ipd");
            }
          }}
          admission={newlyAdmittedRecord}
          initialLog={{
            dayNumber: 1,
            date: todayISO,
            doctorNotes: form.prescriptionNotes || "",
            vitals: {
              bp: form.bp,
              pulse: form.pulse,
              temp: form.temp,
              spo2: form.spo2,
            },
            medications: rxMeds.map((m) => ({
              name: m.name,
              dose: m.dose,
              route: "Oral",
              timing: "After Food",
              instructions: m.instructions || "",
            })),
            procedures: form.treatment
              ? [
                  {
                    name: form.treatment.trim(),
                    quantity: 1,
                    unitPrice: 0,
                    totalPrice: 0,
                  },
                ]
              : [],
            dailyCharges: 0,
          }}
          onSuccess={() => {
            setShowDay1LogModal(false);
            toast("Day 1 Doctor Rounds saved successfully!", "success");
            router.push("/ipd");
          }}
        />
      )}

      {/* Template Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowTemplateModal(false)}
          >
            <motion.div
              className="modal modal-md"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <div className="modal-header">
                <h3>Select Prescription Template</h3>
                <button
                  className="btn-icon"
                  onClick={() => setShowTemplateModal(false)}
                >
                  <X />
                </button>
              </div>
              <div className="modal-body">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="card card-sm"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.2s",
                        border: "1px solid var(--border)",
                      }}
                      onClick={() => {
                        applyTemplate(t.id!.toString());
                        setShowTemplateModal(false);
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "var(--accent)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "var(--border)")
                      }
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--accent-light)",
                          marginBottom: 4,
                        }}
                      >
                        {t.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-secondary)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {t.diagnosis || "No diagnosis info"}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {t.medicines?.length || 0} medicines included
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Exit / Unsaved Confirmation Modal */}
      <AnimatePresence>
        {showExitModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <motion.div
              className="modal modal-md"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ textAlign: "left", padding: "24px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--accent-glow)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Stethoscope size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem" }}>
                    Save or Discard Visit?
                  </h3>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    You have entered visit information.
                  </span>
                </div>
              </div>

              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-secondary)",
                  marginBottom: "20px",
                  background: "var(--surface-1)",
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                }}
              >
                Would you like to save this visit to the database directly or
                discard the entered information?
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowExitModal(false)}
                >
                  Continue Editing
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setShowExitModal(false);
                    router.push("/patients");
                  }}
                >
                  Discard Visit
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    setShowExitModal(false);
                    handleSubmit(e);
                  }}
                >
                  Save Visit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move to Billing Prompt */}
      {(() => {
        const navigateToPatient = () => {
          if (selectedPatient?.patientId) {
            router.push(`/patients/${selectedPatient.patientId}`);
          } else {
            router.push("/patients");
          }
        };

        return (
          <>
            <ConfirmModal
              isOpen={showBillingPrompt}
              onClose={() => {
                setShowBillingPrompt(false);
                navigateToPatient();
              }}
              onConfirm={() => {
                setShowBillingPrompt(false);
                setShowBillModal(true);
              }}
              title="Visit Saved! Move to Billing?"
              description="This OPD visit is recorded as Unbilled. Would you like to proceed to billing now to add treatments performed (injections, salines, dressing) and settle the fees?"
              confirmText="Move to Billing"
              cancelText="Skip / Bill Later"
              variant="info"
            />

            {/* Create Bill Modal */}
            {savedVisitInfo && (
              <CreateBillModal
                isOpen={showBillModal}
                onClose={() => {
                  setShowBillModal(false);
                  navigateToPatient();
                }}
                patientId={selectedPatient?.patientId || ""}
                patientName={selectedPatient?.name || "Patient"}
                visitId={savedVisitInfo.id}
                visitDate={savedVisitInfo.date}
                initialTreatments={
                  dayWiseTreatments.length > 0
                    ? dayWiseTreatments.map((d) => ({
                        name: `Day ${d.dayNumber}: ${d.treatment || "Treatment Protocol"}`,
                        unitPrice: d.charges || 0,
                        quantity: 1,
                      }))
                    : form.treatment.trim()
                      ? [
                          {
                            name: form.treatment.trim(),
                            unitPrice: 100,
                            quantity: 1,
                          },
                        ]
                      : []
                }
                onSuccess={() => {
                  // Keep open so user can print or share via WhatsApp, or close on Done
                }}
                onSkip={() => {
                  setShowBillModal(false);
                  navigateToPatient();
                }}
              />
            )}
          </>
        );
      })()}
    </PageTransition>
  );
}
