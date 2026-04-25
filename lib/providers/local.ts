// lib/providers/local.ts
// IndexedDB Local Data Provider

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
  AuthResponse,
  ClinicSettings,
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

export const LocalDataProvider: DataProvider = {
  // ── Auth ───────────────────────────────────────────────────────
  async authLogin({ email }: AuthLoginInput): Promise<AuthResponse> {
    throw new Error('Offline login not supported. Switch to API mode.');
  },
  async authSignup(input: AuthSignupInput): Promise<AuthResponse> {
    throw new Error('Offline signup not supported. Switch to API mode.');
  },

  // ── Patients ───────────────────────────────────────────────────
  async listPatients(params?: PatientListParams): Promise<Patient[]> {
    let all: Patient[];
    if (params?.search) {
      all = await searchPatients(params.search);
    } else {
      all = await dbGetAll<Patient>('patients');
    }
    if (params?.category) {
      all = all.filter((p) => (p.category || 'OPD') === params.category);
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
    return all;
  },
  async createMedicine(input: CreateMedicineInput): Promise<Medicine> {
    const id = await dbAdd('medicines', input);
    return { ...input, id };
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

    const todayNew = todayVisits.filter((v) => patientFirstVisit.get(v.patientId)?.startsWith(today)).length;

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
};
