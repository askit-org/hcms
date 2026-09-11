/**
 * OPD Queue API Contract Specification
 * 
 * Existing APIs integrated in frontend:
 * 1. POST /api/patients -> Register new patient
 * 2. GET /api/patients -> Search / list existing patients
 * 3. GET /visits/new?patientId={patientId} -> Start OPD Visit (Prescription form)
 * 
 * Proposed Queue Endpoints for backend implementation:
 * - GET /api/queue -> Fetch active queue for clinic room
 * - POST /api/queue/enqueue -> Add patient to queue
 * - POST /api/queue/call-next -> Call next FIFO patient
 * - PATCH /api/queue/:id/status -> Update status (NOW_SERVING, COMPLETED, SKIPPED)
 * - DELETE /api/queue/:id -> Remove patient from queue
 */

export interface EnqueueRequestPayload {
  patientId: string;
  reason?: string;
  category?: 'Consultation' | 'Follow-up' | 'Emergency' | 'Walk-in';
  priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  vitals?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
  };
}

export interface UpdateQueueStatusPayload {
  status: 'NOW_SERVING' | 'NEXT_IN_LINE' | 'WAITING' | 'COMPLETED' | 'SKIPPED';
  inRoomSince?: string;
  chamberNo?: string;
}

export interface QueueItemContract {
  id: string;
  tokenNo: number;
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  mobile: string;
  reason: string;
  category: 'Consultation' | 'Follow-up' | 'Emergency' | 'Walk-in';
  status: 'NOW_SERVING' | 'NEXT_IN_LINE' | 'WAITING' | 'COMPLETED' | 'SKIPPED';
  priority: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  vitals?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
  };
  queuedAt: string;
  inRoomSince?: string;
  estimatedTurn?: string;
}

// Contract Endpoint Definitions
export const QUEUE_API_ENDPOINTS = {
  getQueue: {
    method: 'GET',
    path: '/api/queue',
    description: 'Fetch today active OPD queue items sorted by tokenNo / priority',
  },
  enqueue: {
    method: 'POST',
    path: '/api/queue/enqueue',
    description: 'Enqueue a patient into live queue',
  },
  callNext: {
    method: 'POST',
    path: '/api/queue/call-next',
    description: 'Call next FIFO patient into doctor chamber',
  },
  updateStatus: {
    method: 'PATCH',
    path: '/api/queue/:id/status',
    description: 'Update status of queue item (NOW_SERVING, COMPLETED, SKIPPED)',
  },
  removeFromQueue: {
    method: 'DELETE',
    path: '/api/queue/:id',
    description: 'Remove item from queue',
  },
};
