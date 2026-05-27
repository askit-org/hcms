// lib/providers/api.ts
// REST API Data Provider (for future backend integration)

import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import type {
  AuthLoginInput,
  AuthSignupInput,
  AuthResponse,
  ClinicSettings,
  CreateAppOptionInput,
  AppOption,
  CreateMedicineInput,
  CreatePatientInput,
  CreateTemplateInput,
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
} from './types';

// The baseUrl can be configured via environment variables
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3009/api',
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

// A small helper to process responses
const res = <T>(response: { data: T }) => response.data;

export const ApiDataProvider: DataProvider = {
  // ── Auth ───────────────────────────────────────────────────────
  async authLogin(input: AuthLoginInput): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/login', input).then(res);
  },
  async authSignup(input: AuthSignupInput): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/signup', input).then(res);
  },

  // ── Patients ───────────────────────────────────────────────────
  async listPatients(params?: PatientListParams): Promise<Patient[]> {
    return api.get<Patient[]>('/patients', { params }).then(res);
  },
  async getPatient(patientId: string): Promise<Patient | undefined> {
    return api.get<Patient>(`/patients/${patientId}`).then(res);
  },
  async createPatient(input: CreatePatientInput): Promise<Patient> {
    return api.post<Patient>('/patients', input).then(res);
  },
  async updatePatient(patientId: string, input: UpdatePatientInput): Promise<Patient> {
    return api.put<Patient>(`/patients/${patientId}`, input).then(res);
  },
  async deletePatient(patientId: string): Promise<void> {
    return api.delete(`/patients/${patientId}`).then(res);
  },
  async generatePatientId(): Promise<string> {
    return api.get<{ id: string }>('/patients/generate-id').then((r) => r.data.id);
  },

  // ── Visits ─────────────────────────────────────────────────────
  async listVisits(params?: VisitListParams): Promise<Visit[]> {
    return api.get<Visit[]>('/visits', { params }).then(res);
  },
  async getVisit(visitId: number): Promise<Visit | undefined> {
    return api.get<Visit>(`/visits/${visitId}`).then(res);
  },
  async getPatientVisits(patientId: string): Promise<Visit[]> {
    return api.get<Visit[]>(`/patients/${patientId}/visits`).then(res);
  },
  async createVisit(input: CreateVisitInput): Promise<Visit> {
    return api.post<Visit>('/visits', input).then(res);
  },
  async updateVisit(visitId: number, input: UpdateVisitInput): Promise<Visit> {
    return api.put<Visit>(`/visits/${visitId}`, input).then(res);
  },
  async deleteVisit(visitId: number): Promise<void> {
    return api.delete(`/visits/${visitId}`).then(res);
  },
  async getTodayVisits(): Promise<Visit[]> {
    return api.get<Visit[]>('/visits/today').then(res);
  },
  async getTodayFollowUps(): Promise<FollowUpItem[]> {
    return api.get<FollowUpItem[]>('/visits/followups/today').then(res);
  },
  async getUpcomingFollowUps(days = 7): Promise<FollowUpItem[]> {
    return api.get<FollowUpItem[]>('/visits/followups/upcoming', { params: { days } }).then(res);
  },
  async markFollowUpAttended(visitId: number): Promise<Visit> {
    return api.post<Visit>(`/visits/${visitId}/mark-attended`).then(res);
  },

  // ── Medicines ──────────────────────────────────────────────────
  async listMedicines(params?: MedicineListParams): Promise<Medicine[]> {
    return api.get<Medicine[]>('/medicines', { params }).then(res);
  },
  async createMedicine(input: CreateMedicineInput): Promise<Medicine> {
    return api.post<Medicine>('/medicines', input).then(res);
  },
  async updateMedicine(id: number, input: UpdateMedicineInput): Promise<Medicine> {
    return api.put<Medicine>(`/medicines/${id}`, input).then(res);
  },
  async deleteMedicine(id: number): Promise<void> {
    return api.delete(`/medicines/${id}`).then(res);
  },
  async seedMedicines(): Promise<void> {
    return api.post('/medicines/seed').then(res);
  },

  // ── Templates ──────────────────────────────────────────────────
  async listTemplates(): Promise<Template[]> {
    return api.get<Template[]>('/templates').then(res);
  },
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    return api.post<Template>('/templates', input).then(res);
  },
  async deleteTemplate(id: number): Promise<void> {
    return api.delete(`/templates/${id}`).then(res);
  },

  // ── Settings ───────────────────────────────────────────────────
  async getSettings(): Promise<ClinicSettings> {
    return api.get<ClinicSettings>('/settings').then(res);
  },
  async updateSettings(settings: Partial<ClinicSettings>): Promise<ClinicSettings> {
    return api.put<ClinicSettings>('/settings', settings).then(res);
  },

  // ── Dashboard ──────────────────────────────────────────────────
  async getDashboardStats(): Promise<DashboardStats> {
    return api.get<DashboardStats>('/dashboard/stats').then(res);
  },

  // ── App Options ────────────────────────────────────────────────
  async listOptions(type?: string): Promise<AppOption[]> {
    return api.get<AppOption[]>('/options', { params: { type } }).then(res);
  },
  async createOption(input: CreateAppOptionInput): Promise<AppOption> {
    return api.post<AppOption>('/options', input).then(res);
  },
  async deleteOption(id: number): Promise<void> {
    return api.delete(`/options/${id}`).then(res);
  },
};
