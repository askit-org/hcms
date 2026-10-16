'use client';

import { CheckCircle2, Circle, Sparkles, MessageSquare, AlertCircle } from 'lucide-react';
import { usePlatformOnboarding } from '@/lib/hooks/useQueries';
import LoadingScreen from '@/components/LoadingScreen';

interface Props {
  orgId: string;
  phone?: string | null;
  ownerName?: string | null;
}

export default function ClinicOnboardingCard({ orgId, phone, ownerName }: Props) {
  const { data: res, isLoading, isError } = usePlatformOnboarding(orgId);

  if (isLoading) {
    return (
      <div className="card" style={{ marginBottom: 16, padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)' }}>
          <span className="spin">⏳</span> Loading onboarding checklist...
        </div>
      </div>
    );
  }

  if (isError || !res?.data) {
    return null;
  }

  const { progressPercent, completedCount, totalMilestones, milestones, isFullyOnboarded } = res.data;

  const handleWhatsAppHelp = (milestoneLabel: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Hello ${ownerName || 'Doctor'}, this is Aman from HCMS. I noticed your clinic setup is at ${progressPercent}%. Would you like a quick 5-minute walkthrough to help you with "${milestoneLabel}"?`,
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const nextStep = milestones.find((m) => !m.isCompleted);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        className="card-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="var(--accent)" />
          <span>Clinic Onboarding & Health Tracker</span>
          <span
            className={`badge ${isFullyOnboarded ? 'badge-teal' : progressPercent > 50 ? 'badge-blue' : 'badge-amber'}`}
          >
            {isFullyOnboarded ? 'Fully Onboarded' : `${progressPercent}% Ready`}
          </span>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <strong>{completedCount}</strong> of <strong>{totalMilestones}</strong> milestones complete
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: 8,
          background: 'var(--surface-2)',
          borderRadius: 999,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: isFullyOnboarded
              ? 'var(--green, #10b981)'
              : 'linear-gradient(90deg, var(--accent) 0%, #3b82f6 100%)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Next Step Assistance Prompt */}
      {nextStep && phone && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem' }}>
            <AlertCircle size={16} color="#3b82f6" />
            <span>
              Next recommended step: <strong>{nextStep.label}</strong>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleWhatsAppHelp(nextStep.label)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <MessageSquare size={13} color="#25D366" /> Assist Doctor on WhatsApp
          </button>
        </div>
      )}

      {/* Milestones Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 10,
        }}
      >
        {milestones.map((m) => (
          <div
            key={m.key}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: m.isCompleted ? 'rgba(16, 185, 129, 0.25)' : 'var(--border)',
              background: m.isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'var(--surface-1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ marginTop: 2 }}>
              {m.isCompleted ? (
                <CheckCircle2 size={16} color="#10b981" />
              ) : (
                <Circle size={16} color="var(--text-muted)" />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: m.isCompleted ? 'var(--text-primary)' : 'var(--text-muted)',
                  textDecoration: m.isCompleted ? 'none' : 'none',
                }}
              >
                {m.label}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {m.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
