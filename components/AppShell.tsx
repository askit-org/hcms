'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Stethoscope, Pill, Calendar,
  BarChart3, Settings, Activity, Search, Bell, Menu, X, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProviderStore } from '@/lib/providers';
import { useSettings, useFollowUps } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Patient } from '@/lib/providers/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { href: '/patients', label: 'Patients', icon: Users, group: 'main' },
  { href: '/visits/new', label: 'New OPD Visit', icon: Stethoscope, group: 'main' },
  { href: '/prescription', label: 'Prescription', icon: Pill, group: 'clinical' },
  { href: '/followup', label: 'Follow-Up', icon: Calendar, group: 'clinical' },
  { href: '/reports', label: 'Reports', icon: BarChart3, group: 'records' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'records' },
];

function DateTime() {
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
}

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { data: settings } = useSettings();
  const { today } = useFollowUps();
  const { isAuthenticated, user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

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
        <div className="logo-wrap">
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
        </div>

        <nav className="nav-scroll">
          {groups.map(g => (
            <div key={g.key}>
              <div className="nav-group-label">{g.label}</div>
              {navItems.filter(n => n.group === g.key).map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}>
                    <item.icon />
                    {item.label}
                    {item.href === '/followup' && followUpCount > 0 && (
                      <span className="nav-badge">{followUpCount}</span>
                    )}
                  </Link>
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
          
          <GlobalSearch />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            {followUpCount > 0 && (
              <Link href="/followup" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--amber)' }}>
                <Bell size={16} />
                {followUpCount} follow-up{followUpCount > 1 ? 's' : ''} today
              </Link>
            )}
            <Link href="/visits/new" className="btn btn-primary btn-sm">
              <Stethoscope size={15} /> New Visit
            </Link>
          </div>
        </header>
        <main className="page-content fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}
