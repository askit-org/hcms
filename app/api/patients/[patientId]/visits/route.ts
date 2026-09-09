import { NextResponse } from 'next/server';
import { mockVisits } from '../../../mockData';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const visits = mockVisits
    .filter((v) => v.patientId === patientId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json(visits);
}
