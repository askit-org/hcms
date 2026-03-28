'use client';

import { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, User, Building2, Phone, MapPin, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { useSettings, useSettingsMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { update } = useSettingsMutations();

  const [form, setForm] = useState({
    doctorName: '', degree: '', clinicName: '', address: '', phone: '', regNo: '', city: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        doctorName: settings.doctorName || '',
        degree: settings.degree || '',
        clinicName: settings.clinicName || '',
        address: settings.address || '',
        phone: settings.phone || '',
        regNo: settings.regNo || '',
        city: settings.city || '',
      });
    }
  }, [settings]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await update.mutateAsync(form);
    setSaving(false);
    toast('Settings saved successfully!', 'success');
    window.location.reload(); // Refresh app shell clinic name
  };

  const clearAllData = async () => {
    const confirmed = prompt('Type "DELETE ALL DATA" to confirm data deletion:');
    if (confirmed !== 'DELETE ALL DATA') { toast('Deletion cancelled.', 'info'); return; }
    const dbs = indexedDB.deleteDatabase('hcms_db');
    dbs.onsuccess = () => {
      toast('All data cleared. Reloading…', 'info');
      setTimeout(() => window.location.reload(), 1500);
    };
  };

  // Prescription preview
  const previewClinic = {
    name: form.doctorName || 'Dr. Your Name',
    degree: form.degree || 'MBBS, MD',
    clinic: form.clinicName || 'Your Clinic Name',
    address: form.address,
    phone: form.phone,
    regNo: form.regNo,
  };

  if (isLoading) return <div className="page-header"><div className="page-title">Loading settings...</div></div>;

  return (
    <div className="fade-up" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Configure clinic information for prescriptions</div>
        </div>
      </div>

      <form onSubmit={save}>
        {/* Doctor / Clinic Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            <User size={14} style={{ display: 'inline', marginRight: 6 }} />Doctor Information
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Doctor Name <span className="required">*</span></label>
              <input className="form-input" placeholder="Dr. Full Name" value={form.doctorName} onChange={e => set('doctorName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Qualification / Degree</label>
              <input className="form-input" placeholder="e.g. MBBS, MD (Medicine)" value={form.degree} onChange={e => set('degree', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Registration Number</label>
              <input className="form-input" placeholder="Medical Council Reg. No." value={form.regNo} onChange={e => set('regNo', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            <Building2 size={14} style={{ display: 'inline', marginRight: 6 }} />Clinic Information
          </div>
          <div className="form-grid form-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Clinic / Hospital Name <span className="required">*</span></label>
              <input className="form-input" placeholder="My Health Clinic" value={form.clinicName} onChange={e => set('clinicName', e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Address</label>
              <textarea className="form-textarea" placeholder="Full clinic address (Street, Area, City, PIN)" style={{ minHeight: 70 }}
                value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input className="form-input" placeholder="Clinic phone number" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Prescription Preview */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            <FileText size={14} style={{ display: 'inline', marginRight: 6 }} />Prescription Header Preview
          </div>
          <div style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', color: '#fff', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{previewClinic.name}</div>
                <div style={{ opacity: 0.85, fontSize: '0.82rem', marginTop: 2 }}>{previewClinic.degree}</div>
                <div style={{ opacity: 0.85, fontSize: '0.82rem', marginTop: 4 }}>{previewClinic.clinic}</div>
              </div>
              <div style={{ textAlign: 'right', opacity: 0.85, fontSize: '0.78rem' }}>
                {previewClinic.address && <div>{previewClinic.address}</div>}
                {previewClinic.phone && <div>📞 {previewClinic.phone}</div>}
                {previewClinic.regNo && <div>Reg: {previewClinic.regNo}</div>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 32 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--red)', fontWeight: 700 }}>
          <AlertTriangle size={18} /> Danger Zone
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          Permanently delete all patient and visit data from this device. This action cannot be undone.
          Make sure you have exported your data first.
        </p>
        <button className="btn btn-danger btn-sm" onClick={clearAllData}>
          <Trash2 size={14} /> Clear All Data
        </button>
      </div>
    </div>
  );
}
