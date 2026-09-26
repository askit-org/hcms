'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Search, Eye, Stethoscope, Phone,
  Calendar, X, Edit2, Save, AlertTriangle, ArrowLeftRight, ArchiveRestore, RotateCcw
} from 'lucide-react';
import { usePatients, useAppOptions, usePatientMutations, useDeletedPatients } from '@/lib/hooks/useQueries';
import { usePermissions } from '@/lib/hooks/usePermissions';
import ConfirmModal from '@/components/ConfirmModal';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import type { Patient } from '@/lib/providers/types';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export default function PatientsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const { isSuperAdmin, hasPermission } = usePermissions();
  const canManageDeleted = isSuperAdmin || hasPermission('PATIENTS', 'canDelete');
  const router = useRouter();

  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', age: '', dob: '', gender: 'Male', mobile: '', address: '', occupation: '', abhaNumber: ''
  });

  const { update: updatePatientMut } = usePatientMutations();
  const { data: categoryOptions = [] } = useAppOptions('CATEGORY');
  // Date range validation check
  const isInvalidDateRange = useMemo(() => {
    return !!(fromDate && toDate && fromDate > toDate);
  }, [fromDate, toDate]);

  // Search is sent to the server (name / patient ID / mobile), debounced
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Server-side paging & filtering
  const { data: patientPage, isLoading: loading, isFetching, error } = usePatients({
    search: debouncedQuery || undefined,
    category: category !== 'All' ? category : undefined,
    fromDate: !isInvalidDateRange && fromDate ? fromDate : undefined,
    toDate: !isInvalidDateRange && toDate ? toDate : undefined,
    page,
    limit: PAGE_SIZE,
  });
  const totalPatients = patientPage?.meta.total ?? 0;

  const swapDates = () => {
    const temp = fromDate;
    setFromDate(toDate);
    setToDate(temp);
    setPage(1);
    toast('Date range swapped!', 'info');
  };

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
      toast(getErrorMessage(err, 'Failed to update patient.'), 'error');
    }
  };

  const filteredPatients = useMemo(
    () => (isInvalidDateRange ? [] : patientPage?.data ?? []),
    [patientPage, isInvalidDateRange]
  );

  const hasDateFilter = !!(fromDate || toDate);
  const clearDateFilter = () => { setFromDate(''); setToDate(''); setPage(1); };

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
  if (error) return <ErrorState title="Error Loading Patients" message="Failed to connect to backend database." />;

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Patient Directory</div>
          <div className="page-subtitle">{totalPatients} {hasDateFilter || category !== 'All' || debouncedQuery ? 'matching' : 'registered'} patients</div>
        </div>
        <div className="flex-wrap-header-actions">
          {canManageDeleted && (
            <button
              type="button"
              className={`btn btn-secondary ${showDeleted ? 'active' : ''}`}
              onClick={() => setShowDeleted(v => !v)}
            >
              {showDeleted ? <><Users size={16} /> Active Patients</> : <><ArchiveRestore size={16} /> Recently deleted</>}
            </button>
          )}
          <Link href="/patients/new" className="btn btn-primary">
            <UserPlus size={16} /> Register Patient
          </Link>
        </div>
      </div>

      {showDeleted && canManageDeleted ? (
        <RecentlyDeletedPatients />
      ) : (
      <>
      {/* ── Filters & Search Controls ────────────────────────────────── */}
      <div className="filter-bar" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        {/* Top Control Row: Tabs & Date Filter Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Category Tabs */}
          <div className="cat-pills" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['All', ...categoryOptions.map(o => o.value)].map(cat => (
              <button
                key={cat}
                className={`cat-pill ${category === cat ? 'active' : ''}`}
                onClick={() => { setCategory(cat); setPage(1); }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Date Filter Toggle Button */}
          <button
            className={`btn btn-secondary btn-sm ${hasDateFilter ? 'active' : ''}`}
            onClick={() => setShowDateFilter(!showDateFilter)}
            style={{ position: 'relative', height: 36, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Calendar size={14} />
            {hasDateFilter ? 'Filtered' : 'Filter Date'}
            {hasDateFilter && <span className="filter-dot" />}
          </button>
        </div>

        {/* Date Pickers Expansion Panel */}
        {showDateFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 12, border: isInvalidDateRange ? '1px solid var(--red)' : '1px solid var(--border)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>From:</span>
              <input
                type="date"
                className="form-input"
                style={{
                  padding: '6px 10px', fontSize: '0.82rem', width: 'auto', borderRadius: 8,
                  ...(isInvalidDateRange ? { border: '1.5px solid var(--red)' } : {})
                }}
                value={fromDate}
                max={toDate || new Date().toISOString().split('T')[0]}
                onChange={e => {
                  const val = e.target.value;
                  setFromDate(val);
                  if (toDate && val > toDate) {
                    setToDate(val);
                  }
                  setPage(1);
                }}
                title="From Registration Date"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>To:</span>
              <input
                type="date"
                className="form-input"
                style={{
                  padding: '6px 10px', fontSize: '0.82rem', width: 'auto', borderRadius: 8,
                  ...(isInvalidDateRange ? { border: '1.5px solid var(--red)' } : {})
                }}
                value={toDate}
                min={fromDate}
                onChange={e => {
                  const val = e.target.value;
                  if (fromDate && val < fromDate) {
                    toast('To Date cannot be older than From Date.', 'error');
                    setToDate(fromDate);
                    return;
                  }
                  setToDate(val);
                  setPage(1);
                }}
                title="To Registration Date"
              />
            </div>
            {isInvalidDateRange && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={swapDates}
                style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 4 }}
                title="Swap From and To dates"
              >
                <ArrowLeftRight size={12} /> Swap
              </button>
            )}
            {hasDateFilter && (
              <button className="btn-icon" onClick={clearDateFilter} title="Clear Date Filter" style={{ marginLeft: 'auto' }}>
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Text Search Input Bar */}
        <div className="search-input-wrap" style={{ width: '100%', position: 'relative' }}>
          <span className="s-icon" style={{ left: 14 }}><Search size={16} /></span>
          <input
            className="search-input"
            style={{ padding: '12px 14px 12px 42px', fontSize: '0.9rem', borderRadius: 12 }}
            placeholder="Search name, mobile, or patient ID…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
          />
          {query && (
            <button
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              onClick={() => { setQuery(''); setPage(1); }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Date Range Error Warning Banner */}
      {isInvalidDateRange && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: 'var(--red)',
          fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            <span>Invalid Date Range: <strong>From Date</strong> ({fromDate}) cannot be after <strong>To Date</strong> ({toDate}).</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={swapDates} style={{ background: '#ffffff', color: 'var(--red)', border: '1px solid var(--red)' }}>
            <ArrowLeftRight size={13} /> Swap Dates
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      {filteredPatients.length === 0 ? (
        <div className="empty-state">
          <Users size={48} style={{ opacity: 0.3, marginBottom: 14 }} />
          <h4>No Patients Found</h4>
          <p>
            {isInvalidDateRange
              ? 'Please fix the date range filter above.'
              : query
              ? 'No patients match your search query.'
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
                <th>Name</th>
                <th>Age / Gender</th>
                <th>Mobile</th>
                <th>ABHA Number</th>
                <th>Conditions</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <motion.tbody variants={container} initial="hidden" animate="show">
              {filteredPatients.map(p => (
                <motion.tr variants={item} key={p.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/patients/${p.patientId}`)}>
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
                  <td>
                    {p.permanentConditions && p.permanentConditions.length > 0 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 180 }}>
                        {p.permanentConditions.slice(0, 2).map(c => (
                          <span key={c} className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                            {c}
                          </span>
                        ))}
                        {p.permanentConditions.length > 2 && (
                          <span className="text-muted text-xs">+{p.permanentConditions.length - 2}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
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

      {!isInvalidDateRange && (
        <Pagination meta={patientPage?.meta} onPageChange={setPage} disabled={isFetching} />
      )}
      </>
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
                Edit Patient Details
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
                  <input className="form-input" type="number" min="0" value={editForm.age} onChange={e => setEditForm(f => ({ ...f, age: e.target.value.replace(/-/g, '') }))} />
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

const DELETED_PAGE_SIZE = 25;

/** Soft-deleted patients (with their visits) that can be restored. */
function RecentlyDeletedPatients() {
  const [page, setPage] = useState(1);
  const [toRestore, setToRestore] = useState<Patient | null>(null);
  const { data, isLoading, isFetching, isError, refetch } = useDeletedPatients(page, DELETED_PAGE_SIZE, true);
  const { restore } = usePatientMutations();
  const rows = data?.data ?? [];

  const confirmRestore = async () => {
    if (!toRestore) return;
    try {
      await restore.mutateAsync(toRestore.patientId);
      toast(`${toRestore.name} restored with their visits.`, 'success');
      setToRestore(null);
    } catch {
      // The API client already shows the backend message (e.g. mobile number now used by another patient)
      setToRestore(null);
    }
  };

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ArchiveRestore size={16} /> Recently deleted
        {data && <span className="badge badge-teal">{data.meta.total}</span>}
      </div>
      <p style={{ margin: '0 0 14px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        Deleted patients and their visits are hidden from the clinic but kept. Restore a patient to bring back their records.
      </p>

      {isLoading ? (
        <LoadingScreen message="Loading deleted patients..." />
      ) : isError ? (
        <ErrorState message="Could not load deleted patients." onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <ArchiveRestore />
          <h4>Nothing here</h4>
          <p>Deleted patients will appear here and can be restored.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Patient ID</th>
                <th>Mobile</th>
                <th>Deleted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.patientId}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.patientId}</td>
                  <td>{p.mobile || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.deletedAt ? new Date(p.deletedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setToRestore(p)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination meta={data?.meta} onPageChange={setPage} disabled={isFetching} />

      <ConfirmModal
        isOpen={!!toRestore}
        onClose={() => setToRestore(null)}
        onConfirm={confirmRestore}
        title="Restore patient?"
        description={toRestore ? `${toRestore.name} (${toRestore.patientId}) and their visits will be visible again.` : ''}
        confirmText="Restore Patient"
        variant="info"
        isLoading={restore.isPending}
      />
    </div>
  );
}
