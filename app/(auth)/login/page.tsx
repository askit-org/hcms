'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { motion } from 'framer-motion';

import { loginSchema, validateForm } from '@/lib/validations/schemas';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { authLogin } = useAuthMutations();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, errors: validationErrors } = await validateForm(loginSchema, { email, password });
    if (!isValid) {
      setErrors(validationErrors as Record<string, string>);
      return;
    }

    setLoading(true);
    try {
      await authLogin.mutateAsync({ email, password });
      toast('Login successful! Welcome back.', 'success');
      router.push('/dashboard');
    } catch (err: any) {
      toast(err?.message || 'Login failed. Please check credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
      style={{ width: '100%', maxWidth: '440px', padding: '36px' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'rgba(59, 130, 246, 0.15)',
          color: 'var(--accent)', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: 12
        }}>
          <Activity size={28} />
        </div>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.5rem', fontWeight: 700 }}>Welcome Back</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Enter your credentials to access the clinic</p>
      </div>

      <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className={`form-input ${errors.email ? 'has-error' : ''}`}
            style={errors.email ? { border: '2px solid var(--red)' } : {}}
            placeholder="doctor@clinic.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
            disabled={loading}
          />
          {errors.email && (
            <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} color="var(--red)" /> {errors.email}
            </span>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ margin: 0 }}>Password</label>
            <Link href="/forgot-password" style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'has-error' : ''}`}
              style={{ paddingRight: '40px', ...(errors.password ? { border: '2px solid var(--red)' } : {}) }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(prev => ({ ...prev, password: '' })); }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} color="var(--red)" /> {errors.password}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', marginTop: '8px', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
        >
          {loading ? 'Authenticating...' : <><LogIn size={18} /> Sign In</>}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Don't have an account?{' '}
        <Link href="/signup" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
          Sign up here
        </Link>
      </div>
    </motion.div>
  );
}
