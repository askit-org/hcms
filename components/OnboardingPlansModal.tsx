'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Clock, ShieldCheck, ArrowRight, Star, Stethoscope, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscriptionMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import PaymentModal from '@/components/PaymentModal';

interface OnboardingPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLockout?: boolean;
  lockReason?: 'no_plan' | 'trial_expired' | 'premium_expired' | null;
}

export default function OnboardingPlansModal({ isOpen, onClose, isLockout = false, lockReason = null }: OnboardingPlansModalProps) {
  const { user } = useAuth();
  const { selectPlan } = useSubscriptionMutations();
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const doctorName = user?.doctorName || 'Doctor';

  const handleSelectTrial = async () => {
    setLoadingTrial(true);
    try {
      await selectPlan.mutateAsync({ planType: 'trial' });
      toast('🎉 15-Day Free Trial activated! Welcome to HCMS.', 'success');
      onClose();
    } catch (err: any) {
      toast(err.message || 'Failed to activate trial', 'error');
    } finally {
      setLoadingTrial(false);
    }
  };

  const handleDismiss = () => {
    if (isLockout) return; // Non-dismissable when locked out
    if (user && user.subscription) {
      useAuth.getState().updateSubscription({ ...user.subscription, hasSelectedPlan: true });
    }
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <>
      <AnimatePresence>
        <div
          className="modal-overlay"
          style={{
            zIndex: 999999,
            background: 'rgba(10, 15, 30, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
          onClick={(e) => {
            if (isLockout) e.stopPropagation();
          }}
        >
          <motion.div
            className="modal subscription-modal"
            style={{ display: showPaymentModal ? 'none' : 'block', zIndex: 1000000 }}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Top Decorative Radial Glow */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 440,
                height: 180,
                background: 'radial-gradient(ellipse at center, var(--accent-glow), transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Close / Dismiss Button (Only shown if NOT locked out) */}
            {!isLockout && (
              <button
                onClick={handleDismiss}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 20,
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            )}

            {/* Header Greeting */}
            <div className="subscription-modal-header" style={{ textAlign: 'center', marginBottom: 20, position: 'relative', zIndex: 1, paddingRight: isLockout ? 0 : 24 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  background: isLockout ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-glow)',
                  color: isLockout ? 'var(--red)' : 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                  border: isLockout ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(13, 148, 136, 0.25)',
                  boxShadow: isLockout ? '0 8px 20px rgba(239, 68, 68, 0.2)' : '0 8px 20px var(--accent-glow)',
                }}
              >
                <Stethoscope size={26} />
              </div>

              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {lockReason === 'trial_expired'
                  ? `Free Trial Period Expired, ${doctorName}`
                  : lockReason === 'premium_expired'
                  ? `Subscription Expired, ${doctorName}`
                  : `Welcome to HCMS, ${doctorName}! 👋`}
              </h1>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                {isLockout
                  ? 'Your subscription status is inactive. Please select a plan to unlock your clinic management dashboard and resume OPD operations.'
                  : 'To start managing your clinic, prescriptions, and OPD visits, please choose a plan below. You can start with our 15-day free trial or activate Premium.'}
              </p>
            </div>

            {/* 30-Day Data Safety Notice */}
            <div
              style={{
                background: 'rgba(13, 148, 136, 0.08)',
                border: '1px solid rgba(13, 148, 136, 0.25)',
                borderRadius: 16,
                padding: '14px 16px',
                marginBottom: 20,
                textAlign: 'left',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <ShieldCheck size={24} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                  🔒 Your Clinic & Patient Data is Safe and Encrypted
                </div>
                <div style={{ fontSize: '0.81rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  All your patient records, OPD visits, medicine inventory, and prescription templates remain <strong>100% secure and encrypted</strong>. To continue managing your clinic, please subscribe to a plan below. Your account data will be preserved safely for <strong>30 days</strong>, after which inactive account records are scheduled for permanent deletion.
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="subscription-grid">
              {/* Option 1: 15-Day Free Trial */}
              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 18,
                  padding: '20px',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--blue)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Clock size={13} /> 15-Day Trial
                    </span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>No Credit Card</span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    Free Trial
                  </h3>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>
                    ₹0 <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ 15 days</span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Check size={15} color="var(--accent)" /> Full OPD Visit & Rx Generation
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Check size={15} color="var(--accent)" /> Patient Records & Medical History
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Check size={15} color="var(--accent)" /> Medicine Inventory & Templates
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Check size={15} color="var(--accent)" /> 15 Days Free Access
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleSelectTrial}
                  disabled={loadingTrial}
                  className="btn btn-secondary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: loadingTrial ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minHeight: 44,
                  }}
                >
                  {loadingTrial ? 'Activating Trial…' : 'Start 15-Day Free Trial'}
                </button>
              </div>

              {/* Option 2: Premium Plan */}
              <div
                style={{
                  background: 'linear-gradient(145deg, var(--surface-1), var(--surface-2))',
                  borderRadius: 18,
                  padding: '20px',
                  border: '1.5px solid var(--accent)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  boxShadow: '0 10px 25px var(--accent-glow)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: 'var(--accent-glow)',
                        color: 'var(--accent)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Sparkles size={13} /> Full Access
                    </span>

                    {/* Recommended Badge inline inside card header */}
                    <span
                      style={{
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                        color: '#ffffff',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        boxShadow: '0 4px 12px var(--accent-glow)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Star size={11} fill="white" /> Recommended
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    Premium Plan
                  </h3>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 14 }}>
                    ₹299 <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ month</span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <Check size={15} color="var(--accent)" /> Everything in Trial + Unlimited Usage
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <Check size={15} color="var(--accent)" /> Custom Letterhead & PDF Export
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <Check size={15} color="var(--accent)" /> Advanced Analytics & Reports
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <Check size={15} color="var(--accent)" /> Priority Support & Cloud Backup
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px var(--accent-glow)',
                    minHeight: 44,
                  }}
                >
                  Get Premium Plan (₹299/mo) <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Footer Trust Note */}
            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              <ShieldCheck size={14} color="var(--green)" /> You can upgrade or change plans anytime from Settings
            </div>
          </motion.div>

        </div>
      </AnimatePresence>

      {/* UPI QR Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setShowPaymentModal(false);
          onClose();
        }}
      />
    </>,
    document.body
  );
}
