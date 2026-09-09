import { NextResponse } from 'next/server';
import { mockVisits } from '../../mockData';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params;
  const visit = mockVisits.find((v) => String(v.id) === visitId);
  if (!visit) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  }
  return NextResponse.json(visit);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params;
  const index = mockVisits.findIndex((v) => String(v.id) === visitId);

  if (index === -1) {
    return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
  }

  const updates = await request.json();
  mockVisits[index] = { ...mockVisits[index], ...updates };
  return NextResponse.json(mockVisits[index]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const { visitId } = await params;
  const index = mockVisits.findIndex((v) => String(v.id) === visitId);
  if (index !== -1) {
    mockVisits.splice(index, 1);
  }
  return NextResponse.json({ success: true });
}
