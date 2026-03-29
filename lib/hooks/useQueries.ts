// lib/hooks/useQueries.ts
// React Query wrappers around our DataProvider

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProviderStore } from '../providers';
import { useAuth } from './useAuth';
import type { 
  PatientListParams, 
  VisitListParams, 
  MedicineListParams,
  CreatePatientInput,
  UpdatePatientInput,
  CreateVisitInput,
  UpdateVisitInput,
  CreateMedicineInput,
  UpdateMedicineInput,
  CreateTemplateInput,
  ClinicSettings,
  AuthLoginInput,
  AuthSignupInput
} from '../providers/types';

// Query Keys
export const keys = {
  all: ['hcms'] as const,
  patients: () => [...keys.all, 'patients'] as const,
  patient: (id: string) => [...keys.patients(), id] as const,
  visits: () => [...keys.all, 'visits'] as const,
  visit: (id: number) => [...keys.visits(), id] as const,
  patientVisits: (pid: string) => [...keys.visits(), 'patient', pid] as const,
  medicines: () => [...keys.all, 'medicines'] as const,
  templates: () => [...keys.all, 'templates'] as const,
  settings: () => [...keys.all, 'settings'] as const,
  dashboard: () => [...keys.all, 'dashboard'] as const,
  followups: () => [...keys.all, 'followups'] as const,
};

// ── Patients ───────────────────────────────────────────────────

export function usePatients(params?: PatientListParams) {
  const provider = useProviderStore(s => s.provider);
  // Important: we include params in the queryKey so it refetches on search
  return useQuery({
    queryKey: [...keys.patients(), params],
    queryFn: () => provider.listPatients(params),
  });
}

export function usePatient(id: string) {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: keys.patient(id),
    queryFn: () => provider.getPatient(id),
    enabled: !!id,
  });
}

export function usePatientMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const create = useMutation({
    mutationFn: (input: CreatePatientInput) => provider.createPatient(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.patients() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePatientInput }) => 
      provider.updatePatient(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: keys.patient(id) });
      qc.invalidateQueries({ queryKey: keys.patients() });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => provider.deletePatient(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: keys.patient(id) });
      qc.invalidateQueries({ queryKey: keys.patients() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
    },
  });

  return { create, update, remove };
}

// ── Visits ─────────────────────────────────────────────────────

export function usePatientVisits(patientId: string) {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: keys.patientVisits(patientId),
    queryFn: () => provider.getPatientVisits(patientId),
    enabled: !!patientId,
  });
}

export function useVisit(id: number) {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: keys.visit(id),
    queryFn: () => provider.getVisit(id),
    enabled: !!id,
  });
}

export function useFollowUps() {
  const provider = useProviderStore(s => s.provider);
  
  const today = useQuery({
    queryKey: [...keys.followups(), 'today'],
    queryFn: () => provider.getTodayFollowUps(),
  });

  const upcoming = useQuery({
    queryKey: [...keys.followups(), 'upcoming'],
    queryFn: () => provider.getUpcomingFollowUps(30),
  });

  return { today, upcoming };
}

export function useVisitMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const create = useMutation({
    mutationFn: (input: CreateVisitInput) => provider.createVisit(input),
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: keys.patientVisits(input.patientId) });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
      qc.invalidateQueries({ queryKey: keys.followups() });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateVisitInput }) => 
      provider.updateVisit(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: keys.visit(id) });
      // We invalidate all visits to be safe covering patient history
      qc.invalidateQueries({ queryKey: keys.visits() }); 
      qc.invalidateQueries({ queryKey: keys.dashboard() });
    },
  });

  const markFollowUp = useMutation({
    mutationFn: (id: number) => provider.markFollowUpAttended(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.followups() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
      qc.invalidateQueries({ queryKey: keys.visits() });
    },
  });

  return { create, update, markFollowUp };
}

// ── Dashboard ──────────────────────────────────────────────────

export function useDashboardStats() {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: keys.dashboard(),
    queryFn: () => provider.getDashboardStats(),
  });
}

// ── Reports ────────────────────────────────────────────────────
export function useReports(startDate: string, endDate: string) {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: [...keys.visits(), 'reports', { startDate, endDate }],
    queryFn: () => provider.listVisits({ startDate, endDate }),
  });
}

// ── Medicines & Templates ──────────────────────────────────────

export function useMedicines(params?: MedicineListParams) {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: [...keys.medicines(), params],
    queryFn: () => provider.listMedicines(params),
  });
}

export function useMedicineMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const create = useMutation({
    mutationFn: (input: CreateMedicineInput) => provider.createMedicine(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.medicines() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateMedicineInput }) => 
      provider.updateMedicine(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.medicines() }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => provider.deleteMedicine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.medicines() }),
  });

  return { create, update, remove };
}

export function useTemplates() {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: keys.templates(),
    queryFn: () => provider.listTemplates(),
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const create = useMutation({
    mutationFn: (input: CreateTemplateInput) => provider.createTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates() }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => provider.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates() }),
  });

  return { create, remove };
}

// ── Settings ───────────────────────────────────────────────────

export function useSettings() {
  const provider = useProviderStore(s => s.provider);
  return useQuery({
    queryKey: keys.settings(),
    queryFn: () => provider.getSettings(),
  });
}

export function useSettingsMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const update = useMutation({
    mutationFn: (settings: Partial<ClinicSettings>) => provider.updateSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings() }),
  });

  return { update };
}

// ── Auth ───────────────────────────────────────────────────────

export function useAuthMutations() {
  const provider = useProviderStore(s => s.provider);
  const { login } = useAuth();

  const authLogin = useMutation({
    mutationFn: (input: AuthLoginInput) => provider.authLogin(input),
    onSuccess: (data) => {
      if (data.success && data.user && data.token) {
        login({ user: data.user, token: data.token });
      }
    }
  });

  const authSignup = useMutation({
    mutationFn: (input: AuthSignupInput) => provider.authSignup(input),
    onSuccess: (data) => {
      if (data.success && data.user && data.token) {
        login({ user: data.user, token: data.token });
      }
    }
  });

  return { authLogin, authSignup };
}
