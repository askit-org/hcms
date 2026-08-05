'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Search, Eye, Stethoscope, Phone,
  Calendar, X, ChevronRight, Edit2, Save
} from 'lucide-react';
import { usePatients, useAppOptions, usePatientMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import type { Patient } from '@/lib/providers/types';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';

export default function PatientsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const router = useRouter();

  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', age: '', dob: '', gender: 'Male', mobile: '', address: '', occupation: '', abhaNumber: ''
  });

  const { update: updatePatientMut } = usePatientMutations();
  const { data: categoryOptions = [] } = useAppOptions('CATEGORY');
  const { data: allPatients = [], isLoading: loading, error } = usePatients({
    category: category !== 'All' ? category : undefined
  });

  const openEditModal = (p: Patient) => {
    setEditingPatient(p);
    setEditForm({
      name: p.name || '',
      age: p.age ? String(p.age) : '',
      dob: p.dob || '',
      gender: p.gender || 'Male',
      mobile: p.mobile || '',
      address: p.address || '',
      occupation: p.occupation || '',
      abhaNumber: p.abhaNumber || ''
    });
  };

  const handleSavePatient = async () => {
    if (!editingPatient) return;
    if (!editForm.name.trim()) {
      toast('Patient name is required.', 'error');
      return;
    }
    const mobileDigits = editForm.mobile.replace(/\D/g, '');
    if (mobileDigits.length < 10) {
      toast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }
    if (editForm.abhaNumber.trim() && !/^\d{14}$/.test(editForm.abhaNumber.trim())) {
      toast('ABHA number must be exactly 14 numeric digits.', 'error');
      return;
    }

    try {
      await updatePatientMut.mutateAsync({
        id: editingPatient.patientId,
        input: {
          name: editForm.name.trim(),
          age: editForm.age ? parseInt(editForm.age) : undefined,
          dob: editForm.dob || undefined,
          gender: editForm.gender,
          mobile: editForm.mobile.trim(),
          address: editForm.address.trim() || undefined,
          occupation: editForm.occupation.trim() || undefined,
          abhaNumber: editForm.abhaNumber.trim() || undefined,
        }
      });
      toast('Patient details updated successfully!', 'success');
      setEditingPatient(null);
    } catch (err: any) {
      toast(err.message || 'Failed to update patient.', 'error');
    }
  };

  const filteredPatients = useMemo(() => {
    return allPatients.filter(p => {
      // Date filter
      const d = p.createdAt.split('T')[0];
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;

      // Text Search
      if (query) {
        const q = query.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && 
            !p.mobile.includes(q) && 
            !p.patientId.toLowerCase().includes(q) &&
            !(p.abhaNumber && p.abhaNumber.toLowerCase().includes(q))) {
          return false;
        }
      }
      return true;
    });
  }, [allPatients, fromDate, toDate, query]);

  const hasDateFilter = !!(fromDate || toDate);
  const clearDateFilter = () => { setFromDate(''); setToDate(''); };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } }
  };
  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 }
  };

  const genderColor = (gender: string) => {
    switch (gender?.toLowerCase()) {
      case 'male': return 'badge-blue';
      case 'female': return 'badge-purple';
      default: return 'badge-teal';
    }
  };

  if (loading) return <LoadingScreen message="Loading patient records..." />;
  if (error) return <ErrorState title="Error Loading Patients" message="Failed to connect to local database." />;

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Patient Directory</div>
          <div className="page-subtitle">{allPatients.length} registered patients</div>
        </div>
        <div className="flex-wrap-header-actions">
          <Link href="/patients/new" className="btn btn-primary">
            <UserPlus size={16} /> Register Patient
          </Link>
        </div>
      </div>

      {/* ── Filters Bar ────────────────────────────────────────────── */}
      <div className="filter-bar">
        {/* Category Tabs */}
        <div className="cat-pills">
          {['All', ...categoryOptions.map(o => o.value)].map(cat => (
            <button
              key={cat}
              className={`cat-pill ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Date Filter Toggle Button */}
        <button
          className={`btn btn-secondary btn-sm ${hasDateFilter ? 'active' : ''}`}
          onClick={() => setShowDateFilter(!showDateFilter)}
          style={{ position: 'relative' }}
        >
          <Calendar size={14} />
          {hasDateFilter ? 'Filtered' : 'Filter Date'}
          {hasDateFilter && <span className="filter-dot" />}
        </button>

        {/* Date Pickers Row */}
        {showDateFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <input
              type="date"
              className="form-input"
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              title="From Registration Date"
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              title="To Registration Date"
            />
            {hasDateFilter && (
              <button className="btn-icon" onClick={clearDateFilter} title="Clear Date Filter">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Text Search */}
        <div className="search-input-wrap" style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <span className="s-icon"><Search size={15} /></span>
          <input
            className="search-input"
            placeholder="Search name, mobile, ABHA, or ID…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              onClick={() => setQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      {filteredPatients.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ opacity: 0.3, marginBottom: 14 }} />
          <h4>No Patients Found</h4>
          <p>
            {query
              ? 'No patients match your search.'
              : hasDateFilter
              ? 'No patients registered in the selected date range.'
              : 'Register your first patient to get started.'}
          </p>
          <Link href="/patients/new" className="btn btn-primary" style={{ marginTop: 16 }}>
            <UserPlus size={16} /> Register Patient
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Name</th>
                <th>Age / Gender</th>
                <th>Mobile</th>
                <th>ABHA Number</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <motion.tbody variants={container} initial="hidden" animate="show">
              {filteredPatients.map(p => (
                <motion.tr variants={item} key={p.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/patients/${p.patientId}`)}>
                  <td><span className="badge badge-teal">{p.patientId}</span></td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>
                    <span className={`badge ${genderColor(p.gender)}`} style={{ marginRight: 6 }}>{p.gender}</span>
                    {p.age ? `${p.age}y` : p.dob ? `${new Date().getFullYear() - new Date(p.dob).getFullYear()}y` : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                      {p.mobile}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.abhaNumber || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" title="Edit Patient" onClick={() => openEditModal(p)}>
                        <Edit2 size={14} />
                      </button>
                      <Link href={`/patients/${p.patientId}`} className="btn btn-ghost btn-sm" title="View Patient Details">
                        <Eye size={14} />
                      </Link>
                      <Link href={`/visits/new?patientId=${p.patientId}`} className="btn btn-primary btn-sm" title="New OPD Visit">
                        <Stethoscope size={14} />
                      </Link>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}

      {/* ── Edit Patient Modal ────────────────────────────────────────── */}
      {editingPatient && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, zIndex: 1001, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                Edit Patient ({editingPatient.patientId})
              </div>
              <button className="btn-icon" onClick={() => setEditingPatient(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Age (years)</label>
                  <input className="form-input" type="number" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Mobile Number <span className="required">*</span></label>
                <input className="form-input" type="tel" maxLength={10} placeholder="10-digit mobile number" value={editForm.mobile} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">ABHA Number</label>
                <input className="form-input" placeholder="14-digit ABHA number" maxLength={14} value={editForm.abhaNumber} onChange={e => setEditForm(f => ({ ...f, abhaNumber: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div>
                <label className="form-label">Address</label>
                <input className="form-input" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Occupation</label>
                <input className="form-input" value={editForm.occupation} onChange={e => setEditForm(f => ({ ...f, occupation: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setEditingPatient(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePatient} disabled={updatePatientMut.isPending}>
                <Save size={14} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
