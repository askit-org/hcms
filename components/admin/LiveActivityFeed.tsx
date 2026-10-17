'use client';

import { useState } from 'react';
import {
  Activity,
  Building2,
  Stethoscope,
  Users,
  UserPlus,
  Receipt,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { usePlatformLiveActivity } from '@/lib/hooks/useQueries';
import type { PlatformLiveActivityEvent } from '@/lib/providers/types';

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return 'recently';
  }
}

export default function LiveActivityFeed() {
  const { data: events, isLoading, isFetching, refetch } = usePlatformLiveActivity();
  const [filter, setFilter] = useState<'all' | 'visit' | 'queue' | 'staff' | 'clinic' | 'payment'>('all');

  const allEvents = events ?? [];
  const filteredEvents = filter === 'all' ? allEvents : allEvents.filter((e) => e.type === filter);

  const getEventIcon = (type: PlatformLiveActivityEvent['type']) => {
    switch (type) {
      case 'visit':
        return <Stethoscope size={15} color="#10b981" />;
      case 'queue':
        return <Users size={15} color="#3b82f6" />;
      case 'staff':
        return <UserPlus size={15} color="#8b5cf6" />;
      case 'clinic':
        return <Building2 size={15} color="#f59e0b" />;
      case 'payment':
        return <Receipt size={15} color="#10b981" />;
      default:
        return <Activity size={15} color="var(--accent)" />;
    }
  };

  const getBadgeClass = (color: string) => {
    switch (color) {
      case 'teal':
      case 'green':
        return 'badge-green';
      case 'blue':
        return 'badge-blue';
      case 'purple':
        return 'badge-purple';
      case 'amber':
        return 'badge-amber';
      default:
        return 'badge-gray';
    }
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={17} color="var(--accent)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Real-Time Operational Activity Feed</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Non-PHI events across clinics · Click Refresh to load recent updates on demand
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => refetch()}
            disabled={isFetching}
            style={{ fontSize: '0.78rem', gap: 6 }}
            title="Fetch recent platform activity on demand"
          >
            <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
            {isFetching ? 'Loading...' : 'Refresh Activity'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {(
          [
            { key: 'all', label: 'All Events' },
            { key: 'visit', label: 'Consultations' },
            { key: 'queue', label: 'OPD Tokens' },
            { key: 'staff', label: 'Staff' },
            { key: 'clinic', label: 'Clinics' },
            { key: 'payment', label: 'Payments' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`btn btn-sm ${filter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stream container */}
      <div
        style={{
          maxHeight: 360,
          overflowY: 'auto',
          paddingRight: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Listening to live event stream...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No recent events in this category yet today.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--bg-secondary, rgba(255,255,255,0.02))',
                border: '1px solid var(--border)',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--card-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  {getEventIcon(evt.type)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {evt.title}
                    </span>
                    <span className={`badge ${getBadgeClass(evt.badgeColor)}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                      {evt.type.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {evt.description}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <Clock size={12} />
                {formatTimeAgo(evt.createdAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
