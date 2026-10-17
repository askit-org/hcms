'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVisit, usePatient, useSettings, useBillForVisit } from '@/lib/hooks/useQueries';
import { Printer, MessageCircle, Share2, Receipt, FileText } from 'lucide-react';
import { toast } from '@/components/Toast';
import { parseDoseToWords } from '@/lib/medicationInstructions';

export default function PrintRxPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = use(params);
  const searchParams = useSearchParams();
  const defaultBillView = searchParams.get('bill') === 'true';

  const { data: visit, isLoading: visitLoading } = useVisit(visitId);
  const { data: patient, isLoading: patientLoading } = usePatient(visit?.patientId || '');
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: bill, isLoading: billLoading } = useBillForVisit(visitId);

  const [viewMode, setViewMode] = useState<'both' | 'rx' | 'bill'>('both');

  useEffect(() => {
    if (defaultBillView) {
      setViewMode('bill');
    }
  }, [defaultBillView]);

  const clinic = {
    doctorName: (visit as any)?.adminDoctor?.name || settings?.doctorName || 'Dr. Administrator',
    clinicName: (visit as any)?.adminHospital?.name || settings?.clinicName || (visit as any)?.organization?.name || 'Hospital Clinic',
    degree: (visit as any)?.adminDoctor?.degree || settings?.degree || '',
    address: (visit as any)?.adminHospital?.address || settings?.address || (visit as any)?.organization?.address || '',
    phone: (visit as any)?.adminHospital?.phone || settings?.phone || (visit as any)?.organization?.phone || '',
    regNo: (visit as any)?.adminDoctor?.regNo || settings?.regNo || '',
  };

  if (!visit || !patient) {
    return <div style={{ padding: 40, color: '#888', textAlign: 'center' }}>Loading document…</div>;
  }

  const age = patient.age || (patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '');
  const shouldHideTreatment =
    visit.hideTreatmentInRx === true ||
    (typeof window !== 'undefined' && localStorage.getItem(`hcms_hide_tx_${visit.id}`) === 'true');

  const handleWhatsAppSend = () => {
    const medsText =
      visit.medicines
        ?.map((m, i) => {
          return `${i + 1}. *${m.name}*\n   - ${m.dose} for ${m.duration}${m.instructions ? `\n   - ${m.instructions}` : ''}`;
        })
        .join('\n\n') || 'No medicines prescribed.';

    const treatmentText = visit.treatment && !shouldHideTreatment ? `*Treatment Given:* \n${visit.treatment}\n\n` : '';

    let billSection = '';
    if (bill && (viewMode === 'both' || viewMode === 'bill')) {
      const itemsList = bill.items.map((it) => `• ${it.name} (Qty: ${it.quantity}): ₹${it.totalPrice}`).join('\n');
      billSection = `*BILL & PAYMENT RECEIPT*\n*Bill No:* ${bill.billNumber}\n• Consultation Fee: ₹${bill.consultationFee}\n${itemsList ? itemsList + '\n' : ''}*Subtotal:* ₹${bill.subtotal}\n${bill.discount ? `*Discount:* -₹${bill.discount}\n` : ''}*Total Amount:* ₹${bill.totalAmount}\n*Paid:* ₹${bill.paidAmount} (${bill.paymentMethod})\n*Balance Due:* ₹${bill.balanceDue} (${bill.paymentStatus})\n\n`;
    }

    const rxSection =
      viewMode !== 'bill'
        ? `*Diagnosis:* \n${visit.diagnosis || 'N/A'}\n\n${treatmentText}*Prescribed Medicines:*\n${medsText}\n\n${
            visit.prescriptionNotes ? `*Doctor's Advice:* \n${visit.prescriptionNotes}\n\n` : ''
          }${
            visit.followUpDate
              ? `*Next Follow-up:* \n${new Date(visit.followUpDate).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}\n\n`
              : ''
          }`
        : '';

    const text = `*${clinic.clinicName}*\nDr. *${clinic.doctorName}*\n\nHello *${patient.name}*,\nHere is your official OPD document for visit date *${new Date(
      visit.date
    ).toLocaleDateString('en-IN')}*.\n\n${billSection}${rxSection}_Get well soon!_`;

    const phone = patient.mobile.replace(/\D/g, '');
    const targetPhone = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleSharePdf = async () => {
    try {
      toast('Preparing PDF...', 'info');
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

      const blob = doc.output('blob');
      const fileName = `${patient.name.replace(/\s+/g, '_')}_${viewMode === 'bill' ? 'Bill' : 'Prescription'}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${patient.name} OPD Document`,
          text: `Document for ${patient.name}`,
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
          {bill && (
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
                Combined (Rx + Bill)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'rx' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('rx')}
              >
                Prescription Only
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'bill' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('bill')}
              >
                Bill Only
              </button>
            </div>
          )}

          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={15} /> Print {viewMode === 'bill' ? 'Bill' : 'Document'}
          </button>
          <button
            className="btn"
            style={{ background: '#25D366', color: '#fff', border: 'none' }}
            onClick={handleWhatsAppSend}
          >
            <MessageCircle size={15} /> WhatsApp {viewMode === 'bill' ? 'Bill' : 'Rx'}
          </button>
          <button className="btn btn-secondary" onClick={handleSharePdf}>
            <Share2 size={15} /> Share PDF
          </button>
        </div>

        <button className="btn btn-ghost" onClick={() => history.back()}>
          ← Back
        </button>
      </div>

      {/* Printable Sheet */}
      <div style={{ padding: '20px', background: 'var(--background)', minHeight: '100vh' }}>
        <div className="prescription-sheet" id="prescription">
          {/* Header - Strictly Admin Hospital & Doctor Details */}
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
                    ? 'Official OPD Bill & Tax Receipt'
                    : viewMode === 'rx'
                    ? 'Official OPD Prescription'
                    : 'Official OPD Bill & Prescription'}
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
            {/* Patient Info Bar */}
            <div className="rx-patient-info">
              <div className="rx-info-item">
                <div className="rx-info-label">Patient Name</div>
                <div className="rx-info-value">{patient.name}</div>
              </div>

              <div className="rx-info-item">
                <div className="rx-info-label">Age / Gender</div>
                <div className="rx-info-value">
                  {age}y / {patient.gender}
                </div>
              </div>
              <div className="rx-info-item">
                <div className="rx-info-label">Date</div>
                <div className="rx-info-value">{new Date(visit.date).toLocaleDateString('en-IN')}</div>
              </div>
              <div className="rx-info-item">
                <div className="rx-info-label">Mobile</div>
                <div className="rx-info-value">{patient.mobile}</div>
              </div>
              {patient.abhaNumber && (
                <div className="rx-info-item">
                  <div className="rx-info-label">ABHA No.</div>
                  <div className="rx-info-value">{patient.abhaNumber}</div>
                </div>
              )}
              {visit.bp && (
                <div className="rx-info-item">
                  <div className="rx-info-label">BP / Pulse</div>
                  <div className="rx-info-value">
                    {visit.bp} / {visit.pulse}
                  </div>
                </div>
              )}
              {bill && (
                <div className="rx-info-item">
                  <div className="rx-info-label">Bill / Invoice No.</div>
                  <div className="rx-info-value" style={{ fontWeight: 700, color: '#0d9488' }}>
                    {bill.billNumber}
                  </div>
                </div>
              )}
              {bill && (
                <div className="rx-info-item">
                  <div className="rx-info-label">Payment Status</div>
                  <div
                    className="rx-info-value"
                    style={{
                      fontWeight: 700,
                      color:
                        bill.paymentStatus === 'PAID'
                          ? '#16a34a'
                          : bill.paymentStatus === 'PARTIAL'
                          ? '#d97706'
                          : '#dc2626',
                    }}
                  >
                    {bill.paymentStatus === 'PAID'
                      ? 'PAID IN FULL'
                      : bill.paymentStatus === 'PARTIAL'
                      ? 'PARTIALLY PAID'
                      : 'PAYMENT DUE'}
                  </div>
                </div>
              )}
              {patient.permanentConditions && patient.permanentConditions.length > 0 && (
                <div className="rx-info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="rx-info-label">Known Chronic Conditions / Alerts</div>
                  <div className="rx-info-value" style={{ color: '#b45309', fontWeight: 600 }}>
                    {patient.permanentConditions.join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* Diagnosis & Treatments Performed */}
            {(visit.chiefComplaints || visit.diagnosis || (visit.treatment && !shouldHideTreatment)) && (
              <div style={{ marginBottom: 16 }}>
                {visit.chiefComplaints && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>C/C: </span>
                    <span>{visit.chiefComplaints}</span>
                  </div>
                )}
                {visit.diagnosis && (
                  <div style={{ marginBottom: visit.treatment && !shouldHideTreatment ? 6 : 0 }}>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Dx: </span>
                    <span style={{ fontWeight: 600 }}>{visit.diagnosis}</span>
                  </div>
                )}
                {visit.treatment && !shouldHideTreatment && (
                  <div>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Treatment: </span>
                    <span>{visit.treatment}</span>
                  </div>
                )}
              </div>
            )}

            {/* ════════════ ITEMIZED BILL SECTION ════════════ */}
            {bill && (viewMode === 'both' || viewMode === 'bill') && (
              <div style={{ marginTop: 16, marginBottom: 20 }}>
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
                  <Receipt size={16} /> Itemized OPD Bill & Treatment Charges
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
                        <th style={{ padding: '8px 10px', width: '35px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '8px 10px' }}>Particulars / Treatment Done</th>
                        <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ padding: '8px 10px', width: '110px', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Doctor Consultation Fee Row */}
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', color: '#0d9488' }}>
                          1
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                          Doctor Consultation Fee
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{bill.consultationFee}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                          ₹{bill.consultationFee}
                        </td>
                      </tr>

                      {/* Line Items / Treatments */}
                      {bill.items.map((it, idx) => (
                        <tr
                          key={it.id || idx}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            background: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
                          }}
                        >
                          <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center', color: '#0d9488' }}>
                            {idx + 2}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#0f172a' }}>{it.name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{it.unitPrice}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                            ₹{it.totalPrice}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {/* Subtotal */}
                      <tr style={{ borderTop: '1.5px solid #cbd5e1', background: '#f8fafc' }}>
                        <td colSpan={4} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                          Subtotal:
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                          ₹{bill.subtotal}
                        </td>
                      </tr>

                      {/* Discount (if any) */}
                      {bill.discount > 0 && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={4} style={{ padding: '4px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                            Discount / Concession:
                          </td>
                          <td style={{ padding: '4px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                            - ₹{bill.discount}
                          </td>
                        </tr>
                      )}

                      {/* Total Amount */}
                      <tr style={{ borderTop: '2px solid #0d9488', background: '#f0fdfa' }}>
                        <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>
                          Grand Total Amount:
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#0d9488' }}>
                          ₹{bill.totalAmount}
                        </td>
                      </tr>

                      {/* Amount Paid */}
                      <tr style={{ background: '#ffffff' }}>
                        <td colSpan={4} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                          Amount Paid ({bill.paymentMethod}):
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          ₹{bill.paidAmount}
                        </td>
                      </tr>

                      {/* Balance Due */}
                      <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #cbd5e1' }}>
                        <td colSpan={4} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: bill.balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                          Balance Remaining Due:
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: bill.balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                          ₹{bill.balanceDue}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ════════════ PRESCRIBED MEDICINES SECTION ════════════ */}
            {viewMode !== 'bill' && visit.medicines && visit.medicines.length > 0 && (
              <div className="rx-medicines" style={{ marginTop: 12 }}>
                <div className="rx-symbol" style={{ marginBottom: 6 }}>
                  ℞
                </div>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          borderBottom: '1.5px solid #cbd5e1',
                          textAlign: 'left',
                        }}
                      >
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
                          <tr
                            key={i}
                            style={{
                              borderBottom: '1px solid #e2e8f0',
                              background: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                            }}
                          >
                            <td
                              style={{
                                padding: '8px 10px',
                                fontWeight: 700,
                                textAlign: 'center',
                                color: '#0d9488',
                              }}
                            >
                              {i + 1}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>{m.name}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: 600, color: '#0d9488' }}>{doseWords.en}</div>
                              {doseWords.hi && doseWords.hi !== doseWords.en && (
                                <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: 1 }}>
                                  {doseWords.hi}
                                </div>
                              )}
                              {doseWords.mr && doseWords.mr !== doseWords.en && doseWords.mr !== doseWords.hi && (
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>
                                  {doseWords.mr}
                                </div>
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
            {viewMode !== 'bill' && visit.prescriptionNotes && (
              <div
                style={{
                  marginTop: 14,
                  background: '#f8fafc',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  borderLeft: '3px solid #0d9488',
                }}
              >
                <strong style={{ color: '#0d9488' }}>Advice: </strong>
                <span style={{ color: '#334155' }}>{visit.prescriptionNotes}</span>
              </div>
            )}

            {/* Follow-up */}
            {viewMode !== 'bill' && visit.followUpDate && (
              <div style={{ marginTop: 12, fontWeight: 600, color: '#0d9488', fontSize: '0.9rem' }}>
                📅 Next Visit:{' '}
                {new Date(visit.followUpDate).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}

            {/* Footer / Digital Signature */}
            <div
              className="rx-footer"
              style={{
                marginTop: 24,
                paddingTop: 16,
                borderTop: '1px dashed #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: 14,
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.6 }}>
                <div>
                  <strong>Visit / Bill Date:</strong>{' '}
                  {new Date(visit.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  at {new Date(visit.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ marginTop: 2 }}>
                  <strong>Printed / Issued:</strong>{' '}
                  {new Date().toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                  Official OPD document issued exclusively by <strong>{clinic.clinicName}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    display: 'inline-block',
                    border: '1.5px solid #0d9488',
                    borderRadius: 8,
                    padding: '10px 16px',
                    background: 'rgba(13, 148, 136, 0.04)',
                    textAlign: 'center',
                    minWidth: '240px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                      color: '#0d9488',
                      fontWeight: 800,
                    }}
                  >
                    Digitally Signed & Verified
                  </div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.96rem', marginTop: 3 }}>
                    {clinic.doctorName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0d9488', fontWeight: 600, marginTop: 1 }}>
                    {clinic.clinicName}
                  </div>
                  {(clinic.degree || clinic.regNo) && (
                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 2 }}>
                      {clinic.degree ? `${clinic.degree} ` : ''}
                      {clinic.regNo ? `| Reg: ${clinic.regNo}` : ''}
                    </div>
                  )}
                  {clinic.phone && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                      📞 {clinic.phone}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: '#0d9488',
                      fontWeight: 600,
                      marginTop: 5,
                      borderTop: '1px solid rgba(13, 148, 136, 0.15)',
                      paddingTop: 4,
                    }}
                  >
                    🕒 Record Timestamp:{' '}
                    {new Date(visit.date).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
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
