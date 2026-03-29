// lib/providers/types.ts
// This file defines the SINGLE DataProvider interface that both the
// local (IndexedDB) provider and the HTTP API provider must satisfy.
// All React Query hooks and Zustand actions call through this interface.

import type { Patient, Visit, Medicine, Template } from '@/lib/db';

// ─── Re-export core domain types ─────────────────────────────────
export type { Patient, Visit, Medicine, Template, PrescribedMedicine } from '@/lib/db';

// ─── Input shapes (what you POST / PUT) ──────────────────────────

export type CreatePatientInput = Omit<Patient, 'id' | 'patientId' | 'createdAt'>;

export type UpdatePatientInput = Partial<CreatePatientInput>;

export type CreateVisitInput = Omit<Visit, 'id' | 'createdAt'>;

export type UpdateVisitInput = Partial<Omit<Visit, 'id' | 'patientId' | 'createdAt'>>;

export type CreateMedicineInput = Omit<Medicine, 'id'>;

export type UpdateMedicineInput = Partial<CreateMedicineInput>;

export type CreateTemplateInput = Omit<Template, 'id' | 'createdAt'>;

export type ClinicSettings = {
  doctorName: string;
  degree: string;
  clinicName: string;
  address: string;
  phone: string;
  regNo: string;
  city: string;
};

export type AuthLoginInput = { email: string; password?: string };
export type AuthSignupInput = ClinicSettings & { email: string; password?: string };

export type AuthResponse = {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
};

// ─── Query / filter shapes ────────────────────────────────────────

export interface PatientListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface VisitListParams {
  patientId?: string;
  startDate?: string; // ISO date YYYY-MM-DD
  endDate?: string;   // ISO date YYYY-MM-DD
  page?: number;
  limit?: number;
}

export interface MedicineListParams {
  search?: string;
  category?: string;
}

// ─── Response wrappers ────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FollowUpItem {
  visit: Visit;
  patient: Patient | undefined;
}

export interface DashboardStats {
  todayTotal: number;
  todayNew: number;
  todayReturning: number;
  totalPatients: number;
  followUpsToday: number;
  upcomingFollowUps: number;
  recentVisits: Array<{ visit: Visit; patient: Patient | undefined }>;
  todayFollowUpList: FollowUpItem[];
}

// ─── THE DATA PROVIDER INTERFACE ─────────────────────────────────
// Both local.ts and api.ts implement this contract.
// Switching between them only requires changing the factory in index.ts.

export interface DataProvider {
  // ── Auth ───────────────────────────────────────────────────────
  authLogin(input: AuthLoginInput): Promise<AuthResponse>;
  authSignup(input: AuthSignupInput): Promise<AuthResponse>;

  // ── Patients ───────────────────────────────────────────────────
  listPatients(params?: PatientListParams): Promise<Patient[]>;
  getPatient(patientId: string): Promise<Patient | undefined>;
  createPatient(input: CreatePatientInput): Promise<Patient>;
  updatePatient(patientId: string, input: UpdatePatientInput): Promise<Patient>;
  deletePatient(patientId: string): Promise<void>;
  generatePatientId(): Promise<string>;

  // ── Visits ─────────────────────────────────────────────────────
  listVisits(params?: VisitListParams): Promise<Visit[]>;
  getVisit(visitId: number): Promise<Visit | undefined>;
  getPatientVisits(patientId: string): Promise<Visit[]>;
  createVisit(input: CreateVisitInput): Promise<Visit>;
  updateVisit(visitId: number, input: UpdateVisitInput): Promise<Visit>;
  deleteVisit(visitId: number): Promise<void>;
  getTodayVisits(): Promise<Visit[]>;
  getTodayFollowUps(): Promise<FollowUpItem[]>;
  getUpcomingFollowUps(days?: number): Promise<FollowUpItem[]>;
  markFollowUpAttended(visitId: number): Promise<Visit>;

  // ── Medicines ──────────────────────────────────────────────────
  listMedicines(params?: MedicineListParams): Promise<Medicine[]>;
  createMedicine(input: CreateMedicineInput): Promise<Medicine>;
  updateMedicine(id: number, input: UpdateMedicineInput): Promise<Medicine>;
  deleteMedicine(id: number): Promise<void>;
  seedMedicines(): Promise<void>;

  // ── Templates ──────────────────────────────────────────────────
  listTemplates(): Promise<Template[]>;
  createTemplate(input: CreateTemplateInput): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;

  // ── Settings ───────────────────────────────────────────────────
  getSettings(): Promise<ClinicSettings>;
  updateSettings(settings: Partial<ClinicSettings>): Promise<ClinicSettings>;

  // ── Dashboard ──────────────────────────────────────────────────
  getDashboardStats(): Promise<DashboardStats>;
}
