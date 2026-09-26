'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, CreditCard, Users, Receipt, Power, CalendarPlus, Ban, UserCheck, UserX, Crown, RefreshCw,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import ConfirmModal from '@/components/ConfirmModal';
import SubscriptionActionModal from '@/components/admin/SubscriptionActionModal';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { usePlatformMutations, usePlatformOrganization } from '@/lib/hooks/useQueries';
import {
  describeSubscription, formatCurrency, formatDate, formatDateTime, transactionBadgeClass,
} from '@/components/admin/format';
import type { AdminUpdateSubscriptionInput, PlatformOrganizationUser } from '@/lib/providers/types';

export default function AdminOrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  const { data: org, isLoading, isError, refetch, isFetching } = usePlatformOrganization(orgId);
  const { updateSubscription, updateUserStatus } = usePlatformMutations();

  const [actionMode, setActionMode] = useState<'activate' | 'extend' | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [userToToggle, setUserToToggle] = useState<PlatformOrganizationUser | null>(null);

  if (isLoading) return <LoadingScreen message="Loading organization..." />;
  if (isError || !org) {
    return (
      <PageTransition className="page-transition">
        <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          <ArrowLeft size={14} /> Back to organizations
        </Link>
        <ErrorState message="Could not load this organization." onRetry={() => refetch()} />
      </PageTransition>
    );
  }

  const sub = describeSubscription(org.subscription);
  const owner = org.users.find((u) => u.isOwner);

  const runSubscriptionAction = async (input: AdminUpdateSubscriptionInput) => {
    try {
      const res = await updateSubscription.mutateAsync({ orgId: org.id, input });
      toast(res?.message || 'Subscription updated', 'success');
      setActionMode(null);
      setConfirmDisable(false);
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to update subscription.'), 'error');
    }
  };

  const confirmToggleUser = async () => {
    if (!userToToggle) return;
    const next = !userToToggle.isActive;
    try {
      await updateUserStatus.mutateAsync({ userId: userToToggle.id, isActive: next, orgId: org.id });
      toast(`${userToToggle.name || userToToggle.email} ${next ? 'enabled' : 'disabled'}.`, 'success');
      setUserToToggle(null);
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to update user status.'), 'error');
    }
  };

  const infoTile = (label: string, value: React.ReactNode) => (
    <div style={{ background: 'var(--surface-1)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <PageTransition className="page-transition">
      <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginBottom: 16, display: 'inline-flex' }}>
        <ArrowLeft size={14} /> Back to organizations
      </Link>

      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} /> {org.name || 'Unnamed clinic'}
          </div>
          <div className="page-subtitle">
            {[org.city, org.address, org.phone].filter(Boolean).join(' · ') || 'No address on file'} · Joined {formatDate(org.createdAt)}
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Subscription */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={16} color="var(--accent)" /> Subscription
            <span className={`badge ${sub.badgeClass}`}>{sub.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setActionMode('activate')} disabled={updateSubscription.isPending}>
              <Power size={14} /> Activate
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setActionMode('extend')}
              disabled={updateSubscription.isPending || sub.state === 'none'}
              title={sub.state === 'none' ? 'No plan to extend — use Activate' : undefined}
            >
              <CalendarPlus size={14} /> Extend
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setConfirmDisable(true)}
              disabled={updateSubscription.isPending || sub.state === 'expired' || sub.state === 'none'}
            >
              <Ban size={14} /> Disable
            </button>
          </div>
        </div>
        <div className="form-grid form-grid-3" style={{ gap: 16 }}>
          {infoTile('Plan', sub.planLabel)}
          {infoTile('Status', org.subscription?.subscriptionStatus ?? '—')}
          {infoTile(
            'Ends',
            <>
              {formatDate(sub.endDate)}
              {sub.daysLeft !== null && sub.daysLeft > 0 && sub.state !== 'expired' && (
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}> · {sub.daysLeft} days left</span>
              )}
            </>
          )}
          {infoTile('Started', formatDate(org.subscription?.subscriptionStartDate ?? org.subscription?.trialStartDate))}
          {infoTile('Activated', formatDate(org.subscription?.activatedAt))}
          {infoTile('Last Payment', org.subscription?.paidAmount ? `${formatCurrency(org.subscription.paidAmount)} · ${org.subscription.paymentRef || '—'}` : '—')}
        </div>
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {org.patientCount} patients · {org.visitCount} visits · {org.users.length} users
          {owner ? ` · Owner: ${owner.name || owner.email}` : ''}
        </div>
      </div>

      {/* Users */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} /> Users <span className="badge badge-teal">{org.users.length}</span>
        </div>
        {org.users.length === 0 ? (
          <div className="empty-state"><Users /><h4>No users</h4></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {org.users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {u.name || '—'}
                        {u.isOwner && (
                          <span className="badge badge-amber" title="Clinic owner" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Crown size={11} /> Owner
                          </span>
                        )}
                      </span>
                    </td>
                    <td>{u.roleName || u.roleCode || (u.isOwner ? 'Owner' : '—')}</td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(u.createdAt)}</td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${u.isActive ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => setUserToToggle(u)}
                        disabled={updateUserStatus.isPending}
                      >
                        {u.isActive ? <><UserX size={14} /> Disable</> : <><UserCheck size={14} /> Enable</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={16} /> Payments
          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(latest 50)</span>
        </div>
        {org.transactions.length === 0 ? (
          <div className="empty-state"><Receipt /><h4>No payments yet</h4></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Order ID</th>
                  <th>Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {org.transactions.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(t.createdAt)}</td>
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
      </div>

      {actionMode && (
        <SubscriptionActionModal
          mode={actionMode}
          organizationName={org.name}
          currentPlan={org.subscription?.planType ?? 'none'}
          isLoading={updateSubscription.isPending}
          onClose={() => setActionMode(null)}
          onSubmit={runSubscriptionAction}
        />
      )}

      <ConfirmModal
        isOpen={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={() => runSubscriptionAction({ action: 'disable' })}
        title="Disable subscription?"
        description={`${org.name} will be marked expired immediately and all of its users will be locked out until the subscription is activated again.`}
        confirmText="Disable Subscription"
        variant="danger"
        isLoading={updateSubscription.isPending}
      />

      <ConfirmModal
        isOpen={!!userToToggle}
        onClose={() => setUserToToggle(null)}
        onConfirm={confirmToggleUser}
        title={userToToggle?.isActive ? 'Disable user?' : 'Enable user?'}
        description={
          userToToggle
            ? userToToggle.isActive
              ? `${userToToggle.name || userToToggle.email} will be signed out and unable to log in${userToToggle.isOwner ? '. This is the clinic owner.' : '.'}`
              : `${userToToggle.name || userToToggle.email} will be able to log in again.`
            : ''
        }
        confirmText={userToToggle?.isActive ? 'Disable User' : 'Enable User'}
        variant={userToToggle?.isActive ? 'warning' : 'info'}
        isLoading={updateUserStatus.isPending}
      />
    </PageTransition>
  );
}
