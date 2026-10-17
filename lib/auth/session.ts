// lib/auth/session.ts
// Centralized session teardown, local-data wiping, and client-side JWT expiry helpers.

import { useAuth } from '@/lib/hooks/useAuth';
import { getQueryClient } from '@/lib/queryClient';

/** zustand persist key for the auth store (see lib/hooks/useAuth.ts). */
export const AUTH_STORAGE_KEY = 'hcms-auth-storage';

/** Device-level flags that are safe to keep across users/sessions. */
const PRESERVED_KEYS = new Set<string>(['hcms_pwa_installed']);

/** sessionStorage key used to tell the login page why the user was signed out. */
export const LOGOUT_REASON_KEY = 'hcms_logout_reason';

export type LogoutReason = 'manual' | 'expired' | 'idle' | 'unauthorized';

/** Last-activity timestamp shared across tabs (used by the idle timeout). */
export const LAST_ACTIVITY_KEY = 'hcms_last_activity';

const IDB_NAME = 'hcms_db';

function isAppStorageKey(key: string): boolean {
  return key.startsWith('hcms_') || key.startsWith('hcms-');
}

/**
 * Removes app-owned localStorage keys (e.g. `hcms_hide_tx_*`, preferences).
 * The PWA install flag is always kept; the auth store is kept only when `keepAuth` is set.
 */
export function clearAppLocalStorage({ keepAuth = false }: { keepAuth?: boolean } = {}) {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isAppStorageKey(key) || PRESERVED_KEYS.has(key)) continue;
      if (keepAuth && key === AUTH_STORAGE_KEY) continue;
      toRemove.push(key);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage may be unavailable (private mode / blocked); nothing to clear
  }
}

/** Deletes every Cache Storage bucket and asks the service worker to do the same. */
export async function clearCacheStorage() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' });
  } catch {
    // No active service worker
  }
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // Cache Storage unavailable
  }
}

/** Deletes the legacy local IndexedDB database, if present. */
export function clearLocalDatabase(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve();
      const req = indexedDB.deleteDatabase(IDB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Call right after a successful login/signup: drops any cached data from a previous
 * session and resets the idle timer.
 */
export function startFreshSession() {
  try {
    // Remove all cached queries (not mutations — the login mutation is still settling)
    getQueryClient().removeQueries();
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

let loggingOut = false;

/**
 * The single logout path for the app: wipes the query cache, auth store, app localStorage,
 * Cache Storage (incl. service worker caches) and hard-navigates to /login.
 */
export async function logout(reason: LogoutReason = 'manual'): Promise<void> {
  if (typeof window === 'undefined' || loggingOut) return;
  loggingOut = true;

  try {
    const qc = getQueryClient();
    qc.cancelQueries();
    qc.clear();
  } catch {
    // ignore
  }

  try {
    useAuth.getState().logout();
    useAuth.persist.clearStorage();
  } catch {
    // ignore
  }

  clearAppLocalStorage();

  try {
    sessionStorage.clear();
    if (reason !== 'manual') sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
  } catch {
    // ignore
  }

  // Don't let a slow/unavailable Cache API block the redirect
  await Promise.race([clearCacheStorage(), new Promise((r) => setTimeout(r, 1500))]);

  window.location.replace('/login');
}

// ── JWT helpers (no signature verification — expiry is only a UX hint; the server enforces auth) ──

/** Returns the token's `exp` as epoch milliseconds, or null if it can't be read. */
export function getTokenExpiry(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64));
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True only when the token carries an `exp` claim that is in the past. */
export function isTokenExpired(token: string | null | undefined, now: number = Date.now()): boolean {
  const exp = getTokenExpiry(token);
  return exp !== null && now >= exp;
}
