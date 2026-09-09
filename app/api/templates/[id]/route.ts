import { NextResponse } from 'next/server';
import { mockTemplates } from '../../mockData';

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
