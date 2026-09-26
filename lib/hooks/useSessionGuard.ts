// lib/hooks/useSessionGuard.ts
// Signs the user out when their JWT expires, after a period of inactivity, or when another tab logs out.
'use client';

import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { AUTH_STORAGE_KEY, LAST_ACTIVITY_KEY, isTokenExpired, logout } from '@/lib/auth/session';

/** Auto-logout after this much time without user activity. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** How often the token expiry / idle state is re-checked. */
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;

const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'click', 'touchstart', 'wheel'] as const;

function readSharedActivity(): number {
  try {
    const v = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function useSessionGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let lastActivity = Date.now();
    let lastWrite = 0;

    const recordActivity = () => {
      lastActivity = Date.now();
      if (lastActivity - lastWrite >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastWrite = lastActivity;
        try {
          localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity));
        } catch {
          // ignore
        }
      }
    };

    const check = () => {
      const token = useAuth.getState().token;
      if (!token || isTokenExpired(token)) {
        logout('expired');
        return;
      }
      const latest = Math.max(lastActivity, readSharedActivity());
      if (Date.now() - latest >= IDLE_TIMEOUT_MS) {
        logout('idle');
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };

    // Another tab logged out (auth store removed) — follow it
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && e.newValue === null) logout('manual');
    };

    // A persisted session left idle past the timeout (e.g. browser closed) must not be revived by a reload
    const previous = readSharedActivity();
    if (previous > 0 && Date.now() - previous >= IDLE_TIMEOUT_MS) {
      logout('idle');
      return;
    }

    recordActivity();
    check();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(check, SESSION_CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, recordActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [enabled]);
}
