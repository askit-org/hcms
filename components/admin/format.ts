// components/admin/format.ts
// Display helpers for the platform operator (AMAN) console.

import type { PlatformSubscription } from '@/lib/providers/types';

export type SubscriptionDisplayState = 'active' | 'trial' | 'pending' | 'expired' | 'none';

export interface SubscriptionDisplay {
  state: SubscriptionDisplayState;
  label: string;
  badgeClass: string;
  planLabel: string;
  endDate: string | null;
  daysLeft: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getSubscriptionEndDate(sub: PlatformSubscription | null | undefined): string | null {
  if (!sub) return null;
  return sub.subscriptionEndDate || sub.trialEndDate || null;
}

/** Derives the effective subscription state (status + end date) for badges and tables. */
export function describeSubscription(sub: PlatformSubscription | null | undefined, now: number = Date.now()): SubscriptionDisplay {
  const endDate = getSubscriptionEndDate(sub);
  const endMs = endDate ? new Date(endDate).getTime() : NaN;
  const daysLeft = Number.isFinite(endMs) ? Math.ceil((endMs - now) / DAY_MS) : null;
  const planLabel = !sub || sub.planType === 'none' ? 'No plan' : sub.planType === 'premium' ? 'Premium' : 'Trial';

  if (!sub || sub.planType === 'none' || !sub.hasSelectedPlan) {
    return { state: 'none', label: 'No plan', badgeClass: 'badge-purple', planLabel, endDate, daysLeft };
  }
  if (sub.subscriptionStatus === 'pending_payment') {
    return { state: 'pending', label: 'Pending payment', badgeClass: 'badge-amber', planLabel, endDate, daysLeft };
  }
  if (sub.subscriptionStatus === 'expired' || (daysLeft !== null && daysLeft <= 0)) {
    return { state: 'expired', label: 'Expired', badgeClass: 'badge-red', planLabel, endDate, daysLeft };
  }
  if (sub.planType === 'trial') {
    return { state: 'trial', label: 'Trial', badgeClass: 'badge-blue', planLabel, endDate, daysLeft };
  }
  return { state: 'active', label: 'Active', badgeClass: 'badge-green', planLabel, endDate, daysLeft };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatCurrency(amount: number | null | undefined, currency = 'INR'): string {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function transactionBadgeClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'captured') return 'badge-green';
  if (s === 'failed') return 'badge-red';
  if (s === 'created' || s === 'pending' || s === 'authorized') return 'badge-amber';
  return 'badge-blue';
}
