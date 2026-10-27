'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Stethoscope,
  RefreshCw,
  Receipt,
  Wallet,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Share2,
  Printer,
  Search,
  Banknote,
  QrCode,
  ArrowRight,
  X,
} from 'lucide-react';
import { useProviderStore } from '@/lib/providers';
import { useFollowUps, useVisitMutations, usePendingDues } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import type { Visit, Patient, PendingDueVisit, PatientPendingDues } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import RecordPaymentModal from '@/components/RecordPaymentModal';
import { getErrorMessage } from '@/lib/utils/error';

type FollowUpItem = { visit: Visit; patient: Patient | undefined };

export default function FollowUpPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'today' | 'upcoming' | 'missed' | 'all' | 'payments'>('today');
  const [attendedIds, setAttendedIds] = useState<Set<string | number>>(new Set());
  const [expandedPatientIds, setExpandedPatientIds] = useState<Set<string>>(new Set());
  const [paymentSearch, setPaymentSearch] = useState('');
  const [activePaymentModal, setActivePaymentModal] = useState<{
    bill: PendingDueVisit;
    patientName: string;
  } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    visitId: string;
    patientName: string;
    currentDate?: string;
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');

  const provider = useProviderStore((s) => s.provider);
  const { today, upcoming } = useFollowUps();
  const { markFollowUp, updateFollowUpStatus } = useVisitMutations();
  const { data: pendingDuesData, isLoading: duesLoading, refetch: refetchDues } = usePendingDues();

  // Custom query for all pending followups (beyond 30 days)
  const { data: allFU = [], isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['hcms', 'followups', 'all'],
    queryFn: () => provider.getUpcomingFollowUps(9999),
  });

  const missedFU = (allFU || []).filter(
    (item) => item.visit?.id && item.visit.followUpStatus === 'NOT_ATTENDED'
  );
  const todayFU = (today.data || []).filter(
    (item) => item.visit?.id && !attendedIds.has(item.visit.id) && item.visit.followUpStatus !== 'ATTENDED' && item.visit.followUpStatus !== 'NOT_ATTENDED'
  );
  const upcomingFU = (upcoming.data || []).filter(
    (item) => item.visit?.id && !attendedIds.has(item.visit.id) && item.visit.followUpStatus !== 'ATTENDED' && item.visit.followUpStatus !== 'NOT_ATTENDED'
  );
  const allFUClean = (allFU || []).filter(
    (item) => item.visit?.id && !attendedIds.has(item.visit.id) && item.visit.followUpStatus !== 'ATTENDED'
  );

  const loading =
    tab === 'payments'
      ? duesLoading
      : today.isLoading || upcoming.isLoading || (tab === 'all' && allLoading);

  const load = async () => {
    today.refetch();
    upcoming.refetch();
    refetchAll();
    refetchDues();
    toast('Data refreshed', 'info');
  };

  const handleStatusChange = async (visit: Visit, status: 'ATTENDED' | 'NOT_ATTENDED' | 'RESCHEDULED', newDate?: string) => {
    if (!visit.id) return;
    const vid = visit.id;
    if (status === 'ATTENDED') {
      setAttendedIds((prev) => new Set(prev).add(vid));
    }
    try {
      await updateFollowUpStatus.mutateAsync({
        id: vid,
        status,
        newDate,
      });
      await load();
      if (status === 'ATTENDED') toast('Marked as attended!', 'success');
      else if (status === 'NOT_ATTENDED') toast('Marked as Did Not Come', 'info');
      else if (status === 'RESCHEDULED') toast(`Rescheduled follow-up to ${newDate}`, 'success');
    } catch (err) {
      if (status === 'ATTENDED') {
        setAttendedIds((prev) => {
          const next = new Set(prev);
          next.delete(vid);
          return next;
        });
      }
      toast(getErrorMessage(err, 'Failed to update follow-up status.'), 'error');
    }
  };

  const openRescheduleModal = (visit: Visit, patientName: string) => {
    const defaultNext = new Date();
    defaultNext.setDate(defaultNext.getDate() + 7);
    const dateStr = defaultNext.toISOString().slice(0, 10);
    setRescheduleTarget({
      visitId: String(visit.id || ''),
      patientName,
      currentDate: visit.followUpDate,
    });
    setRescheduleDate(dateStr);
  };

  const toggleExpandPatient = (patientId: string) => {
    setExpandedPatientIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) next.delete(patientId);
      else next.add(patientId);
      return next;
    });
  };

  const handleWhatsAppReminder = (patient: PatientPendingDues) => {
    const clinicName = user?.clinicName || 'Clinic';
    const doctorName = user?.doctorName || 'Doctor';
    const visitDetails = (patient.bills || [])
      .map(
        (v: PendingDueVisit) =>
          `• Visit ${new Date(v.visitDate).toLocaleDateString('en-IN')}: Bill #${v.billNumber} - Due: ₹${v.balanceDue}`
      )
      .join('\n');

    const message = `*PAYMENT REMINDER - ${clinicName}*\nDr. ${doctorName}\n----------------------------------\nDear *${patient.patientName}*,\nThis is a gentle reminder regarding your outstanding balance of *₹${patient.totalPendingAmount}* for your OPD visits.\n\n*Details:*\n${visitDetails}\n\nYou may settle this balance during your next visit via Cash or UPI.\n----------------------------------\nThank you!`;

    const phone = (patient.mobile || '').replace(/\D/g, '');
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredPatientsWithDues = useMemo(() => {
    if (!pendingDuesData?.patients) return [];
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return pendingDuesData.patients;
    return pendingDuesData.patients.filter((p) => {
      return (
        p.patientName.toLowerCase().includes(q) ||
        p.mobile.includes(q) ||
        p.patientId.toLowerCase().includes(q) ||
        (p.bills || []).some((v: PendingDueVisit) => v.billNumber.toLowerCase().includes(q))
      );
    });
  }, [pendingDuesData, paymentSearch]);

  const items = tab === 'today' ? todayFU : tab === 'upcoming' ? upcomingFU : tab === 'missed' ? missedFU : allFUClean;

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
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemAnimations = {
    hidden: { opacity: 0, scale: 0.98 },
    show: { opacity: 1, scale: 1 },
  };

  const totalDuesAmount = pendingDuesData?.summary?.totalDuesToCollect || 0;
  const patientsCount = pendingDuesData?.summary?.totalPatientsWithDues || 0;
  const pendingBillsCount = pendingDuesData?.summary?.totalUnpaidVisits || 0;

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Follow-up & Outstanding Dues</div>
          <div className="page-subtitle">
            {todayFU.length} follow-ups today · {upcomingFU.length} in next 30 days · ₹{totalDuesAmount} pending collection
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
          Today{' '}
          {todayFU.length > 0 && (
            <span
              style={{
                background: 'var(--amber)',
                color: '#000',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: '0.65rem',
                marginLeft: 6,
              }}
            >
              {todayFU.length}
            </span>
          )}
        </button>
        <button className={`tab-btn ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Next 30 Days ({upcomingFU.length})
        </button>
        <button className={`tab-btn ${tab === 'missed' ? 'active' : ''}`} onClick={() => setTab('missed')}>
          Did Not Come ({missedFU.length})
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All ({allFU.length})
        </button>
        <button
          className={`tab-btn ${tab === 'payments' ? 'active' : ''}`}
          onClick={() => setTab('payments')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Receipt size={14} />
          <span>Pending Payments</span>
          {totalDuesAmount > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: '0.68rem',
                fontWeight: 700,
              }}
            >
              ₹{totalDuesAmount}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <LoadingScreen message={tab === 'payments' ? 'Loading pending dues...' : 'Loading follow-ups...'} />
      ) : tab === 'payments' ? (
        /* ════════════════ DEDICATED PENDING PAYMENTS SCREEN ════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {/* Card 1: Total Cash/Dues to Collect */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.08))',
                border: '1.5px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Total Dues to Collect
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ef4444', marginTop: 2 }}>
                  ₹{totalDuesAmount.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Card 2: Patients with Dues */}
            <div
              style={{
                background: 'var(--surface-solid)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(13, 148, 136, 0.12)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Patients with Pending Dues
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {patientsCount}
                </div>
              </div>
            </div>

            {/* Card 3: Unsettled OPD Visits */}
            <div
              style={{
                background: 'var(--surface-solid)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Receipt size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Unsettled OPD Visits
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                  {pendingBillsCount}
                </div>
              </div>
            </div>
          </div>

          {/* Search Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--surface-solid)',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter by patient name, phone number, or bill number..."
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
              }}
            />
            {paymentSearch && (
              <button
                type="button"
                onClick={() => setPaymentSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Patient Cards List */}
          {filteredPatientsWithDues.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <CheckCircle2 size={42} style={{ color: '#10b981', margin: '0 auto 12px' }} />
              <h4>All Bills Settled!</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {paymentSearch
                  ? 'No pending payments matched your filter search.'
                  : 'There are currently no outstanding or unpaid patient bills in this clinic.'}
              </p>
            </div>
          ) : (
            <motion.div variants={containerAnimations} initial="hidden" animate="show" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredPatientsWithDues.map((patient) => {
                const isExpanded = expandedPatientIds.has(patient.patientId);

                return (
                  <motion.div
                    variants={itemAnimations}
                    key={patient.patientId}
                    className="card"
                    style={{
                      padding: '16px 20px',
                      border: isExpanded ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      transition: 'all 0.2s ease',
                      boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    {/* Patient Header Row */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      {/* Left: Avatar & Patient Details */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          className="followup-avatar"
                          style={{
                            width: 48,
                            height: 48,
                            fontSize: '1.1rem',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            fontWeight: 700,
                          }}
                        >
                          {patient.patientName.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              {patient.patientName}
                            </span>
                            <span
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#ef4444',
                                borderRadius: 12,
                                padding: '2px 8px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                              }}
                            >
                              ₹{patient.totalPendingAmount} Due
                            </span>
                            <span
                              style={{
                                background: 'var(--surface-2)',
                                color: 'var(--text-secondary)',
                                borderRadius: 12,
                                padding: '2px 8px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                              }}
                            >
                              {(patient.bills || []).length} Unpaid Visit{(patient.bills || []).length > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                              marginTop: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>📞 {patient.mobile || 'No Phone'}</span>
                            {patient.gender && (
                              <span>
                                {patient.gender} {patient.age ? `· ${patient.age}y` : ''}
                              </span>
                            )}
                            <span style={{ fontFamily: 'monospace' }}>ID: {patient.patientId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleWhatsAppReminder(patient)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(37, 211, 102, 0.1)',
                            color: '#16a34a',
                            border: '1px solid rgba(37, 211, 102, 0.3)',
                          }}
                          title="Send payment reminder on WhatsApp"
                        >
                          <Share2 size={14} /> Remind WhatsApp
                        </button>

                        <Link
                          href={`/patients/${patient.patientId}`}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.82rem' }}
                        >
                          Patient Profile
                        </Link>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleExpandPatient(patient.patientId)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <span>{isExpanded ? 'Hide Visits' : 'View Visits'}</span>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Visits Breakdown */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{
                            marginTop: 14,
                            paddingTop: 14,
                            borderTop: '1px dashed var(--border)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: 'var(--text-secondary)',
                              marginBottom: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Unsettled Visits Breakdown
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(patient.bills || []).map((visit: PendingDueVisit) => (
                              <div
                                key={visit.id}
                                style={{
                                  background: 'var(--surface-1)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 10,
                                  padding: '12px 16px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 12,
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                                      {new Date(visit.visitDate).toLocaleDateString('en-IN', {
                                        weekday: 'short',
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      Bill #{visit.billNumber}
                                    </span>
                                    <span
                                      className={`badge ${
                                        visit.paymentStatus === 'PARTIAL' ? 'badge-amber' : 'badge-red'
                                      }`}
                                    >
                                      {visit.paymentStatus === 'PARTIAL' ? 'Partially Paid' : 'Unpaid'}
                                    </span>
                                  </div>

                                  {/* Clinical Info & Treatments */}
                                  <div
                                    style={{
                                      fontSize: '0.8rem',
                                      color: 'var(--text-secondary)',
                                      marginTop: 4,
                                      display: 'flex',
                                      gap: 12,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    {visit.chiefComplaints && <span>C/C: {visit.chiefComplaints}</span>}
                                    {visit.treatment && <span>Treatment: {visit.treatment}</span>}
                                  </div>

                                  {/* Itemized charges summary */}
                                  <div
                                    style={{
                                      fontSize: '0.78rem',
                                      color: 'var(--text-muted)',
                                      marginTop: 4,
                                    }}
                                  >
                                    Charges: Consultation (₹{visit.consultationFee})
                                    {visit.items && visit.items.length > 0 && (
                                      <span>
                                        {' '}
                                        + {visit.items.map((it: any) => `${it.name} (₹${it.totalPrice})`).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Financial Figures & Collect Button */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      Total: ₹{visit.totalAmount} · Paid: ₹{visit.paidAmount}
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ef4444' }}>
                                      ₹{visit.balanceDue} Due
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {visit.visitId && (
                                      <Link
                                        href={`/visits/${visit.visitId}/print?bill=true`}
                                        className="btn btn-ghost btn-sm"
                                        title="Print Bill"
                                      >
                                        <Printer size={14} />
                                      </Link>
                                    )}

                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() =>
                                        setActivePaymentModal({
                                          bill: visit,
                                          patientName: patient.patientName,
                                        })
                                      }
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                    >
                                      <Banknote size={14} />
                                      <span>Collect ₹{visit.balanceDue}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Modal for Recording Due Payment */}
          {activePaymentModal && (
            <RecordPaymentModal
              isOpen={!!activePaymentModal}
              onClose={() => setActivePaymentModal(null)}
              billId={activePaymentModal.bill.id}
              billNumber={activePaymentModal.bill.billNumber}
              patientName={activePaymentModal.patientName}
              balanceDue={activePaymentModal.bill.balanceDue}
              totalAmount={activePaymentModal.bill.totalAmount}
              paidAmount={activePaymentModal.bill.paidAmount}
              onSuccess={() => {
                refetchDues();
              }}
            />
          )}
        </div>
      ) : (
        /* ════════════════ EXISTING FOLLOW-UP TABS (TODAY / UPCOMING / ALL) ════════════════ */
        items.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 />
            <h4>
              {tab === 'today'
                ? 'No Follow-ups Today'
                : tab === 'upcoming'
                ? 'No Upcoming Follow-ups'
                : 'No Pending Follow-ups'}
            </h4>
            <p>
              {tab === 'today'
                ? 'No follow-up appointments scheduled for today.'
                : 'All follow-up appointments are clear!'}
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerAnimations}
            initial="hidden"
            animate="show"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
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
                      {visit.followUpStatus === 'NOT_ATTENDED' && (
                        <span className="badge badge-amber" style={{ fontSize: '0.72rem' }}>Did Not Come</span>
                      )}
                      {visit.followUpStatus === 'RESCHEDULED' && (
                        <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>Rescheduled</span>
                      )}
                      {visit.followUpStatus === 'ATTENDED' && (
                        <span className="badge badge-green" style={{ fontSize: '0.72rem' }}>Attended</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        marginTop: 3,
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      {patient?.mobile && <span>📞 {patient.mobile}</span>}
                      {visit.diagnosis && <span>Dx: {visit.diagnosis}</span>}
                      {visit.followUpDate && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={12} />{' '}
                          {new Date(visit.followUpDate).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="followup-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Link href={`/patients/${visit.patientId}`} className="btn btn-ghost btn-xs">
                    View Patient
                  </Link>
                  <Link href={`/visits/new?patientId=${visit.patientId}`} className="btn btn-secondary btn-xs">
                    <Stethoscope size={13} /> New Visit
                  </Link>
                  <button
                    type="button"
                    className="btn btn-success btn-xs"
                    onClick={() => handleStatusChange(visit, 'ATTENDED')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Mark as Attended"
                  >
                    <CheckCircle2 size={13} /> Attended
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleStatusChange(visit, 'NOT_ATTENDED')}
                    style={{ color: 'var(--amber)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Patient Did Not Come"
                  >
                    <X size={13} /> Did Not Come
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => openRescheduleModal(visit, patient?.name || 'Patient')}
                    style={{ color: 'var(--primary)', border: '1px solid rgba(13, 148, 136, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    title="Reschedule Follow-up"
                  >
                    <Calendar size={13} /> Reschedule
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setRescheduleTarget(null)}
        >
          <div
            style={{
              background: 'var(--surface-solid)',
              borderRadius: 14,
              padding: 20,
              maxWidth: 420,
              width: '100%',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} />
                <span>Reschedule Follow-up</span>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setRescheduleTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Select new follow-up date for <strong>{rescheduleTarget.patientName}</strong>:
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { label: '+3 Days', days: 3 },
                { label: '+7 Days', days: 7 },
                { label: '+14 Days', days: 14 },
                { label: '+1 Month', days: 30 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + preset.days);
                    setRescheduleDate(d.toISOString().slice(0, 10));
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <input
              type="date"
              className="form-input"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              style={{ marginBottom: 16, width: '100%' }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRescheduleTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (!rescheduleDate) {
                    toast('Please select a follow-up date', 'error');
                    return;
                  }
                  handleStatusChange({ id: rescheduleTarget.visitId } as any, 'RESCHEDULED', rescheduleDate);
                  setRescheduleTarget(null);
                }}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
