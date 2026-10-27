'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useIpdAdmission, usePatient, useSettings } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import { Printer, MessageCircle, Share2, Receipt, FileText, Bed } from 'lucide-react';
import { toast } from '@/components/Toast';

export default function IpdPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const defaultView = searchParams.get('view') || (searchParams.get('bill') === 'true' ? 'bill' : searchParams.get('summary') === 'true' ? 'summary' : 'both');

  const { data: admission, isLoading: admissionLoading } = useIpdAdmission(id);
  const { data: patient, isLoading: patientLoading } = usePatient(admission?.patientId || '');
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'both' | 'bill' | 'summary'>(
    defaultView === 'bill' ? 'bill' : defaultView === 'summary' ? 'summary' : 'both'
  );

  useEffect(() => {
    if (defaultView === 'bill' || defaultView === 'summary' || defaultView === 'both') {
      setViewMode(defaultView);
    }
  }, [defaultView]);

  const clinic = {
    doctorName: admission?.attendingDoctor || settings?.doctorName || user?.doctorName || 'Dr. Administrator',
    clinicName: settings?.clinicName || user?.clinicName || 'Hospital Inpatient Department',
    degree: settings?.degree || '',
    address: settings?.address || '',
    phone: settings?.phone || '',
    regNo: settings?.regNo || '',
  };

  if (admissionLoading || patientLoading || settingsLoading) {
    return <div style={{ padding: 40, color: '#888', textAlign: 'center' }}>Loading IPD Document…</div>;
  }

  if (!admission || !patient) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>IPD Admission record not found.</p>
        <button className="btn btn-ghost" onClick={() => history.back()} style={{ marginTop: 12 }}>
          ← Back to Inpatients
        </button>
      </div>
    );
  }

  const age = patient.age || (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '');
  const isDischarged = admission.status === 'DISCHARGED';
  const subtotal = Number(admission.cumulativeCharges || 0);
  const discount = Number(admission.discount || 0);
  const totalPaid = Number(admission.totalPaid || 0);
  const balanceDue = Number(admission.balanceDue || 0);
  const discPercent = subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0;

  // WhatsApp formatted statement share
  const handleWhatsAppSend = () => {
    const clinicName = clinic.clinicName;
    const docName = clinic.doctorName;
    const patientName = patient.name;

    let dayLogsSummary = '';
    if (admission.dayWiseLogs && admission.dayWiseLogs.length > 0) {
      dayLogsSummary = admission.dayWiseLogs
        .map(
          (d) =>
            `• *Day ${d.dayNumber}* (${new Date(d.date).toLocaleDateString('en-IN')}): ₹${d.dailyCharges} - ${
              d.procedures?.map((p) => p.name).join(', ') || d.doctorNotes || 'Routine Care'
            }`
        )
        .join('\n');
    }

    const discountText = discount > 0 ? `• Discount Given: -₹${discount} (${discPercent}% off)\n` : '';

    const billSection =
      viewMode !== 'summary'
        ? `*IPD BILL & SETTLEMENT SUMMARY*\n*Admission No:* ${admission.admissionNumber}\n*Bed/Room:* ${admission.bedOrRoom}\n*Admitted:* ${new Date(
            admission.admissionDate
          ).toLocaleDateString('en-IN')}\n*Discharged:* ${
            admission.dischargeDate ? new Date(admission.dischargeDate).toLocaleDateString('en-IN') : 'Active'
          }\n\n*Day-wise Charges:*\n${dayLogsSummary ? dayLogsSummary + '\n' : ''}----------------------------------\n• Subtotal Charges: ₹${subtotal}\n${discountText}*Net Payable:* ₹${Math.max(
            0,
            subtotal - discount
          )}\n*Total Paid:* ₹${totalPaid}\n*Balance Due:* ₹${balanceDue}\n*Status:* ${
            balanceDue === 0 ? 'SETTLED' : 'DUE PENDING'
          }\n----------------------------------\n\n`
        : '';

    const clinicalSection =
      viewMode !== 'bill'
        ? `*DISCHARGE SUMMARY*\n*Diagnosis:* ${admission.diagnosis}\n${
            admission.dischargeSummary ? `*Summary:* ${admission.dischargeSummary}\n\n` : ''
          }${admission.dischargeMedications ? `*Discharge Rx / Medications:*\n${admission.dischargeMedications}\n\n` : ''}${
            admission.dischargeNotes ? `*Post-Discharge Instructions:* ${admission.dischargeNotes}\n\n` : ''
          }`
        : '';

    const text = `*${clinicName}*\nDr. *${docName}*\n\nHello *${patientName}*,\nHere is your official IPD document for Admission *${
      admission.admissionNumber
    }*.\n\n${billSection}${clinicalSection}_Wishing you a swift and complete recovery!_`;

    const phone = patient.mobile.replace(/\D/g, '');
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // High-res PDF download / share using same html2canvas + jsPDF engine
  const handleSharePdf = async () => {
    try {
      toast('Preparing IPD PDF...', 'info');
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const element = document.getElementById('prescription');
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      doc.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const docTitle =
        viewMode === 'bill'
          ? 'Final_IPD_Bill'
          : viewMode === 'summary'
          ? 'Discharge_Summary'
          : 'IPD_Discharge_Summary_and_Bill';

      const fileName = `${patient.name.replace(/\s+/g, '_')}_${docTitle}_${admission.admissionNumber}.pdf`;
      const blob = doc.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${patient.name} IPD Statement`,
          text: `Inpatient Statement for ${patient.name}`,
        });
      } else {
        doc.save(fileName);
        toast('PDF Downloaded successfully!', 'success');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast('Could not generate PDF.', 'error');
      }
    }
  };

  return (
    <div>
      {/* Top Toolbar (No-Print) */}
      <div
        className="no-print"
        style={{
          padding: '16px 24px',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View mode switcher */}
          <div
            style={{
              display: 'inline-flex',
              background: 'var(--surface-1)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'both' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('both')}
            >
              Combined (Bill + Summary)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'bill' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('bill')}
            >
              Final Bill Only
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'summary' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('summary')}
            >
              Discharge Summary Only
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={15} /> Print {viewMode === 'bill' ? 'Final Bill' : viewMode === 'summary' ? 'Summary' : 'Document'}
          </button>

          <button
            className="btn"
            style={{ background: '#25D366', color: '#fff', border: 'none' }}
            onClick={handleWhatsAppSend}
          >
            <MessageCircle size={15} /> WhatsApp Statement
          </button>

          <button className="btn btn-secondary" onClick={handleSharePdf}>
            <Share2 size={15} /> Download PDF
          </button>
        </div>

        <button className="btn btn-ghost" onClick={() => history.back()}>
          ← Back to Inpatients
        </button>
      </div>

      {/* Printable Sheet */}
      <div style={{ padding: '20px', background: 'var(--background)', minHeight: '100vh' }}>
        <div className="prescription-sheet" id="prescription">
          {/* Header */}
          <div
            className="rx-header"
            style={{
              background: '#ffffff',
              borderBottom: '2.5px solid #0d9488',
              padding: '24px 28px',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: '#0d9488',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: 3,
                  }}
                >
                  {viewMode === 'bill'
                    ? 'Official IPD Final Bill & Tax Receipt'
                    : viewMode === 'summary'
                    ? 'Official IPD Discharge Summary'
                    : 'Official IPD Final Bill & Discharge Summary'}
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '1.55rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.2,
                  }}
                >
                  {clinic.clinicName}
                </h1>
                <h2 style={{ margin: '6px 0 0', fontSize: '1.08rem', fontWeight: 700, color: '#0d9488' }}>
                  {clinic.doctorName}
                </h2>
                {clinic.degree && (
                  <div style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                    {clinic.degree}
                  </div>
                )}
                {clinic.regNo && (
                  <div style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Reg. No: <strong style={{ color: '#334155' }}>{clinic.regNo}</strong>
                  </div>
                )}
              </div>
              <div
                style={{
                  textAlign: 'right',
                  fontSize: '0.82rem',
                  lineHeight: 1.6,
                  color: '#334155',
                  maxWidth: '300px',
                }}
              >
                {clinic.address && <div>📍 {clinic.address}</div>}
                {clinic.phone && (
                  <div style={{ marginTop: 2 }}>
                    📞 Contact: <strong style={{ color: '#0f172a' }}>{clinic.phone}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rx-body">
            {/* Inpatient Particulars Bar */}
            <div className="rx-patient-info" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="rx-info-item">
                <div className="rx-info-label">Patient Name</div>
                <div className="rx-info-value" style={{ fontWeight: 700 }}>{patient.name}</div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Age / Gender</div>
                <div className="rx-info-value">
                  {age}y / {patient.gender}
                </div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Mobile</div>
                <div className="rx-info-value">{patient.mobile}</div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Patient ID</div>
                <div className="rx-info-value">{patient.patientId}</div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">IPD Admission No.</div>
                <div className="rx-info-value" style={{ fontWeight: 700, color: '#0d9488' }}>
                  {admission.admissionNumber}
                </div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Bed / Room</div>
                <div className="rx-info-value" style={{ fontWeight: 700 }}>
                  {admission.bedOrRoom}
                </div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Admission Date</div>
                <div className="rx-info-value">
                  {new Date(admission.admissionDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Discharge Date</div>
                <div className="rx-info-value" style={{ fontWeight: 600 }}>
                  {admission.dischargeDate
                    ? new Date(admission.dischargeDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Current Inpatient'}
                </div>
              </div>

              <div className="rx-info-item" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="rx-info-label">Status: </span>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: isDischarged ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      color: isDischarged ? '#16a34a' : '#2563eb',
                    }}
                  >
                    {admission.status}
                  </span>
                </div>
                {admission.diagnosis && (
                  <div>
                    <span className="rx-info-label">Primary Diagnosis: </span>
                    <strong style={{ color: '#0f172a' }}>{admission.diagnosis}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* ════════════ CLINICAL DISCHARGE SUMMARY SECTION ════════════ */}
            {viewMode !== 'bill' && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0d9488',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: 10,
                  }}
                >
                  <FileText size={16} /> Clinical Course & Discharge Summary
                </div>

                {admission.dischargeSummary && (
                  <div style={{ marginBottom: 12, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                      Hospital Course & Clinical Summary
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {admission.dischargeSummary}
                    </div>
                  </div>
                )}

                {/* Discharge Medications */}
                {admission.dischargeMedications && (
                  <div style={{ marginBottom: 12, background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: 4 }}>
                      Prescribed Discharge Medications
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#14532d', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 500 }}>
                      {admission.dischargeMedications}
                    </div>
                  </div>
                )}

                {/* Post Discharge Advice */}
                {admission.dischargeNotes && (
                  <div style={{ marginBottom: 12, background: '#fffbeb', padding: 12, borderRadius: 8, border: '1px solid #fef3c7' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 4 }}>
                      Follow-up Advice & Emergency Warnings
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#78350f', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {admission.dischargeNotes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════════════ ITEMIZED DAY-WISE BILL SECTION ════════════ */}
            {viewMode !== 'summary' && (
              <div style={{ marginTop: 16, marginBottom: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0d9488',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: 8,
                  }}
                >
                  <Receipt size={16} /> Day-Wise Inpatient Treatment & Procedure Charges
                </div>

                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.84rem',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#f8fafc',
                          color: '#334155',
                          borderBottom: '1.5px solid #cbd5e1',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center' }}>Day</th>
                        <th style={{ padding: '8px 10px', width: '90px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Clinical Observations, Procedures & Medications</th>
                        <th style={{ padding: '8px 10px', width: '120px', textAlign: 'right' }}>Charges (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admission.dayWiseLogs && admission.dayWiseLogs.length > 0 ? (
                        admission.dayWiseLogs.map((log, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            }}
                          >
                            <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', color: '#0d9488' }}>
                              Day {log.dayNumber}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569', fontSize: '0.8rem' }}>
                              {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              {log.doctorNotes && (
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.doctorNotes}</div>
                              )}
                              {log.procedures && log.procedures.length > 0 && (
                                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>
                                  Procedures:{' '}
                                  {log.procedures.map((p) => `${p.name} (Qty: ${p.quantity} · ₹${p.totalPrice})`).join(', ')}
                                </div>
                              )}
                              {log.medicinesAdministered && (
                                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
                                  Meds: {log.medicinesAdministered}
                                </div>
                              )}
                              {!log.doctorNotes && (!log.procedures || log.procedures.length === 0) && (
                                <span style={{ color: '#94a3b8' }}>Routine Bed & Nursing Care</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                              ₹{log.dailyCharges}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>
                            No daily logs recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Calculation Table */}
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '320px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                      <span style={{ color: '#475569' }}>Total Running Charges:</span>
                      <strong style={{ color: '#0f172a' }}>₹{subtotal}</strong>
                    </div>

                    {discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#16a34a' }}>
                        <span>Discount Given ({discPercent}% off):</span>
                        <strong>-₹{discount}</strong>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        borderTop: '1px solid #cbd5e1',
                        borderBottom: '1px solid #cbd5e1',
                        margin: '6px 0',
                      }}
                    >
                      <span>Final Net Payable:</span>
                      <span style={{ color: '#0d9488' }}>₹{Math.max(0, subtotal - discount)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem' }}>
                      <span style={{ color: '#475569' }}>Total Amount Paid:</span>
                      <strong style={{ color: '#16a34a' }}>₹{totalPaid}</strong>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: balanceDue > 0 ? '#dc2626' : '#16a34a',
                      }}
                    >
                      <span>Balance Due:</span>
                      <span>₹{balanceDue} {balanceDue === 0 ? '(SETTLED)' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Doctor Signature & Hospital Seal Block */}
            <div
              className="rx-footer"
              style={{
                marginTop: 36,
                paddingTop: 16,
                borderTop: '1.5px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Document Generated On: {new Date().toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>
                  * This is an official computer-generated medical and billing document.
                </div>
              </div>

              <div style={{ textAlign: 'center', minWidth: '180px' }}>
                <div style={{ height: '40px' }} />
                <div style={{ borderTop: '1px dashed #64748b', paddingTop: 4, fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                  Dr. {clinic.doctorName}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Authorized Medical Officer</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
