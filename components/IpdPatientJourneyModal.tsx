'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  X,
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
  Minus,
  Plus,
  Edit2,
  Printer,
  Share2,
  ArrowRightLeft,
  Banknote,
  ClipboardList,
  Sparkles,
  HeartPulse,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IpdAdmission, IpdDayLog, PrescribedMedicine } from '@/lib/providers/types';
import { toast } from '@/components/Toast';

interface IpdPatientJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: IpdAdmission;
  onOpenDayLog?: (dayLog?: IpdDayLog | null) => void;
  onOpenDischarge?: () => void;
  onOpenTransfer?: () => void;
  onOpenAdvance?: () => void;
  onDeleteAdmission?: () => void;
  onDeleteDayLog?: (dayNumber: number) => void;
}

export default function IpdPatientJourneyModal({
  isOpen,
  onClose,
  admission,
  onOpenDayLog,
  onOpenDischarge,
  onOpenTransfer,
  onOpenAdvance,
  onDeleteAdmission,
  onDeleteDayLog,
}: IpdPatientJourneyModalProps) {
  const patient = admission.patient;
  const isDischarged = admission.status === 'DISCHARGED';
  const dayLogs = useMemo(() => {
    return [...(admission.dayWiseLogs || [])].sort((a, b) => a.dayNumber - b.dayNumber);
  }, [admission.dayWiseLogs]);

  // Total calendar days stayed
  const stayDays = useMemo(() => {
    const end = admission.dischargeDate ? new Date(admission.dischargeDate).getTime() : new Date().getTime();
    const start = new Date(admission.admissionDate).getTime();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }, [admission.admissionDate, admission.dischargeDate]);

  // Selected Day Key: 'admission' | number (dayNumber) | 'discharge'
  const defaultDay = useMemo(() => {
    if (dayLogs.length > 0) {
      return dayLogs[dayLogs.length - 1].dayNumber;
    }
    return 'admission';
  }, [dayLogs]);

  const [selectedNode, setSelectedNode] = useState<'admission' | number | 'discharge'>(defaultDay);

  useEffect(() => {
    setSelectedNode(defaultDay);
  }, [admission.id]);

  useEffect(() => {
    if (typeof selectedNode === 'number' && !dayLogs.some((d) => d.dayNumber === selectedNode)) {
      setSelectedNode(defaultDay);
    }
  }, [dayLogs, defaultDay, selectedNode]);

  // Parse prescribed home medications safely
  const parsedDischargeMeds: PrescribedMedicine[] = useMemo(() => {
    if (!admission.dischargeMedications) return [];
    try {
      const parsed = JSON.parse(admission.dischargeMedications);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [admission.dischargeMedications]);

  // Compare vitals for trend highlights
  const getVitalsTrend = (currentLog: IpdDayLog) => {
    const currentIndex = dayLogs.findIndex((d) => d.dayNumber === currentLog.dayNumber);
    if (currentIndex <= 0) return null;
    const prevLog = dayLogs[currentIndex - 1];
    if (!prevLog?.vitals || !currentLog.vitals) return null;

    const curr = currentLog.vitals;
    const prev = prevLog.vitals;

    const trends: {
      temp?: { diff: number; text: string; improved: boolean };
      pulse?: { diff: number; text: string; improved: boolean };
      spo2?: { diff: number; text: string; improved: boolean };
      bp?: { text: string; improved: boolean };
    } = {};

    // Temp (°F)
    if (curr.temp && prev.temp) {
      const c = parseFloat(curr.temp);
      const p = parseFloat(prev.temp);
      if (!isNaN(c) && !isNaN(p)) {
        const diff = Number((c - p).toFixed(1));
        const improved = c <= 99.0 && (p > 99.0 || diff <= 0);
        trends.temp = {
          diff,
          text: diff < 0 ? `${diff}°F (Cooling / Normalized)` : diff > 0 ? `+${diff}°F` : 'Stable',
          improved,
        };
      }
    }

    // Pulse (bpm)
    if (curr.pulse && prev.pulse) {
      const c = parseInt(curr.pulse, 10);
      const p = parseInt(prev.pulse, 10);
      if (!isNaN(c) && !isNaN(p)) {
        const diff = c - p;
        const improved = c >= 60 && c <= 90 && p > 90;
        trends.pulse = {
          diff,
          text: diff < 0 ? `${diff} bpm (Stabilized)` : diff > 0 ? `+${diff} bpm` : 'Stable',
          improved,
        };
      }
    }

    // SpO2 (%)
    if (curr.spo2 && prev.spo2) {
      const c = parseInt(curr.spo2, 10);
      const p = parseInt(prev.spo2, 10);
      if (!isNaN(c) && !isNaN(p)) {
        const diff = c - p;
        const improved = c >= 95 && p < 95;
        trends.spo2 = {
          diff,
          text: diff > 0 ? `+${diff}% (Recovered)` : diff < 0 ? `${diff}%` : 'Stable',
          improved,
        };
      }
    }

    return trends;
  };

  const activeDayLog = useMemo(() => {
    if (typeof selectedNode === 'number') {
      return dayLogs.find((d) => d.dayNumber === selectedNode) || null;
    }
    return null;
  }, [selectedNode, dayLogs]);

  // Handle WhatsApp Share
  const handleWhatsAppShare = () => {
    const pName = patient?.name || 'Patient';
    const mobile = patient?.mobile;
    if (!mobile) {
      toast('Patient has no mobile number for WhatsApp sharing.', 'error');
      return;
    }
    const cleanMobile = mobile.replace(/\D/g, '');
    const phoneWithCountry = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

    const summaryText = [
      `*INPATIENT (IPD) STATEMENT - HOSPITAL REPORT*`,
      `Patient: ${pName} (${patient?.age ? `${patient.age}y` : ''} / ${patient?.gender || ''})`,
      `Admission No: ${admission.admissionNumber}`,
      `Bed: ${admission.bedOrRoom}`,
      `Admission Date: ${new Date(admission.admissionDate).toLocaleDateString('en-IN')}`,
      admission.dischargeDate ? `Discharge Date: ${new Date(admission.dischargeDate).toLocaleDateString('en-IN')}` : `Status: Currently Admitted (Day ${stayDays})`,
      `Diagnosis: ${admission.diagnosis}`,
      `\n*Financials:*`,
      `• Total Charges: ₹${admission.cumulativeCharges}`,
      `• Advance Paid: ₹${admission.advancePaid}`,
      `• Settled: ₹${admission.totalPaid}`,
      `• Net Due: ₹${admission.balanceDue}`,
    ].join('\n');

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(summaryText)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        transition={{ duration: 0.18 }}
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100dvh',
          background: 'var(--background)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Top Full-Screen Navigation Header ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            borderBottom: '1px solid var(--border)',
            padding: '12px 20px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              ← Back to Wards
            </button>

            <div style={{ height: 22, width: 1, background: 'var(--border)' }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                  {patient?.name || 'Patient'}
                </span>
                <span className="badge badge-purple" style={{ fontWeight: 700 }}>
                  <Bed size={13} style={{ marginRight: 4 }} /> {admission.bedOrRoom}
                </span>
                <span
                  className={`badge ${!isDischarged ? 'badge-green' : 'badge-gray'}`}
                  style={{ fontWeight: 700 }}
                >
                  {!isDischarged ? `🟢 Admitted · Day ${stayDays}` : `⚪ Discharged after ${stayDays} days`}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                IPD #{admission.admissionNumber} · Admitted:{' '}
                {new Date(admission.admissionDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                {admission.diagnosis ? `· Diagnosis: ${admission.diagnosis}` : ''}{' '}
                {admission.attendingDoctor ? `· Dr. ${admission.attendingDoctor}` : ''}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={`/ipd/${admission.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={14} /> Print Statement
            </a>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleWhatsAppShare}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#25D366', color: '#fff', border: 'none' }}
            >
              <Share2 size={14} /> WhatsApp
            </button>

            <button type="button" className="btn-icon" onClick={onClose} title="Close View">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── Running Financial Bar ─── */}
        <div
          style={{
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Hospital Charges:</span>{' '}
              <strong style={{ color: 'var(--text-primary)' }}>₹{admission.cumulativeCharges}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Advance Deposit:</span>{' '}
              <strong style={{ color: 'var(--primary)' }}>₹{admission.advancePaid}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Discount:</span>{' '}
              <strong style={{ color: '#16a34a' }}>-₹{admission.discount}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total Settled:</span>{' '}
              <strong style={{ color: '#16a34a' }}>₹{admission.totalPaid}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Current Balance Due:</span>{' '}
              <strong style={{ color: Number(admission.balanceDue) > 0 ? '#ef4444' : '#16a34a', fontSize: '0.92rem' }}>
                ₹{admission.balanceDue}
              </strong>
            </div>
          </div>

          {/* Quick Bedside Action Buttons */}
          {!isDischarged && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => onOpenDayLog?.(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                <Plus size={13} /> Log Today&apos;s Round
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => onOpenTransfer?.()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <ArrowRightLeft size={13} /> Transfer Bed
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => onOpenAdvance?.()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Banknote size={13} /> + Advance
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => onOpenDischarge?.()}
                style={{ background: '#ef4444', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <CheckCircle2 size={13} /> Settle &amp; Discharge
              </button>
            </div>
          )}
        </div>

        {/* ─── Interactive Multi-Day Timeline Scrubber ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            borderBottom: '1px solid var(--border)',
            padding: '12px 20px',
            flexShrink: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 'max-content' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Stay Timeline:
            </span>

            {/* Node 0: Admission */}
            <button
              type="button"
              onClick={() => setSelectedNode('admission')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 10,
                border: selectedNode === 'admission' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: selectedNode === 'admission' ? 'rgba(13, 148, 136, 0.12)' : 'var(--surface-1)',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                0
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Day 0: Admitted
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {new Date(admission.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            </button>

            {/* Connecting line */}
            <div style={{ width: 18, height: 2, background: 'var(--border)' }} />

            {/* Daily Rounds Nodes */}
            {dayLogs.map((log, idx) => {
              const isSelected = selectedNode === log.dayNumber;
              return (
                <div key={log.dayNumber} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(log.dayNumber)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 14px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'var(--surface-1)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'rgba(13, 148, 136, 0.2)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                      }}
                    >
                      {log.dayNumber}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Day {log.dayNumber} Round
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ₹{log.dailyCharges}
                      </div>
                    </div>
                  </button>

                  <div style={{ width: 18, height: 2, background: 'var(--border)' }} />
                </div>
              );
            })}

            {/* Discharge Node */}
            <button
              type="button"
              onClick={() => setSelectedNode('discharge')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 10,
                border: selectedNode === 'discharge' ? '2px solid #8b5cf6' : '1px solid var(--border)',
                background: selectedNode === 'discharge' ? 'rgba(139, 92, 246, 0.14)' : 'var(--surface-1)',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: isDischarged ? '#10b981' : 'rgba(139, 92, 246, 0.2)',
                  color: isDischarged ? '#fff' : '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                {isDischarged ? '✓' : 'D'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isDischarged ? 'Discharge & Final Bill' : 'Discharge Summary'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {admission.dischargeDate
                    ? new Date(admission.dischargeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : 'Pending Settlement'}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Interactive Journey Content Viewport ─── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--background)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>

            {/* SCENARIO 1: NODE 0 - ADMISSION RECORD */}
            {selectedNode === 'admission' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    background: 'var(--surface-solid)',
                    border: '1.5px solid rgba(13, 148, 136, 0.3)',
                    borderRadius: 14,
                    padding: '18px 22px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <span style={{ background: 'rgba(13, 148, 136, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 800 }}>
                      INPATIENT ADMISSION EVENT
                    </span>
                    <h3 style={{ margin: '6px 0 2px', fontSize: '1.2rem', fontWeight: 800 }}>
                      Patient Admitted on {new Date(admission.admissionDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Assigned Bed: <strong>{admission.bedOrRoom}</strong> · IPD File Number: <strong>{admission.admissionNumber}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Initial Advance Deposit:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                      ₹{admission.advancePaid}
                    </div>
                  </div>
                </div>

                {/* Admission Clinical Picture */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
                  <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem', marginBottom: 12 }}>
                      <Stethoscope size={18} style={{ color: 'var(--primary)' }} />
                      <span>Admission Diagnosis &amp; Clinical Reason</span>
                    </div>
                    <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>
                      {admission.diagnosis || 'General Inpatient Care'}
                    </div>
                    {admission.attendingDoctor && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Attending Physician: <strong>Dr. {admission.attendingDoctor}</strong>
                      </div>
                    )}
                  </div>

                  <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem', marginBottom: 12 }}>
                      <Activity size={18} style={{ color: 'var(--primary)' }} />
                      <span>Care Milestones Ahead</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Patient admitted for inpatient stabilization and therapy. Daily doctor rounds, vital signs charting, and medication orders are documented on subsequent days of stay.
                    </div>
                    {!isDischarged && dayLogs.length === 0 && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onOpenDayLog?.(null)}
                        style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Plus size={14} /> Start Day 1 Doctor Round
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCENARIO 2: SPECIFIC DAY LOG (DAY 1, 2, 3...) */}
            {activeDayLog && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Active Day Header Strip */}
                <div
                  style={{
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '14px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'rgba(13, 148, 136, 0.15)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                      }}
                    >
                      {activeDayLog.dayNumber}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                        Day {activeDayLog.dayNumber} Round &amp; Treatment
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Date: {new Date(activeDayLog.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Day Procedure Charges:</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                        ₹{activeDayLog.dailyCharges}
                      </div>
                    </div>

                    {!isDischarged && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => onOpenDayLog?.(activeDayLog)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Edit2 size={12} /> Edit Round
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => onDeleteDayLog?.(activeDayLog.dayNumber)}
                          style={{ color: '#ef4444' }}
                          title="Delete this round log"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Day-over-Day Vitals Trend & Comparison Strip */}
                {activeDayLog.vitals && Object.values(activeDayLog.vitals).some(Boolean) && (
                  <div
                    style={{
                      background: 'var(--surface-solid)',
                      border: '1.5px solid rgba(13, 148, 136, 0.25)',
                      borderRadius: 14,
                      padding: '16px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem' }}>
                        <HeartPulse size={18} style={{ color: 'var(--primary)' }} />
                        <span>Day {activeDayLog.dayNumber} Vitals &amp; Recovery Trajectory</span>
                      </div>
                      {(() => {
                        const trend = getVitalsTrend(activeDayLog);
                        if (trend) {
                          return (
                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, background: 'rgba(22, 163, 74, 0.1)', padding: '2px 8px', borderRadius: 6 }}>
                              ✓ Compared to Day {activeDayLog.dayNumber - 1} Log
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12 }}>
                      {/* BP */}
                      <div style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Blood Pressure</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 2 }}>{activeDayLog.vitals.bp || '—'}</div>
                      </div>

                      {/* Pulse */}
                      <div style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pulse (bpm)</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 2 }}>{activeDayLog.vitals.pulse || '—'}</div>
                        {(() => {
                          const trend = getVitalsTrend(activeDayLog);
                          if (trend?.pulse) {
                            return (
                              <div style={{ fontSize: '0.7rem', color: trend.pulse.improved ? '#16a34a' : 'var(--text-muted)', marginTop: 2 }}>
                                {trend.pulse.text}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Temp */}
                      <div style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Temperature (°F)</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 2 }}>{activeDayLog.vitals.temp || '—'}</div>
                        {(() => {
                          const trend = getVitalsTrend(activeDayLog);
                          if (trend?.temp) {
                            return (
                              <div style={{ fontSize: '0.7rem', color: trend.temp.improved ? '#16a34a' : 'var(--text-muted)', marginTop: 2 }}>
                                {trend.temp.text}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* SpO2 */}
                      <div style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>SpO2 Oxygen (%)</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 2, color: Number(activeDayLog.vitals.spo2) > 0 && Number(activeDayLog.vitals.spo2) < 95 ? '#ef4444' : undefined }}>
                          {activeDayLog.vitals.spo2 ? `${activeDayLog.vitals.spo2}%` : '—'}
                        </div>
                        {(() => {
                          const trend = getVitalsTrend(activeDayLog);
                          if (trend?.spo2) {
                            return (
                              <div style={{ fontSize: '0.7rem', color: trend.spo2.improved ? '#16a34a' : 'var(--text-muted)', marginTop: 2 }}>
                                {trend.spo2.text}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Resp Rate */}
                      <div style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Resp Rate (/min)</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 2 }}>{activeDayLog.vitals.respRate || '—'}</div>
                      </div>

                      {/* Sugar */}
                      <div style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Blood Sugar (GRBS)</div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 2 }}>{activeDayLog.vitals.sugar || '—'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2-Column Clinical Journey Details */}
                <div className="ipd-rounds-overview-grid">
                  {/* Left Column: Doctor Progress Notes & Nursing */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem', marginBottom: 10 }}>
                        <Stethoscope size={18} style={{ color: 'var(--primary)' }} />
                        <span>Doctor Progress Observations &amp; Round Notes</span>
                      </div>
                      {activeDayLog.doctorNotes ? (
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {activeDayLog.doctorNotes}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No clinical progress observations recorded for this day.
                        </div>
                      )}
                    </div>

                    {(activeDayLog.nursingNotes || activeDayLog.dietNotes) && (
                      <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem', marginBottom: 10 }}>
                          <ClipboardList size={18} style={{ color: 'var(--primary)' }} />
                          <span>Nursing Observations &amp; Diet Orders</span>
                        </div>
                        {activeDayLog.nursingNotes && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                              Nursing Notes:
                            </div>
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {activeDayLog.nursingNotes}
                            </div>
                          </div>
                        )}
                        {activeDayLog.dietNotes && (
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                              Diet &amp; Fluid Orders:
                            </div>
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {activeDayLog.dietNotes}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Medications & Procedures on this day */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Medications Administered */}
                    <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem' }}>
                          <Pill size={18} style={{ color: '#8b5cf6' }} />
                          <span>Medications Administered ({(activeDayLog.medications || []).length})</span>
                        </div>
                      </div>

                      {(!activeDayLog.medications || activeDayLog.medications.length === 0) ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>
                          {activeDayLog.medicinesAdministered
                            ? `Administered: ${activeDayLog.medicinesAdministered}`
                            : 'No specific medications logged for Day ' + activeDayLog.dayNumber}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activeDayLog.medications.map((m, i) => (
                            <div key={i} style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{m.name}</div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{m.dose}</span> · Route: {m.route} · {m.timing}
                                {m.instructions && ` (${m.instructions})`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Procedures & Services Given */}
                    <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem' }}>
                          <Receipt size={18} style={{ color: 'var(--primary)' }} />
                          <span>Procedures &amp; Nursing Services ({(activeDayLog.procedures || []).length})</span>
                        </div>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.94rem' }}>
                          Day Total: ₹{activeDayLog.dailyCharges}
                        </span>
                      </div>

                      {(!activeDayLog.procedures || activeDayLog.procedures.length === 0) ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '14px 0' }}>
                          No procedures or billable nursing services billed for this day.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {activeDayLog.procedures.map((p, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-1)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{p.name}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Qty: {p.quantity} × ₹{p.unitPrice}
                                </div>
                              </div>
                              <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.92rem' }}>
                                ₹{p.totalPrice}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCENARIO 3: DISCHARGE & SETTLEMENT NODE */}
            {selectedNode === 'discharge' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    background: 'var(--surface-solid)',
                    border: isDischarged ? '1.5px solid rgba(16, 185, 129, 0.45)' : '1.5px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: 14,
                    padding: '18px 22px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <span
                      style={{
                        background: isDischarged ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        color: isDischarged ? '#16a34a' : '#8b5cf6',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.74rem',
                        fontWeight: 800,
                      }}
                    >
                      {isDischarged ? 'FINAL DISCHARGE & RECOVERY SETTLEMENT' : 'DISCHARGE INITIATION'}
                    </span>
                    <h3 style={{ margin: '6px 0 2px', fontSize: '1.2rem', fontWeight: 800 }}>
                      {isDischarged
                        ? `Patient Discharged on ${new Date(admission.dischargeDate!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
                        : 'Patient is Currently Admitted'}
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Total Hospital Stay: <strong>{stayDays} Days</strong> · Doctor Rounds Conducted: <strong>{dayLogs.length} Rounds</strong>
                    </div>
                  </div>

                  {!isDischarged && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onOpenDischarge?.()}
                      style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <CheckCircle2 size={16} /> Finalize Discharge &amp; Settle Bill
                    </button>
                  )}
                </div>

                {/* Final Bill Breakdown Card */}
                <div
                  style={{
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '16px 20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 12,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Running Charges</div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)', marginTop: 2 }}>
                      ₹{admission.cumulativeCharges}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Advance Deposit</div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--primary)', marginTop: 2 }}>
                      ₹{admission.advancePaid}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discount Given</div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#16a34a', marginTop: 2 }}>
                      -₹{admission.discount}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Settled</div>
                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#16a34a', marginTop: 2 }}>
                      ₹{admission.totalPaid}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: '1.15rem',
                        color: Number(admission.balanceDue) > 0 ? '#ef4444' : '#16a34a',
                        marginTop: 2,
                      }}
                    >
                      ₹{admission.balanceDue}
                    </div>
                  </div>
                </div>

                {/* Discharge Summary & Prescribed Home Medications */}
                {isDischarged && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
                    {/* Clinical Summary */}
                    <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem', marginBottom: 12 }}>
                        <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                        <span>Hospital Course &amp; Recovery Summary</span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {admission.dischargeSummary || 'Patient satisfactorily recovered and discharged in stable hemodynamic condition.'}
                      </div>

                      {admission.dischargeNotes && (
                        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Follow-Up Instructions:
                          </div>
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {admission.dischargeNotes}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prescribed Take-Home Medications */}
                    <div className="card" style={{ padding: '16px 20px', background: 'var(--surface-solid)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.94rem', marginBottom: 12 }}>
                        <Pill size={18} style={{ color: '#8b5cf6' }} />
                        <span>Prescribed Discharge / Home Medications ({parsedDischargeMeds.length})</span>
                      </div>

                      {parsedDischargeMeds.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                          No take-home medications documented on discharge slip.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {parsedDischargeMeds.map((med, idx) => (
                            <div key={idx} style={{ background: 'var(--surface-1)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{med.name}</div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{med.dose}</span> · Duration: {med.duration}
                                {med.instructions && ` · ${med.instructions}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </div>
        </div>

        {/* ─── Bottom Actions Bar ─── */}
        <div
          style={{
            background: 'var(--surface-solid)',
            borderTop: '1px solid var(--border)',
            padding: '12px 20px',
            paddingLeft: '68px', // Clearance for bottom-left floating widget/badge
            paddingRight: '80px', // Clearance for bottom-right floating assistant/FAB
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Patient Encounter: <strong style={{ color: 'var(--text-primary)' }}>{admission.admissionNumber}</strong> ·{' '}
            {admission.diagnosis || 'Inpatient Care'}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDeleteAdmission?.()}
              style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Delete Admission"
            >
              <Trash2 size={13} /> Delete Record
            </button>

            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
