'use client';

import { ShieldAlert, LogOut } from 'lucide-react';
import { useSupportSession } from '@/lib/hooks/useSupportSession';

export default function SupportModeBanner() {
  const { isImpersonating, supportSessionUser, supportReason, exitSupportSession } = useSupportSession();

  if (!isImpersonating || !supportSessionUser) {
    return null;
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #b45309 0%, #d97706 50%, #b45309 100%)',
        color: '#ffffff',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        fontSize: '0.85rem',
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 6,
            padding: '3px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 700,
            letterSpacing: '0.5px',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
          }}
        >
          <ShieldAlert size={14} color="#fef08a" />
          <span>Support Session (AMAN)</span>
        </div>
        <div>
          Viewing as <strong style={{ color: '#fef08a' }}>{supportSessionUser.doctorName}</strong>
          {supportSessionUser.clinicName ? ` (${supportSessionUser.clinicName})` : ''}
          {supportReason ? (
            <span style={{ opacity: 0.9, marginLeft: 8 }}>
              · Reason: <em>"{supportReason}"</em>
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={exitSupportSession}
        style={{
          background: '#18181b',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6,
          padding: '5px 12px',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#27272a')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#18181b')}
      >
        <LogOut size={13} /> Exit Support Session
      </button>
    </div>
  );
}
