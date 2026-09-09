import { NextResponse } from 'next/server';
import { mockPatients } from '../mockData';
import type { CreatePatientInput } from '@/lib/providers/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase().trim();

  let results = mockPatients;
  if (search) {
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.mobile.includes(search) ||
        p.patientId.toLowerCase().includes(search)
    );
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const body: CreatePatientInput & { patientId?: string } = await request.json();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const seq = String(mockPatients.length + 1).padStart(4, '0');
    const patientId = body.patientId || `OPD-${dateStr}-${seq}`;

    const newPatient = {
      id: mockPatients.length + 1,
      patientId,
      name: body.name,
      age: body.age,
      dob: body.dob,
      gender: body.gender || 'Male',
      mobile: body.mobile,
      address: body.address,
      occupation: body.occupation,
      abhaNumber: body.abhaNumber,
      permanentConditions: body.permanentConditions || [],
      createdAt: new Date().toISOString(),
    };

    mockPatients.unshift(newPatient);
    return NextResponse.json(newPatient, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invalid patient payload' }, { status: 400 });
  }
}
