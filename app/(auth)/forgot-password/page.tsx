'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { useAuthMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { motion } from 'framer-motion';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { forgotPassword } = useAuthMutations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      toast('Please enter your email address', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await forgotPassword.mutateAsync({ email: email.trim() });
      if (res.success !== false) {
        setSubmitted(true);
        toast('Password reset instructions sent!', 'success');
      } else {
        toast(res.error || 'Failed to send reset link', 'error');
      }
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
      style={{
        padding: '32px 24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          {submitted ? <CheckCircle2 size={32} /> : <KeyRound size={32} />}
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
          {submitted ? 'Check Your Inbox' : 'Forgot Password?'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.88rem', lineHeight: 1.5 }}>
          {submitted
            ? `We sent password reset instructions to ${email}. Follow the link in the email to reset your password.`
            : 'No worries! Enter your registered doctor email address below and we will send you instructions to reset your password.'}
        </p>
      </div>

      {!submitted ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-input"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{ paddingLeft: '40px' }}
              />
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '4px', padding: '12px', fontSize: '0.95rem', fontWeight: 600 }}
          >
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => setSubmitted(false)}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '10px', fontSize: '0.88rem', fontWeight: 600 }}
          >
            Didn't receive email? Try again
          </button>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.88rem' }}>
        <Link
          href="/login"
          style={{
            color: 'var(--text-secondary)',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ArrowLeft size={16} /> Back to Sign In
        </Link>
      </div>
    </motion.div>
  );
}
