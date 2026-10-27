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
  Sparkles,
  ClipboardList,
  Edit2,
  Clock,
  HeartPulse,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIpdMutations, useMedicines, useSettings } from '@/lib/hooks/useQueries';
import type { IpdAdmission, IpdDayLog, IpdMedicationItem, IpdProcedureItem } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

interface IpdDayLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: IpdAdmission;
  initialLog?: IpdDayLog | null;
  onSuccess?: (updated: IpdAdmission) => void;
}

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

export default function IpdDayLogModal({
  isOpen,
  onClose,
  admission,
  initialLog = null,
  onSuccess,
}: IpdDayLogModalProps) {
  const [mounted, setMounted] = useState(false);
  const isEditing = !!initialLog;
  const dayNumber = initialLog?.dayNumber || (admission.dayWiseLogs || []).length + 1;

  const { addDayLog, updateDayLog } = useIpdMutations();
  const { data: settings } = useSettings();
  const { data: inventoryMedicines = [] } = useMedicines();

  // Active Tab inside modal
  const [activeTab, setActiveTab] = useState<'vitals' | 'clinical' | 'meds' | 'procedures' | 'nursing'>('clinical');

  // Form states
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

  // Sync initial log if editing
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (initialLog) {
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
      } else {
        setDate(new Date().toISOString().slice(0, 10));
        setDoctorNotes('');
        setNursingNotes('');
        setDietNotes('');
        setVitals({ bp: '', pulse: '', temp: '', spo2: '', respRate: '', sugar: '' });
        setMedications([]);
        setProcedures([]);
      }
      setActiveTab('clinical');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialLog]);

  // Filtered medicine search suggestions from inventory
  const filteredMeds = useMemo(() => {
    if (!medSearchQuery.trim()) return [];
    const q = medSearchQuery.toLowerCase();
    return inventoryMedicines
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [medSearchQuery, inventoryMedicines]);

  // Add medication to log
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
    toast(`Added ${name} to Day ${dayNumber} treatment`, 'info');
  };

  // Add procedure to log
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

  // Calculate day total procedure charge
  const dayProcedureTotal = useMemo(() => {
    return procedures.reduce((sum, p) => sum + (Number(p.totalPrice) || 0), 0);
  }, [procedures]);

  // Submit day log
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Build summary string for medicines administered for backwards-compatibility
      const medsSummary = medications.map((m) => `${m.name} (${m.dose || ''} ${m.route || ''})`.trim()).join(', ');

      const payload = {
        date,
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
        dailyCharges: dayProcedureTotal,
        dietNotes: dietNotes.trim() || undefined,
      };

      let result: IpdAdmission;
      if (isEditing) {
        result = await updateDayLog.mutateAsync({
          id: admission.id,
          dayNumber,
          input: payload,
        });
        toast(`Day ${dayNumber} treatment log updated successfully!`, 'success');
      } else {
        result = await addDayLog.mutateAsync({
          id: admission.id,
          input: payload,
        });
        toast(`Treatment logged for Day ${dayNumber}! Total Day Charge: ₹${dayProcedureTotal}`, 'success');
      }

      onSuccess?.(result);
      onClose();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save treatment log'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const patientName = admission.patient?.name || 'Patient';
  const patientAge = admission.patient?.age ? `${admission.patient.age}y` : '';
  const patientGender = admission.patient?.gender || '';

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          padding: '12px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18 }}
          style={{
            background: 'var(--surface-solid)',
            borderRadius: 16,
            maxWidth: 720,
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--surface-1)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: 'rgba(13, 148, 136, 0.15)',
                    color: 'var(--primary)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  Day {dayNumber}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  {isEditing ? `Edit Treatment Chart · Day ${dayNumber}` : `Doctor Rounds & Treatment · Day ${dayNumber}`}
                </h3>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                Patient: <strong style={{ color: 'var(--text-primary)' }}>{patientName}</strong> ({[patientAge, patientGender].filter(Boolean).join(', ')}) · Bed: <strong style={{ color: 'var(--primary)' }}>{admission.bedOrRoom}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-icon"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Section Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'clinical', label: 'Doctor Notes & Progress', icon: Stethoscope },
              { id: 'vitals', label: 'Vitals Panel', icon: Activity },
              { id: 'meds', label: `Medications (${medications.length})`, icon: Pill },
              { id: 'procedures', label: `Procedures (${procedures.length})`, icon: Receipt },
              { id: 'nursing', label: 'Nursing & Diet', icon: ClipboardList },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Body Content */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Date of Round Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 16,
                  padding: '10px 14px',
                  background: 'var(--surface-1)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Round Date:
                </div>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 'auto', height: 32, fontSize: '0.82rem' }}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* TAB 1: CLINICAL PROGRESS */}
              {activeTab === 'clinical' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Doctor Progress Observations &amp; Round Notes
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={4}
                      placeholder="e.g. Patient afebrile today. Abdominal tenderness significantly reduced. Bowel sounds present. Tolerated oral liquids well. Continue current IV antibiotics."
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                    />
                  </div>

                  {/* Quick-fill clinical observations */}
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                      Quick observation tags (click to append):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {CLINICAL_STATUS_CHIPS.map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDoctorNotes((prev) => (prev ? `${prev}. ${chip}` : chip));
                          }}
                          style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border)',
                            borderRadius: 16,
                            padding: '4px 10px',
                            fontSize: '0.73rem',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VITALS PANEL */}
              {activeTab === 'vitals' && (
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Record regular inpatient vital signs. Abnormal parameters are flagged automatically for clinical safety.
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        Blood Pressure (BP)
                      </label>
                      <input
                        className="form-input"
                        placeholder="120/80"
                        value={vitals.bp}
                        onChange={(e) => setVitals((v) => ({ ...v, bp: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        Pulse (bpm)
                      </label>
                      <input
                        className="form-input"
                        placeholder="76"
                        type="number"
                        value={vitals.pulse}
                        onChange={(e) => setVitals((v) => ({ ...v, pulse: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        Temperature (°F)
                      </label>
                      <input
                        className="form-input"
                        placeholder="98.6"
                        value={vitals.temp}
                        onChange={(e) => setVitals((v) => ({ ...v, temp: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        SpO2 Oxygen (%)
                      </label>
                      <input
                        className="form-input"
                        placeholder="98"
                        type="number"
                        value={vitals.spo2}
                        onChange={(e) => setVitals((v) => ({ ...v, spo2: e.target.value }))}
                      />
                      {Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95 && (
                        <div style={{ color: '#ef4444', fontSize: '0.68rem', marginTop: 2, fontWeight: 700 }}>
                          ⚠️ Low Oxygen Warning
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        Resp Rate (/min)
                      </label>
                      <input
                        className="form-input"
                        placeholder="18"
                        type="number"
                        value={vitals.respRate}
                        onChange={(e) => setVitals((v) => ({ ...v, respRate: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                        Blood Sugar (GRBS)
                      </label>
                      <input
                        className="form-input"
                        placeholder="110 mg/dL"
                        value={vitals.sugar}
                        onChange={(e) => setVitals((v) => ({ ...v, sugar: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MEDICATIONS (Prescription style) */}
              {activeTab === 'meds' && (
                <div>
                  {/* Add Medication Box */}
                  <div
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: 10 }}>
                      + Administer Medication Today
                    </div>

                    {/* Medicine name with Autocomplete */}
                    <div style={{ marginBottom: 10, position: 'relative' }}>
                      <input
                        className="form-input"
                        placeholder="Type medicine name or search clinic inventory..."
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
                            zIndex: 10,
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
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>
                          Dosage Frequency
                        </label>
                        <select
                          className="form-select"
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
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>
                          Administration Route
                        </label>
                        <select
                          className="form-select"
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
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>
                          Timing
                        </label>
                        <select
                          className="form-select"
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

                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        className="form-input"
                        placeholder="Administration notes (e.g. slow infusion, with 100ml NS)"
                        style={{ fontSize: '0.82rem' }}
                        value={newMedInstructions}
                        onChange={(e) => setNewMedInstructions(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleAddMedication}
                      >
                        <Plus size={14} /> Add Med
                      </button>
                    </div>
                  </div>

                  {/* List of Medications added for this day */}
                  {medications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No medications charted for Day {dayNumber} yet. Add above.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {medications.map((med, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{med.name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{med.dose}</span> · Route: {med.route} · {med.timing}
                              {med.instructions && ` (${med.instructions})`}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ color: '#ef4444' }}
                            onClick={() => setMedications((list) => list.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PROCEDURES & BILLING */}
              {activeTab === 'procedures' && (
                <div>
                  <div
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', marginBottom: 10 }}>
                      + Add Procedure / Nursing Service Given
                    </div>

                    {/* Quick Select Configured Service Rates */}
                    {clinicProcedures.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem' }}>
                          Quick-Pick Clinic Configured Procedure:
                        </label>
                        <select
                          className="form-select"
                          style={{ fontSize: '0.82rem' }}
                          onChange={(e) => {
                            const found = clinicProcedures.find((p) => p.name === e.target.value);
                            if (found) {
                              setCustomProcName(found.name);
                              setCustomProcPrice(String(found.price));
                            }
                          }}
                        >
                          <option value="">-- Choose Procedure from Clinic Master --</option>
                          {clinicProcedures.map((proc, i) => (
                            <option key={i} value={proc.name}>
                              {proc.name} (₹{proc.price})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
                      <input
                        className="form-input"
                        placeholder="Procedure name (e.g. IV Fluid, Dressing)"
                        value={customProcName}
                        onChange={(e) => setCustomProcName(e.target.value)}
                      />
                      <input
                        className="form-input"
                        placeholder="Qty"
                        type="number"
                        min="1"
                        value={customProcQty}
                        onChange={(e) => setCustomProcQty(e.target.value)}
                      />
                      <input
                        className="form-input"
                        placeholder="Unit Price (₹)"
                        type="number"
                        value={customProcPrice}
                        onChange={(e) => setCustomProcPrice(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap' }}
                        onClick={handleAddProcedure}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>

                  {/* Procedures List */}
                  {procedures.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No procedures billed for Day {dayNumber}.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {procedures.map((proc, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{proc.name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Qty: {proc.quantity} × ₹{proc.unitPrice}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                              ₹{proc.totalPrice}
                            </div>
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ color: '#ef4444' }}
                              onClick={() => setProcedures((list) => list.filter((_, i) => i !== idx))}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Day Procedure Charges Total */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          background: 'rgba(13, 148, 136, 0.08)',
                          borderRadius: 8,
                          border: '1px solid rgba(13, 148, 136, 0.25)',
                          marginTop: 6,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Day {dayNumber} Procedure Charges:</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.1rem' }}>
                          ₹{dayProcedureTotal}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: NURSING & DIET */}
              {activeTab === 'nursing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Nursing Notes &amp; Shift Handoff Observations
                    </label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      placeholder="e.g. IV cannula site clean, no phlebitis. Urine output 1200ml clear. Patient ambulated with support."
                      value={nursingNotes}
                      onChange={(e) => setNursingNotes(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Diet &amp; Fluid Orders
                    </label>
                    <input
                      className="form-input"
                      placeholder="e.g. Soft bland diet, fluid intake 2 Litres / 24 hours, low sodium"
                      value={dietNotes}
                      onChange={(e) => setDietNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface-1)',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {procedures.length} procedure(s) · {medications.length} med(s) charting
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : `Save Day ${dayNumber} Log`}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
