import { NextResponse } from 'next/server';
import { mockQueue, QueueItemData } from '../../mockData';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderedIds } = body as { orderedIds: string[] };

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 });
    }

    // Build a map of existing items for fast lookup
    const itemMap = new Map<string, QueueItemData>();
    mockQueue.forEach((item) => {
      itemMap.set(item.id, item);
    });

    const reorderedActiveItems: QueueItemData[] = [];

    // Separate items by ID order
    orderedIds.forEach((id) => {
      const found = itemMap.get(id);
      if (found) {
        reorderedActiveItems.push(found);
        itemMap.delete(id);
      }
    });

    // Add any remaining active items from mockQueue that weren't in orderedIds
    itemMap.forEach((item) => {
      if (item.status !== 'COMPLETED') {
        reorderedActiveItems.push(item);
      }
    });

    // Update statuses for reordered waiting items
    const currentServing = mockQueue.find((q) => q.status === 'NOW_SERVING');
    let waitingIndex = 0;
    const finalQueue: QueueItemData[] = [];

    if (currentServing) {
      finalQueue.push(currentServing);
    }

    reorderedActiveItems.forEach((item) => {
      if (item.status === 'NOW_SERVING') return;

      if (item.status !== 'COMPLETED') {
        if (waitingIndex === 0) {
          item.status = 'NEXT_IN_LINE';
        } else {
          item.status = 'WAITING';
        }
        waitingIndex++;
        finalQueue.push(item);
      }
    });

    // Append COMPLETED items at the end
    mockQueue.forEach((q) => {
      if (q.status === 'COMPLETED' && !finalQueue.some(x => x.id === q.id)) {
        finalQueue.push(q);
      }
    });

    // Mutate mockQueue in place
    mockQueue.length = 0;
    mockQueue.push(...finalQueue);

    return NextResponse.json(mockQueue.filter((q) => q.status !== 'COMPLETED'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to reorder queue' }, { status: 400 });
  }
}
