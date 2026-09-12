import { NextResponse } from 'next/server';
import { mockTemplates } from '../../mockData';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const index = mockTemplates.findIndex((t) => String(t.id) === id);

  if (index !== -1) {
    mockTemplates[index] = { ...mockTemplates[index], ...body };
    return NextResponse.json(mockTemplates[index]);
  }
  return NextResponse.json({ error: 'Template not found' }, { status: 404 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockTemplates.findIndex((t) => String(t.id) === id);

  if (index !== -1) {
    mockTemplates.splice(index, 1);
  }
  return NextResponse.json({ success: true });
}
