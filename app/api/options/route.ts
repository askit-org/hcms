import { NextResponse } from 'next/server';
import { mockAppOptions } from '../mockData';
import type { CreateAppOptionInput } from '@/lib/providers/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  let results = mockAppOptions;
  if (type) {
    results = results.filter((o) => o.optionType === type);
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const body: CreateAppOptionInput = await request.json();
    const newOption = {
      id: mockAppOptions.length + 1,
      optionType: body.optionType,
      value: body.value,
      createdAt: new Date().toISOString(),
    };

    mockAppOptions.push(newOption);
    return NextResponse.json(newOption, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invalid option payload' }, { status: 400 });
  }
}
