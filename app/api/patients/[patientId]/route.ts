import { NextResponse } from 'next/server';
import { mockPatients } from '../../mockData';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const patient = mockPatients.find(
    (p) => p.patientId === patientId || String(p.id) === patientId
  );
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }
  return NextResponse.json(patient);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const index = mockPatients.findIndex(
    (p) => p.patientId === patientId || String(p.id) === patientId
  );

  if (index === -1) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
  }

  const updates = await request.json();
  mockPatients[index] = { ...mockPatients[index], ...updates };
  return NextResponse.json(mockPatients[index]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const index = mockPatients.findIndex(
    (p) => p.patientId === patientId || String(p.id) === patientId
  );

  if (index !== -1) {
    mockPatients.splice(index, 1);
  }
  return NextResponse.json({ success: true });
}
