'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Search, Stethoscope, Pill, X, Sun, Moon, Sunrise } from 'lucide-react';
import { useProviderStore } from '@/lib/providers';
import { useMedicines, useMedicineMutations, useVisitMutations, usePatient, useAppOptions, useTemplates, useAppOptionMutations } from '@/lib/hooks/useQueries';
import type { Patient, Medicine, PrescribedMedicine, Template } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import PageTransition from '@/components/PageTransition';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceInputButton from '@/components/VoiceInputButton';
import { getVisitDraft, saveVisitDraft, clearVisitDraft } from '@/lib/visitDraft';
import InstructionPicker from '@/components/InstructionPicker';
import DoseSelector, { DurationSelect } from '@/components/DoseSelector';
import { parseDoseToWords } from '@/lib/medicationInstructions';
import { visitSchema, validateForm } from '@/lib/validations/schemas';


const QUICK_COMPLAINTS = [
  'Fever', 'Cough', 'Cold', 'Body Ache', 'Headache',
  'Vomiting', 'Diarrhoea', 'Chest Pain', 'Breathlessness',
  'Sore Throat', 'Fatigue', 'Dizziness', 'Abdominal Pain', 'Joint Pain',
];

const DOSE_OPTIONS = ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', '1/2-0-1/2', 'SOS', 'As needed', 'Stat'];
const DURATION_OPTIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '30 days', '90 days'];

export default function NewVisitForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const prePatientId = sp.get('patientId') || '';

  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medQuery, setMedQuery] = useState('');
  const [rxMeds, setRxMeds] = useState<PrescribedMedicine[]>([]);
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const [form, setForm] = useState({
    category: '', chiefComplaints: '', diagnosis: '', bp: '', pulse: '', temp: '', spo2: '',
    weight: '', treatment: '', prescriptionNotes: '', followUpDate: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const provider = useProviderStore((s) => s.provider);
  const { create: createVisit } = useVisitMutations();
  const { create: createOption } = useAppOptionMutations();
  const { data: medicinesData = [] } = useMedicines();
  const { data: complaintOptions = [] } = useAppOptions('CHIEF_COMPLAINT');
  const { data: diseaseOptions = [] } = useAppOptions('DISEASE');
  const { data: categoryOptions = [] } = useAppOptions('CATEGORY');
  const { data: templates = [] } = useTemplates();

  const activeComplaints = [...new Set([...QUICK_COMPLAINTS, ...complaintOptions.map(o => o.value)])];
  const activeDiseases = diseaseOptions.map(o => o.value);

  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [existingDraft, setExistingDraft] = useState<any>(null);
  const isFormDirty = useRef(false);

  // Check for existing draft on mount
  useEffect(() => {
    const d = getVisitDraft();
    if (d && (d.patient || d.form.chiefComplaints || d.form.diagnosis || d.rxMeds.length > 0)) {
      setExistingDraft(d);
      setDraftModalOpen(true);
    }
  }, []);

  // Auto-save draft when fields change
  useEffect(() => {
    const hasData = selectedPatient || form.chiefComplaints || form.diagnosis || form.treatment || form.prescriptionNotes || rxMeds.length > 0;
    isFormDirty.current = !!hasData;
    if (hasData) {
      saveVisitDraft({
        patient: selectedPatient,
        form,
        rxMeds,
        selectedComplaints,
      });
    }
  }, [selectedPatient, form, rxMeds, selectedComplaints]);

  // Unsaved changes browser prompt on tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormDirty.current) {
        e.preventDefault();
        e.returnValue = 'You have an incomplete visit. Changes will be saved as a draft.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const restoreDraft = () => {
    if (existingDraft) {
      if (existingDraft.patient) setSelectedPatient(existingDraft.patient);
      if (existingDraft.form) setForm(existingDraft.form);
      if (existingDraft.rxMeds) setRxMeds(existingDraft.rxMeds);
      if (existingDraft.selectedComplaints) setSelectedComplaints(existingDraft.selectedComplaints);
      toast('Incomplete visit draft restored!', 'success');
    }
    setDraftModalOpen(false);
  };

  const discardDraft = () => {
    clearVisitDraft();
    setExistingDraft(null);
    setDraftModalOpen(false);
    toast('Draft cleared.', 'info');
  };

  // Load pre-selected patient if URL param exists
  useEffect(() => {
    if (!prePatientId) return;
    provider.getPatient(prePatientId).then(p => {
      if (p) setSelectedPatient(p);
    });
  }, [prePatientId, provider]);

  // Patient search
  useEffect(() => {
    if (!patientQuery.trim()) { setPatientResults([]); return; }
    const t = setTimeout(async () => {
      const r = await provider.listPatients({ search: patientQuery });
      setPatientResults(r.slice(0, 6));
    }, 200);
    return () => clearTimeout(t);
  }, [patientQuery, provider]);

  const toggleComplaint = (c: string) => {
    setSelectedComplaints(prev => {
      const isSelected = prev.includes(c);
      const next = isSelected ? prev.filter(x => x !== c) : [...prev, c];
      
      // Update the chiefComplaints string
      let currentText = form.chiefComplaints;
      if (!isSelected) {
        // Add
        if (currentText && !currentText.trim().endsWith(',')) {
          currentText += ', ' + c;
        } else if (currentText) {
          currentText += ' ' + c;
        } else {
          currentText = c;
        }
      } else {
        // Remove - handle various delimiters and spaces
        const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|,\\s*)${escaped}(?=\\s*,|$)`, 'g');
        currentText = currentText.replace(regex, '').replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
      }
      
      setForm(f => ({ ...f, chiefComplaints: currentText.trim() }));
      return next;
    });
  };

  const syncComplaints = (val: string) => {
    set('chiefComplaints', val);
    const active = activeComplaints.filter(c => val.toLowerCase().includes(c.toLowerCase()));
    setSelectedComplaints(active);
  };

  const applyTemplate = (tId: string) => {
    if (!tId) return;
    const t = templates.find(x => x.id?.toString() === tId);
    if (!t) return;
    
    setForm(f => ({
      ...f,
      diagnosis: f.diagnosis ? `${f.diagnosis}, ${t.diagnosis}` : t.diagnosis,
      prescriptionNotes: f.prescriptionNotes ? `${f.prescriptionNotes}\n${t.notes || ''}` : t.notes || '',
    }));

    if (t.medicines && Array.isArray(t.medicines)) {
      setRxMeds(prev => [...prev, ...t.medicines!]);
    }
    toast('Template applied', 'success');
  };

  const addMedicine = (m: Medicine) => {
    setRxMeds(prev => [...prev, { medicineId: m.id, name: m.name, dose: m.defaultDose, duration: m.defaultDuration, instructions: '' }]);
    setMedQuery('');
  };

  const updateMed = (i: number, k: keyof PrescribedMedicine, v: string) => {
    setRxMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  };

  const removeMed = (i: number) => setRxMeds(prev => prev.filter((_, idx) => idx !== i));

  const { create: createMedMut } = useMedicineMutations();

  const handleAddNewMedicineDirectly = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const newMed = await createMedMut.mutateAsync({
        name: trimmed,
        category: 'Other',
        defaultDose: '1-0-1',
        defaultDuration: '5 days'
      });
      addMedicine(newMed);
      toast(`Added "${trimmed}" to prescription & master list.`, 'success');
    } catch (err) {
      // Fallback: add directly to current prescription even if saving to DB fails
      addMedicine({ name: trimmed, category: 'Other', defaultDose: '1-0-1', defaultDuration: '5 days' });
    }
  };

  const filteredMeds = medicinesData.filter(m =>
    m.name.toLowerCase().includes(medQuery.toLowerCase()) &&
    !rxMeds.find(r => r.name === m.name)
  ).slice(0, 50);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const scrollToError = (fieldName: string) => {
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${fieldName}"]`) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 50);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const visitPayload = {
      patientId: selectedPatient?.patientId || '',
      category: form.category,
      chiefComplaints: form.chiefComplaints,
      diagnosis: form.diagnosis,
      bp: form.bp,
      pulse: form.pulse,
      temp: form.temp,
      spo2: form.spo2,
      weight: form.weight,
    };

    const { isValid, errors: validationErrors } = await validateForm(visitSchema, visitPayload);
    const newErrors: Record<string, string> = { ...validationErrors as Record<string, string> };

    if (!selectedPatient) {
      newErrors.patient = 'Please search and select a patient first.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorField = Object.keys(newErrors)[0];
      if (firstErrorField && newErrors[firstErrorField]) {
        toast(newErrors[firstErrorField], 'error');
        scrollToError(firstErrorField);
      }
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const now = new Date();
      await createVisit.mutateAsync({
        patientId: selectedPatient!.patientId,
        category: form.category,
        date: now.toISOString(),
        chiefComplaints: form.chiefComplaints.trim(),
        diagnosis: form.diagnosis.trim(),
        bp: form.bp.trim() || undefined,
        pulse: form.pulse.trim() || undefined,
        temp: form.temp.trim() || undefined,
        spo2: form.spo2.trim() || undefined,
        weight: form.weight.trim() || undefined,
        treatment: form.treatment.trim() || undefined,
        prescriptionNotes: form.prescriptionNotes.trim() || undefined,
        medicines: rxMeds,
        followUpDate: form.followUpDate || undefined,
        followUpAttended: false,
      });
      clearVisitDraft();
      isFormDirty.current = false;
      toast('OPD Visit saved successfully!', 'success');
      router.push(`/patients/${selectedPatient!.patientId}`);
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to save visit.'), 'error');
      setSaving(false);
    }
  };

  return (
    <PageTransition className="page-transition" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link href="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 6 }}>
            <ChevronLeft size={15} /> Back
          </Link>
          <div className="page-title">New OPD Visit</div>
          <div className="page-subtitle">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Patient Selection */}
        <div className="card" style={{ marginBottom: 16, position: 'relative', zIndex: 50 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Patient</div>
          {selectedPatient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface-1)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
              <div className="followup-avatar">{selectedPatient.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{selectedPatient.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedPatient.mobile} · {selectedPatient.gender}, {selectedPatient.age}y</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPatient(null)}>Change</button>
            </div>
          ) : (
            <div style={{ position: 'relative', zIndex: 100 }}>
              <div className="search-input-wrap">
                <span className="s-icon"><Search /></span>
                <input className="search-input"
                  placeholder="Search patient by name or mobile…"
                  value={patientQuery} onChange={e => setPatientQuery(e.target.value)} />
              </div>
              {patientResults.length > 0 && (
                <div className="search-dropdown">
                  {patientResults.map(p => (
                    <div key={p.id} className="search-result" onClick={() => { setSelectedPatient(p); setPatientQuery(''); setPatientResults([]); }}>
                      <div className="sr-name">{p.name}</div>
                      <div className="sr-meta">{p.mobile} · {p.gender}, {p.age}y</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Patient not found? <Link href="/patients/new" style={{ color: 'var(--accent-light)' }}>Register new patient</Link>
              </div>
            </div>
          )}
        </div>

        {/* Visit Details */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Visit Details</div>
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="form-label">Visit Category <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="" disabled>Select category...</option>
                <option value="OPD">OPD</option>
                <option value="IPD">IPD</option>
                <option value="Emergency">Emergency</option>
                {categoryOptions.filter(o => !['OPD', 'IPD', 'Emergency'].includes(o.value)).map(c => (
                  <option key={c.id} value={c.value}>{c.value}</option>
                ))}
              </select>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={async () => {
                  const val = prompt('Enter new category name:');
                  if (val?.trim()) {
                    await createOption.mutateAsync({ optionType: 'CATEGORY', value: val.trim() });
                    set('category', val.trim());
                    toast('Category added', 'success');
                  }
                }}
              >
                <Plus size={16} /> New
              </button>
            </div>
          </div>
        </div>

        {/* Vitals */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Vitals</div>
          <div className="vitals-grid">
            {[
              { label: 'BP (mmHg)', key: 'bp', placeholder: '120/80' },
              { label: 'Pulse (/min)', key: 'pulse', placeholder: '72' },
              { label: 'Temp (°F)', key: 'temp', placeholder: '98.6' },
              { label: 'SpO₂ (%)', key: 'spo2', placeholder: '99' },
            ].map(v => (
              <div key={v.key} className="vital-card" style={{ textAlign: 'left' }}>
                <div className="vital-label">{v.label}</div>
                <input
                  data-field={v.key}
                  className={`form-input ${errors[v.key] ? 'has-error' : ''}`}
                  placeholder={v.placeholder}
                  value={form[v.key as keyof typeof form]}
                  onChange={e => {
                    const val = v.key === 'bp' ? e.target.value : e.target.value.replace(/-/g, '');
                    set(v.key, val);
                    if (errors[v.key]) {
                      setErrors(err => { const c = { ...err }; delete c[v.key]; return c; });
                    }
                  }}
                  style={{
                    marginTop: 4,
                    ...(errors[v.key] ? { border: '2px solid var(--red)' } : {})
                  }}
                />
                {errors[v.key] && <span style={{ color: 'var(--red)', fontSize: '0.72rem', marginTop: 2, display: 'block' }}>{errors[v.key]}</span>}
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginTop: 12, maxWidth: 200 }}>
            <label className="form-label">Weight (kg)</label>
            <input
              data-field="weight"
              className={`form-input ${errors.weight ? 'has-error' : ''}`}
              style={errors.weight ? { border: '2px solid var(--red)' } : {}}
              placeholder="e.g. 65"
              type="number"
              min="0"
              value={form.weight}
              onChange={e => {
                set('weight', e.target.value.replace(/-/g, ''));
                if (errors.weight) { setErrors(err => { const c = { ...err }; delete c.weight; return c; }); }
              }}
            />
            {errors.weight && <span style={{ color: 'var(--red)', fontSize: '0.72rem', marginTop: 2, display: 'block' }}>{errors.weight}</span>}
          </div>
        </div>

        {/* Chief Complaints */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Chief Complaints <span className="required">*</span></div>
            <VoiceInputButton
              title="Dictate Chief Complaints"
              onTranscript={(text) => {
                syncComplaints(text);
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {activeComplaints.map(c => (
              <button key={c} type="button" className={`quick-btn ${selectedComplaints.includes(c) ? 'selected' : ''}`}
                onClick={() => toggleComplaint(c)}>{c}</button>
            ))}
          </div>
          <textarea
            data-field="chiefComplaints"
            className={`form-textarea ${errors.chiefComplaints ? 'has-error' : ''}`}
            style={{
              minHeight: 80,
              ...(errors.chiefComplaints ? { border: '2px solid var(--red)' } : {})
            }}
            placeholder="Describe chief complaints in detail…"
            value={form.chiefComplaints}
            onChange={e => {
              syncComplaints(e.target.value);
              if (errors.chiefComplaints) { setErrors(err => { const c = { ...err }; delete c.chiefComplaints; return c; }); }
            }}
          />
          {errors.chiefComplaints && <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>{errors.chiefComplaints}</span>}
        </div>

        {/* Diagnosis & Treatment */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Diagnosis & Treatment</div>
            {templates.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowTemplateModal(true)}>
                <Pill size={14} /> Select Template
              </button>
            )}
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Diagnosis</label>
                <VoiceInputButton
                  title="Dictate Diagnosis"
                  onTranscript={(text) => {
                    set('diagnosis', text);
                  }}
                />
              </div>
              {activeDiseases.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {activeDiseases.map(d => (
                    <button key={d} type="button" className="quick-btn" onClick={() => set('diagnosis', form.diagnosis ? `${form.diagnosis}, ${d}` : d)}>{d}</button>
                  ))}
                </div>
              )}
              <textarea className="form-textarea" placeholder="Clinical diagnosis…" value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} style={{ minHeight: 100 }} />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Treatment Given</label>
                <VoiceInputButton
                  title="Dictate Treatment Given"
                  onTranscript={(text) => {
                    set('treatment', text);
                  }}
                />
              </div>
              <textarea className="form-textarea" placeholder="Procedures, injections, etc." value={form.treatment} onChange={e => set('treatment', e.target.value)} style={{ minHeight: 100 }} />
            </div>
          </div>
        </div>

        {/* Prescription */}
        <div className="card" style={{ marginBottom: 16, position: 'relative', zIndex: 40 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Prescription</div>

          {/* Medicine Search */}
          <div style={{ position: 'relative', zIndex: 100, marginBottom: 14 }}>
            <div className="search-input-wrap">
              <span className="s-icon"><Search /></span>
              <input className="search-input"
                placeholder="Search medicine to add…"
                value={medQuery} onChange={e => setMedQuery(e.target.value)} />
            </div>
            {medQuery.trim() !== '' && (
              <div className="search-dropdown">
                {filteredMeds.map(m => (
                  <div key={m.id} className="search-result" onClick={() => addMedicine(m)}>
                    <div className="sr-name">{m.name}</div>
                    <div className="sr-meta">{m.category} · {parseDoseToWords(m.defaultDose).en || m.defaultDose} · {m.defaultDuration}</div>
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
                    background: 'rgba(13, 148, 136, 0.05)'
                  }}
                  onClick={() => handleAddNewMedicineDirectly(medQuery)}
                >
                  <Plus size={15} /> Add &quot;{medQuery.trim()}&quot; as new medicine
                </div>
              </div>
            )}
          </div>

          {/* Medicine Rows */}
          {rxMeds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.84rem', border: '1px dashed var(--border)', borderRadius: 8 }}>
              Search and add medicines above
            </div>
          ) : (
            <>
              <div className="med-row-header" style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.1fr 1.1fr 2.5fr auto', gap: 8, padding: '4px 6px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                <span>Medicine</span><span>Dose</span><span>Duration</span><span>Instructions</span><span></span>
              </div>
              <datalist id="dose-options">
                {DOSE_OPTIONS.map(d => <option key={d} value={d} />)}
              </datalist>
              <datalist id="duration-options">
                {DURATION_OPTIONS.map(d => <option key={d} value={d} />)}
              </datalist>
              {rxMeds.map((m, i) => (
                <div key={i} className="med-row">
                  <div className="med-row-field">
                    <span className="med-row-field-label" style={{ display: 'none' }}>Medicine Name</span>
                    <input className="form-input" placeholder="Medicine Name" value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                  </div>
                  
                  <div className="med-row-field">
                    <span className="med-row-field-label" style={{ display: 'none' }}>Dose</span>
                    <DoseSelector value={m.dose} onChange={v => updateMed(i, 'dose', v)} />
                  </div>
                  <div className="med-row-field">
                    <span className="med-row-field-label" style={{ display: 'none' }}>Duration</span>
                    <DurationSelect value={m.duration} onChange={v => updateMed(i, 'duration', v)} />
                  </div>

                  <div className="med-row-field">
                    <span className="med-row-field-label" style={{ display: 'none' }}>Instructions</span>
                    <InstructionPicker
                      instructionKeys={m.instructionKeys}
                      customInstruction={m.customInstruction}
                      languages={m.instructionLangs}
                      onChange={({ instructionKeys, customInstruction, languages, formattedText }) => {
                        setRxMeds(prev => prev.map((item, idx) => idx === i ? {
                          ...item,
                          instructions: formattedText,
                          instructionKeys,
                          customInstruction,
                          instructionLangs: languages
                        } : item));
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => removeMed(i)}>
                      <Trash2 size={15} /> <span className="mobile-only-inline">Remove Medicine</span>
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="form-group" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Prescription Notes</label>
              <VoiceInputButton
                title="Dictate Prescription Notes"
                onTranscript={(text) => {
                  set('prescriptionNotes', form.prescriptionNotes ? `${form.prescriptionNotes}\n${text}` : text);
                }}
              />
            </div>
            <textarea className="form-textarea" placeholder="Additional instructions, advice, diet, rest…"
              value={form.prescriptionNotes} onChange={e => set('prescriptionNotes', e.target.value)} style={{ minHeight: 70 }} />
          </div>
        </div>

        {/* Follow-up */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Follow-up</div>
          <div className="form-group" style={{ maxWidth: 280 }}>
            <label className="form-label">Next Visit Date</label>
            <input className="form-input" type="date"
              min={new Date().toISOString().split('T')[0]}
              value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
            <span className="form-hint">Leave blank if no follow-up needed</span>
          </div>
        </div>

        <div className="form-actions">
          <Link href="/patients" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            <Stethoscope size={18} /> {saving ? 'Saving…' : 'Save OPD Visit'}
          </button>
        </div>
      </form>

      {/* Template Modal */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
            <motion.div 
              className="modal modal-md" 
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <div className="modal-header">
                <h3>Select Prescription Template</h3>
                <button className="btn-icon" onClick={() => setShowTemplateModal(false)}><X /></button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {templates.map(t => (
                    <div 
                      key={t.id} 
                      className="card card-sm" 
                      style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border)' }}
                      onClick={() => { applyTemplate(t.id!.toString()); setShowTemplateModal(false); }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--accent-light)', marginBottom: 4 }}>{t.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.diagnosis || 'No diagnosis info'}
                      </div>
                      <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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

      {/* Restore Draft Modal */}
      <AnimatePresence>
        {draftModalOpen && existingDraft && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <motion.div 
              className="modal modal-md" 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ textAlign: 'left', padding: '24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stethoscope size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Resume Incomplete Visit?</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Saved {new Date(existingDraft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div style={{ background: 'var(--surface-1)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '20px' }}>
                {existingDraft.patient ? (
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Patient</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{existingDraft.patient.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{existingDraft.patient.mobile}</div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    Incomplete visit with clinical notes / medicines.
                  </div>
                )}
                {existingDraft.form?.chiefComplaints && (
                  <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong>Complaints:</strong> {existingDraft.form.chiefComplaints}
                  </div>
                )}
                {existingDraft.rxMeds?.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--accent-light)' }}>
                    {existingDraft.rxMeds.length} prescribed medicines draft saved
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={discardDraft}>
                  Discard & Start Fresh
                </button>
                <button type="button" className="btn btn-primary" onClick={restoreDraft}>
                  Continue Visit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
