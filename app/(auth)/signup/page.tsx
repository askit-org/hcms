'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { motion, AnimatePresence } from 'framer-motion';

import { signupStep1Schema, signupStep2Schema, validateForm } from '@/lib/validations/schemas';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { authSignup } = useAuthMutations();

  useEffect(() => {
    if (useAuth.persist.hasHydrated()) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      }
    } else {
      const unsub = useAuth.persist.onFinishHydration((state) => {
        if (state.isAuthenticated) {
          router.replace('/dashboard');
        }
      });
      return () => unsub();
    }
  }, [isAuthenticated, router]);

  const [form, setForm] = useState({
    doctorName: '', email: '', password: '', 
    degree: '', clinicName: '', regNo: '', 
    phone: '', address: '', city: ''
  });

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

  const nextStep = async () => {
    if (step === 1) {
      const { isValid, errors: step1Errors } = await validateForm(signupStep1Schema, form);
      if (!isValid) {
        const typedErrors = step1Errors as Record<string, string>;
        setErrors(typedErrors);
        const firstKey = Object.keys(typedErrors)[0];
        if (firstKey && typedErrors[firstKey]) {
          toast(typedErrors[firstKey], 'error');
        }
        return; // Prevent moving to Step 2!
      }
      setErrors({});
      setStep(2);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Step 2 fields using Yup
    const { isValid, errors: step2Errors } = await validateForm(signupStep2Schema, form);
    if (!isValid) {
      const typedErrors = step2Errors as Record<string, string>;
      setErrors(typedErrors);
      const firstKey = Object.keys(typedErrors)[0];
      if (firstKey && typedErrors[firstKey]) {
        toast(typedErrors[firstKey], 'error');
      }
      return; // Prevent form submission!
    }

    setLoading(true);

    try {
      await authSignup.mutateAsync(form);
      toast('🎉 Account created successfully! Welcome to HCMS.', 'success');
      router.push('/dashboard');
    } catch (err: any) {
      toast(getErrorMessage(err, 'Network error occurred during registration'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
      style={{ padding: '32px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ 
          width: 48, height: 48, borderRadius: 12, background: 'var(--accent-glow)', 
          color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <UserPlus size={24} />
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Create Account</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
          {step === 1 ? 'Step 1: Doctor Credentials' : 'Step 2: Clinic Details'}
        </p>
      </div>

      <form noValidate onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1" 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Doctor Name <span className="required">*</span></label>
                <input
                  className={`form-input ${errors.doctorName ? 'has-error' : ''}`}
                  style={errors.doctorName ? { border: '2px solid var(--red)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' } : {}}
                  placeholder="Dr. Full Name"
                  value={form.doctorName}
                  onChange={e => set('doctorName', e.target.value)}
                />
                {errors.doctorName && (
                  <div style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.doctorName}
                  </div>
                )}
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address <span className="required">*</span></label>
                <input
                  type="email"
                  className={`form-input ${errors.email ? 'has-error' : ''}`}
                  style={errors.email ? { border: '2px solid var(--red)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' } : {}}
                  placeholder="doctor@clinic.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                />
                {errors.email && (
                  <div style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.email}
                  </div>
                )}
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password <span className="required">*</span></label>
                <input
                  type="password"
                  className={`form-input ${errors.password ? 'has-error' : ''}`}
                  style={errors.password ? { border: '2px solid var(--red)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' } : {}}
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                />
                {errors.password && (
                  <div style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.password}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Qualification / Degree <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" placeholder="e.g. MBBS, MD" value={form.degree} onChange={e => set('degree', e.target.value)} />
              </div>

              <button type="button" onClick={nextStep} className="btn btn-primary" style={{ width: '100%', marginTop: 8, padding: 12 }}>
                Continue to Clinic Info
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="step2" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Clinic / Hospital Name <span className="required">*</span></label>
                <input
                  className={`form-input ${errors.clinicName ? 'has-error' : ''}`}
                  style={errors.clinicName ? { border: '2px solid var(--red)', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' } : {}}
                  placeholder="My Health Clinic"
                  value={form.clinicName}
                  onChange={e => set('clinicName', e.target.value)}
                />
                {errors.clinicName && (
                  <div style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.clinicName}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Registration Number <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                <input className="form-input" placeholder="Medical Council Reg. No." value={form.regNo} onChange={e => set('regNo', e.target.value)} />
              </div>

              <div className="form-grid form-grid-2" style={{ gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                  <input
                    className={`form-input ${errors.phone ? 'has-error' : ''}`}
                    style={errors.phone ? { border: '2px solid var(--red)' } : {}}
                    placeholder="10-digit number"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                  {errors.phone && <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>{errors.phone}</span>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Clinic Address</label>
                <input className="form-input" placeholder="Full clinic address" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setStep(1)} className="btn btn-secondary" style={{ flex: 1, padding: 12 }}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: 12 }} disabled={loading}>
                  {loading ? 'Creating...' : 'Sign Up'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
          Log in
        </Link>
      </div>
    </motion.div>
  );
}
