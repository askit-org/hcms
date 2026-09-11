'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldPlus, Check, AlertCircle, Sparkles, CheckSquare, Square } from 'lucide-react';
import { useRoleMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import type { AppModel, ModelPermission } from '@/lib/providers/types';

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_MODELS: { key: AppModel; label: string; description: string }[] = [
  { key: 'PATIENTS', label: 'Patient Records', description: 'Patient directory, registration & profile details' },
  { key: 'VISITS', label: 'OPD Visits & Rx', description: 'OPD consultations, vitals, diagnosis & prescription writing' },
  { key: 'FOLLOWUPS', label: 'Follow-Up Tracker', description: 'Today and upcoming patient follow-up appointments' },
  { key: 'MEDICINES', label: 'Medicine Inventory', description: 'Drug list, dosing defaults & inventory management' },
  { key: 'TEMPLATES', label: 'Prescription Templates', description: 'Quick diagnosis & drug template presets' },
  { key: 'REPORTS', label: 'Analytics & Financials', description: 'Revenue statistics, OPD patient volume & reports' },
  { key: 'SETTINGS', label: 'Clinic Configuration', description: 'Doctor degrees, reg numbers & letterhead settings' },
  { key: 'STAFF', label: 'Staff & Role Management', description: 'Onboarding users, dynamic roles & permission matrix' },
];

export default function CreateRoleModal({ isOpen, onClose }: CreateRoleModalProps) {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Record<AppModel, ModelPermission>>(() => {
    const initial: Partial<Record<AppModel, ModelPermission>> = {};
    ALL_MODELS.forEach((m) => {
      initial[m.key] = {
        model: m.key,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      };
    });
    return initial as Record<AppModel, ModelPermission>;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const { createRole } = useRoleMutations();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const resetForm = () => {
    setRoleName('');
    setDescription('');
    setError('');
    const initial: Partial<Record<AppModel, ModelPermission>> = {};
    ALL_MODELS.forEach((m) => {
      initial[m.key] = {
        model: m.key,
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      };
    });
    setPermissions(initial as Record<AppModel, ModelPermission>);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const togglePermission = (model: AppModel, action: 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete') => {
    setPermissions((prev) => {
      const current = prev[model];
      const newValue = !current[action];
      let updatedRead = current.canRead;
      // If setting create/update/delete to true, auto-enable read
      if (action !== 'canRead' && newValue) {
        updatedRead = true;
      }
      // If setting read to false, auto-disable all other actions
      let updatedCreate = current.canCreate;
      let updatedUpdate = current.canUpdate;
      let updatedDelete = current.canDelete;

      if (action === 'canRead' && !newValue) {
        updatedCreate = false;
        updatedUpdate = false;
        updatedDelete = false;
      }

      return {
        ...prev,
        [model]: {
          ...current,
          [action]: newValue,
          canRead: action === 'canRead' ? newValue : updatedRead,
          canCreate: action === 'canCreate' ? newValue : updatedCreate,
          canUpdate: action === 'canUpdate' ? newValue : updatedUpdate,
          canDelete: action === 'canDelete' ? newValue : updatedDelete,
        },
      };
    });
  };

  const applyPreset = (preset: 'FULL' | 'READ_ONLY' | 'CLEAR') => {
    setPermissions((prev) => {
      const next: Partial<Record<AppModel, ModelPermission>> = {};
      ALL_MODELS.forEach((m) => {
        next[m.key] = {
          model: m.key,
          canRead: preset === 'FULL' || preset === 'READ_ONLY',
          canCreate: preset === 'FULL',
          canUpdate: preset === 'FULL',
          canDelete: preset === 'FULL',
        };
      });
      return next as Record<AppModel, ModelPermission>;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setError('Please provide a unique role name (e.g. Pharmacist, Assistant)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createRole.mutateAsync({
        name: roleName.trim(),
        description: description.trim() || undefined,
        permissions: Object.values(permissions),
      });

      toast(`🎉 Role "${roleName.trim()}" created successfully!`, 'success');
      handleClose();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to create role.'));
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          zIndex: 1000020,
          background: 'rgba(10, 15, 30, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <motion.div
          className="modal"
          style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', padding: '28px 24px', zIndex: 1000030 }}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--indigo)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldPlus size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Create Custom Hospital Role
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Configure role permissions and attach model-level access controls
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="btn-icon"
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
            >
              <X size={16} />
            </button>
          </div>

          <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Role Name & Description Grid */}
            <div className="form-grid-2" style={{ gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Role Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${error ? 'has-error' : ''}`}
                  placeholder="e.g. Senior Pharmacist, Lab Technician"
                  value={roleName}
                  onChange={(e) => {
                    setRoleName(e.target.value);
                    if (error) setError('');
                  }}
                  disabled={loading}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Role Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Briefly describe responsibilities"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: 8, fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {/* Presets Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                Model Access Permissions Matrix
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset('FULL')}
                  style={{ fontSize: '0.76rem' }}
                >
                  ⚡ Select Full Access
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset('READ_ONLY')}
                  style={{ fontSize: '0.76rem' }}
                >
                  👁️ Read-Only
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => applyPreset('CLEAR')}
                  style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Permissions Matrix Table */}
            <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Module / Data Model</th>
                    <th style={{ textAlign: 'center', width: 90 }}>View (Read)</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Create (Add)</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Edit (Update)</th>
                    <th style={{ textAlign: 'center', width: 90 }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_MODELS.map((m) => {
                    const p = permissions[m.key];
                    return (
                      <tr key={m.key}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{m.description}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                            checked={p.canRead}
                            onChange={() => togglePermission(m.key, 'canRead')}
                            disabled={loading}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                            checked={p.canCreate}
                            onChange={() => togglePermission(m.key, 'canCreate')}
                            disabled={loading}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                            checked={p.canUpdate}
                            onChange={() => togglePermission(m.key, 'canUpdate')}
                            disabled={loading}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                            checked={p.canDelete}
                            onChange={() => togglePermission(m.key, 'canDelete')}
                            disabled={loading}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={loading}
                style={{ flex: 1, padding: '10px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  flex: 1.5,
                  padding: '10px',
                  background: 'linear-gradient(135deg, var(--indigo), var(--accent))',
                  fontWeight: 700,
                }}
              >
                {loading ? 'Creating Role...' : <><ShieldPlus size={16} /> Save Role & Permissions</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
