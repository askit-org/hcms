'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users, UserPlus, Search, Eye, Stethoscope, Phone,
  Calendar, X, Building2, Bed, Sparkles, Ambulance, Heart, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { usePatients } from '@/lib/hooks/useQueries';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';

const CATEGORIES = [
  { id: 'All', label: 'All Patients', icon: Users, color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
  { id: 'OPD', label: 'OPD', icon: Stethoscope, color: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
  { id: 'IPD', label: 'IPD', icon: Bed, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { id: 'Suwarna Pashan', label: 'Suwarna Pashan', icon: Sparkles, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { id: 'Emergency', label: 'Emergency', icon: Ambulance, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { id: 'Specialty', label: 'Specialty', icon: Heart, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'Other', label: 'Other', icon: Building2, color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
];

const catBadgeClass: Record<string, string> = {
  OPD: 'badge-teal',
  IPD: 'badge-blue',
  Emergency: 'badge-red',
  Specialty: 'badge-purple',
  'Suwarna Pashan': 'badge-amber',
  Other: '',
};

export default function PatientsPage() {
  const [query, setQuery] = useState('');
  // null means showing the category grid "master" screen
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const router = useRouter();

  // Fetch ALL patients once so we can calculate group counts and do local filtering.
  const { data: allPatients = [], isLoading: loading, error } = usePatients();

  // Calculate counts for the category tiles
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allPatients.length };
    allPatients.forEach(p => {
      const cat = p.category || 'OPD';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [allPatients]);

  const filteredPatients = useMemo(() => {
    return allPatients.filter(p => {
      if (!activeCategory) return false;

      // Category filter
      if (activeCategory !== 'All' && (p.category || 'OPD') !== activeCategory) {
        return false;
      }
      
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
  }, [allPatients, activeCategory, fromDate, toDate, query]);

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

  // If error or loading, show globally
  if (error) return <PageTransition><ErrorState message="Could not fetch patients. Please ensure the backend is running." /></PageTransition>;
  if (loading) return <PageTransition><LoadingScreen message="Loading patient records..." /></PageTransition>;

  // ── SCREEN 1: Category Grid (Master View) ──────────────────────────────────
  if (activeCategory === null) {
    return (
      <PageTransition>
        <div className="page-header">
          <div>
            <div className="page-title">Patients Directory</div>
            <div className="page-subtitle">Select a category to view patients</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/patients/new" className="btn btn-primary"><UserPlus size={16} /> Register Patient</Link>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '16px', 
        }}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '24px',
                  borderRadius: '16px',
                  border: `1px solid var(--border)`,
                  background: 'var(--surface-2)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = cat.color;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = `0 12px 30px rgba(0,0,0,0.15)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: cat.bg,
                  color: cat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  transition: 'all 0.2s ease'
                }}>
                  <Icon size={24} />
                </div>
                <div style={{ 
                  fontSize: '1.05rem', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)',
                  marginBottom: '6px'
                }}>
                  {cat.label}
                </div>
                <div style={{ 
                  fontSize: '2.2rem', 
                  fontWeight: 800, 
                  color: cat.color,
                  lineHeight: 1
                }}>
                  {count} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>patients</span>
                </div>
              </button>
            );
          })}
        </div>
      </PageTransition>
    );
  }

  // ── SCREEN 2: Patient List (Inner View) ────────────────────────────────────
  const activeCatObj = CATEGORIES.find(c => c.id === activeCategory)!;
  const ActiveIcon = activeCatObj.icon;

  return (
    <PageTransition>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <button 
            onClick={() => { setActiveCategory(null); clearDateFilter(); setQuery(''); setShowDateFilter(false); }} 
            className="btn btn-ghost btn-sm" 
            style={{ marginBottom: 12, paddingLeft: 0, border: 'none', color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> Back to Categories
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: activeCatObj.bg, color: activeCatObj.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ActiveIcon size={18} />
            </div>
            <div>
              <div className="page-title">{activeCatObj.label}</div>
              <div className="page-subtitle">
                {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} showing
                {hasDateFilter ? ` · Date range applied` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-end', marginTop: '10px' }}>
          <button 
            className={`btn ${hasDateFilter ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setShowDateFilter(v => !v)}
            style={{ padding: '9px 14px' }}
          >
            <Calendar size={16} /> {hasDateFilter ? 'Date Filter Applied' : 'Filter Date'}
          </button>
          <Link href={`/patients/new`} className="btn btn-primary"><UserPlus size={16} /> Register Patient</Link>
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
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder={`Search ${activeCategory !== 'All' ? activeCategory : ''} patients by name, mobile, or ID…`}
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
          {activeCategory !== 'All'
            ? <ActiveIcon size={48} style={{ opacity: 0.3, marginBottom: 14 }} />
            : <Users size={48} style={{ opacity: 0.3, marginBottom: 14 }} />}
          <h4>No Patients Found</h4>
          <p>
            {query
              ? 'No patients match your search.'
              : hasDateFilter
              ? 'No patients registered in the selected date range.'
              : activeCategory !== 'All'
              ? `No ${activeCategory} patients registered yet.`
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
                <th>Category</th>
                <th>Age / Gender</th>
                <th>Mobile</th>
                <th>Address</th>
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
                    <span className={`badge ${catBadgeClass[p.category || 'OPD'] || 'badge-teal'}`}>
                      {p.category || 'OPD'}
                    </span>
                  </td>
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
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 160 }} className="truncate">{p.address || '—'}</td>
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
