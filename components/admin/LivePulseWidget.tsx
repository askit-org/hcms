'use client';

import Link from 'next/link';
import {
  Activity,
  Building2,
  Stethoscope,
  Users,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { usePlatformLivePulse } from '@/lib/hooks/useQueries';

export default function LivePulseWidget() {
  const { data: pulse, isLoading, isFetching, refetch } = usePlatformLivePulse();

  return (
    <div
      className="card"
      style={{
        border: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, var(--card-bg) 100%)',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 10px #10b981',
              animation: 'pulse 2s infinite',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.95rem' }}>
              <span>Live OPD Operational Pulse</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: 'var(--blue, #3b82f6)',
                  fontWeight: 700,
                }}
              >
                On Demand
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Operational snapshot across clinics · Click Sync to fetch latest counts
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ fontSize: '0.78rem', gap: 6 }}
          title="Refresh live metrics on demand"
        >
          <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
          {isFetching ? 'Syncing...' : 'Sync Pulse'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        {/* Active Clinics */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <Building2 size={14} color="var(--accent)" /> Active Clinics
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLoading ? '…' : pulse?.activeClinicsToday ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>operating today</div>
        </div>

        {/* Active Doctors */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <Stethoscope size={14} color="#3b82f6" /> Active Doctors
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLoading ? '…' : pulse?.activeDoctorsToday ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>consulting today</div>
        </div>

        {/* Visits Today */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <Activity size={14} color="#10b981" /> OPD Visits
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLoading ? '…' : pulse?.visitsToday ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>created today</div>
        </div>

        {/* Live Lobby Queue */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <Users size={14} color="#f59e0b" /> In Waiting Lobby
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
            {isLoading ? '…' : pulse?.queueWaitingNow ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>queued right now</div>
        </div>

        {/* In Consultation Room */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <DoorOpen size={14} color="#8b5cf6" /> In Doctors Room
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#8b5cf6' }}>
            {isLoading ? '…' : pulse?.queueInRoomNow ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>in-room currently</div>
        </div>

        {/* Completed OPD */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <CheckCircle2 size={14} color="#10b981" /> Completed Tokens
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isLoading ? '…' : pulse?.queueCompletedToday ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>discharged today</div>
        </div>

        {/* Unresolved System Alerts */}
        <Link
          href="/admin/incidents"
          style={{
            textDecoration: 'none',
            padding: '12px 14px',
            borderRadius: 8,
            background: (pulse?.unresolvedIncidents ?? 0) > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: (pulse?.unresolvedIncidents ?? 0) > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: (pulse?.unresolvedIncidents ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>
            <AlertTriangle size={14} color={(pulse?.unresolvedIncidents ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)'} /> Active Alerts
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: (pulse?.unresolvedIncidents ?? 0) > 0 ? '#ef4444' : 'var(--text-primary)' }}>
            {isLoading ? '…' : pulse?.unresolvedIncidents ?? 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: (pulse?.unresolvedIncidents ?? 0) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
            {(pulse?.unresolvedIncidents ?? 0) > 0 ? 'action needed →' : 'all systems clear'}
          </div>
        </Link>
      </div>
    </div>
  );
}
