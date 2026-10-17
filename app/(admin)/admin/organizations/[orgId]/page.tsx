'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Building2, CreditCard, Users, Receipt, Power, CalendarPlus, Ban,
  UserCheck, UserX, Crown, RefreshCw, ShieldAlert, BadgeCheck, CheckCircle2,
  Download, Trash2, AlertTriangle,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import ConfirmModal from '@/components/ConfirmModal';
import SubscriptionActionModal from '@/components/admin/SubscriptionActionModal';
import ClinicOnboardingCard from '@/components/admin/ClinicOnboardingCard';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { usePlatformMutations, usePlatformOrganization } from '@/lib/hooks/useQueries';
import { useSupportSession } from '@/lib/hooks/useSupportSession';
import {
  describeSubscription, formatCurrency, formatDate, formatDateTime, transactionBadgeClass,
} from '@/components/admin/format';
import type { AdminUpdateSubscriptionInput, PlatformOrganizationUser } from '@/lib/providers/types';

export default function AdminOrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  const { data: org, isLoading, isError, refetch, isFetching } = usePlatformOrganization(orgId);
  const {
    updateSubscription,
    updateUserStatus,
    verifyDoctor,
    impersonateUser,
    exportOrganizationData,
    purgeOrganizationTestData,
  } = usePlatformMutations();
  const { startSupportSession } = useSupportSession();

  const [actionMode, setActionMode] = useState<'activate' | 'extend' | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [userToToggle, setUserToToggle] = useState<PlatformOrganizationUser | null>(null);

  // Impersonate modal state
  const [userToImpersonate, setUserToImpersonate] = useState<PlatformOrganizationUser | null>(null);
  const [impersonateReason, setImpersonateReason] = useState('');
  const [isImpersonatingLoading, setIsImpersonatingLoading] = useState(false);

  // Danger Zone / Export state
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeCode, setPurgeCode] = useState('');

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

  const handleToggleVerification = async (u: PlatformOrganizationUser) => {
    const nextVerified = !u.isVerifiedDoctor;
    try {
      await verifyDoctor.mutateAsync({
        userId: u.id,
        isVerified: nextVerified,
        notes: nextVerified ? 'Verified by AMAN' : 'Revoked by AMAN',
        orgId: org.id,
      });
      toast(`Doctor ${u.name || u.email} ${nextVerified ? 'verified' : 'unverified'}.`, 'success');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to update doctor verification.'), 'error');
    }
  };

  const handleLaunchSupportSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToImpersonate) return;
    if (!impersonateReason.trim()) {
      toast('Please enter a reason for this support session.', 'info');
      return;
    }

    setIsImpersonatingLoading(true);
    try {
      const res = await impersonateUser.mutateAsync({
        userId: userToImpersonate.id,
        reason: impersonateReason.trim(),
      });
      setUserToImpersonate(null);
      setImpersonateReason('');
      startSupportSession(res);
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to initiate support session.'), 'error');
      setIsImpersonatingLoading(false);
    }
  };

  const handleExportClinicData = async () => {
    try {
      const res = await exportOrganizationData.mutateAsync(org.id);
      const blob = new Blob([res.data], { type: res.contentType || 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `hcms-export-${org.name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast(`Export completed! Checksum: ${res.sha256Checksum?.slice(0, 10)}…`, 'success');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to export clinic data.'), 'error');
    }
  };

  const handlePurgeTestData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgeCode.trim()) return;
    try {
      const res = await purgeOrganizationTestData.mutateAsync({
        orgId: org.id,
        confirmationCode: purgeCode.trim(),
      });
      toast(res?.message || 'Trial/demo clinical records purged successfully.', 'success');
      setShowPurgeModal(false);
      setPurgeCode('');
      refetch();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to purge clinic data.'), 'error');
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

      {/* Onboarding Progress & Health Tracker */}
      <ClinicOnboardingCard orgId={org.id} phone={org.phone} ownerName={owner?.name} />

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
              <CalendarPlus size={14} /> Extend / Quotas
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
          {infoTile('Doctor Quota', org.subscription?.customMaxDoctors ? `${org.subscription.customMaxDoctors} doctors` : 'Default (Unlimited)')}
          {infoTile('Staff Quota', org.subscription?.customMaxStaff ? `${org.subscription.customMaxStaff} staff` : 'Default (Unlimited)')}
          {infoTile('Last Payment', org.subscription?.paidAmount ? `${formatCurrency(org.subscription.paidAmount)} · ${org.subscription.paymentRef || '—'}` : '—')}
        </div>
        <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {org.patientCount} patients · {org.visitCount} visits · {org.users.length} users
          {owner ? ` · Owner: ${owner.name || owner.email}` : ''}
        </div>
      </div>

      {/* Users & Impersonation */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} /> Users & Doctors <span className="badge badge-teal">{org.users.length}</span>
        </div>
        {org.users.length === 0 ? (
          <div className="empty-state"><Users /><h4>No users</h4></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name & Credentials</th>
                  <th>Role</th>
                  <th>Email & Phone</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {org.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.name || '—'}
                        {u.isOwner && (
                          <span className="badge badge-amber" title="Clinic owner" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Crown size={11} /> Owner
                          </span>
                        )}
                        {u.isVerifiedDoctor && (
                          <span className="badge badge-teal" title="Verified Medical License" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <BadgeCheck size={11} color="#10b981" /> Verified
                          </span>
                        )}
                      </div>
                      {(u.degree || u.regNo) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {[u.degree, u.regNo ? `Reg: ${u.regNo}` : null].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td>{u.roleName || u.roleCode || (u.isOwner ? 'Owner' : '—')}</td>
                    <td>
                      <div>{u.email}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.phone || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-green' : 'badge-red'}`}>{u.isActive ? 'Active' : 'Disabled'}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-xs ${u.isVerifiedDoctor ? 'btn-secondary' : 'btn-outline'}`}
                        onClick={() => handleToggleVerification(u)}
                        disabled={verifyDoctor.isPending}
                        title={u.isVerifiedDoctor ? 'Click to revoke verified status' : 'Click to verify doctor credentials'}
                      >
                        {u.isVerifiedDoctor ? (
                          <><CheckCircle2 size={12} color="#10b981" /> Verified</>
                        ) : (
                          <><BadgeCheck size={12} /> Verify Doctor</>
                        )}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* 1-Click Support / Impersonate Button */}
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setUserToImpersonate(u);
                            setImpersonateReason('');
                          }}
                          disabled={!u.isActive}
                          title="Open short-lived audited support session as this user"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <ShieldAlert size={13} /> Support Login
                        </button>

                        {/* Enable/Disable Toggle */}
                        <button
                          type="button"
                          className={`btn btn-sm ${u.isActive ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => setUserToToggle(u)}
                          disabled={updateUserStatus.isPending}
                        >
                          {u.isActive ? <><UserX size={13} /> Disable</> : <><UserCheck size={13} /> Enable</>}
                        </button>
                      </div>
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
          <Receipt size={16} /> Recent Transactions <span className="badge badge-teal">{org.transactions.length}</span>
        </div>
        {org.transactions.length === 0 ? (
          <div className="empty-state"><Receipt /><h4>No transactions</h4></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Payment ID</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {org.transactions.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(t.amount, t.currency)}</td>
                    <td>
                      <span className={`badge ${transactionBadgeClass(t.status)}`}>{t.status}</span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{t.planType || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {t.razorpayPaymentId || t.razorpayOrderId || '—'}
                    </td>
                    <td>{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone & Data Backup */}
      <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.25)', background: 'linear-gradient(to bottom, var(--surface-0), rgba(239, 68, 68, 0.02))' }}>
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
          <AlertTriangle size={18} /> Emergency Organization Reset & Data Export
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Manage clinic data portability and trial transitions. Full offline exports include all registered patients, clinical visits, prescriptions, and templates signed with a SHA-256 integrity hash.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.92rem', marginBottom: 6 }}>
              <Download size={16} color="var(--primary)" /> Full Standalone Offline Export
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Generates a complete JSON backup containing all clinic records (staff, patients, appointments, medicines) with an SHA-256 integrity checksum. Recorded permanently in platform audit logs.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportClinicData}
              disabled={exportOrganizationData.isPending}
            >
              <Download size={14} />
              {exportOrganizationData.isPending ? 'Generating Export…' : 'Export Full Clinic JSON'}
            </button>
          </div>

          <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.92rem', marginBottom: 6, color: '#ef4444' }}>
              <Trash2 size={16} /> Reset Trial / Demo Data
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Purges all mock patients, test clinical visits, and queue items created during trial onboarding while preserving doctors, staff logins, and subscription status intact.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              onClick={() => {
                setPurgeCode('');
                setShowPurgeModal(true);
              }}
            >
              <Trash2 size={14} /> Purge Test / Demo Data
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Action Modal */}
      {actionMode && (
        <SubscriptionActionModal
          mode={actionMode}
          organizationName={org.name}
          currentPlan={org.subscription?.planType ?? 'none'}
          subscription={org.subscription}
          isLoading={updateSubscription.isPending}
          onClose={() => setActionMode(null)}
          onSubmit={runSubscriptionAction}
        />
      )}

      {/* Impersonate Support Session Reason Modal */}
      {userToImpersonate && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setUserToImpersonate(null)}>
          <form
            className="modal modal-sm"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleLaunchSupportSession}
            style={{ width: '100%', maxWidth: 460 }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} color="#d97706" />
                <h3>Audited Support Session</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setUserToImpersonate(null)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                }}
              >
                You are about to enter <strong>{org.name}</strong> as{' '}
                <strong>{userToImpersonate.name || userToImpersonate.email}</strong>.
                This action is time-boxed and recorded in the immutable platform audit log.
              </div>

              <div className="form-group">
                <label className="form-label">
                  Support Reason <span className="required">*</span>
                </label>
                <input
                  className="form-input"
                  placeholder="e.g. Doctor called: help configuring prescription layout and printer settings"
                  value={impersonateReason}
                  onChange={(e) => setImpersonateReason(e.target.value)}
                  required
                  autoFocus
                />
                <span className="form-hint">
                  Provide a brief ticket description or call note for compliance.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUserToImpersonate(null)}
                disabled={isImpersonatingLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!impersonateReason.trim() || isImpersonatingLoading}
                style={{ background: '#d97706', borderColor: '#d97706' }}
              >
                {isImpersonatingLoading ? 'Launching…' : 'Start Support Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Disable Subscription Modal */}
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

      {/* User Enable/Disable Modal */}
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

      {/* Purge Test Data Confirmation Modal */}
      {showPurgeModal && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setShowPurgeModal(false)}>
          <form
            className="modal modal-sm"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handlePurgeTestData}
            style={{ width: '100%', maxWidth: 460 }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                <AlertTriangle size={18} />
                <h3>Purge Trial / Demo Data</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setShowPurgeModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                }}
              >
                <strong>Warning: Irreversible Action.</strong> All patients, clinical visits, and active queue tokens belonging to <strong>{org.name}</strong> will be permanently wiped from the database. Staff accounts, doctor credentials, and subscriptions remain safe.
              </div>

              <div className="form-group">
                <label className="form-label">
                  To confirm, type <code>PURGE-{org.name.replace(/\s+/g, '-').toUpperCase()}</code> or <code>CONFIRM-PURGE</code>:
                </label>
                <input
                  className="form-input"
                  placeholder={`PURGE-${org.name.replace(/\s+/g, '-').toUpperCase()}`}
                  value={purgeCode}
                  onChange={(e) => setPurgeCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPurgeModal(false)}
                disabled={purgeOrganizationTestData.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={
                  purgeOrganizationTestData.isPending ||
                  (purgeCode.trim() !== `PURGE-${org.name.replace(/\s+/g, '-').toUpperCase()}` &&
                   purgeCode.trim() !== 'CONFIRM-PURGE')
                }
              >
                {purgeOrganizationTestData.isPending ? 'Purging…' : 'Permanently Purge Data'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}
