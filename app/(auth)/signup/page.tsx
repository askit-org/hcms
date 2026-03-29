'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, UserPlus } from 'lucide-react';
import { useAuthMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { authSignup } = useAuthMutations();

  const [form, setForm] = useState({
    doctorName: '', email: '', password: '', 
    degree: '', clinicName: '', regNo: '', 
    phone: '', address: '', city: ''
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const nextStep = () => {
    if (step === 1) {
      if (!form.doctorName || !form.email || !form.password) {
        toast('Please fill all required credentials', 'error');
        return;
      }
      setStep(2);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clinicName) {
      toast('Clinic Name is required', 'error');
      return;
    }

    setLoading(true);

    try {
      await authSignup.mutateAsync(form);
      toast('Account created successfully!', 'success');
      router.push('/dashboard');
    } catch (err: any) {
      toast(err.message || 'Network error occurred', 'error');
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
          {step === 1 ? 'Step 1: Account Details' : 'Step 2: Clinic Information'}
        </p>
      </div>

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <input className="form-input" placeholder="Dr. Full Name" value={form.doctorName} onChange={e => set('doctorName', e.target.value)} />
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address <span className="required">*</span></label>
                <input type="email" className="form-input" placeholder="doctor@clinic.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password <span className="required">*</span></label>
                <input type="password" className="form-input" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Qualification / Degree</label>
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
                <input className="form-input" placeholder="My Health Clinic" value={form.clinicName} onChange={e => set('clinicName', e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Registration Number</label>
                <input className="form-input" placeholder="Medical Council Reg. No." value={form.regNo} onChange={e => set('regNo', e.target.value)} />
              </div>

              <div className="form-grid form-grid-2" style={{ gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="Phone Number" value={form.phone} onChange={e => set('phone', e.target.value)} />
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
