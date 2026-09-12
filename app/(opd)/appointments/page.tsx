'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock, Users, UserPlus, Stethoscope, Search,
  X, Volume2, Trash2, GripVertical, Plus, AlertCircle,
  ChevronUp, ChevronDown, History
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { usePatients, usePatientMutations, useQueue, useQueueMutations } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { toast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/utils/error';
import PageTransition from '@/components/PageTransition';
import { patientSchema, validateForm } from '@/lib/validations/schemas';

export interface QueueItem {
  id: string;
  tokenNo: number;
  patientId: string;
  patientName: string;
  age?: number;
  gender?: string;
  mobile: string;
  reason?: string;
  category?: 'Consultation' | 'Follow-up' | 'Emergency' | 'Walk-in';
  status: 'NOW_SERVING' | 'NEXT_IN_LINE' | 'WAITING' | 'COMPLETED' | 'SKIPPED';
  priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  queuedAt: string;
  inRoomSince?: string;
  estimatedTurn?: string;
}

export interface CanvasPatient {
  patientId: string;
  name: string;
  age?: number;
  gender?: string;
  mobile: string;
  reason?: string;
  category?: 'Consultation' | 'Follow-up' | 'Emergency' | 'Walk-in';
}

const COMMON_CONDITIONS = [
  'Hypertension (BP)',
  'Diabetes (Sugar)',
  'Asthma',
  'Thyroid',
  'Heart Disease',
  'Allergies',
];

import { useEffect } from 'react';

interface QueueReorderItemCardProps {
  item: QueueItem;
  index: number;
  totalCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStartVisit: (item: QueueItem) => void;
  onComplete: (id: string, name: string) => void;
  onRemove: (id: string, name: string) => void;
  onMoveItem: (index: number, dir: 'UP' | 'DOWN') => void;
  isDoctorOrSuperAdmin: boolean;
}

function QueueReorderItemCard({
  item,
  index,
  totalCount,
  isExpanded,
  onToggleExpand,
  onStartVisit,
  onComplete,
  onRemove,
  onMoveItem,
  isDoctorOrSuperAdmin,
}: QueueReorderItemCardProps) {
  const router = useRouter();
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      id={item.id}
      dragListener={false}
      dragControls={dragControls}
      style={{ position: 'relative', listStyle: 'none', marginBottom: 10, width: '100%' }}
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
        zIndex: 999,
      }}
    >
      <div
        onClick={onToggleExpand}
        style={{
          background: 'var(--surface-2)',
          borderLeft:
            item.status === 'NEXT_IN_LINE'
              ? '4px solid var(--accent)'
              : item.priority === 'EMERGENCY'
              ? '4px solid var(--red)'
              : '4px solid var(--border)',
          borderTop: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          minHeight: 74,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* MINIMIZED STATE — RESPONSIVE FLEX LAYOUT */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {/* Left: Drag Handle, Token Badge & Patient Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
            {/* Drag Handle & Up/Down Move Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span
                onPointerDown={(e) => dragControls.start(e)}
                onTouchStart={(e) => dragControls.start(e as any)}
                style={{
                  color: 'var(--text-muted)',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 2px',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                title="Hold & drag card up or down to reorder queue"
              >
                <GripVertical size={18} />
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveItem(index, 'UP')}
                  title="Move Up in Queue"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    width: 22,
                    height: 22,
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                    opacity: index === 0 ? 0.3 : 1,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={index === totalCount - 1}
                  onClick={() => onMoveItem(index, 'DOWN')}
                  title="Move Down in Queue"
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    width: 22,
                    height: 22,
                    cursor: index === totalCount - 1 ? 'not-allowed' : 'pointer',
                    opacity: index === totalCount - 1 ? 0.3 : 1,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>

            {/* Token Badge */}
            <div
              style={{
                background: item.status === 'NEXT_IN_LINE' ? 'var(--accent-glow)' : 'var(--surface-3)',
                color: item.status === 'NEXT_IN_LINE' ? 'var(--accent)' : 'var(--text-primary)',
                border: item.status === 'NEXT_IN_LINE' ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 10,
                width: 58,
                height: 46,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                lineHeight: 1.1,
              }}
            >
              <span style={{ fontSize: '0.6rem', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)' }}>
                Token
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 900, marginTop: 1 }}>
                #{item.tokenNo < 10 ? `0${item.tokenNo}` : item.tokenNo}
              </span>
            </div>

            {/* Patient Info */}
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.patientName}
                </h4>
                {item.age ? (
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                    ({item.age}{item.gender ? item.gender.charAt(0) : ''})
                  </span>
                ) : null}
                {item.status === 'NEXT_IN_LINE' && (
                  <span className="badge badge-teal" style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>
                    Next In Line
                  </span>
                )}
                {item.priority === 'EMERGENCY' && (
                  <span className="badge badge-red" style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 6px', flexShrink: 0 }}>
                    Priority Emergency
                  </span>
                )}
              </div>
              {!isExpanded && (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>UHID: {item.patientId}</span>
                  {item.mobile && <span>• {item.mobile}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Right Action Buttons (Wraps cleanly on mobile) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {isDoctorOrSuperAdmin && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/patients/${item.patientId}`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: '0.74rem',
                    padding: '5px 10px',
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: 8,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                  title="View patient's past visit history"
                >
                  <History size={13} /> Visit History
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartVisit(item);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.74rem', padding: '5px 10px', background: 'var(--accent)', color: '#ffffff', fontWeight: 800, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                >
                  <Stethoscope size={13} /> Start Visit
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete(item.id, item.patientName);
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.74rem', padding: '5px 10px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              ✓ Complete
            </button>
          </div>
        </div>

        {/* EXPANDED DETAILS PANEL */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)', overflow: 'hidden' }}
            >
              {item.reason && (
                <div style={{ background: 'var(--surface-3)', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Chief Complaints:</strong> {item.reason}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', color: 'var(--red)', borderRadius: 8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id, item.patientName);
                  }}
                >
                  <Trash2 size={12} /> Remove
                </button>

                {isDoctorOrSuperAdmin && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/patients/${item.patientId}`);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem', fontWeight: 700, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <History size={14} /> Visit History
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartVisit(item);
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.78rem', fontWeight: 800, background: 'linear-gradient(135deg, var(--accent), #10b981)', borderRadius: 8 }}
                    >
                      <Stethoscope size={14} /> Start Visit & Write Rx →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  );
}

export default function AppointmentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSuperAdmin, hasPermission } = usePermissions();

  // Evaluate role and permissions directly from authenticated user
  const userRoleCode = (user?.roleCode || user?.role || '').toString().toUpperCase();
  const roleNameLower = (user?.roleName || '').toLowerCase();
  const isReceptionist = userRoleCode === 'RECEPTIONIST' || roleNameLower.includes('receptionist');
  const isDoctor = !isReceptionist && (userRoleCode === 'DOCTOR' || roleNameLower.includes('doctor'));
  const isDoctorOrSuperAdmin = !isReceptionist && (isSuperAdmin || isDoctor || userRoleCode === 'SUPER_ADMIN' || roleNameLower.includes('admin'));
  
  // Registration is allowed if user can create patients and is not in doctor-only view
  const canRegister = !isDoctorOrSuperAdmin && hasPermission('PATIENTS', 'canCreate');

  // Real API hooks for fetching and creating patients
  const { data: dbPatients = [] } = usePatients();
  const { create: createPatientMut } = usePatientMutations();

  // Real API hooks for Live OPD Queue persistence
  const { data: dbQueue, refetch: refetchQueue } = useQueue();
  const { enqueue: enqueueMut, callNext: callNextMut, updateStatus: updateStatusMut, removeFromQueue: removeMut, reorderQueue: reorderMut } = useQueueMutations();

  // Local queue state for instant optimistic updates during drag and drop
  const [localQueue, setLocalQueue] = useState<QueueItem[]>([]);

  // Sync live dbQueue into localQueue whenever API queue data updates
  useEffect(() => {
    if (Array.isArray(dbQueue)) {
      setLocalQueue(dbQueue as QueueItem[]);
    }
  }, [dbQueue]);

  const queue: QueueItem[] = useMemo(() => {
    if (localQueue.length > 0) return localQueue;
    if (Array.isArray(dbQueue)) return dbQueue as QueueItem[];
    return localQueue;
  }, [dbQueue, localQueue]);

  // Refetch live queue data immediately on component mount
  useEffect(() => {
    refetchQueue();
  }, [refetchQueue]);

  // Selected Patients Canvas Board
  const [canvasPatients, setCanvasPatients] = useState<CanvasPatient[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Card hover & drag states
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isDraggingOverQueue, setIsDraggingOverQueue] = useState(false);

  // Queue card drag-and-drop reorder state
  const [draggedQueueId, setDraggedQueueId] = useState<string | null>(null);
  const [dragOverQueueId, setDragOverQueueId] = useState<string | null>(null);

  // Touch drag states for mobile screens
  const [touchCanvasPatient, setTouchCanvasPatient] = useState<CanvasPatient | null>(null);
  const [touchQueueItemId, setTouchQueueItemId] = useState<string | null>(null);

  // Registration Modal state (matching /patients/new)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    dob: '',
    age: '',
    gender: 'Male',
    mobile: '',
    abhaNumber: '',
    address: '',
    occupation: '',
    reason: '',
    category: 'Consultation' as 'Consultation' | 'Follow-up' | 'Emergency' | 'Walk-in',
  });
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  // Derived queue state
  const nowServing = useMemo(() => queue.find((q) => q.status === 'NOW_SERVING'), [queue]);
  const waitingList = useMemo(() => queue.filter((q) => q.status === 'NEXT_IN_LINE' || q.status === 'WAITING'), [queue]);
  const maxTokenNo = useMemo(() => (queue.length === 0 ? 0 : Math.max(...queue.map((q) => q.tokenNo))), [queue]);

  // Real API Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return dbPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.patientId.toLowerCase().includes(q) ||
        p.mobile.includes(q)
    ).slice(0, 8);
  }, [searchQuery, dbPatients]);

  // DOB Change Auto-calculates Age
  const handleDobChange = (dobValue: string) => {
    let computedAge = newPatientForm.age;
    if (dobValue) {
      const birthDate = new Date(dobValue);
      const today = new Date();
      let calcAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calcAge--;
      }
      if (calcAge >= 0 && calcAge <= 120) {
        computedAge = String(calcAge);
      }
    }
    setNewPatientForm(f => ({ ...f, dob: dobValue, age: computedAge }));
    if (formErrors.dob || formErrors.age) {
      setFormErrors(e => {
        const copy = { ...e };
        delete copy.dob;
        delete copy.age;
        return copy;
      });
    }
  };

  const toggleCondition = (cond: string) => {
    setSelectedConditions(prev =>
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  // Select patient from API search and place on Canvas Board
  const handleSelectPatientFromSearch = (p: (typeof dbPatients)[0]) => {
    const existingInCanvas = canvasPatients.find((c) => c.patientId === p.patientId);
    if (existingInCanvas) {
      toast(`${p.name} is already selected!`, 'info');
    } else {
      const newCanvasItem: CanvasPatient = {
        patientId: p.patientId,
        name: p.name,
        age: p.age,
        gender: p.gender,
        mobile: p.mobile,
        reason: 'OPD Consultation',
        category: 'Consultation',
      };
      setCanvasPatients((prev) => [newCanvasItem, ...prev]);
      toast(`Selected ${p.name}. Added to Canvas Board!`, 'success');
    }
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // Add new patient via Real API (/api/patients)
  const handleCreateNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, errors } = await validateForm(patientSchema, newPatientForm);
    if (!isValid) {
      const typedErrors = errors as Record<string, string>;
      setFormErrors(typedErrors);
      const firstErrorField = Object.keys(typedErrors)[0];
      if (firstErrorField && typedErrors[firstErrorField]) {
        toast(typedErrors[firstErrorField], 'error');
      }
      return;
    }

    setSavingPatient(true);
    try {
      // Real API Call: POST /api/patients
      const res = await createPatientMut.mutateAsync({
        name: newPatientForm.name.trim(),
        age: newPatientForm.age ? Math.abs(parseInt(newPatientForm.age, 10)) : undefined,
        dob: newPatientForm.dob || undefined,
        gender: newPatientForm.gender,
        mobile: newPatientForm.mobile.trim(),
        address: newPatientForm.address.trim() || undefined,
        occupation: newPatientForm.occupation.trim() || undefined,
        abhaNumber: newPatientForm.abhaNumber.trim() || undefined,
        permanentConditions: selectedConditions,
        createdAt: new Date().toISOString(),
      } as any);

      const generatedId = (res as any)?.patientId || `PT-2026-${Math.floor(100 + Math.random() * 900)}`;

      const newCanvasItem: CanvasPatient = {
        patientId: generatedId,
        name: newPatientForm.name.trim(),
        age: newPatientForm.age ? parseInt(newPatientForm.age, 10) : undefined,
        gender: newPatientForm.gender,
        mobile: newPatientForm.mobile.trim(),
        reason: newPatientForm.reason.trim() || undefined,
        category: newPatientForm.category,
      };

      setCanvasPatients((prev) => [newCanvasItem, ...prev]);
      setShowAddPatientModal(false);
      setNewPatientForm({
        name: '',
        dob: '',
        age: '',
        gender: 'Male',
        mobile: '',
        abhaNumber: '',
        address: '',
        occupation: '',
        reason: '',
        category: 'Consultation',
      });
      setSelectedConditions([]);
      setFormErrors({});
      toast(`🎉 Registered ${newCanvasItem.name}! Card added to Canvas Board.`, 'success');
    } catch (err: any) {
      toast(getErrorMessage(err, 'Failed to register patient.'), 'error');
    } finally {
      setSavingPatient(false);
    }
  };

  // Enqueue patient onto Live Queue
  const handleEnqueuePatient = async (patient: CanvasPatient) => {
    const newTokenNo = maxTokenNo + 1;
    const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const isFirstInQueue = waitingList.length === 0 && !nowServing;

    try {
      await enqueueMut.mutateAsync({
        patientId: patient.patientId,
        patientName: patient.name,
        age: patient.age,
        gender: patient.gender,
        mobile: patient.mobile,
        reason: patient.reason,
        category: patient.category,
      });
    } catch (_) {
      const newQueueItem: QueueItem = {
        id: `q-${Date.now()}`,
        tokenNo: newTokenNo,
        patientId: patient.patientId,
        patientName: patient.name,
        age: patient.age,
        gender: patient.gender,
        mobile: patient.mobile,
        reason: patient.reason,
        category: patient.category,
        status: isFirstInQueue ? 'NOW_SERVING' : waitingList.length === 0 ? 'NEXT_IN_LINE' : 'WAITING',
        priority: patient.category === 'Emergency' ? 'EMERGENCY' : 'NORMAL',
        queuedAt: nowStr,
        estimatedTurn: isFirstInQueue ? 'In Session' : `~${nowStr}`,
      };
      setLocalQueue((prev) => [...prev, newQueueItem]);
    }

    setCanvasPatients((prev) => prev.filter((c) => c.patientId !== patient.patientId));
    toast(`🎉 ${patient.name} enqueued into Queue as Token #${newTokenNo}!`, 'success');
  };

  // Call Next FIFO Patient
  const handleCallNextPatient = async () => {
    if (waitingList.length === 0) {
      toast('No patients currently waiting in queue.', 'info');
      return;
    }

    const nextPatient = waitingList[0];

    try {
      await callNextMut.mutateAsync();
    } catch (_) {
      setLocalQueue((prevQueue) => {
        const updated: QueueItem[] = prevQueue.map((item) => {
          if (item.status === 'NOW_SERVING') {
            return { ...item, status: 'COMPLETED' as const };
          }
          if (item.id === nextPatient.id) {
            return {
              ...item,
              status: 'NOW_SERVING' as const,
              inRoomSince: 'Just Called',
              estimatedTurn: 'In Session',
            };
          }
          return item;
        });

        const firstWaitingIndex = updated.findIndex((x) => x.status === 'WAITING');
        if (firstWaitingIndex !== -1) {
          updated[firstWaitingIndex] = { ...updated[firstWaitingIndex], status: 'NEXT_IN_LINE' as const };
        }

        return updated;
      });
    }

    toast(`🔔 Called Token #${nextPatient.tokenNo} (${nextPatient.patientName}) for Consultation`, 'success');
  };

  // Doctor Action: Start Visit & Navigate to /visits/new?patientId=...
  const handleStartVisitAndNavigate = async (item: QueueItem) => {
    try {
      await updateStatusMut.mutateAsync({ id: item.id, status: 'NOW_SERVING', inRoomSince: 'Just Started' });
    } catch (_) {
      setLocalQueue((prev) =>
        prev.map((q) => {
          if (q.status === 'NOW_SERVING') return { ...q, status: 'COMPLETED' };
          if (q.id === item.id) return { ...q, status: 'NOW_SERVING', inRoomSince: 'Just Started', estimatedTurn: 'In Session' };
          return q;
        })
      );
    }
    toast(`🚀 Starting visit for Token #${item.tokenNo} (${item.patientName})...`, 'success');
    router.push(`/visits/new?patientId=${item.patientId}`);
  };

  // Mark Appointment Completed & Pop from Queue
  const handleCompleteAppointment = async (id: string, name: string) => {
    try {
      await updateStatusMut.mutateAsync({ id, status: 'COMPLETED' });
      await removeMut.mutateAsync(id);
    } catch (_) {
      setLocalQueue((prev) => prev.filter((q) => q.id !== id));
    }
    toast(`✅ Marked appointment completed for ${name}!`, 'success');
  };

  // Remove patient from queue
  const handleRemoveFromQueue = async (id: string, name: string) => {
    try {
      await removeMut.mutateAsync(id);
    } catch (_) {
      setLocalQueue((prev) => prev.filter((q) => q.id !== id));
    }
    toast(`Removed ${name} from queue.`, 'info');
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, patient: CanvasPatient) => {
    e.dataTransfer.setData('application/json', JSON.stringify(patient));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOverQueue = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingOverQueue(true);
  };

  const handleDragLeaveQueue = () => {
    setIsDraggingOverQueue(false);
  };

  const handleDropOnQueue = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverQueue(false);
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const patient: CanvasPatient = JSON.parse(dataStr);
        handleEnqueuePatient(patient);
      }
    } catch (_) {}
  };

  // Handle Reordering Queue Sequence (Persisted via API)
  const handleReorderQueue = async (reorderedWaiting: QueueItem[]) => {
    const activeNowServing = queue.filter((q) => q.status === 'NOW_SERVING');
    const completedItems = queue.filter((q) => q.status === 'COMPLETED');

    const updatedWaiting = reorderedWaiting.map((item, idx) => ({
      ...item,
      status: (idx === 0 ? 'NEXT_IN_LINE' : 'WAITING') as 'NEXT_IN_LINE' | 'WAITING',
    }));

    const newFullQueue = [...activeNowServing, ...updatedWaiting, ...completedItems];
    setLocalQueue(newFullQueue);

    const orderedIds = updatedWaiting.map((w) => w.id);
    try {
      await reorderMut.mutateAsync(orderedIds);
      toast('Queue sequence reordered!', 'success');
    } catch (err) {
      toast(getErrorMessage(err, 'Failed to reorder queue.'), 'error');
      refetchQueue();
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= waitingList.length) return;

    const currentWaiting = [...waitingList];
    const [moved] = currentWaiting.splice(index, 1);
    currentWaiting.splice(targetIndex, 0, moved);

    handleReorderQueue(currentWaiting);
  };

  // Canvas Mobile Touch Drag
  const handleCanvasTouchStart = (patient: CanvasPatient) => {
    setTouchCanvasPatient(patient);
    setIsDraggingOverQueue(true);
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (!touchCanvasPatient) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = document.getElementById('queue-dropzone-container');
    if (dropZone && targetEl && dropZone.contains(targetEl)) {
      setIsDraggingOverQueue(true);
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent) => {
    setIsDraggingOverQueue(false);
    if (!touchCanvasPatient) return;
    const touch = e.changedTouches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = document.getElementById('queue-dropzone-container');

    if (dropZone && targetEl && dropZone.contains(targetEl)) {
      handleEnqueuePatient(touchCanvasPatient);
    }
    setTouchCanvasPatient(null);
  };

  // Queue Card Desktop & Touch Drag Handlers
  const handleQueueDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/queue-id', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedQueueId(id);
  };

  const handleQueueDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverQueueId !== targetId) {
      setDragOverQueueId(targetId);
    }
  };

  const handleQueueDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverQueueId(null);
    const sourceId = e.dataTransfer.getData('text/queue-id') || draggedQueueId;
    setDraggedQueueId(null);
    if (!sourceId || sourceId === targetId) return;

    const currentWaiting = [...waitingList];
    const fromIdx = currentWaiting.findIndex((item) => item.id === sourceId);
    const toIdx = currentWaiting.findIndex((item) => item.id === targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = currentWaiting.splice(fromIdx, 1);
      currentWaiting.splice(toIdx, 0, moved);
      handleReorderQueue(currentWaiting);
    }
  };

  const handleQueueTouchStart = (id: string) => {
    setTouchQueueItemId(id);
    setDraggedQueueId(id);
  };

  const handleQueueTouchMove = (e: React.TouchEvent) => {
    if (!touchQueueItemId) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const itemEl = el.closest('[data-queue-id]');
      if (itemEl) {
        const targetId = itemEl.getAttribute('data-queue-id');
        if (targetId && targetId !== dragOverQueueId) {
          setDragOverQueueId(targetId);
        }
      }
    }
  };

  const handleQueueTouchEnd = () => {
    if (touchQueueItemId && dragOverQueueId && touchQueueItemId !== dragOverQueueId) {
      const currentWaiting = [...waitingList];
      const fromIdx = currentWaiting.findIndex((x) => x.id === touchQueueItemId);
      const toIdx = currentWaiting.findIndex((x) => x.id === dragOverQueueId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = currentWaiting.splice(fromIdx, 1);
        currentWaiting.splice(toIdx, 0, moved);
        handleReorderQueue(currentWaiting);
      }
    }
    setTouchQueueItemId(null);
    setDraggedQueueId(null);
    setDragOverQueueId(null);
  };

  return (
    <PageTransition className="appointments-page-container">
      {/* Clean Page Title */}
      <div className="page-header" style={{ marginBottom: 14, flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            {isDoctorOrSuperAdmin ? 'Doctor Live OPD Queue' : 'Appointments & Live Queue'}
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 status-pulse-dot inline-block" title="Live queue active" />
          </h1>
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            {isDoctorOrSuperAdmin
              ? 'Sequential FIFO OPD consultation queue. One-click "Start Visit" launches consultation.'
              : 'Search & select patients on left canvas board • Enqueue onto live FIFO queue board on right'}
          </p>
        </div>
      </div>

      {/* ── LAYOUT (RESPONSIVE GRID FOR DESKTOP AND MOBILE) ─── */}
      <div className={`appointments-layout-grid ${isDoctorOrSuperAdmin ? 'doctor-only' : ''}`}>
        
        {/* ======================================================== */}
        {/* BOX 1 (LEFT 50% ON DESKTOP, STACKED ON MOBILE)            */}
        {/* SHOWN ONLY TO RECEPTIONIST USERS                         */}
        {/* ======================================================== */}
        {!isDoctorOrSuperAdmin && (
          <div className="appointments-box" style={{ gap: 14 }}>
          
          {/* SEARCH & REGISTER HEADER BOX */}
          <div
            className="card"
            style={{
              flexShrink: 0,
              background: 'var(--surface-solid)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={16} color="var(--accent)" /> Patient Search
              </h2>

              {/* + NEW PATIENT BUTTON: SHOWN ONLY IF LOGGED IN USER HAS REGISTRATION PERMISSIONS */}
              {canRegister && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddPatientModal(true)}
                  style={{ fontSize: '0.78rem', padding: '5px 12px', background: 'linear-gradient(135deg, var(--accent), var(--accent-light))' }}
                >
                  <UserPlus size={14} /> + New Patient
                </button>
              )}
            </div>

            {/* Search Input with Auto-complete Dropdown */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 36, fontSize: '0.85rem', height: 40 }}
                placeholder="Search patient by Name, UHID, or Phone..."
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search
                size={16}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}

              {/* Search Results Dropdown */}
              {isSearchFocused && searchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 6,
                    background: 'var(--surface-solid)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    boxShadow: 'var(--modal-shadow)',
                    zIndex: 100,
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}
                >
                  {searchResults.map((p) => (
                    <div
                      key={p.patientId}
                      onClick={() => handleSelectPatientFromSearch(p)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          UHID: {p.patientId} • {p.mobile}
                        </div>
                      </div>
                      <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>+ Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CANVAS BOARD CONTAINER */}
          <div
            className="card"
            style={{
              flex: 1,
              minHeight: 0,
              background: 'var(--surface-solid)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="var(--accent)" /> Selected Patients Canvas
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Drag cards onto the queue box to enqueue into live OPD queue
                </p>
              </div>
            </div>

              {/* Draggable Cards List Container (Scrollable) */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                <AnimatePresence>
                  {canvasPatients.map((patient) => (
                    <motion.div
                      key={patient.patientId}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, patient)}
                      onTouchStart={() => handleCanvasTouchStart(patient)}
                      onTouchMove={handleCanvasTouchMove}
                      onTouchEnd={handleCanvasTouchEnd}
                      style={{
                        flexShrink: 0,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: 14,
                        cursor: 'grab',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        touchAction: 'none',
                      }}
                      whileHover={{ borderColor: 'var(--accent)', translateY: -2, boxShadow: '0 8px 20px rgba(13,148,136,0.15)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ color: 'var(--text-muted)', cursor: 'grab' }} title="Drag card into queue">
                            <GripVertical size={16} />
                          </span>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: 'var(--accent-glow)',
                              color: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              border: '1px solid var(--accent)',
                            }}
                          >
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {patient.name} {patient.age ? <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)' }}>({patient.age}{patient.gender ? patient.gender.charAt(0) : ''})</span> : null}
                            </h3>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              UHID: {patient.patientId} • {patient.mobile}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {patient.category && <span className="badge badge-teal" style={{ fontSize: '0.7rem' }}>{patient.category}</span>}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnqueuePatient(patient);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              padding: '4px 10px',
                              background: 'linear-gradient(135deg, var(--accent), #10b981)',
                              border: 'none',
                              borderRadius: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Plus size={13} /> Enqueue
                          </button>
                        </div>
                      </div>

                      {patient.reason && (
                        <div style={{ marginTop: 10, background: 'var(--surface-3)', padding: '8px 10px', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <strong>Complaint:</strong> {patient.reason}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

              {canvasPatients.length === 0 && (
                <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Users size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div>No selected patient cards on canvas.</div>
                  <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                    {canRegister ? 'Search for a patient above or click "+ New Patient".' : 'Search for a patient above to select card.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* ======================================================== */}
        {/* BOX 2 (RIGHT 50% ON DESKTOP, STACKED ON MOBILE)           */}
        {/* ======================================================== */}
        <div
          id="queue-dropzone-container"
          className="card appointments-box"
          style={{
            background: 'var(--surface-solid)',
            border: isDraggingOverQueue ? '2px dashed var(--accent)' : '1px solid var(--border)',
            borderRadius: 14,
            padding: 0,
            transition: 'border 0.2s ease',
          }}
          onDragOver={handleDragOverQueue}
          onDragLeave={handleDragLeaveQueue}
          onDrop={handleDropOnQueue}
        >
          {/* Queue Board Header */}
          <div style={{ padding: 14, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Live Consultation Queue — FIFO Stack
                </h2>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Patients visit doctor sequentially in real-time.
              </p>
            </div>

            {/* FIFO Call Next Button (Shown ONLY to Doctor / Super Admin) */}
            {isDoctorOrSuperAdmin && (
              <button
                onClick={handleCallNextPatient}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), #10b981)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  padding: '8px 16px',
                  borderRadius: 10,
                  boxShadow: '0 4px 14px var(--accent-glow)',
                  border: 'none',
                }}
              >
                <Volume2 size={16} /> Call Next Patient
              </button>
            )}
          </div>

          {/* Queue Items Container (Scrollable) */}
          <div style={{ flex: 1, minHeight: 0, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            
            {/* 1. NOW SERVING (Active Patient in Doctor's Chamber) */}
            {nowServing && (
              <div
                style={{
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent-glow), var(--surface-2))',
                  borderLeft: '4px solid var(--accent)',
                  borderTop: '1px solid var(--accent)',
                  borderRight: '1px solid var(--accent)',
                  borderBottom: '1px solid var(--accent)',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 6,
                  boxShadow: '0 6px 18px var(--accent-glow)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 900, borderRadius: 8, padding: '4px 10px', fontSize: '0.88rem', flexShrink: 0 }}>
                      Token #{nowServing.tokenNo < 10 ? `0${nowServing.tokenNo}` : nowServing.tokenNo}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowServing.patientName}</span>
                        {nowServing.age ? <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)', flexShrink: 0 }}>({nowServing.age}{nowServing.gender ? nowServing.gender.charAt(0) : ''})</span> : null}
                        <span className="badge badge-teal" style={{ fontSize: '0.68rem', flexShrink: 0 }}>Currently In Consultation</span>
                      </h3>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>UHID: {nowServing.patientId}</span>
                        {nowServing.mobile && <span>• {nowServing.mobile}</span>}
                        <span>• In Session {nowServing.inRoomSince || 'Just Started'}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                    {isDoctorOrSuperAdmin && (
                      <>
                        <button
                          onClick={() => router.push(`/patients/${nowServing.patientId}`)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '5px 10px',
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderRadius: 8,
                            whiteSpace: 'nowrap',
                          }}
                          title="View patient's past visit history"
                        >
                          <History size={13} /> Visit History
                        </button>

                        <button
                          onClick={() => handleStartVisitAndNavigate(nowServing)}
                          className="btn btn-primary btn-sm"
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            padding: '5px 12px',
                            background: 'linear-gradient(135deg, var(--accent), #10b981)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderRadius: 8,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Stethoscope size={13} /> Start Visit & Write Rx →
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleCompleteAppointment(nowServing.id, nowServing.patientName)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', fontWeight: 800, padding: '5px 10px', background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                    >
                      ✓ Mark Completed
                    </button>
                  </div>
                </div>
                {nowServing.reason && (
                  <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--surface-3)', padding: '6px 12px', borderRadius: 6 }}>
                    <strong>Chief Complaints:</strong> {nowServing.reason}
                  </div>
                )}
              </div>
            )}

            {/* 2. FIFO QUEUE CARDS STACK */}
            <Reorder.Group
              axis="y"
              values={waitingList}
              onReorder={(newOrderedList) => {
                handleReorderQueue(newOrderedList);
              }}
              style={{ padding: 0, margin: 0, listStyle: 'none' }}
            >
              {waitingList.map((item, index) => (
                <QueueReorderItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  totalCount={waitingList.length}
                  isExpanded={expandedCardId === item.id || hoveredCardId === item.id}
                  onToggleExpand={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                  onStartVisit={handleStartVisitAndNavigate}
                  onComplete={handleCompleteAppointment}
                  onRemove={handleRemoveFromQueue}
                  onMoveItem={handleMoveQueueItem}
                  isDoctorOrSuperAdmin={isDoctorOrSuperAdmin}
                />
              ))}
            </Reorder.Group>

            {waitingList.length === 0 && !nowServing && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>Queue Empty</h4>
                <p style={{ margin: 0, fontSize: '0.84rem' }}>Drag patient cards from left box or select a patient to enqueue.</p>
              </div>
            )}

            {/* Interactive Drag & Drop Dropzone */}
            <div
              style={{
                flexShrink: 0,
                border: isDraggingOverQueue ? '2px dashed var(--accent)' : '2px dashed var(--border)',
                background: isDraggingOverQueue ? 'var(--accent-glow)' : 'var(--surface-2)',
                borderRadius: 10,
                padding: 18,
                textAlign: 'center',
                cursor: 'pointer',
                marginTop: 6,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isDraggingOverQueue ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {isDraggingOverQueue ? '✨ Drop patient card here to enqueue!' : 'Drag patient cards here to insert into Queue'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Automatically assigns next sequential Token Number (#{(maxTokenNo + 1) < 10 ? `0${maxTokenNo + 1}` : maxTokenNo + 1})
              </div>
            </div>
          </div>

          {/* Board Footer Status */}
          <div style={{ padding: 12, flexShrink: 0, background: 'var(--surface-2)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div>
              Status: <span style={{ color: nowServing ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700 }}>{nowServing ? 'In Session' : 'Idle'}</span>
            </div>
            <button
              onClick={() => toast('Queue broadcasted to TV display.', 'success')}
              style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: '0.74rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            >
              Broadcast Display ↗
            </button>
          </div>

        </div>

      </div>

      {/* ── NEW PATIENT REGISTRATION MODAL (RENDERED ONLY IF CAN_REGISTER IS TRUE) ─── */}
      <AnimatePresence>
        {canRegister && showAddPatientModal && (
          <div className="modal-overlay" style={{ zIndex: 99999, background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(12px)' }}>
            <motion.div
              className="modal modal-lg"
              style={{ width: '100%', maxWidth: 760, padding: 24, borderRadius: 18 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent-glow)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserPlus size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Register New Patient Card
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Complete patient onboarding (UHID will be auto-generated)
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowAddPatientModal(false)} className="btn-icon">
                  <X size={18} />
                </button>
              </div>

              {/* Patient Registration Form */}
              <form noValidate onSubmit={handleCreateNewPatient} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                  
                  {/* Full Name */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Full Name <span className="required">*</span></label>
                    <input
                      className={`form-input ${formErrors.name ? 'has-error' : ''}`}
                      style={formErrors.name ? { border: '2px solid var(--red)' } : {}}
                      placeholder="e.g. Ramesh Kumar"
                      value={newPatientForm.name}
                      onChange={(e) => {
                        setNewPatientForm({ ...newPatientForm, name: e.target.value });
                        if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                      }}
                    />
                    {formErrors.name && (
                      <div style={{ color: 'var(--red)', fontSize: '0.76rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={13} color="var(--red)" /> {formErrors.name}
                      </div>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div className="form-group">
                    <label className="form-label">Date of Birth <span style={{ color: 'var(--text-muted)' }}>(Auto-calculates age)</span></label>
                    <input
                      type="date"
                      className="form-input"
                      max={new Date().toISOString().split('T')[0]}
                      value={newPatientForm.dob}
                      onChange={(e) => handleDobChange(e.target.value)}
                    />
                  </div>

                  {/* Age */}
                  <div className="form-group">
                    <label className="form-label">Age (years)</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      className="form-input"
                      placeholder="e.g. 45"
                      value={newPatientForm.age}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, age: e.target.value })}
                    />
                  </div>

                  {/* Gender */}
                  <div className="form-group">
                    <label className="form-label">Gender <span className="required">*</span></label>
                    <select
                      className="form-select"
                      value={newPatientForm.gender}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, gender: e.target.value })}
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>

                  {/* Mobile Number */}
                  <div className="form-group">
                    <label className="form-label">Mobile Number <span className="required">*</span></label>
                    <input
                      type="tel"
                      maxLength={10}
                      className={`form-input ${formErrors.mobile ? 'has-error' : ''}`}
                      style={formErrors.mobile ? { border: '2px solid var(--red)' } : {}}
                      placeholder="10-digit mobile number"
                      value={newPatientForm.mobile}
                      onChange={(e) => {
                        setNewPatientForm({ ...newPatientForm, mobile: e.target.value.replace(/\D/g, '') });
                        if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: '' });
                      }}
                    />
                    {formErrors.mobile && (
                      <div style={{ color: 'var(--red)', fontSize: '0.76rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={13} color="var(--red)" /> {formErrors.mobile}
                      </div>
                    )}
                  </div>

                  {/* ABHA Number */}
                  <div className="form-group">
                    <label className="form-label">ABHA Number <span style={{ color: 'var(--text-muted)' }}>(14 digits)</span></label>
                    <input
                      type="text"
                      maxLength={14}
                      className="form-input"
                      placeholder="14-digit ABHA number"
                      value={newPatientForm.abhaNumber}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, abhaNumber: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>

                  {/* OPD Category */}
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={newPatientForm.category}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, category: e.target.value as any })}
                    >
                      <option value="Consultation">OPD Consultation</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Walk-in">Walk-in</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>

                  {/* Address */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Address <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Street, Area, City"
                      value={newPatientForm.address}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, address: e.target.value })}
                    />
                  </div>

                  {/* Chief Complaint / Reason */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Chief Complaint / Reason for OPD Visit</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. High fever, acute headache & dizziness (Day 2)"
                      value={newPatientForm.reason}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, reason: e.target.value })}
                    />
                  </div>

                  {/* Permanent Medical Conditions */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Permanent Medical Conditions & Chronic Diseases</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                      {COMMON_CONDITIONS.map((cond) => {
                        const active = selectedConditions.includes(cond);
                        return (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => toggleCondition(cond)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 20,
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                              background: active ? 'var(--accent-glow)' : 'var(--surface-1)',
                              color: active ? 'var(--accent)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {active ? '✓ ' : '+ '}{cond}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', gap: 12, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddPatientModal(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingPatient}
                    style={{ flex: 1.8, background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', fontWeight: 800 }}
                  >
                    <UserPlus size={16} /> {savingPatient ? 'Registering...' : 'Register Patient & Add Card'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
