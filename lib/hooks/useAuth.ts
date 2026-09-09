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
