'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { AdminUpdateSubscriptionInput } from '@/lib/providers/types';

export const MIN_GRANT_DAYS = 1;
export const MAX_GRANT_DAYS = 3650;

const DEFAULT_DAYS: Record<'trial' | 'premium', number> = { trial: 15, premium: 30 };

interface SubscriptionActionModalProps {
  mode: 'activate' | 'extend';
  organizationName: string;
  /** Plan preselected for "activate" (and shown for "extend"). */
  currentPlan?: 'trial' | 'premium' | 'none';
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (input: AdminUpdateSubscriptionInput) => void;
}

/** Collects plan/days for the platform "activate" and "extend" subscription actions. Mount only while open. */
export default function SubscriptionActionModal({
  mode,
  organizationName,
  currentPlan = 'none',
  isLoading = false,
  onClose,
  onSubmit,
}: SubscriptionActionModalProps) {
  const [planType, setPlanType] = useState<'trial' | 'premium'>(currentPlan === 'trial' ? 'trial' : 'premium');
  const [days, setDays] = useState<string>(String(DEFAULT_DAYS[currentPlan === 'trial' ? 'trial' : 'premium']));

  const parsedDays = Number(days);
  const daysValid = Number.isInteger(parsedDays) && parsedDays >= MIN_GRANT_DAYS && parsedDays <= MAX_GRANT_DAYS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daysValid || isLoading) return;
    onSubmit(mode === 'activate' ? { action: 'activate', planType, days: parsedDays } : { action: 'extend', days: parsedDays });
  };

  const title = mode === 'activate' ? 'Activate Subscription' : 'Extend Subscription';

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={onClose}>
      <form
        className="modal modal-sm"
        style={{ width: '100%' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {mode === 'activate'
              ? <>Start a new subscription period for <strong>{organizationName}</strong> from today.</>
              : <>Add days to the current plan of <strong>{organizationName}</strong> (from its end date, or from today if it has already ended).</>}
          </p>

          {mode === 'activate' && (
            <div className="form-group">
              <label className="form-label">Plan</label>
              <select
                className="form-select form-input"
                value={planType}
                onChange={(e) => {
                  const next = e.target.value === 'trial' ? 'trial' : 'premium';
                  setPlanType(next);
                  setDays(String(DEFAULT_DAYS[next]));
                }}
              >
                <option value="premium">Premium</option>
                <option value="trial">Trial</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Days <span className="required">*</span></label>
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
              {daysValid ? `${parsedDays} day${parsedDays === 1 ? '' : 's'}` : `Enter a whole number between ${MIN_GRANT_DAYS} and ${MAX_GRANT_DAYS}.`}
            </span>
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
