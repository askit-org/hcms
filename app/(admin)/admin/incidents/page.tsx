'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw,
  PlusCircle,
  Eye,
  Check,
  Building2,
  Clock,
  ShieldAlert,
  FileCode,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import Pagination from '@/components/Pagination';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { usePlatformIncidents, usePlatformMutations } from '@/lib/hooks/useQueries';
import { formatDateTime } from '@/components/admin/format';
import type { IncidentAlertItem } from '@/lib/providers/types';

const PAGE_SIZE = 25;

export default function AdminIncidentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'unresolved' | 'resolved' | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<string>('');

  // Modals
  const [inspectIncident, setInspectIncident] = useState<IncidentAlertItem | null>(null);
  const [incidentToResolve, setIncidentToResolve] = useState<IncidentAlertItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Test incident form state
  const [testService, setTestService] = useState('WHATSAPP_GATEWAY');
  const [testSeverity, setTestSeverity] = useState<'critical' | 'error' | 'warning' | 'info'>('warning');
  const [testTitle, setTestTitle] = useState('WhatsApp credit balance below threshold (< 50 credits)');
  const [testNotes, setTestNotes] = useState('{"balance": 42, "provider": "Gupshup", "threshold": 50}');

  const incidentsQuery = usePlatformIncidents({
    page,
    limit: PAGE_SIZE,
    status: statusFilter,
    severity: (severityFilter as any) || undefined,
    service: serviceFilter || undefined,
  });

  const { resolveIncident, createTestIncident } = usePlatformMutations();

  const summary = incidentsQuery.data?.summary ?? {
    totalUnresolved: 0,
    critical: 0,
    error: 0,
    warning: 0,
  };

  const handleResolve = async () => {
    if (!incidentToResolve) return;
    try {
      await resolveIncident.mutateAsync({
        id: incidentToResolve.id,
        note: resolutionNote.trim() || undefined,
      });
      toast('Incident marked as resolved', 'success');
      setIncidentToResolve(null);
      setResolutionNote('');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to resolve incident'), 'error');
    }
  };

  const handleCreateTestAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedDetails: Record<string, any> = {};
      try {
        parsedDetails = testNotes ? JSON.parse(testNotes) : {};
      } catch {
        parsedDetails = { rawNotes: testNotes };
      }

      await createTestIncident.mutateAsync({
        service: testService,
        severity: testSeverity,
        title: testTitle.trim(),
        details: parsedDetails,
      });

      toast('Test incident alert generated', 'success');
      setIsTestModalOpen(false);
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to create test alert'), 'error');
    }
  };

  const getSeverityBadge = (severity: IncidentAlertItem['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
            <ShieldAlert size={12} /> CRITICAL
          </span>
        );
      case 'error':
        return (
          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> ERROR
          </span>
        );
      case 'warning':
        return (
          <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> WARNING
          </span>
        );
      default:
        return (
          <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Info size={12} /> INFO
          </span>
        );
    }
  };

  const rows = incidentsQuery.data?.data ?? [];

  return (
    <PageTransition className="page-transition">
      <div className="page-header">
        <div>
          <div className="page-title">Delivery & Incident Alerts</div>
          <div className="page-subtitle">
            Live telemetry for WhatsApp gateway failures, payment webhook timeouts, and platform issues
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsTestModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PlusCircle size={14} /> Simulate / Test Alert
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => incidentsQuery.refetch()}
            disabled={incidentsQuery.isFetching}
          >
            <RefreshCw size={14} className={incidentsQuery.isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div
        className="dashboard-stats-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}
      >
        <div
          className="stat-card"
          style={{ '--stat-color': '#ef4444', '--stat-bg': 'rgba(239, 68, 68, 0.1)' } as React.CSSProperties}
        >
          <div className="stat-icon">
            <AlertTriangle />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.totalUnresolved}</div>
            <div className="stat-label">Total Unresolved</div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{ '--stat-color': '#dc2626', '--stat-bg': 'rgba(220, 38, 38, 0.1)' } as React.CSSProperties}
        >
          <div className="stat-icon">
            <ShieldAlert />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.critical}</div>
            <div className="stat-label">Critical Priority</div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{ '--stat-color': '#f97316', '--stat-bg': 'rgba(249, 115, 22, 0.1)' } as React.CSSProperties}
        >
          <div className="stat-icon">
            <AlertCircle />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.error}</div>
            <div className="stat-label">Errors</div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{ '--stat-color': '#f59e0b', '--stat-bg': 'rgba(245, 158, 11, 0.1)' } as React.CSSProperties}
        >
          <div className="stat-icon">
            <Info />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.warning}</div>
            <div className="stat-label">Warnings</div>
          </div>
        </div>
      </div>

      {/* Filter and Content Card */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter('all'); setPage(1); }}
            >
              All Alerts {summary.totalAll !== undefined ? `(${summary.totalAll})` : ''}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'unresolved' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter('unresolved'); setPage(1); }}
            >
              Unresolved ({summary.totalUnresolved})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter('resolved'); setPage(1); }}
            >
              Resolved {summary.totalAll !== undefined ? `(${Math.max(0, summary.totalAll - summary.totalUnresolved)})` : ''}
            </button>
          </div>

          {/* Severity & Service Dropdowns */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="select-input"
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
              style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 6 }}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            <select
              className="select-input"
              value={serviceFilter}
              onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
              style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 6 }}
            >
              <option value="">All Services</option>
              <option value="WHATSAPP_GATEWAY">WhatsApp Gateway</option>
              <option value="RAZORPAY_WEBHOOK">Razorpay Webhooks</option>
              <option value="OPD_QUEUE">OPD Queue</option>
              <option value="AUTH_SYSTEM">Auth & Security</option>
              <option value="SMS_GATEWAY">SMS Gateway</option>
            </select>
          </div>
        </div>

        {incidentsQuery.isLoading ? (
          <LoadingScreen message="Loading platform incident telemetry..." />
        ) : incidentsQuery.isError ? (
          <ErrorState message="Could not load incidents." onRetry={() => incidentsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={40} color="#10b981" />
            <h4>No incidents found</h4>
            <p>
              {statusFilter === 'unresolved'
                ? 'All platform services are operational. No active alerts!'
                : 'No incidents match the selected filters.'}
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsTestModalOpen(true)}
              style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <PlusCircle size={14} /> Simulate / Test Alert
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Service</th>
                  <th>Incident</th>
                  <th>Clinic / Org</th>
                  <th>Logged At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inc) => {
                  const isResolved = !!inc.resolvedAt;
                  return (
                    <tr key={inc.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {getSeverityBadge(inc.severity)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="badge badge-purple" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                          {inc.service}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {inc.title}
                        </div>
                        {inc.resolutionNote && (
                          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 2 }}>
                            Resolution: {inc.resolutionNote}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {inc.org_name ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={13} /> {inc.org_name}
                          </span>
                        ) : (
                          'Global / Platform'
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {formatDateTime(inc.createdAt)}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {isResolved ? (
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> Resolved
                          </span>
                        ) : (
                          <span className="badge badge-red">Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setInspectIncident(inc)}
                            title="Inspect raw telemetry payload"
                          >
                            <Eye size={12} /> View
                          </button>
                          {!isResolved && (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => {
                                setIncidentToResolve(inc);
                                setResolutionNote('');
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Check size={12} /> Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination meta={incidentsQuery.data?.meta} onPageChange={setPage} disabled={incidentsQuery.isFetching} />
      </div>

      {/* Incident Inspector Modal */}
      {inspectIncident && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setInspectIncident(null)}>
          <div
            className="modal"
            style={{ width: '100%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCode size={18} color="var(--accent)" />
                <h3>Incident Telemetry Details</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setInspectIncident(null)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.86rem' }}>
                <div>
                  <strong>Incident ID:</strong> <code style={{ fontSize: '0.78rem' }}>{inspectIncident.id}</code>
                </div>
                <div>
                  <strong>Service:</strong> {inspectIncident.service}
                </div>
                <div>
                  <strong>Severity:</strong> {getSeverityBadge(inspectIncident.severity)}
                </div>
                <div>
                  <strong>Title:</strong> {inspectIncident.title}
                </div>
                <div>
                  <strong>Logged At:</strong> {formatDateTime(inspectIncident.createdAt)}
                </div>
                {inspectIncident.resolvedAt && (
                  <div>
                    <strong>Resolved At:</strong> {formatDateTime(inspectIncident.resolvedAt)}
                  </div>
                )}
                {inspectIncident.resolutionNote && (
                  <div>
                    <strong>Resolution Note:</strong> {inspectIncident.resolutionNote}
                  </div>
                )}
                <div>
                  <strong>Telemetry Payload / Context:</strong>
                  <pre
                    style={{
                      background: 'var(--bg-secondary, #0a0a0a)',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: '0.76rem',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      marginTop: 6,
                      border: '1px solid var(--border)',
                    }}
                  >
                    {JSON.stringify(inspectIncident.details ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInspectIncident(null)}>
                Close
              </button>
              {!inspectIncident.resolvedAt && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const target = inspectIncident;
                    setInspectIncident(null);
                    setIncidentToResolve(target);
                    setResolutionNote('');
                  }}
                >
                  <Check size={13} style={{ marginRight: 4 }} /> Resolve This Incident
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {incidentToResolve && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setIncidentToResolve(null)}>
          <div
            className="modal"
            style={{ width: '100%', maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#10b981" />
                <h3>Resolve Incident</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setIncidentToResolve(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Marking <strong>{incidentToResolve.title}</strong> as resolved. This will clear the active badge and record your note into the superadmin audit trail.
              </p>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                Resolution Notes (Optional)
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Added credit balance on Gupshup, retried failed webhook payload, verified connectivity."
                value={resolutionNote}
                maxLength={500}
                onChange={(e) => setResolutionNote(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIncidentToResolve(null)}
                disabled={resolveIncident.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleResolve}
                disabled={resolveIncident.isPending}
              >
                {resolveIncident.isPending ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate / Test Alert Modal */}
      {isTestModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setIsTestModalOpen(false)}>
          <div
            className="modal"
            style={{ width: '100%', maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateTestAlert}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PlusCircle size={18} color="var(--accent)" />
                  <h3>Simulate / Trigger Test Alert</h3>
                </div>
                <button type="button" className="btn-icon" onClick={() => setIsTestModalOpen(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Trigger a synthetic incident into the platform telemetry system to verify alert indicators and resolution workflows.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Target Service
                  </label>
                  <select
                    className="select-input"
                    value={testService}
                    onChange={(e) => setTestService(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="WHATSAPP_GATEWAY">WHATSAPP_GATEWAY</option>
                    <option value="RAZORPAY_WEBHOOK">RAZORPAY_WEBHOOK</option>
                    <option value="OPD_QUEUE">OPD_QUEUE</option>
                    <option value="SYSTEM">SYSTEM</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Severity
                  </label>
                  <select
                    className="select-input"
                    value={testSeverity}
                    onChange={(e) => setTestSeverity(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                    <option value="critical">Critical</option>
                    <option value="info">Info</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Alert Title
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    required
                    maxLength={200}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Payload / Notes (JSON or text)
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={testNotes}
                    onChange={(e) => setTestNotes(e.target.value)}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsTestModalOpen(false)}
                  disabled={createTestIncident.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={createTestIncident.isPending || !testTitle.trim()}
                >
                  {createTestIncident.isPending ? 'Logging...' : 'Trigger Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
