import { NextResponse } from 'next/server';
import { mockMedicines } from '../mockData';
import type { CreateMedicineInput } from '@/lib/providers/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase().trim();
  const category = searchParams.get('category')?.toLowerCase().trim();

  let results = mockMedicines;
  if (search) {
    results = results.filter((m) => m.name.toLowerCase().includes(search));
  }
  if (category) {
    results = results.filter((m) => m.category.toLowerCase().includes(category));
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const body: CreateMedicineInput = await request.json();
    const newMedicine = {
      id: mockMedicines.length + 1,
      name: body.name,
      category: body.category || 'General',
      defaultDose: body.defaultDose || '1-0-1',
      defaultDuration: body.defaultDuration || '5 days',
      unit: body.unit,
      strength: body.strength,
    };

    mockMedicines.unshift(newMedicine);
    return NextResponse.json(newMedicine, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invalid medicine payload' }, { status: 400 });
  }
}
