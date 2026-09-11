import { NextResponse } from 'next/server';
import { mockQueue } from '../../../mockData';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, inRoomSince } = body;

    const item = mockQueue.find((q) => q.id === id);
    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    if (status) item.status = status;
    if (inRoomSince !== undefined) item.inRoomSince = inRoomSince;

    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update queue status' }, { status: 400 });
  }
}
