import { NextResponse } from 'next/server';
import { mockSettings } from '../mockData';
import type { ClinicSettings } from '@/lib/providers/types';

export async function GET() {
  return NextResponse.json(mockSettings);
}

export async function PUT(request: Request) {
  try {
    const updates: Partial<ClinicSettings> = await request.json();
    Object.assign(mockSettings, updates);
    return NextResponse.json(mockSettings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 400 });
  }
}
