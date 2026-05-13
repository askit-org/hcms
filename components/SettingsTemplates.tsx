import { useState } from 'react';
import { useTemplates, useTemplateMutations } from '@/lib/hooks/useQueries';
import { FileText, Trash2, Plus, X } from 'lucide-react';
import { toast } from './Toast';

export default function SettingsTemplates() {
  const { data: templates = [], isLoading } = useTemplates();
  const { create, remove } = useTemplateMutations();
  const [showAdd, setShowAdd] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', diagnosis: '', notes: '' });

  const handleCreate = async () => {
    if (!newTemplate.name || !newTemplate.diagnosis) {
      toast('Name and Diagnosis are required.', 'error');
      return;
    }
    await create.mutateAsync({ ...newTemplate, medicines: [] });
    setNewTemplate({ name: '', diagnosis: '', notes: '' });
    setShowAdd(false);
    toast('Template created successfully', 'success');
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} /> Prescription Templates
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Template'}
        </button>
      </div>

      {showAdd && (
        <div style={{ padding: '16px', background: 'var(--surface-2)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
          <div className="form-grid form-grid-2" style={{ marginBottom: '12px' }}>
            <div>
              <label className="form-label">Template Name</label>
              <input className="form-input" value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} placeholder="e.g. Viral Fever Protocol" />
            </div>
            <div>
              <label className="form-label">Diagnosis</label>
              <input className="form-input" value={newTemplate.diagnosis} onChange={e => setNewTemplate({ ...newTemplate, diagnosis: e.target.value })} placeholder="e.g. Viral Fever" />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label className="form-label">Notes (Optional)</label>
            <input className="form-input" value={newTemplate.notes} onChange={e => setNewTemplate({ ...newTemplate, notes: e.target.value })} placeholder="e.g. Drink warm water..." />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>Save Template</button>
        </div>
      )}

      {isLoading ? <p>Loading templates...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.length === 0 && !showAdd && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No templates found.</p>}
          {templates.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Diagnosis: {t.diagnosis}</div>
              </div>
              <button className="btn-icon" onClick={() => { if(confirm('Delete this template?')) remove.mutate(t.id!); }}>
                <Trash2 size={16} style={{ color: 'var(--red)' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
