'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Users, UserRound, Stethoscope, Receipt, IndianRupee, Search, RefreshCw } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';
import { describeSubscription, formatCurrency, formatDate } from '@/components/admin/format';
import { usePlatformOrganizations, usePlatformStats } from '@/lib/hooks/useQueries';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const stats = usePlatformStats();
  const orgs = usePlatformOrganizations({ search: search || undefined, page, limit: PAGE_SIZE });
  const s = stats.data;

  const statCards = [
    { label: 'Organizations', value: s?.organizations, icon: Building2, color: 'var(--accent)', bg: 'var(--accent-glow)' },
    { label: 'Users', value: s?.users, icon: Users, color: 'var(--blue)', bg: 'rgba(59,130,246,0.1)' },
    { label: 'Patients', value: s?.patients, icon: UserRound, color: 'var(--purple)', bg: 'rgba(139,92,246,0.1)' },
    { label: 'Visits', value: s?.visits, icon: Stethoscope, color: 'var(--amber)', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Paid Transactions', value: s?.paidTransactions, icon: Receipt, color: 'var(--green)', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Revenue', value: s ? formatCurrency(s.revenue) : undefined, icon: IndianRupee, color: 'var(--green)', bg: 'rgba(16,185,129,0.1)' },
  ];

  const rows = orgs.data?.data ?? [];

  return (
    <PageTransition className="page-transition">
      <div className="page-header">
        <div>
          <div className="page-title">Platform Overview</div>
          <div className="page-subtitle">All clinics, their owners and subscriptions</div>
        </div>
        <div className="flex-wrap-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { stats.refetch(); orgs.refetch(); }}
            disabled={stats.isFetching || orgs.isFetching}
          >
            <RefreshCw size={14} className={stats.isFetching || orgs.isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="dashboard-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {statCards.map((c) => (
          <div
            key={c.label}
            className="stat-card"
            style={{ '--stat-color': c.color, '--stat-bg': c.bg } as React.CSSProperties}
          >
            <div className="stat-icon">
              <c.icon />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: typeof c.value === 'string' ? '1.35rem' : undefined }}>
                {stats.isLoading ? '…' : c.value ?? '—'}
              </div>
              <div className="stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Organizations */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} /> Organizations
            {orgs.data && <span className="badge badge-teal">{orgs.data.meta.total}</span>}
          </div>
          <div className="search-input-wrap" style={{ minWidth: 260, flex: '0 1 340px' }}>
            <span className="s-icon"><Search /></span>
            <input
              className="search-input"
              placeholder="Search clinic, owner, email or phone…"
              value={searchInput}
              maxLength={100}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {orgs.isLoading ? (
          <LoadingScreen message="Loading organizations..." />
        ) : orgs.isError ? (
          <ErrorState message="Could not load organizations." onRetry={() => orgs.refetch()} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Building2 />
            <h4>No organizations found</h4>
            <p>{search ? 'Try a different search term.' : 'No clinics have signed up yet.'}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Clinic</th>
                  <th>Owner</th>
                  <th>Users</th>
                  <th>Patients</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Ends</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((org) => {
                  const sub = describeSubscription(org.subscription);
                  const href = `/admin/organizations/${org.id}`;
                  return (
                    <tr key={org.id} style={{ cursor: 'pointer' }} onClick={() => router.push(href)}>
                      <td>
                        <Link href={href} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {org.name || 'Unnamed clinic'}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {[org.city, `Joined ${formatDate(org.createdAt)}`].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {org.owner?.name || '—'}
                          {org.owner?.isActive === false && <span className="badge badge-red">Disabled</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {[org.owner?.email, org.owner?.phone].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td>{org.userCount}</td>
                      <td>{org.patientCount}</td>
                      <td>{sub.planLabel}</td>
                      <td><span className={`badge ${sub.badgeClass}`}>{sub.label}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(sub.endDate)}
                        {sub.daysLeft !== null && sub.daysLeft > 0 && (sub.state === 'active' || sub.state === 'trial') && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub.daysLeft}d left</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination meta={orgs.data?.meta} onPageChange={setPage} disabled={orgs.isFetching} />
      </div>
    </PageTransition>
  );
}
