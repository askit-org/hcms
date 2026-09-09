import { NextResponse } from 'next/server';
import { mockMedicines } from '../../mockData';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockMedicines.findIndex((m) => String(m.id) === id);

  if (index === -1) {
    return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
  }

  const updates = await request.json();
  mockMedicines[index] = { ...mockMedicines[index], ...updates };
  return NextResponse.json(mockMedicines[index]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockMedicines.findIndex((m) => String(m.id) === id);

  if (index !== -1) {
    mockMedicines.splice(index, 1);
  }
  return NextResponse.json({ success: true });
}
