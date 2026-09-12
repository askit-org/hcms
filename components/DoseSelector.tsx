'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sunrise,
  Sun,
  Moon,
  Clock,
  ChevronDown,
  Zap,
  Calendar,
  Sparkles,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { parseDoseToWords } from '@/lib/medicationInstructions';

interface DoseSelectorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const CYCLE_VALUES = ['0', '1', '1/2', '2'];

export const DURATION_OPTIONS = [
  '1 day',
  '2 days',
  '3 days',
  '4 days',
  '5 days',
  '6 days',
  '7 days',
  '10 days',
  '14 days',
  '15 days',
  '21 days',
  '30 days',
  '45 days',
  '60 days',
  '90 days',
];

export function DoseDisplay({ dose }: { dose: string }) {
  if (!dose) return null;
  const words = parseDoseToWords(dose);
  const displayWords = words.en || dose;

  return (
    <span style={{ fontWeight: 600, color: 'var(--accent-light)', fontSize: '0.82rem' }}>
      {displayWords}
    </span>
  );
}

export function DurationSelect({
  value,
  onChange,
  className = 'form-select',
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const normalizedValue =
    value && !value.includes('day') && !isNaN(Number(value))
      ? `${value} ${Number(value) === 1 ? 'day' : 'days'}`
      : value;

  const isCustom = Boolean(normalizedValue && !DURATION_OPTIONS.includes(normalizedValue));

  return (
    <select
      className={className}
      style={{ fontSize: '0.78rem', height: '38px', cursor: 'pointer', width: '100%', ...style }}
      value={normalizedValue || '5 days'}
      onChange={(e) => onChange(e.target.value)}
    >
      {DURATION_OPTIONS.map((dur) => (
        <option key={dur} value={dur}>
          {dur}
        </option>
      ))}
      {isCustom && <option value={normalizedValue}>{normalizedValue}</option>}
    </select>
  );
}

export default function DoseSelector({
  value,
  onChange,
  placeholder = 'Select Dosage',
  className = 'form-input',
  style,
}: DoseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'slots' | 'presets'>('slots');
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to check if a value is a valid 3-slot pattern (e.g. "1-0-1", "0-0-0", "1/2-0-1/2")
  const isSlotPattern = (val: string): boolean => {
    if (!val) return true;
    const p = val.split('-');
    if (p.length !== 3) return false;
    const valid = ['0', '1', '1/2', '0.5', '2'];
    return p.every((x) => valid.includes(x.trim()));
  };

  const hasSlotPattern = isSlotPattern(value);

  // Extract slot values only if current value is a 3-slot pattern
  const parts = hasSlotPattern && value ? value.split('-') : ['0', '0', '0'];
  const morningVal = parts[0] || '0';
  const afternoonVal = parts[1] || '0';
  const nightVal = parts[2] || '0';

  const doseWords = parseDoseToWords(value);
  const displayText = doseWords.en || value;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenToggle = () => {
    const nextState = !open;
    setOpen(nextState);
    if (nextState) {
      // If current value is a special preset (like "As needed (SOS)"), default tab to 'presets'
      if (!hasSlotPattern) {
        setActiveTab('presets');
      } else {
        setActiveTab('slots');
      }
    }
  };

  const cycleValue = (currentVal: string): string => {
    const idx = CYCLE_VALUES.indexOf(currentVal);
    if (idx === -1) return '1';
    return CYCLE_VALUES[(idx + 1) % CYCLE_VALUES.length];
  };

  const handleToggleSlot = (slotIndex: number) => {
    let p = hasSlotPattern ? [...parts] : ['0', '0', '0'];
    if (p.length < 3) {
      p = ['0', '0', '0'];
    }
    const current = p[slotIndex] || '0';
    p[slotIndex] = cycleValue(current);
    onChange(p.join('-'));
  };

  const getSlotBadgeText = (val: string) => {
    if (!val || val === '0') return 'Off';
    if (val === '1') return '1 Dose';
    if (val === '1/2' || val === '0.5') return '1/2 Dose';
    if (val === '2') return '2 Doses';
    return `${val} Dose`;
  };

  const specialPresets = [
    { label: 'As needed (SOS)', value: 'As needed (SOS)', icon: <Zap size={14} />, badge: 'SOS' },
    { label: '1 per week (Weekly)', value: '1 per week', icon: <Calendar size={14} />, badge: 'Weekly' },
    { label: '2 per week (Twice weekly)', value: '2 per week', icon: <Calendar size={14} />, badge: 'Weekly' },
    { label: '1 per month (Monthly)', value: '1 per month', icon: <Calendar size={14} />, badge: 'Monthly' },
    { label: 'STAT (Immediately)', value: 'STAT', icon: <Zap size={14} />, badge: 'Urgent' },
  ];

  const regularPresets = [
    { label: 'Twice daily', value: '1-0-1', icon: <Clock size={14} />, desc: 'Morning & Night' },
    { label: 'Thrice daily', value: '1-1-1', icon: <Clock size={14} />, desc: 'Morn, Aft, Night' },
    { label: 'Once daily (Morn)', value: '1-0-0', icon: <Sunrise size={14} />, desc: 'Morning only' },
    { label: 'Once daily (Night)', value: '0-0-1', icon: <Moon size={14} />, desc: 'Night only' },
    { label: 'Once daily (Aft)', value: '0-1-0', icon: <Sun size={14} />, desc: 'Afternoon only' },
    { label: 'Half dose (M&N)', value: '1/2-0-1/2', icon: <Clock size={14} />, desc: 'Half Morning & Night' },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', ...style }} ref={containerRef}>
      {/* Field Trigger Button */}
      <button
        type="button"
        className={className}
        onClick={handleOpenToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          background: 'var(--surface-1)',
          border: open ? '1px solid var(--accent)' : '1px solid var(--border)',
          borderRadius: '8px',
          padding: '6px 10px',
          color: value && value !== '0-0-0' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.78rem',
          fontWeight: value && value !== '0-0-0' ? 600 : 400,
          minHeight: '38px',
          boxShadow: open ? '0 0 0 3px var(--accent-glow)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {!hasSlotPattern ? (
            <Zap size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          ) : (
            <Clock size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayText || placeholder}
          </span>
        </span>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
            marginLeft: 4,
          }}
        />
      </button>

      {/* Main Glassmorphic Popover Card */}
      {open && (
        <div
          className="dose-popover-card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 99999,
            background: 'var(--surface-solid)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: 'var(--modal-shadow), 0 20px 50px rgba(0,0,0,0.6)',
            width: '320px',
            boxSizing: 'border-box',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* Header Segment Selector */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-2)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              gap: '4px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div
              onClick={() => setActiveTab('slots')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '7px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                background: activeTab === 'slots' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'slots' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: activeTab === 'slots' ? '0 2px 8px var(--accent-glow)' : 'none',
                userSelect: 'none',
              }}
            >
              <Clock size={13} />
              <span>Daily Slots</span>
            </div>
            <div
              onClick={() => setActiveTab('presets')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '7px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                background: activeTab === 'presets' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'presets' ? '#ffffff' : 'var(--text-muted)',
                boxShadow: activeTab === 'presets' ? '0 2px 8px var(--accent-glow)' : 'none',
                userSelect: 'none',
              }}
            >
              <Sparkles size={13} />
              <span>Other Frequencies</span>
            </div>
          </div>

          {/* TAB 1: SLOTS */}
          {activeTab === 'slots' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { label: 'MORNING', icon: <Sunrise size={16} />, val: morningVal, slot: 0 },
                  { label: 'AFTERNOON', icon: <Sun size={16} />, val: afternoonVal, slot: 1 },
                  { label: 'NIGHT', icon: <Moon size={16} />, val: nightVal, slot: 2 },
                ].map((d) => {
                  const active = hasSlotPattern && d.val !== '0' && d.val !== '';
                  return (
                    <div
                      key={d.label}
                      onClick={() => handleToggleSlot(d.slot)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '10px 6px',
                        borderRadius: '10px',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: active ? 'var(--accent-glow)' : 'var(--surface-2)',
                        color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: active ? '0 0 0 1px var(--accent) inset' : 'none',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>{d.icon}</div>
                      <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                        {d.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: active ? 'var(--accent)' : 'var(--surface-3)',
                          color: active ? '#ffffff' : 'var(--text-primary)',
                          marginTop: '2px',
                        }}
                      >
                        {active ? getSlotBadgeText(d.val) : 'Off'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!hasSlotPattern ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--accent-glow)',
                    border: '1px solid var(--accent)',
                    fontSize: '0.74rem',
                    color: 'var(--accent-light)',
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} />
                    <span>Special Mode Active: {displayText}</span>
                  </div>
                  <span
                    onClick={() => setActiveTab('presets')}
                    style={{ textDecoration: 'underline', cursor: 'pointer', color: '#ffffff' }}
                  >
                    View →
                  </span>
                </div>
              ) : (
                <div
                  onClick={() => setActiveTab('presets')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Need SOS, Weekly, or Special Frequencies?</span>
                  <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>View All →</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRESETS */}
          {activeTab === 'presets' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                maxHeight: '280px',
                overflowY: 'auto',
                paddingRight: '2px',
              }}
            >
              {/* Special / SOS Section */}
              <div
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '2px',
                }}
              >
                SOS & Special Frequencies
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {specialPresets.map((preset) => {
                  const isSelected = value === preset.value || value === preset.label;
                  return (
                    <div
                      key={preset.value}
                      onClick={() => {
                        onChange(preset.value);
                        setOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        boxShadow: isSelected ? '0 4px 12px var(--accent-glow)' : 'none',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: isSelected ? '#ffffff' : 'var(--accent)', display: 'inline-flex' }}>
                          {preset.icon}
                        </span>
                        <span>{preset.label}</span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 size={14} style={{ color: '#ffffff' }} />
                      ) : (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--surface-3)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {preset.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

              {/* Standard Daily Schedules */}
              <div
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '2px',
                }}
              >
                Standard Daily Schedules
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {regularPresets.map((preset) => {
                  const isSelected = value === preset.value || value === preset.label;
                  return (
                    <div
                      key={preset.value}
                      onClick={() => {
                        onChange(preset.value);
                        setOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-glow)' : 'var(--surface-2)',
                        color: isSelected ? 'var(--accent-light)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ color: 'var(--accent)', display: 'inline-flex', flexShrink: 0 }}>
                          {preset.icon}
                        </span>
                        <div style={{ textAlign: 'left', minWidth: 0 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, lineHeight: 1.2 }}>{preset.label}</div>
                          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {preset.desc}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={14} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
