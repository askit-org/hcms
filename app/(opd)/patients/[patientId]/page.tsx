'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Stethoscope, Phone, MapPin, Briefcase, Calendar,
  Plus, Eye, Printer, Trash2, Activity, ClipboardList, MessageCircle, Edit2, Save, X
} from 'lucide-react';
import { usePatient, usePatientVisits, usePatientMutations, useVisitMutations, useSettings } from '@/lib/hooks/useQueries';
import type { Visit, Patient } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { jsPDF } from 'jspdf';
import { motion } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';

export default function PatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const router = useRouter();
  
  const { data: patient, isLoading: patientLoading } = usePatient(patientId);
  const { data: visits = [], isLoading: visitsLoading } = usePatientVisits(patientId);
  const { data: settings } = useSettings();
  const { remove: removePatient, update: updatePatientMut } = usePatientMutations();
  const { update: updateVisit } = useVisitMutations();

  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [tab, setTab] = useState<'overview' | 'visits'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    age: '',
    dob: '',
    gender: 'Male',
    mobile: '',
    address: '',
    occupation: '',
    abhaNumber: ''
  });

  useEffect(() => {
    if (patient) {
      setEditForm({
        name: patient.name || '',
        age: patient.age ? String(patient.age) : '',
        dob: patient.dob || '',
        gender: patient.gender || 'Male',
        mobile: patient.mobile || '',
        address: patient.address || '',
        occupation: patient.occupation || '',
        abhaNumber: patient.abhaNumber || ''
      });
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
          address: editForm.address.trim() || undefined,
          occupation: editForm.occupation.trim() || undefined,
          abhaNumber: editForm.abhaNumber.trim() || undefined,
        }
      });
      toast('Patient details updated successfully!', 'success');
      setIsEditing(false);
    } catch (err: any) {
      toast(err.message || 'Failed to update patient.', 'error');
    }
  };

  const deletePatient = async () => {
    if (!patient) return;
    if (!confirm(`Delete patient ${patient.name}? This will also delete all their visits permanently.`)) return;
    await removePatient.mutateAsync(patient.patientId);
    toast('Patient deleted.', 'info');
    router.push('/patients');
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
              <span className="badge badge-teal">{patient.patientId}</span>
              <span className="badge badge-blue">{patient.gender}</span>
              {age && <span className="badge">{age} yrs</span>}
              {lastVisit && <span className="text-muted text-sm">Last visit: {new Date(lastVisit.date).toLocaleDateString('en-IN')}</span>}
            </div>
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <><X size={14} /> Cancel</> : <><Edit2 size={14} /> Edit Patient</>}
          </button>
          <Link href={`/visits/new?patientId=${patientId}`} className="btn btn-primary"><Stethoscope size={15} /> New Visit</Link>
          <button className="btn btn-danger btn-sm" onClick={deletePatient}><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab-btn ${tab === 'visits' ? 'active' : ''}`} onClick={() => setTab('visits')}>
          Visit History ({visits.length})
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
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {[
                  { icon: <Phone size={15} />, label: 'Mobile', value: patient.mobile },
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
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Visit Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              {[
                { label: 'Total Visits', value: visits.length, color: 'var(--accent-light)' },
                { label: 'Last Diagnosis', value: lastVisit?.diagnosis || '—', color: 'var(--text-primary)' },
                { label: 'Follow-up Pending', value: visits.filter(v => v.followUpDate && !v.followUpAttended).length, color: 'var(--amber)' },
                { label: 'First Visit', value: visits.length ? new Date(visits[visits.length - 1].date).toLocaleDateString('en-IN') : '—', color: 'var(--text-primary)' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface-1)', borderRadius: 8, padding: '14px', border: '1px solid var(--border)' }}>
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
          {visits.length === 0 ? (
            <div className="empty-state">
              <Stethoscope />
              <h4>No Visits Yet</h4>
              <p>This patient hasn't had any OPD visits recorded.</p>
              <Link href={`/visits/new?patientId=${patientId}`} className="btn btn-primary" style={{ marginTop: 16 }}>
                <Plus size={16} /> Add First Visit
              </Link>
            </div>
          ) : visits.map(v => (
            <motion.div variants={itemAnimations} key={v.id} className="card card-sm" style={{ marginBottom: 12, cursor: 'pointer' }}
              onClick={() => setActiveVisit(activeVisit?.id === v.id ? null : v)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {new Date(v.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    {new Date(v.date).toDateString() === new Date().toDateString() && <span className="badge badge-green" style={{ marginLeft: 8 }}>Today</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span className="badge badge-purple">{v.category || 'OPD'}</span>
                    {v.diagnosis && <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Dx: {v.diagnosis}</span>}
                    {v.followUpDate && (
                      <span className={`badge ${v.followUpAttended ? 'badge-green' : 'badge-amber'}`}>
                        F/U: {new Date(v.followUpDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {v.bp && <span className="badge badge-red">BP: {v.bp}</span>}
                  {v.pulse && <span className="badge badge-blue">P: {v.pulse}</span>}
                </div>
              </div>

              {activeVisit?.id === v.id && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
                    {[
                      { l: 'Chief Complaints', v: v.chiefComplaints },
                      { l: 'Diagnosis', v: v.diagnosis },
                      { l: 'Treatment', v: v.treatment },
                      { l: 'BP', v: v.bp }, { l: 'Pulse', v: v.pulse },
                      { l: 'Temp', v: v.temp }, { l: 'SpO₂', v: v.spo2 },
                    ].filter(i => i.v).map(item => (
                      <div key={item.l}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.l}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginTop: 2 }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                  {v.medicines && v.medicines.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Prescription ({v.medicines.length} medicines)</div>
                      {v.medicines.map((m, i) => (
                        <div key={i} style={{ fontSize: '0.84rem', padding: '6px 0', borderBottom: '1px dashed var(--border-light)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <span style={{ color: 'var(--accent-light)', fontWeight: 700, marginRight: 6 }}>{i + 1}.</span>
                              <span style={{ fontWeight: 600 }}>{m.name}</span>
                            </div>
                            <span style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: '0.8rem' }}>{m.dose} · {m.duration}</span>
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
                    <div style={{ marginTop: 10, background: 'var(--surface-1)', borderRadius: 8, padding: '10px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      <strong>Notes:</strong> {v.prescriptionNotes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Link href={`/visits/${v.id}/print`} className="btn btn-secondary btn-sm"><Printer size={14} /> Print / Share Rx</Link>
                    {v.followUpDate && !v.followUpAttended && (
                      <button className="btn btn-success btn-sm" onClick={async (e) => {
                        e.stopPropagation();
                        if (v.id) {
                          await updateVisit.mutateAsync({ id: v.id, input: { followUpAttended: true } });
                          toast('Follow-up marked as attended.', 'success');
                          setActiveVisit({ ...v, followUpAttended: true });
                        }
                      }}>
                        Mark Follow-up Done
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  );
}
