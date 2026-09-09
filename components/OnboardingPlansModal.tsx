'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Clock, ShieldCheck, ArrowRight, Star, Stethoscope, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscriptionMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import PaymentModal from '@/components/PaymentModal';

interface OnboardingPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingPlansModal({ isOpen, onClose }: OnboardingPlansModalProps) {
  const { user } = useAuth();
  const { selectPlan } = useSubscriptionMutations();
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

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
    if (user && user.subscription) {
      useAuth.getState().updateSubscription({ ...user.subscription, hasSelectedPlan: true });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="modal-overlay" style={{ zIndex: 99990, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(10px)' }}>
          <motion.div
            className="modal modal-lg"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              maxWidth: 720,
              width: '92%',
              background: 'var(--surface-solid)',
              borderRadius: '24px',
              border: '1px solid var(--border)',
              padding: '36px 30px',
              boxShadow: 'var(--modal-shadow)',
              position: 'relative',
              overflow: 'hidden',
              color: 'var(--text-primary)',
            }}
          >
            {/* Top Decorative Radial Glow */}
            <div
              style={{
                position: 'absolute',
                top: -80,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 440,
                height: 180,
                background: 'radial-gradient(ellipse at center, var(--accent-glow), transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Close / Dismiss Button */}
            <button
              onClick={handleDismiss}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Close"
            >
              <X size={18} />
            </button>

            {/* Header Greeting */}
            <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: 'var(--accent-glow)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
                  boxShadow: '0 8px 20px var(--accent-glow)',
                }}
              >
                <Stethoscope size={28} />
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                Welcome to HCMS, {doctorName}! 👋
              </h1>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                To start managing your clinic, prescriptions, and OPD visits, please choose a plan below. You can start with our 15-day free trial or activate Premium.
              </p>
            </div>

            {/* Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 20,
                marginBottom: 28,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Option 1: 15-Day Free Trial */}
              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 18,
                  padding: 24,
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
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No Credit Card</span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                    Free Trial
                  </h3>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>
                    ₹0 <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ 15 days</span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Check size={16} color="var(--accent)" /> Full OPD Visit & Rx Generation
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Check size={16} color="var(--accent)" /> Patient Records & Medical History
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Check size={16} color="var(--accent)" /> Medicine Inventory & Templates
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Check size={16} color="var(--accent)" /> 15 Days Free Access
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
                    fontSize: '0.9rem',
                    cursor: loadingTrial ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
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
                  padding: 24,
                  border: '1.5px solid var(--accent)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  boxShadow: '0 10px 25px var(--accent-glow)',
                }}
              >
                {/* Recommended Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: 20,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    color: '#ffffff',
                    padding: '3px 12px',
                    borderRadius: 12,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 12px var(--accent-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Star size={11} fill="white" /> Recommended
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                    Premium Plan
                  </h3>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)', marginBottom: 16 }}>
                    ₹299 <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)' }}>/ month</span>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <Check size={16} color="var(--accent)" /> Everything in Trial + Unlimited Usage
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <Check size={16} color="var(--accent)" /> Custom Letterhead & PDF Export
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <Check size={16} color="var(--accent)" /> Advanced Analytics & Reports
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <Check size={16} color="var(--accent)" /> Priority Support & Cloud Backup
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
                    fontSize: '0.92rem',
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px var(--accent-glow)',
                  }}
                >
                  Get Premium Plan (₹299/mo) <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Footer Trust Note */}
            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
    </>
  );
}
