import { NextResponse } from 'next/server';
import { mockMedicines } from '../../mockData';

export async function POST() {
  if (mockMedicines.length === 0) {
    mockMedicines.push(
      { id: 1, name: 'Paracetamol 500mg', category: 'Antipyretic', defaultDose: '1-0-1', defaultDuration: '5 days' },
      { id: 2, name: 'Amoxicillin 500mg', category: 'Antibiotic', defaultDose: '1-0-1', defaultDuration: '7 days' },
      { id: 3, name: 'Pantoprazole 40mg', category: 'Antacid', defaultDose: '1-0-0', defaultDuration: '14 days' }
    );
  }
  return NextResponse.json({ success: true, message: 'Medicines seeded' });
}
