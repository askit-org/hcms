'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Receipt, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions, ADMIN_HOME_ROUTE } from '@/lib/hooks/usePermissions';
import { useSessionGuard } from '@/lib/hooks/useSessionGuard';
import { isTokenExpired, logout } from '@/lib/auth/session';
import ThemeToggle from '@/components/ThemeToggle';
import LoadingScreen from '@/components/LoadingScreen';

const adminNav = [
  { href: ADMIN_HOME_ROUTE, label: 'Organizations', icon: Building2 },
  { href: `${ADMIN_HOME_ROUTE}/transactions`, label: 'Transactions', icon: Receipt },
];

/**
 * Layout + client-side guard for the platform operator (AMAN) console.
 * UI gating only — every /platform endpoint is enforced by the backend.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, token, user } = useAuth();
  const { isPlatformAdmin, getFirstAllowedRoute } = usePermissions();
  // False during SSR and the hydration render, then true once the persisted auth store is restored
  const hasHydrated = useSyncExternalStore(
    (onChange) => useAuth.persist.onFinishHydration(onChange),
    () => useAuth.persist.hasHydrated(),
    () => false
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasValidSession = isAuthenticated && !!token && !isTokenExpired(token);

  // Token expiry, idle timeout and cross-tab logout apply here too
  useSessionGuard(hasHydrated && isAuthenticated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!isPlatformAdmin) {
      router.replace(getFirstAllowedRoute());
    }
  }, [hasHydrated, isAuthenticated, isPlatformAdmin, getFirstAllowedRoute, router]);

  if (!hasHydrated || !hasValidSession || !isPlatformAdmin) {
    return <LoadingScreen message="Restoring session..." />;
  }

  const isActive = (href: string) =>
    href === ADMIN_HOME_ROUTE
      ? pathname === ADMIN_HOME_ROUTE || pathname.startsWith(`${ADMIN_HOME_ROUTE}/organizations`)
      : pathname.startsWith(href);

  return (
    <div className="app-shell" style={{ display: 'flex' }}>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            style={{ zIndex: 40, animation: 'none' }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <Link href={ADMIN_HOME_ROUTE} className="logo-wrap" style={{ textDecoration: 'none', display: 'block' }} onClick={() => setMobileMenuOpen(false)}>
          <div className="logo-row">
            <div className="logo-icon">
              <Image src="/icons/logo.png" alt="HCMS Logo" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
            </div>
            <div className="logo-text">
              <h2>HCMS</h2>
              <p>Platform Console</p>
            </div>
          </div>
          <div className="clinic-tagline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={13} /> Platform Admin
          </div>
        </Link>

        <nav className="nav-scroll">
          <div className="nav-group-label">Platform</div>
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user?.email}>
            {user?.doctorName || user?.email}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-secondary)', marginTop: 8 }}
            onClick={() => logout()}
          >
            <LogOut size={16} style={{ marginRight: 8 }} /> Log Out
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button
            className="btn-icon"
            style={{ display: 'none' }}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Toggle Menu"
            id="mobile-menu-btn"
          >
            <Menu size={20} />
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span className="badge badge-purple">AMAN</span>
            <ThemeToggle />
          </div>
        </header>
        <main className="page-content fade-up">{children}</main>
      </div>
    </div>
  );
}
