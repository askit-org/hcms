'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Receipt, RefreshCw } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';
import { formatCurrency, formatDateTime, transactionBadgeClass } from '@/components/admin/format';
import { usePlatformTransactions } from '@/lib/hooks/useQueries';

const PAGE_SIZE = 25;

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, isFetching, refetch } = usePlatformTransactions({ page, limit: PAGE_SIZE });
  const rows = data?.data ?? [];

  return (
    <PageTransition className="page-transition">
      <div className="page-header">
        <div>
          <div className="page-title">Transactions</div>
          <div className="page-subtitle">All subscription payments across clinics</div>
        </div>
        <div className="flex-wrap-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={16} /> Payments
          {data && <span className="badge badge-teal">{data.meta.total}</span>}
        </div>

        {isLoading ? (
          <LoadingScreen message="Loading transactions..." />
        ) : isError ? (
          <ErrorState message="Could not load transactions." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Receipt />
            <h4>No transactions yet</h4>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clinic</th>
                  <th>Amount</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Order ID</th>
                  <th>Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(t.createdAt)}</td>
                    <td>
                      {t.organizationId ? (
                        <Link href={`/admin/organizations/${t.organizationId}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {t.organizationName || 'Unnamed clinic'}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{t.organizationName || '—'}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(t.amount, t.currency)}</td>
                    <td>{t.planType || '—'}</td>
                    <td><span className={`badge ${transactionBadgeClass(t.status)}`}>{t.status}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{t.razorpayOrderId || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{t.razorpayPaymentId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination meta={data?.meta} onPageChange={setPage} disabled={isFetching} />
      </div>
    </PageTransition>
  );
}
