'use client';

import {
  TrendingUp,
  IndianRupee,
  Building2,
  Users,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import { formatCurrency } from '@/components/admin/format';
import { usePlatformAnalytics } from '@/lib/hooks/useQueries';

export default function AdminAnalyticsPage() {
  const analyticsQuery = usePlatformAnalytics();
  const data = analyticsQuery.data;

  const maxMonthlyRevenue = Math.max(
    ...(data?.monthlyRevenueTrend?.map((m) => m.revenue) || [1000]),
    1000
  );

  const conversionRate =
    data && data.totalOrgs > 0
      ? Math.round((data.activePaidClinics / data.totalOrgs) * 100)
      : 0;

  return (
    <PageTransition className="page-transition">
      <div className="page-header">
        <div>
          <div className="page-title">SaaS Business & Financial Analytics</div>
          <div className="page-subtitle">
            Live recurring revenue, ARR projections, subscription tiers, and clinic retention metrics
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => analyticsQuery.refetch()}
            disabled={analyticsQuery.isFetching}
          >
            <RefreshCw size={14} className={analyticsQuery.isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {analyticsQuery.isLoading ? (
        <LoadingScreen message="Calculating SaaS recurring revenue & cohort metrics..." />
      ) : analyticsQuery.isError ? (
        <ErrorState message="Could not load financial analytics." onRetry={() => analyticsQuery.refetch()} />
      ) : !data ? null : (
        <>
          {/* Top Headline SaaS Financials */}
          <div
            className="dashboard-stats-grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}
          >
            {/* MRR */}
            <div
              className="stat-card"
              style={{
                '--stat-color': '#10b981',
                '--stat-bg': 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              } as React.CSSProperties}
            >
              <div className="stat-icon">
                <IndianRupee />
              </div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: '#10b981' }}>
                  {formatCurrency(data.mrr)}
                </div>
                <div className="stat-label">Monthly Recurring Revenue (MRR)</div>
              </div>
            </div>

            {/* ARR */}
            <div
              className="stat-card"
              style={{
                '--stat-color': 'var(--accent)',
                '--stat-bg': 'var(--accent-glow)',
              } as React.CSSProperties}
            >
              <div className="stat-icon">
                <TrendingUp />
              </div>
              <div className="stat-info">
                <div className="stat-value">
                  {formatCurrency(data.arr)}
                </div>
                <div className="stat-label">Annualized Run Rate (ARR)</div>
              </div>
            </div>

            {/* Total Revenue */}
            <div
              className="stat-card"
              style={{
                '--stat-color': '#3b82f6',
                '--stat-bg': 'rgba(59, 130, 246, 0.1)',
              } as React.CSSProperties}
            >
              <div className="stat-icon">
                <Sparkles />
              </div>
              <div className="stat-info">
                <div className="stat-value">
                  {formatCurrency(data.totalRevenue)}
                </div>
                <div className="stat-label">All-Time Gross Collections</div>
              </div>
            </div>

            {/* ARPU */}
            <div
              className="stat-card"
              style={{
                '--stat-color': '#8b5cf6',
                '--stat-bg': 'rgba(139, 92, 246, 0.1)',
              } as React.CSSProperties}
            >
              <div className="stat-icon">
                <Users />
              </div>
              <div className="stat-info">
                <div className="stat-value">
                  {formatCurrency(data.arpu)}
                </div>
                <div className="stat-label">ARPU (Avg Revenue / Account)</div>
              </div>
            </div>
          </div>

          {/* Subscription Tier Breakdown & Funnel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
            {/* Plan Distribution Card */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieChart size={18} color="var(--accent)" />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Subscription Tier Distribution</span>
                </div>
                <span className="badge badge-purple">{data.totalOrgs} Total Clinics</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.planDistribution.map((tier) => {
                  const pct = data.totalOrgs > 0 ? Math.round((tier.count / data.totalOrgs) * 100) : 0;
                  return (
                    <div key={tier.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{tier.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          <strong>{tier.count}</strong> clinics ({pct}%)
                        </span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: 8,
                          borderRadius: 4,
                          background: 'var(--border)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: tier.color,
                            borderRadius: 4,
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: 20,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Paid Conversion Efficiency
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#10b981' }}>
                  {conversionRate}%
                </div>
              </div>
            </div>

            {/* Clinic Growth Cohort Card */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Building2 size={18} color="var(--accent)" />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Clinic Acquisition & Cohorts</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    New Clinics (This Month)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {data.growthCohort.newClinicsThisMonth}
                  </div>
                </div>

                <div
                  style={{
                    padding: '14px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                    New Clinics (Last Month)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {data.growthCohort.newClinicsLastMonth}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: 8,
                  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Month-over-Month Growth</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Acquisition trajectory compared to prior 30-day window
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {data.growthCohort.growthRatePct >= 0 ? (
                    <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <ArrowUpRight size={13} /> +{data.growthCohort.growthRatePct}%
                    </span>
                  ) : (
                    <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <ArrowDownRight size={13} /> {data.growthCohort.growthRatePct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Historical Billing Trend Bar Chart */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color="var(--accent)" />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Monthly Revenue History</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Paid & captured subscription transactions
              </div>
            </div>

            {data.monthlyRevenueTrend.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                No completed payment transactions recorded yet.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 20,
                  height: 200,
                  paddingTop: 24,
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {data.monthlyRevenueTrend.map((m) => {
                  const barHeightPct = Math.max(Math.round((m.revenue / maxMonthlyRevenue) * 100), 8);
                  return (
                    <div
                      key={m.month}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        height: '100%',
                        justifyContent: 'flex-end',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981' }}>
                        {formatCurrency(m.revenue)}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 54,
                          height: `${barHeightPct}%`,
                          background: 'linear-gradient(180deg, #10b981 0%, rgba(16, 185, 129, 0.4) 100%)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.4s ease',
                        }}
                        title={`${m.month}: ${formatCurrency(m.revenue)} (${m.count} txns)`}
                      />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {m.month}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </PageTransition>
  );
}
