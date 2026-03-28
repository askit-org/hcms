'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Search, Filter, Eye, Stethoscope, Phone, MapPin, Edit2 } from 'lucide-react';
import { usePatients } from '@/lib/hooks/useQueries';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';

export default function PatientsPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: patients = [], isLoading: loading, error } = usePatients({ search: debouncedQuery });

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const genderColor = (g: string) => {
    if (g === 'Male') return 'badge-blue';
    if (g === 'Female') return 'badge-purple';
    return 'badge-teal';
  };

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Patients</div>
          <div className="page-subtitle">{patients.length} patient{patients.length !== 1 ? 's' : ''} {query ? 'found' : 'registered'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/patients/new" className="btn btn-primary"><UserPlus size={16} /> Register Patient</Link>
        </div>
      </div>

      {/* Search */}
      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34 }}
            placeholder="Search by name, mobile number, or Patient ID…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <ErrorState message="Could not fetch patients. Please ensure the backend is running." />
      ) : loading ? (
        <LoadingScreen message="Loading patient records..." />
      ) : patients.length === 0 ? (
        <div className="empty-state">
          <Users />
          <h4>No Patients Found</h4>
          <p>{query ? 'No patients match your search. Try a different name or mobile number.' : 'Register your first patient to get started.'}</p>
          <Link href="/patients/new" className="btn btn-primary" style={{ marginTop: 16 }}><UserPlus size={16} /> Register First Patient</Link>
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
                <th>Address</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <motion.tbody variants={container} initial="hidden" animate="show">
              {patients.map(p => (
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
