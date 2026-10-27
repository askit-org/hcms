'use client';

import { useState, useEffect } from 'react';
import {
  Bed,
  Plus,
  Trash2,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useSettings, useSettingsMutations } from '@/lib/hooks/useQueries';
import type { IpdRoom, IpdBed } from '@/lib/providers/types';
import { toast } from './Toast';
import { getErrorMessage } from '@/lib/utils/error';

interface SettingsIpdRoomsProps {
  onSaved?: () => void;
  isModal?: boolean;
}

export default function SettingsIpdRooms({ onSaved, isModal = false }: SettingsIpdRoomsProps) {
  const { data: clinicSettings, isLoading } = useSettings();
  const { update: updateSettings } = useSettingsMutations();

  const [rooms, setRooms] = useState<IpdRoom[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Ward Form State
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomType, setNewRoomType] = useState('GENERAL');
  const [newRoomDailyRate, setNewRoomDailyRate] = useState('500');

  // Bed generation options in Add Form
  const [bedCreationMode, setBedCreationMode] = useState<'count' | 'custom' | 'manual'>('count');
  const [newBedCount, setNewBedCount] = useState('4');
  const [newBedPrefix, setNewBedPrefix] = useState('');
  const [newCustomBedsInput, setNewCustomBedsInput] = useState('');
  const [manualBedsList, setManualBedsList] = useState<string[]>([]);
  const [singleManualBedInput, setSingleManualBedInput] = useState('');

  // Sync state with settings on load
  useEffect(() => {
    if (clinicSettings?.ipdRooms && Array.isArray(clinicSettings.ipdRooms)) {
      setRooms(JSON.parse(JSON.stringify(clinicSettings.ipdRooms)));
    } else {
      setRooms([]);
    }
  }, [clinicSettings?.ipdRooms]);

  // Keep prefix updated with code
  useEffect(() => {
    if (newRoomCode.trim()) {
      setNewBedPrefix(`${newRoomCode.trim()}-`);
    }
  }, [newRoomCode]);

  // Total bed counts
  const totalBeds = rooms.reduce((sum, r) => sum + (r.beds?.length || 0), 0);

  // Add individual bed to manual list in creation form
  const handleAddManualBedToForm = () => {
    const val = singleManualBedInput.trim();
    if (!val) return;
    if (manualBedsList.includes(val)) {
      toast('This bed number is already added', 'error');
      return;
    }
    setManualBedsList((list) => [...list, val]);
    setSingleManualBedInput('');
  };

  // Create & Add New Ward to local rooms list
  const handleAddNewWard = () => {
    if (!newRoomName.trim()) {
      toast('Please enter a room or ward name', 'error');
      return;
    }

    const code = newRoomCode.trim() || newRoomName.slice(0, 3).toUpperCase();
    const rate = parseFloat(newRoomDailyRate) || 0;
    const roomId = `room-${Date.now()}`;

    let generatedBeds: IpdBed[] = [];

    if (bedCreationMode === 'count') {
      const count = parseInt(newBedCount, 10) || 0;
      const prefix = newBedPrefix.trim() || `${code}-`;
      generatedBeds = Array.from({ length: count }, (_, i) => {
        const num = i + 1;
        const formatted = num < 10 ? `0${num}` : `${num}`;
        return {
          id: `bed-${Date.now()}-${num}`,
          bedNumber: `${prefix}${formatted}`,
        };
      });
    } else if (bedCreationMode === 'custom') {
      const parts = newCustomBedsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      generatedBeds = parts.map((bedNum, i) => ({
        id: `bed-${Date.now()}-${i + 1}`,
        bedNumber: bedNum,
      }));
    } else if (bedCreationMode === 'manual') {
      generatedBeds = manualBedsList.map((bedNum, i) => ({
        id: `bed-${Date.now()}-${i + 1}`,
        bedNumber: bedNum,
      }));
    }

    const newWard: IpdRoom = {
      id: roomId,
      name: newRoomName.trim(),
      roomCode: code,
      type: newRoomType,
      dailyRate: rate,
      beds: generatedBeds,
    };

    setRooms((list) => [...list, newWard]);

    // Reset form
    setNewRoomName('');
    setNewRoomCode('');
    setNewRoomDailyRate('500');
    setNewBedCount('4');
    setNewCustomBedsInput('');
    setManualBedsList([]);
    setShowAddForm(false);
    toast(`Added "${newWard.name}" with ${generatedBeds.length} real bed(s)! Click "Save Changes" to apply.`, 'success');
  };

  // Save all rooms to database
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync({
        ipdRooms: rooms,
      });
      toast('Hospital rooms & bed configurations saved successfully!', 'success');
      if (onSaved) onSaved();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to save room configuration'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add a bed to an existing room
  const handleAddBedToExistingRoom = (roomIndex: number) => {
    const targetRoom = rooms[roomIndex];
    const prefix = targetRoom.roomCode?.trim() || 'BED';
    const nextNum = (targetRoom.beds?.length || 0) + 1;
    const defaultRoll = `${prefix}-${nextNum < 10 ? '0' + nextNum : nextNum}`;

    const customBedRoll = prompt(
      `Enter the real physical serial / roll number marked on this bed in ${targetRoom.name}:`,
      defaultRoll
    );

    if (customBedRoll === null) return;
    const trimmed = customBedRoll.trim() || defaultRoll;

    const newBed: IpdBed = {
      id: `bed-${Date.now()}-${Math.random()}`,
      bedNumber: trimmed,
    };

    setRooms((list) =>
      list.map((r, idx) => (idx === roomIndex ? { ...r, beds: [...(r.beds || []), newBed] } : r))
    );
  };

  // Auto-set bed count for an existing room
  const handleAutoSetExistingBeds = (roomIndex: number) => {
    const targetRoom = rooms[roomIndex];
    const currentCount = targetRoom.beds?.length || 0;
    const countStr = prompt(`How many total beds are in "${targetRoom.name}"?`, `${currentCount || 4}`);
    if (countStr === null) return;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count < 0) {
      toast('Please enter a valid bed number', 'error');
      return;
    }

    const prefix = targetRoom.roomCode?.trim() || 'B';
    const updatedBeds: IpdBed[] = Array.from({ length: count }, (_, i) => {
      const num = i + 1;
      const formatted = num < 10 ? `0${num}` : `${num}`;
      // Preserve existing bed label if available
      const existing = targetRoom.beds?.[i];
      return {
        id: existing?.id || `bed-${Date.now()}-${num}`,
        bedNumber: existing?.bedNumber || `${prefix}-${formatted}`,
      };
    });

    setRooms((list) =>
      list.map((r, idx) => (idx === roomIndex ? { ...r, beds: updatedBeds } : r))
    );
    toast(`Set ${count} beds for ${targetRoom.name}`, 'info');
  };

  // Immediately delete a room and persist changes to database
  const handleDeleteRoom = async (roomIndex: number) => {
    const room = rooms[roomIndex];
    if (!confirm(`Delete "${room.name}" and all its beds?\n\nThis will immediately remove this ward and its beds from your clinic database.`)) return;

    const updated = rooms.filter((_, idx) => idx !== roomIndex);
    setRooms(updated);
    try {
      await updateSettings.mutateAsync({ ipdRooms: updated });
      toast(`Deleted "${room.name}" from database.`, 'success');
      if (onSaved) onSaved();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to update rooms in database'), 'error');
    }
  };

  // Immediately remove a bed and persist changes to database
  const handleRemoveBed = async (roomIndex: number, bedIndex: number) => {
    const targetRoom = rooms[roomIndex];
    const targetBed = targetRoom.beds?.[bedIndex];
    const updated = rooms.map((roomItem, ri) => {
      if (ri !== roomIndex) return roomItem;
      return { ...roomItem, beds: (roomItem.beds || []).filter((_, bi) => bi !== bedIndex) };
    });
    setRooms(updated);
    try {
      await updateSettings.mutateAsync({ ipdRooms: updated });
      toast(`Bed ${targetBed?.bedNumber || ''} removed.`, 'success');
      if (onSaved) onSaved();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to remove bed'), 'error');
    }
  };

  // Clear all rooms and reset to empty state
  const handleClearAllRooms = async () => {
    if (!confirm('Are you sure you want to delete ALL hospital rooms and beds? This will reset your IPD ward setup to empty.')) return;
    setRooms([]);
    try {
      await updateSettings.mutateAsync({ ipdRooms: [] });
      toast('All hospital rooms and beds deleted from database.', 'success');
      if (onSaved) onSaved();
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to clear rooms'), 'error');
    }
  };

  return (
    <div
      className={isModal ? '' : 'card'}
      style={{
        marginBottom: isModal ? 0 : 20,
        border: isModal ? 'none' : '1px solid var(--border)',
        padding: isModal ? 0 : undefined,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.05rem' }}>
            <Bed size={20} style={{ color: 'var(--primary)' }} />
            <span>Hospital Inpatient (IPD) Wards &amp; Beds</span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 12,
                background: totalBeds > 0 ? 'rgba(13, 148, 136, 0.12)' : 'var(--surface-2)',
                color: totalBeds > 0 ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {rooms.length} Ward{rooms.length === 1 ? '' : 's'} · {totalBeds} Real Bed{totalBeds === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Configure your hospital&apos;s real wards, daily bed rates, and physical bed serial numbers (e.g. ICU-01, Male Ward Bed 03).
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {showAddForm ? <ChevronUp size={14} /> : <Plus size={14} />}
            {showAddForm ? 'Close Form' : '+ Add Real Ward / Room'}
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveAll}
            disabled={isSaving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Add Real Ward / Room Form */}
      {showAddForm && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1.5px solid var(--primary)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} style={{ color: 'var(--primary)' }} /> Create Real Hospital Ward or Room
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Enter real room details matching your clinic/hospital facility
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                Ward / Room Name *
              </label>
              <input
                className="form-input"
                placeholder="e.g. Male General Ward"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                Code / Short Prefix
              </label>
              <input
                className="form-input"
                placeholder="e.g. MGW"
                value={newRoomCode}
                onChange={(e) => setNewRoomCode(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                Ward Category
              </label>
              <select
                className="form-select"
                value={newRoomType}
                onChange={(e) => setNewRoomType(e.target.value)}
              >
                <option value="GENERAL">General Ward</option>
                <option value="ICU">ICU / Critical Care</option>
                <option value="SEMI_PRIVATE">Semi-Private Room</option>
                <option value="PRIVATE">Private Room</option>
                <option value="DELUXE">Deluxe Suite</option>
                <option value="DAY_CARE">Day Care / Observation</option>
                <option value="POST_OP">Post-Operative Recovery</option>
                <option value="PEDIATRIC">Pediatric Ward</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
                Daily Bed Charge (₹)
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="500"
                value={newRoomDailyRate}
                onChange={(e) => setNewRoomDailyRate(e.target.value)}
              />
            </div>
          </div>

          {/* Bed Setup Options */}
          <div
            style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} style={{ color: 'var(--primary)' }} /> Bed Roll / Serial Number Setup Options:
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="bedMode"
                  checked={bedCreationMode === 'count'}
                  onChange={() => setBedCreationMode('count')}
                />
                Auto-generate by Bed Count (e.g. 4 beds)
              </label>

              <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="bedMode"
                  checked={bedCreationMode === 'custom'}
                  onChange={() => setBedCreationMode('custom')}
                />
                Comma-separated Bed Numbers (e.g. 101, 102, 103)
              </label>

              <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="bedMode"
                  checked={bedCreationMode === 'manual'}
                  onChange={() => setBedCreationMode('manual')}
                />
                Add Beds One by One
              </label>
            </div>

            {bedCreationMode === 'count' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Number of Beds:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    style={{ width: 90, height: 32, fontSize: '0.82rem', marginTop: 2 }}
                    value={newBedCount}
                    onChange={(e) => setNewBedCount(e.target.value)}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Bed Prefix / Serial Tag:</span>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: 130, height: 32, fontSize: '0.82rem', marginTop: 2 }}
                    placeholder="e.g. MGW-"
                    value={newBedPrefix}
                    onChange={(e) => setNewBedPrefix(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', paddingTop: 16 }}>
                  Preview: <strong>{newBedPrefix || `${newRoomCode || 'B'}-`}01</strong> to{' '}
                  <strong>
                    {newBedPrefix || `${newRoomCode || 'B'}-`}
                    {parseInt(newBedCount, 10) < 10
                      ? '0' + (parseInt(newBedCount, 10) || 1)
                      : parseInt(newBedCount, 10) || 1}
                  </strong>
                </div>
              </div>
            )}

            {bedCreationMode === 'custom' && (
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Type physical bed numbers separated by commas:
                </span>
                <input
                  className="form-input"
                  style={{ height: 34, fontSize: '0.82rem', marginTop: 4 }}
                  placeholder="e.g. Bed 101, Bed 102, Bed 103, Bed 104"
                  value={newCustomBedsInput}
                  onChange={(e) => setNewCustomBedsInput(e.target.value)}
                />
              </div>
            )}

            {bedCreationMode === 'manual' && (
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    style={{ maxWidth: 240, height: 32, fontSize: '0.82rem' }}
                    placeholder="e.g. ICU-VENT-01"
                    value={singleManualBedInput}
                    onChange={(e) => setSingleManualBedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualBedToForm();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddManualBedToForm}
                  >
                    + Add Bed
                  </button>
                </div>
                {manualBedsList.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {manualBedsList.map((bNum, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'var(--surface-2)',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {bNum}
                        <button
                          type="button"
                          onClick={() => setManualBedsList((list) => list.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red)', padding: 0 }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAddNewWard}
              disabled={!newRoomName.trim()}
            >
              + Add Ward to Hospital
            </button>
          </div>
        </div>
      )}

      {/* List of Real Configured Wards */}
      {rooms.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '36px 16px',
            background: 'var(--surface-1)',
            borderRadius: 12,
            border: '1.5px dashed var(--border)',
          }}
        >
          <Bed size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>No Real Hospital Rooms or Wards Configured Yet</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 440, margin: '6px auto 14px' }}>
            Setup your hospital&apos;s real rooms (e.g. Male Ward, ICU, Deluxe Room) and serial roll numbers matching your real physical beds.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={14} /> + Add Your First Real Ward / Room
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rooms.map((r, rIdx) => (
            <div
              key={r.id || rIdx}
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              {/* Ward Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {r.name}
                  </span>
                  {r.roomCode && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'var(--surface-2)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {r.roomCode}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: 'rgba(13, 148, 136, 0.1)',
                      color: 'var(--primary)',
                      padding: '2px 8px',
                      borderRadius: 10,
                    }}
                  >
                    {r.type?.replace('_', ' ') || 'GENERAL'}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    ₹{r.dailyRate || 500}/day
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => handleAutoSetExistingBeds(rIdx)}
                    title="Auto-set bed count"
                  >
                    <Sparkles size={11} /> Set Count ({r.beds?.length || 0})
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleAddBedToExistingRoom(rIdx)}
                    title="Add single real bed"
                  >
                    <Plus size={12} /> Add Bed
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    style={{ color: 'var(--red)' }}
                    onClick={() => handleDeleteRoom(rIdx)}
                    title="Delete this entire ward"
                  >
                    <Trash2 size={12} /> Delete Ward
                  </button>
                </div>
              </div>

              {/* Editable Ward Parameters */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ward Name:</span>
                  <input
                    className="form-input"
                    style={{ height: 30, fontSize: '0.8rem', marginTop: 2 }}
                    value={r.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRooms((list) => list.map((item, idx) => (idx === rIdx ? { ...item, name: val } : item)));
                    }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Code / Prefix:</span>
                  <input
                    className="form-input"
                    style={{ height: 30, fontSize: '0.8rem', marginTop: 2 }}
                    value={r.roomCode || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRooms((list) => list.map((item, idx) => (idx === rIdx ? { ...item, roomCode: val } : item)));
                    }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ward Type:</span>
                  <select
                    className="form-select"
                    style={{ height: 30, fontSize: '0.8rem', marginTop: 2 }}
                    value={r.type || 'GENERAL'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRooms((list) => list.map((item, idx) => (idx === rIdx ? { ...item, type: val } : item)));
                    }}
                  >
                    <option value="GENERAL">General Ward</option>
                    <option value="ICU">ICU / Critical Care</option>
                    <option value="SEMI_PRIVATE">Semi-Private</option>
                    <option value="PRIVATE">Private Room</option>
                    <option value="DELUXE">Deluxe Suite</option>
                    <option value="DAY_CARE">Day Care</option>
                    <option value="POST_OP">Post-Operative</option>
                    <option value="PEDIATRIC">Pediatric</option>
                  </select>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Daily Rate (₹):</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ height: 30, fontSize: '0.8rem', marginTop: 2 }}
                    value={r.dailyRate || 500}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setRooms((list) => list.map((item, idx) => (idx === rIdx ? { ...item, dailyRate: val } : item)));
                    }}
                  />
                </div>
              </div>

              {/* Physical Beds Grid - Editable Serial Numbers */}
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Physical Bed Roll / Serial Numbers ({r.beds?.length || 0}):
                </div>

                {(!r.beds || r.beds.length === 0) ? (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                    No beds added yet. Click &quot;+ Add Bed&quot; or &quot;Set Count&quot; above to add real beds.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                      gap: 6,
                    }}
                  >
                    {r.beds.map((b, bIdx) => (
                      <div
                        key={b.id || bIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: 'var(--surface-0)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '3px 6px',
                          gap: 4,
                        }}
                      >
                        <Bed size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <input
                          style={{
                            border: 'none',
                            background: 'transparent',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            width: '100%',
                            outline: 'none',
                            color: 'var(--text-primary)',
                          }}
                          value={b.bedNumber}
                          title="Physical bed serial number marked on real bed"
                          onChange={(e) => {
                            const val = e.target.value;
                            setRooms((list) =>
                              list.map((roomItem, ri) => {
                                if (ri !== rIdx) return roomItem;
                                const updatedBeds = (roomItem.beds || []).map((bedItem, bi) =>
                                  bi === bIdx ? { ...bedItem, bedNumber: val } : bedItem
                                );
                                return { ...roomItem, beds: updatedBeds };
                              })
                            );
                          }}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ padding: 1, color: 'var(--red)', flexShrink: 0 }}
                          title="Remove this bed"
                          onClick={() => handleRemoveBed(rIdx, bIdx)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Save Bar */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {rooms.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={handleClearAllRooms}
            >
              <Trash2 size={12} /> Clear All Wards &amp; Beds
            </button>
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Changes are saved directly to your clinic database.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveAll}
          disabled={isSaving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Save size={15} />
          {isSaving ? 'Saving Changes...' : 'Save Rooms & Beds'}
        </button>
      </div>
    </div>
  );
}
