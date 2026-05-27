'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Search, Eye, Stethoscope, Phone,
  Calendar, X, ChevronRight
} from 'lucide-react';
import { usePatients, useAppOptions } from '@/lib/hooks/useQueries';
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

  const { data: categoryOptions = [] } = useAppOptions('CATEGORY');
  const { data: allPatients = [], isLoading: loading, error } = usePatients({
    category: category !== 'All' ? category : undefined
  });

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
            !p.patientId.toLowerCase().includes(q)) {
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

  const genderColor = (g: string) => {
    if (g === 'Male') return 'badge-blue';
    if (g === 'Female') return 'badge-purple';
    return 'badge-teal';
  };

  if (error) return <PageTransition><ErrorState message="Could not fetch patients. Please ensure the backend is running." /></PageTransition>;
  if (loading) return <PageTransition><LoadingScreen message="Loading patient records..." /></PageTransition>;

  return (
    <PageTransition>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title">Patients Directory</div>
          <div className="page-subtitle">
            {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} showing
            {hasDateFilter ? ` · Date range applied` : ''}
          </div>
        </div>
        
        <div className="flex-wrap-header-actions" style={{ display: 'flex', gap: 10, alignSelf: 'flex-end', marginTop: '10px' }}>
          <select 
            className="form-select" 
            value={category} 
            onChange={e => setCategory(e.target.value)}
            style={{ width: 'auto', padding: '9px 28px 9px 14px', height: '40px' }}
          >
            <option value="All">All Categories</option>
            <option value="OPD">OPD</option>
            <option value="IPD">IPD</option>
            <option value="Emergency">Emergency</option>
            {categoryOptions.filter(o => !['OPD', 'IPD', 'Emergency'].includes(o.value)).map(c => (
              <option key={c.id} value={c.value}>{c.value}</option>
            ))}
          </select>
          <button 
            className={`btn ${hasDateFilter ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setShowDateFilter(v => !v)}
            style={{ padding: '9px 14px' }}
          >
            <Calendar size={16} /> <span className="hide-mobile">{hasDateFilter ? 'Date Filter Applied' : 'Filter Date'}</span>
          </button>
          <Link href={`/patients/new`} className="btn btn-primary"><UserPlus size={16} /> <span className="hide-mobile">Register Patient</span></Link>
        </div>
      </div>

      {/* ── Date Range Filter Expanded Card ──────────────────────── */}
      <AnimatePresence>
        {showDateFilter && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="date-range-card">
              <div className="date-range-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={15} style={{ color: '#6366f1' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Filter by Registration Date</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {hasDateFilter && (
                    <button className="btn btn-danger btn-sm" onClick={clearDateFilter} style={{ padding: '4px 10px' }}>
                      <X size={12} /> Clear Filter
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => setShowDateFilter(false)}><X size={16} /></button>
                </div>
              </div>
              <div className="date-range-body">
                <div className="date-range-input-group">
                  <div className="date-range-point">
                    <div className="drp-dot from" />
                    <div>
                      <div className="drp-label">From</div>
                      <input
                        className="form-input"
                        type="date"
                        value={fromDate}
                        max={toDate || undefined}
                        onChange={e => setFromDate(e.target.value)}
                        style={{ width: 180 }}
                      />
                    </div>
                  </div>
                  <div className="drp-arrow">
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="date-range-point">
                    <div className="drp-dot to" />
                    <div>
                      <div className="drp-label">To</div>
                      <input
                        className="form-input"
                        type="date"
                        value={toDate}
                        min={fromDate || undefined}
                        onChange={e => setToDate(e.target.value)}
                        style={{ width: 180 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div className="search-input-wrap">
          <span className="s-icon"><Search /></span>
          <input
            className="search-input"
            placeholder="Search patients by name, mobile, or ID…"
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
                      <Link href={`/patients/${p.patientId}`} className="btn btn-ghost btn-sm"><Eye size={14} /></Link>
                      <Link href={`/visits/new?patientId=${p.patientId}`} className="btn btn-primary btn-sm"><Stethoscope size={14} /></Link>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
