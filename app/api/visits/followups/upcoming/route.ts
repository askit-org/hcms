import { NextResponse } from 'next/server';
import { mockVisits, mockPatients } from '../../../mockData';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7', 10);

  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const patMap = new Map(mockPatients.map((p) => [p.patientId, p]));

  const followups = mockVisits
    .filter(
      (v) =>
        v.followUpDate &&
        !v.followUpAttended &&
        v.followUpDate >= todayStr &&
        v.followUpDate <= endStr
    )
    .sort((a, b) => (a.followUpDate || '').localeCompare(b.followUpDate || ''))
    .map((v) => ({
      visit: v,
      patient: patMap.get(v.patientId),
    }));

  return NextResponse.json(followups);
}
