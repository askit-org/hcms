import { NextResponse } from 'next/server';
import { mockVisits } from '../../mockData';

export async function GET() {
  const today = new Date().toISOString().split('T')[0];
  const results = mockVisits.filter((v) => v.date?.startsWith(today));
  return NextResponse.json(results);
}
