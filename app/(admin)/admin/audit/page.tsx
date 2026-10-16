'use client';

import { useState } from 'react';
import {
  History, Download, Trash2, Search, Filter, ShieldCheck,
  CheckCircle2, AlertTriangle, Eye, RefreshCw, FileText, Database,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { usePlatformAuditLogs, usePlatformAuditMonths, usePlatformMutations } from '@/lib/hooks/useQueries';
import { formatDateTime } from '@/components/admin/format';
import type { PlatformAuditLogEntry, PlatformAuditMonth } from '@/lib/providers/types';

const PAGE_SIZE = 25;

export default function AdminAuditPage() {
  const [activeTab, setActiveTab] = useState<'trail' | 'archival'>('trail');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  // Inspection modal
  const [selectedLog, setSelectedLog] = useState<PlatformAuditLogEntry | null>(null);

  // Pruning modal state
  const [monthToPrune, setMonthToPrune] = useState<PlatformAuditMonth | null>(null);
  const [pruneConfirmation, setPruneConfirmation] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const auditLogs = usePlatformAuditLogs({
    page,
    limit: PAGE_SIZE,
    action: selectedAction || undefined,
    search: search.trim() || undefined,
  });

  const auditMonths = usePlatformAuditMonths();
  const { exportMonthlyAudit } = usePlatformMutations();

  const handleDownloadOnly = async (m: PlatformAuditMonth, format: 'json' | 'csv' = 'json') => {
    try {
      toast(`Generating ${m.month} archive...`, 'info');
      const res = await exportMonthlyAudit.mutateAsync({
        month: m.month,
        format,
        pruneAfterDownload: false,
      });

      // Trigger browser file download
      const blob = new Blob([res.data], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast(`Downloaded ${res.filename} (SHA-256: ${res.sha256Checksum.slice(0, 8)}…)`, 'success');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to export monthly audit.'), 'error');
    }
  };

  const handleConfirmExportAndPrune = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthToPrune) return;

    try {
      const res = await exportMonthlyAudit.mutateAsync({
        month: monthToPrune.month,
        format: exportFormat,
        pruneAfterDownload: true,
        confirmationCode: pruneConfirmation.trim(),
      });

      // Download file immediately
      const blob = new Blob([res.data], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast(
        `Exported & pruned ${res.prunedCount} records for ${res.month}! SHA-256: ${res.sha256Checksum.slice(0, 8)}…`,
        'success',
      );
      setMonthToPrune(null);
      setPruneConfirmation('');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to export and prune.'), 'error');
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'IMPERSONATE_START':
        return 'badge-amber';
      case 'SUBSCRIPTION_UPDATE':
        return 'badge-teal';
      case 'USER_STATUS_UPDATE':
        return 'badge-blue';
      case 'DOCTOR_VERIFIED':
        return 'badge-green';
      case 'AUDIT_MONTH_ARCHIVED_AND_PRUNED':
        return 'badge-purple';
      default:
        return 'badge-gray';
    }
  };

  return (
    <PageTransition className="page-transition">
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={24} /> Audit & Offline Archival
          </div>
          <div className="page-subtitle">
            Forensic operator audit trail and monthly offline database pruning
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              auditLogs.refetch();
              auditMonths.refetch();
            }}
            disabled={auditLogs.isFetching || auditMonths.isFetching}
          >
            <RefreshCw size={14} className={auditLogs.isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'trail' ? 'active' : ''}`}
          onClick={() => setActiveTab('trail')}
        >
          <History size={15} /> Live Audit Trail
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'archival' ? 'active' : ''}`}
          onClick={() => setActiveTab('archival')}
        >
          <Database size={15} /> Monthly Offline Archival & Pruning
        </button>
      </div>

      {/* TAB 1: Live Audit Trail */}
      {activeTab === 'trail' && (
        <div className="card">
          <div
            className="card-title"
            style={{
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Audit Entries</span>
              {auditLogs.data && (
                <span className="badge badge-teal">{auditLogs.data.meta.total}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="form-select form-input"
                style={{ padding: '6px 12px', fontSize: '0.82rem', minWidth: 160 }}
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Actions</option>
                <option value="IMPERSONATE_START">Support Session (Impersonate)</option>
                <option value="SUBSCRIPTION_UPDATE">Subscription Update</option>
                <option value="USER_STATUS_UPDATE">User Status Toggle</option>
                <option value="DOCTOR_VERIFIED">Doctor Verified</option>
                <option value="AUDIT_MONTH_ARCHIVED_AND_PRUNED">Monthly Prune Record</option>
              </select>

              <div className="search-input-wrap" style={{ minWidth: 220 }}>
                <span className="s-icon">
                  <Search size={14} />
                </span>
                <input
                  className="search-input"
                  placeholder="Search reason or admin email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          {auditLogs.isLoading ? (
            <LoadingScreen message="Loading audit records..." />
          ) : auditLogs.isError ? (
            <ErrorState message="Could not load audit trail." onRetry={() => auditLogs.refetch()} />
          ) : (auditLogs.data?.data.length ?? 0) === 0 ? (
            <div className="empty-state">
              <History />
              <h4>No audit logs found</h4>
              <p>Platform operator actions will appear here automatically.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Operator</th>
                      <th>Action</th>
                      <th>Reason / Note</th>
                      <th>IP Address</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.data?.data.map((log) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem' }}>
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{log.adminEmail}</td>
                        <td>
                          <span className={`badge ${getActionBadgeClass(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ maxWidth: 300, wordBreak: 'break-word' }}>
                          {log.reason || '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {log.ipAddress || '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setSelectedLog(log)}
                            title="View metadata and change diff"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {auditLogs.data && auditLogs.data.meta.total > PAGE_SIZE && (
                <div style={{ marginTop: 16 }}>
                  <Pagination
                    meta={auditLogs.data?.meta}
                    onPageChange={setPage}
                    disabled={auditLogs.isFetching}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: Monthly Offline Archival & DB Pruning */}
      {activeTab === 'archival' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Storage Information Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, var(--surface-1) 0%, rgba(59, 130, 246, 0.05) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.12)',
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 2,
                }}
              >
                <Database size={22} color="#3b82f6" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 600 }}>
                  Lightweight Database Storage Strategy
                </h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Because database disk space is valuable, you can export older audit records by month and save
                  them to your local drive or offline archive. Each export produces an immutable <strong>SHA-256 cryptographic checksum</strong> for legal verification.
                  After saving your offline copy, you can purge the records from PostgreSQL to free disk space immediately.
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Ledger Table */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>
              <span>Monthly Archive Ledger</span>
            </div>

            {auditMonths.isLoading ? (
              <LoadingScreen message="Calculating month archives..." />
            ) : auditMonths.isError ? (
              <ErrorState message="Could not load monthly archival ledger." onRetry={() => auditMonths.refetch()} />
            ) : (auditMonths.data?.length ?? 0) === 0 ? (
              <div className="empty-state">
                <Database />
                <h4>No archives available yet</h4>
                <p>As audit logs accumulate over calendar months, they will appear here for 1-click offline export.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Audit Records</th>
                      <th>Estimated Storage</th>
                      <th>Download Offline Copy</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditMonths.data?.map((m) => (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 600, fontSize: '0.94rem' }}>
                          📅 {m.month}
                        </td>
                        <td>
                          <span className="badge badge-teal">{m.recordCount} records</span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {(m.estimatedSizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleDownloadOnly(m, 'json')}
                              disabled={exportMonthlyAudit.isPending}
                            >
                              <Download size={12} /> JSON (.json)
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleDownloadOnly(m, 'csv')}
                              disabled={exportMonthlyAudit.isPending}
                            >
                              <Download size={12} /> CSV (.csv)
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => {
                              setMonthToPrune(m);
                              setPruneConfirmation('');
                            }}
                            title="Export and purge from database to free disk space"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Trash2 size={12} /> Export & Prune DB
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata / Change Diff Inspector Modal */}
      {selectedLog && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setSelectedLog(null)}>
          <div
            className="modal"
            style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="var(--accent)" />
                <h3>Audit Record Inspector</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setSelectedLog(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.86rem' }}>
                <div>
                  <strong>Action:</strong> <span className={`badge ${getActionBadgeClass(selectedLog.action)}`}>{selectedLog.action}</span>
                </div>
                <div>
                  <strong>Operator:</strong> {selectedLog.adminEmail}
                </div>
                <div>
                  <strong>Timestamp:</strong> {formatDateTime(selectedLog.createdAt)}
                </div>
                {selectedLog.reason && (
                  <div>
                    <strong>Reason / Note:</strong> {selectedLog.reason}
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <strong>IP Address:</strong> {selectedLog.ipAddress}
                  </div>
                )}
                <div>
                  <strong>Payload / Metadata:</strong>
                  <pre
                    style={{
                      background: 'var(--surface-2)',
                      padding: 12,
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      overflowX: 'auto',
                      border: '1px solid var(--border)',
                      marginTop: 6,
                    }}
                  >
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two-Step Export & Prune Confirmation Modal */}
      {monthToPrune && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setMonthToPrune(null)}>
          <form
            className="modal"
            style={{ width: '100%', maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmExportAndPrune}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="var(--red)" />
                <h3 style={{ color: 'var(--red)' }}>Export & Prune Database</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setMonthToPrune(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                }}
              >
                You are about to export <strong>{monthToPrune.recordCount} audit records</strong> for{' '}
                <strong>{monthToPrune.month}</strong> and <strong>permanently purge them from the database</strong> to
                free up server storage.
              </div>

              <div className="form-group">
                <label className="form-label">Export File Format</label>
                <select
                  className="form-select form-input"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                >
                  <option value="json">JSON format (.json)</option>
                  <option value="csv">CSV Spreadsheet format (.csv)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  To confirm, type <strong style={{ color: 'var(--red)' }}>CONFIRM-PRUNE-{monthToPrune.month}</strong>
                </label>
                <input
                  className="form-input"
                  placeholder={`CONFIRM-PRUNE-${monthToPrune.month}`}
                  value={pruneConfirmation}
                  onChange={(e) => setPruneConfirmation(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMonthToPrune(null)}
                disabled={exportMonthlyAudit.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={
                  pruneConfirmation.trim() !== `CONFIRM-PRUNE-${monthToPrune.month}` ||
                  exportMonthlyAudit.isPending
                }
              >
                {exportMonthlyAudit.isPending ? 'Processing…' : 'Export & Purge from DB'}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}
