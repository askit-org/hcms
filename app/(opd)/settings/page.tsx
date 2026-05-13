'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { FileText, Trash2, AlertTriangle, User } from 'lucide-react';
import { toast } from '@/components/Toast';
import PageTransition from '@/components/PageTransition';
import SettingsTemplates from '@/components/SettingsTemplates';
import SettingsOptions from '@/components/SettingsOptions';

export default function SettingsPage() {
  const { user } = useAuth();

  const clearAllData = async () => {
    const confirmed = prompt('Type "DELETE ALL DATA" to confirm data deletion:');
    if (confirmed !== 'DELETE ALL DATA') { toast('Deletion cancelled.', 'info'); return; }
    const dbs = indexedDB.deleteDatabase('hcms_db');
    dbs.onsuccess = () => {
      toast('All data cleared. Reloading…', 'info');
      setTimeout(() => window.location.reload(), 1500);
    };
  };

  if (!user) return null;

  return (
    <PageTransition className="page-transition" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Your profile and application settings</div>
        </div>
      </div>

      {/* Account Info Profile (Read Only) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <User size={16} /> Account Information
        </div>
        <div className="form-grid form-grid-2">
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Doctor Name</div>
            <div style={{ fontWeight: 500 }}>{user.doctorName || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</div>
            <div style={{ fontWeight: 500 }}>{user.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clinic Name</div>
            <div style={{ fontWeight: 500 }}>{user.clinicName || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registration No</div>
            <div style={{ fontWeight: 500 }}>{user.regNo || '—'}</div>
          </div>
        </div>
        <div style={{ marginTop: '16px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          To update your clinic details, please contact technical support.
        </div>
      </div>

      {/* Prescription Preview */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} /> Prescription Header Preview
        </div>
        <div style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', color: '#fff', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user.doctorName}</div>
              <div style={{ opacity: 0.85, fontSize: '0.82rem', marginTop: 2 }}>{user.degree}</div>
              <div style={{ opacity: 0.85, fontSize: '0.82rem', marginTop: 4 }}>{user.clinicName}</div>
            </div>
            <div style={{ textAlign: 'right', opacity: 0.85, fontSize: '0.78rem' }}>
              {user.address && <div>{user.address}</div>}
              {user.phone && <div>📞 {user.phone}</div>}
              {user.regNo && <div>Reg: {user.regNo}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Configurable Options */}
      <SettingsOptions />

      {/* Prescription Templates */}
      <SettingsTemplates />

      {/* Danger Zone */}
      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--red)', fontWeight: 700 }}>
          <AlertTriangle size={18} /> Danger Zone
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Permanently delete all local patient and visit data from this device. This action cannot be undone.
          Make sure you have exported your data first.
        </p>
        <button className="btn btn-danger btn-sm" onClick={clearAllData}>
          <Trash2 size={14} /> Clear Local Database
        </button>
      </div>
    </PageTransition>
  );
}
