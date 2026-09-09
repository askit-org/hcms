'use client';

import { useState } from 'react';
import { Sparkles, Clock, ShieldCheck, ArrowUpRight, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSubscription } from '@/lib/hooks/useQueries';
import PaymentModal from '@/components/PaymentModal';

export default function SubscriptionBanner() {
  const { user } = useAuth();
  useSubscription(); // Sync status from API / provider on mount
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const sub = user?.subscription;
  if (!sub || !sub.hasSelectedPlan) return null;

  // Calculate trial days remaining
  let trialDaysLeft: number | null = null;
  if (sub.planType === 'trial' && sub.trialEndDate) {
    const end = new Date(sub.trialEndDate).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, diff);
  }

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {sub.planType === 'premium' && sub.subscriptionStatus === 'active' ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 20,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            <ShieldCheck size={14} /> Premium Active
          </div>
        ) : sub.subscriptionStatus === 'expired' || (trialDaysLeft !== null && trialDaysLeft <= 0) ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 6px 4px 12px',
              borderRadius: 20,
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={13} />
              Subscription Expired
            </span>

            <button
              onClick={() => setShowPaymentModal(true)}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '4px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
              }}
            >
              <Sparkles size={12} /> Renew ₹299 <ArrowUpRight size={12} />
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 6px 4px 12px',
              borderRadius: 20,
              background: trialDaysLeft !== null && trialDaysLeft <= 3 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: `1px solid ${trialDaysLeft !== null && trialDaysLeft <= 3 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              color: trialDaysLeft !== null && trialDaysLeft <= 3 ? '#f87171' : '#fbbf24',
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} />
              {trialDaysLeft !== null ? `${trialDaysLeft} Days Trial Left` : '15-Day Free Trial'}
            </span>

            <button
              onClick={() => setShowPaymentModal(true)}
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '4px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 10px var(--accent-glow)',
              }}
            >
              <Sparkles size={12} /> Upgrade ₹299 <ArrowUpRight size={12} />
            </button>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
      />
    </>
  );
}
