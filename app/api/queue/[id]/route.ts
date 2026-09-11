import { NextResponse } from 'next/server';
import { mockQueue } from '../../mockData';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const index = mockQueue.findIndex((q) => q.id === id);
    if (index !== -1) {
      mockQueue.splice(index, 1);
    }
    return NextResponse.json({ success: true, message: 'Patient removed from queue.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove from queue' }, { status: 400 });
  }
}
