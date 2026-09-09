// app/api/mockData.ts
// Shared server-side mock state for dev Next.js API route handlers

import type { Patient, Visit, Medicine, Template, ClinicSettings, AppOption, FollowUpItem, DashboardStats } from '@/lib/providers/types';

export let mockPatients: Patient[] = [
  {
    id: 1,
    patientId: 'OPD-20260909-0001',
    name: 'Rajesh Kumar',
    age: 45,
    gender: 'Male',
    mobile: '9876543210',
    address: '123 MG Road, Pune',
    occupation: 'Business',
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    patientId: 'OPD-20260909-0002',
    name: 'Priya Sharma',
    age: 32,
    gender: 'Female',
    mobile: '9812345678',
    address: '45 Park Street, Pune',
    occupation: 'Teacher',
    createdAt: new Date().toISOString(),
  },
];

export let mockVisits: Visit[] = [
  {
    id: 1,
    patientId: 'OPD-20260909-0001',
    category: 'OPD',
    date: new Date().toISOString().split('T')[0],
    chiefComplaints: 'Fever and Cough',
    diagnosis: 'Acute Upper Respiratory Tract Infection',
    bp: '120/80',
    pulse: '78',
    temp: '99.2',
    spo2: '98',
    weight: '70',
    treatment: 'Rest and hydration',
    prescriptionNotes: 'Take medicines after food',
    medicines: [
      { name: 'Paracetamol 650mg', dose: '1-0-1', duration: '5 days', customInstruction: 'After food' },
      { name: 'Azithromycin 500mg', dose: '1-0-0', duration: '5 days' },
    ],
    followUpDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    followUpAttended: false,
    createdAt: new Date().toISOString(),
  },
];

export let mockMedicines: Medicine[] = [
  { id: 1, name: 'Paracetamol 500mg', category: 'Antipyretic', defaultDose: '1-0-1', defaultDuration: '5 days' },
  { id: 2, name: 'Paracetamol 650mg', category: 'Antipyretic', defaultDose: '1-0-1', defaultDuration: '5 days' },
  { id: 3, name: 'Amoxicillin 500mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '7 days' },
  { id: 4, name: 'Azithromycin 500mg', category: 'Antibiotic', defaultDose: '1-0-0', defaultDuration: '5 days' },
  { id: 5, name: 'Pantoprazole 40mg', category: 'Antacid', defaultDose: '1-0-0', defaultDuration: '14 days' },
  { id: 6, name: 'Cetirizine 10mg', category: 'Antihistamine', defaultDose: '0-0-1', defaultDuration: '7 days' },
];

export let mockTemplates: Template[] = [
  {
    id: 1,
    name: 'Fever & Cold Standard',
    diagnosis: 'Acute Viral Fever',
    medicines: [
      { name: 'Paracetamol 650mg', dose: '1-0-1', duration: '5 days' },
      { name: 'Cetirizine 10mg', dose: '0-0-1', duration: '5 days' },
    ],
    notes: 'Hydrate well',
    createdAt: new Date().toISOString(),
  },
];

export let mockSettings: ClinicSettings = {
  doctorName: 'Dr. Rahul Verma',
  degree: 'MBBS, MD (Medicine)',
  clinicName: 'Aarogya Healthcare Clinic',
  address: 'Suite 102, Healthcare Complex, Station Road',
  phone: '9876543210',
  regNo: 'MCI-987654',
  city: 'Pune',
};

export let mockAppOptions: AppOption[] = [
  { id: 1, optionType: 'chiefComplaint', value: 'Fever', createdAt: new Date().toISOString() },
  { id: 2, optionType: 'chiefComplaint', value: 'Cough & Cold', createdAt: new Date().toISOString() },
  { id: 3, optionType: 'diagnosis', value: 'Viral Fever', createdAt: new Date().toISOString() },
  { id: 4, optionType: 'diagnosis', value: 'Hypertension', createdAt: new Date().toISOString() },
];
