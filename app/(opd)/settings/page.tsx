'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthMutations, useSubscription, useSettings, useSettingsMutations } from '@/lib/hooks/useQueries';
import { FileText, Trash2, AlertTriangle, User, Edit2, Save, X, CreditCard, Sparkles, ShieldCheck, Clock, RefreshCw, Receipt, QrCode, Banknote, Plus } from 'lucide-react';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import PageTransition from '@/components/PageTransition';
import SettingsTemplates from '@/components/SettingsTemplates';
import SettingsOptions from '@/components/SettingsOptions';
import SettingsIpdRooms from '@/components/SettingsIpdRooms';
import PaymentModal from '@/components/PaymentModal';
import type { UpdateUserInput } from '@/lib/providers/types';
import { clearAppLocalStorage, clearCacheStorage, clearLocalDatabase } from '@/lib/auth/session';

export default function SettingsPage() {
  const { user } = useAuth();
  const { updateUser } = useAuthMutations();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    doctorName: '',
    email: '',
    degree: '',
    clinicName: '',
    address: '',
    phone: '',
    regNo: '',
    city: ''
  });
  const [currentPassword, setCurrentPassword] = useState('');

  const emailChanged =
    !!user && formData.email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase();

  useEffect(() => {
    if (user) {
      setFormData({
        doctorName: user.doctorName || '',
        email: user.email || '',
        degree: user.degree || '',
        clinicName: user.clinicName || '',
        address: user.address || '',
        phone: user.phone || '',
        regNo: user.regNo || '',
        city: user.city || ''
      });
    }
  }, [user]);

  const handleSave = async () => {
    // The backend requires the current password to change sign-in credentials
    if (emailChanged && !currentPassword) {
      toast('Please enter your current password to change your email.', 'error');
      return;
    }
    const { email, ...profile } = formData;
    const payload: UpdateUserInput = emailChanged
      ? { ...profile, email: email.trim(), currentPassword }
      : profile;
    try {
      await updateUser.mutateAsync(payload);
      toast('User profile updated successfully!', 'success');
      setIsEditing(false);
      setCurrentPassword('');
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to update user profile'), 'error');
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setCurrentPassword('');
    if (user) setFormData(f => ({ ...f, email: user.email || '' }));
  };

  const clearDeviceData = async () => {
    const confirmed = window.confirm(
      'Clear data on this device?\n\nThis removes cached pages, offline data and saved preferences from this browser only. ' +
      'Your clinic and patient records on the server are NOT affected, and you will stay signed in.'
    );
    if (!confirmed) return;
    await Promise.all([clearCacheStorage(), clearLocalDatabase()]);
    clearAppLocalStorage({ keepAuth: true });
    toast('Data on this device cleared. Reloading…', 'info');
    setTimeout(() => window.location.reload(), 1200);
  };

  const { data: clinicSettings } = useSettings();
  const { update: updateSettings } = useSettingsMutations();
  const [billingForm, setBillingForm] = useState({
    consultationFee: 500,
    followUpFee: 300,
    upiId: '',
    serviceRates: {
      ivInjection: 150,
      imInjection: 100,
      saline: 350,
      dressing: 200,
      nebulization: 150,
      ecg: 300,
      suture: 500,
      grbs: 80,
    },
    customServices: [] as Array<{ id: string; name: string; defaultPrice: number; category?: string }>,
  });
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomPrice, setNewCustomPrice] = useState('');
  const [isSavingBilling, setIsSavingBilling] = useState(false);

  useEffect(() => {
    if (clinicSettings) {
      const rates = (clinicSettings as any).serviceRates || {};
      setBillingForm({
        consultationFee: clinicSettings.consultationFee !== undefined ? Number(clinicSettings.consultationFee) : 500,
        followUpFee: (clinicSettings as any).followUpFee !== undefined ? Number((clinicSettings as any).followUpFee) : 300,
        upiId: clinicSettings.upiId || '',
        serviceRates: {
          ivInjection: rates.ivInjection ?? 150,
          imInjection: rates.imInjection ?? 100,
          saline: rates.saline ?? 350,
          dressing: rates.dressing ?? 200,
          nebulization: rates.nebulization ?? 150,
          ecg: rates.ecg ?? 300,
          suture: rates.suture ?? 500,
          grbs: rates.grbs ?? 80,
        },
        customServices: ((clinicSettings as any).customServices || []).map((cs: any, i: number) => ({
          id: cs.id || `cs-${i}`,
          name: cs.name || '',
          defaultPrice: Number(cs.defaultPrice ?? cs.price) || 0,
          category: cs.category,
        })),
      });
    }
  }, [clinicSettings]);

  const handleAddCustomService = () => {
    const name = newCustomName.trim();
    const price = parseFloat(newCustomPrice) || 0;
    if (!name) {
      toast('Please enter a procedure / service name', 'error');
      return;
    }
    const newService = {
      id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      defaultPrice: price,
    };
    setBillingForm(b => ({
      ...b,
      customServices: [...b.customServices, newService],
    }));
    setNewCustomName('');
    setNewCustomPrice('');
    toast(`Added ${name} (₹${price})`, 'success');
  };

  const handleRemoveCustomService = (idx: number) => {
    setBillingForm(b => ({
      ...b,
      customServices: b.customServices.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveBillingSettings = async () => {
    setIsSavingBilling(true);
    try {
      await updateSettings.mutateAsync({
        consultationFee: Number(billingForm.consultationFee) || 0,
        followUpFee: Number(billingForm.followUpFee) || 0,
        upiId: billingForm.upiId.trim() || undefined,
        serviceRates: billingForm.serviceRates,
        customServices: billingForm.customServices,
      });
      toast('Billing & default service charges saved successfully!', 'success');
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to update billing settings'), 'error');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { refetch: checkStatusApi, isFetching: isCheckingStatus } = useSubscription();
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const handleCheckSubscriptionStatus = async () => {
    try {
      const res = await checkStatusApi();
      const updatedSub = res.data;
      setLastCheckedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      if (updatedSub) {
        if (updatedSub.planType === 'premium' && updatedSub.subscriptionStatus === 'active') {
          toast('API Check Success: Premium subscription is Active!', 'success');
        } else if (updatedSub.planType === 'trial' && updatedSub.subscriptionStatus === 'trialing') {
          let days = '15';
          if (updatedSub.trialEndDate) {
            const diff = Math.max(0, Math.ceil((new Date(updatedSub.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            days = `${diff}`;
          }
          toast(`API Check Success: Free Trial Active (${days} days remaining)`, 'info');
        } else if (updatedSub.subscriptionStatus === 'expired') {
          toast('API Check Notice: Subscription has Expired. Please upgrade to continue.', 'error');
        } else {
          toast(`API Check Status: ${updatedSub.subscriptionStatus}`, 'info');
        }
      }
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to fetch subscription status from API'), 'error');
    }
  };

  if (!user) return null;

  const sub = user.subscription;
  let trialDaysLeft: number | null = null;
  let premiumDaysLeft: number | null = null;
  const endDateStr = sub?.subscriptionEndDate || sub?.trialEndDate;
  if (endDateStr) {
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    if (sub?.planType === 'trial') trialDaysLeft = diff;
    if (sub?.planType === 'premium') premiumDaysLeft = diff;
  }

  return (
    <PageTransition className="page-transition" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Your profile, subscription, and application settings</div>
        </div>
      </div>

      {/* Plan & Subscription Card */}
      <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(13, 148, 136, 0.25)', background: 'linear-gradient(135deg, var(--accent-glow), transparent)' }}>
        <div className="card-title" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 700 }}>
            <CreditCard size={18} color="var(--accent)" /> Plan & Subscription Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCheckSubscriptionStatus}
              disabled={isCheckingStatus}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={isCheckingStatus ? 'spin' : ''} />
              {isCheckingStatus ? 'Checking API…' : 'Check Status (API)'}
            </button>

            {sub?.planType !== 'premium' || sub?.subscriptionStatus !== 'active' ? (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setShowPaymentModal(true)}
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', border: 'none', boxShadow: '0 4px 12px var(--accent-glow)' }}
              >
                <Sparkles size={14} /> Upgrade to Premium
              </button>
            ) : null}
          </div>
        </div>

        <div className="form-grid form-grid-3" style={{ gap: 16 }}>
          <div style={{ background: 'var(--surface-1)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Current Plan</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {sub?.planType === 'premium' ? (
                <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={16} /> Premium Plan
                </span>
              ) : sub?.planType === 'trial' ? (
                <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={16} /> 15-Day Trial
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No Active Plan</span>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--surface-1)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status / Validity</div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: 2 }}>
              {sub?.subscriptionStatus === 'expired' ? (
                <span style={{ color: '#ef4444' }}>Subscription Expired</span>
              ) : sub?.planType === 'trial' ? (
                <span>{trialDaysLeft !== null ? `${trialDaysLeft} Days Remaining` : 'Trial Active'}</span>
              ) : sub?.planType === 'premium' ? (
                <span style={{ color: '#10b981' }}>
                  {premiumDaysLeft !== null ? `${premiumDaysLeft} Days Left (Monthly)` : 'Active Monthly Plan'}
                </span>
              ) : (
                <span style={{ color: '#ef4444' }}>Plan Selection Required</span>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--surface-1)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Payment Ref</div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: 2 }}>
              {sub?.paidAmount ? (
                <span>₹{sub.paidAmount} • {sub.paymentRef || 'Ref Verified'}</span>
              ) : sub?.planType === 'trial' ? (
                <span>15-Day Trial</span>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>

        {lastCheckedAt && (
          <div style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Last checked via API at {lastCheckedAt}</span>
          </div>
        )}
      </div>

      {/* Account Info Profile (Editable) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={16} /> Account Information
          </div>
          {!isEditing ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>
              <Edit2 size={14} /> Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={updateUser.isPending}>
                <Save size={14} /> Save
              </button>
              <button className="btn btn-ghost btn-sm" onClick={cancelEditing}>
                <X size={14} /> Cancel
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="form-grid form-grid-2">
            <div>
              <label className="form-label">Doctor Name</label>
              <input className="form-input" value={formData.doctorName} onChange={e => setFormData(f => ({ ...f, doctorName: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
            </div>
            {emailChanged && (
              <div>
                <label className="form-label">Current Password <span className="required">*</span></label>
                <input
                  className="form-input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Required to change your email"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="form-label">Degree / Specialization</label>
              <select className="form-select" value={formData.degree} onChange={e => setFormData(f => ({ ...f, degree: e.target.value }))}>
                <option value="">Select Degree</option>
                <option value="MBBS">MBBS - Bachelor of Medicine & Bachelor of Surgery</option>
                <option value="MBBS, MD (General Medicine)">MBBS, MD (General Medicine)</option>
                <option value="MBBS, MS (General Surgery)">MBBS, MS (General Surgery)</option>
                <option value="BAMS">BAMS - Bachelor of Ayurvedic Medicine & Surgery</option>
                <option value="BHMS">BHMS - Bachelor of Homeopathic Medicine & Surgery</option>
                <option value="BUMS">BUMS - Bachelor of Unani Medicine & Surgery</option>
                <option value="BDS">BDS - Bachelor of Dental Surgery</option>
                <option value="MDS">MDS - Master of Dental Surgery</option>
                <option value="MBBS, DNB">MBBS, DNB</option>
                <option value="MBBS, DGO">MBBS, DGO (Obstetrics & Gynecology)</option>
                <option value="MBBS, DCH">MBBS, DCH (Pediatrics)</option>
                <option value="MBBS, DM (Cardiology)">MBBS, DM (Cardiology)</option>
                <option value="MBBS, MCh">MBBS, MCh (Super Specialty)</option>
              </select>
            </div>
            <div>
              <label className="form-label">Clinic Name</label>
              <input className="form-input" value={formData.clinicName} onChange={e => setFormData(f => ({ ...f, clinicName: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Address</label>
              <input className="form-input" value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="form-input" value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Registration No.</label>
              <input className="form-input" value={formData.regNo} onChange={e => setFormData(f => ({ ...f, regNo: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">City</label>
              <input className="form-input" value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} />
            </div>
          </div>
        ) : (
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
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Degree</div>
              <div style={{ fontWeight: 500 }}>{user.degree || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clinic Name</div>
              <div style={{ fontWeight: 500 }}>{user.clinicName || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registration No</div>
              <div style={{ fontWeight: 500 }}>{user.regNo || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>City / Phone</div>
              <div style={{ fontWeight: 500 }}>{[user.city, user.phone].filter(Boolean).join(' · ') || '—'}</div>
            </div>
          </div>
        )}
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

      {/* Billing & UPI Payment Settings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Receipt size={16} /> OPD Billing & UPI Settings
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveBillingSettings}
            disabled={isSavingBilling}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={14} /> {isSavingBilling ? 'Saving…' : 'Save Billing Settings'}
          </button>
        </div>

        <div className="form-grid form-grid-3" style={{ marginBottom: 16 }}>
          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>Default Consultation Fee (₹)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
              <input
                type="number"
                min="0"
                step="50"
                className="form-input"
                placeholder="500"
                value={billingForm.consultationFee}
                onChange={e => setBillingForm(b => ({ ...b, consultationFee: Math.max(0, parseFloat(e.target.value) || 0) }))}
              />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Auto-populates for standard doctor OPD visits.
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>Default Follow-up Fee (₹)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
              <input
                type="number"
                min="0"
                step="50"
                className="form-input"
                placeholder="300"
                value={billingForm.followUpFee}
                onChange={e => setBillingForm(b => ({ ...b, followUpFee: Math.max(0, parseFloat(e.target.value) || 0) }))}
              />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Fee for returning follow-up patients.
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600 }}>Clinic UPI ID (QR Code)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <QrCode size={16} style={{ color: 'var(--accent)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="e.g. clinic@okhdfcbank"
                value={billingForm.upiId}
                onChange={e => setBillingForm(b => ({ ...b, upiId: e.target.value }))}
              />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
              For dynamic GooglePay / PhonePe / Paytm QR codes.
            </div>
          </div>
        </div>

        {/* Standard Procedure Charges */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Default Service & Procedure Rates</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Configured rates auto-populate when adding treatments during billing, but remain editable per bill.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>IV Injection (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.ivInjection}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, ivInjection: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>IM Injection (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.imInjection}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, imInjection: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>IV Fluid / Saline (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.saline}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, saline: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Nebulization (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.nebulization}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, nebulization: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Wound Dressing (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.dressing}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, dressing: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>ECG (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.ecg}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, ecg: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Suture / Stitching (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.suture}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, suture: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Blood Sugar (GRBS) (₹)</label>
              <input
                type="number"
                className="form-input"
                value={billingForm.serviceRates.grbs}
                onChange={e => setBillingForm(b => ({ ...b, serviceRates: { ...b.serviceRates, grbs: parseFloat(e.target.value) || 0 } }))}
              />
            </div>
          </div>
        </div>

        {/* Custom Procedures & Services */}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Custom Clinic Procedures</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            Add any other procedures specific to your clinic (e.g. Ear Syringing, Catheterization, Cannulation).
          </div>

          {billingForm.customServices.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {billingForm.customServices.map((cs, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.82rem',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{cs.name}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{cs.defaultPrice ?? (cs as any).price}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomService(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 2 }}
                    title="Remove procedure"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, maxWidth: 500 }}>
            <input
              type="text"
              placeholder="Procedure name (e.g. Ear Syringing)"
              className="form-input"
              value={newCustomName}
              onChange={e => setNewCustomName(e.target.value)}
              style={{ flex: 2, height: 34, fontSize: '0.82rem' }}
            />
            <input
              type="number"
              placeholder="Price (₹)"
              className="form-input"
              value={newCustomPrice}
              onChange={e => setNewCustomPrice(e.target.value)}
              style={{ flex: 1, height: 34, fontSize: '0.82rem' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddCustomService}
              disabled={!newCustomName.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Hospital Inpatient (IPD) Wards & Beds */}
      <SettingsIpdRooms />

      {/* Prescription Templates */}
      <SettingsTemplates />

      {/* Local device data */}
      <div className="card" style={{ marginTop: 16, marginBottom: 16, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
        <div className="card-title" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={16} color="var(--red)" /> Data on This Device
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
          Removes cached pages, offline data and saved preferences stored in this browser. Records stored on the server are not affected.
        </p>
        <button className="btn btn-danger btn-sm" onClick={clearDeviceData}>
          <Trash2 size={14} /> Clear data on this device
        </button>
      </div>

      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)} 
      />
    </PageTransition>
  );
}
