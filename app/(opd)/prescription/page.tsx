'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Pill, Save, X, Search } from 'lucide-react';
import { useMedicines, useTemplates, useMedicineMutations, useTemplateMutations } from '@/lib/hooks/useQueries';
import type { Medicine, Template, PrescribedMedicine } from '@/lib/providers/types';
import { toast } from '@/components/Toast';

const CATEGORIES = ['All', 'Antipyretic', 'NSAID', 'Antibiotic', 'Antacid', 'Antiemetic', 'Antidiabetic',
  'Antihypertensive', 'Antihistamine', 'Expectorant', 'Bronchodilator', 'Vitamin', 'Supplement',
  'Antifungal', 'Antiparasitic', 'Antimalarial', 'Thyroid', 'Rehydration', 'Antileukotriene', 'Other'];

export default function PrescriptionPage() {
  const [tab, setTab] = useState<'medicines' | 'templates'>('medicines');
  
  const { data: medicines = [] } = useMedicines();
  const { data: templates = [] } = useTemplates();
  const { create: createMed, update: updateMed, remove: deleteMed } = useMedicineMutations();
  const { create: createTpl, remove: deleteTpl } = useTemplateMutations();

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showMedForm, setShowMedForm] = useState(false);
  const [editMed, setEditMed] = useState<Medicine | null>(null);
  const [showTplForm, setShowTplForm] = useState(false);

  const [medForm, setMedForm] = useState({ name: '', category: 'Other', defaultDose: '1-0-1', defaultDuration: '5 days' });
  const [tplForm, setTplForm] = useState({ name: '', diagnosis: '', notes: '', medicines: [] as PrescribedMedicine[] });

  const saveMed = async () => {
    if (!medForm.name.trim()) { toast('Medicine name required.', 'error'); return; }
    if (editMed?.id) {
      await updateMed.mutateAsync({ id: editMed.id, input: medForm });
      toast('Medicine updated.', 'success');
    } else {
      await createMed.mutateAsync(medForm);
      toast('Medicine added.', 'success');
    }
    setShowMedForm(false); setEditMed(null);
    setMedForm({ name: '', category: 'Other', defaultDose: '1-0-1', defaultDuration: '5 days' });
  };

  const attemptDeleteMed = async (m: Medicine) => {
    if (!confirm(`Delete "${m.name}"?`)) return;
    if (m.id) await deleteMed.mutateAsync(m.id);
    toast('Medicine deleted.', 'info');
  };

  const saveTpl = async () => {
    if (!tplForm.name.trim()) { toast('Template name required.', 'error'); return; }
    await createTpl.mutateAsync(tplForm);
    toast('Template saved.', 'success');
    setShowTplForm(false);
    setTplForm({ name: '', diagnosis: '', notes: '', medicines: [] });
  };

  const filtered = medicines.filter(m => {
    const matchQ = !query || m.name.toLowerCase().includes(query.toLowerCase());
    const matchC = catFilter === 'All' || m.category === catFilter;
    return matchQ && matchC;
  });

  const grouped = filtered.reduce((acc, m) => {
    const k = m.category || 'Other';
    if (!acc[k]) acc[k] = [];
    acc[k].push(m);
    return acc;
  }, {} as Record<string, Medicine[]>);

  return (
    <div className="fade-up">
      <div className="page-header">
        <div>
          <div className="page-title">Prescription</div>
          <div className="page-subtitle">{medicines.length} medicines · {templates.length} templates</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {tab === 'medicines' && (
            <button className="btn btn-primary" onClick={() => { setEditMed(null); setMedForm({ name: '', category: 'Other', defaultDose: '1-0-1', defaultDuration: '5 days' }); setShowMedForm(true); }}>
              <Plus size={16} /> Add Medicine
            </button>
          )}
          {tab === 'templates' && (
            <button className="btn btn-primary" onClick={() => setShowTplForm(true)}>
              <Plus size={16} /> New Template
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'medicines' ? 'active' : ''}`} onClick={() => setTab('medicines')}>
          <Pill size={14} style={{ display: 'inline', marginRight: 4 }} /> Medicine List
        </button>
        <button className={`tab-btn ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
          Prescription Templates
        </button>
      </div>

      {tab === 'medicines' && (
        <>
          {/* Search & Filter */}
          <div className="card card-sm" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search medicines…" value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <select className="form-select" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state"><Pill /><h4>No Medicines Found</h4><p>Add your first medicine to the list.</p></div>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, meds]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-teal">{cat}</span>
                  <span className="text-muted text-xs">{meds.length} medicines</span>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Medicine Name</th><th>Default Dose</th><th>Default Duration</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {meds.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td><span className="badge badge-blue">{m.defaultDose}</span></td>
                          <td style={{ color: 'var(--text-secondary)' }}>{m.defaultDuration}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => {
                                setEditMed(m);
                                setMedForm({ name: m.name, category: m.category, defaultDose: m.defaultDose, defaultDuration: m.defaultDuration });
                                setShowMedForm(true);
                              }}><Edit2 size={14} /></button>
                              <button className="btn btn-danger btn-sm" onClick={() => attemptDeleteMed(m)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'templates' && (
        <div>
          {templates.length === 0 ? (
            <div className="empty-state">
              <Pill /><h4>No Templates Yet</h4>
              <p>Save common prescription sets as templates to reuse during visits.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowTplForm(true)}><Plus size={16} /> Create First Template</button>
            </div>
          ) : templates.map(t => (
            <div key={t.id} className="card card-sm" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  {t.diagnosis && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>Dx: {t.diagnosis}</div>}
                  {t.medicines.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {t.medicines.map((m, i) => <span key={i} className="badge badge-teal">{m.name}</span>)}
                    </div>
                  )}
                </div>
                <button className="btn btn-danger btn-sm" onClick={async () => {
                  if (!confirm(`Delete template "${t.name}"?`)) return;
                  if (t.id) await deleteTpl.mutateAsync(t.id);
                }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Medicine Form Modal */}
      {showMedForm && (
        <div className="modal-overlay" onClick={() => setShowMedForm(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editMed ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button className="btn-icon" onClick={() => setShowMedForm(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Medicine Name <span className="required">*</span></label>
                  <input className="form-input" placeholder="e.g. Paracetamol 500mg" value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={medForm.category} onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Dose</label>
                  <input className="form-input" placeholder="e.g. 1-0-1" value={medForm.defaultDose} onChange={e => setMedForm(f => ({ ...f, defaultDose: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Duration</label>
                  <input className="form-input" placeholder="e.g. 5 days" value={medForm.defaultDuration} onChange={e => setMedForm(f => ({ ...f, defaultDuration: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowMedForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMed}><Save size={15} /> {editMed ? 'Update' : 'Add'} Medicine</button>
            </div>
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      {showTplForm && (
        <div className="modal-overlay" onClick={() => setShowTplForm(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Prescription Template</h3>
              <button className="btn-icon" onClick={() => setShowTplForm(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Template Name <span className="required">*</span></label>
                  <input className="form-input" placeholder="e.g. Fever Protocol, Diabetic Follow-up" value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Diagnosis</label>
                  <input className="form-input" placeholder="e.g. Viral Fever" value={tplForm.diagnosis} onChange={e => setTplForm(f => ({ ...f, diagnosis: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Add Medicines</label>
                  {medicines.slice(0, 20).map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.84rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={tplForm.medicines.some(x => x.name === m.name)}
                        onChange={e => {
                          if (e.target.checked) {
                            setTplForm(f => ({ ...f, medicines: [...f.medicines, { name: m.name, dose: m.defaultDose, duration: m.defaultDuration }] }));
                          } else {
                            setTplForm(f => ({ ...f, medicines: f.medicines.filter(x => x.name !== m.name) }));
                          }
                        }} />
                      {m.name} — {m.defaultDose} × {m.defaultDuration}
                    </label>
                  ))}
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" placeholder="Instructions, advice…" value={tplForm.notes} onChange={e => setTplForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowTplForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTpl}><Save size={15} /> Save Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
