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
  Droplets,
  RotateCcw,
  Edit3,
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
    <span
      style={{
        fontWeight: 600,
        color: 'var(--accent-light)',
        fontSize: '0.82rem',
      }}
    >
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

  const isCustom = Boolean(
    normalizedValue && !DURATION_OPTIONS.includes(normalizedValue)
  );

  return (
    <select
      className={className}
      style={{
        fontSize: '0.78rem',
        height: '38px',
        cursor: 'pointer',
        width: '100%',
        ...style,
      }}
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

const UNIT_OPTIONS = [
  { label: 'Tablet / Cap', value: '' },
  { label: '1 drop', value: '1 drop' },
  { label: '2 drops', value: '2 drops' },
  { label: '5 ml', value: '5 ml' },
  { label: '10 ml', value: '10 ml' },
  { label: '15 ml', value: '15 ml' },
  { label: '20 ml', value: '20 ml' },
  { label: '1 sachet', value: '1 sachet' },
];

function extractUnitAndPattern(val: string) {
  if (!val || !val.trim()) return { unit: '', pattern: '0-0-0', isSpecial: false };

  const trimmed = val.trim();

  // Known unit directly (e.g. "2 drops", "5 ml", "1 sachet")
  const knownUnit = UNIT_OPTIONS.find(u => u.value && u.value === trimmed);
  if (knownUnit) {
    return { unit: knownUnit.value, pattern: '0-0-0', isSpecial: false };
  }

  // Pattern like "2 drops (1-0-1)" or "5 ml (1-1-1)"
  const bracketMatch = trimmed.match(/^(.*?)\s*\(([0-1\/2.]+\-[0-1\/2.]+\-[0-1\/2.]+)\)$/);
  if (bracketMatch) {
    return { unit: bracketMatch[1].trim(), pattern: bracketMatch[2].trim(), isSpecial: false };
  }

  // Pure slot pattern like "1-0-1"
  const isPureSlot = /^[0-1\/2.]+\-[0-1\/2.]+\-[0-1\/2.]+$/.test(trimmed);
  if (isPureSlot) {
    return { unit: '', pattern: trimmed, isSpecial: false };
  }

  // Check if unit prefixed without brackets e.g. "2 drops 1-0-1"
  const spaceMatch = trimmed.match(/^(.*?)\s+([0-1\/2.]+\-[0-1\/2.]+\-[0-1\/2.]+)$/);
  if (spaceMatch) {
    return { unit: spaceMatch[1].trim(), pattern: spaceMatch[2].trim(), isSpecial: false };
  }

  // Special free text dosage (e.g., "As needed (SOS)", "Apply 2x daily")
  return { unit: trimmed, pattern: '0-0-0', isSpecial: true };
}

function combineUnitAndPattern(unit: string, pattern: string): string {
  if (!pattern || pattern === '0-0-0') {
    return unit;
  }
  if (unit) {
    return `${unit} (${pattern})`;
  }
  return pattern;
}

export default function DoseSelector({
  value,
  onChange,
  placeholder = 'Select Dosage',
  className = 'form-input',
  style,
}: DoseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { unit: currentUnit, pattern: currentPattern, isSpecial } = extractUnitAndPattern(value);

  const parts = currentPattern && currentPattern.includes('-') ? currentPattern.split('-') : ['0', '0', '0'];
  const morningVal = parts[0] || '0';
  const afternoonVal = parts[1] || '0';
  const nightVal = parts[2] || '0';

  const doseWords = parseDoseToWords(value);
  const displayText = doseWords.en || value;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setIsEditingCustom(false);
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

  const handleSelectUnit = (unitVal: string) => {
    const nextVal = combineUnitAndPattern(unitVal, currentPattern);
    onChange(nextVal);
  };

  const handleToggleSlot = (slotIndex: number) => {
    let p = [...parts];
    if (p.length < 3) p = ['0', '0', '0'];
    const current = p[slotIndex] || '0';
    p[slotIndex] = cycleValue(current);
    const newPattern = p.join('-');
    const nextVal = combineUnitAndPattern(currentUnit, newPattern);
    onChange(nextVal);
  };

  const handleApplySpecialPreset = (val: string) => {
    onChange(val);
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
    { label: 'Apply 2x daily', value: 'Apply 2x daily', icon: <Sparkles size={14} />, badge: 'Topical' },
    { label: '1 per week (Weekly)', value: '1 per week', icon: <Calendar size={14} />, badge: 'Weekly' },
    { label: '2 per week (Twice weekly)', value: '2 per week', icon: <Calendar size={14} />, badge: 'Weekly' },
    { label: '1 per month (Monthly)', value: '1 per month', icon: <Calendar size={14} />, badge: 'Monthly' },
    { label: 'STAT (Immediately)', value: 'STAT', icon: <Zap size={14} />, badge: 'Urgent' },
  ];

  return (
    <div
      style={{ position: 'relative', width: '100%', ...style }}
      ref={containerRef}
    >
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
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {currentUnit ? (
            <Droplets size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          ) : isSpecial ? (
            <Zap size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          ) : (
            <Clock size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
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
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: 'var(--modal-shadow), 0 20px 50px rgba(0,0,0,0.6)',
            width: '340px',
            boxSizing: 'border-box',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* SECTION 1: Dosage Form / Unit Chips */}
          <div>
            <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              1. Select Form / Quantity
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {UNIT_OPTIONS.map((u) => {
                const isSelected = (currentUnit === u.value) || (!currentUnit && u.value === '' && !isSpecial);
                return (
                  <button
                    key={u.value}
                    type="button"
                    onClick={() => handleSelectUnit(u.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {u.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* SECTION 2: Daily Slot Frequency Grid */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Daily Slots Frequency
              </div>
              {currentUnit && (
                <span style={{ fontSize: '0.68rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                  Unit: {currentUnit}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'MORNING', icon: <Sunrise size={16} />, val: morningVal, slot: 0 },
                { label: 'AFTERNOON', icon: <Sun size={16} />, val: afternoonVal, slot: 1 },
                { label: 'NIGHT', icon: <Moon size={16} />, val: nightVal, slot: 2 },
              ].map((d) => {
                const active = !isSpecial && d.val !== '0' && d.val !== '';
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
                      padding: '8px 4px',
                      borderRadius: '10px',
                      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: active ? 'var(--accent-glow)' : 'var(--surface-2)',
                      color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}>{d.icon}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                      {d.label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: active ? 'var(--accent)' : 'var(--surface-3)',
                        color: active ? '#ffffff' : 'var(--text-primary)',
                      }}
                    >
                      {active ? getSlotBadgeText(d.val) : 'Off'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: SOS & Special Types */}
          <div>
            <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              SOS & Special Types
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {specialPresets.map((preset) => {
                const isSelected = value === preset.value;
                return (
                  <div
                    key={preset.value}
                    onClick={() => handleApplySpecialPreset(preset.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary)',
                      fontSize: '0.72rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: isSelected ? '#ffffff' : 'var(--accent)', display: 'inline-flex' }}>
                        {preset.icon}
                      </span>
                      <span>{preset.label}</span>
                    </div>
                    {isSelected && <CheckCircle2 size={13} style={{ color: '#ffffff' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* SECTION 5: Live Result Preview & Action Footer */}
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: '10px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Selected Dosage:
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 700 }}>
                {value || 'None (Off)'}
              </span>
            </div>
            {displayText && displayText !== value && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                "{displayText}"
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                style={{ flex: 1, fontSize: '0.72rem' }}
                onClick={() => onChange('')}
              >
                <RotateCcw size={12} /> Clear / Reset
              </button>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                style={{ flex: 2, fontSize: '0.72rem' }}
                onClick={() => setOpen(false)}
              >
                <Check size={12} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
