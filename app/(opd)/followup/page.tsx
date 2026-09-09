'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, Clock, Stethoscope, RefreshCw } from 'lucide-react';
import { useProviderStore } from '@/lib/providers';
import { useFollowUps, useVisitMutations } from '@/lib/hooks/useQueries';
import { useQuery } from '@tanstack/react-query';
import type { Visit, Patient } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';

type FollowUpItem = { visit: Visit; patient: Patient | undefined };

export default function FollowUpPage() {
  const [tab, setTab] = useState<'today' | 'upcoming' | 'all'>('today');
  const provider = useProviderStore(s => s.provider);

  const { today, upcoming } = useFollowUps();
  const { markFollowUp } = useVisitMutations();

  // Custom query for all pending (beyond 30 days)
  const { data: allFU = [], isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['hcms', 'followups', 'all'],
    queryFn: () => provider.getUpcomingFollowUps(9999)
  });

  const todayFU = today.data || [];
  const upcomingFU = upcoming.data || [];
  const loading = today.isLoading || upcoming.isLoading || (tab === 'all' && allLoading);

  const load = async () => {
    today.refetch();
    upcoming.refetch();
    refetchAll();
  };

  const markAttended = async (v: Visit) => {
    if (v.id) {
      await markFollowUp.mutateAsync(v.id);
      toast(`Marked as attended for ${v.followUpDate}.`, 'success');
    }
  };

  const items = tab === 'today' ? todayFU : tab === 'upcoming' ? upcomingFU : allFU;

  const getDaysLabel = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return <span className="badge badge-amber">Today</span>;
    if (diff === 1) return <span className="badge badge-blue">Tomorrow</span>;
    if (diff > 1) return <span className="badge badge-blue">In {diff} days</span>;
    if (diff < 0) return <span className="badge badge-red">Overdue ({Math.abs(diff)}d)</span>;
  };

  const containerAnimations = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemAnimations = {
    hidden: { opacity: 0, scale: 0.98 },
    show: { opacity: 1, scale: 1 }
  };

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Follow-up Tracker</div>
          <div className="page-subtitle">
            {todayFU.length} today · {upcomingFU.length} in next 30 days
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
          Today {todayFU.length > 0 && <span style={{ background: 'var(--amber)', color: '#000', borderRadius: 10, padding: '1px 6px', fontSize: '0.65rem', marginLeft: 6 }}>{todayFU.length}</span>}
        </button>
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Next 30 Days ({upcomingFU.length})
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All Pending ({allFU.length})
        </button>
      </div>

      {loading ? (
        <LoadingScreen message="Loading follow-ups..." />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 />
          <h4>{tab === 'today' ? 'No Follow-ups Today' : tab === 'upcoming' ? 'No Upcoming Follow-ups' : 'No Pending Follow-ups'}</h4>
          <p>{tab === 'today' ? 'No follow-up appointments scheduled for today.' : 'All follow-up appointments are clear!'}</p>
        </div>
      ) : (
        <motion.div variants={containerAnimations} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(({ visit, patient }) => (
            <motion.div variants={itemAnimations} key={visit.id} className="card card-sm followup-card">
              <div className="followup-info-wrap">
                {/* Avatar */}
                <div className="followup-avatar" style={{ width: 46, height: 46, fontSize: '1rem' }}>
                  {patient?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{patient?.name || 'Patient'}</span>
                    {visit.followUpDate && getDaysLabel(visit.followUpDate)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {patient?.mobile && <span>📞 {patient.mobile}</span>}
                    {visit.diagnosis && <span>Dx: {visit.diagnosis}</span>}
                    {visit.followUpDate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} /> {new Date(visit.followUpDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="followup-actions">
                <Link href={`/patients/${visit.patientId}`} className="btn btn-ghost btn-sm">View Patient</Link>
                <Link href={`/visits/new?patientId=${visit.patientId}`} className="btn btn-secondary btn-sm"><Stethoscope size={14} /> New Visit</Link>
                <button className="btn btn-success btn-sm" onClick={() => markAttended(visit)}>
                  <CheckCircle2 size={14} /> Attended
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
