import { NextResponse } from 'next/server';
import { mockTemplates } from '../mockData';
import type { CreateTemplateInput } from '@/lib/providers/types';

export async function GET() {
  return NextResponse.json(mockTemplates);
}

export async function POST(request: Request) {
  try {
    const body: CreateTemplateInput = await request.json();
    const newTemplate = {
      id: mockTemplates.length + 1,
      name: body.name,
      diagnosis: body.diagnosis || '',
      medicines: body.medicines || [],
      notes: body.notes,
      createdAt: new Date().toISOString(),
    };

    mockTemplates.unshift(newTemplate);
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invalid template payload' }, { status: 400 });
  }
}
