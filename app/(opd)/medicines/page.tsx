'use client';

import { useState, useMemo } from 'react';
import { Pill, Plus, Search, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { useMedicines, useMedicineMutations } from '@/lib/hooks/useQueries';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import type { Medicine } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';

const MEDICINE_CATEGORIES = [
  'Antibiotic', 'Antipyretic', 'NSAID', 'Antacid', 'Antiemetic', 
  'Antidiabetic', 'Antihypertensive', 'Antihistamine', 'Expectorant', 
  'Bronchodilator', 'Antileukotriene', 'Vitamin', 'Supplement', 
  'Antiparasitic', 'Antifungal', 'Thyroid', 'Antimalarial', 'Other'
];

const UNIT_TYPES = [
  'mg', 'mcg', 'g', 'ml', 'IU', 'tablets', 'capsules', 'drops', 'sachet', 'pieces'
];

export default function MedicinesPage() {
  const [query, setQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  
  const { data: medicines = [], isLoading, error } = useMedicines();
  const { create, update, remove } = useMedicineMutations();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', category: 'Antibiotic', defaultDose: '', defaultDuration: '',
    strength: '', unit: 'mg'
  });

  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      if (filterCategory !== 'All' && m.category !== filterCategory) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.category.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [medicines, query, filterCategory]);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditingId(null);
    setForm({ name: '', category: 'Antibiotic', defaultDose: '', defaultDuration: '', strength: '', unit: 'mg' });
    setModalOpen(true);
  };

  const openEdit = (m: Medicine) => {
    setEditingId(m.id!);
    setForm({
      name: m.name,
      category: m.category || 'Antibiotic',
      defaultDose: m.defaultDose || '',
      defaultDuration: m.defaultDuration || '',
      strength: m.strength || '',
      unit: m.unit || 'mg'
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast('Name is required', 'error');

    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, input: form });
        toast('Medicine updated.', 'success');
      } else {
        await create.mutateAsync(form);
        toast('Medicine added.', 'success');
      }
      closeModal();
    } catch (err) {
      toast('Failed to save medicine.', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await remove.mutateAsync(id);
      toast('Medicine removed.', 'success');
      setDeleteConfirmId(null);
    } catch (err) {
      toast('Failed to remove medicine.', 'error');
    }
  };

  if (error) return <PageTransition><ErrorState message="Could not fetch medicines." /></PageTransition>;
  if (isLoading) return <PageTransition><LoadingScreen message="Loading inventory..." /></PageTransition>;

  return (
    <PageTransition>
      {/* ── Medicine Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay">
            <div className="modal modal-md">
              <div className="modal-header">
                <h3>{editingId ? 'Edit Medicine' : 'Add New Medicine'}</h3>
                <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body form-grid form-grid-2">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Medicine Name <span className="required">*</span></label>
                    <input className="form-input" placeholder="e.g. Paracetamol" value={form.name} onChange={e => setF('name', e.target.value)} required />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={form.category} onChange={e => setF('category', e.target.value)}>
                      {MEDICINE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="form-label">Strength <span style={{ color: 'var(--text-muted)' }}>(opt)</span></label>
                      <input className="form-input" placeholder="e.g. 500" value={form.strength} onChange={e => setF('strength', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Unit</label>
                      <select className="form-select" value={form.unit} onChange={e => setF('unit', e.target.value)}>
                        {UNIT_TYPES.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Default Dosage <span style={{ color: 'var(--text-muted)' }}>(opt)</span></label>
                    <input className="form-input" placeholder="e.g. 1-0-1" value={form.defaultDose} onChange={e => setF('defaultDose', e.target.value)} />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Default Duration <span style={{ color: 'var(--text-muted)' }}>(opt)</span></label>
                    <input className="form-input" placeholder="e.g. 5 days" value={form.defaultDuration} onChange={e => setF('defaultDuration', e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={create.isPending || update.isPending}>
                    {editingId ? 'Save Changes' : 'Add Medicine'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
        
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal modal-sm" style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ width: 50, height: 50, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Delete Medicine?</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                This action cannot be undone. Are you sure you want to completely remove this medicine from your catalog?
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirmId)} disabled={remove.isPending}>Yes, Delete</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-header">
        <div>
          <div className="page-title">Medicine Inventory</div>
          <div className="page-subtitle">Manage your catalog, dosages, and units. Total: {medicines.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Add Medicine</button>
        </div>
      </div>

      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) auto', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search by name or category…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <select 
            className="form-select" 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="All">All Categories</option>
            {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {filteredMedicines.length === 0 ? (
        <div className="empty-state">
          <Pill size={48} style={{ opacity: 0.3, marginBottom: 14 }} />
          <h4>No Medicines Found</h4>
          <p>We couldn't find any medicines matching your filters.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openNew}>
            <Plus size={16} /> Add Medicine
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Strength & Unit</th>
                <th>Category</th>
                <th>Default Dosage</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedicines.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td>
                    {m.strength ? (
                      <span className="badge badge-teal">{m.strength} {m.unit}</span>
                    ) : '—'}
                  </td>
                  <td><span className="badge badge-purple">{m.category}</span></td>
                  <td>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {m.defaultDose ? <strong>{m.defaultDose}</strong> : '—'} · {m.defaultDuration || '—'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}><Edit2 size={14} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setDeleteConfirmId(m.id!)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
