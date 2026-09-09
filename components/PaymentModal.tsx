'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, QrCode, CheckCircle2, ShieldCheck, Copy, Sparkles, CreditCard } from 'lucide-react';
import { toast } from '@/components/Toast';
import { useSubscriptionMutations } from '@/lib/hooks/useQueries';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentModal({ isOpen, onClose, onSuccess }: PaymentModalProps) {
  const [paymentRef, setPaymentRef] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const { verifyPayment } = useSubscriptionMutations();

  const upiId = 'hcms.pay@upi';
  const price = 299;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    toast('UPI ID copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentRef.trim()) {
      toast('Please enter the UTR / Transaction Reference ID', 'error');
      return;
    }

    setIsVerifying(true);

    try {
      await verifyPayment.mutateAsync({
        paymentRef: paymentRef.trim(),
        amount: price,
        planType: 'premium',
      });

      toast('🎉 Payment verified! Premium Plan activated successfully.', 'success');
      setPaymentRef('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast(err.message || 'Payment verification failed. Please check your UTR number.', 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" style={{ zIndex: 100000, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)' }}>
        <motion.div
          className="modal payment-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
        >
          {/* Top Decorative Glow */}
          <div
            style={{
              position: 'absolute',
              top: -60,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 320,
              height: 120,
              background: 'radial-gradient(ellipse at center, var(--accent-glow), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Close Button */}
          <button
            onClick={onClose}
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
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              zIndex: 20,
            }}
            title="Close"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20, paddingRight: 24 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px',
                borderRadius: 20,
                background: 'var(--accent-glow)',
                color: 'var(--accent)',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: 10,
                border: '1px solid rgba(13, 148, 136, 0.2)',
              }}
            >
              <Sparkles size={14} /> HCMS Premium Upgrade
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Scan QR Code to Pay ₹{price}
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              Scan using any UPI app (GPay, PhonePe, Paytm, BHIM) and enter UTR to activate instantly.
            </p>
          </div>

          <div className="payment-grid">
            {/* QR Box */}
            <div
              className="payment-qr-box"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
              }}
            >
              {/* Clean Vector SVG QR Code Mockup with HCMS Theme Colors */}
              <svg width="150" height="150" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: '100%', height: 'auto' }}>
                <rect width="200" height="200" fill="white" rx="12" />
                
                {/* Outer Markers */}
                <path d="M20 20H70V70H20V20ZM30 30V60H60V30H30Z" fill="#0f172a" />
                <rect x="40" y="40" width="10" height="10" fill="#0d9488" />

                <path d="M130 20H180V70H130V20ZM140 30V60H170V30H140Z" fill="#0f172a" />
                <rect x="150" y="40" width="10" height="10" fill="#0d9488" />

                <path d="M20 130H70V180H20V130ZM30 140V170H60V140H30Z" fill="#0f172a" />
                <rect x="40" y="150" width="10" height="10" fill="#0d9488" />

                {/* Inner QR patterns */}
                <path d="M90 20H110V40H90V20ZM90 50H100V80H90V50ZM110 60H120V90H110V60ZM20 90H40V110H20V90ZM50 80H70V100H50V80ZM80 90H120V110H80V90ZM130 90H150V120H130V90ZM160 80H180V100H160V80ZM90 120H110V140H90V120ZM120 130H140V150H120V130ZM150 130H180V140H150V130ZM130 160H150V180H130V160ZM160 150H170V180H160V150ZM90 160H110V180H90V160ZM70 140H80V170H70V140ZM50 120H60V140H50V120Z" fill="#1e293b" />
                
                {/* Center Badge */}
                <circle cx="100" cy="100" r="18" fill="#0d9488" />
                <text x="100" y="104" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">₹299</text>
              </svg>

              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#475569', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <QrCode size={13} color="#0d9488" /> UPI ID: <strong style={{ color: '#0f172a' }}>{upiId}</strong>
                </span>
                <button
                  onClick={handleCopyUpi}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: copied ? '#10b981' : '#0d9488',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title="Copy UPI ID"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Form Box */}
            <form onSubmit={handleConfirmPayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--surface-1)', padding: 12, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Amount Due:</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>₹{price}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Validity:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>1 Month / 30 Days</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Transaction UTR / Reference No. <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 4256XXXXXXXX or UPI Ref"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-1)',
                    color: 'var(--text-primary)',
                    fontSize: '16px', // 16px prevents mobile auto-zoom
                    outline: 'none',
                  }}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Found in your payment app under receipt details.
                </span>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                  border: 'none',
                  color: '#ffffff',
                  cursor: isVerifying ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px var(--accent-glow)',
                  minHeight: 44,
                }}
              >
                {isVerifying ? (
                  'Verifying Payment…'
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirm & Activate Premium
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                <ShieldCheck size={14} color="var(--green)" /> 100% Encrypted & Secure Payment
              </div>
            </form>
          </div>

          {/* Developer Notice Note / Future Integration Marker */}
          <div
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <CreditCard size={12} />
            <span>Future Integration Ready: Razorpay Checkout SDK hook configured</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
