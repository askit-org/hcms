'use client';

import { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Stethoscope,
  Activity,
  Pill,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ClipboardList,
  Calendar,
  Clock,
  User,
  Search,
  Bed,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useIpdAdmission,
  useIpdMutations,
  useMedicines,
  useMedicineMutations,
  useSettings,
} from '@/lib/hooks/useQueries';
import type {
  IpdAdmission,
  IpdDayLog,
  IpdDoctorRound,
  IpdProcedureItem,
  PrescribedMedicine,
  AddIpdDayLogInput,
} from '@/lib/providers/types';
import { getDayRounds, getRoundSessionMeta } from '@/lib/utils/ipd';
import DoseSelector, { DurationSelect } from '@/components/DoseSelector';
import InstructionPicker from '@/components/InstructionPicker';
import { parseDoseToWords } from '@/lib/medicationInstructions';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

type TabType = 'overview' | 'clinical' | 'vitals' | 'meds' | 'procedures' | 'nursing';

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

export default function IpdVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryDay = searchParams.get('day');
  const queryRoundId = searchParams.get('roundId');
  const queryNewDay = searchParams.get('newDay') === 'true';

  const { data: admission, isLoading, error, refetch } = useIpdAdmission(id);
  const { addDayLog, updateDayLog } = useIpdMutations();
  const { data: settings } = useSettings();
  const { data: inventoryMedicines = [] } = useMedicines();
  const { create: createMedMut } = useMedicineMutations();

  // Active Tab: Bedside Overview, Vitals, Notes, Meds, Procedures, Nursing
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Days list
  const existingDays = useMemo(() => {
    return [...(admission?.dayWiseLogs || [])].sort((a, b) => a.dayNumber - b.dayNumber);
  }, [admission?.dayWiseLogs]);

  // Target day number and whether to create a new day
  const [chosenDayNumber, setChosenDayNumber] = useState<number>(1);
  const [isCreatingNewDay, setIsCreatingNewDay] = useState<boolean>(false);

  // Visit metadata
  const [roundType, setRoundType] = useState<string>('Morning Round');
  const [visitTime, setVisitTime] = useState<string>('09:30 AM');
  const [doctorName, setDoctorName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Clinical Observations
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

  // OPD-Style Prescribed Medicines
  const [rxMeds, setRxMeds] = useState<PrescribedMedicine[]>([]);
  const [medQuery, setMedQuery] = useState('');

  // Procedures list
  const [procedures, setProcedures] = useState<IpdProcedureItem[]>([]);
  const [customProcName, setCustomProcName] = useState('');
  const [customProcQty, setCustomProcQty] = useState('1');
  const [customProcPrice, setCustomProcPrice] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute default session by current hour
  const getDefaultSession = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return { type: 'Morning Round', time: '09:30 AM' };
    if (hr >= 12 && hr < 17) return { type: 'Afternoon Visit', time: '02:30 PM' };
    if (hr >= 17 && hr < 22) return { type: 'Evening Round', time: '07:30 PM' };
    return { type: 'Night Call', time: '10:30 PM' };
  };

  // Synchronize state from admission and query params
  useEffect(() => {
    if (!admission) return;

    const defaultDoc = admission.attendingDoctor || settings?.doctorName || '';
    const def = getDefaultSession();

    if (queryRoundId && queryDay) {
      // Editing a specific round
      const targetDayNum = parseInt(queryDay, 10);
      const dayLog = (admission.dayWiseLogs || []).find((d) => d.dayNumber === targetDayNum);
      const rounds = dayLog ? getDayRounds(dayLog) : [];
      const matchRound = rounds.find((r) => r.id === queryRoundId);

      if (matchRound) {
        setRoundType(matchRound.roundType || 'Routine Check');
        setVisitTime(matchRound.time || def.time);
        setDoctorName(matchRound.doctorName || defaultDoc);
        setDoctorNotes(matchRound.doctorNotes || '');
        setNursingNotes(matchRound.nursingNotes || '');
        setDietNotes(matchRound.dietNotes || '');
        setVitals({
          bp: matchRound.vitals?.bp || '',
          pulse: matchRound.vitals?.pulse || '',
          temp: matchRound.vitals?.temp || '',
          spo2: matchRound.vitals?.spo2 || '',
          respRate: matchRound.vitals?.respRate || '',
          sugar: matchRound.vitals?.sugar || '',
        });
        setProcedures(matchRound.procedures || []);

        // Convert medications into PrescribedMedicine shape
        const convertedMeds: PrescribedMedicine[] = (matchRound.medications || []).map((m) => ({
          name: m.name,
          dose: m.dose || '1-0-1',
          duration: '3 days',
          instructions: m.instructions || m.timing || 'After Food',
          category: 'Allopathy',
        }));
        setRxMeds(convertedMeds);

        setChosenDayNumber(targetDayNum);
        setIsCreatingNewDay(false);
        if (dayLog?.date) setDate(dayLog.date);
        return;
      }
    }

    // Creating a new visit
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setRoundType(def.type);
    setVisitTime(nowTime || def.time);
    setDoctorName(defaultDoc);
    setDoctorNotes('');
    setNursingNotes('');
    setDietNotes('');
    setVitals({ bp: '', pulse: '', temp: '', spo2: '', respRate: '', sugar: '' });
    setRxMeds([]);
    setProcedures([]);

    if (queryNewDay) {
      setIsCreatingNewDay(true);
      setChosenDayNumber(existingDays.length + 1);
      setDate(new Date().toISOString().slice(0, 10));
    } else if (queryDay) {
      const num = parseInt(queryDay, 10);
      setChosenDayNumber(num);
      setIsCreatingNewDay(false);
      const match = existingDays.find((d) => d.dayNumber === num);
      if (match?.date) setDate(match.date);
    } else if (existingDays.length > 0) {
      const latest = existingDays[existingDays.length - 1];
      setChosenDayNumber(latest.dayNumber);
      setDate(latest.date || new Date().toISOString().slice(0, 10));
      setIsCreatingNewDay(false);
    } else {
      setChosenDayNumber(1);
      setIsCreatingNewDay(true);
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [admission?.id, queryDay, queryRoundId, queryNewDay, settings?.doctorName]);

  // Filtered medicines from inventory for search
  const filteredMeds = useMemo(() => {
    if (!medQuery.trim()) return [];
    const q = medQuery.toLowerCase();
    return inventoryMedicines.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [medQuery, inventoryMedicines]);

  // OPD Add Medicine
  const addMedicine = (m: (typeof inventoryMedicines)[0]) => {
    setRxMeds((prev) => [
      ...prev,
      {
        name: m.name,
        category: m.category || 'Allopathy',
        dose: m.defaultDose || '1-0-1',
        duration: m.defaultDuration || '3 days',
        instructions: m.instructions || 'After Food',
      },
    ]);
    setMedQuery('');
    toast(`Added ${m.name} to prescription`, 'info');
  };

  const handleAddNewMedicineDirectly = async (name: string) => {
    if (!name.trim()) return;
    try {
      const newMed = await createMedMut.mutateAsync({
        name: name.trim(),
        category: 'Allopathy',
        defaultDose: '1-0-1',
        defaultDuration: '3 days',
      });
      addMedicine(newMed);
    } catch {
      addMedicine({
        id: Date.now(),
        name: name.trim(),
        category: 'Allopathy',
        defaultDose: '1-0-1',
        defaultDuration: '3 days',
      } as any);
    }
  };

  const updateMed = (index: number, field: keyof PrescribedMedicine, value: any) => {
    setRxMeds((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const removeMed = (index: number) => {
    setRxMeds((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Real clinic configured procedures
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

  const visitProcedureTotal = useMemo(() => {
    return procedures.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
  }, [procedures]);

  // Submit Doctor Visit
  const handleSaveVisit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!admission) return;

    setIsSubmitting(true);
    try {
      const roundId = queryRoundId || `rnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // Map rxMeds to IpdMedicationItem
      const formattedMeds = rxMeds.map((m) => ({
        name: m.name,
        dose: m.dose,
        route: 'Oral',
        timing: m.instructions || 'After Food',
        instructions: m.instructions,
      }));

      const medsSummary = rxMeds.map((m) => `${m.name} (${m.dose})`).join(', ');

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
        medications: formattedMeds,
        medicinesAdministered: medsSummary || undefined,
        procedures,
        charges: visitProcedureTotal,
        dietNotes: dietNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      if (isCreatingNewDay || existingDays.length === 0) {
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

        await addDayLog.mutateAsync({
          id: admission.id,
          input: payload,
        });

        toast(`Created Day ${newDayNumber} and saved ${roundType}!`, 'success');
      } else {
        const targetDayLog =
          existingDays.find((d) => d.dayNumber === chosenDayNumber) ||
          existingDays[existingDays.length - 1];

        const existingRounds = getDayRounds(targetDayLog);
        let updatedRounds: IpdDoctorRound[];

        if (queryRoundId) {
          updatedRounds = existingRounds.map((r) => (r.id === queryRoundId ? currentRound : r));
        } else {
          updatedRounds = [...existingRounds, currentRound];
        }

        const allProcedures = updatedRounds.flatMap((r) => r.procedures || []);
        const totalDayCharges = updatedRounds.reduce(
          (sum, r) => sum + (Number(r.charges) || 0),
          0
        );

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

        await updateDayLog.mutateAsync({
          id: admission.id,
          dayNumber: targetDayLog.dayNumber,
          input: payload,
        });

        toast(
          queryRoundId
            ? `Updated ${roundType} for Day ${targetDayLog.dayNumber}!`
            : `Added ${roundType} to Day ${targetDayLog.dayNumber}!`,
          'success'
        );
      }

      router.push(`/ipd/${admission.id}`);
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save doctor visit'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Opening Doctor Visit Workstation..." />;
  if (error || !admission) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: '60px auto' }}>
        <ErrorState
          title="Inpatient Record Not Found"
          message="Could not find the hospital admission record for this visit."
          onRetry={() => router.push('/ipd')}
        />
      </div>
    );
  }

  const patient = admission.patient;

  return (
    <PageTransition>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
        {/* ─── TOP WORKSTATION HEADER BAR ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          }}
        >
          {/* Row 1: Back Navigation, Patient Info & Header Actions */}
          <div
            style={{
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link
                href={`/ipd/${admission.id}`}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <ArrowLeft size={16} /> Back to Inpatient Case Sheet
              </Link>

              <div style={{ height: 20, width: 1, background: 'var(--border)' }} className="hidden sm:block" />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {patient?.name || 'Inpatient'}
                </span>
                {patient?.age && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    ({patient.age}y / {patient.gender || 'Unknown'})
                  </span>
                )}
                <span
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#8b5cf6',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Bed size={13} /> Bed: {admission.bedOrRoom}
                </span>
                <span
                  style={{
                    background: 'rgba(13, 148, 136, 0.15)',
                    color: 'var(--primary)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    fontWeight: 800,
                  }}
                >
                  {queryRoundId
                    ? `Editing ${roundType}`
                    : isCreatingNewDay
                    ? `New Day Round (Day ${existingDays.length + 1})`
                    : `Day ${chosenDayNumber} Doctor Visit`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => router.push(`/ipd/${admission.id}`)}
                className="btn btn-secondary btn-sm"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVisit}
                className="btn btn-primary btn-sm"
                disabled={isSubmitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  background: '#10b981',
                  borderColor: '#10b981',
                  padding: '6px 16px',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{isSubmitting ? 'Saving Visit...' : queryRoundId ? 'Update Visit' : 'Save Doctor Visit'}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Target Day Assignment & Visit Session Selector */}
          <div
            style={{
              padding: '10px 20px',
              background: 'var(--surface-1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              borderBottom: '1px solid var(--border)',
            }}
          >
            {/* Session Type Pills */}
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
                      padding: '5px 11px',
                      borderRadius: 7,
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 800 : 500,
                      cursor: 'pointer',
                      border: isSelected ? meta.border : '1px solid var(--border)',
                      background: isSelected ? meta.bg : 'var(--surface-solid)',
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

            {/* Timing, Doctor, and Day Target */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {existingDays.length > 0 && !queryRoundId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>Assign To:</span>
                  <select
                    className="form-select"
                    style={{ height: 30, fontSize: '0.8rem', padding: '2px 8px' }}
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ height: 30, width: 105, fontSize: '0.8rem', padding: '2px 8px' }}
                  placeholder="09:30 AM"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  title="Visit Time"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <User size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  style={{ height: 30, width: 140, fontSize: '0.8rem', padding: '2px 8px' }}
                  placeholder="Attending Doctor"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  title="Attending Doctor for this Visit"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="date"
                  className="form-input"
                  style={{ height: 30, width: 'auto', fontSize: '0.8rem', padding: '2px 8px' }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  title="Visit Date"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Guaranteed High-Contrast Navigation Tabs (Fixes Invisible Text Bug) */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 20px',
              background: 'var(--surface-solid)',
              borderBottom: '1px solid var(--border)',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >
            {[
              { id: 'overview' as const, label: '📋 Bedside Overview' },
              { id: 'vitals' as const, label: '💓 Vitals & Trends' },
              { id: 'clinical' as const, label: '🩺 Doctor Observations' },
              { id: 'meds' as const, label: `💊 Medications (${rxMeds.length})` },
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
                    padding: '7px 16px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    whiteSpace: 'nowrap',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: isActive ? 'var(--primary)' : 'var(--surface-2)',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    boxShadow: isActive ? '0 2px 8px rgba(13, 148, 136, 0.3)' : 'none',
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── WORKSTATION FORM BODY ─── */}
        <div style={{ flex: 1, padding: '20px', maxWidth: 1250, margin: '0 auto', width: '100%' }}>
          {/* TAB 1: OVERVIEW (2-Column Bedside Chart) */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))', gap: 20 }}>
              {/* Left Column: Vitals & Clinical Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Vitals Card */}
                <div className="card" style={{ padding: 18, background: 'var(--surface-solid)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Activity size={17} style={{ color: 'var(--primary)' }} />
                      <span>Patient Vitals Checked During This Visit</span>
                    </div>
                    {Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95 && (
                      <span style={{ color: '#ef4444', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={13} /> Low SpO2 Warning
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
                        BP (mmHg)
                      </label>
                      <input
                        className="form-input"
                        placeholder="120/80"
                        style={{ height: 36, fontSize: '0.86rem' }}
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
                        style={{ height: 36, fontSize: '0.86rem' }}
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
                        style={{ height: 36, fontSize: '0.86rem' }}
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
                          height: 36,
                          fontSize: '0.86rem',
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
                        style={{ height: 36, fontSize: '0.86rem' }}
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
                        style={{ height: 36, fontSize: '0.86rem' }}
                        value={vitals.sugar}
                        onChange={(e) => setVitals((v) => ({ ...v, sugar: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Doctor Progress Observations Card */}
                <div className="card" style={{ padding: 18, background: 'var(--surface-solid)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                    <Stethoscope size={17} style={{ color: 'var(--primary)' }} />
                    <span>Doctor Progress Observations &amp; Round Notes</span>
                  </div>

                  <div style={{ marginBottom: 10 }}>
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

                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="Enter clinical progress, physical exam findings, complaints, response to medication, diagnostic review..."
                    style={{ fontSize: '0.86rem', lineHeight: 1.5, resize: 'vertical' }}
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Right Column: OPD Medications, Procedures, Nursing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* OPD Reused Medicine Component */}
                <div className="card" style={{ padding: 18, background: 'var(--surface-solid)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Pill size={17} style={{ color: 'var(--primary)' }} />
                      <span>Medications Charted in This Visit ({rxMeds.length})</span>
                    </div>
                  </div>

                  {/* Medicine Search Autocomplete */}
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <div className="search-input-wrap">
                      <span className="s-icon">
                        <Search size={16} />
                      </span>
                      <input
                        className="search-input"
                        placeholder="Search clinic inventory to prescribe medicine..."
                        value={medQuery}
                        onChange={(e) => setMedQuery(e.target.value)}
                      />
                    </div>

                    {medQuery.trim() !== '' && (
                      <div className="search-dropdown">
                        {filteredMeds.map((m) => (
                          <div key={m.id} className="search-result" onClick={() => addMedicine(m)}>
                            <div className="sr-name">{m.name}</div>
                            <div className="sr-meta">
                              {m.category} · {parseDoseToWords(m.defaultDose).en || m.defaultDose} · {m.defaultDuration}
                            </div>
                          </div>
                        ))}
                        <div
                          className="search-result"
                          style={{
                            color: 'var(--primary)',
                            fontWeight: 600,
                            borderTop: filteredMeds.length > 0 ? '1px solid var(--border)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(13, 148, 136, 0.05)',
                          }}
                          onClick={() => handleAddNewMedicineDirectly(medQuery)}
                        >
                          <Plus size={15} /> Add &quot;{medQuery.trim()}&quot; as new medicine
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prescription Rows Table */}
                  {rxMeds.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '18px',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        border: '1px dashed var(--border)',
                        borderRadius: 8,
                      }}
                    >
                      Search and prescribe medicines above using the OPD medicine engine.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {rxMeds.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border)',
                            borderRadius: 10,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <input
                              className="form-input"
                              placeholder="Medicine Name"
                              value={m.name}
                              onChange={(e) => updateMed(i, 'name', e.target.value)}
                              style={{ fontWeight: 700, fontSize: '0.88rem', height: 32, flex: 1, marginRight: 8 }}
                            />
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ color: 'var(--red)' }}
                              onClick={() => removeMed(i)}
                              title="Remove Medicine"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          {/* Reusing OPD DoseSelector & DurationSelect */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr', gap: 8 }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
                                Dose (1-0-1, SOS, Stat)
                              </label>
                              <DoseSelector value={m.dose} onChange={(v) => updateMed(i, 'dose', v)} />
                            </div>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
                                Duration
                              </label>
                              <DurationSelect value={m.duration} onChange={(v) => updateMed(i, 'duration', v)} />
                            </div>
                          </div>

                          {/* Reusing OPD InstructionPicker */}
                          <div>
                            <label className="form-label" style={{ fontSize: '0.7rem', marginBottom: 2 }}>
                              Instructions &amp; Timing
                            </label>
                            <InstructionPicker
                              instructionKeys={m.instructionKeys}
                              customInstruction={m.customInstruction}
                              languages={m.instructionLangs}
                              onChange={({ instructionKeys, customInstruction, languages, formattedText }) => {
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
                                      : item
                                  )
                                );
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Procedures & Services Card */}
                <div className="card" style={{ padding: 18, background: 'var(--surface-solid)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Receipt size={17} style={{ color: 'var(--primary)' }} />
                      <span>Procedures &amp; Charges in This Visit ({procedures.length})</span>
                    </div>
                  </div>

                  {/* Add Procedure Sub-Form */}
                  <div
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    {clinicProcedures.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <select
                          className="form-select"
                          style={{ height: 32, fontSize: '0.82rem' }}
                          onChange={(e) => {
                            const found = clinicProcedures.find((p) => p.name === e.target.value);
                            if (found) {
                              setCustomProcName(found.name);
                              setCustomProcPrice(String(found.price));
                            }
                          }}
                        >
                          <option value="">-- Choose Clinic Master Procedure --</option>
                          {clinicProcedures.map((proc, idx) => (
                            <option key={idx} value={proc.name}>
                              {proc.name} (₹{proc.price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="ipd-procedure-form-grid">
                      <input
                        className="form-input"
                        placeholder="Procedure Name (e.g. IV Saline 500ml)"
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

                  {procedures.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--surface-1)', borderRadius: 8, border: '1px dashed var(--border)' }}>
                      No procedures or care charges added for this visit.
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
                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.94rem' }}>
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
                        <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>Visit Procedure Total:</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.05rem' }}>
                          ₹{visitProcedureTotal}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Nursing & Diet Card */}
                <div className="card" style={{ padding: 18, background: 'var(--surface-solid)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                    <ClipboardList size={17} style={{ color: 'var(--primary)' }} />
                    <span>Nursing Directives &amp; Diet Orders</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
                        Nursing Shift Directives
                      </label>
                      <textarea
                        className="form-input"
                        rows={3}
                        placeholder="IV cannula site clean, input/output chart, position change, dressing check..."
                        style={{ fontSize: '0.84rem', lineHeight: 1.5, resize: 'vertical' }}
                        value={nursingNotes}
                        onChange={(e) => setNursingNotes(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 600, marginBottom: 3 }}>
                        Diet &amp; Nutrition Directives
                      </label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Clear liquid diet, soft diet, low sodium, NPO after midnight..."
                        style={{ fontSize: '0.84rem', lineHeight: 1.5, resize: 'vertical' }}
                        value={dietNotes}
                        onChange={(e) => setDietNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INDIVIDUAL FOCUSED TABS */}
          {activeTab === 'vitals' && (
            <div className="card" style={{ padding: 24, maxWidth: 750, margin: '0 auto', background: 'var(--surface-solid)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Activity size={20} style={{ color: 'var(--primary)' }} />
                <span>Patient Vitals Checked During This Visit</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>BP (mmHg)</label>
                  <input className="form-input" placeholder="120/80" value={vitals.bp} onChange={(e) => setVitals((v) => ({ ...v, bp: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Pulse (bpm)</label>
                  <input className="form-input" placeholder="76" type="number" value={vitals.pulse} onChange={(e) => setVitals((v) => ({ ...v, pulse: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Temp (°F)</label>
                  <input className="form-input" placeholder="98.6" value={vitals.temp} onChange={(e) => setVitals((v) => ({ ...v, temp: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>SpO2 (%)</label>
                  <input className="form-input" placeholder="98" type="number" value={vitals.spo2} onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Resp Rate (/min)</label>
                  <input className="form-input" placeholder="18" type="number" value={vitals.respRate} onChange={(e) => setVitals((v) => ({ ...v, respRate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Sugar (GRBS)</label>
                  <input className="form-input" placeholder="110 mg/dL" value={vitals.sugar} onChange={(e) => setVitals((v) => ({ ...v, sugar: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'clinical' && (
            <div className="card" style={{ padding: 24, maxWidth: 850, margin: '0 auto', background: 'var(--surface-solid)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Stethoscope size={20} style={{ color: 'var(--primary)' }} />
                <span>Doctor Progress Observations &amp; Round Notes</span>
              </div>
              <textarea
                className="form-input"
                rows={10}
                placeholder="Enter complete clinical observations, exam notes, diagnostic review, response to treatment..."
                style={{ fontSize: '0.9rem', lineHeight: 1.6 }}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'meds' && (
            <div className="card" style={{ padding: 24, maxWidth: 900, margin: '0 auto', background: 'var(--surface-solid)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Pill size={20} style={{ color: 'var(--primary)' }} />
                <span>Medications Prescribed &amp; Administered in This Visit</span>
              </div>
              {/* Medicine search */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <input
                  className="form-input"
                  placeholder="Search clinic inventory to add medicine..."
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                  style={{ height: 38 }}
                />
                {medQuery.trim() !== '' && (
                  <div className="search-dropdown">
                    {filteredMeds.map((m) => (
                      <div key={m.id} className="search-result" onClick={() => addMedicine(m)}>
                        <div className="sr-name">{m.name}</div>
                        <div className="sr-meta">{m.category} · {m.defaultDose}</div>
                      </div>
                    ))}
                    <div className="search-result" style={{ color: 'var(--primary)', fontWeight: 600 }} onClick={() => handleAddNewMedicineDirectly(medQuery)}>
                      + Add &quot;{medQuery.trim()}&quot; as new medicine
                    </div>
                  </div>
                )}
              </div>

              {rxMeds.map((m, i) => (
                <div key={i} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <input className="form-input" value={m.name} onChange={(e) => updateMed(i, 'name', e.target.value)} style={{ fontWeight: 700, flex: 1, marginRight: 8 }} />
                    <button type="button" className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => removeMed(i)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr', gap: 10, marginBottom: 8 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem' }}>Dose</label>
                      <DoseSelector value={m.dose} onChange={(v) => updateMed(i, 'dose', v)} />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.74rem' }}>Duration</label>
                      <DurationSelect value={m.duration} onChange={(v) => updateMed(i, 'duration', v)} />
                    </div>
                  </div>
                  <InstructionPicker
                    instructionKeys={m.instructionKeys}
                    customInstruction={m.customInstruction}
                    languages={m.instructionLangs}
                    onChange={({ instructionKeys, customInstruction, languages, formattedText }) => {
                      setRxMeds((prev) =>
                        prev.map((item, idx) =>
                          idx === i ? { ...item, instructions: formattedText, instructionKeys, customInstruction, instructionLangs: languages } : item
                        )
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'procedures' && (
            <div className="card" style={{ padding: 24, maxWidth: 850, margin: '0 auto', background: 'var(--surface-solid)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Receipt size={20} style={{ color: 'var(--primary)' }} />
                <span>Procedures &amp; Hospital Care Services</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input className="form-input" placeholder="Procedure Name" value={customProcName} onChange={(e) => setCustomProcName(e.target.value)} style={{ flex: 2 }} />
                <input className="form-input" placeholder="Qty" type="number" min="1" value={customProcQty} onChange={(e) => setCustomProcQty(e.target.value)} style={{ width: 80 }} />
                <input className="form-input" placeholder="Price (₹)" type="number" value={customProcPrice} onChange={(e) => setCustomProcPrice(e.target.value)} style={{ width: 120 }} />
                <button type="button" className="btn btn-primary" onClick={handleAddProcedure}>Add</button>
              </div>
              {procedures.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 10, background: 'var(--surface-1)', borderRadius: 8, marginBottom: 6 }}>
                  <span>{p.name} (Qty: {p.quantity} × ₹{p.unitPrice})</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <strong>₹{p.totalPrice}</strong>
                    <button type="button" className="btn-icon" onClick={() => setProcedures((l) => l.filter((_, i) => i !== idx))}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'nursing' && (
            <div className="card" style={{ padding: 24, maxWidth: 850, margin: '0 auto', background: 'var(--surface-solid)' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
                <span>Nursing Directives &amp; Diet Orders</span>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Nursing Shift Directives</label>
                <textarea className="form-input" rows={4} value={nursingNotes} onChange={(e) => setNursingNotes(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Diet &amp; Nutrition Directives</label>
                <textarea className="form-input" rows={3} value={dietNotes} onChange={(e) => setDietNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ─── STICKY BOTTOM ACTION BAR ─── */}
        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--surface-solid)',
            borderTop: '1px solid var(--border)',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Visit Procedure Total:{' '}
            <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>₹{visitProcedureTotal}</strong> · Prescribed Medications:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{rxMeds.length}</strong>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => router.push(`/ipd/${admission.id}`)}
              className="btn btn-secondary btn-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveVisit}
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                background: '#10b981',
                borderColor: '#10b981',
                padding: '6px 18px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? 'Saving...' : queryRoundId ? 'Update Visit' : 'Save Doctor Visit'}</span>
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
