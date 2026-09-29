// lib/hooks/useQueries.ts
// React Query wrappers around our DataProvider

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useProviderStore } from '../providers';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { startFreshSession } from '../auth/session';
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
  UpdateTemplateInput,
  ClinicSettings,
  AuthLoginInput,
  AuthSignupInput,
  UpdateUserInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  CreateAppOptionInput,
  SelectPlanInput,
  VerifyPaymentInput,
  RazorpayOrderRequest,
  OnboardStaffInput,
  CreateRoleInput,
  EnqueueInput,
  UpdateQueueStatusInput,
  QueueEntry,
  PlatformListParams,
  AdminUpdateSubscriptionInput,
} from '../providers/types';

// Query Keys
export const keys = {
  all: ['hcms'] as const,
  patients: () => [...keys.all, 'patients'] as const,
  patient: (id: string) => [...keys.patients(), id] as const,
  visits: () => [...keys.all, 'visits'] as const,
  visit: (id: string | number) => [...keys.visits(), id] as const,
  patientVisits: (pid: string) => [...keys.visits(), 'patient', pid] as const,
  medicines: () => [...keys.all, 'medicines'] as const,
  templates: () => [...keys.all, 'templates'] as const,
  settings: () => [...keys.all, 'settings'] as const,
  dashboard: () => [...keys.all, 'dashboard'] as const,
  followups: () => [...keys.all, 'followups'] as const,
  options: () => [...keys.all, 'options'] as const,
  subscription: () => [...keys.all, 'subscription'] as const,
  organization: () => [...keys.all, 'organization'] as const,
  roles: () => [...keys.all, 'roles'] as const,
  queue: () => [...keys.all, 'queue'] as const,
};

// ── Patients ───────────────────────────────────────────────────

export function usePatients(params?: PatientListParams, options: { enabled?: boolean } = {}) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  return useQuery({
    queryKey: [...keys.patients(), 'list', params],
    queryFn: () => provider.listPatients(params),
    enabled: isAuthenticated && !!token && hasPermission('PATIENTS', 'canRead') && (options.enabled ?? true),
    // Keep the current page visible while the next page / search result loads
    placeholderData: keepPreviousData,
  });
}

export function usePatient(id: string) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  return useQuery({
    queryKey: keys.patient(id),
    queryFn: () => provider.getPatient(id),
    enabled: isAuthenticated && !!token && !!id && hasPermission('PATIENTS', 'canRead'),
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
      qc.invalidateQueries({ queryKey: keys.visits() });
      qc.invalidateQueries({ queryKey: keys.followups() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
    },
  });

  // Restores a soft-deleted patient together with their visits (409 if the mobile is now taken)
  const restore = useMutation({
    mutationFn: (id: string) => provider.restorePatient(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: keys.patient(id) });
      qc.invalidateQueries({ queryKey: keys.patients() });
      qc.invalidateQueries({ queryKey: keys.visits() });
      qc.invalidateQueries({ queryKey: keys.followups() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
    },
  });

  return { create, update, remove, restore };
}

export function useDeletedPatients(page: number, limit: number, enabled: boolean) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { isSuperAdmin, hasPermission } = usePermissions();
  return useQuery({
    queryKey: [...keys.patients(), 'deleted', { page, limit }],
    queryFn: () => provider.listDeletedPatients({ page, limit }),
    enabled: enabled && isAuthenticated && !!token && (isSuperAdmin || hasPermission('PATIENTS', 'canDelete')),
    placeholderData: keepPreviousData,
  });
}

// ── Visits ─────────────────────────────────────────────────────

export function usePatientVisits(patientId: string) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  return useQuery({
    queryKey: keys.patientVisits(patientId),
    queryFn: () => provider.getPatientVisits(patientId),
    enabled: isAuthenticated && !!token && !!patientId && hasPermission('VISITS', 'canRead'),
  });
}

export function useVisit(id: string | number) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  return useQuery({
    queryKey: keys.visit(id),
    queryFn: () => provider.getVisit(id),
    enabled: isAuthenticated && !!token && !!id && hasPermission('VISITS', 'canRead'),
  });
}

export function useFollowUps() {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  const canReadFollowups = hasPermission('FOLLOWUPS', 'canRead');
  
  const today = useQuery({
    queryKey: [...keys.followups(), 'today'],
    queryFn: () => provider.getTodayFollowUps(),
    enabled: isAuthenticated && !!token && canReadFollowups,
  });

  const upcoming = useQuery({
    queryKey: [...keys.followups(), 'upcoming'],
    queryFn: () => provider.getUpcomingFollowUps(30),
    enabled: isAuthenticated && !!token && canReadFollowups,
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
      qc.invalidateQueries({ queryKey: keys.queue() });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string | number; input: UpdateVisitInput }) => 
      provider.updateVisit(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: keys.visit(id) });
      qc.invalidateQueries({ queryKey: keys.visits() }); 
      qc.invalidateQueries({ queryKey: keys.dashboard() });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string | number) => provider.deleteVisit(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: keys.visit(id) });
      qc.invalidateQueries({ queryKey: keys.visits() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
      qc.invalidateQueries({ queryKey: keys.followups() });
    },
  });

  const markFollowUp = useMutation({
    mutationFn: (id: string | number) => provider.markFollowUpAttended(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.followups() });
      qc.invalidateQueries({ queryKey: keys.dashboard() });
      qc.invalidateQueries({ queryKey: keys.visits() });
    },
  });

  return { create, update, remove, markFollowUp };
}

// ── Dashboard ──────────────────────────────────────────────────

export function useDashboardStats() {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { isSuperAdmin } = usePermissions();
  return useQuery({
    queryKey: keys.dashboard(),
    queryFn: () => provider.getDashboardStats(),
    enabled: isAuthenticated && !!token && isSuperAdmin,
  });
}

// ── Reports ────────────────────────────────────────────────────
export function useReports(startDate: string, endDate: string) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { isSuperAdmin, hasPermission } = usePermissions();
  return useQuery({
    queryKey: [...keys.visits(), 'reports', { startDate, endDate }],
    // endDate is inclusive: extend it to the end of that (UTC) day, matching the page's date-part filter
    queryFn: () => provider.listVisits({ startDate, endDate: `${endDate}T23:59:59.999Z` }),
    enabled: isAuthenticated && !!token && !!startDate && !!endDate && (isSuperAdmin || hasPermission('REPORTS', 'canRead')),
  });
}

// ── Medicines & Templates ──────────────────────────────────────

export function useMedicines(params?: MedicineListParams) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { isSuperAdmin, hasPermission } = usePermissions();
  return useQuery({
    queryKey: [...keys.medicines(), params],
    queryFn: () => provider.listMedicines(params),
    enabled: isAuthenticated && !!token && (isSuperAdmin || hasPermission('MEDICINES', 'canRead')),
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

  const bulkCreate = useMutation({
    mutationFn: (inputs: CreateMedicineInput[]) => provider.bulkCreateMedicines(inputs),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.medicines() }),
  });

  return { create, update, remove, bulkCreate };
}

export function useTemplates() {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  return useQuery({
    queryKey: keys.templates(),
    queryFn: () => provider.listTemplates(),
    enabled: isAuthenticated && !!token && hasPermission('TEMPLATES', 'canRead'),
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const create = useMutation({
    mutationFn: (input: CreateTemplateInput) => provider.createTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTemplateInput }) =>
      provider.updateTemplate(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates() }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => provider.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.templates() }),
  });

  return { create, update, remove };
}

// ── App Options ────────────────────────────────────────────────

export function useAppOptions(type?: string) {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission } = usePermissions();
  return useQuery({
    queryKey: [...keys.options(), type],
    queryFn: () => provider.listOptions(type),
    enabled: isAuthenticated && !!token && hasPermission('OPTIONS', 'canRead'),
  });
}

export function useAppOptionMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);

  const create = useMutation({
    mutationFn: (input: CreateAppOptionInput) => provider.createOption(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.options() }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => provider.deleteOption(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.options() }),
  });

  return { create, remove };
}

// ── Settings ───────────────────────────────────────────────────

export function useSettings() {
  const provider = useProviderStore(s => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { hasPermission, isSuperAdmin } = usePermissions();
  return useQuery({
    queryKey: keys.settings(),
    queryFn: () => provider.getSettings(),
    enabled: isAuthenticated && !!token && (isSuperAdmin || hasPermission('SETTINGS', 'canRead')),
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
        startFreshSession();
        login({ user: data.user, token: data.token });
      }
    }
  });

  const authSignup = useMutation({
    mutationFn: (input: AuthSignupInput) => provider.authSignup(input),
    onSuccess: (data) => {
      if (data.success && data.user && data.token) {
        startFreshSession();
        login({ user: data.user, token: data.token });
      }
    }
  });

  const updateUser = useMutation({
    mutationFn: (input: UpdateUserInput) => provider.updateUser(input),
    onSuccess: (data) => {
      if (data.success && data.user) {
        useAuth.setState(state => ({
          ...state,
          user: data.user
        }));
      }
    }
  });

  const forgotPassword = useMutation({
    mutationFn: (input: ForgotPasswordInput) => provider.forgotPassword(input),
  });

  const resetPassword = useMutation({
    mutationFn: (input: ResetPasswordInput) => provider.resetPassword(input),
  });

  return { authLogin, authSignup, updateUser, forgotPassword, resetPassword };
}

// ── Subscription ───────────────────────────────────────────────

export function useSubscription() {
  const provider = useProviderStore(s => s.provider);
  const { updateSubscription, isAuthenticated, token } = useAuth();
  const { isSuperAdmin } = usePermissions();
  return useQuery({
    queryKey: keys.subscription(),
    queryFn: async () => {
      const sub = await provider.getSubscriptionStatus();
      if (sub) {
        updateSubscription(sub);
      }
      return sub;
    },
    enabled: isAuthenticated && !!token && isSuperAdmin,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}

export function useSubscriptionMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore(s => s.provider);
  const { updateSubscription } = useAuth();

  const selectPlan = useMutation({
    mutationFn: (input: SelectPlanInput) => provider.selectPlan(input),
    onSuccess: (data) => {
      if (data.subscription) {
        updateSubscription(data.subscription);
      }
      qc.invalidateQueries({ queryKey: keys.subscription() });
    },
  });

  const createRazorpayOrder = useMutation({
    mutationFn: (input: RazorpayOrderRequest) => provider.createRazorpayOrder(input),
  });

  const verifyPayment = useMutation({
    mutationFn: (input: VerifyPaymentInput) => provider.verifyPayment(input),
    onSuccess: (data) => {
      if (data.subscription) {
        updateSubscription(data.subscription);
      }
      qc.invalidateQueries({ queryKey: keys.subscription() });
    },
  });

  return { selectPlan, createRazorpayOrder, verifyPayment };
}

export function useOrganizationInfo() {
  const provider = useProviderStore((s) => s.provider);
  const { isAuthenticated, token } = useAuth();
  const { isSuperAdmin } = usePermissions();

  return useQuery({
    queryKey: keys.organization(),
    queryFn: () => provider.getOrganizationInfo(),
    enabled: (isAuthenticated || !!token) && isSuperAdmin,
    staleTime: 1000 * 60 * 2, // 2 mins cache
  });
}

export function useStaffMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore((s) => s.provider);

  const onboardStaff = useMutation({
    mutationFn: (input: OnboardStaffInput) => provider.onboardStaff(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.organization() });
    },
  });

  const toggleStaffStatus = useMutation({
    mutationFn: ({ staffId, isActive }: { staffId: string; isActive: boolean }) =>
      provider.toggleStaffStatus(staffId, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.organization() });
    },
  });

  const deleteStaff = useMutation({
    mutationFn: (staffId: string) => provider.deleteStaff(staffId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.organization() });
    },
  });

  return { onboardStaff, toggleStaffStatus, deleteStaff };
}

export function useRoles() {
  const provider = useProviderStore((s) => s.provider);
  const { isAuthenticated, token } = useAuth();

  return useQuery({
    queryKey: keys.roles(),
    queryFn: () => provider.listRoles(),
    enabled: isAuthenticated || !!token,
    staleTime: 1000 * 60 * 5, // 5 mins cache
  });
}

export function useRoleMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore((s) => s.provider);

  const createRole = useMutation({
    mutationFn: (input: CreateRoleInput) => provider.createRole(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.roles() });
      qc.invalidateQueries({ queryKey: keys.organization() });
    },
  });

  const deleteRole = useMutation({
    mutationFn: (roleId: string) => provider.deleteRole(roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.roles() });
      qc.invalidateQueries({ queryKey: keys.organization() });
    },
  });

  return { createRole, deleteRole };
}

// ── OPD Queue ───────────────────────────────────────────────────

export function useQueue() {
  const provider = useProviderStore((s) => s.provider);
  const { isAuthenticated, token } = useAuth();
  return useQuery({
    queryKey: keys.queue(),
    queryFn: () => provider.getQueue(),
    enabled: isAuthenticated && !!token,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useQueueMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore((s) => s.provider);
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.queue() });

  const enqueue = useMutation({
    mutationFn: (payload: EnqueueInput) => provider.enqueue(payload),
    onSuccess: invalidate,
  });

  const callNext = useMutation({
    mutationFn: () => provider.callNextInQueue(),
    onSuccess: invalidate,
  });

  const updateStatus = useMutation({
    mutationFn: (input: UpdateQueueStatusInput) => provider.updateQueueStatus(input),
    onSuccess: invalidate,
  });

  const removeFromQueue = useMutation({
    mutationFn: (id: string) => provider.removeFromQueue(id),
    onSuccess: invalidate,
  });

  // Persists the order of WAITING items (POST /queue/reorder). The cache is updated optimistically,
  // rolled back on error (callers show the error toast) and replaced by the server's order on success.
  const reorderQueue = useMutation({
    mutationFn: (orderedIds: string[]) => provider.reorderQueue(orderedIds),
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: keys.queue() });
      const previous = qc.getQueryData<QueueEntry[]>(keys.queue());
      if (Array.isArray(previous)) {
        const byId = new Map(previous.map((item) => [item.id, item]));
        const ordered = orderedIds.map((id) => byId.get(id)).filter((item): item is QueueEntry => !!item);
        const orderedSet = new Set(orderedIds);
        const notWaiting = previous.filter((item) => !orderedSet.has(item.id) && item.status !== 'WAITING');
        const otherWaiting = previous.filter((item) => !orderedSet.has(item.id) && item.status === 'WAITING');
        qc.setQueryData<QueueEntry[]>(keys.queue(), [...notWaiting, ...ordered, ...otherWaiting]);
      }
      return { previous };
    },
    onError: (_err, _orderedIds, context) => {
      if (context?.previous) {
        qc.setQueryData(keys.queue(), context.previous);
      }
      invalidate();
    },
    onSuccess: (queue) => {
      qc.setQueryData(keys.queue(), queue);
    },
  });

  return { enqueue, callNext, updateStatus, removeFromQueue, reorderQueue };
}

// ── Platform operator (AMAN) ────────────────────────────────────

export const platformKeys = {
  all: [...keys.all, 'platform'] as const,
  stats: () => [...platformKeys.all, 'stats'] as const,
  organizations: () => [...platformKeys.all, 'organizations'] as const,
  organizationList: (params: PlatformListParams) => [...platformKeys.organizations(), 'list', params] as const,
  organization: (id: string) => [...platformKeys.organizations(), 'detail', id] as const,
  transactions: (params: PlatformListParams) => [...platformKeys.all, 'transactions', params] as const,
};

function usePlatformEnabled() {
  const { isAuthenticated, token, user } = useAuth();
  return isAuthenticated && !!token && user?.platformRole === 'AMAN';
}

export function usePlatformStats() {
  const provider = useProviderStore((s) => s.provider);
  const enabled = usePlatformEnabled();
  return useQuery({
    queryKey: platformKeys.stats(),
    queryFn: () => provider.getPlatformStats(),
    enabled,
    staleTime: 1000 * 60,
  });
}

export function usePlatformOrganizations(params: PlatformListParams) {
  const provider = useProviderStore((s) => s.provider);
  const enabled = usePlatformEnabled();
  return useQuery({
    queryKey: platformKeys.organizationList(params),
    queryFn: () => provider.listPlatformOrganizations(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}

export function usePlatformOrganization(orgId: string) {
  const provider = useProviderStore((s) => s.provider);
  const enabled = usePlatformEnabled();
  return useQuery({
    queryKey: platformKeys.organization(orgId),
    queryFn: () => provider.getPlatformOrganization(orgId),
    enabled: enabled && !!orgId,
    staleTime: 1000 * 30,
  });
}

export function usePlatformTransactions(params: PlatformListParams) {
  const provider = useProviderStore((s) => s.provider);
  const enabled = usePlatformEnabled();
  return useQuery({
    queryKey: platformKeys.transactions(params),
    queryFn: () => provider.listPlatformTransactions(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  });
}

export function usePlatformMutations() {
  const qc = useQueryClient();
  const provider = useProviderStore((s) => s.provider);

  const invalidateOrg = (orgId?: string) => {
    qc.invalidateQueries({ queryKey: platformKeys.stats() });
    if (orgId) {
      qc.invalidateQueries({ queryKey: platformKeys.organization(orgId) });
    }
    qc.invalidateQueries({ queryKey: [...platformKeys.organizations(), 'list'] });
  };

  const updateSubscription = useMutation({
    mutationFn: ({ orgId, input }: { orgId: string; input: AdminUpdateSubscriptionInput }) =>
      provider.updatePlatformOrganizationSubscription(orgId, input),
    onSuccess: (_data, { orgId }) => invalidateOrg(orgId),
  });

  const updateUserStatus = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean; orgId?: string }) =>
      provider.updatePlatformUserStatus(userId, isActive),
    onSuccess: (_data, { orgId }) => invalidateOrg(orgId),
  });

  return { updateSubscription, updateUserStatus };
}

