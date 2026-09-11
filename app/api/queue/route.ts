import { NextResponse } from 'next/server';
import { mockQueue, mockPatients } from '../mockData';

export async function GET() {
  return NextResponse.json(mockQueue.filter((q) => q.status !== 'COMPLETED'));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patientId = body.patientId;
    let patientName = body.patientName || 'Unknown Patient';
    let age = body.age;
    let gender = body.gender;
    let mobile = body.mobile;

    if (patientId) {
      const found = mockPatients.find((p) => p.patientId === patientId);
      if (found) {
        patientName = found.name;
        age = found.age;
        gender = found.gender;
        mobile = found.mobile;
      }
    }

    const activeItems = mockQueue.filter((q) => q.status !== 'COMPLETED');
    const maxTokenNo = activeItems.length === 0 ? 0 : Math.max(...activeItems.map((q) => q.tokenNo));
    const tokenNo = maxTokenNo + 1;

    const now = new Date();
    const queuedAt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newItem = {
      id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tokenNo,
      patientId: patientId || `PT-${Date.now()}`,
      patientName,
      age,
      gender,
      mobile,
      reason: body.reason || 'General OPD Consultation',
      category: body.category || 'Consultation',
      status: (activeItems.length === 0 ? 'NEXT_IN_LINE' : 'WAITING') as 'NEXT_IN_LINE' | 'WAITING',
      priority: body.priority || 'NORMAL',
      vitals: body.vitals,
      queuedAt,
      estimatedTurn: `~${new Date(Date.now() + activeItems.length * 15 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    };

    mockQueue.push(newItem);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to enqueue patient' }, { status: 400 });
  }
}
