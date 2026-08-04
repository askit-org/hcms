import type { Patient, PrescribedMedicine } from '@/lib/providers/types';

export interface VisitDraft {
  patient: Patient | null;
  form: {
    category: string;
    chiefComplaints: string;
    diagnosis: string;
    bp: string;
    pulse: string;
    temp: string;
    spo2: string;
    weight: string;
    treatment: string;
    prescriptionNotes: string;
    followUpDate: string;
  };
  rxMeds: PrescribedMedicine[];
  selectedComplaints: string[];
  updatedAt: string;
}

const DRAFT_KEY = 'hcms_opd_visit_draft';

export function saveVisitDraft(draft: Omit<VisitDraft, 'updatedAt'>): void {
  try {
    const data: VisitDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save visit draft', e);
  }
}

export function getVisitDraft(): VisitDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VisitDraft;
  } catch (e) {
    console.error('Failed to parse visit draft', e);
    return null;
  }
}

export function clearVisitDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.error('Failed to clear visit draft', e);
  }
}
