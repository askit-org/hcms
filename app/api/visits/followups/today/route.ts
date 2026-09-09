import { NextResponse } from 'next/server';
import { mockVisits, mockPatients } from '../../../mockData';

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const patMap = new Map(mockPatients.map((p) => [p.patientId, p]));

  const followups = mockVisits
    .filter((v) => v.followUpDate === today && !v.followUpAttended)
    .map((v) => ({
      visit: v,
      patient: patMap.get(v.patientId),
    }));

  return NextResponse.json(followups);
}
