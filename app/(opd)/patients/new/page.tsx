'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ChevronLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { usePatientMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';

const COMMON_CONDITIONS = [
  'Hypertension (BP)',
  'Diabetes (Sugar)',
  'Asthma',
  'Thyroid',
  'Heart Disease',
  'Allergies',
];

export default function NewPatientPage() {
  const router = useRouter();
  const { create } = usePatientMutations();
  
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [form, setForm] = useState({
    name: '',
    age: '',
    dob: '',
    gender: 'Male',
    mobile: '',
    address: '',
    occupation: '',
    abhaNumber: '',
  });

  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) {
      setErrors(e => {
        const copy = { ...e };
        delete copy[k];
        return copy;
      });
    }
  };

  const handleDobChange = (dobValue: string) => {
    let computedAge = form.age;
    if (dobValue) {
      const birthDate = new Date(dobValue);
      const today = new Date();
      let calcAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calcAge--;
      }
      if (calcAge >= 0 && calcAge <= 120) {
        computedAge = String(calcAge);
      }
    }
    setForm(f => ({ ...f, dob: dobValue, age: computedAge }));
    if (errors.dob || errors.age) {
      setErrors(e => {
        const copy = { ...e };
        delete copy.dob;
        delete copy.age;
        return copy;
      });
    }
  };

  const toggleCondition = (cond: string) => {
    setSelectedConditions(prev =>
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  const scrollToError = (fieldName: string) => {
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${fieldName}"]`) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Patient full name is required.';
    }

    const mobileDigits = form.mobile.replace(/\D/g, '');
    if (mobileDigits.length < 10) {
      newErrors.mobile = 'Please enter a valid 10-digit mobile number.';
    }

    if (form.age && (parseInt(form.age, 10) < 0 || parseInt(form.age, 10) > 150)) {
      newErrors.age = 'Age must be between 0 and 150.';
    }

    if (form.abhaNumber.trim() && !/^\d{14}$/.test(form.abhaNumber.trim())) {
      newErrors.abhaNumber = 'ABHA number must be exactly 14 numeric digits.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorField = Object.keys(newErrors)[0];
      toast(newErrors[firstErrorField], 'error');
      scrollToError(firstErrorField);
      return;
    }

    setSaving(true);
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        age: form.age ? Math.abs(parseInt(form.age, 10)) : undefined,
        dob: form.dob || undefined,
        gender: form.gender,
        mobile: form.mobile.trim(),
        address: form.address.trim() || undefined,
        occupation: form.occupation.trim() || undefined,
        abhaNumber: form.abhaNumber.trim() || undefined,
        permanentConditions: selectedConditions,
        createdAt: new Date().toISOString(),
      } as any);

      toast('Patient registered successfully!', 'success');
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
              <input
                data-field="name"
                className={`form-input ${errors.name ? 'has-error' : ''}`}
                style={errors.name ? { border: '2px solid var(--red)' } : {}}
                placeholder="Enter patient full name"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
              {errors.name && <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4 }}>{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth <span style={{ color: 'var(--text-muted)' }}>(Auto-calculates age)</span></label>
              <input 
                data-field="dob"
                className={`form-input ${errors.dob ? 'has-error' : ''}`}
                style={errors.dob ? { border: '2px solid var(--red)' } : {}}
                type="date" 
                max={new Date().toISOString().split('T')[0]}
                value={form.dob} 
                onChange={e => handleDobChange(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Age (years)</label>
              <input
                data-field="age"
                className={`form-input ${errors.age ? 'has-error' : ''}`}
                style={errors.age ? { border: '2px solid var(--red)' } : {}}
                type="number"
                min="0"
                max="150"
                placeholder="e.g. 35"
                value={form.age}
                onChange={e => set('age', e.target.value.replace(/-/g, ''))}
              />
              {errors.age && <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4 }}>{errors.age}</span>}
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
              <input
                data-field="mobile"
                className={`form-input ${errors.mobile ? 'has-error' : ''}`}
                style={errors.mobile ? { border: '2px solid var(--red)' } : {}}
                type="tel"
                placeholder="10-digit mobile number"
                value={form.mobile}
                onChange={e => set('mobile', e.target.value.replace(/-/g, ''))}
                required
              />
              {errors.mobile && <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4 }}>{errors.mobile}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">ABHA Number <span style={{ color: 'var(--text-muted)' }}>(14 digits)</span></label>
              <input
                data-field="abhaNumber"
                className={`form-input ${errors.abhaNumber ? 'has-error' : ''}`}
                style={errors.abhaNumber ? { border: '2px solid var(--red)' } : {}}
                placeholder="14-digit ABHA number"
                maxLength={14}
                value={form.abhaNumber}
                onChange={e => set('abhaNumber', e.target.value.replace(/\D/g, ''))}
              />
              {errors.abhaNumber && <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4 }}>{errors.abhaNumber}</span>}
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Address <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input className="form-input" placeholder="Street, City, Area" value={form.address} onChange={e => set('address', e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Permanent Medical Conditions & Chronic Diseases</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {COMMON_CONDITIONS.map(cond => {
                  const active = selectedConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleCondition(cond)}
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
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Occupation <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input className="form-input" placeholder="e.g. Farmer, Teacher" value={form.occupation} onChange={e => set('occupation', e.target.value)} />
            </div>
          </div>

          <div className="form-actions">
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
