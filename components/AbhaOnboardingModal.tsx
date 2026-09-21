'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  AtSign,
} from 'lucide-react';
import { useAbhaMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

interface AbhaOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: {
    name: string;
    gender: string;
    dob?: string;
    age?: string;
    mobile: string;
    abhaNumber: string;
    abhaAddress: string;
    unverifiedMobileWarning?: boolean;
  }) => void;
  initialMobile?: string;
}

export default function AbhaOnboardingModal({
  isOpen,
  onClose,
  onComplete,
  initialMobile = '',
}: AbhaOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form States
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [mobileInput, setMobileInput] = useState(initialMobile);

  // State returned from APIs
  const [txnId, setTxnId] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  // Verified Patient Info State
  const [verifiedName, setVerifiedName] = useState('');
  const [verifiedGender, setVerifiedGender] = useState('Male');
  const [verifiedDob, setVerifiedDob] = useState('');
  const [verifiedAge, setVerifiedAge] = useState('');
  const [verifiedMobile, setVerifiedMobile] = useState('');
  const [verifiedAbhaNumber, setVerifiedAbhaNumber] = useState('');
  const [confirmedAbhaAddress, setConfirmedAbhaAddress] = useState('');
  const [unverifiedMobileWarning, setUnverifiedMobileWarning] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resendTimer, setResendTimer] = useState(0);
  const [mounted, setMounted] = useState(false);

  const { requestOtp, verifyOtp, getSuggestions, confirmAddress } = useAbhaMutations();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (initialMobile && !mobileInput) {
        setMobileInput(initialMobile);
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialMobile]);

  // Resend Timer Countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const resetForm = () => {
    setStep(1);
    setAadhaarInput('');
    setOtpInput('');
    setMobileInput(initialMobile);
    setTxnId('');
    setSuggestions([]);
    setSelectedAddress('');
    setCustomAddress('');
    setVerifiedName('');
    setVerifiedGender('Male');
    setVerifiedDob('');
    setVerifiedAge('');
    setVerifiedMobile('');
    setVerifiedAbhaNumber('');
    setConfirmedAbhaAddress('');
    setUnverifiedMobileWarning(false);
    setErrors({});
    setResendTimer(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Aadhaar Formatting (XXXX XXXX XXXX)
  const handleAadhaarChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    let formatted = raw;
    if (raw.length > 4 && raw.length <= 8) {
      formatted = `${raw.slice(0, 4)} ${raw.slice(4)}`;
    } else if (raw.length > 8) {
      formatted = `${raw.slice(0, 4)} ${raw.slice(4, 8)} ${raw.slice(8)}`;
    }
    setAadhaarInput(formatted);
    if (errors.aadhaar) {
      setErrors((prev) => ({ ...prev, aadhaar: '' }));
    }
  };

  // Helper to map gender from ABDM response
  const mapGender = (g?: string) => {
    if (!g) return 'Male';
    const u = g.toUpperCase();
    if (u === 'M' || u === 'MALE') return 'Male';
    if (u === 'F' || u === 'FEMALE') return 'Female';
    return 'Other';
  };

  // Calculate DOB & Age from dayOfBirth, monthOfBirth, yearOfBirth
  const computeDobAndAge = (day?: string, month?: string, year?: string) => {
    if (!year) return { dobStr: '', ageStr: '' };
    const y = parseInt(year, 10);
    const m = month ? parseInt(month, 10) : 1;
    const d = day ? parseInt(day, 10) : 1;

    const dobStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = today.getMonth() - (m - 1);
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
      age--;
    }
    const ageStr = age >= 0 ? String(age) : '';
    return { dobStr, ageStr };
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const rawAadhaar = aadhaarInput.replace(/\D/g, '');
    if (rawAadhaar.length !== 12) {
      setErrors({ aadhaar: 'Please enter a valid 12-digit Aadhaar number.' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await requestOtp.mutateAsync({ aadhaarNumber: rawAadhaar });
      if (res?.txnId) {
        setTxnId(res.txnId);
        toast(res.message || 'OTP sent successfully to Aadhaar registered mobile!', 'success');
        setStep(2);
        setResendTimer(30);
      } else {
        toast('Failed to send OTP. Please try again.', 'error');
      }
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to send OTP to Aadhaar registered mobile.');
      setErrors({ aadhaar: msg });
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanOtp = otpInput.replace(/\D/g, '');
    if (cleanOtp.length < 6) {
      setErrors({ otp: 'Please enter 6-digit OTP.' });
      return;
    }

    const cleanMobile = mobileInput.replace(/\D/g, '');
    if (cleanMobile.length > 0 && cleanMobile.length !== 10) {
      setErrors({ mobile: 'Please enter a valid 10-digit mobile number.' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await verifyOtp.mutateAsync({
        txnId,
        otp: cleanOtp,
        mobile: cleanMobile || undefined,
      });

      const abhaNum = res.ABHANumber || res.abhaNumber || '';
      const name = res.name || '';
      const gender = mapGender(res.gender);
      const { dobStr, ageStr } = computeDobAndAge(res.dayOfBirth, res.monthOfBirth, res.yearOfBirth);
      const returnedMobile = res.mobile || cleanMobile || initialMobile;

      setVerifiedAbhaNumber(abhaNum);
      setVerifiedName(name);
      setVerifiedGender(gender);
      setVerifiedDob(dobStr);
      setVerifiedAge(ageStr);
      setVerifiedMobile(returnedMobile);

      // Check mobile discrepancy
      if (!res.mobile || (cleanMobile && res.mobile !== cleanMobile)) {
        setUnverifiedMobileWarning(true);
      } else {
        setUnverifiedMobileWarning(false);
      }

      toast('Aadhaar OTP verified successfully!', 'success');

      // Fetch ABHA address suggestions & advance to Step 3
      setStep(3);
      fetchAddressSuggestions(res.txnId || txnId);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Invalid OTP or verification failed.');
      setErrors({ otp: msg });
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Fetch Suggestions
  const fetchAddressSuggestions = async (tId: string) => {
    setSuggestionsLoading(true);
    try {
      const res = await getSuggestions(tId);
      if (res?.abhaAddressList && res.abhaAddressList.length > 0) {
        setSuggestions(res.abhaAddressList);
        setSelectedAddress(res.abhaAddressList[0]);
      }
    } catch (err: any) {
      console.warn('Could not fetch address suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Step 3: Confirm Address
  const handleConfirmAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetAddress = customAddress.trim() || selectedAddress;
    if (!targetAddress) {
      setErrors({ address: 'Please select or enter an ABHA address.' });
      return;
    }

    // Strip @abdm if user typed it, backend expects raw prefix or handles formatting
    const rawAddress = targetAddress.replace(/@abdm$/i, '').trim();

    setLoading(true);
    setErrors({});

    try {
      const res = await confirmAddress.mutateAsync({
        txnId,
        abhaAddress: rawAddress,
      });

      const finalAddress = res.abhaAddress || (rawAddress.includes('@') ? rawAddress : `${rawAddress}@abdm`);
      const finalAbhaNumber = res.abhaNumber || verifiedAbhaNumber;

      setConfirmedAbhaAddress(finalAddress);
      if (finalAbhaNumber) setVerifiedAbhaNumber(finalAbhaNumber);

      toast('ABHA address confirmed!', 'success');
      setStep(4);
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to confirm ABHA address.');
      setErrors({ address: msg });
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Complete & Auto-fill Parent Form
  const handleCompleteAutoFill = () => {
    onComplete({
      name: verifiedName,
      gender: verifiedGender,
      dob: verifiedDob,
      age: verifiedAge,
      mobile: verifiedMobile,
      abhaNumber: verifiedAbhaNumber,
      abhaAddress: confirmedAbhaAddress,
      unverifiedMobileWarning,
    });
    toast('Patient details auto-filled from ABHA profile!', 'success');
    handleClose();
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
          style={{
            width: '100%',
            maxWidth: '560px',
            padding: '28px 24px',
            zIndex: 1000030,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Create / Link ABHA Card
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Aadhaar-based ABDM Digital Health ID Onboarding
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

          {/* Stepper Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '0 8px' }}>
            {[
              { num: 1, label: 'Aadhaar' },
              { num: 2, label: 'OTP' },
              { num: 3, label: 'Address' },
              { num: 4, label: 'Review' },
            ].map((s, idx) => {
              const active = step === s.num;
              const completed = step > s.num;
              return (
                <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: completed
                          ? 'var(--green, #10b981)'
                          : active
                          ? 'var(--accent)'
                          : 'var(--surface-2)',
                        color: active || completed ? '#ffffff' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {completed ? <CheckCircle2 size={18} /> : s.num}
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: active ? 700 : 500,
                        color: active ? 'var(--accent)' : completed ? 'var(--green, #10b981)' : 'var(--text-muted)',
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        margin: '0 8px',
                        marginBottom: 16,
                        background: step > s.num ? 'var(--green, #10b981)' : 'var(--border)',
                        transition: 'background 0.2s ease',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 1: Aadhaar Input */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  12-Digit Aadhaar Number <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className={`form-input ${errors.aadhaar ? 'has-error' : ''}`}
                    style={{
                      letterSpacing: '2px',
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      ...(errors.aadhaar ? { border: '2px solid var(--red)' } : {}),
                    }}
                    placeholder="XXXX XXXX XXXX"
                    maxLength={14}
                    value={aadhaarInput}
                    onChange={(e) => handleAadhaarChange(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <ShieldCheck size={18} />
                  </div>
                </div>
                {errors.aadhaar && (
                  <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.aadhaar}
                  </span>
                )}
              </div>

              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  lineHeight: 1.4,
                }}
              >
                🔒 <strong>Aadhaar Consent:</strong> An OTP will be sent by UIDAI to the mobile number registered with your Aadhaar for identity authentication.
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || aadhaarInput.replace(/\D/g, '').length !== 12}
                  style={{
                    flex: 1.5,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    fontWeight: 600,
                  }}
                >
                  {loading ? 'Sending OTP…' : <>Send Aadhaar OTP <ArrowRight size={16} /></>}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <KeyRound size={20} color="var(--accent)" />
                <div>
                  Enter 6-digit OTP sent to Aadhaar linked mobile for Aadhaar{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    •••• {aadhaarInput.replace(/\D/g, '').slice(-4)}
                  </strong>
                </div>
              </div>

              {/* OTP Code */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Aadhaar OTP <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${errors.otp ? 'has-error' : ''}`}
                  style={{
                    letterSpacing: '6px',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    ...(errors.otp ? { border: '2px solid var(--red)' } : {}),
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''));
                    if (errors.otp) setErrors((prev) => ({ ...prev, otp: '' }));
                  }}
                  disabled={loading}
                  autoFocus
                />
                {errors.otp && (
                  <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.otp}
                  </span>
                )}
              </div>

              {/* Mobile Confirmation */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Patient Mobile Number <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  className={`form-input ${errors.mobile ? 'has-error' : ''}`}
                  style={errors.mobile ? { border: '2px solid var(--red)' } : {}}
                  placeholder="10-digit mobile number"
                  value={mobileInput}
                  onChange={(e) => {
                    setMobileInput(e.target.value.replace(/\D/g, ''));
                    if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: '' }));
                  }}
                  disabled={loading}
                />
                {errors.mobile && (
                  <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.mobile}
                  </span>
                )}
              </div>

              {/* Resend Timer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  style={{ color: 'var(--text-muted)' }}
                >
                  ← Change Aadhaar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleSendOtp}
                  disabled={loading || resendTimer > 0}
                  style={{ color: resendTimer > 0 ? 'var(--text-muted)' : 'var(--accent)' }}
                >
                  <RefreshCw size={14} className={resendTimer > 0 ? '' : 'spin'} />{' '}
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || otpInput.length !== 6}
                  style={{
                    flex: 1.5,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    fontWeight: 600,
                  }}
                >
                  {loading ? 'Verifying…' : <>Verify OTP <ArrowRight size={16} /></>}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: ABHA Address Picker */}
          {step === 3 && (
            <form onSubmit={handleConfirmAddress} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Choose ABHA Address (Health ID)
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Select one of the ABDM suggested health handles or enter a custom handle.
                </div>
              </div>

              {suggestionsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, color: 'var(--text-muted)' }}>
                  <RefreshCw size={18} className="spin" /> Fetching ABHA address suggestions…
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Suggested ABHA Handles</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {suggestions.map((addr) => {
                      const displayAddr = addr.includes('@') ? addr : `${addr}@abdm`;
                      const isSelected = selectedAddress === addr && !customAddress;
                      return (
                        <label
                          key={addr}
                          onClick={() => {
                            setSelectedAddress(addr);
                            setCustomAddress('');
                            if (errors.address) setErrors({});
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--accent-glow)' : 'var(--surface-1)',
                            color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="radio"
                            name="abhaSuggestion"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ accentColor: 'var(--accent)' }}
                          />
                          <AtSign size={16} color="var(--accent)" />
                          {displayAddr}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom Handle Input */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Or Enter Custom ABHA Address</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className={`form-input ${errors.address ? 'has-error' : ''}`}
                    style={errors.address ? { border: '2px solid var(--red)' } : {}}
                    placeholder="e.g. john.doe"
                    value={customAddress}
                    onChange={(e) => {
                      setCustomAddress(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                      if (errors.address) setErrors({});
                    }}
                    disabled={loading}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    @abdm
                  </div>
                </div>
                {errors.address && (
                  <span style={{ color: 'var(--red)', fontSize: '0.78rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={14} color="var(--red)" /> {errors.address}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || (!selectedAddress && !customAddress.trim())}
                  style={{
                    flex: 1.5,
                    background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
                    fontWeight: 600,
                  }}
                >
                  {loading ? 'Confirming…' : <>Confirm ABHA Address <ArrowRight size={16} /></>}
                </button>
              </div>
            </form>
          )}

          {/* Step 4: Review & Auto-fill Summary */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Success Badge Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.12))',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 12,
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--green, #10b981)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    ABHA Onboarding Complete!
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Patient Aadhaar identity and ABHA Health ID verified successfully.
                  </div>
                </div>
              </div>

              {/* Unverified Mobile Warning Banner */}
              {unverifiedMobileWarning && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: '0.82rem',
                    color: 'var(--amber, #f59e0b)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 500,
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    ⚠️ <strong>Unverified Mobile Warning:</strong> The Aadhaar-registered mobile number differs from the provided mobile number.
                  </div>
                </div>
              )}

              {/* Verified Details Card */}
              <div className="card" style={{ background: 'var(--surface-1)', padding: '16px' }}>
                <div className="card-title" style={{ fontSize: '0.9rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color="var(--accent)" /> Verified Patient Details
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Full Name</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{verifiedName}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Gender</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{verifiedGender}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Date of Birth / Age</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {verifiedDob || '—'} {verifiedAge ? `(${verifiedAge} yrs)` : ''}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Mobile Number</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{verifiedMobile}</strong>
                  </div>

                  <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>ABHA Number</span>
                    <strong style={{ color: 'var(--accent)', fontSize: '0.95rem' }}>{verifiedAbhaNumber}</strong>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>ABHA Address</span>
                    <strong style={{ color: 'var(--accent-light)', fontSize: '0.95rem' }}>{confirmedAbhaAddress}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleClose}
                  style={{ flex: 1 }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCompleteAutoFill}
                  style={{
                    flex: 2,
                    background: 'linear-gradient(135deg, var(--green, #10b981), var(--accent))',
                    fontWeight: 600,
                  }}
                >
                  <Sparkles size={16} /> Auto-fill Patient Form
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
