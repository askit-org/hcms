'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, ShieldCheck, AlertCircle, Lock, Users, Sparkles, Phone, Mail, User } from 'lucide-react';
import { useStaffMutations, useRoles } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { onboardStaffSchema, validateForm } from '@/lib/validations/schemas';

interface OnboardStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardStaffModal({ isOpen, onClose }: OnboardStaffModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);

  const { onboardStaff } = useStaffMutations();
  const { data: roles = [] } = useRoles();

  useEffect(() => {
    if (roles.length > 0 && !roleId) {
      const recRole = roles.find((r) => r.code === 'RECEPTIONIST') || roles[0];
      if (recRole) setRoleId(recRole.id);
    }
  }, [roles, roleId]);

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
    setName('');
    setEmail('');
    setPhone('');
    if (roles.length > 0) setRoleId(roles[0].id);
    setPassword('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const selectedRole = roles.find((r) => r.id === roleId) || roles[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const roleVal = selectedRole?.code || 'RECEPTIONIST';

    const { isValid, errors: validationErrors } = await validateForm(onboardStaffSchema, {
      name,
      email,
      phone,
      role: roleVal,
      password,
    });

    if (!isValid) {
      setErrors(validationErrors as Record<string, string>);
      return;
    }

    setLoading(true);

    try {
      await onboardStaff.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        roleId: selectedRole?.id,
        role: roleVal,
        password: password.trim() || undefined,
      });

      toast(`🎉 Staff member ${name.trim()} onboarded as ${selectedRole?.name || 'Staff'}!`, 'success');
      handleClose();
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to onboard staff.'), 'error');
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
          style={{ width: '100%', maxWidth: '520px', padding: '28px 24px', zIndex: 1000030 }}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'var(--accent-glow)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Onboard Clinic Receptionist
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Create staff account for OPD front-desk & queue management
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

          <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Staff Name */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className={`form-input ${errors.name ? 'has-error' : ''}`}
                  style={errors.name ? { border: '2px solid var(--red)' } : {}}
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  disabled={loading}
                />
              </div>
              {errors.name && (
                <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={14} color="var(--red)" /> {errors.name}
                </span>
              )}
            </div>

            {/* Email Address */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                className={`form-input ${errors.email ? 'has-error' : ''}`}
                style={errors.email ? { border: '2px solid var(--red)' } : {}}
                placeholder="receptionist@clinic.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                disabled={loading}
              />
              {errors.email && (
                <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={14} color="var(--red)" /> {errors.email}
                </span>
              )}
            </div>

            {/* Mobile / Phone Number */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Phone Number <span className="required">*</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                className={`form-input ${errors.phone ? 'has-error' : ''}`}
                style={errors.phone ? { border: '2px solid var(--red)' } : {}}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                disabled={loading}
              />
              {errors.phone && (
                <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={14} color="var(--red)" /> {errors.phone}
                </span>
              )}
            </div>

            {/* Role Selection */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Assigned Role <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={loading}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isSystemRole ? '(Default System Role)' : '(Custom Role)'}
                  </option>
                ))}
              </select>
              {selectedRole && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  {selectedRole.description || `Assigned to ${selectedRole.name} with custom model permissions.`}
                </span>
              )}
            </div>

            {/* Initial Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Initial Login Password (Optional)</label>
              <input
                type="password"
                className={`form-input ${errors.password ? 'has-error' : ''}`}
                style={errors.password ? { border: '2px solid var(--red)' } : {}}
                placeholder="Leave blank for auto-generated password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                disabled={loading}
              />
              {errors.password && (
                <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={14} color="var(--red)" /> {errors.password}
                </span>
              )}
            </div>

            {/* Submit & Cancel Buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                  fontWeight: 600,
                }}
              >
                {loading ? 'Onboarding...' : <><UserPlus size={16} /> Complete Onboarding</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
