import * as XLSX from 'xlsx';
import type { CreateMedicineInput, Medicine } from '@/lib/providers/types';

export interface ParsedMedicineRow {
  id: string; // temporary key for list rendering
  name: string;
  category: string;
  strength: string;
  unit: string;
  defaultDose: string;
  defaultDuration: string;
  status: 'valid' | 'duplicate' | 'invalid';
  errorReason?: string;
  selected: boolean;
}

const CATEGORY_MAP: Record<string, string> = {
  antibiotic: 'Antibiotic',
  antipyretic: 'Antipyretic',
  nsaid: 'NSAID',
  antacid: 'Antacid',
  antiemetic: 'Antiemetic',
  antidiabetic: 'Antidiabetic',
  antihypertensive: 'Antihypertensive',
  antihistamine: 'Antihistamine',
  expectorant: 'Expectorant',
  bronchodilator: 'Bronchodilator',
  antileukotriene: 'Antileukotriene',
  vitamin: 'Vitamin',
  supplement: 'Supplement',
  antiparasitic: 'Antiparasitic',
  antifungal: 'Antifungal',
  thyroid: 'Thyroid',
  antimalarial: 'Antimalarial',
  rehydration: 'Rehydration',
};

function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findValue(row: Record<string, any>, possibleKeys: string[]): string {
  for (const rawKey of Object.keys(row)) {
    const norm = normalizeHeader(rawKey);
    if (possibleKeys.includes(norm)) {
      const val = row[rawKey];
      return val !== undefined && val !== null ? String(val).trim() : '';
    }
  }
  return '';
}

export async function parseMedicinesExcel(
  file: File,
  existingMedicines: Medicine[] = []
): Promise<ParsedMedicineRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file does not contain any worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  const existingNames = new Set(existingMedicines.map((m) => m.name.toLowerCase().trim()));
  const seenInBatch = new Set<string>();

  const results: ParsedMedicineRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const name = findValue(row, ['name', 'medicinename', 'medicine', 'drug', 'drugname']);
    const rawCategory = findValue(row, ['category', 'type', 'group', 'class']);
    const strength = findValue(row, ['strength', 'dosemg', 'mg', 'dosage']);
    const unit = findValue(row, ['unit', 'unittype', 'form']);
    const defaultDose = findValue(row, ['defaultdose', 'dosage', 'dose', 'frequency', 'schedule']);
    const defaultDuration = findValue(row, ['defaultduration', 'duration', 'days']);

    if (!name && !rawCategory && !strength) {
      // Empty row, skip
      continue;
    }

    const catKey = rawCategory.toLowerCase().trim();
    const category = CATEGORY_MAP[catKey] || (rawCategory ? rawCategory : 'Other');
    const finalUnit = unit || 'mg';

    let status: 'valid' | 'duplicate' | 'invalid' = 'valid';
    let errorReason = '';

    if (!name) {
      status = 'invalid';
      errorReason = 'Medicine name is missing';
    } else {
      const nameKey = name.toLowerCase().trim();
      if (existingNames.has(nameKey)) {
        status = 'duplicate';
        errorReason = 'Already exists in catalog';
      } else if (seenInBatch.has(nameKey)) {
        status = 'duplicate';
        errorReason = 'Duplicate row in spreadsheet';
      } else {
        seenInBatch.add(nameKey);
      }
    }

    results.push({
      id: `row-${i}-${Date.now()}`,
      name,
      category,
      strength,
      unit: finalUnit,
      defaultDose,
      defaultDuration,
      status,
      errorReason,
      selected: status === 'valid',
    });
  }

  return results;
}

export function downloadMedicineTemplate() {
  const templateData = [
    {
      'Medicine Name': 'Paracetamol 500mg',
      Category: 'Antipyretic',
      Strength: '500',
      Unit: 'mg',
      'Default Dose': '1-0-1',
      'Default Duration': '5 days',
    },
    {
      'Medicine Name': 'Amoxicillin 500mg',
      Category: 'Antibiotic',
      Strength: '500',
      Unit: 'mg',
      'Default Dose': '1-0-1',
      'Default Duration': '7 days',
    },
    {
      'Medicine Name': 'Pantoprazole 40mg',
      Category: 'Antacid',
      Strength: '40',
      Unit: 'mg',
      'Default Dose': '1-0-0',
      'Default Duration': '14 days',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  
  // Set explicit column widths for neat appearance
  worksheet['!cols'] = [
    { wch: 25 }, // Medicine Name
    { wch: 18 }, // Category
    { wch: 12 }, // Strength
    { wch: 10 }, // Unit
    { wch: 16 }, // Default Dose
    { wch: 18 }, // Default Duration
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines Template');

  XLSX.writeFile(workbook, 'medicines_bulk_import_template.xlsx');
}
