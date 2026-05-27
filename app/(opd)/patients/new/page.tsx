'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { usePatientMutations } from '@/lib/hooks/useQueries';
import { useProviderStore } from '@/lib/providers';
import { toast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';

export default function NewPatientPage() {
  const router = useRouter();
  const { create } = usePatientMutations();
  const provider = useProviderStore((s) => s.provider);
  
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '', age: '', dob: '', gender: 'Male', mobile: '', address: '', occupation: '', abhaNumber: ''
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) {
      toast('Name and mobile are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : undefined,
        dob: form.dob || undefined,
        gender: form.gender,
        mobile: form.mobile.trim(),
        address: form.address.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        abhaNumber: form.abhaNumber.trim() || undefined,
        createdAt: new Date().toISOString(),
      } as any);
      // We don't get the generated patientId easily here without the result object from mutation,
      // but assuming create returns the created patient. Wait, the hook mutation returns the created item.
      toast('Patient registered successfully', 'success');
      router.push('/patients');
    } catch (err: any) {
      toast(err.message || 'Failed to register patient.', 'error');
      setSaving(false);
    }
  };

  return (
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

      <form onSubmit={handleSubmit}>
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
              <input 
                className="form-input" 
                type="date" 
                max={new Date().toISOString().split('T')[0]}
                value={form.dob} 
                onChange={e => set('dob', e.target.value)} 
              />
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
            <div className="form-group">
              <label className="form-label">ABHA Number <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input className="form-input" placeholder="e.g. 12-3456-7890-1234" value={form.abhaNumber} onChange={e => set('abhaNumber', e.target.value)} />
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <UserPlus size={16} /> {saving ? 'Registering…' : 'Register Patient'}
            </button>
          </div>
        </div>
      </form>
    </PageTransition>
  );
}
