'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRightLeft, Bed, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIpdMutations, useSettings, useIpdAdmissions } from '@/lib/hooks/useQueries';
import type { IpdAdmission, IpdRoom } from '@/lib/providers/types';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

interface IpdBedTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: IpdAdmission;
  onSuccess?: (updated: IpdAdmission) => void;
}

export default function IpdBedTransferModal({
  isOpen,
  onClose,
  admission,
  onSuccess,
}: IpdBedTransferModalProps) {
  const { transferBed } = useIpdMutations();
  const { data: settings } = useSettings();
  const { data: admissions = [] } = useIpdAdmissions({ status: 'ADMITTED' });

  const [selectedTargetBed, setSelectedTargetBed] = useState('');
  const [customBedText, setCustomBedText] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rooms: IpdRoom[] = useMemo(() => {
    if (settings?.ipdRooms && Array.isArray(settings.ipdRooms)) {
      return settings.ipdRooms;
    }
    return [];
  }, [settings?.ipdRooms]);

  // Occupied bed labels (excluding current admission)
  const occupiedBedLabels = useMemo(() => {
    return new Set(
      admissions
        .filter((a) => a.id !== admission.id && a.status === 'ADMITTED')
        .map((a) => (a.bedOrRoom || '').trim().toLowerCase())
    );
  }, [admissions, admission.id]);

  // Vacant bed choices
  const vacantBeds = useMemo(() => {
    const list: Array<{ label: string; value: string; roomName: string; dailyRate?: number }> = [];
    rooms.forEach((room) => {
      (room.beds || []).forEach((bed) => {
        const fullLabel = `${room.name} - Bed ${bed.bedNumber}`;
        if (!occupiedBedLabels.has(fullLabel.toLowerCase())) {
          list.push({
            label: `${room.name} · Bed ${bed.bedNumber} (₹${room.dailyRate || 500}/day)`,
            value: fullLabel,
            roomName: room.name,
            dailyRate: room.dailyRate,
          });
        }
      });
    });
    return list;
  }, [rooms, occupiedBedLabels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = isCustom ? customBedText.trim() : selectedTargetBed.trim();
    if (!target) {
      toast('Please select or specify destination bed', 'error');
      return;
    }

    if (target.toLowerCase() === (admission.bedOrRoom || '').trim().toLowerCase()) {
      toast('Selected bed is the same as current bed', 'info');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await transferBed.mutateAsync({
        id: admission.id,
        bedOrRoom: target,
      });
      toast(`Patient transferred from ${admission.bedOrRoom} to ${target}!`, 'success');
      onSuccess?.(updated);
      onClose();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to transfer bed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const patientName = admission.patient?.name || 'Patient';

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          padding: '16px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.16 }}
          style={{
            background: 'var(--surface-solid)',
            borderRadius: 16,
            maxWidth: 480,
            width: '100%',
            padding: 22,
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            border: '1px solid var(--border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowRightLeft size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Transfer Inpatient Bed</h3>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Patient: {patientName} · Current: <strong>{admission.bedOrRoom}</strong>
                </div>
              </div>
            </div>

            <button type="button" onClick={onClose} className="btn-icon">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label" style={{ fontWeight: 700 }}>
                Select Destination Hospital Bed
              </label>
              {!isCustom ? (
                <div>
                  <select
                    className="form-select"
                    value={selectedTargetBed}
                    onChange={(e) => setSelectedTargetBed(e.target.value)}
                    required={!isCustom}
                  >
                    <option value="">-- Choose Vacant Ward Bed --</option>
                    {vacantBeds.map((b, i) => (
                      <option key={i} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  {vacantBeds.length === 0 && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      No vacant beds found in configured rooms. You can enter a custom room/bed below.
                    </div>
                  )}
                </div>
              ) : (
                <input
                  className="form-input"
                  placeholder="e.g. ICU Bed 04, Deluxe Room 302"
                  value={customBedText}
                  onChange={(e) => setCustomBedText(e.target.value)}
                  required={isCustom}
                />
              )}

              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => setIsCustom(!isCustom)}
                >
                  {isCustom ? '← Pick from configured hospital wards' : '+ Enter custom bed / room name'}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                borderTop: '1px solid var(--border)',
                paddingTop: 14,
                marginTop: 6,
              }}
            >
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Transferring...' : 'Confirm Bed Transfer'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
