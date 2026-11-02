'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Stethoscope,
  Activity,
  Pill,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ClipboardList,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIpdMutations, useMedicines, useSettings } from '@/lib/hooks/useQueries';
import type {
  IpdAdmission,
  IpdDayLog,
  IpdDoctorRound,
  IpdMedicationItem,
  IpdProcedureItem,
  AddIpdDayLogInput,
} from '@/lib/providers/types';
import { getDayRounds, getRoundSessionMeta } from '@/lib/utils/ipd';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

interface IpdDayLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: IpdAdmission;
  targetDayNumber?: number | null;
  editingRound?: IpdDoctorRound | null;
  initialLog?: IpdDayLog | null;
  onSuccess?: (updated: IpdAdmission) => void;
}

type TabType = 'overview' | 'clinical' | 'vitals' | 'meds' | 'procedures' | 'nursing';

const DOSE_PRESETS = ['1-0-1', '1-1-1', '0-0-1', '1-0-0', 'Stat', 'SOS', 'TDS', 'QID'];
const ROUTE_PRESETS = ['IV', 'IM', 'Oral', 'Nebulization', 'SC', 'IV Infusion', 'Topical'];
const TIMING_PRESETS = ['After Food', 'Before Food', 'With Food', 'Bedtime', 'Stat'];
const CLINICAL_STATUS_CHIPS = [
  'Afebrile today',
  'Vitals stable',
  'Hydration improved',
  'Chest clear',
  'Abdomen soft, non-tender',
  'Pain controlled',
  'Tolerating oral diet',
  'Surgical wound healthy',
  'Urine output adequate',
];

const ROUND_SESSION_PRESETS = [
  { label: 'Morning Round', icon: '🌅', hint: '09:00 AM' },
  { label: 'Afternoon Visit', icon: '☀️', hint: '02:00 PM' },
  { label: 'Evening Round', icon: '🌆', hint: '07:00 PM' },
  { label: 'Night Call', icon: '🌙', hint: '10:00 PM' },
  { label: 'Emergency / SOS', icon: '🚨', hint: 'Stat' },
  { label: 'Specialist Consultation', icon: '🩺', hint: 'Consult' },
  { label: 'Routine Check', icon: '📋', hint: 'Routine' },
];

export default function IpdDayLogModal({
  isOpen,
  onClose,
  admission,
  targetDayNumber = null,
  editingRound = null,
  initialLog = null,
  onSuccess,
}: IpdDayLogModalProps) {
  const [mounted, setMounted] = useState(false);
  const { addDayLog, updateDayLog } = useIpdMutations();
  const { data: settings } = useSettings();
  const { data: inventoryMedicines = [] } = useMedicines();

  // Active Tab inside modal
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Day & Round assignment state
  const existingDays = useMemo(() => {
    return [...(admission?.dayWiseLogs || [])].sort((a, b) => a.dayNumber - b.dayNumber);
  }, [admission?.dayWiseLogs]);

  const [chosenDayNumber, setChosenDayNumber] = useState<number>(1);
  const [isCreatingNewDay, setIsCreatingNewDay] = useState<boolean>(false);

  // Visit session & timing states
  const [roundType, setRoundType] = useState<string>('Morning Round');
  const [visitTime, setVisitTime] = useState<string>('09:30 AM');
  const [doctorName, setDoctorName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Clinical notes
  const [doctorNotes, setDoctorNotes] = useState('');
  const [nursingNotes, setNursingNotes] = useState('');
  const [dietNotes, setDietNotes] = useState('');

  // Vitals
  const [vitals, setVitals] = useState({
    bp: '',
    pulse: '',
    temp: '',
    spo2: '',
    respRate: '',
    sugar: '',
  });

  // Medications list
  const [medications, setMedications] = useState<IpdMedicationItem[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('1-0-1');
  const [newMedRoute, setNewMedRoute] = useState('IV');
  const [newMedTiming, setNewMedTiming] = useState('After Food');
  const [newMedInstructions, setNewMedInstructions] = useState('');
  const [medSearchQuery, setMedSearchQuery] = useState('');

  // Procedures list
  const [procedures, setProcedures] = useState<IpdProcedureItem[]>([]);
  const [customProcName, setCustomProcName] = useState('');
  const [customProcQty, setCustomProcQty] = useState('1');
  const [customProcPrice, setCustomProcPrice] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute default round type by current hour
  const getDefaultSession = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return { type: 'Morning Round', time: '09:30 AM' };
    if (hr >= 12 && hr < 17) return { type: 'Afternoon Visit', time: '02:30 PM' };
    if (hr >= 17 && hr < 22) return { type: 'Evening Round', time: '07:30 PM' };
    return { type: 'Night Call', time: '10:30 PM' };
  };

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const defaultDoc = admission.attendingDoctor || settings?.doctorName || '';

      if (editingRound) {
        // Editing a specific round
        setRoundType(editingRound.roundType || 'Routine Check');
        setVisitTime(editingRound.time || '09:30 AM');
        setDoctorName(editingRound.doctorName || defaultDoc);
        setDoctorNotes(editingRound.doctorNotes || '');
        setNursingNotes(editingRound.nursingNotes || '');
        setDietNotes(editingRound.dietNotes || '');
        setVitals({
          bp: editingRound.vitals?.bp || '',
          pulse: editingRound.vitals?.pulse || '',
          temp: editingRound.vitals?.temp || '',
          spo2: editingRound.vitals?.spo2 || '',
          respRate: editingRound.vitals?.respRate || '',
          sugar: editingRound.vitals?.sugar || '',
        });
        setMedications(editingRound.medications || []);
        setProcedures(editingRound.procedures || []);

        const targetDay = targetDayNumber || initialLog?.dayNumber || 1;
        setChosenDayNumber(targetDay);
        setIsCreatingNewDay(false);
        const dayMatch = existingDays.find((d) => d.dayNumber === targetDay);
        if (dayMatch?.date) setDate(dayMatch.date);
      } else if (initialLog) {
        // Legacy day-log editing
        const def = getDefaultSession();
        setRoundType(def.type);
        setVisitTime(def.time);
        setDoctorName(defaultDoc);
        setDate(initialLog.date || new Date().toISOString().slice(0, 10));
        setDoctorNotes(initialLog.doctorNotes || '');
        setNursingNotes(initialLog.nursingNotes || '');
        setDietNotes(initialLog.dietNotes || '');
        setVitals({
          bp: initialLog.vitals?.bp || '',
          pulse: initialLog.vitals?.pulse || '',
          temp: initialLog.vitals?.temp || '',
          spo2: initialLog.vitals?.spo2 || '',
          respRate: initialLog.vitals?.respRate || '',
          sugar: initialLog.vitals?.sugar || '',
        });
        setMedications(initialLog.medications || []);
        setProcedures(initialLog.procedures || []);
        setChosenDayNumber(initialLog.dayNumber);
        setIsCreatingNewDay(false);
      } else {
        // Logging a new Doctor Visit / Round
        const def = getDefaultSession();
        const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        setRoundType(def.type);
        setVisitTime(nowTime || def.time);
        setDoctorName(defaultDoc);
        setDoctorNotes('');
        setNursingNotes('');
        setDietNotes('');
        setVitals({ bp: '', pulse: '', temp: '', spo2: '', respRate: '', sugar: '' });
        setMedications([]);
        setProcedures([]);

        if (targetDayNumber) {
          setChosenDayNumber(targetDayNumber);
          setIsCreatingNewDay(false);
          const dayMatch = existingDays.find((d) => d.dayNumber === targetDayNumber);
          if (dayMatch?.date) setDate(dayMatch.date);
          else setDate(new Date().toISOString().slice(0, 10));
        } else if (existingDays.length > 0) {
          // Default to the latest day
          const latest = existingDays[existingDays.length - 1];
          setChosenDayNumber(latest.dayNumber);
          setDate(latest.date || new Date().toISOString().slice(0, 10));
          setIsCreatingNewDay(false);
        } else {
          // First day ever for this admission
          setChosenDayNumber(1);
          setIsCreatingNewDay(true);
          setDate(new Date().toISOString().slice(0, 10));
        }
      }
      setActiveTab('overview');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, editingRound, initialLog, targetDayNumber, admission.attendingDoctor, settings?.doctorName, existingDays]);

  // Real clinic configured procedures from clinic settings
  const clinicProcedures = useMemo(() => {
    const list: Array<{ name: string; price: number }> = [];
    const rates = settings?.serviceRates || {};
    const stdMap: Record<string, string> = {
      ivInjection: 'IV Injection',
      imInjection: 'IM Injection',
      saline: 'IV Fluid / Saline (500ml)',
      nebulization: 'Nebulization Session',
      dressing: 'Wound Dressing',
      ecg: 'ECG (12-Lead)',
      suture: 'Suture / Stitching',
      grbs: 'Blood Sugar (GRBS)',
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

  // Filtered medicine search suggestions from inventory
  const filteredMeds = useMemo(() => {
    if (!medSearchQuery.trim()) return [];
    const q = medSearchQuery.toLowerCase();
    return inventoryMedicines
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [medSearchQuery, inventoryMedicines]);

  // Add medication to visit
  const handleAddMedication = () => {
    const name = (newMedName || medSearchQuery).trim();
    if (!name) {
      toast('Please enter or select a medicine name', 'error');
      return;
    }
    const item: IpdMedicationItem = {
      name,
      dose: newMedDose,
      route: newMedRoute,
      timing: newMedTiming,
      instructions: newMedInstructions.trim() || undefined,
    };
    setMedications((list) => [...list, item]);
    setNewMedName('');
    setMedSearchQuery('');
    setNewMedInstructions('');
    toast(`Added ${name} to visit orders`, 'info');
  };

  // Add procedure to visit
  const handleAddProcedure = () => {
    if (!customProcName.trim()) {
      toast('Please enter or select a procedure name', 'error');
      return;
    }
    const qty = Number(customProcQty) || 1;
    const price = Number(customProcPrice) || 0;
    const item: IpdProcedureItem = {
      name: customProcName.trim(),
      quantity: qty,
      unitPrice: price,
      totalPrice: qty * price,
    };
    setProcedures((list) => [...list, item]);
    setCustomProcName('');
    setCustomProcQty('1');
    setCustomProcPrice('');
  };

  // Calculate procedure total for this specific visit
  const visitProcedureTotal = useMemo(() => {
    return procedures.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
  }, [procedures]);

  // Submit Doctor Visit / Round
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    try {
      const roundId =
        editingRound?.id || `rnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const medsSummary = medications
        .map((m) => `${m.name} (${m.dose || ''} ${m.route || ''})`.trim())
        .join(', ');

      const currentRound: IpdDoctorRound = {
        id: roundId,
        time: visitTime.trim() || 'Routine Check',
        roundType,
        doctorName: doctorName.trim() || undefined,
        doctorNotes: doctorNotes.trim() || undefined,
        nursingNotes: nursingNotes.trim() || undefined,
        vitals: {
          bp: vitals.bp.trim() || undefined,
          pulse: vitals.pulse.trim() || undefined,
          temp: vitals.temp.trim() || undefined,
          spo2: vitals.spo2.trim() || undefined,
          respRate: vitals.respRate.trim() || undefined,
          sugar: vitals.sugar.trim() || undefined,
        },
        medications,
        medicinesAdministered: medsSummary || undefined,
        procedures,
        charges: visitProcedureTotal,
        dietNotes: dietNotes.trim() || undefined,
        createdAt: editingRound?.createdAt || new Date().toISOString(),
      };

      let result: IpdAdmission;

      if (isCreatingNewDay || existingDays.length === 0) {
        // Create brand new Day log with this visit inside
        const newDayNumber = existingDays.length + 1;
        const payload: AddIpdDayLogInput = {
          date,
          doctorNotes: currentRound.doctorNotes,
          nursingNotes: currentRound.nursingNotes,
          vitals: currentRound.vitals,
          medications: currentRound.medications,
          medicinesAdministered: currentRound.medicinesAdministered,
          procedures,
          dailyCharges: visitProcedureTotal,
          dietNotes: currentRound.dietNotes,
          rounds: [currentRound],
        };

        result = await addDayLog.mutateAsync({
          id: admission.id,
          input: payload,
        });

        toast(`Created Day ${newDayNumber} and logged ${roundType}!`, 'success');
      } else {
        // Target an existing Day log
        const targetDayLog =
          existingDays.find((d) => d.dayNumber === chosenDayNumber) ||
          existingDays[existingDays.length - 1];

        const existingRounds = getDayRounds(targetDayLog);
        let updatedRounds: IpdDoctorRound[];

        if (editingRound) {
          updatedRounds = existingRounds.map((r) => (r.id === editingRound.id ? currentRound : r));
        } else {
          updatedRounds = [...existingRounds, currentRound];
        }

        // Aggregate procedures and charges for the entire day
        const allProcedures = updatedRounds.flatMap((r) => r.procedures || []);
        const totalDayCharges = updatedRounds.reduce(
          (sum, r) => sum + (Number(r.charges) || 0),
          0
        );

        // Latest vitals and notes
        const latestRound = updatedRounds[updatedRounds.length - 1];

        const payload: AddIpdDayLogInput = {
          date: targetDayLog.date || date,
          doctorNotes: latestRound?.doctorNotes || targetDayLog.doctorNotes,
          nursingNotes: latestRound?.nursingNotes || targetDayLog.nursingNotes,
          vitals: latestRound?.vitals || targetDayLog.vitals,
          medications: latestRound?.medications || targetDayLog.medications,
          medicinesAdministered:
            latestRound?.medicinesAdministered || targetDayLog.medicinesAdministered,
          procedures: allProcedures,
          dailyCharges: totalDayCharges,
          dietNotes: latestRound?.dietNotes || targetDayLog.dietNotes,
          rounds: updatedRounds,
        };

        result = await updateDayLog.mutateAsync({
          id: admission.id,
          dayNumber: targetDayLog.dayNumber,
          input: payload,
        });

        toast(
          editingRound
            ? `Updated ${roundType} for Day ${targetDayLog.dayNumber}!`
            : `Added ${roundType} to Day ${targetDayLog.dayNumber}!`,
          'success'
        );
      }

      onSuccess?.(result);
      onClose();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save doctor visit'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const patientName = admission.patient?.name || 'Patient';
  const patientAge = admission.patient?.age ? `${admission.patient.age}y` : '';
  const patientGender = admission.patient?.gender || '';

  // ─── Sub-Renderers ────────────────────────────────────────────────────────
  const renderVitalsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem' }}>
          <Activity size={16} style={{ color: 'var(--primary)' }} />
          <span>Patient Vitals Checked During This Visit</span>
        </div>
        {Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95 && (
          <span style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={13} /> Low SpO2 Warning
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 125px), 1fr))',
          gap: 10,
        }}
      >
        <div>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            BP (mmHg)
          </label>
          <input
            className="form-input"
            placeholder="120/80"
            style={{ height: 34, fontSize: '0.84rem' }}
            value={vitals.bp}
            onChange={(e) => setVitals((v) => ({ ...v, bp: e.target.value }))}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            Pulse (bpm)
          </label>
          <input
            className="form-input"
            placeholder="76"
            type="number"
            style={{ height: 34, fontSize: '0.84rem' }}
            value={vitals.pulse}
            onChange={(e) => setVitals((v) => ({ ...v, pulse: e.target.value }))}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            Temp (°F)
          </label>
          <input
            className="form-input"
            placeholder="98.6"
            style={{ height: 34, fontSize: '0.84rem' }}
            value={vitals.temp}
            onChange={(e) => setVitals((v) => ({ ...v, temp: e.target.value }))}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            SpO2 (%)
          </label>
          <input
            className="form-input"
            placeholder="98"
            type="number"
            style={{
              height: 34,
              fontSize: '0.84rem',
              borderColor: Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95 ? '#ef4444' : undefined,
            }}
            value={vitals.spo2}
            onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            Resp Rate (/min)
          </label>
          <input
            className="form-input"
            placeholder="18"
            type="number"
            style={{ height: 34, fontSize: '0.84rem' }}
            value={vitals.respRate}
            onChange={(e) => setVitals((v) => ({ ...v, respRate: e.target.value }))}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            Sugar (GRBS)
          </label>
          <input
            className="form-input"
            placeholder="110 mg/dL"
            style={{ height: 34, fontSize: '0.84rem' }}
            value={vitals.sugar}
            onChange={(e) => setVitals((v) => ({ ...v, sugar: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );

  const renderClinicalSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem' }}>
          <Stethoscope size={16} style={{ color: 'var(--primary)' }} />
          <span>Doctor Observations &amp; Round Notes</span>
        </div>
      </div>

      {/* Quick Clinical Status Chips */}
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
          Quick Status Chips (Click to append):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CLINICAL_STATUS_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="badge"
              style={{
                cursor: 'pointer',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                fontSize: '0.74rem',
                padding: '4px 8px',
                borderRadius: 6,
                transition: 'all 0.12s ease',
              }}
              onClick={() => {
                setDoctorNotes((prev) => {
                  const trimmed = prev.trim();
                  return trimmed ? `${trimmed}. ${chip}` : chip;
                });
              }}
            >
              + {chip}
            </button>
          ))}
        </div>
      </div>

      <div>
        <textarea
          className="form-input"
          rows={5}
          placeholder="Enter patient condition, clinical progress, physical exam findings, complaints, response to medication..."
          style={{ fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical' }}
          value={doctorNotes}
          onChange={(e) => setDoctorNotes(e.target.value)}
        />
      </div>
    </div>
  );

  const renderMedicationsSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem' }}>
          <Pill size={16} style={{ color: 'var(--primary)' }} />
          <span>Medications Ordered / Administered in This Visit ({medications.length})</span>
        </div>
      </div>

      {/* Add New Medication Sub-Form */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
            Medicine Name (Inventory Search or Custom)
          </label>
          <input
            className="form-input"
            placeholder="Type medicine name (e.g. Paracetamol 650mg, Inj. Pantop 40mg)..."
            style={{ fontSize: '0.84rem', height: 34 }}
            value={newMedName || medSearchQuery}
            onChange={(e) => {
              setNewMedName(e.target.value);
              setMedSearchQuery(e.target.value);
            }}
          />
          {filteredMeds.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 20,
                background: 'var(--surface-solid)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                marginTop: 4,
                overflow: 'hidden',
              }}
            >
              {filteredMeds.map((med) => (
                <div
                  key={med.id}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onClick={() => {
                    setNewMedName(med.name);
                    setMedSearchQuery('');
                  }}
                >
                  <strong>{med.name}</strong> · {med.category || 'Medicine'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dose, Route, Timing row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 95px), 1fr))',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
              Dose
            </label>
            <select
              className="form-select"
              style={{ height: 32, fontSize: '0.8rem' }}
              value={newMedDose}
              onChange={(e) => setNewMedDose(e.target.value)}
            >
              {DOSE_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
              Route
            </label>
            <select
              className="form-select"
              style={{ height: 32, fontSize: '0.8rem' }}
              value={newMedRoute}
              onChange={(e) => setNewMedRoute(e.target.value)}
            >
              {ROUTE_PRESETS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
              Timing
            </label>
            <select
              className="form-select"
              style={{ height: 32, fontSize: '0.8rem' }}
              value={newMedTiming}
              onChange={(e) => setNewMedTiming(e.target.value)}
            >
              {TIMING_PRESETS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Special instructions (e.g. In 100ml NS, Stat dose, SOS if pain)..."
            style={{ fontSize: '0.82rem', height: 32, flex: 1 }}
            value={newMedInstructions}
            onChange={(e) => setNewMedInstructions(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ whiteSpace: 'nowrap', height: 32 }}
            onClick={handleAddMedication}
          >
            <Plus size={13} /> Add Medicine
          </button>
        </div>
      </div>

      {/* Medications List */}
      {medications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--surface-1)', borderRadius: 8, border: '1px dashed var(--border)' }}>
          No medicines charted for this visit yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {medications.map((med, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{med.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {med.dose} · {med.route} · {med.timing}
                  {med.instructions ? ` · ${med.instructions}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                style={{ color: '#ef4444' }}
                onClick={() => setMedications((list) => list.filter((_, i) => i !== idx))}
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderProceduresSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem' }}>
          <Receipt size={16} style={{ color: 'var(--primary)' }} />
          <span>Procedures &amp; Services Performed in This Visit ({procedures.length})</span>
        </div>
      </div>

      {/* Add Procedure Sub-Form */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 12,
        }}
      >
        {clinicProcedures.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 3 }}>
              Select Clinic Master Procedure
            </label>
            <select
              className="form-select"
              style={{ height: 32, fontSize: '0.8rem' }}
              onChange={(e) => {
                const found = clinicProcedures.find((p) => p.name === e.target.value);
                if (found) {
                  setCustomProcName(found.name);
                  setCustomProcPrice(String(found.price));
                }
              }}
            >
              <option value="">-- Choose Procedure Master --</option>
              {clinicProcedures.map((proc, i) => (
                <option key={i} value={proc.name}>
                  {proc.name} (₹{proc.price})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ipd-procedure-form-grid">
          <input
            className="form-input"
            placeholder="Procedure Name (e.g. IV Cannulation, Dressing)"
            style={{ fontSize: '0.82rem', height: 32 }}
            value={customProcName}
            onChange={(e) => setCustomProcName(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Qty"
            type="number"
            min="1"
            style={{ fontSize: '0.82rem', height: 32 }}
            value={customProcQty}
            onChange={(e) => setCustomProcQty(e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Price (₹)"
            type="number"
            style={{ fontSize: '0.82rem', height: 32 }}
            value={customProcPrice}
            onChange={(e) => setCustomProcPrice(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ whiteSpace: 'nowrap', height: 32 }}
            onClick={handleAddProcedure}
          >
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* Procedures List */}
      {procedures.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--surface-1)', borderRadius: 8, border: '1px dashed var(--border)' }}>
          No procedures billed for this visit.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {procedures.map((proc, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{proc.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Qty: {proc.quantity} × ₹{proc.unitPrice}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.92rem' }}>
                  ₹{proc.totalPrice}
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ color: '#ef4444' }}
                  onClick={() => setProcedures((list) => list.filter((_, i) => i !== idx))}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Running Visit Procedure Charges Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: 'rgba(13, 148, 136, 0.08)',
              borderRadius: 8,
              border: '1px solid rgba(13, 148, 136, 0.25)',
              marginTop: 4,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>This Visit Procedure Charges:</span>
            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem' }}>
              ₹{visitProcedureTotal}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  const renderNursingSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem', marginBottom: 6 }}>
          <ClipboardList size={16} style={{ color: 'var(--primary)' }} />
          <span>Nursing Directives &amp; Observation</span>
        </div>
        <textarea
          className="form-input"
          rows={4}
          placeholder="IV line check, cannula site clean, input/output monitoring, dressing change, patient comfort..."
          style={{ fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical' }}
          value={nursingNotes}
          onChange={(e) => setNursingNotes(e.target.value)}
        />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.92rem', marginBottom: 6 }}>
          <Calendar size={16} style={{ color: 'var(--primary)' }} />
          <span>Diet &amp; Nutrition Instructions</span>
        </div>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Soft diet, clear liquids only, low salt, NPO after midnight..."
          style={{ fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical' }}
          value={dietNotes}
          onChange={(e) => setDietNotes(e.target.value)}
        />
      </div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.18 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          width: '100vw',
          height: '100vh',
          background: 'var(--background)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ─── Two-Tier Medical Header ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            maxWidth: '100%',
          }}
        >
          {/* Row 1: Actions & Title */}
          <div
            style={{
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontWeight: 600,
                  padding: '5px 8px',
                }}
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>

              <span
                style={{
                  background: 'rgba(13, 148, 136, 0.15)',
                  color: 'var(--primary)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Stethoscope size={13} />
                {editingRound
                  ? `Edit ${roundType}`
                  : isCreatingNewDay
                  ? `New Day Round (Day ${existingDays.length + 1})`
                  : `Day ${chosenDayNumber} · Log Doctor Visit`}
              </span>
            </div>

            {/* Primary Action Buttons in Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm hidden sm:inline-flex"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="btn btn-primary btn-sm"
                disabled={isSubmitting}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px' }}
              >
                <CheckCircle2 size={14} />
                <span>{isSubmitting ? 'Saving...' : editingRound ? 'Save Changes' : 'Save Doctor Visit'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Row 2: Patient Clinical Summary Strip */}
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--surface-1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: '0.8rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.94rem' }}>
                {patientName}
              </span>
              {[patientAge, patientGender].filter(Boolean).length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  ({[patientAge, patientGender].filter(Boolean).join(', ')})
                </span>
              )}
              <span
                style={{
                  background: 'rgba(139, 92, 246, 0.12)',
                  color: '#8b5cf6',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                }}
              >
                Bed: {admission.bedOrRoom}
              </span>
              {admission.admissionNumber && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  IPD #{admission.admissionNumber}
                </span>
              )}
              {admission.diagnosis && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  · Dx: <strong>{admission.diagnosis}</strong>
                </span>
              )}
            </div>

            {/* Day Selector & Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {existingDays.length > 0 && !editingRound && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Assign To:
                  </span>
                  <select
                    className="form-select"
                    style={{ height: 28, fontSize: '0.78rem', padding: '2px 8px' }}
                    value={isCreatingNewDay ? 'new' : String(chosenDayNumber)}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setIsCreatingNewDay(true);
                      } else {
                        setIsCreatingNewDay(false);
                        const num = Number(e.target.value);
                        setChosenDayNumber(num);
                        const match = existingDays.find((d) => d.dayNumber === num);
                        if (match?.date) setDate(match.date);
                      }
                    }}
                  >
                    {existingDays.map((d) => (
                      <option key={d.dayNumber} value={d.dayNumber}>
                        Day {d.dayNumber} ({new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                      </option>
                    ))}
                    <option value="new">+ Start Next Day (Day {existingDays.length + 1})</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Date:
                </span>
                <input
                  type="date"
                  className="form-input"
                  style={{
                    width: 'auto',
                    height: 28,
                    fontSize: '0.78rem',
                    padding: '2px 8px',
                    background: 'var(--surface-solid)',
                  }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Row 3: Session Selector (Morning / Afternoon / Evening / Night / SOS / Specialist) */}
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--surface-solid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: 2 }}>
                Visit Session:
              </span>
              {ROUND_SESSION_PRESETS.map((p) => {
                const isSelected = roundType === p.label;
                const meta = getRoundSessionMeta(p.label);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setRoundType(p.label);
                      if (p.hint && p.hint.includes(':')) {
                        setVisitTime(p.hint);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 7,
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 800 : 500,
                      cursor: 'pointer',
                      border: isSelected ? meta.border : '1px solid var(--border)',
                      background: isSelected ? meta.bg : 'var(--surface-1)',
                      color: isSelected ? meta.color : 'var(--text-secondary)',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Visit Time & Attending Doctor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ height: 28, width: 105, fontSize: '0.78rem', padding: '2px 8px' }}
                  placeholder="e.g. 09:30 AM"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  title="Round / Visit Time"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ height: 28, width: 130, fontSize: '0.78rem', padding: '2px 8px' }}
                  placeholder="Attending Doctor"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  title="Attending Doctor for this Visit"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section Navigation Tabs ─── */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-solid)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            flexShrink: 0,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {[
            { id: 'overview' as const, label: '📋 Bedside Overview' },
            { id: 'vitals' as const, label: '💓 Vitals' },
            { id: 'clinical' as const, label: '🩺 Doctor Notes' },
            { id: 'meds' as const, label: `💊 Meds (${medications.length})` },
            { id: 'procedures' as const, label: `🧾 Procedures (${procedures.length})` },
            { id: 'nursing' as const, label: '📋 Nursing & Diet' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive ? 'var(--primary)' : 'var(--surface-2)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 6px rgba(13, 148, 136, 0.25)' : 'none',
                }}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Full-Screen Form Body ─── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--background)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
              {/* TAB: OVERVIEW (2-Column Bedside Chart on Tablet/Desktop, Stacked on Mobile) */}
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: 16 }}>
                  {/* Left Column: Vitals & Clinical Progress */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card" style={{ padding: 16, background: 'var(--surface-solid)' }}>
                      {renderVitalsSection()}
                    </div>

                    <div className="card" style={{ padding: 16, background: 'var(--surface-solid)' }}>
                      {renderClinicalSection()}
                    </div>
                  </div>

                  {/* Right Column: Medications, Procedures, Nursing */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card" style={{ padding: 16, background: 'var(--surface-solid)' }}>
                      {renderMedicationsSection()}
                    </div>

                    <div className="card" style={{ padding: 16, background: 'var(--surface-solid)' }}>
                      {renderProceduresSection()}
                    </div>

                    <div className="card" style={{ padding: 16, background: 'var(--surface-solid)' }}>
                      {renderNursingSection()}
                    </div>
                  </div>
                </div>
              )}

              {/* INDIVIDUAL FOCUSED TABS */}
              {activeTab === 'vitals' && (
                <div className="card" style={{ padding: 22, maxWidth: 700, margin: '0 auto', background: 'var(--surface-solid)' }}>
                  {renderVitalsSection()}
                </div>
              )}

              {activeTab === 'clinical' && (
                <div className="card" style={{ padding: 22, maxWidth: 750, margin: '0 auto', background: 'var(--surface-solid)' }}>
                  {renderClinicalSection()}
                </div>
              )}

              {activeTab === 'meds' && (
                <div className="card" style={{ padding: 22, maxWidth: 800, margin: '0 auto', background: 'var(--surface-solid)' }}>
                  {renderMedicationsSection()}
                </div>
              )}

              {activeTab === 'procedures' && (
                <div className="card" style={{ padding: 22, maxWidth: 800, margin: '0 auto', background: 'var(--surface-solid)' }}>
                  {renderProceduresSection()}
                </div>
              )}

              {activeTab === 'nursing' && (
                <div className="card" style={{ padding: 22, maxWidth: 750, margin: '0 auto', background: 'var(--surface-solid)' }}>
                  {renderNursingSection()}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Bar on Mobile/Tablet */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-solid)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Visit Procedure Charges:{' '}
              <strong style={{ color: 'var(--primary)', fontSize: '0.94rem' }}>₹{visitProcedureTotal}</strong>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSubmitting}
                style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircle2 size={15} />
                <span>{isSubmitting ? 'Saving...' : editingRound ? 'Save Changes' : 'Save Doctor Visit'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
