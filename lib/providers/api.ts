// lib/providers/api.ts
// REST API Data Provider (for future backend integration)

import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
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
  SubscriptionResponse,
} from './types';

// The baseUrl can be configured via environment variables
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  timeout: 5000, // 5s timeout to prevent hanging browser network sockets
});

import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

// Request Interceptor: Attach the current token from useAuth store to every request
api.interceptors.request.use((config) => {
  // Use useAuth.getState() to pull the token outside of React lifecycle
  const token = useAuth.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Surface backend error messages in toast, but suppress auth token errors on logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errorMsg = getErrorMessage(error, '');
    const isAuthError =
      status === 401 ||
      (typeof errorMsg === 'string' && (errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('unauthorized')));

    // If user is logged out or token error occurred, suppress toast popup & clean auth state
    if (isAuthError || !useAuth.getState().isAuthenticated) {
      if (useAuth.getState().isAuthenticated) {
        useAuth.getState().logout();
      }
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

export const ApiDataProvider: DataProvider = {
  // ── Auth ───────────────────────────────────────────────────────
  async authLogin(input: AuthLoginInput): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/login', input).then((r) => extract<AuthResponse>(r));
  },
  async authSignup(input: AuthSignupInput): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/signup', input).then((r) => extract<AuthResponse>(r));
  },
  async updateUser(input: UpdateUserInput): Promise<AuthResponse> {
    return api.put<AuthResponse>('/auth/user', input).then((r) => extract<AuthResponse>(r));
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
  async verifyPayment(input: VerifyPaymentInput): Promise<SubscriptionResponse> {
    return api.post<SubscriptionResponse>('/subscription/verify-payment', input).then((r) => extract<SubscriptionResponse>(r));
  },
  async getOrganizationInfo(): Promise<OrganizationInfoResponse> {
    return api.get<OrganizationInfoResponse>('/organization/info').then((r) => extract<OrganizationInfoResponse>(r));
  },
  async onboardStaff(input: OnboardStaffInput): Promise<StaffUser> {
    return api.post<StaffUser>('/organization/staff', input).then((r) => extract<StaffUser>(r));
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
  async listPatients(params?: PatientListParams): Promise<Patient[]> {
    return api.get<Patient[]>('/patients', { params }).then((r) => extractArray<Patient>(r, 'patients'));
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
  async generatePatientId(): Promise<string> {
    return api.get<{ id: string }>('/patients/generate-id').then((r) => r.data.id);
  },

  // ── Visits ─────────────────────────────────────────────────────
  async listVisits(params?: VisitListParams): Promise<Visit[]> {
    return api.get<Visit[]>('/visits', { params }).then((r) => extractArray<Visit>(r, 'visits'));
  },
  async getVisit(visitId: number): Promise<Visit | undefined> {
    return api.get<Visit>(`/visits/${visitId}`).then((r) => extract<Visit>(r));
  },
  async getPatientVisits(patientId: string): Promise<Visit[]> {
    return api.get<Visit[]>(`/patients/${patientId}/visits`).then((r) => extractArray<Visit>(r, 'visits'));
  },
  async createVisit(input: CreateVisitInput): Promise<Visit> {
    return api.post<Visit>('/visits', input).then((r) => extract<Visit>(r));
  },
  async updateVisit(visitId: number, input: UpdateVisitInput): Promise<Visit> {
    return api.put<Visit>(`/visits/${visitId}`, input).then((r) => extract<Visit>(r));
  },
  async deleteVisit(visitId: number): Promise<void> {
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
  async markFollowUpAttended(visitId: number): Promise<Visit> {
    return api.post<Visit>(`/visits/${visitId}/mark-attended`).then((r) => extract<Visit>(r));
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
  async deleteOption(id: number): Promise<void> {
    return api.delete(`/options/${id}`).then(() => undefined);
  },
};
