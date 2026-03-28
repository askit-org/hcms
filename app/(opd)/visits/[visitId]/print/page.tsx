'use client';

import { useEffect, useState, use } from 'react';
import { useVisit, usePatient, useSettings } from '@/lib/hooks/useQueries';
import { Printer } from 'lucide-react';

export default function PrintRxPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = use(params);
  const { data: visit, isLoading: visitLoading } = useVisit(parseInt(visitId));
  const { data: patient, isLoading: patientLoading } = usePatient(visit?.patientId || '');
  const { data: settings, isLoading: settingsLoading } = useSettings();

  const clinic = {
    doctorName: settings?.doctorName || 'Dr. Name',
    clinicName: settings?.clinicName || 'Clinic Name',
    degree: settings?.degree || '',
    address: settings?.address || '',
    phone: settings?.phone || '',
    regNo: settings?.regNo || ''
  };

  useEffect(() => {
    if (visit && patient && settings) window.print();
  }, [visit, patient, settings]);

  if (!visit || !patient) return <div style={{ padding: 40, color: '#888', textAlign: 'center' }}>Loading prescription…</div>;

  const age = patient.age || (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '');

  return (
    <div>
      <div className="no-print" style={{ padding: '16px 24px', display: 'flex', gap: 10, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Prescription</button>
        <button className="btn btn-ghost" onClick={() => history.back()}>← Back</button>
      </div>

      <div style={{ padding: '20px', background: '#f1f5f9', minHeight: '100vh' }}>
        <div className="prescription-sheet" id="prescription">
          {/* Header */}
          <div className="rx-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2>{clinic.doctorName}</h2>
                <p>{clinic.degree}</p>
                <p style={{ marginTop: 4 }}>{clinic.clinicName}</p>
              </div>
              <div style={{ textAlign: 'right', opacity: 0.85, fontSize: '0.8rem' }}>
                {clinic.address && <p>{clinic.address}</p>}
                {clinic.phone && <p>📞 {clinic.phone}</p>}
                {clinic.regNo && <p>Reg. No: {clinic.regNo}</p>}
              </div>
            </div>
          </div>

          <div className="rx-body">
            {/* Patient Info */}
            <div className="rx-patient-info">
              <div className="rx-info-item">
                <div className="rx-info-label">Patient Name</div>
                <div className="rx-info-value">{patient.name}</div>
              </div>
              <div className="rx-info-item">
                <div className="rx-info-label">Patient ID</div>
                <div className="rx-info-value">{patient.patientId}</div>
              </div>
              <div className="rx-info-item">
                <div className="rx-info-label">Age / Gender</div>
                <div className="rx-info-value">{age}y / {patient.gender}</div>
              </div>
              <div className="rx-info-item">
                <div className="rx-info-label">Date</div>
                <div className="rx-info-value">{new Date(visit.date).toLocaleDateString('en-IN')}</div>
              </div>
              <div className="rx-info-item">
                <div className="rx-info-label">Mobile</div>
                <div className="rx-info-value">{patient.mobile}</div>
              </div>
              {visit.bp && <div className="rx-info-item">
                <div className="rx-info-label">BP / Pulse</div>
                <div className="rx-info-value">{visit.bp} / {visit.pulse}</div>
              </div>}
            </div>

            {/* Diagnosis */}
            {(visit.chiefComplaints || visit.diagnosis) && (
              <div style={{ marginBottom: 16 }}>
                {visit.chiefComplaints && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>C/C: </span>
                    <span>{visit.chiefComplaints}</span>
                  </div>
                )}
                {visit.diagnosis && (
                  <div>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Dx: </span>
                    <span style={{ fontWeight: 600 }}>{visit.diagnosis}</span>
                  </div>
                )}
              </div>
            )}

            {/* Medicines */}
            {visit.medicines && visit.medicines.length > 0 && (
              <div className="rx-medicines">
                <div className="rx-symbol">℞</div>
                <div style={{ overflow: 'hidden' }}>
                  {visit.medicines.map((m, i) => (
                    <div key={i} className="rx-med-row">
                      <span className="rx-med-num">{i + 1}.</span>
                      <span className="rx-med-name">{m.name}</span>
                      <span className="rx-med-dose">{m.dose} × {m.duration}</span>
                      {m.instructions && <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: 6 }}>({m.instructions})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {visit.prescriptionNotes && (
              <div style={{ marginTop: 14, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', borderLeft: '3px solid #0d9488' }}>
                <strong style={{ color: '#0d9488' }}>Advice: </strong>
                <span style={{ color: '#334155' }}>{visit.prescriptionNotes}</span>
              </div>
            )}

            {/* Follow-up */}
            {visit.followUpDate && (
              <div style={{ marginTop: 12, fontWeight: 600, color: '#0d9488', fontSize: '0.9rem' }}>
                📅 Next Visit: {new Date(visit.followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}

            {/* Footer */}
            <div className="rx-footer">
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {new Date(visit.date).toLocaleString('en-IN')}
              </div>
              <div style={{ fontWeight: 700, color: '#0d9488', fontSize: '0.9rem' }}>
                Signature & Stamp
                <div style={{ width: 120, borderBottom: '1px solid #cbd5e1', marginTop: 20 }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
