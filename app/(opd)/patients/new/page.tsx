'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ChevronLeft, Building2, Bed, Sparkles, Ambulance, Heart, Stethoscope, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { usePatientMutations } from '@/lib/hooks/useQueries';
import { useProviderStore } from '@/lib/providers';
import { toast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';

export const PATIENT_CATEGORIES = [
  { id: 'OPD', label: 'OPD', sublabel: 'Out-Patient Department', icon: Stethoscope, color: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
  { id: 'IPD', label: 'IPD', sublabel: 'In-Patient Department', icon: Bed, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { id: 'Suwarna Pashan', label: 'Suwarna Pashan', sublabel: 'Suwarna Pashan', icon: Sparkles, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { id: 'Emergency', label: 'Emergency', sublabel: 'Emergency / Casualty', icon: Ambulance, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { id: 'Specialty', label: 'Specialty', sublabel: 'Specialty Clinic', icon: Heart, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'Other', label: 'Other', sublabel: 'Other / General', icon: Building2, color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
];

export default function NewPatientPage() {
  const router = useRouter();
  const { create } = usePatientMutations();
  const provider = useProviderStore((s) => s.provider);
  
  const [saving, setSaving] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(true);
  
  const [form, setForm] = useState({
    name: '', age: '', dob: '', gender: 'Male', mobile: '', address: '', occupation: '',
    category: '', // starts empty, must be selected via modal
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) {
      setShowCategoryModal(true);
      return;
    }
    if (!form.name.trim() || !form.mobile.trim()) {
      toast('Name and mobile are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const patientId = await provider.generatePatientId();
      await create.mutateAsync({
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : undefined,
        dob: form.dob || undefined,
        gender: form.gender,
        mobile: form.mobile.trim(),
        address: form.address.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        category: form.category,
        createdAt: new Date().toISOString(),
      } as any);
      toast(`Patient registered: ${patientId}`, 'success');
      router.push(`/patients/${patientId}`);
    } catch (err) {
      toast('Failed to register patient.', 'error');
      setSaving(false);
    }
  };

  const handleCategorySelect = (catId: string) => {
    set('category', catId);
    setShowCategoryModal(false);
  };

  const activeCategoryObj = PATIENT_CATEGORIES.find(c => c.id === form.category);
  const ActiveIcon = activeCategoryObj?.icon;

  return (
    <>
      {/* ── Category Selection Modal Popup ────────────────────────── */}
      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal modal-md">
            <div className="modal-header">
              <h3>Select Patient Category</h3>
              {/* Only allow closing if a category is already selected (e.g. they clicked "Change") */}
              {form.category && (
                <button className="btn-icon" onClick={() => setShowCategoryModal(false)}>✕</button>
              )}
            </div>
            <div className="modal-body" style={{ paddingBottom: '30px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', textAlign: 'center' }}>
                Please select the department or category for this new patient to continue.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {PATIENT_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const selected = form.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '20px 24px',
                        backgroundColor: selected ? cat.bg : 'var(--surface-1)',
                        border: `2px solid ${selected ? cat.color : 'var(--border)'}`,
                        borderRadius: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                        boxShadow: selected ? `0 4px 15px ${cat.bg}` : '0 2px 8px rgba(0,0,0,0.05)',
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) {
                          e.currentTarget.style.borderColor = cat.color;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.transform = 'none';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                        <div style={{ 
                          width: '44px', height: '44px', 
                          borderRadius: '12px', 
                          background: selected ? cat.color : cat.bg, 
                          color: selected ? '#fff' : cat.color, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}>
                          <Icon size={22} />
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: selected ? cat.color : 'var(--text-primary)' }}>
                          {cat.label}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {cat.sublabel} Registration
                      </div>
                    </button>
                  );
                })}
              </div>
              {!form.category && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px' }}>
                  <Link href="/patients" className="btn btn-ghost">Cancel Registration</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Registration Form ─────────────────────────────────── */}
      <PageTransition className="page-transition" style={{ maxWidth: 780, margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <Link href="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 6 }}>
              <ChevronLeft size={15} /> Back to Patients
            </Link>
            <div className="page-title">Register New Patient</div>
            <div className="page-subtitle">Patient ID will be auto-generated</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ opacity: showCategoryModal ? 0 : 1, transition: 'opacity 0.3s ease' }}>
          
          {/* Selected Category Confirmatory Banner */}
          {activeCategoryObj && ActiveIcon && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: activeCategoryObj.bg, border: `1px solid ${activeCategoryObj.color}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: activeCategoryObj.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ActiveIcon size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Selected Category</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{activeCategoryObj.label} Patient</div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCategoryModal(true)}>
                <Edit2 size={14} /> Change
              </button>
            </div>
          )}

          {/* Personal Information */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Personal Information</div>
            <div className="form-grid form-grid-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input className="form-input" placeholder="Enter patient full name" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Age (years)</label>
                <input className="form-input" type="number" min="0" max="150" placeholder="e.g. 35" value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input className="form-input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Gender <span className="required">*</span></label>
                <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number <span className="required">*</span></label>
                <input className="form-input" type="tel" placeholder="10-digit mobile number" value={form.mobile} onChange={e => set('mobile', e.target.value)} required />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" placeholder="Street, City, Area" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Occupation <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" placeholder="e.g. Farmer, Teacher" value={form.occupation} onChange={e => set('occupation', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <Link href="/patients" className="btn btn-ghost">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.category}>
                <UserPlus size={16} /> {saving ? 'Registering…' : 'Register Patient'}
              </button>
            </div>
          </div>
        </form>
      </PageTransition>
    </>
  );
}
