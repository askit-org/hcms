'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, Wrench, X } from 'lucide-react';
import { useActiveAnnouncements } from '@/lib/hooks/useQueries';
import type { SystemAnnouncement } from '@/lib/providers/types';

const DISMISSED_KEY = 'hcms_dismissed_announcements';

export default function GlobalAnnouncementBanner() {
  const { data: announcements } = useActiveAnnouncements();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  if (!mounted || !announcements || announcements.length === 0) {
    return null;
  }

  // Filter out dismissed announcements unless they are non-dismissible
  const visible = announcements.filter(
    (a) => !a.isDismissible || !dismissedIds.includes(a.id)
  );

  if (visible.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const getStyle = (type: SystemAnnouncement['type']) => {
    switch (type) {
      case 'critical':
        return {
          bg: '#dc2626',
          color: '#ffffff',
          icon: <AlertCircle size={16} color="#ffffff" />,
        };
      case 'warning':
        return {
          bg: '#d97706',
          color: '#ffffff',
          icon: <AlertTriangle size={16} color="#ffffff" />,
        };
      case 'maintenance':
        return {
          bg: '#7c3aed',
          color: '#ffffff',
          icon: <Wrench size={16} color="#ffffff" />,
        };
      default:
        return {
          bg: '#2563eb',
          color: '#ffffff',
          icon: <Info size={16} color="#ffffff" />,
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, zIndex: 100 }}>
      {visible.map((ann) => {
        const theme = getStyle(ann.type);
        return (
          <div
            key={ann.id}
            style={{
              backgroundColor: theme.bg,
              color: theme.color,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.84rem',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ flexShrink: 0 }}>{theme.icon}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ fontWeight: 700, marginRight: 6 }}>{ann.title}:</span>
                <span>{ann.message}</span>
              </div>
            </div>

            {ann.isDismissible && (
              <button
                type="button"
                onClick={() => handleDismiss(ann.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.85,
                  flexShrink: 0,
                  marginLeft: 12,
                }}
                title="Dismiss announcement"
              >
                <X size={15} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
