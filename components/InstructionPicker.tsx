'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Languages } from 'lucide-react';
import { 
  MedicationInstruction, 
  MedicationInstructionLabels, 
  InstructionLanguage,
  formatInstructionsText 
} from '@/lib/medicationInstructions';
import { motion, AnimatePresence } from 'framer-motion';

interface InstructionPickerProps {
  instructionKeys?: string[];
  customInstruction?: string;
  languages?: InstructionLanguage[];
  onChange: (data: {
    instructionKeys: string[];
    customInstruction: string;
    languages: InstructionLanguage[];
    formattedText: string;
  }) => void;
}

export default function InstructionPicker({
  instructionKeys = [],
  customInstruction = '',
  languages = ['en', 'hi'],
  onChange,
}: InstructionPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(instructionKeys);
  const [customText, setCustomText] = useState(customInstruction);
  const [selectedLangs, setSelectedLangs] = useState<InstructionLanguage[]>(
    languages.length > 0 ? languages : ['en', 'hi']
  );

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerUpdate = (
    newKeys: string[],
    newCustom: string,
    newLangs: InstructionLanguage[]
  ) => {
    const formattedText = formatInstructionsText(newKeys, newLangs, newCustom);
    onChange({
      instructionKeys: newKeys,
      customInstruction: newCustom,
      languages: newLangs,
      formattedText,
    });
  };

  const toggleKey = (key: string) => {
    let next: string[];
    if (key === MedicationInstruction.NONE) {
      next = [MedicationInstruction.NONE];
    } else {
      const filtered = selectedKeys.filter((k) => k !== MedicationInstruction.NONE);
      if (filtered.includes(key)) {
        next = filtered.filter((k) => k !== key);
      } else {
        next = [...filtered, key];
      }
    }
    setSelectedKeys(next);
    triggerUpdate(next, customText, selectedLangs);
  };

  const toggleLang = (lang: InstructionLanguage) => {
    let next: InstructionLanguage[];
    if (selectedLangs.includes(lang)) {
      if (selectedLangs.length === 1) return; // Keep at least 1 language
      next = selectedLangs.filter((l) => l !== lang);
    } else {
      next = [...selectedLangs, lang];
    }
    setSelectedLangs(next);
    triggerUpdate(selectedKeys, customText, next);
  };

  const handleCustomChange = (val: string) => {
    setCustomText(val);
    triggerUpdate(selectedKeys, val, selectedLangs);
  };

  const formattedPreview = formatInstructionsText(selectedKeys, selectedLangs, customText);

  const filteredEnumKeys = Object.keys(MedicationInstructionLabels).filter((enumKey) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase().trim();
    const itemTranslations = MedicationInstructionLabels[enumKey as MedicationInstruction];
    return (
      itemTranslations.en.toLowerCase().includes(q) ||
      itemTranslations.hi.toLowerCase().includes(q) ||
      itemTranslations.mr.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <button
        type="button"
        className="form-input"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
          cursor: 'pointer',
          paddingRight: '28px',
          height: 'auto',
          minHeight: '38px',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        <span style={{ color: formattedPreview ? 'var(--text-primary)' : 'var(--text-muted)', lineHeight: '1.3' }}>
          {formattedPreview || 'Select Instructions…'}
        </span>
        <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '12px', color: 'var(--text-muted)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '350px',
              maxWidth: '90vw',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px var(--border)',
              padding: '14px',
              zIndex: 99999,
            }}
          >
            {/* Language Selector Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Languages size={14} style={{ color: 'var(--accent)' }} /> Print Language:
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { key: 'en', label: 'English' },
                  { key: 'hi', label: 'हिंदी' },
                  { key: 'mr', label: 'मराठी' },
                ].map((l) => {
                  const active = selectedLangs.includes(l.key as InstructionLanguage);
                  return (
                    <button
                      key={l.key}
                      type="button"
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => toggleLang(l.key as InstructionLanguage)}
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Search Filter Box */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input form-input-sm"
                placeholder="Search instructions (e.g. food, water, bedtime)…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ paddingLeft: '28px', fontSize: '0.8rem' }}
              />
            </div>

            {/* Instruction Multi-select Checklist */}
            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', paddingRight: '4px' }}>
              {filteredEnumKeys.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                  No matching instructions found
                </div>
              ) : (
                filteredEnumKeys.map((enumKey) => {
                  const k = enumKey as MedicationInstruction;
                  const isSelected = selectedKeys.includes(k);
                  const itemTranslations = MedicationInstructionLabels[k];
                  
                  const displayText = selectedLangs
                    .map((lang) => itemTranslations[lang])
                    .filter(Boolean)
                    .join(' / ');

                  return (
                    <div
                      key={k}
                      onClick={() => toggleKey(k)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-glow)' : 'transparent',
                        color: isSelected ? 'var(--accent-light)' : 'var(--text-primary)',
                        fontSize: '0.8rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {isSelected && <Check size={12} />}
                      </div>
                      <span style={{ flex: 1, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3' }}>
                        {displayText}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Custom Instruction Input */}
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Custom Instruction (Optional)
              </label>
              <textarea
                className="form-textarea"
                placeholder="e.g. Avoid direct sunlight and dairy products"
                value={customText}
                onChange={(e) => handleCustomChange(e.target.value)}
                rows={2}
                style={{ fontSize: '0.8rem', padding: '6px 8px', minHeight: '50px', resize: 'vertical' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
