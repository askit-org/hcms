import type { IpdDayLog, IpdDoctorRound } from '@/lib/providers/types';

/**
 * Normalizes an IPD Day log into an array of doctor visits / rounds.
 * Backwards compatible: if a legacy log does not have a `rounds` array,
 * synthesizes a single round from top-level notes, vitals, meds, and procedures.
 */
export function getDayRounds(log: IpdDayLog): IpdDoctorRound[] {
  if (log.rounds && Array.isArray(log.rounds) && log.rounds.length > 0) {
    return log.rounds;
  }

  const hasContent = Boolean(
    log.doctorNotes?.trim() ||
      log.nursingNotes?.trim() ||
      log.dietNotes?.trim() ||
      (log.vitals && Object.values(log.vitals).some(Boolean)) ||
      (log.medications && log.medications.length > 0) ||
      (log.procedures && log.procedures.length > 0)
  );

  if (!hasContent) return [];

  return [
    {
      id: `legacy-${log.dayNumber}`,
      time: 'Routine Round',
      roundType: 'Routine Round',
      doctorNotes: log.doctorNotes || '',
      nursingNotes: log.nursingNotes || '',
      dietNotes: log.dietNotes || '',
      vitals: log.vitals,
      medications: log.medications,
      medicinesAdministered: log.medicinesAdministered,
      procedures: log.procedures,
      charges: log.dailyCharges || 0,
      createdAt: log.updatedAt || log.date,
    },
  ];
}

/**
 * UI color styling & icon indicator based on round session type
 */
export function getRoundSessionMeta(roundType?: string) {
  const t = (roundType || '').toLowerCase();

  if (t.includes('morning')) {
    return {
      label: roundType || 'Morning Round',
      iconText: '🌅',
      bg: 'rgba(245, 158, 11, 0.12)',
      color: '#d97706',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    };
  }
  if (t.includes('afternoon')) {
    return {
      label: roundType || 'Afternoon Visit',
      iconText: '☀️',
      bg: 'rgba(14, 165, 233, 0.12)',
      color: '#0284c7',
      border: '1px solid rgba(14, 165, 233, 0.3)',
    };
  }
  if (t.includes('evening')) {
    return {
      label: roundType || 'Evening Round',
      iconText: '🌆',
      bg: 'rgba(99, 102, 241, 0.12)',
      color: '#4f46e5',
      border: '1px solid rgba(99, 102, 241, 0.3)',
    };
  }
  if (t.includes('night')) {
    return {
      label: roundType || 'Night Call',
      iconText: '🌙',
      bg: 'rgba(139, 92, 246, 0.12)',
      color: '#7c3aed',
      border: '1px solid rgba(139, 92, 246, 0.3)',
    };
  }
  if (t.includes('emergency') || t.includes('sos')) {
    return {
      label: roundType || 'Emergency Visit',
      iconText: '🚨',
      bg: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
      border: '1px solid rgba(239, 68, 68, 0.3)',
    };
  }
  if (t.includes('specialist') || t.includes('consult')) {
    return {
      label: roundType || 'Specialist Consultation',
      iconText: '🩺',
      bg: 'rgba(13, 148, 136, 0.12)',
      color: '#0d9488',
      border: '1px solid rgba(13, 148, 136, 0.3)',
    };
  }

  return {
    label: roundType || 'Doctor Round',
    iconText: '📋',
    bg: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  };
}

