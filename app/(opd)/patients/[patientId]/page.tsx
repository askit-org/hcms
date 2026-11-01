'use client';

import { useEffect, useState, useMemo } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Stethoscope, Phone, MapPin, Briefcase, Calendar,
  Plus, Eye, Printer, Trash2, Activity, ClipboardList, MessageCircle, Edit2, Save, X, UserPlus, HeartPulse, Receipt, CheckCircle2, Bed, Pill, AlertCircle, Building, Clock, Sparkles, ChevronDown, ChevronUp, FileText
} from 'lucide-react';
import { usePatient, usePatientVisits, useIpdAdmissions, useIpdMutations, usePatientMutations, useVisitMutations, useSettings } from '@/lib/hooks/useQueries';
import type { Visit, Patient, IpdAdmission, IpdDayLog, PrescribedMedicine } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { jsPDF } from 'jspdf';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import { DoseDisplay } from '@/components/DoseSelector';
import ConfirmModal from '@/components/ConfirmModal';
import CreateBillModal from '@/components/CreateBillModal';
import MultiDayBillModal from '@/components/MultiDayBillModal';
import RecordPaymentModal from '@/components/RecordPaymentModal';
import IpdDayLogModal from '@/components/IpdDayLogModal';
import IpdPatientJourneyModal from '@/components/IpdPatientJourneyModal';

const COMMON_CONDITIONS = [
  'Hypertension (BP)',
  'Diabetes (Sugar)',
  'Asthma',
  'Thyroid',
  'Heart Disease',
  'Allergies',
];

export default function PatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  
  const { data: patient, isLoading: patientLoading } = usePatient(patientId);
  const resolvedPatientId = patient?.patientId || (patient?.id ? String(patient.id) : patientId);
  const { data: visits = [], isLoading: visitsLoading, refetch: refetchVisits } = usePatientVisits(patientId);
  const { data: ipdAdmissions = [], isLoading: ipdLoading, refetch: refetchIpd } = useIpdAdmissions({ patientId: resolvedPatientId });

  // Whenever patient details load, ensure fresh inpatient admissions & visits are fetched
  useEffect(() => {
    if (patient) {
      refetchIpd();
      refetchVisits();
    }
  }, [patient?.id, patient?.patientId, refetchIpd, refetchVisits]);
  const { data: settings } = useSettings();
  const { remove: removePatient, update: updatePatientMut } = usePatientMutations();
  const { update: updateVisit, remove: removeVisit } = useVisitMutations();
  const { deleteAdmission, deleteDayLog } = useIpdMutations();

  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [billingVisit, setBillingVisit] = useState<Visit | null>(null);
  const [showMultiDayBill, setShowMultiDayBill] = useState(false);
  const [activePaymentModal, setActivePaymentModal] = useState<{
    billId: string;
    billNumber: string;
    balanceDue: number;
    totalAmount?: number;
    paidAmount?: number;
  } | null>(null);
  const [tab, setTab] = useState<'overview' | 'visits'>('overview');
  const [visitFilter, setVisitFilter] = useState<'OPD' | 'IPD'>('OPD');
  const [selectedIpdForRounds, setSelectedIpdForRounds] = useState<IpdAdmission | null>(null);
  const [selectedDayLogToEdit, setSelectedDayLogToEdit] = useState<IpdDayLog | null>(null);
  const [showDayLogModal, setShowDayLogModal] = useState(false);
  const [selectedJourneyAdmission, setSelectedJourneyAdmission] = useState<IpdAdmission | null>(null);
  const [expandedIpdIds, setExpandedIpdIds] = useState<Set<string>>(new Set());

  // Active or most recent discharged IPD admissions
  const activeAdmission = useMemo(() => {
    return ipdAdmissions.find((a) => a.status === 'ADMITTED') || null;
  }, [ipdAdmissions]);

  const lastDischargedAdmission = useMemo(() => {
    if (activeAdmission) return null;
    return ipdAdmissions.filter((a) => a.status === 'DISCHARGED')[0] || null;
  }, [ipdAdmissions, activeAdmission]);

  const opdVisits = useMemo(() => visits.filter((v) => (v.category || 'OPD').trim().toUpperCase() !== 'IPD'), [visits]);

  // Automatically show IPD Stays tab if patient has inpatient stays but no OPD visits
  useEffect(() => {
    if (opdVisits.length === 0 && ipdAdmissions.length > 0) {
      setVisitFilter('IPD');
    }
  }, [opdVisits.length, ipdAdmissions.length]);

  // Auto-expand active admissions so live rounds are visible immediately
  useEffect(() => {
    if (ipdAdmissions && ipdAdmissions.length > 0) {
      setExpandedIpdIds((prev) => {
        const next = new Set(prev);
        ipdAdmissions.forEach((adm) => {
          if (adm.status === 'ADMITTED') {
            next.add(adm.id);
          }
        });
        if (ipdAdmissions.length === 1 && next.size === 0) {
          next.add(ipdAdmissions[0].id);
        }
        return next;
      });
    }
  }, [ipdAdmissions]);

  const toggleExpandIpd = (admissionId: string) => {
    setExpandedIpdIds((prev) => {
      const next = new Set(prev);
      if (next.has(admissionId)) {
        next.delete(admissionId);
      } else {
        next.add(admissionId);
      }
      return next;
    });
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    age: '',
    dob: '',
    gender: 'Male',
    mobile: '',
    relation: 'Self',
    guardianName: '',
    address: '',
    occupation: '',
    abhaNumber: ''
  });
  const [editConditions, setEditConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState('');

  const addCustomCondition = () => {
    const trimmed = customCondition.trim();
    if (!trimmed) return;
    if (!editConditions.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setEditConditions(prev => [...prev, trimmed]);
    }
    setCustomCondition('');
  };

  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    variant: "danger",
    onConfirm: async () => {},
  });

  useEffect(() => {
    if (patient) {
      setEditForm({
        name: patient.name || '',
        age: patient.age ? String(patient.age) : '',
        dob: patient.dob || '',
        gender: patient.gender || 'Male',
        mobile: patient.mobile || '',
        relation: patient.relation || 'Self',
        guardianName: patient.guardianName || '',
        address: patient.address || '',
        occupation: patient.occupation || '',
        abhaNumber: patient.abhaNumber || ''
      });
      setEditConditions(patient.permanentConditions || []);
    }
  }, [patient]);

  const handleUpdatePatient = async () => {
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
        id: patient!.patientId,
        input: {
          name: editForm.name.trim(),
          age: editForm.age ? parseInt(editForm.age) : undefined,
          dob: editForm.dob || undefined,
          gender: editForm.gender,
          mobile: editForm.mobile.trim(),
          relation: editForm.relation,
          guardianName: editForm.relation !== 'Self' ? editForm.guardianName.trim() : undefined,
          address: editForm.address.trim() || undefined,
          occupation: editForm.occupation.trim() || undefined,
          abhaNumber: editForm.abhaNumber.trim() || undefined,
          permanentConditions: editConditions,
        }
      });
      toast('Patient details updated successfully!', 'success');
      setIsEditing(false);
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to update patient.'), 'error');
    }
  };

  const deletePatient = () => {
    if (!patient) return;
    setConfirmModalState({
      isOpen: true,
      title: "Delete Patient",
      description: `Are you sure you want to delete patient ${patient.name}? The patient and their visits will be hidden, and can be restored later from "Recently deleted" on the Patients page.`,
      confirmText: "Delete Patient",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        await removePatient.mutateAsync(patient.patientId);
        toast('Patient moved to Recently deleted.', 'info');
        router.push('/patients');
      },
    });
  };

  const handleDeleteVisit = (v: Visit) => {
    if (!v.id) return;
    setConfirmModalState({
      isOpen: true,
      title: "Delete OPD Visit",
      description: `Are you sure you want to delete the OPD visit on ${new Date(v.date).toLocaleDateString('en-IN')}? This action cannot be undone.`,
      confirmText: "Delete Visit",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        await removeVisit.mutateAsync(v.id!);
        toast('OPD Visit deleted successfully.', 'info');
      },
    });
  };

  const loading = patientLoading || visitsLoading;

  if (loading) return <LoadingScreen message="Loading patient details..." />;
  if (!patient) return (
    <ErrorState title="Patient Not Found" message="The requested patient ID does not exist in the system." />
  );

  const age = patient.age || (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : null);
  const lastVisit = visits[0];

  const containerAnimations = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemAnimations = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  const handleSharePDF = (v: Visit) => {
    if (v.id) {
      router.push(`/visits/${v.id}/print`);
    }
  };

  return (
    <PageTransition>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <Link href="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 12 }}>
          <ChevronLeft size={15} /> Back to Patients
        </Link>
      </div>
      <div className="page-header" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--accent-glow)', color: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.4rem', flexShrink: 0,
          }}>
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="page-title">{patient.name}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{patient.gender}</span>
              {age && <span className="badge">{age} yrs</span>}
              {lastVisit && <span className="text-muted text-sm">Last visit: {new Date(lastVisit.date).toLocaleDateString('en-IN')}</span>}
            </div>
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          {visits.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMultiDayBill(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Receipt size={14} /> Multi-Day Bill
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <><X size={14} /> Cancel</> : <><Edit2 size={14} /> Edit Patient</>}
          </button>
          <Link href={`/visits/new?patientId=${patientId}`} className="btn btn-primary"><Stethoscope size={15} /> New Visit</Link>
          <button className="btn btn-danger btn-sm" onClick={deletePatient}><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Dynamic Inpatient (IPD) Status Banner */}
      {activeAdmission && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(59, 130, 246, 0.05) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 4px 15px -3px rgba(16, 185, 129, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: '#10b981',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bed size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  Currently Admitted Inpatient
                </span>
                <span
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}
                >
                  {activeAdmission.bedOrRoom}
                </span>
                <span
                  style={{
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: 'var(--blue)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 8,
                  }}
                >
                  Day {Math.max(1, Math.ceil((Date.now() - new Date(activeAdmission.admissionDate).getTime()) / (1000 * 60 * 60 * 24)))} of stay
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Admitted: <strong>{new Date(activeAdmission.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                {activeAdmission.attendingDoctor ? ` · Attending: Dr. ${activeAdmission.attendingDoctor}` : ''}
                {activeAdmission.diagnosis ? ` · Dx: ${activeAdmission.diagnosis}` : ''}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Running Charges: <strong>₹{activeAdmission.cumulativeCharges}</strong> · Deposit: <strong style={{ color: '#10b981' }}>₹{activeAdmission.totalPaid}</strong> · Due: <strong style={{ color: Number(activeAdmission.balanceDue) > 0 ? '#ef4444' : '#10b981' }}>₹{activeAdmission.balanceDue}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedJourneyAdmission(activeAdmission)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
            >
              <Sparkles size={14} /> Bedside Journey
            </button>
            <Link
              href={`/ipd/${activeAdmission.id}`}
              className="btn btn-primary btn-sm"
              title="Open Inpatient Bedside Case Sheet"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Bed size={14} /> Open Bedside Sheet →
            </Link>
            <Link href="/ipd" className="btn btn-ghost btn-sm" title="Open Ward Floor Plan">
              Ward View →
            </Link>
          </div>
        </div>
      )}

      {!activeAdmission && lastDischargedAdmission && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Bed size={17} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                  Discharged Inpatient Stay: {lastDischargedAdmission.bedOrRoom}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 6,
                    background: 'var(--surface-2)',
                    color: 'var(--text-muted)',
                  }}
                >
                  DISCHARGED
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Stay: {new Date(lastDischargedAdmission.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {new Date(lastDischargedAdmission.dischargeDate!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {lastDischargedAdmission.diagnosis ? ` · Dx: ${lastDischargedAdmission.diagnosis}` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => setSelectedJourneyAdmission(lastDischargedAdmission)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
            >
              <Sparkles size={13} /> View Stay Journey
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setTab('visits');
                setVisitFilter('IPD');
                setExpandedIpdIds((prev) => new Set(prev).add(lastDischargedAdmission.id));
              }}
            >
              Summary &amp; Rx →
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={() => router.push(`/ipd/${lastDischargedAdmission.id}/print`)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Printer size={13} /> Print Discharge Sheet
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab-btn ${tab === 'visits' ? 'active' : ''}`} onClick={() => setTab('visits')}>
          Visit History ({opdVisits.length + ipdAdmissions.length})
        </button>
      </div>

      {tab === 'overview' && (
        <div className="form-grid-2">
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Patient Information</span>
              {isEditing && (
                <button className="btn btn-primary btn-sm" onClick={handleUpdatePatient} disabled={updatePatientMut.isPending}>
                  <Save size={14} /> Save Changes
                </button>
              )}
            </div>

            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label">Relation</label>
                    <select className="form-select" value={editForm.relation} onChange={e => {
                      setEditForm(f => ({ ...f, relation: e.target.value }));
                      if (e.target.value === 'Self') setEditForm(f => ({ ...f, guardianName: '' }));
                    }}>
                      <option value="Self">Self</option>
                      <option value="Parent">Parent</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {editForm.relation !== 'Self' && (
                    <div>
                      <label className="form-label">Guardian Name <span className="required">*</span></label>
                      <input className="form-input" placeholder="Guardian's name" value={editForm.guardianName} onChange={e => setEditForm(f => ({ ...f, guardianName: e.target.value }))} />
                    </div>
                  )}
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
                <div style={{ marginTop: 4 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HeartPulse size={15} style={{ color: 'var(--amber)' }} />
                    Permanent Medical Conditions & Chronic Diseases
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {COMMON_CONDITIONS.map(cond => {
                      const active = editConditions.includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => {
                            setEditConditions(prev =>
                              prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
                            );
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: active ? 'var(--accent-glow)' : 'var(--surface-1)',
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {active ? '✓ ' : '+ '}{cond}
                        </button>
                      );
                    })}

                    {/* Any custom conditions already in editConditions */}
                    {editConditions
                      .filter(c => !COMMON_CONDITIONS.includes(c))
                      .map(cond => (
                        <span
                          key={cond}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            border: '1px solid var(--accent)',
                            background: 'var(--accent-glow)',
                            color: 'var(--accent)',
                          }}
                        >
                          ✓ {cond}
                          <button
                            type="button"
                            onClick={() => setEditConditions(prev => prev.filter(c => c !== cond))}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                  </div>

                  {/* Add custom condition input */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, maxWidth: 440 }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                      placeholder="Add other condition or allergy…"
                      value={customCondition}
                      onChange={e => setCustomCondition(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomCondition();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={addCustomCondition}
                      disabled={!customCondition.trim()}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {[
                  { icon: <Phone size={15} />, label: 'Mobile', value: `${patient.mobile} ${patient.relation !== 'Self' ? `(${patient.relation})` : ''}` },
                  ...(patient.relation !== 'Self' && patient.guardianName ? [{ icon: <UserPlus size={15} />, label: 'Guardian', value: patient.guardianName }] : []),
                  { icon: <ClipboardList size={15} />, label: 'ABHA No.', value: patient.abhaNumber || '—' },
                  { icon: <MapPin size={15} />, label: 'Address', value: patient.address || '—' },
                  { icon: <Briefcase size={15} />, label: 'Occupation', value: patient.occupation || '—' },
                  { icon: <Calendar size={15} />, label: 'DOB', value: patient.dob ? new Date(patient.dob).toLocaleDateString('en-IN') : '—' },
                  { icon: <Activity size={15} />, label: 'Registered', value: new Date(patient.createdAt).toLocaleDateString('en-IN') },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.icon}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', minWidth: 80 }}>{item.label}</span>
                    <span style={{ fontWeight: 500 }}>{item.value}</span>
                  </div>
                ))}

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-muted)',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <HeartPulse size={16} style={{ color: 'var(--amber)' }} />
                    Permanent Medical Conditions & Chronic Diseases
                  </div>
                  {patient.permanentConditions && patient.permanentConditions.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {patient.permanentConditions.map(cond => (
                        <span
                          key={cond}
                          className="badge badge-amber"
                          style={{
                            fontSize: '0.82rem',
                            padding: '5px 12px',
                            fontWeight: 600,
                            borderRadius: 16,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                        >
                          <Activity size={13} /> {cond}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-1)',
                      border: '1px dashed var(--border)',
                      borderRadius: 8,
                      padding: '10px 14px',
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                        No permanent medical conditions or chronic diseases recorded
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.78rem', color: 'var(--accent)' }}
                        onClick={() => setIsEditing(true)}
                      >
                        + Add Conditions
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Visit Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {[
                { label: 'OPD Visits', value: opdVisits.length, color: 'var(--accent-light)', action: () => { setTab('visits'); setVisitFilter('OPD'); } },
                { label: 'IPD Inpatient Stays', value: ipdAdmissions.length, color: '#8b5cf6', action: () => { setTab('visits'); setVisitFilter('IPD'); } },
                { label: 'Last Diagnosis', value: lastVisit?.diagnosis || (activeAdmission?.diagnosis) || '—', color: 'var(--text-primary)' },
                { label: 'Follow-up Pending', value: visits.filter(v => v.followUpDate && !v.followUpAttended).length, color: 'var(--amber)' },
              ].map(s => (
                <div
                  key={s.label}
                  style={{
                    background: 'var(--surface-1)',
                    borderRadius: 8,
                    padding: '14px',
                    border: '1px solid var(--border)',
                    cursor: s.action ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={s.action}
                  title={s.action ? `Click to view ${s.label}` : undefined}
                >
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: s.color, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'visits' && (
        <motion.div variants={containerAnimations} initial="hidden" animate="show">
          {/* Sub-filter tab switcher & primary actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {/* Two Dedicated Tabs: OPD vs IPD only */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface-2)',
                padding: 4,
                borderRadius: 10,
                border: '1px solid var(--border)',
                gap: 4,
                maxWidth: '100%',
              }}
            >
              <button
                type="button"
                className={`btn btn-sm ${visitFilter === 'OPD' ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: visitFilter === 'OPD' ? 700 : 500,
                  padding: '6px 14px',
                }}
                onClick={() => setVisitFilter('OPD')}
              >
                <Stethoscope size={15} />
                <span>OPD Consultations</span>
                <span
                  style={{
                    background: visitFilter === 'OPD' ? 'rgba(255, 255, 255, 0.25)' : 'var(--surface-3)',
                    color: visitFilter === 'OPD' ? '#fff' : 'var(--text-secondary)',
                    padding: '1px 7px',
                    borderRadius: 10,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {opdVisits.length}
                </span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${visitFilter === 'IPD' ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: visitFilter === 'IPD' ? 700 : 500,
                  padding: '6px 14px',
                  ...(visitFilter === 'IPD' ? { background: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' } : {}),
                }}
                onClick={() => setVisitFilter('IPD')}
              >
                <Bed size={15} />
                <span>IPD Inpatient Stays</span>
                <span
                  style={{
                    background: visitFilter === 'IPD' ? 'rgba(255, 255, 255, 0.25)' : 'var(--surface-3)',
                    color: visitFilter === 'IPD' ? '#fff' : 'var(--text-secondary)',
                    padding: '1px 7px',
                    borderRadius: 10,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {ipdAdmissions.length}
                </span>
              </button>
            </div>

            {/* Quick Action Button for the Selected Tab */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {visitFilter === 'OPD' ? (
                <Link
                  href={`/visits/new?patientId=${patientId}`}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} /> + New OPD Visit
                </Link>
              ) : (
                <Link
                  href={`/visits/new?patientId=${patientId}&category=IPD`}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#8b5cf6',
                    borderColor: '#8b5cf6',
                  }}
                >
                  <Plus size={15} /> + Admit Patient to IPD
                </Link>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: OPD CONSULTATIONS VIEW                                      */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {visitFilter === 'OPD' && (
            <div>
              {opdVisits.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 16px' }}>
                  <Stethoscope size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <h4>No OPD Consultations Recorded</h4>
                  <p>This patient has no recorded outpatient consultations yet.</p>
                  <div style={{ marginTop: 14 }}>
                    <Link href={`/visits/new?patientId=${patientId}`} className="btn btn-primary btn-sm">
                      <Plus size={15} /> Start First OPD Consultation
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {opdVisits.map((v) => {
                    const isCardOpen = activeVisit?.id === v.id;
                    const isToday = new Date(v.date).toDateString() === new Date().toDateString();
                    const hasDues = v.bill && Number(v.bill.balanceDue) > 0;

                    return (
                      <motion.div
                        variants={itemAnimations}
                        key={`opd-${v.id}`}
                        className="card card-sm"
                        style={{ cursor: 'pointer', transition: 'all 0.18s ease' }}
                        onClick={() => setActiveVisit(isCardOpen ? null : v)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>
                              {new Date(v.date).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                              {isToday && <span className="badge badge-green" style={{ marginLeft: 8 }}>Today</span>}
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className="badge badge-blue" style={{ fontWeight: 700 }}>
                                OPD
                              </span>
                              {v.bill ? (
                                hasDues ? (
                                  Number(v.bill.paidAmount) > 0 ? (
                                    <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <Receipt size={11} /> Paid ₹{v.bill.paidAmount} · Due ₹{v.bill.balanceDue}
                                    </span>
                                  ) : (
                                    <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <Receipt size={11} /> Due ₹{v.bill.balanceDue}
                                    </span>
                                  )
                                ) : (
                                  <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <CheckCircle2 size={11} /> Paid (₹{v.bill.totalAmount})
                                  </span>
                                )
                              ) : (
                                <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Receipt size={11} /> Unbilled
                                </span>
                              )}

                              {v.diagnosis && (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                  Dx: <strong>{v.diagnosis}</strong>
                                </span>
                              )}

                              {v.followUpDate && (
                                <span className={`badge ${v.followUpAttended ? 'badge-green' : 'badge-amber'}`}>
                                  F/U: {new Date(v.followUpDate).toLocaleDateString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {v.bp && <span className="badge badge-red">BP: {v.bp}</span>}
                            {v.pulse && <span className="badge badge-blue">P: {v.pulse}</span>}
                            {v.temp && <span className="badge badge-amber">T: {v.temp}°F</span>}
                            {v.spo2 && <span className="badge badge-green">SpO2: {v.spo2}%</span>}
                          </div>
                        </div>

                        {/* Expandable OPD Consultation Clinical Details */}
                        {isCardOpen && (
                          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
                              {[
                                { l: 'Chief Complaints', v: v.chiefComplaints },
                                { l: 'Diagnosis', v: v.diagnosis },
                                { l: 'Treatment', v: v.treatment ? `${v.treatment}${v.hideTreatmentInRx ? ' (Hidden on Rx)' : ''}` : '' },
                                { l: 'BP', v: v.bp },
                                { l: 'Pulse', v: v.pulse },
                                { l: 'Temp', v: v.temp },
                                { l: 'SpO₂', v: v.spo2 },
                              ]
                                .filter((i) => i.v)
                                .map((item) => (
                                  <div key={item.l}>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      {item.l}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginTop: 2 }}>{item.v}</div>
                                  </div>
                                ))}
                            </div>

                            {v.medicines && v.medicines.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                                  Prescription ({v.medicines.length} medicines)
                                </div>
                                {v.medicines.map((m, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      fontSize: '0.84rem',
                                      padding: '6px 0',
                                      borderBottom: '1px dashed var(--border-light)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 2,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div>
                                        <span style={{ color: 'var(--accent-light)', fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>
                                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                                      </div>
                                      <span style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: '0.8rem' }}>
                                        <DoseDisplay dose={m.dose} /> · {m.duration}
                                      </span>
                                    </div>
                                    {m.instructions && (
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic', paddingLeft: 20 }}>
                                        👉 {m.instructions}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {v.prescriptionNotes && (
                              <div style={{ marginTop: 10, background: 'var(--surface-1)', borderRadius: 8, padding: '10px', fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                <strong>Notes:</strong> {v.prescriptionNotes}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                              {hasDues && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => {
                                    setActivePaymentModal({
                                      billId: v.bill!.id,
                                      billNumber: v.bill!.billNumber,
                                      balanceDue: Number(v.bill!.balanceDue),
                                      totalAmount: Number(v.bill!.totalAmount),
                                      paidAmount: Number(v.bill!.paidAmount),
                                    });
                                  }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                  <Receipt size={14} /> Collect Due (₹{v.bill!.balanceDue})
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setBillingVisit(v)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              >
                                <Receipt size={14} /> {v.billingStatus === 'BILLED' || v.bill ? 'Full Bill / Edit' : 'Generate Bill'}
                              </button>
                              <Link href={`/visits/${v.id}/print`} className="btn btn-secondary btn-sm">
                                <Printer size={14} /> Print / Share Rx
                              </Link>
                              <Link href={`/visits/${v.id}/edit`} className="btn btn-primary btn-sm">
                                <Edit2 size={14} /> Edit Visit
                              </Link>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--red)' }}
                                onClick={() => handleDeleteVisit(v)}
                              >
                                <Trash2 size={14} /> Delete Visit
                              </button>
                              {v.followUpDate && !v.followUpAttended && (
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={async () => {
                                    if (v.id) {
                                      await updateVisit.mutateAsync({ id: v.id, input: { followUpAttended: true } });
                                      toast('Follow-up marked as attended.', 'success');
                                      setActiveVisit({ ...v, followUpAttended: true });
                                    }
                                  }}
                                >
                                  Mark Follow-up Done
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: IPD INPATIENT STAYS VIEW (Parent Episode + Day-wise Tree)    */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {visitFilter === 'IPD' && (
            <div>
              {ipdAdmissions.length === 0 ? (
                <div className="empty-state" style={{ padding: '48px 16px' }}>
                  <Bed size={40} style={{ color: '#8b5cf6', margin: '0 auto 12px' }} />
                  <h4>No Inpatient Stays Recorded</h4>
                  <p>This patient has never been admitted to an inpatient hospital ward.</p>
                  <div style={{ marginTop: 14 }}>
                    <Link
                      href={`/visits/new?patientId=${patientId}&category=IPD`}
                      className="btn btn-primary btn-sm"
                      style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}
                    >
                      <Plus size={15} /> Admit Patient to IPD Ward
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {ipdAdmissions.map((adm) => {
                    const isAdmitted = adm.status === 'ADMITTED';
                    const isExpanded = expandedIpdIds.has(adm.id);
                    const stayDays = isAdmitted
                      ? Math.max(1, Math.ceil((new Date().getTime() - new Date(adm.admissionDate).getTime()) / (1000 * 60 * 60 * 24)))
                      : Math.max(1, Math.ceil((new Date(adm.dischargeDate || adm.updatedAt || adm.admissionDate).getTime() - new Date(adm.admissionDate).getTime()) / (1000 * 60 * 60 * 24)));
                    const hasBalanceDue = Number(adm.balanceDue) > 0;

                    return (
                      <motion.div
                        variants={itemAnimations}
                        key={`ipd-${adm.id}`}
                        className="card"
                        style={{
                          background: 'var(--surface-solid)',
                          borderRadius: 14,
                          border: isAdmitted ? '1.5px solid rgba(139, 92, 246, 0.45)' : '1px solid var(--border)',
                          padding: '18px 20px',
                          transition: 'all 0.2s ease',
                          boxShadow: isAdmitted ? '0 4px 16px rgba(139, 92, 246, 0.08)' : 'none',
                        }}
                      >
                        {/* ── Parent Header Row ── */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
                                {adm.admissionNumber}
                              </span>
                              <span
                                style={{
                                  background: isAdmitted ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-2)',
                                  color: isAdmitted ? '#10b981' : 'var(--text-muted)',
                                  border: isAdmitted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border)',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                }}
                              >
                                {isAdmitted ? `🟢 Currently Admitted · Day ${stayDays} of Stay` : `⚪ Discharged (${stayDays}-Day Stay)`}
                              </span>
                              <span
                                style={{
                                  background: 'rgba(139, 92, 246, 0.15)',
                                  color: '#8b5cf6',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Bed size={13} /> {adm.bedOrRoom}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 5 }}>
                              Admitted: <strong>{new Date(adm.admissionDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                              {adm.dischargeDate && (
                                <> · Discharged: <strong>{new Date(adm.dischargeDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></>
                              )}
                              {adm.attendingDoctor && <> · Dr. {adm.attendingDoctor}</>}
                            </div>

                            {adm.diagnosis && (
                              <div style={{ fontSize: '0.84rem', marginTop: 4 }}>
                                <strong style={{ color: 'var(--text-muted)' }}>Diagnosis: </strong>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{adm.diagnosis}</span>
                              </div>
                            )}
                          </div>

                          {/* Financial Summary Box */}
                          <div
                            style={{
                              background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              borderRadius: 10,
                              padding: '8px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 16,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Charges</div>
                              <div style={{ fontWeight: 800, fontSize: '0.96rem' }}>₹{adm.cumulativeCharges}</div>
                            </div>
                            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Advance Paid</div>
                              <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#10b981' }}>₹{adm.totalPaid}</div>
                            </div>
                            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</div>
                              <div style={{ fontWeight: 800, fontSize: '0.96rem', color: hasBalanceDue ? '#ef4444' : '#10b981' }}>
                                {hasBalanceDue ? `₹${adm.balanceDue}` : 'Settled'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── Parent Action Toolbar & Expand/Collapse Toggle ── */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                            borderTop: '1px solid var(--border)',
                            paddingTop: 12,
                            marginTop: 14,
                          }}
                        >
                          {/* Left: Little Arrow Expand / Collapse Button */}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleExpandIpd(adm.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            <span>
                              {isExpanded ? 'Collapse Day Records' : `View Day-by-Day Rounds (${adm.dayWiseLogs?.length || 0} Days)`}
                            </span>
                          </button>

                          {/* Right: Stay Journey, Rounds, Discharge, Print */}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedJourneyAdmission(adm)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)' }}
                              title="Open Bedside Interactive Stay Journey"
                            >
                              <Sparkles size={14} /> Stay Journey
                            </button>

                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => router.push(`/ipd/${adm.id}`)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              title="Open Bedside Case Sheet & Inpatient Journey"
                            >
                              <Bed size={14} /> Open Bedside Sheet
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => router.push(`/ipd/${adm.id}/print`)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              title="Print Statement / Summary"
                            >
                              <Printer size={14} /> Print IPD File
                            </button>
                          </div>
                        </div>

                        {/* ── Expanded Day-wise Child Records (The Day-by-Day Timeline) ── */}
                        {isExpanded && (
                          <div style={{ marginTop: 16, borderTop: '1px dashed var(--border)', paddingTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Calendar size={16} style={{ color: 'var(--primary)' }} />
                                <span>Inpatient Daily Clinical Timeline &amp; Doctor Rounds</span>
                                <span className="badge badge-teal" style={{ fontSize: '0.72rem' }}>
                                  {adm.dayWiseLogs?.length || 0} Recorded Days
                                </span>
                              </div>

                              {isAdmitted && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => {
                                    setSelectedIpdForRounds(adm);
                                    setSelectedDayLogToEdit(null);
                                    setShowDayLogModal(true);
                                  }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#10b981', borderColor: '#10b981' }}
                                >
                                  <Plus size={13} /> + Chart Day {(adm.dayWiseLogs?.length || 0) + 1} Doctor Round
                                </button>
                              )}
                            </div>

                            {/* Chronological Day Logs */}
                            {(!adm.dayWiseLogs || adm.dayWiseLogs.length === 0) ? (
                              <div
                                style={{
                                  padding: '24px 16px',
                                  textAlign: 'center',
                                  background: 'var(--surface-1)',
                                  borderRadius: 10,
                                  border: '1px dashed var(--border)',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.84rem',
                                }}
                              >
                                No daily treatment rounds recorded for this hospital stay yet.
                                {isAdmitted && (
                                  <div style={{ marginTop: 10 }}>
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() => {
                                        setSelectedIpdForRounds(adm);
                                        setSelectedDayLogToEdit(null);
                                        setShowDayLogModal(true);
                                      }}
                                      style={{ background: '#10b981', borderColor: '#10b981' }}
                                    >
                                      <Plus size={14} /> Chart Day 1 Doctor Round
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {adm.dayWiseLogs.map((log) => {
                                  const vitals = log.vitals || {};
                                  const hasVitals = Boolean(vitals.bp || vitals.pulse || vitals.temp || vitals.spo2 || vitals.respRate || vitals.sugar);
                                  const isLowSpo2 = Number(vitals.spo2) > 0 && Number(vitals.spo2) < 95;
                                  const isHighTemp = Number(vitals.temp) >= 100.4;

                                  return (
                                    <div
                                      key={log.dayNumber}
                                      style={{
                                        background: 'var(--surface-1)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 10,
                                        padding: '12px 14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                      }}
                                    >
                                      {/* Day Header Row */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                          <span
                                            style={{
                                              background: 'rgba(13, 148, 136, 0.15)',
                                              color: 'var(--primary)',
                                              padding: '3px 9px',
                                              borderRadius: 6,
                                              fontWeight: 800,
                                              fontSize: '0.8rem',
                                            }}
                                          >
                                            Day {log.dayNumber}
                                          </span>
                                          <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                                            {new Date(log.date).toLocaleDateString('en-IN', {
                                              weekday: 'short',
                                              day: 'numeric',
                                              month: 'short',
                                              year: 'numeric',
                                            })}
                                          </span>
                                          {Boolean(log.dailyCharges) && (
                                            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                              Day Charges: <strong style={{ color: 'var(--primary)' }}>₹{log.dailyCharges}</strong>
                                            </span>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs"
                                          onClick={() => {
                                            setSelectedIpdForRounds(adm);
                                            setSelectedDayLogToEdit(log);
                                            setShowDayLogModal(true);
                                          }}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                        >
                                          <Edit2 size={12} /> Edit Day {log.dayNumber}
                                        </button>
                                      </div>

                                      {/* Vitals Matrix */}
                                      {hasVitals && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                          {vitals.bp && (
                                            <span className="badge badge-red" style={{ fontSize: '0.72rem' }}>
                                              BP: {vitals.bp}
                                            </span>
                                          )}
                                          {vitals.pulse && (
                                            <span className="badge badge-blue" style={{ fontSize: '0.72rem' }}>
                                              Pulse: {vitals.pulse} bpm
                                            </span>
                                          )}
                                          {vitals.temp && (
                                            <span
                                              className="badge badge-amber"
                                              style={{
                                                fontSize: '0.72rem',
                                                ...(isHighTemp ? { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' } : {}),
                                              }}
                                            >
                                              Temp: {vitals.temp}°F
                                            </span>
                                          )}
                                          {vitals.spo2 && (
                                            <span
                                              className="badge badge-green"
                                              style={{
                                                fontSize: '0.72rem',
                                                ...(isLowSpo2 ? { background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' } : {}),
                                              }}
                                            >
                                              SpO₂: {vitals.spo2}% {isLowSpo2 ? '⚠️' : ''}
                                            </span>
                                          )}
                                          {vitals.respRate && (
                                            <span className="badge badge-gray" style={{ fontSize: '0.72rem' }}>
                                              RR: {vitals.respRate}/min
                                            </span>
                                          )}
                                          {vitals.sugar && (
                                            <span className="badge badge-purple" style={{ fontSize: '0.72rem' }}>
                                              Sugar: {vitals.sugar} mg/dL
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* Doctor Clinical Notes */}
                                      {log.doctorNotes && (
                                        <div
                                          style={{
                                            fontSize: '0.82rem',
                                            color: 'var(--text-secondary)',
                                            background: 'var(--surface-0)',
                                            padding: '8px 10px',
                                            borderRadius: 6,
                                            borderLeft: '3px solid var(--primary)',
                                          }}
                                        >
                                          <strong style={{ color: 'var(--text-primary)' }}>Doctor Observations: </strong>
                                          {log.doctorNotes}
                                        </div>
                                      )}

                                      {/* Medications Administered */}
                                      {log.medications && log.medications.length > 0 && (
                                        <div style={{ marginTop: 2 }}>
                                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                                            Medications Administered ({log.medications.length}):
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                                            {log.medications.map((med, mIdx) => (
                                              <div
                                                key={mIdx}
                                                style={{
                                                  background: 'var(--surface-0)',
                                                  border: '1px solid var(--border)',
                                                  borderRadius: 6,
                                                  padding: '5px 8px',
                                                  fontSize: '0.78rem',
                                                }}
                                              >
                                                <div style={{ fontWeight: 700 }}>{med.name}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                                  {med.dose} · {med.route || 'Oral'} {med.timing ? `· ${med.timing}` : ''}
                                                </div>
                                                {med.instructions && (
                                                  <div style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>
                                                    {med.instructions}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Procedures */}
                                      {log.procedures && log.procedures.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Procedures:</span>
                                          {log.procedures.map((p, pIdx) => (
                                            <span key={pIdx} className="badge badge-gray" style={{ fontSize: '0.7rem' }}>
                                              {p.name} {p.quantity ? `×${p.quantity}` : ''} (₹{p.totalPrice})
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Nursing & Diet */}
                                      {(log.nursingNotes || log.dietNotes) && (
                                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                          {log.nursingNotes && (
                                            <div>
                                              <strong>Nursing:</strong> {log.nursingNotes}
                                            </div>
                                          )}
                                          {log.dietNotes && (
                                            <div>
                                              <strong>Diet:</strong> {log.dietNotes}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* If Discharged: Full Discharge Course & Home Medications Summary Box */}
                            {!isAdmitted && (
                              <div
                                style={{
                                  background: 'var(--surface-1)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 10,
                                  padding: '14px 16px',
                                  marginTop: 14,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                                    Discharge Clinical Summary &amp; Home Medications
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-xs"
                                    onClick={() => router.push(`/ipd/${adm.id}`)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <FileText size={12} /> View Inpatient Case Sheet
                                  </button>
                                </div>

                                {adm.dischargeSummary && (
                                  <div style={{ marginBottom: 10, fontSize: '0.84rem' }}>
                                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                                      Hospital Course &amp; Condition at Discharge:
                                    </strong>
                                    <span style={{ color: 'var(--text-secondary)' }}>{adm.dischargeSummary}</span>
                                  </div>
                                )}

                                {/* Home Medications */}
                                {(() => {
                                  let homeMeds: PrescribedMedicine[] = [];
                                  if (adm.dischargeMedications) {
                                    try {
                                      const parsed = JSON.parse(adm.dischargeMedications);
                                      if (Array.isArray(parsed)) homeMeds = parsed;
                                    } catch {}
                                  }

                                  if (homeMeds.length === 0) return null;

                                  return (
                                    <div style={{ marginBottom: 12 }}>
                                      <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', marginBottom: 6 }}>
                                        Discharge Home Medications (R<sub>x</sub>):
                                      </strong>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                        {homeMeds.map((med, mIdx) => (
                                          <div
                                            key={mIdx}
                                            style={{
                                              background: 'var(--surface-0)',
                                              border: '1px solid var(--border)',
                                              borderRadius: 8,
                                              padding: '8px 10px',
                                              fontSize: '0.8rem',
                                            }}
                                          >
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{med.name}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                              {med.dose} · {med.duration}
                                            </div>
                                            {med.instructions && (
                                              <div style={{ color: 'var(--primary)', fontSize: '0.72rem', marginTop: 2 }}>
                                                {med.instructions}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {adm.dischargeNotes && (
                                  <div style={{ fontSize: '0.82rem', marginBottom: 8 }}>
                                    <strong style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                                      Discharge Advice &amp; Follow-Up:
                                    </strong>
                                    <span style={{ color: 'var(--text-secondary)' }}>{adm.dischargeNotes}</span>
                                  </div>
                                )}

                                {/* Settlement pill */}
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 8, fontSize: '0.78rem' }}>
                                  <span>Total Charges: <strong>₹{adm.cumulativeCharges}</strong></span>
                                  <span>Advance Received: <strong style={{ color: '#10b981' }}>₹{adm.totalPaid}</strong></span>
                                  {Boolean(adm.discount) && <span>Discount: <strong>₹{adm.discount}</strong></span>}
                                  <span>Final Settlement: <strong style={{ color: hasBalanceDue ? '#ef4444' : '#10b981' }}>{hasBalanceDue ? `Pending ₹${adm.balanceDue}` : 'Settled in Full'}</strong></span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      <ConfirmModal
        {...confirmModalState}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {billingVisit && patient && (
        <CreateBillModal
          isOpen={!!billingVisit}
          onClose={() => setBillingVisit(null)}
          patientId={patient.patientId}
          patientName={patient.name}
          visitId={String(billingVisit.id)}
          visitDate={billingVisit.date}
          initialTreatments={
            billingVisit.treatment?.trim()
              ? [{ name: billingVisit.treatment.trim(), unitPrice: 100, quantity: 1 }]
              : []
          }
          onSuccess={() => {
            refetchVisits();
          }}
        />
      )}

      {showMultiDayBill && patient && (
        <MultiDayBillModal
          isOpen={showMultiDayBill}
          onClose={() => setShowMultiDayBill(false)}
          patient={patient}
          visits={visits}
        />
      )}

      {activePaymentModal && patient && (
        <RecordPaymentModal
          isOpen={!!activePaymentModal}
          onClose={() => setActivePaymentModal(null)}
          billId={activePaymentModal.billId}
          billNumber={activePaymentModal.billNumber}
          patientName={patient.name}
          balanceDue={activePaymentModal.balanceDue}
          totalAmount={activePaymentModal.totalAmount}
          paidAmount={activePaymentModal.paidAmount}
          onSuccess={() => {
            refetchVisits();
          }}
        />
      )}

      {/* Full-Screen Doctor Rounds Modal */}
      {showDayLogModal && selectedIpdForRounds && (
        <IpdDayLogModal
          isOpen={showDayLogModal}
          onClose={() => {
            setShowDayLogModal(false);
            setSelectedIpdForRounds(null);
            setSelectedDayLogToEdit(null);
          }}
          admission={selectedIpdForRounds}
          initialLog={selectedDayLogToEdit}
          onSuccess={() => {
            setShowDayLogModal(false);
            setSelectedIpdForRounds(null);
            setSelectedDayLogToEdit(null);
            refetchIpd();
            refetchVisits();
          }}
        />
      )}



      {/* Interactive Multi-Day IPD Patient Journey Modal */}
      {selectedJourneyAdmission && (
        <IpdPatientJourneyModal
          isOpen={!!selectedJourneyAdmission}
          admission={selectedJourneyAdmission}
          onClose={() => setSelectedJourneyAdmission(null)}
          onOpenDayLog={(dayLog) => {
            setSelectedIpdForRounds(selectedJourneyAdmission);
            setSelectedDayLogToEdit(dayLog || null);
            setShowDayLogModal(true);
          }}
          onOpenDischarge={() => {
            router.push(`/ipd/${selectedJourneyAdmission.id}`);
          }}
          onOpenTransfer={() => {
            router.push('/ipd');
          }}
        />
      )}
    </PageTransition>
  );
}
