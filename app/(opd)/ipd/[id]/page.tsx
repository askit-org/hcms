'use client';

import { useState, useMemo, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bed,
  Stethoscope,
  Activity,
  Pill,
  Receipt,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Plus,
  Edit2,
  ArrowRightLeft,
  Sparkles,
  HeartPulse,
  Trash2,
  X,
  FileText,
  User,
  ClipboardList,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIpdAdmission, useIpdMutations, useSettings } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import type { IpdAdmission, IpdDayLog, IpdDoctorRound, PrescribedMedicine } from '@/lib/providers/types';
import { getDayRounds, getRoundSessionMeta, getBedDailyRate } from '@/lib/utils/ipd';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import IpdDischargeModal from '@/components/IpdDischargeModal';
import IpdBedTransferModal from '@/components/IpdBedTransferModal';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

export default function IpdAdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: settings } = useSettings();

  const { data: admission, isLoading, error, refetch } = useIpdAdmission(id);
  const { deleteDayLog, updateDayLog, deleteAdmission } = useIpdMutations();

  // Modals state
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const patient = admission?.patient;
  const isDischarged = admission?.status === 'DISCHARGED';

  const dayLogs = useMemo(() => {
    return [...(admission?.dayWiseLogs || [])].sort((a, b) => a.dayNumber - b.dayNumber);
  }, [admission?.dayWiseLogs]);

  // Total calendar days stayed
  const stayDays = useMemo(() => {
    if (!admission) return 1;
    const end = admission.dischargeDate ? new Date(admission.dischargeDate).getTime() : new Date().getTime();
    const start = new Date(admission.admissionDate).getTime();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }, [admission?.admissionDate, admission?.dischargeDate]);

  // Daily rate for the assigned bed/room
  const dailyBedRate = useMemo(() => {
    return getBedDailyRate(admission?.bedOrRoom, settings?.ipdRooms);
  }, [admission?.bedOrRoom, settings?.ipdRooms]);

  // Total bed care charges accrued for the stay duration
  const runningBedCharges = useMemo(() => {
    return stayDays * dailyBedRate;
  }, [stayDays, dailyBedRate]);

  // Total procedure / care charges logged during rounds
  const proceduresChargesTotal = useMemo(() => {
    return dayLogs.reduce((sum, l) => sum + (Number(l.dailyCharges) || 0), 0);
  }, [dayLogs]);

  // Effective Hospital Charges:
  // For discharged admissions, use finalized cumulativeCharges
  // For currently admitted patients, live sum of accrued Bed Charges + logged Procedures
  const effectiveHospitalCharges = useMemo(() => {
    if (!admission) return 0;
    if (isDischarged) {
      return Number(admission.cumulativeCharges || 0);
    }
    return runningBedCharges + proceduresChargesTotal;
  }, [admission, isDischarged, runningBedCharges, proceduresChargesTotal]);

  const effectiveBalanceDue = useMemo(() => {
    if (!admission) return 0;
    if (isDischarged) {
      return Number(admission.balanceDue || 0);
    }
    return Math.max(0, effectiveHospitalCharges - Number(admission.discount || 0) - Number(admission.totalPaid || 0));
  }, [admission, isDischarged, effectiveHospitalCharges]);

  // Selected Timeline Node: 'admission' | number (dayNumber) | 'discharge'
  const defaultDay = useMemo(() => {
    if (dayLogs.length > 0) {
      return dayLogs[dayLogs.length - 1].dayNumber;
    }
    return 'admission';
  }, [dayLogs]);

  const [selectedNode, setSelectedNode] = useState<'admission' | number | 'discharge'>('admission');

  useEffect(() => {
    if (admission) {
      setSelectedNode(defaultDay);
    }
  }, [admission?.id, defaultDay]);

  // Parse prescribed home medications safely
  const parsedDischargeMeds: PrescribedMedicine[] = useMemo(() => {
    if (!admission?.dischargeMedications) return [];
    try {
      const parsed = JSON.parse(admission.dischargeMedications);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [admission?.dischargeMedications]);

  const activeDayLog = useMemo(() => {
    if (typeof selectedNode === 'number') {
      return dayLogs.find((d) => d.dayNumber === selectedNode) || null;
    }
    return null;
  }, [selectedNode, dayLogs]);

  // Delete an individual Doctor Visit Round from a specific day
  const handleDeleteRound = async (dayNumber: number, roundId: string) => {
    if (!admission) return;
    const targetDay = dayLogs.find((d) => d.dayNumber === dayNumber);
    if (!targetDay) return;
    const existingRounds = getDayRounds(targetDay);
    const remainingRounds = existingRounds.filter((r) => r.id !== roundId);

    if (
      !window.confirm(
        remainingRounds.length === 0
          ? `Delete this visit? This is the only visit recorded for Day ${dayNumber}, so Day ${dayNumber} record will also be cleared.`
          : `Delete this visit from Day ${dayNumber}? Procedure charges for this visit will be deducted.`
      )
    ) {
      return;
    }

    try {
      if (remainingRounds.length === 0) {
        await deleteDayLog.mutateAsync({ id: admission.id, dayNumber });
        toast(`Day ${dayNumber} record cleared`, 'success');
      } else {
        const allProcedures = remainingRounds.flatMap((r) => r.procedures || []);
        const totalCharges = remainingRounds.reduce((sum, r) => sum + (Number(r.charges) || 0), 0);
        const latestRound = remainingRounds[remainingRounds.length - 1];

        await updateDayLog.mutateAsync({
          id: admission.id,
          dayNumber,
          input: {
            date: targetDay.date,
            doctorNotes: latestRound?.doctorNotes || '',
            nursingNotes: latestRound?.nursingNotes || '',
            vitals: latestRound?.vitals || undefined,
            medications: latestRound?.medications || [],
            procedures: allProcedures,
            dailyCharges: totalCharges,
            dietNotes: latestRound?.dietNotes || '',
            rounds: remainingRounds,
          },
        });
        toast(`Visit deleted from Day ${dayNumber}`, 'success');
      }
      refetch();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to delete visit'), 'error');
    }
  };

  // Delete an entire Day Log
  const handleDeleteDayLog = async (dayNumber: number) => {
    if (!admission) return;
    if (
      !window.confirm(
        `Are you sure you want to delete Day ${dayNumber} treatment log? All visits and procedure charges recorded on this day will be removed.`
      )
    ) {
      return;
    }
    try {
      await deleteDayLog.mutateAsync({ id: admission.id, dayNumber });
      toast(`Day ${dayNumber} treatment log deleted`, 'success');
      refetch();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to delete day log'), 'error');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading inpatient clinical case sheet..." />;
  if (error || !admission) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: '60px auto' }}>
        <ErrorState
          title="Inpatient Record Not Found"
          message="Could not find the requested hospital admission record. It may have been discharged or deleted."
          onRetry={() => router.push('/ipd')}
        />
      </div>
    );
  }

  return (
    <PageTransition>
      <div style={{ padding: '16px 20px', maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* ─── CARD 1: Patient Header Bar (No Print, No WhatsApp) ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
            <Link
              href="/ipd"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <ArrowLeft size={16} /> Back to IPD Wards
            </Link>

            <div style={{ height: 24, width: 1, background: 'var(--border)' }} className="hidden sm:block" />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Link
                  href={`/patients/${admission.patientId}`}
                  style={{
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                  }}
                  title="View Patient Profile"
                >
                  {patient?.name || 'Inpatient'}
                </Link>
                {patient?.age && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    ({patient.age}y / {patient.gender || 'Unknown'})
                  </span>
                )}
                <span
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#8b5cf6',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Bed size={13} /> Bed: {admission.bedOrRoom}
                </span>
                <span
                  style={{
                    background: !isDischarged ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-2)',
                    color: !isDischarged ? '#10b981' : 'var(--text-muted)',
                    border: !isDischarged ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: '0.76rem',
                    fontWeight: 700,
                  }}
                >
                  {!isDischarged ? `🟢 Currently Admitted · Day ${stayDays}` : `⚪ Discharged after ${stayDays} days`}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                IPD #{admission.admissionNumber} · Admitted:{' '}
                <strong>
                  {new Date(admission.admissionDate).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
                {admission.dischargeDate && (
                  <>
                    {' '}· Discharged:{' '}
                    <strong>
                      {new Date(admission.dischargeDate).toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                  </>
                )}
                {admission.diagnosis ? ` · Dx: ${admission.diagnosis}` : ''}
                {admission.attendingDoctor ? ` · Dr. ${admission.attendingDoctor}` : ''}
              </div>
            </div>
          </div>
        </div>

        {/* ─── CARD 2: Financial Status & Quick Bedside Actions (Only Log Round + Transfer Bed) ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 14,
            fontSize: '0.84rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {isDischarged ? 'Hospital Charges' : 'Running Hospital Charges'}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                ₹{effectiveHospitalCharges}
              </div>
              {!isDischarged && (
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Bed: ₹{runningBedCharges} ({stayDays}d @ ₹{dailyBedRate}) + Care: ₹{proceduresChargesTotal}
                </div>
              )}
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Advance Deposit</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)' }}>₹{admission.advancePaid}</div>
            </div>
            {Boolean(admission.discount) && (
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discount</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#16a34a' }}>-₹{admission.discount}</div>
              </div>
            )}
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Settled</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#16a34a' }}>₹{admission.totalPaid}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Balance Due</div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  color: effectiveBalanceDue > 0 ? '#ef4444' : '#16a34a',
                }}
              >
                ₹{effectiveBalanceDue}
              </div>
            </div>
          </div>

          {/* Quick Bedside Actions: Log Today's Round + Transfer Bed + Discharge & Settle */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!isDischarged && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => router.push(`/ipd/${admission.id}/visit`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#10b981',
                    borderColor: '#10b981',
                    fontWeight: 700,
                  }}
                >
                  <Plus size={15} /> Log Today&apos;s Round
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTransferModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowRightLeft size={14} /> Transfer Bed
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowDischargeModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    fontWeight: 700,
                  }}
                  title="Discharge this patient and proceed to billing settlement"
                >
                  <CheckCircle2 size={15} style={{ color: '#ef4444' }} /> Discharge Patient
                </button>
              </>
            )}
            {isDischarged && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDischargeModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Receipt size={14} /> View Settlement &amp; Summary
              </button>
            )}
          </div>
        </div>

        {/* ─── CARD 3: Multi-Day Inpatient Journey Timeline ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.96rem' }}>
              <Sparkles size={18} style={{ color: '#8b5cf6' }} />
              <span>Multi-Day Inpatient Journey Timeline</span>
              <span className="badge badge-purple" style={{ fontSize: '0.74rem' }}>
                {dayLogs.length} Days Charted
              </span>
            </div>

            {!isDischarged && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() =>
                  router.push(
                    `/ipd/${admission.id}/visit${typeof selectedNode === 'number' ? `?day=${selectedNode}` : ''}`
                  )
                }
                style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
              >
                <Plus size={13} /> Log Doctor Round / Visit
              </button>
            )}
          </div>

          {/* Timeline Nodes Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '6px 2px',
              scrollbarWidth: 'none',
            }}
          >
            {/* Node 1: Admission */}
            <button
              type="button"
              onClick={() => setSelectedNode('admission')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                border: selectedNode === 'admission' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: selectedNode === 'admission' ? 'rgba(13, 148, 136, 0.12)' : 'var(--surface-1)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: selectedNode === 'admission' ? 700 : 500,
                fontSize: '0.82rem',
                color: selectedNode === 'admission' ? 'var(--primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Bed size={14} />
              <span>Admission (Day 0)</span>
            </button>

            {/* Daily Treatment Nodes */}
            {dayLogs.map((log) => {
              const isSelected = selectedNode === log.dayNumber;
              const rounds = getDayRounds(log);

              return (
                <button
                  key={log.dayNumber}
                  type="button"
                  onClick={() => setSelectedNode(log.dayNumber)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: isSelected ? '2px solid #8b5cf6' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(139, 92, 246, 0.12)' : 'var(--surface-1)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.82rem',
                    color: isSelected ? '#8b5cf6' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Activity size={14} />
                  <span>
                    Day {log.dayNumber} ({new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                  </span>
                  <span
                    style={{
                      background: isSelected ? '#8b5cf6' : 'var(--surface-2)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      borderRadius: 10,
                      padding: '1px 6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {rounds.length} {rounds.length === 1 ? 'visit' : 'visits'}
                  </span>
                </button>
              );
            })}

            {/* Final Node: Discharge */}
            {isDischarged && (
              <button
                type="button"
                onClick={() => setSelectedNode('discharge')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: selectedNode === 'discharge' ? '2px solid #10b981' : '1px solid var(--border)',
                  background: selectedNode === 'discharge' ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-1)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontWeight: selectedNode === 'discharge' ? 700 : 500,
                  fontSize: '0.82rem',
                  color: selectedNode === 'discharge' ? '#10b981' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <CheckCircle2 size={14} />
                <span>Discharge &amp; Final Bill</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── CARD 4: Detail Panel for the Selected Node ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. ADMISSION INTAKE NODE */}
          {selectedNode === 'admission' && (
            <div className="card" style={{ padding: 22, background: 'var(--surface-solid)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bed size={20} style={{ color: 'var(--primary)' }} />
                  <span>Inpatient Admission Clinical Assessment</span>
                </div>
                <span className="badge badge-purple" style={{ fontWeight: 700 }}>
                  Day 0 · Intake
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 10, color: 'var(--text-primary)' }}>
                    Patient Clinical Profile
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.84rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Name:</span>{' '}
                      <strong>{patient?.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Age &amp; Gender:</span>{' '}
                      {patient?.age} yrs / {patient?.gender}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Mobile:</span>{' '}
                      {patient?.mobile || '—'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>ABHA ID:</span>{' '}
                      {patient?.abhaNumber || '—'}
                    </div>
                    {patient?.address && (
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Address:</span>{' '}
                        {patient.address}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 10, color: 'var(--text-primary)' }}>
                    Admission Order &amp; Allocation
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.84rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Bed / Room:</span>{' '}
                      <span className="badge badge-purple">{admission.bedOrRoom}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Admission Date &amp; Time:</span>{' '}
                      <strong>
                        {new Date(admission.admissionDate).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Provisional Diagnosis:</span>{' '}
                      <strong style={{ color: 'var(--primary)' }}>{admission.diagnosis || 'Clinical Inpatient Care'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Attending Doctor:</span>{' '}
                      Dr. {admission.attendingDoctor || user?.doctorName || 'Doctor'}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Initial Advance Paid:</span>{' '}
                      <strong style={{ color: '#16a34a' }}>₹{admission.advancePaid}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {dayLogs.length === 0 && !isDischarged && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'rgba(13, 148, 136, 0.05)',
                    border: '1.5px dashed rgba(13, 148, 136, 0.3)',
                    borderRadius: 12,
                  }}
                >
                  <Activity size={32} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
                  <h4 style={{ margin: '0 0 6px' }}>Ready for Day 1 Clinical Rounds</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 14px' }}>
                    Record doctor visits, vitals, medications, clinical notes, and procedures for Day 1.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => router.push(`/ipd/${admission.id}/visit?day=1`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={15} /> Chart Day 1 Doctor Round
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. DAILY TREATMENT LOG NODE (Day 1, 2, 3... WITH MULTIPLE DOCTOR VISITS) */}
          {typeof selectedNode === 'number' && activeDayLog && (() => {
            const rounds = getDayRounds(activeDayLog);

            return (
              <div className="card" style={{ padding: 22, background: 'var(--surface-solid)' }}>
                {/* Day Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#8b5cf6',
                          padding: '4px 12px',
                          borderRadius: 8,
                          fontWeight: 800,
                          fontSize: '0.92rem',
                        }}
                      >
                        Day {activeDayLog.dayNumber}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                        {new Date(activeDayLog.date).toLocaleDateString('en-IN', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Day Procedure &amp; Care Charges: <strong>₹{activeDayLog.dailyCharges || 0}</strong> ·{' '}
                      <strong>{rounds.length}</strong> Doctor {rounds.length === 1 ? 'Visit' : 'Visits'} Recorded
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!isDischarged && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => router.push(`/ipd/${admission.id}/visit?day=${activeDayLog.dayNumber}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: '#10b981',
                          borderColor: '#10b981',
                          fontWeight: 700,
                        }}
                      >
                        <Plus size={15} /> Add Visit / Round to Day {activeDayLog.dayNumber}
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeleteDayLog(activeDayLog.dayNumber)}
                      style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title="Delete this entire day log"
                    >
                      <Trash2 size={14} /> Delete Day
                    </button>
                  </div>
                </div>

                {/* Stream of Multiple Doctor Visits on this Day */}
                {rounds.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px 16px',
                      background: 'var(--surface-1)',
                      borderRadius: 12,
                      border: '1.5px dashed var(--border)',
                    }}
                  >
                    <Stethoscope size={32} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
                    <h4 style={{ margin: '0 0 4px', fontSize: '1rem' }}>No Doctor Visits Logged for Day {activeDayLog.dayNumber}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 12px' }}>
                      Add morning, afternoon, evening, night, or emergency visits for this patient.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => router.push(`/ipd/${admission.id}/visit?day=${activeDayLog.dayNumber}`)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus size={14} /> Log First Visit for Day {activeDayLog.dayNumber}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {rounds.map((round, rIdx) => {
                      const meta = getRoundSessionMeta(round.roundType);
                      const v = round.vitals;
                      const hasVitals = Boolean(v && Object.values(v).some(Boolean));

                      return (
                        <div
                          key={round.id || rIdx}
                          style={{
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: '16px 18px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                          }}
                        >
                          {/* Round Header Bar */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                              borderBottom: '1px solid var(--border)',
                              paddingBottom: 10,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  background: meta.bg,
                                  color: meta.color,
                                  border: meta.border,
                                  padding: '3px 10px',
                                  borderRadius: 6,
                                  fontWeight: 800,
                                  fontSize: '0.82rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <span>{meta.iconText}</span>
                                <span>{round.roundType || 'Doctor Visit'}</span>
                              </span>

                              <span
                                style={{
                                  background: 'var(--surface-solid)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--text-primary)',
                                  padding: '3px 9px',
                                  borderRadius: 6,
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                                <span>{round.time}</span>
                              </span>

                              {round.doctorName && (
                                <span
                                  style={{
                                    fontSize: '0.8rem',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Stethoscope size={13} style={{ color: 'var(--primary)' }} />
                                  <span>Dr. {round.doctorName}</span>
                                </span>
                              )}

                              <span className="badge badge-gray" style={{ fontSize: '0.72rem' }}>
                                Visit #{rIdx + 1}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() =>
                                  router.push(
                                    `/ipd/${admission.id}/visit?day=${activeDayLog.dayNumber}&roundId=${round.id}`
                                  )
                                }
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Edit2 size={12} /> Edit Visit
                              </button>

                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => handleDeleteRound(activeDayLog.dayNumber, round.id)}
                                style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                title="Delete this visit"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Vitals Checked */}
                          {hasVitals && v && (
                            <div>
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  marginBottom: 6,
                                }}
                              >
                                Vitals Checked During This Visit
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                                {v.bp && (
                                  <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>BP (mmHg)</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ef4444', marginTop: 1 }}>{v.bp}</div>
                                  </div>
                                )}
                                {v.pulse && (
                                  <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pulse (bpm)</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--blue)', marginTop: 1 }}>{v.pulse}</div>
                                  </div>
                                )}
                                {v.temp && (
                                  <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temp (°F)</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: parseFloat(v.temp) >= 100.4 ? '#ef4444' : '#f59e0b', marginTop: 1 }}>{v.temp}°F</div>
                                  </div>
                                )}
                                {v.spo2 && (
                                  <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SpO2 (%)</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: parseFloat(v.spo2) < 95 ? '#ef4444' : '#16a34a', marginTop: 1 }}>{v.spo2}%</div>
                                  </div>
                                )}
                                {v.respRate && (
                                  <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resp Rate</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', marginTop: 1 }}>{v.respRate}/min</div>
                                  </div>
                                )}
                                {v.sugar && (
                                  <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sugar (GRBS)</div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#8b5cf6', marginTop: 1 }}>{v.sugar} mg/dL</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Doctor Progress Observations */}
                          {round.doctorNotes && (
                            <div>
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  marginBottom: 4,
                                }}
                              >
                                Doctor Observations &amp; Round Notes
                              </div>
                              <div
                                style={{
                                  background: 'var(--surface-solid)',
                                  borderLeft: '3.5px solid var(--primary)',
                                  borderRadius: 6,
                                  padding: '10px 14px',
                                  fontSize: '0.86rem',
                                  lineHeight: 1.5,
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {round.doctorNotes}
                              </div>
                            </div>
                          )}

                          {/* Medications Charted */}
                          {round.medications && round.medications.length > 0 && (
                            <div>
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  marginBottom: 6,
                                }}
                              >
                                Medications Charted in This Visit ({round.medications.length})
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                {round.medications.map((m, mIdx) => (
                                  <div
                                    key={mIdx}
                                    style={{
                                      background: 'var(--surface-solid)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 7,
                                      padding: '8px 10px',
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                      {m.dose} · {m.route} · {m.timing}
                                      {m.instructions ? ` · ${m.instructions}` : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Procedures & Charges */}
                          {round.procedures && round.procedures.length > 0 && (
                            <div>
                              <div
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                  marginBottom: 6,
                                }}
                              >
                                Procedures &amp; Care Performed ({round.procedures.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {round.procedures.map((p, pIdx) => (
                                  <div
                                    key={pIdx}
                                    style={{
                                      background: 'var(--surface-solid)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 7,
                                      padding: '7px 12px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    <span>
                                      <strong>{p.name}</strong>{' '}
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>(Qty: {p.quantity})</span>
                                    </span>
                                    <strong style={{ color: 'var(--primary)' }}>₹{p.totalPrice}</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Nursing Directives & Diet */}
                          {(round.nursingNotes || round.dietNotes) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: '0.82rem' }}>
                              {round.nursingNotes && (
                                <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px' }}>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                                    Nursing Directives
                                  </div>
                                  <div style={{ marginTop: 3 }}>{round.nursingNotes}</div>
                                </div>
                              )}
                              {round.dietNotes && (
                                <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px' }}>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                                    Diet &amp; Nutrition
                                  </div>
                                  <div style={{ marginTop: 3 }}>{round.dietNotes}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. DISCHARGE SUMMARY NODE */}
          {selectedNode === 'discharge' && (
            <div className="card" style={{ padding: 22, background: 'var(--surface-solid)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                  <span>Inpatient Discharge Summary &amp; Home Settlement</span>
                </div>
                <span className="badge badge-green" style={{ fontWeight: 700 }}>
                  Discharge Node
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discharge Date</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>
                      {admission.dischargeDate ? new Date(admission.dischargeDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Pending'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Length of Stay</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>
                      {stayDays} {stayDays === 1 ? 'Day' : 'Days'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Final Settlement Status</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: Number(admission.balanceDue) > 0 ? '#ef4444' : '#16a34a', marginTop: 2 }}>
                      {Number(admission.balanceDue) > 0 ? `₹${admission.balanceDue} Due` : 'Fully Settled'}
                    </div>
                  </div>
                </div>

                {admission.dischargeSummary && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Hospital Course &amp; Condition at Discharge
                    </div>
                    <div style={{ background: 'var(--surface-1)', borderLeft: '4px solid #10b981', borderRadius: 8, padding: '12px 16px', fontSize: '0.88rem', lineHeight: 1.5 }}>
                      {admission.dischargeSummary}
                    </div>
                  </div>
                )}

                {parsedDischargeMeds.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Discharge Home Medications Prescribed ({parsedDischargeMeds.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                      {parsedDischargeMeds.map((med, idx) => (
                        <div key={idx} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{med.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {med.dose} · {med.duration}
                            {med.instructions ? ` · ${med.instructions}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {admission.dischargeNotes && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Post-Discharge Instructions &amp; Follow-Up Advice
                    </div>
                    <div style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '12px 16px', fontSize: '0.86rem', border: '1px solid var(--border)' }}>
                      {admission.dischargeNotes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODALS ─── */}
      {/* 1. Discharge Modal */}
      {showDischargeModal && (
        <IpdDischargeModal
          isOpen={showDischargeModal}
          onClose={() => setShowDischargeModal(false)}
          admission={admission}
          onSuccess={() => {
            setShowDischargeModal(false);
            refetch();
          }}
        />
      )}

      {/* 3. Bed Transfer Modal */}
      {showTransferModal && (
        <IpdBedTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          admission={admission}
          onSuccess={() => {
            setShowTransferModal(false);
            refetch();
          }}
        />
      )}
    </PageTransition>
  );
}
