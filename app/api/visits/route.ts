import { NextResponse } from 'next/server';
import { mockVisits } from '../mockData';
import type { CreateVisitInput } from '@/lib/providers/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let results = mockVisits;
  if (patientId) {
    results = results.filter((v) => v.patientId === patientId);
  }
  if (startDate) {
    results = results.filter((v) => v.date >= startDate);
  }
  if (endDate) {
    results = results.filter((v) => v.date <= endDate);
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const body: CreateVisitInput = await request.json();
    const newVisit = {
      id: mockVisits.length + 1,
      patientId: body.patientId,
      category: body.category || 'OPD',
      date: body.date || new Date().toISOString().split('T')[0],
      chiefComplaints: body.chiefComplaints || '',
      diagnosis: body.diagnosis || '',
      bp: body.bp,
      pulse: body.pulse,
      temp: body.temp,
      spo2: body.spo2,
      weight: body.weight,
      treatment: body.treatment,
      prescriptionNotes: body.prescriptionNotes,
      medicines: body.medicines || [],
      followUpDate: body.followUpDate,
      followUpAttended: false,
      createdAt: new Date().toISOString(),
    };

    mockVisits.unshift(newVisit);
    return NextResponse.json(newVisit, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invalid visit payload' }, { status: 400 });
  }
}
