// lib/hooks/useAuth.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { UserSubscription } from '../providers/types';

export interface AuthUser {
  id: string;
  doctorName: string;
  email: string;
  degree: string;
  clinicName: string;
  address: string;
  phone: string;
  regNo: string;
  city: string;
  createdAt: string;
  role?: string;
  roleId?: string;
  roleCode?: string;
  roleName?: string;
  permissions?: import('../providers/types').ModelPermission[];
  subscription?: UserSubscription;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: { user: AuthUser; token: string }) => void;
  logout: () => void;
  updateSubscription: (sub: UserSubscription) => void;
}

export interface SubscriptionLockStatus {
  isLocked: boolean;
  reason: 'no_plan' | 'trial_expired' | 'premium_expired' | null;
  daysRemaining: number | null;
}

export function checkSubscriptionLock(subscription?: UserSubscription | null): SubscriptionLockStatus {
  if (!subscription || subscription.hasSelectedPlan === false) {
    return { isLocked: true, reason: 'no_plan', daysRemaining: 0 };
  }

  if (subscription.subscriptionStatus === 'expired') {
    const reason = subscription.planType === 'trial' ? 'trial_expired' : 'premium_expired';
    return { isLocked: true, reason, daysRemaining: 0 };
  }

  if (subscription.planType === 'trial' && subscription.trialEndDate) {
    const end = new Date(subscription.trialEndDate).getTime();
    const diffDays = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return { isLocked: true, reason: 'trial_expired', daysRemaining: 0 };
    }
    return { isLocked: false, reason: null, daysRemaining: diffDays };
  }

  if (subscription.planType === 'premium' && subscription.subscriptionEndDate) {
    const end = new Date(subscription.subscriptionEndDate).getTime();
    const diffDays = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return { isLocked: true, reason: 'premium_expired', daysRemaining: 0 };
    }
    return { isLocked: false, reason: null, daysRemaining: diffDays };
  }

  if (subscription.subscriptionStatus === 'active' || subscription.subscriptionStatus === 'trialing') {
    return { isLocked: false, reason: null, daysRemaining: null };
  }

  return { isLocked: false, reason: null, daysRemaining: null };
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (data) => {
        const user = { ...data.user };
        if (!user.subscription) {
          const now = new Date();
          const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
          user.subscription = {
            planType: 'trial',
            subscriptionStatus: 'trialing',
            trialStartDate: now.toISOString(),
            trialEndDate,
            hasSelectedPlan: true,
            activatedAt: now.toISOString(),
          };
        }
        set({ user, token: data.token, isAuthenticated: true });
      },
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      updateSubscription: (subscription) =>
        set((state) => {
          if (!state.user) return state;
          if (JSON.stringify(state.user.subscription) === JSON.stringify(subscription)) {
            return state;
          }
          return {
            user: { ...state.user, subscription },
          };
        }),
    }),
    {
      name: 'hcms-auth-storage',
    }
  )
);
