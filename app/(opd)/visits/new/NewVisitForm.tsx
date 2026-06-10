'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Search, Stethoscope, Pill, X, Sun, Moon, Sunrise } from 'lucide-react';
import { useProviderStore } from '@/lib/providers';
import { useMedicines, useVisitMutations, usePatient, useAppOptions, useTemplates, useAppOptionMutations } from '@/lib/hooks/useQueries';
import type { Patient, Medicine, PrescribedMedicine, Template } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';
import { motion, AnimatePresence } from 'framer-motion';

function DoseSelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const parts = value.split('-');
  const morning = parts[0] === '1' || parts[0] === '1/2';
  const afternoon = parts[1] === '1' || parts[1] === '1/2';
  const night = parts[2] === '1' || parts[2] === '1/2';

  const toggle = (idx: number) => {
    const p = [...parts];
    if (p.length < 3) { p[0] = '0'; p[1] = '0'; p[2] = '0'; }
    p[idx] = (p[idx] === '1' || p[idx] === '1/2') ? '0' : '1';
    onChange(p.join('-'));
  };

  return (
    <div style={{ position: 'relative' }}>
      <input 
        className="form-input" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        onFocus={() => setOpen(true)}
        placeholder="Dose"
      />
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div className="dose-popover">
            {[
              { label: 'Morning', icon: <Sunrise size={18} />, active: morning },
              { label: 'Afternoon', icon: <Sun size={18} />, active: afternoon },
              { label: 'Night', icon: <Moon size={18} />, active: night },
            ].map((d, i) => (
              <div key={d.label} className={`dose-toggle ${d.active ? 'active' : ''}`} onClick={() => toggle(i)}>
                {d.icon}
                <span>{d.label}</span>
                <div className="dose-toggle-val">{d.active ? '1' : '0'}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


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

  const filteredMeds = medicinesData.filter(m =>
    m.name.toLowerCase().includes(medQuery.toLowerCase()) &&
    !rxMeds.find(r => r.name === m.name)
  ).slice(0, 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) { toast('Please select a patient first.', 'error'); return; }
    if (!form.category) { toast('Please select a visit category.', 'error'); return; }
    if (!form.chiefComplaints.trim()) { toast('Chief complaints are required.', 'error'); return; }
    setSaving(true);
    try {
      const now = new Date();
      await createVisit.mutateAsync({
        patientId: selectedPatient.patientId,
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
      toast('OPD Visit saved successfully!', 'success');
      router.push(`/patients/${selectedPatient.patientId}`);
    } catch (err) {
      toast('Failed to save visit.', 'error');
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
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Patient</div>
          {selectedPatient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface-1)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
              <div className="followup-avatar">{selectedPatient.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{selectedPatient.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedPatient.patientId} · {selectedPatient.mobile} · {selectedPatient.gender}, {selectedPatient.age}y</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPatient(null)}>Change</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div className="search-input-wrap">
                <span className="s-icon"><Search /></span>
                <input className="search-input"
                  placeholder="Search patient by name, mobile, or ID…"
                  value={patientQuery} onChange={e => setPatientQuery(e.target.value)} />
              </div>
              {patientResults.length > 0 && (
                <div className="search-dropdown">
                  {patientResults.map(p => (
                    <div key={p.id} className="search-result" onClick={() => { setSelectedPatient(p); setPatientQuery(''); setPatientResults([]); }}>
                      <div className="sr-name">{p.name}</div>
                      <div className="sr-meta">{p.patientId} · {p.mobile} · {p.gender}, {p.age}y</div>
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
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)} required>
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
                <input className="form-input" placeholder={v.placeholder}
                  value={form[v.key as keyof typeof form]} onChange={e => set(v.key, e.target.value)}
                  style={{ marginTop: 4 }} />
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginTop: 12, maxWidth: 200 }}>
            <label className="form-label">Weight (kg)</label>
            <input className="form-input" placeholder="e.g. 65" value={form.weight} onChange={e => set('weight', e.target.value)} />
          </div>
        </div>

        {/* Chief Complaints */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Chief Complaints</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {activeComplaints.map(c => (
              <button key={c} type="button" className={`quick-btn ${selectedComplaints.includes(c) ? 'selected' : ''}`}
                onClick={() => toggleComplaint(c)}>{c}</button>
            ))}
          </div>
          <textarea className="form-textarea" placeholder="Describe chief complaints in detail…"
            value={form.chiefComplaints} onChange={e => syncComplaints(e.target.value)} style={{ minHeight: 80 }} />
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
              <label className="form-label">Diagnosis</label>
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
              <label className="form-label">Treatment Given</label>
              <textarea className="form-textarea" placeholder="Procedures, injections, etc." value={form.treatment} onChange={e => set('treatment', e.target.value)} style={{ minHeight: 100 }} />
            </div>
          </div>
        </div>

        {/* Prescription */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            <div className="section-title"><Pill size={18} /> Prescription</div>
          </div>

          {/* Medicine Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <div className="search-input-wrap">
              <span className="s-icon"><Search /></span>
              <input className="search-input"
                placeholder="Search medicine to add…"
                value={medQuery} onChange={e => setMedQuery(e.target.value)} />
            </div>
            {medQuery && filteredMeds.length > 0 && (
              <div className="search-dropdown">
                {filteredMeds.map(m => (
                  <div key={m.id} className="search-result" onClick={() => addMedicine(m)}>
                    <div className="sr-name">{m.name}</div>
                    <div className="sr-meta">{m.category} · {m.defaultDose} · {m.defaultDuration}</div>
                  </div>
                ))}
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
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr auto', gap: 6, padding: '4px 6px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                  <input className="form-input" value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                  <DoseSelector value={m.dose} onChange={v => updateMed(i, 'dose', v)} />
                  <input className="form-input" list="duration-options" placeholder="Duration" value={m.duration} onChange={e => updateMed(i, 'duration', e.target.value)} />
                  <input className="form-input" placeholder="e.g. After food" value={m.instructions || ''} onChange={e => updateMed(i, 'instructions', e.target.value)} />
                  <button type="button" className="btn-icon" onClick={() => removeMed(i)}><Trash2 size={14} /></button>
                </div>
              ))}
            </>
          )}

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Prescription Notes</label>
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
    </PageTransition>
  );
}
