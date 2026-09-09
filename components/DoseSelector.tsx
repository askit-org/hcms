'use client';

import { useState, useRef, useEffect } from 'react';
import { Sunrise, Sun, Moon, Clock, ChevronDown } from 'lucide-react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  const parts = value ? value.split('-') : [];
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

  const cycleValue = (currentVal: string): string => {
    const idx = CYCLE_VALUES.indexOf(currentVal);
    if (idx === -1) return '1';
    return CYCLE_VALUES[(idx + 1) % CYCLE_VALUES.length];
  };

  const handleToggleSlot = (slotIndex: number) => {
    let p = [...parts];
    if (p.length < 3) {
      p = ['0', '0', '0'];
    }
    const current = p[slotIndex] || '0';
    p[slotIndex] = cycleValue(current);
    onChange(p.join('-'));
  };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }} ref={containerRef}>
      {/* Field Trigger Button */}
      <button
        type="button"
        className={className}
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '6px 10px',
          color: value && value !== '0-0-0' ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '0.78rem',
          fontWeight: value && value !== '0-0-0' ? 600 : 400,
          minHeight: '38px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Clock size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
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

      {/* Short Height, Full Width Popover */}
      {open && (
        <div className="dose-popover">
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'MORNING', icon: <Sunrise size={15} />, val: morningVal, slot: 0 },
              { label: 'AFTERNOON', icon: <Sun size={15} />, val: afternoonVal, slot: 1 },
              { label: 'NIGHT', icon: <Moon size={15} />, val: nightVal, slot: 2 },
            ].map((d) => {
              const active = d.val !== '0' && d.val !== '';
              return (
                <div
                  key={d.label}
                  className={`dose-toggle ${active ? 'active' : ''}`}
                  onClick={() => handleToggleSlot(d.slot)}
                >
                  <div>{d.icon}</div>
                  <span>{d.label}</span>
                  <div
                    className="dose-toggle-val"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--surface-3)',
                      color: active ? '#ffffff' : 'var(--text-muted)',
                    }}
                  >
                    {d.val}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
