'use client';

import { useState } from 'react';
import {
  Users, ShieldCheck, UserPlus, ShieldPlus, Trash2, Plus,
  CheckCircle2, AlertCircle, Building2, Key, Check, X, Shield, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useOrganizationInfo, useRoles, useStaffMutations, useRoleMutations } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import PageTransition from '@/components/PageTransition';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorState from '@/components/ErrorState';
import OnboardStaffModal from '@/components/OnboardStaffModal';
import CreateRoleModal from '@/components/CreateRoleModal';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import type { AppRole, AppModel } from '@/lib/providers/types';

const MODEL_NAMES: Record<AppModel, string> = {
  PATIENTS: 'Patients',
  VISITS: 'OPD Visits & Rx',
  FOLLOWUPS: 'Follow-ups',
  MEDICINES: 'Medicines',
  TEMPLATES: 'Templates',
  REPORTS: 'Reports',
  SETTINGS: 'Settings',
  STAFF: 'Staff & Roles',
};

export default function StaffPage() {
  const { data: orgInfo, isLoading: orgLoading, error: orgError } = useOrganizationInfo();
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { deleteStaff } = useStaffMutations();
  const { deleteRole } = useRoleMutations();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'staff' | 'roles'>('staff');
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [revokingStaffId, setRevokingStaffId] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (orgLoading || rolesLoading) return <LoadingScreen message="Loading staff and roles details..." />;
  if (orgError) return <ErrorState message="Could not load hospital organization data." />;

  const rootAdmin = orgInfo?.rootAdmin || {
    name: user?.doctorName || 'Doctor (Root Admin)',
    email: user?.email || 'doctor@clinic.com',
    degree: user?.degree || 'MBBS',
    regNo: user?.regNo || 'REG-101',
    role: 'SUPER_ADMIN',
  };

  const clinicName = orgInfo?.organization?.name || user?.clinicName || 'My Clinic & Hospital';
  const staffList = orgInfo?.staff || [];

  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery)
  );

  const handleRevokeStaff = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to revoke access for ${staffName}?`)) return;
    setRevokingStaffId(staffId);
    try {
      await deleteStaff.mutateAsync(staffId);
      toast(`Access for ${staffName} has been revoked.`, 'success');
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to revoke staff access.'), 'error');
    } finally {
      setRevokingStaffId(null);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete the role "${roleName}"?`)) return;
    setDeletingRoleId(roleId);
    try {
      await deleteRole.mutateAsync(roleId);
      toast(`Role "${roleName}" deleted successfully.`, 'success');
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to delete role.'), 'error');
    } finally {
      setDeletingRoleId(null);
    }
  };

  return (
    <PageTransition>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Hospital Staff & Role Management</div>
          <div className="page-subtitle">
            Manage team members mapped to {clinicName}, onboard new staff, and configure dynamic model permissions
          </div>
        </div>
        <div className="flex-wrap-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowRoleModal(true)}>
            <ShieldPlus size={15} /> Create Role
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowOnboardModal(true)}>
            <UserPlus size={15} /> Onboard Staff
          </button>
        </div>
      </div>

      {/* Organization Root Admin Banner */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '1.25rem',
              }}
            >
              {rootAdmin.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{rootAdmin.name}</span>
                <span className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}>
                  <ShieldCheck size={13} /> Root Account Owner / Super Admin
                </span>
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>🏥 <strong>Clinic:</strong> {clinicName}</span>
                <span>🎓 <strong>Degree:</strong> {rootAdmin.degree || 'MBBS'}</span>
                <span>📜 <strong>Reg No:</strong> {rootAdmin.regNo || 'N/A'}</span>
                <span>✉️ {rootAdmin.email}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)' }}>
            👑 Organization Creator
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '12px 20px',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: activeTab === 'staff' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'staff' ? '3px solid var(--accent)' : '3px solid transparent',
            background: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Users size={18} /> Onboarded Staff ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '12px 20px',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: activeTab === 'roles' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'roles' ? '3px solid var(--accent)' : '3px solid transparent',
            background: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderTop: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShieldCheck size={18} /> Roles & Permission Matrix ({roles.length})
        </button>
      </div>

      {/* Tab 1: Staff List */}
      {activeTab === 'staff' && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search staff by name, email, or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: 360 }}
            />
            <button className="btn btn-primary btn-sm" onClick={() => setShowOnboardModal(true)}>
              <UserPlus size={14} /> Add New Staff Member
            </button>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px', background: 'var(--surface-1)', borderRadius: 14 }}>
              <Users size={44} style={{ opacity: 0.3, marginBottom: 10 }} />
              <h4>No Staff Members Found</h4>
              <p style={{ maxWidth: 400 }}>
                {searchQuery ? 'No staff matched your search query.' : 'Onboard your front-desk receptionists, assistants, or compounders to manage clinic operations.'}
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowOnboardModal(true)} style={{ marginTop: 12 }}>
                <Plus size={14} /> Onboard Staff Now
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Assigned Role</th>
                    <th>Email Address</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s) => {
                    const roleObj = roles.find((r) => r.id === s.roleId || r.code === s.role);
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: 'rgba(13, 148, 136, 0.15)',
                                color: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                              }}
                            >
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            {s.name}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue" style={{ fontWeight: 600 }}>
                            📋 {roleObj?.name || s.roleName || s.role}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{s.email}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{s.phone}</td>
                        <td>
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> Active
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRevokeStaff(s.id, s.name)}
                            disabled={revokingStaffId === s.id}
                            style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <Trash2 size={13} /> {revokingStaffId === s.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Defined Roles & Model Permissions</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Each role controls which models (`Patients`, `Visits`, `Medicines`, etc.) staff members can read, create, or modify.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRoleModal(true)}>
              <ShieldPlus size={15} /> + Create Custom Role
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {roles.map((r) => (
              <div key={r.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {r.name}
                      </h4>
                      {r.isSystemRole ? (
                        <span className="badge badge-teal" style={{ fontSize: '0.74rem' }}>
                          🔒 System Default Role
                        </span>
                      ) : (
                        <span className="badge badge-amber" style={{ fontSize: '0.74rem' }}>
                          ✨ Custom Hospital Role
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                      {r.description || 'No description specified'}
                    </p>
                  </div>

                  {!r.isSystemRole && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDeleteRole(r.id, r.name)}
                      disabled={deletingRoleId === r.id}
                      style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    >
                      <Trash2 size={13} /> Delete Role
                    </button>
                  )}
                </div>

                {/* Permissions Grid Preview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {r.permissions.map((p) => {
                    const hasAny = p.canRead || p.canCreate || p.canUpdate || p.canDelete;
                    return (
                      <div
                        key={p.model}
                        style={{
                          background: hasAny ? 'var(--surface-1)' : 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '10px 12px',
                          opacity: p.canRead ? 1 : 0.5,
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                          {MODEL_NAMES[p.model as AppModel] || p.model}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: '0.72rem' }}>
                          {p.canRead ? (
                            <span className="badge badge-teal">Read</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>No Access</span>
                          )}
                          {p.canCreate && <span className="badge badge-blue">Create</span>}
                          {p.canUpdate && <span className="badge badge-amber">Edit</span>}
                          {p.canDelete && <span className="badge badge-red">Delete</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <OnboardStaffModal isOpen={showOnboardModal} onClose={() => setShowOnboardModal(false)} />
      <CreateRoleModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
    </PageTransition>
  );
}
