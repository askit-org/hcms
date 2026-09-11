'use client';

import { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  RefreshCw,
  Check,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  parseMedicinesExcel, 
  downloadMedicineTemplate, 
  type ParsedMedicineRow 
} from '@/lib/excelParser';
import { useMedicines, useMedicineMutations } from '@/lib/hooks/useQueries';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MEDICINE_CATEGORIES = [
  'Antibiotic', 'Antipyretic', 'NSAID', 'Antacid', 'Antiemetic', 
  'Antidiabetic', 'Antihypertensive', 'Antihistamine', 'Expectorant', 
  'Bronchodilator', 'Antileukotriene', 'Vitamin', 'Supplement', 
  'Antiparasitic', 'Antifungal', 'Thyroid', 'Antimalarial', 'Rehydration', 'Other'
];

const UNIT_TYPES = [
  'mg', 'mcg', 'g', 'ml', 'IU', 'tablets', 'capsules', 'drops', 'sachet', 'pieces'
];

export default function BulkImportModal({ isOpen, onClose }: BulkImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: existingMedicines = [] } = useMedicines();
  const { bulkCreate } = useMedicineMutations();

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedMedicineRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'valid' | 'duplicate' | 'invalid'>('all');

  const handleReset = () => {
    setFile(null);
    setRows([]);
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      toast('Please select a valid Excel (.xlsx, .xls) or CSV file.', 'error');
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    try {
      const parsedRows = await parseMedicinesExcel(selectedFile, existingMedicines);
      setRows(parsedRows);
      if (parsedRows.length === 0) {
        toast('No rows were found in the uploaded spreadsheet.', 'error');
      } else {
        toast(`Successfully parsed ${parsedRows.length} rows.`, 'success');
      }
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to parse spreadsheet file.'), 'error');
      handleReset();
    } finally {
      setParsing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setRows(prev =>
      prev.map(r => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setRows(prev =>
      prev.map(r => (r.status === 'valid' ? { ...r, selected: checked } : r))
    );
  };

  const updateRowField = (id: string, field: keyof ParsedMedicineRow, value: string) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Clear error if name is supplied
        if (field === 'name' && value.trim()) {
          if (updated.status === 'invalid' && updated.errorReason?.includes('name is missing')) {
            updated.status = 'valid';
            updated.errorReason = undefined;
            updated.selected = true;
          }
        }
        return updated;
      })
    );
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleImport = async () => {
    const selectedRows = rows.filter(r => r.selected && r.name.trim());
    if (selectedRows.length === 0) {
      toast('No valid rows selected for import.', 'error');
      return;
    }

    try {
      const inputs = selectedRows.map(r => ({
        name: r.name.trim(),
        category: r.category || 'Other',
        strength: r.strength || '',
        unit: r.unit || 'mg',
        defaultDose: r.defaultDose || '',
        defaultDuration: r.defaultDuration || '',
      }));

      await bulkCreate.mutateAsync(inputs);
      toast(`Successfully imported ${inputs.length} medicines!`, 'success');
      handleClose();
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to import medicines into database.'), 'error');
    }
  };

  const validCount = rows.filter(r => r.status === 'valid').length;
  const duplicateCount = rows.filter(r => r.status === 'duplicate').length;
  const invalidCount = rows.filter(r => r.status === 'invalid').length;
  const selectedCount = rows.filter(r => r.selected).length;

  const filteredRows = rows.filter(r => {
    if (activeFilter === 'valid') return r.status === 'valid';
    if (activeFilter === 'duplicate') return r.status === 'duplicate';
    if (activeFilter === 'invalid') return r.status === 'invalid';
    return true;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="modal-overlay"
        style={{ zIndex: 9999 }}
      >
        <div className="modal modal-lg" style={{ maxWidth: '900px', width: '95vw', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          {/* Header */}
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: 8, background: 'var(--accent-glow)', color: 'var(--accent-light)', borderRadius: 8 }}>
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Bulk Add Medicines via Excel / CSV</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Upload your inventory spreadsheet to add multiple items at once (processed 100% locally)</span>
              </div>
            </div>
            <button className="btn-icon" onClick={handleClose}><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
            {!file ? (
              <div>
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: dragOver ? 'var(--accent-glow)' : 'var(--surface-1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                  />
                  <UploadCloud size={48} style={{ color: 'var(--accent)', opacity: 0.9, marginBottom: '12px' }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>Click or Drag & Drop Excel Sheet Here</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                    Supports <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> spreadsheet files
                  </p>
                </div>

                {/* Template Download & Guide */}
                <div style={{ 
                  marginTop: '20px', 
                  padding: '16px', 
                  borderRadius: '10px', 
                  background: 'var(--surface-1)', 
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <HelpCircle size={16} style={{ color: 'var(--accent)' }} />
                      Need the spreadsheet format template?
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Download our pre-formatted sample Excel file containing column headers for Medicine Name, Category, Strength, Unit, and Dosage.
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={downloadMedicineTemplate}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                  >
                    <Download size={16} /> Download Template (.xlsx)
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* File info bar */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  background: 'var(--surface-1)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileSpreadsheet size={20} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{file.name}</span>
                    <span className="badge badge-teal" style={{ fontSize: '0.75rem' }}>{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={14} /> Change File
                  </button>
                </div>

                {/* Filter Pill Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <button 
                    className={`btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveFilter('all')}
                  >
                    All Rows ({rows.length})
                  </button>
                  <button 
                    className={`btn btn-sm ${activeFilter === 'valid' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveFilter('valid')}
                  >
                    <CheckCircle2 size={14} style={{ color: 'var(--green, #10b981)', marginRight: 4 }} /> Valid ({validCount})
                  </button>
                  <button 
                    className={`btn btn-sm ${activeFilter === 'duplicate' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveFilter('duplicate')}
                  >
                    <AlertTriangle size={14} style={{ color: 'var(--amber, #f59e0b)', marginRight: 4 }} /> Duplicates ({duplicateCount})
                  </button>
                  {invalidCount > 0 && (
                    <button 
                      className={`btn btn-sm ${activeFilter === 'invalid' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setActiveFilter('invalid')}
                    >
                      <AlertTriangle size={14} style={{ color: 'var(--red, #ef4444)', marginRight: 4 }} /> Invalid ({invalidCount})
                    </button>
                  )}
                </div>

                {/* Spreadsheet Rows Preview Table */}
                <div className="table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={validCount > 0 && selectedCount === validCount} 
                            onChange={(e) => toggleSelectAll(e.target.checked)} 
                          />
                        </th>
                        <th>Medicine Name</th>
                        <th>Category</th>
                        <th>Strength / Unit</th>
                        <th>Default Dose</th>
                        <th>Default Duration</th>
                        <th>Status</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.id} style={{ opacity: r.status === 'invalid' ? 0.75 : 1 }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={r.selected} 
                              disabled={r.status === 'invalid'} 
                              onChange={() => toggleSelectRow(r.id)} 
                            />
                          </td>
                          <td>
                            <input 
                              className="form-input form-input-sm" 
                              value={r.name} 
                              placeholder="Required Name"
                              onChange={(e) => updateRowField(r.id, 'name', e.target.value)}
                              style={{ 
                                fontSize: '0.85rem', 
                                padding: '4px 8px',
                                borderColor: r.status === 'invalid' ? 'var(--red, #ef4444)' : undefined 
                              }}
                            />
                          </td>
                          <td>
                            <select 
                              className="form-select form-select-sm" 
                              value={r.category} 
                              onChange={(e) => updateRowField(r.id, 'category', e.target.value)}
                              style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                            >
                              {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: '4px' }}>
                              <input 
                                className="form-input form-input-sm" 
                                value={r.strength} 
                                placeholder="500"
                                onChange={(e) => updateRowField(r.id, 'strength', e.target.value)}
                                style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                              />
                              <select 
                                className="form-select form-select-sm" 
                                value={r.unit} 
                                onChange={(e) => updateRowField(r.id, 'unit', e.target.value)}
                                style={{ fontSize: '0.85rem', padding: '4px 4px' }}
                              >
                                {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </div>
                          </td>
                          <td>
                            <input 
                              className="form-input form-input-sm" 
                              value={r.defaultDose} 
                              placeholder="1-0-1"
                              onChange={(e) => updateRowField(r.id, 'defaultDose', e.target.value)}
                              style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                            />
                          </td>
                          <td>
                            <input 
                              className="form-input form-input-sm" 
                              value={r.defaultDuration} 
                              placeholder="5 days"
                              onChange={(e) => updateRowField(r.id, 'defaultDuration', e.target.value)}
                              style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                            />
                          </td>
                          <td>
                            {r.status === 'valid' && (
                              <span className="badge badge-teal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Check size={12} /> Ready
                              </span>
                            )}
                            {r.status === 'duplicate' && (
                              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={r.errorReason}>
                                <AlertTriangle size={12} /> Duplicate
                              </span>
                            )}
                            {r.status === 'invalid' && (
                              <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={r.errorReason}>
                                <AlertTriangle size={12} /> Missing Name
                              </span>
                            )}
                          </td>
                          <td>
                            <button 
                              type="button" 
                              className="btn-icon btn-icon-sm" 
                              onClick={() => removeRow(r.id)}
                              title="Remove row"
                            >
                              <Trash2 size={14} style={{ color: 'var(--text-muted)' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {file && (
                <span>
                  Selected <strong>{selectedCount}</strong> of {rows.length} rows to import
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-ghost" onClick={handleClose}>
                Cancel
              </button>
              {file && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  disabled={selectedCount === 0 || bulkCreate.isPending}
                  onClick={handleImport}
                >
                  {bulkCreate.isPending ? 'Importing...' : `Import ${selectedCount} Medicines`}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
