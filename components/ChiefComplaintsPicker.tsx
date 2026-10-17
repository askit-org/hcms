'use client';

import React, { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  Check, 
  ChevronRight, 
  SlidersHorizontal, 
  Sparkles, 
  Trash2, 
  Tag 
} from 'lucide-react';
import { useAppOptions, useAppOptionMutations } from '@/lib/hooks/useQueries';
import VoiceInputButton from '@/components/VoiceInputButton';
import { toast } from '@/components/Toast';

export const DEFAULT_CHIEF_COMPLAINTS = [
  'Fever', 'Cough', 'Cold', 'Body Ache', 'Headache',
  'Vomiting', 'Diarrhoea', 'Chest Pain', 'Breathlessness',
  'Sore Throat', 'Fatigue', 'Dizziness', 'Abdominal Pain', 'Joint Pain',
];

interface ChiefComplaintsPickerProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  onClearError?: () => void;
  required?: boolean;
}

export default function ChiefComplaintsPicker({
  value,
  onChange,
  error,
  onClearError,
  required = true,
}: ChiefComplaintsPickerProps) {
  const { data: complaintOptions = [], isLoading } = useAppOptions('CHIEF_COMPLAINT');
  const { create: createOptionMut, remove: removeOptionMut } = useAppOptionMutations();

  // Custom complaints created for this organization
  const customComplaints = useMemo(() => {
    return complaintOptions.map(o => ({
      id: o.id,
      value: o.value.trim(),
    })).filter(o => Boolean(o.value));
  }, [complaintOptions]);

  // Combined complaints (default + organization custom)
  const allComplaints = useMemo(() => {
    const list = [...DEFAULT_CHIEF_COMPLAINTS];
    for (const c of customComplaints) {
      if (!list.some(item => item.toLowerCase() === c.value.toLowerCase())) {
        list.push(c.value);
      }
    }
    return list;
  }, [customComplaints]);

  // Track selected complaints based on text content
  const selectedComplaints = useMemo(() => {
    if (!value) return [];
    const lowerVal = value.toLowerCase();
    return allComplaints.filter(c => {
      const escaped = c.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      return regex.test(lowerVal);
    });
  }, [value, allComplaints]);

  // 3-Row Overflow Calculation
  const pillsContainerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useLayoutEffect(() => {
    const el = pillsContainerRef.current;
    if (!el) return;

    const checkOverflow = () => {
      // Each pill row is ~32px (pill height ~28px + 6px gap).
      // 3 rows = ~96px. If scrollHeight exceeds 104px, it has overflowed into the 4th row.
      const overflowing = el.scrollHeight > 105;
      setHasOverflow(overflowing);
    };

    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    window.addEventListener('resize', checkOverflow);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [allComplaints]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSelected, setModalSelected] = useState<string[]>([]);
  const [modalNewComplaint, setModalNewComplaint] = useState('');
  const [savingComplaint, setSavingComplaint] = useState(false);

  // Inline Quick Add state
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineNewComplaint, setInlineNewComplaint] = useState('');
  const [savingInline, setSavingInline] = useState(false);

  // Synchronize modal state with current selection when opened
  const handleOpenModal = () => {
    setModalSelected([...selectedComplaints]);
    setModalSearch('');
    setModalNewComplaint('');
    setShowModal(true);
  };

  // Toggle complaint in the text
  const toggleComplaint = (c: string) => {
    const isSelected = selectedComplaints.includes(c);
    let currentText = value || '';

    if (!isSelected) {
      // Append to text
      if (currentText && !currentText.trim().endsWith(',')) {
        currentText += ', ' + c;
      } else if (currentText) {
        currentText += ' ' + c;
      } else {
        currentText = c;
      }
    } else {
      // Remove cleanly from text
      const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|,\\s*)${escaped}(?=\\s*,|$)`, 'gi');
      currentText = currentText.replace(regex, '').replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
    }

    const trimmed = currentText.trim();
    onChange(trimmed);
    if (onClearError && trimmed) onClearError();
  };

  // Handle direct text typing
  const handleTextChange = (text: string) => {
    onChange(text);
    if (onClearError && text) onClearError();
  };

  // Handle voice dictation
  const handleVoiceTranscript = (dictatedText: string) => {
    let current = value || '';
    if (current && !current.trim().endsWith(',')) {
      current += ', ' + dictatedText;
    } else if (current) {
      current += ' ' + dictatedText;
    } else {
      current = dictatedText;
    }
    onChange(current.trim());
    if (onClearError) onClearError();
  };

  // Add a new complaint to the organization via backend
  const handleCreateCustomComplaint = async (name: string, selectImmediately: boolean = true) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    try {
      if (allComplaints.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
        toast(`"${cleanName}" already exists in the complaints list.`, 'info');
        if (selectImmediately && !selectedComplaints.includes(cleanName)) {
          toggleComplaint(cleanName);
        }
        return;
      }

      await createOptionMut.mutateAsync({
        optionType: 'CHIEF_COMPLAINT',
        value: cleanName,
      });

      toast(`Complaint "${cleanName}" added to organization catalog!`, 'success');

      if (selectImmediately) {
        toggleComplaint(cleanName);
      }
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Could not save complaint', 'error');
    }
  };

  // Handle creating complaint from modal
  const handleModalAddCustom = async () => {
    if (!modalNewComplaint.trim()) return;
    setSavingComplaint(true);
    const target = modalNewComplaint.trim();
    try {
      await handleCreateCustomComplaint(target, false);
      if (!modalSelected.includes(target)) {
        setModalSelected(prev => [...prev, target]);
      }
      setModalNewComplaint('');
    } finally {
      setSavingComplaint(false);
    }
  };

  // Handle modal submit: applies all modal selections to the visit
  const handleModalApply = () => {
    // Current text
    let currentText = value || '';

    // Remove any previously selected complaints that were deselected in modal
    for (const c of allComplaints) {
      if (selectedComplaints.includes(c) && !modalSelected.includes(c)) {
        const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|,\\s*)${escaped}(?=\\s*,|$)`, 'gi');
        currentText = currentText.replace(regex, '').replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',');
      }
    }

    // Add newly selected complaints
    for (const c of modalSelected) {
      if (!selectedComplaints.includes(c)) {
        if (currentText && !currentText.trim().endsWith(',')) {
          currentText += ', ' + c;
        } else if (currentText) {
          currentText += ' ' + c;
        } else {
          currentText = c;
        }
      }
    }

    const cleaned = currentText.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
    onChange(cleaned);
    if (onClearError && cleaned) onClearError();
    setShowModal(false);
    toast('Chief complaints updated!', 'success');
  };

  // Filtered complaints inside modal
  const filteredModalComplaints = useMemo(() => {
    if (!modalSearch.trim()) return allComplaints;
    const q = modalSearch.toLowerCase();
    return allComplaints.filter(c => c.toLowerCase().includes(q));
  }, [allComplaints, modalSearch]);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            Chief Complaints {required && <span className="required">*</span>}
          </div>
          {customComplaints.length > 0 && (
            <span className="badge badge-teal" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
              {customComplaints.length} org custom
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!showInlineAdd ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInlineAdd(true)}
              style={{ fontSize: '0.75rem', height: 28, padding: '0 10px' }}
              title="Add a new complaint to your organization catalog"
            >
              <Plus size={13} /> Add to Org
            </button>
          ) : null}

          <VoiceInputButton
            title="Dictate Chief Complaints"
            onTranscript={handleVoiceTranscript}
          />
        </div>
      </div>

      {/* Inline Quick Add for Organization */}
      {showInlineAdd && (
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          animation: 'fadeModalIn 0.15s ease'
        }}>
          <Tag size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            className="form-input"
            style={{ height: 32, fontSize: '0.82rem', flex: 1 }}
            placeholder="Type new chief complaint for your organization (e.g. Migraine, Knee Pain)..."
            value={inlineNewComplaint}
            onChange={e => setInlineNewComplaint(e.target.value)}
            onKeyDown={async e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!inlineNewComplaint.trim()) return;
                setSavingInline(true);
                try {
                  await handleCreateCustomComplaint(inlineNewComplaint, true);
                  setInlineNewComplaint('');
                  setShowInlineAdd(false);
                } finally {
                  setSavingInline(false);
                }
              } else if (e.key === 'Escape') {
                setShowInlineAdd(false);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ height: 32, padding: '0 12px', fontSize: '0.78rem' }}
            disabled={savingInline || !inlineNewComplaint.trim()}
            onClick={async () => {
              if (!inlineNewComplaint.trim()) return;
              setSavingInline(true);
              try {
                await handleCreateCustomComplaint(inlineNewComplaint, true);
                setInlineNewComplaint('');
                setShowInlineAdd(false);
              } finally {
                setSavingInline(false);
              }
            }}
          >
            {savingInline ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ height: 32, width: 32, padding: 0 }}
            onClick={() => setShowInlineAdd(false)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Quick Complaint Pills (Max 3 Rows Visible) */}
      <div style={{ position: 'relative', marginBottom: hasOverflow ? 8 : 12 }}>
        <div
          ref={pillsContainerRef}
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            maxHeight: hasOverflow ? '104px' : 'none',
            overflow: 'hidden',
            transition: 'max-height 0.2s ease',
          }}
        >
          {allComplaints.map(c => {
            const isSelected = selectedComplaints.includes(c);
            const isCustom = customComplaints.some(custom => custom.value.toLowerCase() === c.toLowerCase());
            return (
              <button
                key={c}
                type="button"
                className={`quick-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleComplaint(c)}
                title={isCustom ? `Custom complaint for your organization` : undefined}
                style={isCustom ? { borderStyle: 'dashed' } : undefined}
              >
                {c}
                {isCustom && <span style={{ fontSize: '0.62rem', opacity: 0.75, marginLeft: 2 }}>★</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overflow Trigger Button (Visible when pills exceed 3 rows) */}
      {hasOverflow && (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              color: 'var(--accent)',
              borderColor: 'rgba(13, 148, 136, 0.35)',
              background: 'rgba(13, 148, 136, 0.06)',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '20px',
              cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={13} />
            Show more chief complaints ({allComplaints.length} available)
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Free-form Chief Complaints Textarea */}
      <textarea
        data-field="chiefComplaints"
        className={`form-textarea ${error ? 'has-error' : ''}`}
        style={{
          minHeight: 80,
          ...(error ? { border: '2px solid var(--red)' } : {})
        }}
        placeholder="Describe chief complaints in detail (e.g. Fever for 3 days, body ache)…"
        value={value}
        onChange={e => handleTextChange(e.target.value)}
      />
      {error && (
        <span style={{ color: 'var(--red)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
          {error}
        </span>
      )}

      {/* ─── Show More Chief Complaints Pop-up Modal ─── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="modal modal-md"
            onClick={e => e.stopPropagation()}
            style={{
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Sparkles size={16} color="var(--accent)" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Organization Catalog
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  Chief Complaints
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Select complaints for this visit or add new ones for your organization
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: 6, borderRadius: '50%' }}
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Add New Complaint in Modal */}
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '10px 12px',
              marginBottom: 14,
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                + Add New Complaint to Organization:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ height: 34, fontSize: '0.82rem', flex: 1 }}
                  placeholder="e.g. Skin Rash, Burning Micturition, Vertigo…"
                  value={modalNewComplaint}
                  onChange={e => setModalNewComplaint(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleModalAddCustom();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ height: 34, padding: '0 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  disabled={savingComplaint || !modalNewComplaint.trim()}
                  onClick={handleModalAddCustom}
                >
                  <Plus size={14} /> {savingComplaint ? 'Adding…' : 'Add to Catalog'}
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                className="form-input"
                style={{ height: 34, paddingLeft: 32, fontSize: '0.82rem' }}
                placeholder="Search complaints…"
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
              />
              {modalSearch && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 4 }}
                  onClick={() => setModalSearch('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Complaints Selection List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '340px',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px',
              background: 'var(--surface-solid)',
            }}>
              {filteredModalComplaints.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No complaints found matching "{modalSearch}". You can add it using the input above!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                  {filteredModalComplaints.map(c => {
                    const isSelected = modalSelected.includes(c);
                    const customObj = customComplaints.find(x => x.value.toLowerCase() === c.toLowerCase());
                    const isCustom = Boolean(customObj);

                    return (
                      <div
                        key={c}
                        onClick={() => {
                          setModalSelected(prev => 
                            prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                          );
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                          background: isSelected ? 'rgba(13, 148, 136, 0.12)' : 'var(--surface-1)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                          <div style={{
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: isSelected ? 'var(--accent)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            flexShrink: 0
                          }}>
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                          <span style={{
                            fontSize: '0.82rem',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--accent)' : 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {c}
                          </span>
                        </div>

                        {isCustom && customObj && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <span className="badge badge-teal" style={{ fontSize: '0.62rem', padding: '1px 4px' }}>
                              Org
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: 2, height: 20, width: 20, color: 'var(--red)', opacity: 0.7 }}
                              title="Delete from organization catalog"
                              onClick={async e => {
                                e.stopPropagation();
                                if (confirm(`Remove "${c}" from organization catalog?`)) {
                                  try {
                                    await removeOptionMut.mutateAsync(customObj.id);
                                    setModalSelected(prev => prev.filter(x => x !== c));
                                    toast(`Removed "${c}" from catalog`, 'info');
                                  } catch (err: any) {
                                    toast('Could not delete option', 'error');
                                  }
                                }
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer with "Add" button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>{modalSelected.length}</strong> selected
                {modalSelected.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 8, fontSize: '0.75rem', padding: '2px 6px', color: 'var(--red)' }}
                    onClick={() => setModalSelected([])}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleModalApply}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <Check size={15} /> Add to Visit ({modalSelected.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
