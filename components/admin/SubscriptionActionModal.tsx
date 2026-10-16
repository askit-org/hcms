'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, CreditCard, Users, ShieldCheck } from 'lucide-react';
import type { AdminUpdateSubscriptionInput, PlatformSubscription } from '@/lib/providers/types';

export const MIN_GRANT_DAYS = 1;
export const MAX_GRANT_DAYS = 3650;

const DEFAULT_DAYS: Record<'trial' | 'premium', number> = { trial: 15, premium: 30 };

interface SubscriptionActionModalProps {
  mode: 'activate' | 'extend';
  organizationName: string;
  currentPlan?: 'trial' | 'premium' | 'none';
  subscription?: PlatformSubscription | null;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (input: AdminUpdateSubscriptionInput) => void;
}

export default function SubscriptionActionModal({
  mode,
  organizationName,
  currentPlan = 'none',
  subscription,
  isLoading = false,
  onClose,
  onSubmit,
}: SubscriptionActionModalProps) {
  const [planType, setPlanType] = useState<'trial' | 'premium'>(currentPlan === 'trial' ? 'trial' : 'premium');
  const [days, setDays] = useState<string>(String(DEFAULT_DAYS[currentPlan === 'trial' ? 'trial' : 'premium']));
  const [customMaxDoctors, setCustomMaxDoctors] = useState<string>(subscription?.customMaxDoctors ? String(subscription.customMaxDoctors) : '');
  const [customMaxStaff, setCustomMaxStaff] = useState<string>(subscription?.customMaxStaff ? String(subscription.customMaxStaff) : '');
  const [reason, setReason] = useState<string>('');
  
  // Offline Payment recording toggle
  const [recordOfflinePayment, setRecordOfflinePayment] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('299');
  const [paymentMode, setPaymentMode] = useState<string>('upi_direct');
  const [paymentNote, setPaymentNote] = useState<string>('');

  const parsedDays = Number(days);
  const daysValid = Number.isInteger(parsedDays) && parsedDays >= MIN_GRANT_DAYS && parsedDays <= MAX_GRANT_DAYS;

  const quickDays = [7, 14, 30, 60, 90, 365];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daysValid || isLoading) return;

    const payload: AdminUpdateSubscriptionInput = {
      action: mode,
      planType: mode === 'activate' ? planType : undefined,
      days: parsedDays,
      customMaxDoctors: customMaxDoctors.trim() ? parseInt(customMaxDoctors, 10) : undefined,
      customMaxStaff: customMaxStaff.trim() ? parseInt(customMaxStaff, 10) : undefined,
      reason: reason.trim() || undefined,
    };

    if (recordOfflinePayment && Number(paymentAmount) > 0) {
      payload.recordPayment = {
        amount: Number(paymentAmount),
        paymentMode,
        note: paymentNote.trim() || undefined,
      };
    }

    onSubmit(payload);
  };

  const title = mode === 'activate' ? 'Activate Subscription' : 'Extend Subscription';

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={onClose}>
      <form
        className="modal"
        style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="var(--accent)" />
            <h3>{title}</h3>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {mode === 'activate' ? (
              <>Start a new subscription period for <strong>{organizationName}</strong> from today.</>
            ) : (
              <>Add days to the current plan of <strong>{organizationName}</strong> (from its end date, or from today if expired).</>
            )}
          </p>

          {mode === 'activate' && (
            <div className="form-group">
              <label className="form-label">Plan Type</label>
              <select
                className="form-select form-input"
                value={planType}
                onChange={(e) => {
                  const next = e.target.value === 'trial' ? 'trial' : 'premium';
                  setPlanType(next);
                  setDays(String(DEFAULT_DAYS[next]));
                }}
              >
                <option value="premium">Premium Plan (Full Access)</option>
                <option value="trial">Free Trial Plan</option>
              </select>
            </div>
          )}

          {/* Days & Quick Selector */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Duration (Days) <span className="required">*</span></span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick Select:</span>
            </label>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {quickDays.map((qd) => (
                <button
                  key={qd}
                  type="button"
                  className={`btn btn-xs ${parsedDays === qd ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDays(String(qd))}
                >
                  +{qd}d
                </button>
              ))}
            </div>

            <input
              className="form-input"
              type="number"
              inputMode="numeric"
              min={MIN_GRANT_DAYS}
              max={MAX_GRANT_DAYS}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              style={!daysValid ? { border: '2px solid var(--red)' } : undefined}
            />
            <span className="form-hint">
              {daysValid ? `${parsedDays} day${parsedDays === 1 ? '' : 's'} extension` : `Enter a whole number between ${MIN_GRANT_DAYS} and ${MAX_GRANT_DAYS}.`}
            </span>
          </div>

          {/* Seat Quotas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Doctor Seat Quota</label>
              <input
                className="form-input"
                type="number"
                placeholder="Default (Unlimited)"
                min={1}
                max={50}
                value={customMaxDoctors}
                onChange={(e) => setCustomMaxDoctors(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Staff Seat Quota</label>
              <input
                className="form-input"
                type="number"
                placeholder="Default (Unlimited)"
                min={1}
                max={100}
                value={customMaxStaff}
                onChange={(e) => setCustomMaxStaff(e.target.value)}
              />
            </div>
          </div>

          {/* Offline Payment Recording Section */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
              <input
                type="checkbox"
                checked={recordOfflinePayment}
                onChange={(e) => setRecordOfflinePayment(e.target.checked)}
              />
              <CreditCard size={15} color="var(--green)" />
              <span>Record Offline Payment (Cash / UPI direct)</span>
            </label>

            {recordOfflinePayment && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Amount (₹)</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Payment Mode</label>
                    <select
                      className="form-select form-input"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                    >
                      <option value="upi_direct">UPI Direct (GPay/PhonePe)</option>
                      <option value="cash">Cash in hand</option>
                      <option value="cheque">Bank Cheque</option>
                      <option value="bank_transfer">NEFT / IMPS Transfer</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Payment Note / Ref</label>
                  <input
                    className="form-input"
                    placeholder="e.g. UPI Ref #402847294, Cheque #00421"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Audit Reason */}
          <div className="form-group">
            <label className="form-label">
              Audit Reason <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Recorded in Audit Trail)</span>
            </label>
            <input
              className="form-input"
              placeholder="e.g. Extended trial 14 days per WhatsApp request with Dr. Sharma"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!daysValid || isLoading}>
            {isLoading ? 'Saving…' : title}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
