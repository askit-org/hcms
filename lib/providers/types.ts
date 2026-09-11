// lib/providers/types.ts
// This file defines the SINGLE DataProvider interface that both the
// local (IndexedDB) provider and the HTTP API provider must satisfy.
// All React Query hooks and Zustand actions call through this interface.

import type { Patient, Visit, Medicine, Template } from '@/lib/db';

// ─── Re-export core domain types ─────────────────────────────────
export type { Patient, Visit, Medicine, Template, PrescribedMedicine } from '@/lib/db';

export interface AppOption {
  id: number;
  optionType: string;
  value: string;
  createdAt: string;
}

// ─── Input shapes (what you POST / PUT) ──────────────────────────

export type CreatePatientInput = Omit<Patient, 'id' | 'patientId' | 'createdAt'>;

export type UpdatePatientInput = Partial<CreatePatientInput>;

export type CreateVisitInput = Omit<Visit, 'id' | 'createdAt'>;

export type UpdateVisitInput = Partial<Omit<Visit, 'id' | 'patientId' | 'createdAt'>>;

export type CreateMedicineInput = Omit<Medicine, 'id'>;

export type UpdateMedicineInput = Partial<CreateMedicineInput>;

export type CreateTemplateInput = Omit<Template, 'id' | 'createdAt'>;

export type CreateAppOptionInput = Omit<AppOption, 'id' | 'createdAt'>;

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
export type UpdateUserInput = Partial<ClinicSettings> & { email?: string; password?: string };

export type UserRole = 'SUPER_ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'ASSISTANT' | 'COMPOUNDER';

export type AppModel =
  | 'PATIENTS'
  | 'VISITS'
  | 'MEDICINES'
  | 'TEMPLATES'
  | 'FOLLOWUPS'
  | 'REPORTS'
  | 'SETTINGS'
  | 'STAFF';

export interface ModelPermission {
  model: AppModel;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface AppRole {
  id: string;
  name: string;
  code: string;
  description?: string;
  isSystemRole?: boolean;
  permissions: ModelPermission[];
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: ModelPermission[];
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId?: string;
  roleName?: string;
  roleCode?: string;
  role: UserRole | string;
  isActive: boolean;
  createdAt: string;
}

export interface OnboardStaffInput {
  name: string;
  email: string;
  phone: string;
  roleId?: string;
  role?: UserRole | string;
  password?: string;
}

export interface OrganizationInfoResponse {
  organization: {
    id: string;
    name: string;
    city?: string;
    subscriptionStatus?: string;
    planType?: string;
  };
  rootAdmin: {
    id: string;
    name: string;
    email: string;
    degree?: string;
    regNo?: string;
    role: string;
    createdAt?: string;
  };
  staff: StaffUser[];
  roles?: AppRole[];
}

export type ForgotPasswordInput = { email: string };
export type ForgotPasswordResponse = { success: boolean; message?: string; error?: string };

export type ResetPasswordInput = { token: string; newPassword?: string; password?: string };
export type ResetPasswordResponse = { success: boolean; message?: string; error?: string };

export type AuthResponse = {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
};

export interface UserSubscription {
  planType: 'trial' | 'premium' | 'none';
  subscriptionStatus: 'active' | 'trialing' | 'expired' | 'pending_payment';
  trialStartDate?: string;
  trialEndDate?: string;
  hasSelectedPlan: boolean;
  paidAmount?: number;
  paymentRef?: string;
  activatedAt?: string;
  billingCycle?: 'monthly';
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}

export type SelectPlanInput = {
  planType: 'trial' | 'premium';
  paymentRef?: string;
};

export type VerifyPaymentInput = {
  paymentRef: string;
  amount?: number;
  planType?: 'premium';
};

export interface SubscriptionResponse {
  success: boolean;
  subscription: UserSubscription;
  user?: any;
  error?: string;
}

// ─── Query / filter shapes ────────────────────────────────────────

export interface PatientListParams {
  search?: string;
  page?: number;
  limit?: number;
  category?: string; // 'OPD' | 'IPD' | 'Suwarna Pashan' | etc.
  fromDate?: string; // ISO date YYYY-MM-DD
  toDate?: string;   // ISO date YYYY-MM-DD
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
  // ── Auth, Organization & Staff ─────────────────────────────────
  authLogin(input: AuthLoginInput): Promise<AuthResponse>;
  authSignup(input: AuthSignupInput): Promise<AuthResponse>;
  updateUser(input: UpdateUserInput): Promise<AuthResponse>;
  forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResponse>;
  resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResponse>;
  getSubscriptionStatus(): Promise<UserSubscription>;
  selectPlan(input: SelectPlanInput): Promise<SubscriptionResponse>;
  verifyPayment(input: VerifyPaymentInput): Promise<SubscriptionResponse>;
  getOrganizationInfo(): Promise<OrganizationInfoResponse>;
  onboardStaff(input: OnboardStaffInput): Promise<StaffUser>;
  deleteStaff(staffId: string): Promise<void>;
  listRoles(): Promise<AppRole[]>;
  createRole(input: CreateRoleInput): Promise<AppRole>;
  deleteRole(roleId: string): Promise<void>;

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
  bulkCreateMedicines(inputs: CreateMedicineInput[]): Promise<Medicine[]>;
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

  // ── App Options ────────────────────────────────────────────────
  listOptions(type?: string): Promise<AppOption[]>;
  createOption(input: CreateAppOptionInput): Promise<AppOption>;
  deleteOption(id: number): Promise<void>;
}
