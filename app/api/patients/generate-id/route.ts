import { NextResponse } from 'next/server';
import { mockPatients } from '../../mockData';

export async function GET() {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const todayCount = mockPatients.filter((p) => p.patientId?.includes(dateStr)).length;
  const seq = String(todayCount + 1).padStart(4, '0');
  const id = `OPD-${dateStr}-${seq}`;

  return NextResponse.json({ id });
}
