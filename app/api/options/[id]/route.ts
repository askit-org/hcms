import { NextResponse } from 'next/server';
import { mockAppOptions } from '../../mockData';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = mockAppOptions.findIndex((o) => String(o.id) === id);

  if (index !== -1) {
    mockAppOptions.splice(index, 1);
  }
  return NextResponse.json({ success: true });
}
