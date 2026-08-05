'use client';

import { useEffect, useState, use } from 'react';
import { useVisit, usePatient, useSettings } from '@/lib/hooks/useQueries';
import { Printer, MessageCircle, Share2 } from 'lucide-react';
import { toast } from '@/components/Toast';
import { parseDoseToWords } from '@/lib/medicationInstructions';

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

  // Print prescription when user clicks Print button, not automatically on load

  if (!visit || !patient) return <div style={{ padding: 40, color: '#888', textAlign: 'center' }}>Loading prescription…</div>;

  const age = patient.age || (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '');

  return (
    <div>
      <div className="no-print" style={{ padding: '16px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print Prescription</button>
        <button 
          className="btn" 
          style={{ background: '#25D366', color: '#fff', border: 'none' }}
          onClick={() => {
            const numberEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            const medsText = visit.medicines?.map((m, i) => {
              const emoji = numberEmoji[i] || '💊';
              return `${emoji} *${m.name}*\n   ↳ 🕒 ${m.dose} for ${m.duration}${m.instructions ? `\n   ↳ ℹ️ ${m.instructions}` : ''}`;
            }).join('\n\n') || 'No medicines prescribed.';

            const text = `🏥 *${clinic.clinicName}*\n👨‍⚕️ *${clinic.doctorName}*\n\nHello *${patient.name}*, 👋\nHere is the summary of your prescription visit on *${new Date(visit.date).toLocaleDateString('en-IN')}*.\n\n🩺 *Diagnosis:* \n${visit.diagnosis || 'N/A'}\n\n💊 *Prescribed Medicines:*\n${medsText}\n\n${visit.prescriptionNotes ? `📝 *Doctor's Advice:* \n${visit.prescriptionNotes}\n\n` : ''}${visit.followUpDate ? `📅 *Next Follow-up:* \n${new Date(visit.followUpDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` : ''}_Get well soon!_ 💙`;

            const phone = patient.mobile.replace(/\D/g, '');
            const targetPhone = phone.length === 10 ? `91${phone}` : phone;
            window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`, '_blank');
          }}
        >
          <MessageCircle size={15} /> Send via WhatsApp
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={async () => {
            try {
              toast('Preparing PDF...', 'info');
              const { jsPDF } = await import('jspdf');
              const html2canvas = (await import('html2canvas')).default;
              const element = document.getElementById('prescription');
              if (!element) return;

              const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
              const imgData = canvas.toDataURL('image/png');
              const doc = new jsPDF('p', 'mm', 'a4');
              const pdfWidth = doc.internal.pageSize.getWidth();
              const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
              doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

              const blob = doc.output('blob');
              const fileName = `${patient.name.replace(/\s+/g, '_')}_Prescription.pdf`;
              const file = new File([blob], fileName, { type: 'application/pdf' });

              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: `${patient.name} Prescription`,
                  text: `Prescription PDF for ${patient.name}`,
                });
              } else {
                doc.save(fileName);
                toast('PDF Downloaded successfully!', 'success');
              }
            } catch (err: any) {
              if (err.name !== 'AbortError') {
                toast('Could not generate PDF share.', 'error');
              }
            }
          }}
        >
          <Share2 size={15} /> Share PDF
        </button>
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
              {patient.abhaNumber && <div className="rx-info-item">
                <div className="rx-info-label">ABHA No.</div>
                <div className="rx-info-value">{patient.abhaNumber}</div>
              </div>}
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
              <div className="rx-medicines" style={{ marginTop: 12 }}>
                <div className="rx-symbol" style={{ marginBottom: 6 }}>℞</div>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#334155', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px', width: '35px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '8px 10px' }}>Medicine Name</th>
                        <th style={{ padding: '8px 10px' }}>Dose Schedule (खुराक)</th>
                        <th style={{ padding: '8px 10px', width: '90px' }}>Duration</th>
                        <th style={{ padding: '8px 10px' }}>Instructions (निर्देश)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visit.medicines.map((m, i) => {
                        const doseWords = parseDoseToWords(m.dose);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', color: '#0d9488' }}>{i + 1}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>{m.name}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600, color: '#0d9488' }}>{doseWords.en}</div>
                              {doseWords.hi && doseWords.hi !== doseWords.en && (
                                <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 1 }}>{doseWords.hi}</div>
                              )}
                              {doseWords.mr && doseWords.mr !== doseWords.en && doseWords.mr !== doseWords.hi && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>{doseWords.mr}</div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#334155' }}>{m.duration}</td>
                            <td style={{ padding: '8px 10px', color: '#475569', fontSize: '0.78rem' }}>
                              {m.instructions || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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

            {/* Footer / Digital Signature */}
            <div className="rx-footer" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                <div><strong>Prescription Date:</strong> {new Date(visit.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div style={{ marginTop: 2 }}><strong>Generated:</strong> {new Date(visit.date).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-block', 
                  border: '1.5px solid #0d9488', 
                  borderRadius: 8, 
                  padding: '6px 12px', 
                  background: 'rgba(13, 148, 136, 0.04)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0d9488', fontWeight: 700 }}>
                    Digitally Signed & Verified
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginTop: 2 }}>
                    {clinic.doctorName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 1 }}>
                    {clinic.degree ? `${clinic.degree} ` : ''}{clinic.regNo ? `| Reg: ${clinic.regNo}` : ''}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#0d9488', fontWeight: 600, marginTop: 2 }}>
                    🕒 {new Date(visit.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
