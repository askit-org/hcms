// lib/db.ts — HCMS IndexedDB layer (client-only)

export interface Patient {
  id?: number;
  patientId: string;
  name: string;
  age?: number;
  dob?: string;
  gender: string;
  mobile: string;
  address?: string;
  occupation?: string;
  category?: string; // e.g. OPD, IPD, Suwarna Pashan, Emergency, etc.
  createdAt: string;
}

export interface PrescribedMedicine {
  medicineId?: number;
  name: string;
  dose: string;
  duration: string;
  instructions?: string;
}

export interface Visit {
  id?: number;
  patientId: string;
  date: string;
  chiefComplaints: string;
  diagnosis: string;
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
  treatment?: string;
  prescriptionNotes?: string;
  medicines?: PrescribedMedicine[];
  followUpDate?: string;
  followUpAttended?: boolean;
  createdAt: string;
}

export interface Medicine {
  id?: number;
  name: string;
  category: string;
  defaultDose: string;
  defaultDuration: string;
  unit?: string;
  strength?: string;
}

export interface Template {
  id?: number;
  name: string;
  diagnosis: string;
  medicines: PrescribedMedicine[];
  notes?: string;
  createdAt: string;
}

export interface Settings {
  key: string;
  value: string;
}

const DB_NAME = 'hcms_db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('patients')) {
        const ps = db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('patientId', 'patientId', { unique: true });
        ps.createIndex('mobile', 'mobile');
        ps.createIndex('name', 'name');
        ps.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('visits')) {
        const vs = db.createObjectStore('visits', { keyPath: 'id', autoIncrement: true });
        vs.createIndex('patientId', 'patientId');
        vs.createIndex('date', 'date');
        vs.createIndex('followUpDate', 'followUpDate');
      }
      if (!db.objectStoreNames.contains('medicines')) {
        const ms = db.createObjectStore('medicines', { keyPath: 'id', autoIncrement: true });
        ms.createIndex('name', 'name');
        ms.createIndex('category', 'category');
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

function p<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

let _db: IDBDatabase | null = null;
async function getDB() {
  if (!_db) _db = await openDB();
  return _db;
}

// ─── Generic CRUD ────────────────────────────────────────────────
export async function dbAdd<T>(store: string, data: T): Promise<number> {
  const db = await getDB();
  return p(db.transaction(store, 'readwrite').objectStore(store).add(data)) as Promise<number>;
}
export async function dbPut<T>(store: string, data: T): Promise<number> {
  const db = await getDB();
  return p(db.transaction(store, 'readwrite').objectStore(store).put(data)) as Promise<number>;
}
export async function dbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDB();
  return p(db.transaction(store).objectStore(store).get(key));
}
export async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await getDB();
  return p(db.transaction(store).objectStore(store).getAll());
}
export async function dbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await getDB();
  return p(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}
export async function dbGetByIndex<T>(store: string, index: string, value: IDBValidKey): Promise<T[]> {
  const db = await getDB();
  return p(db.transaction(store).objectStore(store).index(index).getAll(value));
}

// ─── Patients ────────────────────────────────────────────────────
export async function generatePatientId(): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const all = await dbGetAll<Patient>('patients');
  const todayPats = all.filter(p => p.patientId?.includes(dateStr));
  const seq = String(todayPats.length + 1).padStart(4, '0');
  return `OPD-${dateStr}-${seq}`;
}

export async function searchPatients(query: string): Promise<Patient[]> {
  const all = await dbGetAll<Patient>('patients');
  if (!query.trim()) return all.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  const q = query.toLowerCase().trim();
  return all.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.mobile.includes(q) ||
    p.patientId.toLowerCase().includes(q)
  );
}

// ─── Visits ──────────────────────────────────────────────────────
export async function getTodayVisits(): Promise<Visit[]> {
  const today = new Date().toISOString().split('T')[0];
  const all = await dbGetAll<Visit>('visits');
  return all.filter(v => v.date?.startsWith(today));
}

export async function getTodayFollowUps(): Promise<{ visit: Visit; patient: Patient | undefined }[]> {
  const today = new Date().toISOString().split('T')[0];
  const allVisits = await dbGetAll<Visit>('visits');
  const allPatients = await dbGetAll<Patient>('patients');
  const patMap = new Map(allPatients.map(p => [p.patientId, p]));
  return allVisits
    .filter(v => v.followUpDate === today && !v.followUpAttended)
    .map(v => ({ visit: v, patient: patMap.get(v.patientId) }));
}

export async function getUpcomingFollowUps(days = 7): Promise<{ visit: Visit; patient: Patient | undefined }[]> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  const todayStr = today.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const allVisits = await dbGetAll<Visit>('visits');
  const allPatients = await dbGetAll<Patient>('patients');
  const patMap = new Map(allPatients.map(p => [p.patientId, p]));
  return allVisits
    .filter(v => v.followUpDate && !v.followUpAttended && v.followUpDate >= todayStr && v.followUpDate <= endStr)
    .sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''))
    .map(v => ({ visit: v, patient: patMap.get(v.patientId) }));
}

export async function getPatientVisits(patientId: string): Promise<Visit[]> {
  const all = await dbGetByIndex<Visit>('visits', 'patientId', patientId);
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Settings ────────────────────────────────────────────────────
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const r = await dbGet<Settings>('settings', key);
  return r ? r.value : defaultValue;
}
export async function setSetting(key: string, value: string): Promise<void> {
  await dbPut('settings', { key, value });
}

// ─── Default Medicines Seed ───────────────────────────────────────
export async function seedMedicines(): Promise<void> {
  const existing = await dbGetAll<Medicine>('medicines');
  if (existing.length > 0) return;
  const medicines: Omit<Medicine, 'id'>[] = [
    { name: 'Paracetamol 500mg', category: 'Antipyretic', defaultDose: '1-0-1', defaultDuration: '5 days' },
    { name: 'Paracetamol 650mg', category: 'Antipyretic', defaultDose: '1-0-1', defaultDuration: '5 days' },
    { name: 'Ibuprofen 400mg', category: 'NSAID', defaultDose: '1-0-1', defaultDuration: '5 days' },
    { name: 'Diclofenac 50mg', category: 'NSAID', defaultDose: '1-0-1', defaultDuration: '5 days' },
    { name: 'Aceclofenac 100mg', category: 'NSAID', defaultDose: '1-0-1', defaultDuration: '5 days' },
    { name: 'Nimesulide 100mg', category: 'NSAID', defaultDose: '0-0-1', defaultDuration: '3 days' },
    { name: 'Amoxicillin 500mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '7 days' },
    { name: 'Azithromycin 500mg', category: 'Antibiotic', defaultDose: '1-0-0', defaultDuration: '5 days' },
    { name: 'Ciprofloxacin 500mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '7 days' },
    { name: 'Metronidazole 400mg', category: 'Antibiotic', defaultDose: '1-1-1', defaultDuration: '7 days' },
    { name: 'Doxycycline 100mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '7 days' },
    { name: 'Cefixime 200mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '5 days' },
    { name: 'Amoxiclav 625mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '7 days' },
    { name: 'Pantoprazole 40mg', category: 'Antacid', defaultDose: '1-0-0', defaultDuration: '14 days' },
    { name: 'Omeprazole 20mg', category: 'Antacid', defaultDose: '1-0-0', defaultDuration: '14 days' },
    { name: 'Domperidone 10mg', category: 'Antiemetic', defaultDose: '1-1-1', defaultDuration: '5 days' },
    { name: 'Ondansetron 4mg', category: 'Antiemetic', defaultDose: '1-1-1', defaultDuration: '3 days' },
    { name: 'ORS Sachet', category: 'Rehydration', defaultDose: 'As needed', defaultDuration: '3 days' },
    { name: 'Metformin 500mg', category: 'Antidiabetic', defaultDose: '1-0-1', defaultDuration: '30 days' },
    { name: 'Metformin 1000mg', category: 'Antidiabetic', defaultDose: '1-0-1', defaultDuration: '30 days' },
    { name: 'Glimepiride 1mg', category: 'Antidiabetic', defaultDose: '1-0-0', defaultDuration: '30 days' },
    { name: 'Glimepiride 2mg', category: 'Antidiabetic', defaultDose: '1-0-0', defaultDuration: '30 days' },
    { name: 'Amlodipine 5mg', category: 'Antihypertensive', defaultDose: '0-0-1', defaultDuration: '30 days' },
    { name: 'Amlodipine 10mg', category: 'Antihypertensive', defaultDose: '0-0-1', defaultDuration: '30 days' },
    { name: 'Telmisartan 40mg', category: 'Antihypertensive', defaultDose: '1-0-0', defaultDuration: '30 days' },
    { name: 'Atenolol 50mg', category: 'Antihypertensive', defaultDose: '1-0-0', defaultDuration: '30 days' },
    { name: 'Cetirizine 10mg', category: 'Antihistamine', defaultDose: '0-0-1', defaultDuration: '7 days' },
    { name: 'Loratadine 10mg', category: 'Antihistamine', defaultDose: '1-0-0', defaultDuration: '7 days' },
    { name: 'Chlorpheniramine 4mg', category: 'Antihistamine', defaultDose: '0-0-1', defaultDuration: '5 days' },
    { name: 'Bromhexine 8mg', category: 'Expectorant', defaultDose: '1-1-1', defaultDuration: '5 days' },
    { name: 'Salbutamol 2mg', category: 'Bronchodilator', defaultDose: '1-1-1', defaultDuration: '5 days' },
    { name: 'Montelukast 10mg', category: 'Antileukotriene', defaultDose: '0-0-1', defaultDuration: '30 days' },
    { name: 'Vitamin C 500mg', category: 'Vitamin', defaultDose: '1-0-1', defaultDuration: '30 days' },
    { name: 'Vitamin D3 60000 IU', category: 'Vitamin', defaultDose: '1/week', defaultDuration: '8 weeks' },
    { name: 'B-Complex', category: 'Vitamin', defaultDose: '1-0-1', defaultDuration: '30 days' },
    { name: 'Iron + Folic Acid', category: 'Supplement', defaultDose: '1-0-1', defaultDuration: '90 days' },
    { name: 'Zinc 20mg', category: 'Supplement', defaultDose: '1-0-0', defaultDuration: '14 days' },
    { name: 'Albendazole 400mg', category: 'Antiparasitic', defaultDose: 'Single dose', defaultDuration: '1 day' },
    { name: 'Ivermectin 6mg', category: 'Antiparasitic', defaultDose: 'Single dose', defaultDuration: '1 day' },
    { name: 'Fluconazole 150mg', category: 'Antifungal', defaultDose: 'Single dose', defaultDuration: '1 day' },
    { name: 'Levothyroxine 50mcg', category: 'Thyroid', defaultDose: '1-0-0', defaultDuration: '30 days' },
    { name: 'Chloroquine 250mg', category: 'Antimalarial', defaultDose: '1-1-1', defaultDuration: '3 days' },
  ];
  for (const med of medicines) await dbAdd('medicines', med);
}
