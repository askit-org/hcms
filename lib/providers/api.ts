// lib/providers/api.ts
// REST API Data Provider (for future backend integration)

import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import { logout } from '@/lib/auth/session';
import type {
  AuthLoginInput,
  AuthSignupInput,
  UpdateUserInput,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  ResetPasswordInput,
  ResetPasswordResponse,
  AuthResponse,
  ClinicSettings,
  CreateAppOptionInput,
  AppOption,
  Bill,
  CreateBillInput,
  RecordPaymentInput,
  PendingDuesResponse,
  IpdAdmission,
  CreateIpdAdmissionInput,
  AddIpdDayLogInput,
  DischargeIpdInput,
  CreateMedicineInput,
  CreatePatientInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateVisitInput,
  DashboardStats,
  DataProvider,
  FollowUpItem,
  Medicine,
  MedicineListParams,
  Patient,
  PatientListParams,
  Template,
  UpdateMedicineInput,
  UpdatePatientInput,
  UpdateVisitInput,
  Visit,
  VisitListParams,
  UserSubscription,
  OrganizationInfoResponse,
  OnboardStaffInput,
  StaffUser,
  AppRole,
  CreateRoleInput,
  SelectPlanInput,
  VerifyPaymentInput,
  RazorpayOrderRequest,
  RazorpayOrderResponse,
  SubscriptionResponse,
  EnqueueInput,
  QueueEntry,
  UpdateQueueStatusInput,
  PlatformStats,
  PlatformListParams,
  PlatformPage,
  ListPage,
  PlatformOrganization,
  PlatformOrganizationDetail,
  PlatformTransaction,
  AdminUpdateSubscriptionInput,
  AdminUpdateSubscriptionResponse,
  ImpersonateUserInput,
  ImpersonateResponse,
  PlatformOnboardingResponse,
  PlatformAuditQuery,
  PlatformAuditResponse,
  PlatformAuditMonth,
  ExportMonthlyAuditInput,
  ExportMonthlyAuditResponse,
  PlatformLivePulseData,
  PlatformLiveActivityEvent,
  IncidentAlertItem,
  IncidentQuery,
  IncidentListResponse,
  ResolveIncidentInput,
  CreateTestIncidentInput,
  SaaSAnalyticsData,
  SystemAnnouncement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from './types';

// The API base URL must be configured explicitly (next.config.ts fails production builds without it).
// There is intentionally no same-origin fallback: this app has no API routes of its own.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE_URL && typeof window !== 'undefined') {
  console.error('[HCMS] NEXT_PUBLIC_API_URL is not set — API requests will fail.');
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /** When true, a 401 on this request is returned to the caller instead of ending the session. */
    skipAuthLogout?: boolean;
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 15000, // 15s timeout to allow headroom for remote cloud database latency
});

// Request Interceptor: Attach the current token from useAuth store to every request
api.interceptors.request.use((config) => {
  // Use useAuth.getState() to pull the token outside of React lifecycle
  const token = useAuth.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Surface backend error messages in toast; end the session on HTTP 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const isAuthenticated = useAuth.getState().isAuthenticated;

    if (status === 401) {
      // Requests that expect 401 as a normal outcome (e.g. wrong current password) handle it themselves
      if (isAuthenticated && !error.config?.skipAuthLogout) {
        logout('unauthorized');
      }
      return Promise.reject(error);
    }

    // Subscription expired: expire the user's session and log them out instead of showing an error toast
    const rawError = String(data?.error || data?.message || '');
    const isSubscriptionExpired =
      data?.code === 'SUBSCRIPTION_EXPIRED' ||
      /subscription.*expired/i.test(rawError) ||
      /organization subscription is expired/i.test(rawError);

    if (isSubscriptionExpired) {
      if (isAuthenticated && !error.config?.skipAuthLogout) {
        const user = useAuth.getState().user;
        const roleCode = (user?.roleCode || user?.role || '').toString().toUpperCase();
        const isSuperAdmin =
          roleCode === 'SUPER_ADMIN' ||
          (!user?.role && !user?.roleCode && !user?.platformRole);

        if (!isSuperAdmin) {
          // Staff member cannot renew: log them out with session expired reason
          logout('subscription_expired');
        } else {
          // Super Admin (Clinic Owner) must stay logged in so they can renew via OnboardingPlansModal
          const currentSub = user?.subscription;
          if (currentSub?.subscriptionStatus !== 'expired') {
            useAuth.getState().updateSubscription({
              ...(currentSub || { planType: 'none', hasSelectedPlan: true }),
              subscriptionStatus: 'expired',
            });
          }
        }
      }
      return Promise.reject(error);
    }

    // Logged out: let callers handle errors without global toasts
    if (!isAuthenticated) {
      return Promise.reject(error);
    }

    // Handle NestJS Throttler Rate Limiting (429 Too Many Requests)
    if (status === 429) {
      toast('Too many requests. Please slow down and try again in a minute.', 'error');
      return Promise.reject(error);
    }

    const message = getErrorMessage(error, 'An unexpected error occurred');

    // Trigger global toast alert for legitimate operational errors
    toast(message, 'error');

    return Promise.reject(error);
  }
);

// Response Unwrapping Helpers (handles both direct payloads & wrapped { success: true, data: [...] } responses)
function extract<T>(response: { data: any }, key?: string): T {
  const d = response.data;
  if (d === null || d === undefined) return d as T;
  if (key && d[key] !== undefined) return d[key] as T;
  if (d.data !== undefined) return d.data as T;
  return d as T;
}

function extractArray<T>(response: { data: any }, key?: string): T[] {
  const d = response.data;
  if (Array.isArray(d)) return d as T[];
  if (key && Array.isArray(d[key])) return d[key] as T[];
  if (Array.isArray(d?.data)) return d.data as T[];
  if (Array.isArray(d?.items)) return d.items as T[];
  return [];
}

const res = <T>(response: { data: any }): T => extract<T>(response);

// Paginated lists: `{ success, data: [...], meta: { page, limit, total } }` — keep the meta
function extractPage<T>(response: { data: unknown }): ListPage<T> {
  const d = response.data as { data?: unknown; meta?: Partial<Record<'page' | 'limit' | 'total', unknown>> } | unknown[] | null;
  const rows = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [];
  const meta = !Array.isArray(d) && d?.meta ? d.meta : {};
  return {
    data: rows as T[],
    meta: {
      page: Number(meta.page) || 1,
      limit: Number(meta.limit) || rows.length,
      total: Number(meta.total) || rows.length,
    },
  };
}

export const ApiDataProvider: DataProvider = {
  // ── Auth ───────────────────────────────────────────────────────
  async authLogin(input: AuthLoginInput): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/login', input).then((r) => extract<AuthResponse>(r));
  },
  async authSignup(input: AuthSignupInput): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/signup', input).then((r) => extract<AuthResponse>(r));
  },
  async updateUser(input: UpdateUserInput): Promise<AuthResponse> {
    // A wrong `currentPassword` yields 401 — surface it to the form instead of logging out
    return api.put<AuthResponse>('/auth/user', input, { skipAuthLogout: !!input.currentPassword }).then((r) => extract<AuthResponse>(r));
  },
  async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
    return api.post<ForgotPasswordResponse>('/auth/forgot-password', input).then((r) => extract<ForgotPasswordResponse>(r));
  },
  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResponse> {
    return api.post<ResetPasswordResponse>('/auth/reset-password', input).then((r) => extract<ResetPasswordResponse>(r));
  },
  async getSubscriptionStatus(): Promise<UserSubscription> {
    return api.get<{ subscription: UserSubscription }>('/subscription/status').then((r) => extract<UserSubscription>(r, 'subscription'));
  },
  async selectPlan(input: SelectPlanInput): Promise<SubscriptionResponse> {
    return api.post<SubscriptionResponse>('/subscription/select-plan', input).then((r) => extract<SubscriptionResponse>(r));
  },
  async createRazorpayOrder(input: RazorpayOrderRequest): Promise<RazorpayOrderResponse> {
    return api.post<RazorpayOrderResponse>('/subscription/razorpay-order', input).then((r) => extract<RazorpayOrderResponse>(r));
  },
  async verifyPayment(input: VerifyPaymentInput): Promise<SubscriptionResponse> {
    return api.post<SubscriptionResponse>('/subscription/verify-payment', input).then((r) => extract<SubscriptionResponse>(r));
  },
  async getOrganizationInfo(): Promise<OrganizationInfoResponse> {
    return api.get<OrganizationInfoResponse>('/organization/info').then((r) => extract<OrganizationInfoResponse>(r));
  },
  async onboardStaff(input: OnboardStaffInput): Promise<StaffUser> {
    return api.post<StaffUser>('/organization/staff', input).then((r) => extract<StaffUser>(r));
  },
  async toggleStaffStatus(staffId: string, isActive: boolean): Promise<StaffUser> {
    return api.patch<StaffUser>(`/organization/staff/${staffId}/status`, { isActive }).then((r) => extract<StaffUser>(r));
  },
  async deleteStaff(staffId: string): Promise<void> {
    return api.delete(`/organization/staff/${staffId}`).then(() => undefined);
  },
  async listRoles(): Promise<AppRole[]> {
    return api.get<AppRole[]>('/organization/roles').then((r) => extractArray<AppRole>(r, 'roles'));
  },
  async createRole(input: CreateRoleInput): Promise<AppRole> {
    return api.post<AppRole>('/organization/roles', input).then((r) => extract<AppRole>(r));
  },
  async deleteRole(roleId: string): Promise<void> {
    return api.delete(`/organization/roles/${roleId}`).then(() => undefined);
  },

  // ── Patients ───────────────────────────────────────────────────
  async listPatients(params?: PatientListParams): Promise<ListPage<Patient>> {
    return api.get('/patients', { params }).then((r) => extractPage<Patient>(r));
  },
  async getPatient(patientId: string): Promise<Patient | undefined> {
    return api.get<Patient>(`/patients/${patientId}`).then((r) => extract<Patient>(r));
  },
  async createPatient(input: CreatePatientInput): Promise<Patient> {
    return api.post<Patient>('/patients', input).then((r) => extract<Patient>(r));
  },
  async updatePatient(patientId: string, input: UpdatePatientInput): Promise<Patient> {
    return api.put<Patient>(`/patients/${patientId}`, input).then((r) => extract<Patient>(r));
  },
  async deletePatient(patientId: string): Promise<void> {
    return api.delete(`/patients/${patientId}`).then(() => undefined);
  },
  async listDeletedPatients(params?: { page?: number; limit?: number }): Promise<ListPage<Patient>> {
    return api.get('/patients/deleted', { params }).then((r) => extractPage<Patient>(r));
  },
  async restorePatient(patientId: string): Promise<Patient> {
    return api.post<Patient>(`/patients/${encodeURIComponent(patientId)}/restore`).then((r) => extract<Patient>(r));
  },
  async generatePatientId(): Promise<string> {
    return api.get<{ id: string }>('/patients/generate-id').then((r) => r.data.id);
  },

  // ── Visits ─────────────────────────────────────────────────────
  async listVisits(params?: VisitListParams): Promise<ListPage<Visit>> {
    return api.get('/visits', { params }).then((r) => extractPage<Visit>(r));
  },
  async getVisit(visitId: string | number): Promise<Visit | undefined> {
    return api.get<Visit>(`/visits/${visitId}`).then((r) => extract<Visit>(r));
  },
  async getPatientVisits(patientId: string): Promise<Visit[]> {
    return api.get<Visit[]>(`/patients/${patientId}/visits`).then((r) => extractArray<Visit>(r, 'visits'));
  },
  async createVisit(input: CreateVisitInput): Promise<Visit> {
    return api.post<Visit>('/visits', input).then((r) => extract<Visit>(r));
  },
  async updateVisit(visitId: string | number, input: UpdateVisitInput): Promise<Visit> {
    return api.put<Visit>(`/visits/${visitId}`, input).then((r) => extract<Visit>(r));
  },
  async deleteVisit(visitId: string | number): Promise<void> {
    return api.delete(`/visits/${visitId}`).then(() => undefined);
  },
  async getTodayVisits(): Promise<Visit[]> {
    return api.get<Visit[]>('/visits/today').then((r) => extractArray<Visit>(r, 'visits'));
  },
  async getTodayFollowUps(): Promise<FollowUpItem[]> {
    return api.get<FollowUpItem[]>('/visits/followups/today').then((r) => extractArray<FollowUpItem>(r, 'followups'));
  },
  async getUpcomingFollowUps(days = 7): Promise<FollowUpItem[]> {
    return api.get<FollowUpItem[]>('/visits/followups/upcoming', { params: { days } }).then((r) => extractArray<FollowUpItem>(r, 'followups'));
  },
  async markFollowUpAttended(visitId: string | number): Promise<Visit> {
    try {
      return await api.post<Visit>(`/visits/${visitId}/mark-attended`).then((r) => extract<Visit>(r));
    } catch (err) {
      try {
        return await api.put<Visit>(`/visits/${visitId}`, { followUpAttended: true, followUpStatus: 'ATTENDED' }).then((r) => extract<Visit>(r));
      } catch (err2) {
        return await api.patch<Visit>(`/visits/${visitId}`, { followUpAttended: true, followUpStatus: 'ATTENDED' }).then((r) => extract<Visit>(r));
      }
    }
  },
  async updateFollowUpStatus(visitId: string | number, status: 'ATTENDED' | 'NOT_ATTENDED' | 'RESCHEDULED', newDate?: string): Promise<Visit> {
    try {
      return await api.post<Visit>(`/visits/${visitId}/followup-status`, { status, newDate }).then((r) => extract<Visit>(r));
    } catch (err) {
      const payload: any = { followUpStatus: status };
      if (status === 'ATTENDED') {
        payload.followUpAttended = true;
      } else if (status === 'RESCHEDULED' && newDate) {
        payload.followUpAttended = false;
        payload.followUpDate = newDate;
      } else {
        payload.followUpAttended = false;
      }
      return await api.put<Visit>(`/visits/${visitId}`, payload).then((r) => extract<Visit>(r));
    }
  },

  // ── Medicines ──────────────────────────────────────────────────
  async listMedicines(params?: MedicineListParams): Promise<Medicine[]> {
    return api.get<Medicine[]>('/medicines', { params }).then((r) => extractArray<Medicine>(r, 'medicines'));
  },
  async createMedicine(input: CreateMedicineInput): Promise<Medicine> {
    return api.post<Medicine>('/medicines', input).then((r) => extract<Medicine>(r));
  },
  async bulkCreateMedicines(inputs: CreateMedicineInput[]): Promise<Medicine[]> {
    return api.post<Medicine[]>('/medicines/bulk', { medicines: inputs }).then((r) => extractArray<Medicine>(r));
  },
  async updateMedicine(id: number, input: UpdateMedicineInput): Promise<Medicine> {
    return api.put<Medicine>(`/medicines/${id}`, input).then((r) => extract<Medicine>(r));
  },
  async deleteMedicine(id: number): Promise<void> {
    return api.delete(`/medicines/${id}`).then(() => undefined);
  },
  async seedMedicines(): Promise<void> {
    return api.post('/medicines/seed').then(() => undefined);
  },

  // ── Templates ──────────────────────────────────────────────────
  async listTemplates(): Promise<Template[]> {
    return api.get<Template[]>('/templates').then((r) => extractArray<Template>(r, 'templates'));
  },
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    return api.post<Template>('/templates', input).then((r) => extract<Template>(r));
  },
  async updateTemplate(id: number, input: UpdateTemplateInput): Promise<Template> {
    return api.put<Template>(`/templates/${id}`, input).then((r) => extract<Template>(r));
  },
  async deleteTemplate(id: number): Promise<void> {
    return api.delete(`/templates/${id}`).then(() => undefined);
  },

  // ── Settings ───────────────────────────────────────────────────
  async getSettings(): Promise<ClinicSettings> {
    return api.get<ClinicSettings>('/settings').then((r) => extract<ClinicSettings>(r));
  },
  async updateSettings(settings: Partial<ClinicSettings>): Promise<ClinicSettings> {
    return api.put<ClinicSettings>('/settings', settings).then((r) => extract<ClinicSettings>(r));
  },

  // ── Dashboard ──────────────────────────────────────────────────
  async getDashboardStats(): Promise<DashboardStats> {
    return api.get<DashboardStats>('/dashboard/stats').then((r) => extract<DashboardStats>(r));
  },

  // ── App Options ────────────────────────────────────────────────
  async listOptions(type?: string): Promise<AppOption[]> {
    return api.get<AppOption[]>('/options', { params: { type } }).then((r) => extractArray<AppOption>(r, 'options'));
  },
  async createOption(input: CreateAppOptionInput): Promise<AppOption> {
    return api.post<AppOption>('/options', input).then((r) => extract<AppOption>(r));
  },
  async deleteOption(id: number | string): Promise<void> {
    return api.delete(`/options/${id}`).then(() => undefined);
  },

  // ── OPD Queue ──────────────────────────────────────────────────
  async getQueue(): Promise<QueueEntry[]> {
    return api.get('/queue').then((r) => extractArray<QueueEntry>(r, 'queue'));
  },
  async enqueue(input: EnqueueInput): Promise<unknown> {
    return api.post('/queue/enqueue', input).then((r) => extract<unknown>(r));
  },
  async callNextInQueue(): Promise<unknown> {
    return api.post('/queue/call-next', {}).then((r) => extract<unknown>(r));
  },
  async updateQueueStatus({ id, ...body }: UpdateQueueStatusInput): Promise<unknown> {
    return api.patch(`/queue/${encodeURIComponent(id)}/status`, body).then((r) => extract<unknown>(r));
  },
  async removeFromQueue(id: string): Promise<void> {
    return api.delete(`/queue/${encodeURIComponent(id)}`).then(() => undefined);
  },
  async reorderQueue(orderedIds: string[], chamberNo?: string): Promise<QueueEntry[]> {
    return api.post('/queue/reorder', { orderedIds, chamberNo }).then((r) => extractArray<QueueEntry>(r, 'queue'));
  },

  // ── Billing ─────────────────────────────────────────────────────
  async createBill(input: CreateBillInput): Promise<Bill> {
    return api.post<Bill>('/billing', input).then((r) => extract<Bill>(r));
  },
  async updateBill(id: string, input: Partial<CreateBillInput>): Promise<Bill> {
    return api.put<Bill>(`/billing/${encodeURIComponent(id)}`, input).then((r) => extract<Bill>(r));
  },
  async getBillForVisit(visitId: string): Promise<Bill | null> {
    return api.get<Bill | null>(`/billing/visit/${encodeURIComponent(visitId)}`).then((r) => extract<Bill | null>(r));
  },
  async getBillById(id: string): Promise<Bill> {
    return api.get<Bill>(`/billing/${encodeURIComponent(id)}`).then((r) => extract<Bill>(r));
  },
  async getPendingDues(): Promise<PendingDuesResponse> {
    return api.get<PendingDuesResponse>('/billing/pending-dues').then((r) => extract<PendingDuesResponse>(r));
  },
  async recordBillPayment(billId: string, input: RecordPaymentInput): Promise<Bill> {
    return api.post<Bill>(`/billing/${encodeURIComponent(billId)}/payments`, input).then((r) => extract<Bill>(r));
  },

  // ── IPD (Inpatient Department) ──────────────────────────────────
  async createIpdAdmission(input: CreateIpdAdmissionInput): Promise<IpdAdmission> {
    return api.post<IpdAdmission>('/ipd', input).then((r) => extract<IpdAdmission>(r));
  },
  async listIpdAdmissions(params?: { status?: string; patientId?: string; search?: string }): Promise<IpdAdmission[]> {
    return api.get<IpdAdmission[]>('/ipd', { params }).then((r) => extractArray<IpdAdmission>(r));
  },
  async getIpdAdmission(id: string): Promise<IpdAdmission> {
    return api.get<IpdAdmission>(`/ipd/${encodeURIComponent(id)}`).then((r) => extract<IpdAdmission>(r));
  },
  async addIpdDayLog(id: string, input: AddIpdDayLogInput): Promise<IpdAdmission> {
    return api.post<IpdAdmission>(`/ipd/${encodeURIComponent(id)}/day-logs`, input).then((r) => extract<IpdAdmission>(r));
  },
  async updateIpdDayLog(id: string, dayNumber: number, input: AddIpdDayLogInput): Promise<IpdAdmission> {
    return api.put<IpdAdmission>(`/ipd/${encodeURIComponent(id)}/day-logs/${encodeURIComponent(dayNumber)}`, input).then((r) => extract<IpdAdmission>(r));
  },
  async deleteIpdDayLog(id: string, dayNumber: number): Promise<IpdAdmission> {
    return api.delete<IpdAdmission>(`/ipd/${encodeURIComponent(id)}/day-logs/${encodeURIComponent(dayNumber)}`).then((r) => extract<IpdAdmission>(r));
  },
  async transferIpdBed(id: string, bedOrRoom: string): Promise<IpdAdmission> {
    return api.put<IpdAdmission>(`/ipd/${encodeURIComponent(id)}/transfer-bed`, { bedOrRoom }).then((r) => extract<IpdAdmission>(r));
  },
  async recordIpdPayment(id: string, amount: number): Promise<IpdAdmission> {
    return api.post<IpdAdmission>(`/ipd/${encodeURIComponent(id)}/payments`, { amount }).then((r) => extract<IpdAdmission>(r));
  },
  async dischargeIpd(id: string, input: DischargeIpdInput): Promise<IpdAdmission> {
    return api.put<IpdAdmission>(`/ipd/${encodeURIComponent(id)}/discharge`, input).then((r) => extract<IpdAdmission>(r));
  },
  async deleteIpdAdmission(id: string): Promise<void> {
    return api.delete(`/ipd/${encodeURIComponent(id)}`).then(() => undefined);
  },

  // ── Platform operator (AMAN) ───────────────────────────────────
  async getPlatformStats(): Promise<PlatformStats> {
    return api.get('/platform/stats').then((r) => extract<PlatformStats>(r));
  },
  async listPlatformOrganizations(params?: PlatformListParams): Promise<PlatformPage<PlatformOrganization>> {
    return api.get('/platform/organizations', { params }).then((r) => extractPage<PlatformOrganization>(r));
  },
  async getPlatformOrganization(orgId: string): Promise<PlatformOrganizationDetail> {
    return api.get(`/platform/organizations/${encodeURIComponent(orgId)}`).then((r) => extract<PlatformOrganizationDetail>(r));
  },
  async updatePlatformOrganizationSubscription(orgId: string, input: AdminUpdateSubscriptionInput): Promise<AdminUpdateSubscriptionResponse> {
    return api
      .patch<AdminUpdateSubscriptionResponse>(`/platform/organizations/${encodeURIComponent(orgId)}/subscription`, input)
      .then((r) => r.data);
  },
  async updatePlatformUserStatus(userId: string, isActive: boolean): Promise<void> {
    return api.patch(`/platform/users/${encodeURIComponent(userId)}/status`, { isActive }).then(() => undefined);
  },
  async listPlatformTransactions(params?: PlatformListParams): Promise<PlatformPage<PlatformTransaction>> {
    return api.get('/platform/transactions', { params }).then((r) => extractPage<PlatformTransaction>(r));
  },
  async impersonateUser(input: ImpersonateUserInput): Promise<ImpersonateResponse> {
    return api.post<ImpersonateResponse>('/platform/impersonate', input).then((r) => r.data);
  },
  async getPlatformOrganizationOnboarding(orgId: string): Promise<PlatformOnboardingResponse> {
    return api.get<PlatformOnboardingResponse>(`/platform/organizations/${encodeURIComponent(orgId)}/onboarding`).then((r) => r.data);
  },
  async verifyPlatformDoctor(userId: string, input: { isVerified: boolean; verificationNotes?: string }): Promise<any> {
    return api.patch(`/platform/users/${encodeURIComponent(userId)}/verify-doctor`, input).then((r) => r.data);
  },
  async listPlatformAuditLogs(params?: PlatformAuditQuery): Promise<PlatformAuditResponse> {
    return api.get<PlatformAuditResponse>('/platform/audit-logs', { params }).then((r) => r.data);
  },
  async getPlatformAuditMonths(): Promise<PlatformAuditMonth[]> {
    return api.get<{ success: boolean; data: PlatformAuditMonth[] }>('/platform/audit-logs/months').then((r) => r.data.data);
  },
  async exportMonthlyAudit(input: ExportMonthlyAuditInput): Promise<ExportMonthlyAuditResponse> {
    return api.post<ExportMonthlyAuditResponse>('/platform/audit-logs/export-monthly', input).then((r) => r.data);
  },
  async getPlatformLivePulse(): Promise<PlatformLivePulseData> {
    return api.get<{ success: boolean; data: PlatformLivePulseData }>('/platform/live-pulse').then((r) => r.data.data);
  },
  async getPlatformLiveActivity(): Promise<PlatformLiveActivityEvent[]> {
    return api.get<{ success: boolean; data: PlatformLiveActivityEvent[] }>('/platform/live-activity').then((r) => r.data.data);
  },
  async listPlatformIncidents(params?: IncidentQuery): Promise<IncidentListResponse> {
    return api.get<IncidentListResponse>('/platform/incidents', { params }).then((r) => r.data);
  },
  async resolvePlatformIncident(id: string, input?: ResolveIncidentInput): Promise<IncidentAlertItem> {
    return api.patch<{ success: boolean; data: IncidentAlertItem }>(`/platform/incidents/${encodeURIComponent(id)}/resolve`, input || {}).then((r) => r.data.data);
  },
  async createTestPlatformIncident(input?: CreateTestIncidentInput): Promise<IncidentAlertItem> {
    return api.post<{ success: boolean; data: IncidentAlertItem }>('/platform/incidents/test', input || {}).then((r) => r.data.data);
  },
  async getPlatformAnalytics(): Promise<SaaSAnalyticsData> {
    return api.get<{ success: boolean; data: SaaSAnalyticsData }>('/platform/analytics').then((r) => r.data.data);
  },
  async listPlatformAnnouncements(): Promise<SystemAnnouncement[]> {
    return api.get<{ success: boolean; data: SystemAnnouncement[] }>('/platform/announcements').then((r) => r.data.data);
  },
  async createPlatformAnnouncement(input: CreateAnnouncementInput): Promise<SystemAnnouncement> {
    return api.post<{ success: boolean; data: SystemAnnouncement }>('/platform/announcements', input).then((r) => r.data.data);
  },
  async updatePlatformAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<SystemAnnouncement> {
    return api.patch<{ success: boolean; data: SystemAnnouncement }>(`/platform/announcements/${encodeURIComponent(id)}`, input).then((r) => r.data.data);
  },
  async deletePlatformAnnouncement(id: string): Promise<void> {
    return api.delete(`/platform/announcements/${encodeURIComponent(id)}`).then(() => undefined);
  },
  async getActiveAnnouncements(): Promise<SystemAnnouncement[]> {
    return api.get<{ success: boolean; data: SystemAnnouncement[] }>('/announcements/active').then((r) => r.data.data);
  },
  async exportPlatformOrganizationData(orgId: string): Promise<{ filename: string; sha256Checksum: string; contentType: string; data: string }> {
    return api.get(`/platform/organizations/${encodeURIComponent(orgId)}/export`).then((r) => r.data);
  },
  async purgePlatformOrganizationTestData(orgId: string, confirmationCode: string): Promise<{ success: boolean; message: string; purged: { visits: number; patients: number; queues: number } }> {
    return api.post(`/platform/organizations/${encodeURIComponent(orgId)}/purge-test-data`, { confirmationCode }).then((r) => r.data);
  },
};


