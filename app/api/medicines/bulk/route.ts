import { NextResponse } from 'next/server';
import { mockMedicines } from '../../mockData';
import type { CreateMedicineInput } from '@/lib/providers/types';

export async function POST(request: Request) {
  try {
    const { medicines }: { medicines: CreateMedicineInput[] } = await request.json();
    const added = [];
    for (const item of medicines || []) {
      const med = {
        id: mockMedicines.length + 1,
        name: item.name,
        category: item.category || 'General',
        defaultDose: item.defaultDose || '1-0-1',
        defaultDuration: item.defaultDuration || '5 days',
        unit: item.unit,
        strength: item.strength,
      };
      mockMedicines.push(med);
      added.push(med);
    }
    return NextResponse.json(added, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Bulk creation failed' }, { status: 400 });
  }
}
