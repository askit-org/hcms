import { NextResponse } from 'next/server';
import { mockVisits } from '../../../mockData';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params;
  const visit = mockVisits.find((v) => String(v.id) === visitId);

  if (!visit) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  }

  visit.followUpAttended = true;
  return NextResponse.json(visit);
}
