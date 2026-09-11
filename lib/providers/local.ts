// lib/providers/local.ts
// IndexedDB Local Data Provider

import { useAuth } from '../hooks/useAuth';
import {
  dbAdd,
  dbDelete,
  dbGet,
  dbGetAll,
  dbGetByIndex,
  dbPut,
  generatePatientId,
  getPatientVisits,
  getSetting,
  getTodayFollowUps,
  getTodayVisits,
  getUpcomingFollowUps,
  searchPatients,
  seedMedicines,
  setSetting,
} from '@/lib/db';
import type {
  AuthLoginInput,
  AuthSignupInput,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  ResetPasswordInput,
  ResetPasswordResponse,
  AuthResponse,
  ClinicSettings,
  AppOption,
  CreateAppOptionInput,
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

export const LocalDataProvider: DataProvider = {
  // ── Auth ───────────────────────────────────────────────────────
  async authLogin({ email }: AuthLoginInput): Promise<AuthResponse> {
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const user = {
      id: `local_usr_${Date.now()}`,
      doctorName: email?.split('@')[0] || 'Doctor',
      email: email || 'doctor@clinic.com',
      degree: 'MBBS',
      clinicName: 'My Clinic',
      address: '',
      phone: '',
      regNo: '',
      city: '',
      createdAt: now.toISOString(),
      subscription: {
        planType: 'trial' as const,
        subscriptionStatus: 'trialing' as const,
        trialStartDate: now.toISOString(),
        trialEndDate,
        hasSelectedPlan: true,
        activatedAt: now.toISOString(),
      },
    };
    const token = `local_token_${Date.now()}`;
    return { success: true, user, token };
  },
  async authSignup(input: AuthSignupInput): Promise<AuthResponse> {
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const user = {
      id: `local_usr_${Date.now()}`,
      doctorName: input.doctorName || 'Doctor',
      email: input.email || 'doctor@clinic.com',
      degree: input.degree || 'MBBS',
      clinicName: input.clinicName || 'My Clinic',
      address: input.address || '',
      phone: input.phone || '',
      regNo: input.regNo || '',
      city: input.city || '',
      createdAt: now.toISOString(),
      subscription: {
        planType: 'trial' as const,
        subscriptionStatus: 'trialing' as const,
        trialStartDate: now.toISOString(),
        trialEndDate,
        hasSelectedPlan: true,
        activatedAt: now.toISOString(),
      },
    };
    const token = `local_token_${Date.now()}`;
    return { success: true, user, token };
  },
  async updateUser(input: Partial<ClinicSettings> & { email?: string; password?: string }): Promise<AuthResponse> {
    const current = useAuth.getState().user;
    if (!current) throw new Error('Not authenticated');
    const updatedUser = { ...current, ...input };
    useAuth.setState({ user: updatedUser });
    return { success: true, user: updatedUser };
  },
  async forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
    return {
      success: true,
      message: `Password reset instructions sent to ${input.email}`,
    };
  },
  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResponse> {
    return {
      success: true,
      message: 'Password reset successfully',
    };
  },

  // ── Subscription ───────────────────────────────────────────────
  async getSubscriptionStatus(): Promise<UserSubscription> {
    const user = useAuth.getState().user;
    if (user?.subscription) {
      const sub = { ...user.subscription };
      const now = Date.now();
      // Auto-expire trial if trialEndDate has passed
      if (sub.planType === 'trial' && sub.trialEndDate) {
        if (new Date(sub.trialEndDate).getTime() < now) {
          sub.subscriptionStatus = 'expired';
        }
      }
      // Auto-expire premium if subscriptionEndDate has passed
      if (sub.planType === 'premium' && sub.subscriptionEndDate) {
        if (new Date(sub.subscriptionEndDate).getTime() < now) {
          sub.subscriptionStatus = 'expired';
        }
      }
      return sub;
    }
    return {
      planType: 'none',
      subscriptionStatus: 'expired',
      hasSelectedPlan: false,
    };
  },
  async selectPlan({ planType, paymentRef }: SelectPlanInput): Promise<SubscriptionResponse> {
    const user = useAuth.getState().user;
    const now = new Date();
    let subscription: UserSubscription;

    if (planType === 'trial') {
      const trialEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      subscription = {
        planType: 'trial',
        subscriptionStatus: 'trialing',
        trialStartDate: now.toISOString(),
        trialEndDate,
        hasSelectedPlan: true,
        activatedAt: now.toISOString(),
      };
    } else {
      const monthlyEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      subscription = {
        planType: 'premium',
        subscriptionStatus: paymentRef ? 'active' : 'pending_payment',
        hasSelectedPlan: true,
        paidAmount: 299,
        paymentRef,
        billingCycle: 'monthly',
        subscriptionStartDate: now.toISOString(),
        subscriptionEndDate: monthlyEndDate,
        activatedAt: now.toISOString(),
      };
    }

    if (user) {
      const updatedUser = { ...user, subscription };
      useAuth.setState({ user: updatedUser });
      return { success: true, subscription, user: updatedUser };
    }
    return { success: true, subscription };
  },
  async verifyPayment({ paymentRef, amount = 299 }: VerifyPaymentInput): Promise<SubscriptionResponse> {
    const user = useAuth.getState().user;
    const now = new Date();
    const monthlyEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const subscription: UserSubscription = {
      planType: 'premium',
      subscriptionStatus: 'active',
      hasSelectedPlan: true,
      paidAmount: amount,
      paymentRef,
      billingCycle: 'monthly',
      subscriptionStartDate: now.toISOString(),
      subscriptionEndDate: monthlyEndDate,
      activatedAt: now.toISOString(),
    };

    if (user) {
      const updatedUser = { ...user, subscription };
      useAuth.setState({ user: updatedUser });
      return { success: true, subscription, user: updatedUser };
    }
    return { success: true, subscription };
  },

  async getOrganizationInfo(): Promise<OrganizationInfoResponse> {
    const user = useAuth.getState().user;
    const settings = await this.getSettings();
    const staff = (await dbGetAll<StaffUser>('staff')) || [];

    return {
      organization: {
        id: 'org_local_default',
        name: settings?.clinicName || user?.clinicName || 'My Clinic & Hospital',
        city: settings?.city || user?.city || '',
        subscriptionStatus: user?.subscription?.subscriptionStatus || 'active',
        planType: user?.subscription?.planType || 'trial',
      },
      rootAdmin: {
        id: user?.id || 'usr_root_doc',
        name: user?.doctorName || 'Dr. Admin',
        email: user?.email || 'doctor@clinic.com',
        degree: user?.degree || settings?.degree || 'MBBS',
        regNo: user?.regNo || settings?.regNo || 'REG-101',
        role: 'SUPER_ADMIN',
        createdAt: user?.createdAt || new Date().toISOString(),
      },
      staff,
      roles: await this.listRoles(),
    };
  },

  async onboardStaff(input: OnboardStaffInput): Promise<StaffUser> {
    const staff = (await dbGetAll<StaffUser>('staff')) || [];
    if (staff.some((s) => s.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error(`Staff member with email "${input.email}" is already onboarded.`);
    }

    const newStaff: StaffUser = {
      id: `usr_staff_${Date.now()}`,
      name: input.name,
      email: input.email,
      phone: input.phone,
      roleId: input.roleId,
      role: input.role || 'RECEPTIONIST',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await dbPut('staff', newStaff);
    return newStaff;
  },

  async deleteStaff(staffId: string): Promise<void> {
    await dbDelete('staff', staffId);
  },

  async listRoles(): Promise<AppRole[]> {
    const customRoles = (await dbGetAll<AppRole>('roles')) || [];
    const systemRoles: AppRole[] = [
      {
        id: 'role_super_admin',
        name: 'Super Admin / Doctor',
        code: 'SUPER_ADMIN',
        description: 'Full uninhibited access to all clinical, financial, and organizational modules.',
        isSystemRole: true,
        permissions: [
          { model: 'PATIENTS', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'VISITS', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'MEDICINES', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'TEMPLATES', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'FOLLOWUPS', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'REPORTS', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'SETTINGS', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'STAFF', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
        ],
      },
      {
        id: 'role_receptionist',
        name: 'Receptionist',
        code: 'RECEPTIONIST',
        description: 'Handles front-desk patient registration, OPD check-ins, and follow-up tracking.',
        isSystemRole: true,
        permissions: [
          { model: 'PATIENTS', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          { model: 'VISITS', canRead: true, canCreate: true, canUpdate: false, canDelete: false },
          { model: 'FOLLOWUPS', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          { model: 'MEDICINES', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'TEMPLATES', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'REPORTS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'SETTINGS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'STAFF', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
        ],
      },
      {
        id: 'role_assistant',
        name: 'Clinical Assistant',
        code: 'ASSISTANT',
        description: 'Assists doctor with Vitals, Complaints, and initial patient history.',
        isSystemRole: true,
        permissions: [
          { model: 'PATIENTS', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          { model: 'VISITS', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          { model: 'FOLLOWUPS', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          { model: 'MEDICINES', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'TEMPLATES', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'REPORTS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'SETTINGS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'STAFF', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
        ],
      },
      {
        id: 'role_compounder',
        name: 'Compounder / Pharmacist',
        code: 'COMPOUNDER',
        description: 'Manages drug inventory and dispenses prescriptions.',
        isSystemRole: true,
        permissions: [
          { model: 'PATIENTS', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'VISITS', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'FOLLOWUPS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'MEDICINES', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
          { model: 'TEMPLATES', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'REPORTS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'SETTINGS', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
          { model: 'STAFF', canRead: false, canCreate: false, canUpdate: false, canDelete: false },
        ],
      },
    ];

    return [...systemRoles, ...customRoles];
  },

  async createRole(input: CreateRoleInput): Promise<AppRole> {
    const roles = await this.listRoles();
    if (roles.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error(`A role named "${input.name}" already exists.`);
    }

    const newRole: AppRole = {
      id: `role_${Date.now()}`,
      name: input.name.trim(),
      code: input.name.trim().toUpperCase().replace(/\s+/g, '_'),
      description: input.description,
      isSystemRole: false,
      permissions: input.permissions,
    };

    await dbPut('roles', newRole);
    return newRole;
  },

  async deleteRole(roleId: string): Promise<void> {
    const roles = await this.listRoles();
    const target = roles.find((r) => r.id === roleId);
    if (target?.isSystemRole) {
      throw new Error('System default roles cannot be deleted.');
    }
    await dbDelete('roles', roleId);
  },

  // ── Patients ───────────────────────────────────────────────────
  async listPatients(params?: PatientListParams): Promise<Patient[]> {
    let all: Patient[];
    if (params?.search) {
      all = await searchPatients(params.search);
    } else {
      all = await dbGetAll<Patient>('patients');
    }
    if (params?.category && params.category !== 'All') {
      const allVisits = await dbGetAll<Visit>('visits');
      const latestVisits = new Map<string, Visit>();
      for (const v of allVisits) {
         const existing = latestVisits.get(v.patientId);
         if (!existing || new Date(v.date) > new Date(existing.date)) {
             latestVisits.set(v.patientId, v);
         }
      }
      all = all.filter(p => {
         const latestVisit = latestVisits.get(p.patientId);
         return latestVisit?.category === params.category;
      });
    }
    if (params?.fromDate) {
      all = all.filter((p) => p.createdAt.split('T')[0] >= params.fromDate!);
    }
    if (params?.toDate) {
      all = all.filter((p) => p.createdAt.split('T')[0] <= params.toDate!);
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getPatient(patientId: string): Promise<Patient | undefined> {
    const pats = await dbGetByIndex<Patient>('patients', 'patientId', patientId);
    return pats[0];
  },
  async createPatient(input: CreatePatientInput): Promise<Patient> {
    const allPats = await dbGetAll<Patient>('patients');
    if (allPats.some(p => p.mobile === input.mobile)) {
      throw new Error(`Mobile number ${input.mobile} is already registered.`);
    }
    if (input.dob && new Date(input.dob) > new Date()) {
      throw new Error('Date of birth cannot be a future date.');
    }

    const patientId = await generatePatientId();
    const newPatient: Patient = {
      ...input,
      patientId,
      createdAt: new Date().toISOString(),
    };
    const id = await dbAdd('patients', newPatient);
    return { ...newPatient, id };
  },
  async updatePatient(patientId: string, input: UpdatePatientInput): Promise<Patient> {
    const existing = await this.getPatient(patientId);
    if (!existing) throw new Error(`Patient ${patientId} not found`);

    if (input.mobile && input.mobile !== existing.mobile) {
      const allPats = await dbGetAll<Patient>('patients');
      if (allPats.some(p => p.mobile === input.mobile)) {
        throw new Error(`Mobile number ${input.mobile} is already registered.`);
      }
    }
    if (input.dob && new Date(input.dob) > new Date()) {
      throw new Error('Date of birth cannot be a future date.');
    }

    const updated = { ...existing, ...input };
    if (updated.id) {
      await dbPut('patients', updated);
    }
    return updated;
  },
  async deletePatient(patientId: string): Promise<void> {
    const existing = await this.getPatient(patientId);
    if (existing?.id) {
      await dbDelete('patients', existing.id);
      // Also cleanup visits
      const visits = await getPatientVisits(patientId);
      for (const v of visits) {
        if (v.id) await dbDelete('visits', v.id);
      }
    }
  },
  async generatePatientId(): Promise<string> {
    return generatePatientId();
  },

  // ── Visits ─────────────────────────────────────────────────────
  async listVisits(params?: VisitListParams): Promise<Visit[]> {
    let all = await dbGetAll<Visit>('visits');
    if (params?.patientId) {
      all = await getPatientVisits(params.patientId);
    }
    if (params?.startDate && params?.endDate) {
      all = all.filter((v) => {
        const d = v.date.split('T')[0];
        return d >= params.startDate! && d <= params.endDate!;
      });
    }
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },
  async getVisit(visitId: number): Promise<Visit | undefined> {
    return dbGet<Visit>('visits', visitId);
  },
  async getPatientVisits(patientId: string): Promise<Visit[]> {
    return getPatientVisits(patientId);
  },
  async createVisit(input: CreateVisitInput): Promise<Visit> {
    const newVisit: Visit = {
      ...input,
      createdAt: new Date().toISOString(),
    };
    const id = await dbAdd('visits', newVisit);
    return { ...newVisit, id };
  },
  async updateVisit(visitId: number, input: UpdateVisitInput): Promise<Visit> {
    const existing = await this.getVisit(visitId);
    if (!existing) throw new Error(`Visit ${visitId} not found`);
    const updated = { ...existing, ...input };
    await dbPut('visits', updated);
    return updated;
  },
  async deleteVisit(visitId: number): Promise<void> {
    await dbDelete('visits', visitId);
  },
  async getTodayVisits(): Promise<Visit[]> {
    return getTodayVisits();
  },
  async getTodayFollowUps(): Promise<FollowUpItem[]> {
    return getTodayFollowUps();
  },
  async getUpcomingFollowUps(days = 7): Promise<FollowUpItem[]> {
    return getUpcomingFollowUps(days);
  },
  async markFollowUpAttended(visitId: number): Promise<Visit> {
    const v = await this.getVisit(visitId);
    if (!v) throw new Error(`Visit ${visitId} not found`);
    return this.updateVisit(visitId, { followUpAttended: true });
  },

  // ── Medicines ──────────────────────────────────────────────────
  async listMedicines(params?: MedicineListParams): Promise<Medicine[]> {
    let all = await dbGetAll<Medicine>('medicines');
    if (params?.category && params.category !== 'All') {
      all = all.filter((m) => m.category === params.category);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      all = all.filter((m) => m.name.toLowerCase().includes(q));
    }
    // Return ordered by latest created (using id)
    return all.sort((a, b) => (b.id || 0) - (a.id || 0));
  },
  async createMedicine(input: CreateMedicineInput): Promise<Medicine> {
    const id = await dbAdd('medicines', input);
    return { ...input, id };
  },
  async bulkCreateMedicines(inputs: CreateMedicineInput[]): Promise<Medicine[]> {
    const results: Medicine[] = [];
    for (const input of inputs) {
      const id = await dbAdd('medicines', input);
      results.push({ ...input, id });
    }
    return results;
  },
  async updateMedicine(id: number, input: UpdateMedicineInput): Promise<Medicine> {
    const existing = await dbGet<Medicine>('medicines', id);
    if (!existing) throw new Error(`Medicine ${id} not found`);
    const updated = { ...existing, ...input };
    await dbPut('medicines', updated);
    return updated;
  },
  async deleteMedicine(id: number): Promise<void> {
    await dbDelete('medicines', id);
  },
  async seedMedicines(): Promise<void> {
    await seedMedicines();
  },

  // ── Templates ──────────────────────────────────────────────────
  async listTemplates(): Promise<Template[]> {
    return dbGetAll<Template>('templates');
  },
  async createTemplate(input: CreateTemplateInput): Promise<Template> {
    const newTpl: Template = {
      ...input,
      createdAt: new Date().toISOString(),
    };
    const id = await dbAdd('templates', newTpl);
    return { ...newTpl, id };
  },
  async deleteTemplate(id: number): Promise<void> {
    await dbDelete('templates', id);
  },

  // ── Settings ───────────────────────────────────────────────────
  async getSettings(): Promise<ClinicSettings> {
    const [doctorName, degree, clinicName, address, phone, regNo, city] = await Promise.all([
      getSetting('doctorName', ''),
      getSetting('degree', ''),
      getSetting('clinicName', 'My Clinic'),
      getSetting('address', ''),
      getSetting('phone', ''),
      getSetting('regNo', ''),
      getSetting('city', ''),
    ]);
    return { doctorName, degree, clinicName, address, phone, regNo, city };
  },
  async updateSettings(settings: Partial<ClinicSettings>): Promise<ClinicSettings> {
    await Promise.all(
      Object.entries(settings).map(([k, v]) => {
        if (v !== undefined) {
          return setSetting(k, v);
        }
      })
    );
    return this.getSettings();
  },

  // ── Dashboard ──────────────────────────────────────────────────
  async getDashboardStats(): Promise<DashboardStats> {
    const [allPatients, todayVisits, todayFU, upcomingFU] = await Promise.all([
      dbGetAll<Patient>('patients'),
      getTodayVisits(),
      getTodayFollowUps(),
      getUpcomingFollowUps(7),
    ]);
    const patMap = new Map((allPatients as Patient[]).map((p) => [p.patientId, p]));

    const today = new Date().toISOString().split('T')[0];
    const allVisits = await dbGetAll<Visit>('visits');
    const patientFirstVisit = new Map<string, string>();
    allVisits
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((v) => {
        if (!patientFirstVisit.has(v.patientId)) patientFirstVisit.set(v.patientId, v.date);
      });

    // A patient is considered "New Today" if:
    // 1) Their patient profile was registered today (createdAt starts with today), OR
    // 2) Their first OPD visit was recorded today
    const todayNewPatients = (allPatients as Patient[]).filter((p) => {
      const isRegisteredToday = p.createdAt ? p.createdAt.startsWith(today) : false;
      const isFirstVisitToday = patientFirstVisit.get(p.patientId)?.startsWith(today);
      return isRegisteredToday || isFirstVisitToday;
    }).length;

    const todayNew = todayNewPatients;

    const recent = allVisits
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map((v) => ({ visit: v, patient: patMap.get(v.patientId) }));

    return {
      totalPatients: allPatients.length,
      todayTotal: todayVisits.length,
      todayNew,
      todayReturning: todayVisits.length - todayNew,
      followUpsToday: todayFU.length,
      upcomingFollowUps: upcomingFU.length,
      recentVisits: recent,
      todayFollowUpList: todayFU,
    };
  },

  // ── App Options ────────────────────────────────────────────────
  async listOptions(type?: string): Promise<AppOption[]> {
    let all = await dbGetAll<AppOption>('options');
    if (type) all = all.filter(o => o.optionType === type);
    return all;
  },
  async createOption(input: CreateAppOptionInput): Promise<AppOption> {
    const newOp: AppOption = {
      ...input,
      createdAt: new Date().toISOString(),
    } as AppOption;
    const id = await dbAdd('options', newOp);
    return { ...newOp, id };
  },
  async deleteOption(id: number): Promise<void> {
    await dbDelete('options', id);
  },
};
