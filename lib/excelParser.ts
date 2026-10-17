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

/** Maximum accepted spreadsheet size for bulk import. */
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
/** Maximum number of data rows parsed from a spreadsheet. */
export const MAX_IMPORT_ROWS = 5000;

// Only these columns are ever read from an uploaded sheet (matched by normalized header).
// Rows are read as positional arrays, so arbitrary header names such as `__proto__`,
// `constructor` or `prototype` are never used as object keys.
const FIELD_ALIASES = {
  name: ['name', 'medicinename', 'medicine', 'drug', 'drugname'],
  category: ['category', 'type', 'group', 'class'],
  strength: ['strength', 'dosemg', 'mg', 'dosage'],
  unit: ['unit', 'unittype', 'form'],
  defaultDose: ['defaultdose', 'dosage', 'dose', 'frequency', 'schedule'],
  defaultDuration: ['defaultduration', 'duration', 'days'],
} as const;

type ImportField = keyof typeof FIELD_ALIASES;
const IMPORT_FIELDS = Object.keys(FIELD_ALIASES) as ImportField[];

function cellToString(val: unknown): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val).trim();
  if (val instanceof Date) return val.toISOString();
  return '';
}

export async function parseMedicinesExcel(
  file: File,
  existingMedicines: Medicine[] = []
): Promise<ParsedMedicineRow[]> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('File is too large. Please upload a spreadsheet smaller than 2 MB.');
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', sheetRows: MAX_IMPORT_ROWS + 1 });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file does not contain any worksheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', blankrows: false });
  const headerRow = Array.isArray(grid[0]) ? grid[0] : [];
  const headers = headerRow.map((h) => normalizeHeader(cellToString(h)));

  // Resolve each known field to the first matching column index (-1 when absent)
  const columnOf = {} as Record<ImportField, number>;
  for (const field of IMPORT_FIELDS) {
    const aliases: readonly string[] = FIELD_ALIASES[field];
    columnOf[field] = headers.findIndex((h) => aliases.includes(h));
  }

  const existingNames = new Set(existingMedicines.map((m) => m.name.toLowerCase().trim()));
  const seenInBatch = new Set<string>();

  const results: ParsedMedicineRow[] = [];
  const dataRows = grid.slice(1, MAX_IMPORT_ROWS + 1);

  for (let i = 0; i < dataRows.length; i++) {
    const cells = Array.isArray(dataRows[i]) ? dataRows[i] : [];
    const read = (field: ImportField) => (columnOf[field] >= 0 ? cellToString(cells[columnOf[field]]) : '');
    const name = read('name');
    const rawCategory = read('category');
    const strength = read('strength');
    const unit = read('unit');
    const defaultDose = read('defaultDose');
    const defaultDuration = read('defaultDuration');

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
