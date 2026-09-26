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
export type UpdateTemplateInput = Partial<CreateTemplateInput>;

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
export type UpdateUserInput = Partial<ClinicSettings> & {
  email?: string;
  password?: string;
  /** Required by the backend whenever `email` or `password` is being changed. */
  currentPassword?: string;
};

export type UserRole = 'SUPER_ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'ASSISTANT' | 'COMPOUNDER';

export type AppModel =
  | 'PATIENTS'
  | 'VISITS'
  | 'MEDICINES'
  | 'TEMPLATES'
  | 'OPTIONS'
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

// Premium is only activated via the Razorpay verify-payment flow; select-plan never activates it.
export type SelectPlanInput = {
  planType: 'trial' | 'premium';
};

export type VerifyPaymentInput = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  planType?: string;
};

// Price is decided server-side; the client must never send an amount.
export type RazorpayOrderRequest = {
  planType?: string;
};

export type RazorpayOrderResponse = {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  key: string;
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
  limit?: number; // backend default 50, max 500
  category?: string; // 'OPD' | 'IPD' | 'Suwarna Pashan' | etc.
  fromDate?: string; // ISO date YYYY-MM-DD
  toDate?: string;   // ISO date YYYY-MM-DD
}

export interface VisitListParams {
  patientId?: string;
  startDate?: string; // ISO date YYYY-MM-DD
  endDate?: string;   // ISO date YYYY-MM-DD
  page?: number;
  limit?: number; // default 100 / max 500; with both dates: default & max 5000
}

export interface MedicineListParams {
  search?: string;
  category?: string;
}

// ─── Response wrappers ────────────────────────────────────────────

/** Pagination metadata returned by paged list endpoints (`{ success, data, meta }`). */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ListPage<T> {
  data: T[];
  meta: PageMeta;
}

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

// ─── OPD Queue ────────────────────────────────────────────────────

export type QueueStatus = 'NOW_SERVING' | 'NEXT_IN_LINE' | 'WAITING' | 'IN_SESSION' | 'COMPLETED' | 'SKIPPED';

/** Queue item as returned by the backend (see app/(opd)/appointments for the full UI shape). */
export interface QueueEntry {
  id: string;
  tokenNo: number;
  patientId: string;
  patientName: string;
  mobile: string;
  queuedAt: string;
  status: QueueStatus;
  [key: string]: unknown;
}

export interface EnqueueInput {
  patientId: string;
  reason?: string;
  category?: string;
  priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  vitals?: { bp?: string; pulse?: string; temp?: string; spo2?: string };
  chamberNo?: string;
}

export interface UpdateQueueStatusInput {
  id: string;
  status: QueueStatus;
  inRoomSince?: string;
}

// ─── Platform operator (AMAN) ─────────────────────────────────────

/** Global platform role. Only the platform operator has one; clinic users have `null`. */
export type PlatformRole = 'AMAN';

/** Subscription as formatted by the backend for platform tooling (dates may be null). */
export interface PlatformSubscription {
  planType: 'trial' | 'premium' | 'none';
  subscriptionStatus: 'active' | 'trialing' | 'expired' | 'pending_payment';
  hasSelectedPlan: boolean;
  billingCycle?: 'monthly';
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  trialStartDate?: string;
  trialEndDate?: string;
  paidAmount?: number;
  paymentRef?: string;
  activatedAt?: string;
}

export interface PlatformStats {
  organizations: number;
  users: number;
  patients: number;
  visits: number;
  paidTransactions: number;
  revenue: number;
}

export interface PlatformListParams {
  search?: string;
  page?: number;
  limit?: number; // backend max 100
}

export type PlatformPageMeta = PageMeta;
export type PlatformPage<T> = ListPage<T>;

export interface PlatformOrganizationOwner {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean | null;
}

export interface PlatformOrganization {
  id: string;
  name: string;
  city?: string | null;
  phone?: string | null;
  createdAt: string;
  owner: PlatformOrganizationOwner;
  userCount: number;
  patientCount: number;
  subscription: PlatformSubscription | null;
}

export interface PlatformOrganizationUser {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  roleName: string | null;
  roleCode: string | null;
  isOwner: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PlatformTransaction {
  id: string;
  organizationId?: string | null;
  organizationName?: string | null;
  amount: number;
  currency: string;
  status: string;
  planType?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
}

export interface PlatformOrganizationDetail {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  ownerId: string;
  createdAt: string;
  patientCount: number;
  visitCount: number;
  subscription: PlatformSubscription | null;
  users: PlatformOrganizationUser[];
  transactions: PlatformTransaction[];
}

export type AdminSubscriptionAction = 'activate' | 'extend' | 'disable';

export interface AdminUpdateSubscriptionInput {
  action: AdminSubscriptionAction;
  planType?: 'trial' | 'premium'; // activate (and optionally extend)
  days?: number; // 1..3650
}

export interface AdminUpdateSubscriptionResponse {
  success: boolean;
  message?: string;
  data: PlatformSubscription;
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
  createRazorpayOrder(input: RazorpayOrderRequest): Promise<RazorpayOrderResponse>;
  verifyPayment(input: VerifyPaymentInput): Promise<SubscriptionResponse>;
  getOrganizationInfo(): Promise<OrganizationInfoResponse>;
  onboardStaff(input: OnboardStaffInput): Promise<StaffUser>;
  toggleStaffStatus(staffId: string, isActive: boolean): Promise<StaffUser>;
  deleteStaff(staffId: string): Promise<void>;
  listRoles(): Promise<AppRole[]>;
  createRole(input: CreateRoleInput): Promise<AppRole>;
  deleteRole(roleId: string): Promise<void>;

  // ── Patients ───────────────────────────────────────────────────
  listPatients(params?: PatientListParams): Promise<ListPage<Patient>>;
  getPatient(patientId: string): Promise<Patient | undefined>;
  createPatient(input: CreatePatientInput): Promise<Patient>;
  updatePatient(patientId: string, input: UpdatePatientInput): Promise<Patient>;
  /** Soft delete: the patient and their visits are hidden but can be restored. */
  deletePatient(patientId: string): Promise<void>;
  listDeletedPatients(params?: { page?: number; limit?: number }): Promise<ListPage<Patient>>;
  restorePatient(patientId: string): Promise<Patient>;
  generatePatientId(): Promise<string>;

  // ── Visits ─────────────────────────────────────────────────────
  listVisits(params?: VisitListParams): Promise<ListPage<Visit>>;
  getVisit(visitId: string | number): Promise<Visit | undefined>;
  getPatientVisits(patientId: string): Promise<Visit[]>;
  createVisit(input: CreateVisitInput): Promise<Visit>;
  updateVisit(visitId: string | number, input: UpdateVisitInput): Promise<Visit>;
  deleteVisit(visitId: string | number): Promise<void>;
  getTodayVisits(): Promise<Visit[]>;
  getTodayFollowUps(): Promise<FollowUpItem[]>;
  getUpcomingFollowUps(days?: number): Promise<FollowUpItem[]>;
  markFollowUpAttended(visitId: string | number): Promise<Visit>;

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
  updateTemplate(id: number, input: UpdateTemplateInput): Promise<Template>;
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

  // ── OPD Queue ──────────────────────────────────────────────────
  getQueue(): Promise<QueueEntry[]>;
  enqueue(input: EnqueueInput): Promise<unknown>;
  callNextInQueue(): Promise<unknown>;
  updateQueueStatus(input: UpdateQueueStatusInput): Promise<unknown>;
  removeFromQueue(id: string): Promise<void>;
  /** Saves the order of today's WAITING items; returns the queue in the new order. */
  reorderQueue(orderedIds: string[], chamberNo?: string): Promise<QueueEntry[]>;

  // ── Platform operator (AMAN only; backend returns 403 otherwise) ──
  getPlatformStats(): Promise<PlatformStats>;
  listPlatformOrganizations(params?: PlatformListParams): Promise<PlatformPage<PlatformOrganization>>;
  getPlatformOrganization(orgId: string): Promise<PlatformOrganizationDetail>;
  updatePlatformOrganizationSubscription(orgId: string, input: AdminUpdateSubscriptionInput): Promise<AdminUpdateSubscriptionResponse>;
  updatePlatformUserStatus(userId: string, isActive: boolean): Promise<void>;
  listPlatformTransactions(params?: PlatformListParams): Promise<PlatformPage<PlatformTransaction>>;
}
