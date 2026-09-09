'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Stethoscope, Pill, Calendar,
  BarChart3, Settings, Activity, Search, Bell, Menu, X, LogOut, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProviderStore } from '@/lib/providers';
import { useSettings, useFollowUps } from '@/lib/hooks/useQueries';
import { useAuth, checkSubscriptionLock } from '@/lib/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { Patient } from '@/lib/providers/types';
import ThemeToggle from '@/components/ThemeToggle';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import OnboardingPlansModal from '@/components/OnboardingPlansModal';
import { getVisitDraft, clearVisitDraft } from '@/lib/visitDraft';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { href: '/patients', label: 'Patients', icon: Users, group: 'main' },
  { href: '/visits/new', label: 'New OPD Visit', icon: Stethoscope, group: 'main' },
  { href: '/prescription', label: 'Prescription', icon: Pill, group: 'clinical' },
  { href: '/followup', label: 'Follow-Up', icon: Calendar, group: 'clinical' },
  { href: '/reports', label: 'Reports', icon: BarChart3, group: 'records' },
  { href: '/medicines', label: 'Medicines', icon: Package, group: 'records' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'records' },
];

import { memo } from 'react';

const DateTime = memo(function DateTime() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <div className="datetime-display"><div className="dt-date">—</div></div>;
  return (
    <div className="datetime-display" suppressHydrationWarning>
      <div className="dt-date">{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <div className="dt-time">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
    </div>
  );
});

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const provider = useProviderStore((s) => s.provider);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const r = await provider.listPatients({ search: q });
    setResults(r.slice(0, 8));
    setOpen(r.length > 0);
  }, [provider]);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="search-wrapper" ref={ref}>
      <div className="search-input-wrap">
        <span className="s-icon"><Search /></span>
        <input
          className="search-input"
          placeholder="Search patient by name, mobile, ID…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
        />
      </div>
      {open && (
        <div className="search-dropdown">
          {results.length === 0 ? (
            <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>No patients found</div>
          ) : results.map(p => (
            <div key={p.id} className="search-result" onClick={() => {
              router.push(`/patients/${p.patientId}`);
              setOpen(false); setQuery('');
            }}>
              <div className="sr-name">{p.name}</div>
              <div className="sr-meta">{p.patientId} · {p.mobile} · {p.gender}, {p.age}y</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { today } = useFollowUps();
  const { isAuthenticated, user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [navConfirmTarget, setNavConfirmTarget] = useState<string | null>(null);
  const [showOnboardingPlans, setShowOnboardingPlans] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const subLock = checkSubscriptionLock(user?.subscription);

  useEffect(() => {
    if (useAuth.persist.hasHydrated()) {
      setHasHydrated(true);
    } else {
      const unsub = useAuth.persist.onFinishHydration(() => {
        setHasHydrated(true);
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (hasHydrated) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (subLock.isLocked) {
        setShowOnboardingPlans(true);
      }
    }
  }, [hasHydrated, isAuthenticated, user, subLock.isLocked, router]);

  const clinicName = user?.clinicName || settings?.clinicName || 'My Clinic';
  const followUpCount = today.data?.length || 0;

  useEffect(() => {
    // Seed medicines on mount - only needed if offline but safe as API call too
    useProviderStore.getState().provider.seedMedicines().catch(() => {});
  }, []);

  const groups = [
    { label: 'Main', key: 'main' },
    { label: 'Clinical', key: 'clinical' },
    { label: 'Records', key: 'records' },
  ];

  return (
    <div className="app-shell" style={{ display: mounted && isAuthenticated ? 'flex' : 'none' }}>
      {/* Mobile Backdrop Overlay */}
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

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <Link href="/dashboard" className="logo-wrap" style={{ textDecoration: 'none', display: 'block' }} onClick={() => setMobileMenuOpen(false)}>
          <div className="logo-row">
            <div className="logo-icon">
              <Activity />
            </div>
            <div className="logo-text">
              <h2>HCMS</h2>
              <p>Clinic Management</p>
            </div>
          </div>
          <div className="clinic-tagline">{clinicName}</div>
        </Link>

        <nav className="nav-scroll">
          {groups.map(g => (
            <div key={g.key}>
              <div className="nav-group-label">{g.label}</div>
              {navItems.filter(n => n.group === g.key).map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <a 
                    key={item.href} 
                    href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setMobileMenuOpen(false);
                      if (pathname.startsWith('/visits/new') && item.href !== '/visits/new') {
                        const draft = getVisitDraft();
                        if (draft && (draft.patient || draft.form.chiefComplaints || draft.form.diagnosis || draft.rxMeds.length > 0)) {
                          setNavConfirmTarget(item.href);
                          return;
                        }
                      }
                      router.push(item.href);
                    }}
                  >
                    <item.icon />
                    {item.label}
                    {item.href === '/followup' && followUpCount > 0 && (
                      <span className="nav-badge">{followUpCount}</span>
                    )}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <DateTime />
          <button 
            className="btn btn-ghost btn-sm" 
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--text-secondary)', marginTop: 8 }}
            onClick={() => {
              queryClient.cancelQueries();
              queryClient.clear();
              logout();
              router.push('/login');
            }}
          >
            <LogOut size={16} style={{ marginRight: 8 }} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-area">
        <header className="topbar">
          <button 
            className="btn-icon" 
            style={{ display: 'none' }} // Hidden by default, shown via CSS on small screens, BUT CSS does logic differently. Let's just render it and use CSS or conditional rendering
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Toggle Menu"
            id="mobile-menu-btn"
          >
            <Menu size={20} />
          </button>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', alignItems: 'center' }}>
            {followUpCount > 0 && (
              <Link href="/followup" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--amber)' }}>
                <Bell size={16} />
                {followUpCount} follow-up{followUpCount > 1 ? 's' : ''} today
              </Link>
            )}
            <SubscriptionBanner />
            <ThemeToggle />
          </div>
        </header>
        <main className="page-content fade-up">
          {children}
        </main>
      </div>
      {/* Navigation Guard Modal */}
      <AnimatePresence>
        {navConfirmTarget && (
          <div className="modal-overlay" style={{ zIndex: 99999 }}>
            <motion.div 
              className="modal modal-md" 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ padding: '24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stethoscope size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Leave OPD Visit Page?</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>You have unsaved changes in your current visit.</span>
                </div>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '20px', background: 'var(--surface-1)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                Your visit progress (patient info, complaints, diagnosis, and prescription) is auto-saved as a draft. When you return to <strong>New OPD Visit</strong>, you can continue right where you left off.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setNavConfirmTarget(null)}>
                  Stay on Visit
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={() => {
                    const target = navConfirmTarget;
                    clearVisitDraft();
                    setNavConfirmTarget(null);
                    router.push(target);
                  }}
                >
                  Discard & Leave
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => {
                    const target = navConfirmTarget;
                    setNavConfirmTarget(null);
                    router.push(target);
                  }}
                >
                  Save Draft & Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Onboarding Welcome & Plan Selection Modal */}
      <OnboardingPlansModal 
        isOpen={showOnboardingPlans || subLock.isLocked} 
        onClose={() => setShowOnboardingPlans(false)} 
        isLockout={subLock.isLocked}
        lockReason={subLock.reason}
      />
    </div>
  );
}
