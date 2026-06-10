'use client';

import Link from 'next/link';
import {
  Users, Stethoscope, Calendar, TrendingUp,
  UserPlus, ArrowRight, Clock, Activity, CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDashboardStats } from '@/lib/hooks/useQueries';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';

export default function DashboardPage() {
  const { data: stats, isLoading: loading, error } = useDashboardStats();

  if (loading) return <LoadingScreen message="Loading today's summary…" />;
  if (error) return <ErrorState message="Could not load your dashboard stats." />;

  const s = stats!;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Good Morning 👋</div>
          <div className="page-subtitle">{today}</div>
        </div>
        <div className="flex-wrap-header-actions">
          <Link href="/patients/new" className="btn btn-secondary btn-sm"><UserPlus size={15} /> Register Patient</Link>
          <Link href="/visits/new" className="btn btn-primary btn-sm"><Stethoscope size={15} /> New Visit</Link>
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div 
        className="dashboard-stats-grid" 
        variants={container} 
        initial="hidden" 
        animate="show"
      >
        <motion.div variants={item} className="stat-card" style={{ '--stat-color': 'var(--accent)', '--stat-bg': 'var(--accent-glow)' } as React.CSSProperties}>
          <div className="stat-icon"><Activity /></div>
          <div className="stat-info">
            <div className="stat-value">{s.todayTotal}</div>
            <div className="stat-label">Patients Today</div>
            <div className="stat-sub">{s.todayNew} new · {s.todayReturning} returning</div>
          </div>
        </motion.div>
        <motion.div variants={item} className="stat-card" style={{ '--stat-color': 'var(--blue)', '--stat-bg': 'rgba(59,130,246,0.1)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ '--stat-color': 'var(--blue)' } as React.CSSProperties}><Users style={{ color: 'var(--blue)' }} /></div>
          <div className="stat-info">
            <div className="stat-value">{s.totalPatients}</div>
            <div className="stat-label">Total Patients</div>
            <div className="stat-sub">Registered in system</div>
          </div>
        </motion.div>
        <motion.div variants={item} className="stat-card" style={{ '--stat-color': 'var(--amber)', '--stat-bg': 'rgba(245,158,11,0.1)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ '--stat-color': 'var(--amber)' } as React.CSSProperties}><Calendar style={{ color: 'var(--amber)' }} /></div>
          <div className="stat-info">
            <div className="stat-value">{s.followUpsToday}</div>
            <div className="stat-label">Follow-ups Today</div>
            <div className="stat-sub">{s.upcomingFollowUps} in next 7 days</div>
          </div>
        </motion.div>
        <motion.div variants={item} className="stat-card" style={{ '--stat-color': 'var(--green)', '--stat-bg': 'rgba(16,185,129,0.1)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ '--stat-color': 'var(--green)' } as React.CSSProperties}><TrendingUp style={{ color: 'var(--green)' }} /></div>
          <div className="stat-info">
            <div className="stat-value">{s.todayNew}</div>
            <div className="stat-label">New Patients Today</div>
            <div className="stat-sub">{s.todayTotal > 0 ? Math.round((s.todayNew / s.todayTotal) * 100) : 0}% of today</div>
          </div>
        </motion.div>
      </motion.div>

      <div className="form-grid-2">
        {/* Today Follow-ups */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><Calendar size={18} /> Today's Follow-ups</div>
            <Link href="/followup" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {s.todayFollowUpList.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <CheckCircle2 />
              <h4>No Follow-ups Today</h4>
              <p>All clear for today!</p>
            </div>
          ) : s.todayFollowUpList.slice(0, 6).map(({ visit, patient }) => (
            <div key={visit.id} className="followup-item">
              <div className="followup-avatar">{patient?.name?.charAt(0)?.toUpperCase() || '?'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{patient?.name || 'Unknown'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{patient?.mobile} · {visit.diagnosis || 'No diagnosis'}</div>
              </div>
              <Link href={`/patients/${visit.patientId}`} className="btn btn-ghost btn-sm">View</Link>
            </div>
          ))}
        </div>

        {/* Recent Visits */}
        <div className="card">
          <div className="section-header">
            <div className="section-title"><Clock size={18} /> Recent Visits</div>
            <Link href="/patients" style={{ fontSize: '0.8rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
              All patients <ArrowRight size={14} />
            </Link>
          </div>
          {s.recentVisits.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <Stethoscope />
              <h4>No visits yet</h4>
              <p>Start by adding your first OPD visit</p>
            </div>
          ) : s.recentVisits.map(({ visit, patient }) => (
            <div key={visit.id} className="followup-item">
              <div className="followup-avatar" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--indigo)' }}>
                {patient?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{patient?.name || visit.patientId}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {visit.diagnosis || visit.chiefComplaints || '—'} · {new Date(visit.date).toLocaleDateString('en-IN')}
                </div>
              </div>
              {visit.followUpDate && <span className="badge badge-amber">F/U</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Quick Actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <Link href="/patients/new" className="btn btn-secondary"><UserPlus size={16} /> Register New Patient</Link>
          <Link href="/visits/new" className="btn btn-primary"><Stethoscope size={16} /> Start OPD Visit</Link>
          <Link href="/followup" className="btn btn-secondary"><Calendar size={16} /> Follow-up Tracker</Link>
          <Link href="/reports" className="btn btn-secondary"><TrendingUp size={16} /> View Reports</Link>
          <Link href="/prescription" className="btn btn-secondary"><Activity size={16} /> Manage Medicines</Link>
        </div>
      </div>
    </PageTransition>
  );
}
