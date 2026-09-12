'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, Pill, Save, X, Search, FileText } from 'lucide-react';
import { useMedicines, useTemplates, useMedicineMutations, useTemplateMutations } from '@/lib/hooks/useQueries';
import type { Medicine, PrescribedMedicine, Template } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import PageTransition from '@/components/PageTransition';
import DoseSelector, { DoseDisplay, DurationSelect } from '@/components/DoseSelector';

const CATEGORIES = [
  'All', 'Antipyretic', 'NSAID', 'Antibiotic', 'Antacid', 'Antiemetic', 'Antidiabetic',
  'Antihypertensive', 'Antihistamine', 'Expectorant', 'Bronchodilator', 'Vitamin', 'Supplement',
  'Antifungal', 'Antiparasitic', 'Antimalarial', 'Thyroid', 'Rehydration', 'Antileukotriene', 'Other'
];

const UNITS = [
  'Tablet', 'Capsule', 'Syrup', 'Drop', 'Ointment', 'Injection', 'Gel', 'Cream', 'Lotion', 'Inhaler', 'Sachet', 'Patch'
];

export default function PrescriptionPage() {
  const [tab, setTab] = useState<'medicines' | 'templates'>('medicines');

  const { data: medicines = [] } = useMedicines();
  const { data: templates = [] } = useTemplates();
  const { create: createMed, update: updateMed, remove: deleteMed } = useMedicineMutations();
  const { create: createTpl, update: updateTpl, remove: deleteTpl } = useTemplateMutations();

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showMedForm, setShowMedForm] = useState(false);
  const [editMed, setEditMed] = useState<Medicine | null>(null);

  const [showTplForm, setShowTplForm] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | null>(null);
  const [savingMed, setSavingMed] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);

  const [medForm, setMedForm] = useState({
    name: '',
    category: 'Other',
    strength: '',
    unit: 'Tablet',
    defaultDose: '1-0-1',
    defaultDuration: '5 days',
    instructions: 'After food',
  });

  const [tplForm, setTplForm] = useState({
    name: '',
    diagnosis: '',
    notes: '',
    medicines: [] as PrescribedMedicine[],
  });
  const [tplMedQuery, setTplMedQuery] = useState('');

  const handleOpenAddMed = () => {
    setEditMed(null);
    setMedForm({
      name: '',
      category: 'Other',
      strength: '',
      unit: 'Tablet',
      defaultDose: '1-0-1',
      defaultDuration: '5 days',
      instructions: 'After food',
    });
    setShowMedForm(true);
  };

  const handleOpenEditMed = (m: Medicine) => {
    setEditMed(m);
    setMedForm({
      name: m.name || '',
      category: m.category || 'Other',
      strength: m.strength || '',
      unit: m.unit || 'Tablet',
      defaultDose: m.defaultDose || '1-0-1',
      defaultDuration: m.defaultDuration || '5 days',
      instructions: m.instructions || 'After food',
    });
    setShowMedForm(true);
  };

  const handleOpenAddTpl = () => {
    setEditTpl(null);
    setTplForm({
      name: '',
      diagnosis: '',
      notes: '',
      medicines: [],
    });
    setTplMedQuery('');
    setShowTplForm(true);
  };

  const handleOpenEditTpl = (t: Template) => {
    setEditTpl(t);
    setTplForm({
      name: t.name || '',
      diagnosis: t.diagnosis || '',
      notes: t.notes || '',
      medicines: (t.medicines || []).map((m: PrescribedMedicine) => ({ ...m })),
    });
    setTplMedQuery('');
    setShowTplForm(true);
  };

  const addMedToTemplate = (m: Medicine) => {
    setTplForm(f => ({
      ...f,
      medicines: [
        ...f.medicines,
        {
          medicineId: m.id,
          name: m.name,
          category: m.category || 'Other',
          strength: m.strength || '',
          unit: m.unit || 'Tablet',
          dose: m.defaultDose || '1-0-1',
          duration: m.defaultDuration || '5 days',
          instructions: m.instructions || 'After food',
        }
      ]
    }));
    setTplMedQuery('');
  };

  const addCustomMedToTemplate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setTplForm(f => ({
      ...f,
      medicines: [
        ...f.medicines,
        {
          name: trimmed,
          category: 'Other',
          strength: '',
          unit: 'Tablet',
          dose: '1-0-1',
          duration: '5 days',
          instructions: 'After food',
        }
      ]
    }));
    setTplMedQuery('');
  };

  const updateTplMedField = (index: number, field: keyof PrescribedMedicine, value: string) => {
    setTplForm(f => ({
      ...f,
      medicines: f.medicines.map((m, i) => i === index ? { ...m, [field]: value } : m)
    }));
  };

  const removeTplMed = (index: number) => {
    setTplForm(f => ({
      ...f,
      medicines: f.medicines.filter((_, i) => i !== index)
    }));
  };

  const saveMed = async () => {
    if (savingMed) return;
    if (!medForm.name.trim()) { toast('Medicine name required.', 'error'); return; }

    setSavingMed(true);
    try {
      if (editMed?.id) {
        await updateMed.mutateAsync({ id: editMed.id, input: medForm });
        toast('Medicine updated.', 'success');
      } else {
        await createMed.mutateAsync(medForm);
        toast('Medicine added.', 'success');
      }
      setShowMedForm(false);
      setEditMed(null);
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to save medicine'), 'error');
    } finally {
      setSavingMed(false);
    }
  };

  const attemptDeleteMed = async (m: Medicine) => {
    if (!confirm(`Delete "${m.name}"?`)) return;
    if (m.id) await deleteMed.mutateAsync(m.id);
    toast('Medicine deleted.', 'info');
  };

  const saveTpl = async () => {
    if (savingTpl) return;
    if (!tplForm.name.trim()) { toast('Template name required.', 'error'); return; }

    setSavingTpl(true);
    try {
      if (editTpl?.id) {
        await updateTpl.mutateAsync({ id: editTpl.id, input: tplForm });
        toast('Template updated.', 'success');
      } else {
        await createTpl.mutateAsync(tplForm);
        toast('Template saved.', 'success');
      }
      setShowTplForm(false);
      setEditTpl(null);
      setTplForm({ name: '', diagnosis: '', notes: '', medicines: [] });
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to save template'), 'error');
    } finally {
      setSavingTpl(false);
    }
  };

  const filtered = medicines.filter(m => {
    const matchQ = !query || m.name.toLowerCase().includes(query.toLowerCase()) || (m.strength && m.strength.toLowerCase().includes(query.toLowerCase()));
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
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Prescription & Medicines Directory</div>
          <div className="page-subtitle">{medicines.length} medicines · {templates.length} prescription templates</div>
        </div>
        <div className="flex-wrap-header-actions">
          {tab === 'medicines' && (
            <button className="btn btn-primary" onClick={handleOpenAddMed}>
              <Plus size={16} /> Add Medicine
            </button>
          )}
          {tab === 'templates' && (
            <button className="btn btn-primary" onClick={handleOpenAddTpl}>
              <Plus size={16} /> New Template
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab-btn ${tab === 'medicines' ? 'active' : ''}`} onClick={() => setTab('medicines')}>
          <Pill size={14} style={{ display: 'inline', marginRight: 6 }} /> Medicine List
        </button>
        <button className={`tab-btn ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
          <FileText size={14} style={{ display: 'inline', marginRight: 6 }} /> Prescription Templates
        </button>
      </div>

      {tab === 'medicines' && (
        <>
          {/* Search & Filter */}
          <div className="card card-sm" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Search medicines by name or strength..." value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <select
                className="form-select"
                style={{ width: '100%', maxWidth: 200, zIndex: 10 }}
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Pill />
              <h4>No Medicines Found</h4>
              <p>Add your first medicine with strength, dose, unit, and instructions.</p>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleOpenAddMed}>
                <Plus size={16} /> Add First Medicine
              </button>
            </div>
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
                      <tr>
                        <th>Medicine Name</th>
                        <th>Category</th>
                        <th>Strength & Form</th>
                        <th>Default Dose</th>
                        <th>Default Duration</th>
                        <th>Default Instruction</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meds.map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</td>
                          <td><span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>{m.category || 'Other'}</span></td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {m.strength ? m.strength : ''} {m.unit ? `(${m.unit})` : ''}
                          </td>
                          <td><DoseDisplay dose={m.defaultDose} /></td>
                          <td style={{ color: 'var(--text-secondary)' }}>{m.defaultDuration}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{m.instructions || 'After food'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditMed(m)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => attemptDeleteMed(m)}>
                                <Trash2 size={14} />
                              </button>
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
              <Pill />
              <h4>No Templates Yet</h4>
              <p>Save common prescription sets as templates to reuse during visits.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleOpenAddTpl}>
                <Plus size={16} /> Create First Template
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {templates.map(t => (
                <div key={t.id} className="card card-sm">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{t.name}</div>
                      {t.diagnosis && <div style={{ fontSize: '0.82rem', color: 'var(--accent-light)', marginTop: 2, fontWeight: 600 }}>Diagnosis: {t.diagnosis}</div>}
                      {t.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>Note: {t.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEditTpl(t)}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        if (!confirm(`Delete template "${t.name}"?`)) return;
                        if (t.id) await deleteTpl.mutateAsync(t.id);
                        toast('Template deleted.', 'info');
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {t.medicines && t.medicines.length > 0 ? (
                    <div className="table-wrap" style={{ marginTop: 8 }}>
                      <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Medicine Name</th>
                            <th>Category</th>
                            <th>Strength & Unit</th>
                            <th>Dose</th>
                            <th>Duration</th>
                            <th>Instruction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.medicines.map((m, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                              <td><span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>{m.category || 'Other'}</span></td>
                              <td style={{ color: 'var(--text-secondary)' }}>
                                {m.strength || '—'} {m.unit ? `(${m.unit})` : ''}
                              </td>
                              <td><DoseDisplay dose={m.dose} /></td>
                              <td style={{ color: 'var(--text-secondary)' }}>{m.duration}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{m.customInstruction || m.instructions || 'After food'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No medicines added to this template.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Medicine Form Modal */}
      {showMedForm && (
        <div className="modal-overlay" onClick={() => setShowMedForm(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editMed ? 'Edit Medicine' : 'Add New Medicine'}</h3>
              <button className="btn-icon" onClick={() => setShowMedForm(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Medicine Name <span className="required">*</span></label>
                  <input className="form-input" placeholder="e.g. Paracetamol, Amoxicillin, Pantoprazole" value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={medForm.category} onChange={e => setMedForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Form / Unit</label>
                  <select className="form-select" value={medForm.unit} onChange={e => setMedForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Strength</label>
                  <input className="form-input" placeholder="e.g. 500mg, 650mg, 10mg" value={medForm.strength} onChange={e => setMedForm(f => ({ ...f, strength: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Instruction</label>
                  <input className="form-input" placeholder="e.g. After food, Before food, At bedtime" value={medForm.instructions} onChange={e => setMedForm(f => ({ ...f, instructions: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Default Dose</label>
                  <DoseSelector
                    value={medForm.defaultDose}
                    onChange={val => setMedForm(f => ({ ...f, defaultDose: val }))}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Default Duration</label>
                  <DurationSelect value={medForm.defaultDuration} onChange={val => setMedForm(f => ({ ...f, defaultDuration: val }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowMedForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMed} disabled={savingMed}>
                <Save size={15} /> {savingMed ? 'Saving…' : editMed ? 'Update Medicine' : 'Add Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      {showTplForm && (
        <div className="modal-overlay" onClick={() => setShowTplForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <h3>{editTpl ? 'Edit Prescription Template' : 'New Prescription Template'}</h3>
              <button className="btn-icon" onClick={() => setShowTplForm(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              <div className="form-grid form-grid-2" style={{ gap: 14, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Template Name <span className="required">*</span></label>
                  <input className="form-input" placeholder="e.g. Fever Protocol, Diabetic Follow-up" value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Diagnosis</label>
                  <input className="form-input" placeholder="e.g. Viral Fever" value={tplForm.diagnosis} onChange={e => setTplForm(f => ({ ...f, diagnosis: e.target.value }))} />
                </div>
              </div>

              {/* Medicine Selection & Search */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Add Medicines to Template ({tplForm.medicines.length} added)</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Master Catalog: {medicines.length} medicines</span>
                </div>
                
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    className="form-input" 
                    style={{ paddingLeft: 32 }} 
                    placeholder="Search medicine catalog by name, category, or strength..." 
                    value={tplMedQuery}
                    onChange={e => setTplMedQuery(e.target.value)}
                  />
                  {tplMedQuery.trim() !== '' && (
                    <div className="search-dropdown" style={{ maxHeight: 220, overflowY: 'auto', zIndex: 100 }}>
                      {medicines
                        .filter(m => m.name.toLowerCase().includes(tplMedQuery.toLowerCase()) || (m.category && m.category.toLowerCase().includes(tplMedQuery.toLowerCase())))
                        .slice(0, 30)
                        .map(m => (
                          <div 
                            key={m.id} 
                            className="search-result" 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onClick={() => addMedToTemplate(m)}
                          >
                            <div>
                              <span style={{ fontWeight: 600 }}>{m.name}</span>
                              {m.strength && <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: 6 }}>({m.strength} · {m.unit || 'Tablet'})</span>}
                              <span className="badge badge-teal" style={{ marginLeft: 8, fontSize: '0.7rem' }}>{m.category || 'Other'}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                              + Add to Template
                            </span>
                          </div>
                        ))}
                      <div 
                        className="search-result" 
                        style={{ color: 'var(--primary)', fontWeight: 600, background: 'rgba(13, 148, 136, 0.05)', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => addCustomMedToTemplate(tplMedQuery)}
                      >
                        <Plus size={14} /> Add custom medicine &quot;{tplMedQuery.trim()}&quot; to template
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Template Medicines Table with ALL Columns */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Configured Medicines in Template ({tplForm.medicines.length})
                </div>

                {tplForm.medicines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    No medicines added yet. Use the search bar above to search and add medicines with dose, duration, and instructions.
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '22%' }}>Medicine Name</th>
                          <th style={{ width: '13%' }}>Category</th>
                          <th style={{ width: '15%' }}>Form / Unit</th>
                          <th style={{ width: '12%' }}>Strength</th>
                          <th style={{ width: '15%' }}>Dose</th>
                          <th style={{ width: '12%' }}>Duration</th>
                          <th style={{ width: '18%' }}>Instructions</th>
                          <th style={{ width: '5%', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {tplForm.medicines.map((m, i) => (
                          <tr key={i}>
                            <td>
                              <input 
                                className="form-input form-input-sm" 
                                value={m.name} 
                                onChange={e => updateTplMedField(i, 'name', e.target.value)} 
                                placeholder="Medicine Name"
                              />
                            </td>
                            <td>
                              <select 
                                className="form-select form-select-sm" 
                                value={m.category || 'Other'} 
                                onChange={e => updateTplMedField(i, 'category', e.target.value)}
                              >
                                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                              </select>
                            </td>
                            <td>
                              <select 
                                className="form-select form-select-sm" 
                                value={m.unit || 'Tablet'} 
                                onChange={e => updateTplMedField(i, 'unit', e.target.value)}
                              >
                                {UNITS.map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td>
                              <input 
                                className="form-input form-input-sm" 
                                value={m.strength || ''} 
                                onChange={e => updateTplMedField(i, 'strength', e.target.value)} 
                                placeholder="e.g. 500mg"
                              />
                            </td>
                            <td>
                              <DoseSelector 
                                value={m.dose || '1-0-1'} 
                                onChange={v => updateTplMedField(i, 'dose', v)} 
                              />
                            </td>
                            <td>
                              <DurationSelect 
                                value={m.duration || '5 days'} 
                                onChange={v => updateTplMedField(i, 'duration', v)} 
                              />
                            </td>
                            <td>
                              <input 
                                className="form-input form-input-sm" 
                                value={m.instructions || m.customInstruction || ''} 
                                onChange={e => {
                                  updateTplMedField(i, 'instructions', e.target.value);
                                  updateTplMedField(i, 'customInstruction', e.target.value);
                                }} 
                                placeholder="After food"
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                type="button" 
                                className="btn btn-ghost btn-sm" 
                                style={{ color: 'var(--red)', padding: '4px' }} 
                                onClick={() => removeTplMed(i)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes & Advice</label>
                <textarea className="form-textarea" placeholder="Diet advice, precautions, instructions..." value={tplForm.notes} onChange={e => setTplForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 60 }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowTplForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTpl} disabled={savingTpl}>
                <Save size={15} /> {savingTpl ? 'Saving…' : editTpl ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
