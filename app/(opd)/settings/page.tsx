'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthMutations, useSubscription } from '@/lib/hooks/useQueries';
import { FileText, Trash2, AlertTriangle, User, Edit2, Save, X, CreditCard, Sparkles, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import PageTransition from '@/components/PageTransition';
import SettingsTemplates from '@/components/SettingsTemplates';
import SettingsOptions from '@/components/SettingsOptions';
import PaymentModal from '@/components/PaymentModal';
import { clearVisitDraft } from '@/lib/visitDraft';

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
    try {
      await updateUser.mutateAsync(formData);
      toast('User profile updated successfully!', 'success');
      setIsEditing(false);
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to update user profile'), 'error');
    }
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
  if (sub?.planType === 'trial' && sub.trialEndDate) {
    const end = new Date(sub.trialEndDate).getTime();
    const now = new Date().getTime();
    trialDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }
  if (sub?.planType === 'premium' && sub.subscriptionEndDate) {
    const end = new Date(sub.subscriptionEndDate).getTime();
    const now = new Date().getTime();
    premiumDaysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
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

            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => setShowPaymentModal(true)}
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', border: 'none', boxShadow: '0 4px 12px var(--accent-glow)' }}
            >
              <Sparkles size={14} /> {sub?.planType === 'premium' ? 'Manage Plan' : 'Upgrade to Premium (₹299)'}
            </button>
          </div>
        </div>

        <div className="form-grid form-grid-3" style={{ gap: 16 }}>
          <div style={{ background: 'var(--surface-1)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Current Plan</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {sub?.planType === 'premium' ? (
                <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={16} /> Premium Monthly (₹299/mo)
                </span>
              ) : sub?.planType === 'trial' ? (
                <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={16} /> 15-Day Free Trial
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
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Payment Ref / Price</div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: 2 }}>
              {sub?.planType === 'premium' ? (
                <span>₹{sub.paidAmount || 299}/mo • {sub.paymentRef || 'Paid'}</span>
              ) : (
                <span>₹0 (Free Trial)</span>
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
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}>
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
              <input className="form-input" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
            </div>
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

      {/* Prescription Templates */}
      <SettingsTemplates />

      {/* Draft Management */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} /> OPD Visit Draft Management
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
          If an incomplete visit form draft was saved when leaving the page, you can clear it here.
        </p>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => {
            clearVisitDraft();
            toast('Incomplete visit draft cleared successfully.', 'success');
          }}
        >
          <Trash2 size={14} /> Clear Incomplete Visit Drafts
        </button>
      </div>

      <PaymentModal 
        isOpen={showPaymentModal} 
        onClose={() => setShowPaymentModal(false)} 
      />
    </PageTransition>
  );
}
