'use client';

import { useState } from 'react';
import {
  Megaphone,
  PlusCircle,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Wrench,
  Clock,
  Building2,
  UserCheck,
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { usePlatformAnnouncements, usePlatformMutations } from '@/lib/hooks/useQueries';
import { formatDateTime } from '@/components/admin/format';
import type { SystemAnnouncement, CreateAnnouncementInput } from '@/lib/providers/types';

export default function AdminAnnouncementsPage() {
  const announcementsQuery = usePlatformAnnouncements();
  const { createAnnouncement, updateAnnouncement, deleteAnnouncement } = usePlatformMutations();

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SystemAnnouncement | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'critical' | 'maintenance'>('info');
  const [targetRole, setTargetRole] = useState<string>('');
  const [targetOrgId, setTargetOrgId] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [isDismissible, setIsDismissible] = useState(true);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<SystemAnnouncement | null>(null);

  const resetForm = () => {
    setEditingItem(null);
    setTitle('');
    setMessage('');
    setType('info');
    setTargetRole('');
    setTargetOrgId('');
    setExpiresAt('');
    setIsActive(true);
    setIsDismissible(true);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (item: SystemAnnouncement) => {
    setEditingItem(item);
    setTitle(item.title);
    setMessage(item.message);
    setType(item.type);
    setTargetRole(item.targetRole || '');
    setTargetOrgId(item.targetOrgId || '');
    setExpiresAt(item.expiresAt ? item.expiresAt.slice(0, 16) : '');
    setIsActive(item.isActive);
    setIsDismissible(item.isDismissible);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: CreateAnnouncementInput = {
        title: title.trim(),
        message: message.trim(),
        type,
        targetRole: targetRole || null,
        targetOrgId: targetOrgId.trim() || null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isActive,
        isDismissible,
      };

      if (editingItem) {
        await updateAnnouncement.mutateAsync({
          id: editingItem.id,
          input: payload,
        });
        toast('Announcement updated', 'success');
      } else {
        await createAnnouncement.mutateAsync(payload);
        toast('Announcement broadcasted', 'success');
      }
      setModalOpen(false);
      resetForm();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save announcement'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteAnnouncement.mutateAsync(itemToDelete.id);
      toast('Announcement deleted', 'success');
      setItemToDelete(null);
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to delete announcement'), 'error');
    }
  };

  const handleToggleActive = async (item: SystemAnnouncement) => {
    try {
      await updateAnnouncement.mutateAsync({
        id: item.id,
        input: { isActive: !item.isActive },
      });
      toast(`Announcement ${!item.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to update status'), 'error');
    }
  };

  const getTypeBadge = (annType: SystemAnnouncement['type']) => {
    switch (annType) {
      case 'critical':
        return (
          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> Critical
          </span>
        );
      case 'warning':
        return (
          <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> Warning
          </span>
        );
      case 'maintenance':
        return (
          <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Wrench size={12} /> Maintenance
          </span>
        );
      default:
        return (
          <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Info size={12} /> Notice
          </span>
        );
    }
  };

  const rows = announcementsQuery.data ?? [];

  return (
    <PageTransition className="page-transition">
      <div className="page-header">
        <div>
          <div className="page-title">Global In-App Banners & Announcements</div>
          <div className="page-subtitle">
            Broadcast system notices, maintenance alerts, or role-targeted messages across all clinics
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={openCreateModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PlusCircle size={14} /> New Announcement
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => announcementsQuery.refetch()}
            disabled={announcementsQuery.isFetching}
          >
            <RefreshCw size={14} className={announcementsQuery.isFetching ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      <div className="card">
        {announcementsQuery.isLoading ? (
          <LoadingScreen message="Loading announcements..." />
        ) : announcementsQuery.isError ? (
          <ErrorState message="Could not load announcements." onRetry={() => announcementsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={40} color="var(--accent)" />
            <h4>No active broadcasts</h4>
            <p>You haven&apos;t created any system banners yet. Click New Announcement to publish one.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title & Content</th>
                  <th>Target Audience</th>
                  <th>Status</th>
                  <th>Duration / Expiry</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {getTypeBadge(item.type)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.message}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <div>
                        {item.targetOrgId ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={12} /> Specific Clinic
                          </span>
                        ) : (
                          'All Clinics'
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem' }}>
                        {item.targetRole ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <UserCheck size={11} /> {item.targetRole}
                          </span>
                        ) : (
                          'All Roles'
                        )}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`badge ${item.isActive ? 'badge-green' : 'badge-gray'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Click to toggle active state"
                      >
                        {item.isActive ? 'Active' : 'Draft / Off'}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      <div>
                        Starts: {formatDateTime(item.startsAt)}
                      </div>
                      <div>
                        {item.expiresAt ? `Expires: ${formatDateTime(item.expiresAt)}` : 'No expiry'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => openEditModal(item)}
                          title="Edit announcement"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-xs"
                          onClick={() => setItemToDelete(item)}
                          title="Delete announcement"
                        >
                          <Trash2 size={12} />
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setModalOpen(false)}>
          <div
            className="modal"
            style={{ width: '100%', maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Megaphone size={18} color="var(--accent)" />
                  <h3>{editingItem ? 'Edit Announcement' : 'New Broadcast Announcement'}</h3>
                </div>
                <button type="button" className="btn-icon" onClick={() => setModalOpen(false)}>
                  ×
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={title}
                    placeholder="e.g. Scheduled Maintenance, Sunday 2:00 AM"
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={255}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Message Content
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={message}
                    placeholder="Provide details about the update, disruption, or notice..."
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                      Notice Type / Color
                    </label>
                    <select
                      className="select-input"
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      style={{ width: '100%' }}
                    >
                      <option value="info">Info (Blue)</option>
                      <option value="warning">Warning (Amber)</option>
                      <option value="critical">Critical (Red)</option>
                      <option value="maintenance">Maintenance (Purple)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                      Target Role (Audience)
                    </label>
                    <select
                      className="select-input"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">All Users (Everyone)</option>
                      <option value="SUPER_ADMIN">Clinic Super Admins Only</option>
                      <option value="DOCTOR">Doctors Only</option>
                      <option value="RECEPTIONIST">Receptionists Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Target Specific Clinic ID (Optional, leave blank for all)
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={targetOrgId}
                    placeholder="Clinic Organization UUID"
                    onChange={(e) => setTargetOrgId(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                    Expires At (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 20, paddingTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <strong>Active Immediately</strong>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isDismissible}
                      onChange={(e) => setIsDismissible(e.target.checked)}
                    />
                    <strong>Allow Users to Dismiss</strong>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={createAnnouncement.isPending || updateAnnouncement.isPending || !title.trim() || !message.trim()}
                >
                  {createAnnouncement.isPending || updateAnnouncement.isPending
                    ? 'Publishing...'
                    : editingItem
                    ? 'Save Changes'
                    : 'Broadcast Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1000050 }} onClick={() => setItemToDelete(null)}>
          <div className="modal" style={{ width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={18} color="#ef4444" />
                <h3>Delete Announcement</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setItemToDelete(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>{itemToDelete.title}</strong>? It will immediately disappear from all clinic screens.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleteAnnouncement.isPending}
              >
                {deleteAnnouncement.isPending ? 'Deleting...' : 'Delete Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
