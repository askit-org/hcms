import { useState } from 'react';
import { useAppOptions, useAppOptionMutations } from '@/lib/hooks/useQueries';
import { Tag, Trash2, Plus } from 'lucide-react';
import { toast } from './Toast';

export default function SettingsOptions() {
  const [selectedType, setSelectedType] = useState('DISEASE');
  const { data: options = [], isLoading } = useAppOptions(selectedType);
  const { create, remove } = useAppOptionMutations();
  const [newValue, setNewValue] = useState('');

  const types = [
    { id: 'DISEASE', label: 'Diseases' },
    { id: 'CHIEF_COMPLAINT', label: 'Chief Complaints' },
    { id: 'MEDICINE_CATEGORY', label: 'Medicine Categories' },
  ];

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    await create.mutateAsync({ optionType: selectedType, value: newValue.trim() });
    setNewValue('');
    toast('Option added', 'success');
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Tag size={16} /> Configurable Options
      </div>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {types.map(t => (
          <button 
            key={t.id} 
            className={`btn btn-sm ${selectedType === t.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedType(t.id)}
            style={selectedType !== t.id ? { border: '1px solid var(--border)' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input 
          className="form-input" 
          value={newValue} 
          onChange={e => setNewValue(e.target.value)} 
          placeholder={`Add new ${types.find(t => t.id === selectedType)?.label.slice(0, -1).toLowerCase()}...`}
          onKeyDown={e => { if(e.key === 'Enter') handleAdd() }}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          <Plus size={16} /> Add
        </button>
      </div>

      {isLoading ? <p>Loading...</p> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {options.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No options defined yet.</p>}
          {options.map(o => (
            <div key={o.id} className="badge" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {o.value}
              <button 
                onClick={() => { if(confirm(`Delete ${o.value}?`)) remove.mutate(o.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--red)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
