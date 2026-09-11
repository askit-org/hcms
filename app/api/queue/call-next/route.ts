import { NextResponse } from 'next/server';
import { mockQueue } from '../../mockData';

export async function POST() {
  const currentServingIndex = mockQueue.findIndex((q) => q.status === 'NOW_SERVING');
  if (currentServingIndex !== -1) {
    mockQueue[currentServingIndex].status = 'COMPLETED';
  }

  const nextIndex = mockQueue.findIndex((q) => q.status === 'NEXT_IN_LINE' || q.status === 'WAITING');
  if (nextIndex !== -1) {
    mockQueue[nextIndex].status = 'NOW_SERVING';
    mockQueue[nextIndex].inRoomSince = 'Just Called';
    mockQueue[nextIndex].estimatedTurn = 'In Session';
  }

  const followingIndex = mockQueue.findIndex((q) => q.status === 'WAITING');
  if (followingIndex !== -1) {
    mockQueue[followingIndex].status = 'NEXT_IN_LINE';
  }

  return NextResponse.json({
    nowServing: nextIndex !== -1 ? mockQueue[nextIndex] : null,
    queue: mockQueue.filter((q) => q.status !== 'COMPLETED'),
  });
}
