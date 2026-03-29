'use client';

'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Search, Stethoscope, Pill } from 'lucide-react';
import { useProviderStore } from '@/lib/providers';
import { useMedicines, useVisitMutations, usePatient } from '@/lib/hooks/useQueries';
import type { Patient, Medicine, PrescribedMedicine } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';

const QUICK_COMPLAINTS = [
  'Fever', 'Cough', 'Cold', 'Body Ache', 'Headache',
  'Vomiting', 'Diarrhoea', 'Chest Pain', 'Breathlessness',
  'Sore Throat', 'Fatigue', 'Dizziness', 'Abdominal Pain', 'Joint Pain',
];

const DOSE_OPTIONS = ['1-0-1', '1-1-1', '0-0-1', '1-0-0', '0-1-0', '1/2-0-1/2', 'SOS', 'As needed', 'Stat'];
const DURATION_OPTIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '30 days', '90 days'];

function NewVisitForm() {
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

  const [form, setForm] = useState({
    chiefComplaints: '', diagnosis: '', bp: '', pulse: '', temp: '', spo2: '',
    weight: '', treatment: '', prescriptionNotes: '', followUpDate: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const provider = useProviderStore((s) => s.provider);
  const { create: createVisit } = useVisitMutations();
  const { data: medicinesData = [] } = useMedicines();

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
      const nw = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c];
      setForm(f => ({ ...f, chiefComplaints: nw.join(', ') + (f.chiefComplaints.replace(new RegExp(prev.join('|') + ', ?', 'g'), '').trim() ? ', ' + f.chiefComplaints : '') }));
      return nw;
    });
  };

  const syncComplaints = (val: string) => {
    set('chiefComplaints', val);
    // Sync quick buttons
    const active = QUICK_COMPLAINTS.filter(c => val.toLowerCase().includes(c.toLowerCase()));
    setSelectedComplaints(active);
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
    if (!form.chiefComplaints.trim()) { toast('Chief complaints are required.', 'error'); return; }
    setSaving(true);
    try {
      const now = new Date();
      await createVisit.mutateAsync({
        patientId: selectedPatient.patientId,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface-1)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--accent)' }}>
              <div className="followup-avatar">{selectedPatient.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{selectedPatient.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedPatient.patientId} · {selectedPatient.mobile} · {selectedPatient.gender}, {selectedPatient.age}y</div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedPatient(null)}>Change</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input className="form-input" style={{ paddingLeft: 34 }}
                placeholder="Search patient by name, mobile, or ID…"
                value={patientQuery} onChange={e => setPatientQuery(e.target.value)} />
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
            {QUICK_COMPLAINTS.map(c => (
              <button key={c} type="button" className={`quick-btn ${selectedComplaints.includes(c) ? 'selected' : ''}`}
                onClick={() => toggleComplaint(c)}>{c}</button>
            ))}
          </div>
          <textarea className="form-textarea" placeholder="Describe chief complaints in detail…"
            value={form.chiefComplaints} onChange={e => syncComplaints(e.target.value)} style={{ minHeight: 80 }} />
        </div>

        {/* Diagnosis & Treatment */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Diagnosis</label>
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
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 34 }}
              placeholder="Search medicine to add…"
              value={medQuery} onChange={e => setMedQuery(e.target.value)} />
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
              {rxMeds.map((m, i) => (
                <div key={i} className="med-row">
                  <input className="form-input" value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                  <select className="form-select" value={m.dose} onChange={e => updateMed(i, 'dose', e.target.value)}>
                    {DOSE_OPTIONS.map(d => <option key={d}>{d}</option>)}
                    {!DOSE_OPTIONS.includes(m.dose) && <option value={m.dose}>{m.dose}</option>}
                  </select>
                  <select className="form-select" value={m.duration} onChange={e => updateMed(i, 'duration', e.target.value)}>
                    {DURATION_OPTIONS.map(d => <option key={d}>{d}</option>)}
                    {!DURATION_OPTIONS.includes(m.duration) && <option value={m.duration}>{m.duration}</option>}
                  </select>
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

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link href="/patients" className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            <Stethoscope size={18} /> {saving ? 'Saving…' : 'Save OPD Visit'}
          </button>
        </div>
      </form>
    </PageTransition>
  );
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="loading-state">Loading visit form...</div>}>
      <NewVisitForm />
    </Suspense>
  );
}
