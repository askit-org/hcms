'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  Users,
  Search,
  Bed,
  Stethoscope,
  Activity,
  Receipt,
  CheckCircle2,
  Printer,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { useReports, useIpdAdmissions, useSettings } from '@/lib/hooks/useQueries';
import { useAuth } from '@/lib/hooks/useAuth';
import PageTransition from '@/components/PageTransition';
import type { Patient, IpdAdmission, Visit } from '@/lib/providers/types';
import { toast } from '@/components/Toast';

export default function ReportsPage() {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const clinicName = user?.clinicName || settings?.clinicName || 'Hospital Clinic';

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [query, setQuery] = useState('');
  const [activityTab, setActivityTab] = useState<'ALL' | 'OPD' | 'IPD'>('ALL');

  // Custom debouncing hook
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch OPD reports & IPD admissions
  const { data: visitPage, isLoading: loadingVisits } = useReports(startDate, endDate);
  const visits = visitPage?.data ?? [];
  const totalInRange = visitPage?.meta.total ?? 0;
  const isTruncated = totalInRange > visits.length;

  const { data: allIpdAdmissions = [], isLoading: loadingIpd } = useIpdAdmissions();
  const isLoading = loadingVisits || loadingIpd;

  // Patient lookup map
  const patMap = useMemo(() => {
    const m = new Map<string, Patient>();
    visits.forEach((v) => {
      if (v.patient) m.set(v.patientId, v.patient);
    });
    allIpdAdmissions.forEach((a) => {
      if (a.patient) m.set(a.patientId, a.patient);
    });
    return m;
  }, [visits, allIpdAdmissions]);

  // Filtered OPD visits
  const filteredVisits = useMemo(() => {
    return visits
      .filter((v) => {
        const d = v.date.split('T')[0];
        const inRange = d >= startDate && d <= endDate;
        if (!inRange) return false;
        if (!debouncedQuery.trim()) return true;
        const q = debouncedQuery.toLowerCase();
        const p = patMap.get(v.patientId);
        return (
          (p?.name || '').toLowerCase().includes(q) ||
          (p?.mobile || '').includes(q) ||
          (v.diagnosis || '').toLowerCase().includes(q) ||
          (v.patientId || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [visits, startDate, endDate, debouncedQuery, patMap]);

  const filteredOpdVisits = useMemo(() => {
    return filteredVisits.filter((v) => (v.category || 'OPD') !== 'IPD');
  }, [filteredVisits]);

  const filteredIpdCategoryVisits = useMemo(() => {
    return filteredVisits.filter((v) => v.category === 'IPD');
  }, [filteredVisits]);

  // Filtered IPD admissions within date range
  const filteredAdmissions = useMemo(() => {
    return allIpdAdmissions
      .filter((adm) => {
        const admDate = (adm.admissionDate || adm.createdAt).slice(0, 10);
        const disDate = adm.dischargeDate ? adm.dischargeDate.slice(0, 10) : null;
        // In range if admitted in range OR discharged in range OR active during range
        const inRange =
          (admDate >= startDate && admDate <= endDate) ||
          (disDate && disDate >= startDate && disDate <= endDate) ||
          (adm.status === 'ADMITTED' && admDate <= endDate);

        if (!inRange) return false;
        if (!debouncedQuery.trim()) return true;
        const q = debouncedQuery.toLowerCase();
        const p = adm.patient || patMap.get(adm.patientId);
        return (
          (p?.name || '').toLowerCase().includes(q) ||
          (p?.mobile || '').includes(q) ||
          (adm.diagnosis || '').toLowerCase().includes(q) ||
          (adm.bedOrRoom || '').toLowerCase().includes(q) ||
          (adm.admissionNumber || '').toLowerCase().includes(q) ||
          (adm.attendingDoctor || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime());
  }, [allIpdAdmissions, startDate, endDate, debouncedQuery, patMap]);

  // Combined stats
  const allPatientIds = useMemo(() => {
    const s = new Set<string>();
    filteredVisits.forEach((v) => s.add(v.patientId));
    filteredAdmissions.forEach((a) => s.add(a.patientId));
    return s;
  }, [filteredVisits, filteredAdmissions]);

  const newInPeriod = useMemo(() => {
    return [...allPatientIds].filter((id) => {
      const created = patMap.get(id)?.createdAt?.split('T')[0];
      return !!created && created >= startDate && created <= endDate;
    }).length;
  }, [allPatientIds, patMap, startDate, endDate]);

  // IPD Financial aggregates
  const ipdFinancials = useMemo(() => {
    let charges = 0;
    let advance = 0;
    let settled = 0;
    let dues = 0;
    let roundsCount = 0;

    filteredAdmissions.forEach((adm) => {
      charges += Number(adm.cumulativeCharges) || 0;
      advance += Number(adm.advancePaid) || 0;
      settled += Number(adm.totalPaid) || 0;
      dues += Number(adm.balanceDue) || 0;
      roundsCount += (adm.dayWiseLogs || []).length;
    });

    return { charges, advance, settled, dues, roundsCount };
  }, [filteredAdmissions]);

  // Daily combined counts for peak activity
  const peakDay = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredVisits.forEach((v) => {
      const d = v.date.split('T')[0];
      counts[d] = (counts[d] || 0) + 1;
    });
    filteredAdmissions.forEach((a) => {
      const d = a.admissionDate.split('T')[0];
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || null;
  }, [filteredVisits, filteredAdmissions]);

  // Export CSV
  const exportCSV = () => {
    if (activityTab === 'IPD') {
      const headers = [
        'Admission No',
        'Admission Date',
        'Discharge Date',
        'Patient Name',
        'Age',
        'Gender',
        'Mobile',
        'Bed/Room',
        'Diagnosis',
        'Attending Doctor',
        'Days Stayed',
        'Rounds Logged',
        'Cumulative Charges (₹)',
        'Advance Paid (₹)',
        'Total Settled (₹)',
        'Balance Due (₹)',
        'Status',
      ];
      const rows = filteredAdmissions.map((adm) => {
        const p = adm.patient || patMap.get(adm.patientId);
        const stayDays = Math.max(
          1,
          Math.ceil(
            ((adm.dischargeDate ? new Date(adm.dischargeDate).getTime() : new Date().getTime()) -
              new Date(adm.admissionDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        return [
          adm.admissionNumber,
          new Date(adm.admissionDate).toLocaleString('en-IN'),
          adm.dischargeDate ? new Date(adm.dischargeDate).toLocaleString('en-IN') : 'Active',
          p?.name || 'Patient',
          p?.age || '',
          p?.gender || '',
          p?.mobile || '',
          adm.bedOrRoom,
          adm.diagnosis || '',
          adm.attendingDoctor || '',
          stayDays,
          (adm.dayWiseLogs || []).length,
          adm.cumulativeCharges,
          adm.advancePaid,
          adm.totalPaid,
          adm.balanceDue,
          adm.status,
        ];
      });
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IPD_Admissions_Report_${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (activityTab === 'OPD') {
      const headers = ['Date & Time', 'Patient ID', 'Name', 'Age', 'Mobile', 'Chief Complaints', 'Diagnosis', 'BP', 'Pulse', 'Temp', 'Follow-up Date'];
      const rows = filteredOpdVisits.map((v) => {
        const p = patMap.get(v.patientId);
        return [
          new Date(v.date).toLocaleString('en-IN'),
          v.patientId,
          p?.name || '',
          p?.age || '',
          p?.mobile || '',
          v.chiefComplaints || '',
          v.diagnosis || '',
          v.bp || '',
          v.pulse || '',
          v.temp || '',
          v.followUpDate || '',
        ];
      });
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OPD_Report_${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // ALL: Combined Hospital Report
    const headers = [
      'Type',
      'Date & Time',
      'Encounter/Admission No',
      'Patient Name',
      'Age',
      'Mobile',
      'Bed/Room',
      'Diagnosis',
      'Status / Follow-up',
      'Charges / Total (₹)',
      'Balance Due (₹)',
    ];

    const opdRows = filteredVisits.map((v) => {
      const p = patMap.get(v.patientId);
      return [
        v.category === 'IPD' ? 'IPD Visit' : 'OPD Visit',
        new Date(v.date).toLocaleString('en-IN'),
        v.id,
        p?.name || '',
        p?.age || '',
        p?.mobile || '',
        v.category === 'IPD' ? 'Inpatient' : 'Outpatient',
        v.diagnosis || '',
        v.followUpDate ? `F/U: ${new Date(v.followUpDate).toLocaleDateString('en-IN')}` : '—',
        v.bill?.totalAmount || 0,
        v.bill?.balanceDue || 0,
      ];
    });

    const ipdRows = filteredAdmissions.map((adm) => {
      const p = adm.patient || patMap.get(adm.patientId);
      return [
        'IPD Admission',
        new Date(adm.admissionDate).toLocaleString('en-IN'),
        adm.admissionNumber,
        p?.name || '',
        p?.age || '',
        p?.mobile || '',
        adm.bedOrRoom,
        adm.diagnosis || '',
        adm.status === 'ADMITTED' ? '🟢 Currently Admitted' : '⚪ Discharged',
        adm.cumulativeCharges,
        adm.balanceDue,
      ];
    });

    const csv = [headers, ...opdRows, ...ipdRows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hospital_Combined_Report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF (print)
  const exportPDF = () => {
    window.print();
  };

  const totalEncountersCount = filteredVisits.length + filteredAdmissions.length;
  const totalIpdCount = filteredAdmissions.length + filteredIpdCategoryVisits.length;

  return (
    <PageTransition>
      {/* ─── PRINT-ONLY OFFICIAL REPORT HEADER ─── */}
      <div className="print-only" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #0f172a', paddingBottom: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/icons/logo.png" alt="HCMS Logo" width={42} height={42} style={{ width: 42, height: 42, objectFit: 'contain' }} />
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 2px 0', color: '#0f172a', letterSpacing: '-0.3px' }}>
                {clinicName}
              </h1>
              <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                {settings?.address || 'Healthcare Management & Clinical Operations'}
                {settings?.phone ? ` · Ph: ${settings.phone}` : ''}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'inline-block', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '3px 8px', fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Official Clinical Activity Report
            </span>
            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
              Generated: <strong>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: '0.76rem', color: '#334155' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Reporting Period</span>
            <strong>{new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> to <strong>{new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Department Scope</span>
            <strong>{activityTab === 'ALL' ? 'All Activities (OPD & IPD)' : activityTab === 'IPD' ? 'IPD Inpatient Admissions Only' : 'OPD Consultations Only'}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Total Encounters in Period</span>
            <strong style={{ fontSize: '0.9rem', color: '#0d9488' }}>{totalEncountersCount} Encounters</strong> ({filteredOpdVisits.length} OPD · {totalIpdCount} IPD)
          </div>
        </div>
      </div>

      <div className="page-header no-print">
        <div>
          <div className="page-title">Reports &amp; Hospital Analytics</div>
          <div className="page-subtitle">
            Comprehensive OPD consultations, IPD admissions, bed utilization and clinical activity
          </div>
        </div>
        <div className="flex-wrap-header-actions no-print">
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={15} /> Export {activityTab === 'ALL' ? 'Combined CSV' : `${activityTab} CSV`}
          </button>
          <button className="btn btn-secondary" onClick={exportPDF}>
            <FileText size={15} /> Print Report
          </button>
        </div>
      </div>

      {/* Date Range & Global Search Filter */}
      <div className="card card-sm no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <label className="form-label" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>
              From
            </label>
            <input
              className="form-input"
              type="date"
              value={startDate}
              max={endDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => {
                const val = e.target.value;
                setStartDate(val);
                if (endDate && val > endDate) {
                  setEndDate(val);
                }
              }}
              style={{ width: 165 }}
            />
          </div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <label className="form-label" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>
              To
            </label>
            <input
              className="form-input"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => {
                const val = e.target.value;
                if (startDate && val < startDate) {
                  toast('To Date cannot be older than From Date.', 'error');
                  setEndDate(startDate);
                  return;
                }
                setEndDate(val);
              }}
              style={{ width: 165 }}
            />
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search by patient name, mobile, diagnosis, bed, or admission #…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Department Tabs Bar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          className="no-print"
          style={{
            display: 'inline-flex',
            background: 'var(--surface-2)',
            padding: 3,
            borderRadius: 8,
            border: '1px solid var(--border)',
            gap: 2,
            maxWidth: '100%',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            type="button"
            className={`btn btn-xs ${activityTab === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setActivityTab('ALL')}
          >
            All Hospital Activities ({totalEncountersCount})
          </button>
          <button
            type="button"
            className={`btn btn-xs ${activityTab === 'OPD' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setActivityTab('OPD')}
          >
            <Stethoscope size={13} style={{ marginRight: 4 }} />
            OPD Consultations ({filteredOpdVisits.length})
          </button>
          <button
            type="button"
            className={`btn btn-xs ${activityTab === 'IPD' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              whiteSpace: 'nowrap',
              ...(activityTab === 'IPD' ? { background: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' } : {}),
            }}
            onClick={() => setActivityTab('IPD')}
          >
            <Bed size={13} style={{ marginRight: 4 }} />
            IPD Inpatients ({totalIpdCount})
          </button>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing period: <strong>{new Date(startDate).toLocaleDateString('en-IN')}</strong> to{' '}
          <strong>{new Date(endDate).toLocaleDateString('en-IN')}</strong>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="dashboard-stats-grid">
        {[
          {
            label: 'Total Encounters',
            value: totalEncountersCount,
            color: 'var(--accent-light)',
            icon: <Activity size={20} />,
            sub: `${filteredOpdVisits.length} OPD · ${totalIpdCount} IPD`,
          },
          {
            label: 'IPD Inpatient Stays',
            value: filteredAdmissions.length,
            color: '#8b5cf6',
            icon: <Bed size={20} />,
            sub: `${filteredAdmissions.filter((a) => a.status === 'ADMITTED').length} Admitted · ${filteredAdmissions.filter((a) => a.status === 'DISCHARGED').length} Discharged`,
          },
          {
            label: 'Inpatient Billing Revenue',
            value: `₹${ipdFinancials.settled.toLocaleString('en-IN')}`,
            color: 'var(--green)',
            icon: <Receipt size={20} />,
            sub: `Total Charges: ₹${ipdFinancials.charges} · Due: ₹${ipdFinancials.dues}`,
          },
          {
            label: 'Unique Patients',
            value: allPatientIds.size,
            color: 'var(--blue)',
            icon: <Users size={20} />,
            sub: `${newInPeriod} registered in period`,
          },
        ].map((s) => (
          <div key={s.label} className="card stat-card" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: '1.45rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2, fontWeight: 600 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {isTruncated && (
        <div
          style={{
            marginBottom: 12,
            fontSize: '0.8rem',
            color: 'var(--amber)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 10,
            padding: '8px 12px',
          }}
        >
          Only the first {visits.length.toLocaleString('en-IN')} of {totalInRange.toLocaleString('en-IN')} visits in this range are included. Narrow the date range for complete figures.
        </div>
      )}

      {/* ─── SECTION 1: IPD INPATIENT ADMISSIONS & CLINICAL STAYS ─── */}
      {(activityTab === 'ALL' || activityTab === 'IPD') && (
        <div className="card" style={{ marginBottom: 20, padding: 18 }}>
          <div
            className="section-header"
            style={{
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bed size={20} style={{ color: '#8b5cf6' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>IPD Inpatient Admissions &amp; Stays</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Detailed ward census, bed occupancy, doctor rounds, and inpatient financial billing
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(139, 92, 246, 0.12)',
                  color: '#8b5cf6',
                  fontWeight: 700,
                }}
              >
                {filteredAdmissions.length} Admissions
              </span>
              <Link href="/ipd" className="btn btn-secondary btn-xs no-print">
                Ward Floor Plan →
              </Link>
            </div>
          </div>

          {loadingIpd ? (
            <div className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          ) : filteredAdmissions.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 10px' }}>
              <Bed size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
              <h4>No IPD Admissions in this Period</h4>
              <p>No patient stays were recorded between {startDate} and {endDate}.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Admission Date</th>
                    <th>Admission # &amp; Bed</th>
                    <th>Patient Name</th>
                    <th>Diagnosis &amp; Attending</th>
                    <th>Stay &amp; Rounds</th>
                    <th>Financials (Charges / Paid / Due)</th>
                    <th>Status</th>
                    <th className="no-print">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdmissions.map((adm) => {
                    const p = adm.patient || patMap.get(adm.patientId);
                    const stayDays = Math.max(
                      1,
                      Math.ceil(
                        ((adm.dischargeDate ? new Date(adm.dischargeDate).getTime() : new Date().getTime()) -
                          new Date(adm.admissionDate).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );
                    const isAdmitted = adm.status === 'ADMITTED';

                    return (
                      <tr key={adm.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 600 }}>
                            {new Date(adm.admissionDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(adm.admissionDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {adm.dischargeDate && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Disch: {new Date(adm.dischargeDate).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>{adm.admissionNumber}</div>
                          <span
                            style={{
                              background: 'rgba(139, 92, 246, 0.12)',
                              color: '#8b5cf6',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              marginTop: 2,
                            }}
                          >
                            <Bed size={11} /> {adm.bedOrRoom}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p?.name || 'Patient'}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {p?.age ? `${p.age}y` : ''} {p?.gender ? `/ ${p.gender}` : ''} {p?.mobile ? `· ${p.mobile}` : ''}
                          </div>
                        </td>

                        <td style={{ maxWidth: 200 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.84rem' }}>{adm.diagnosis || 'Inpatient Care'}</div>
                          {adm.attendingDoctor && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              Dr. {adm.attendingDoctor}
                            </div>
                          )}
                        </td>

                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          <div>
                            <strong>Day {stayDays}</strong> of stay
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                            {(adm.dayWiseLogs || []).length} round(s) charted
                          </div>
                        </td>

                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          <div>
                            Charges: <strong>₹{adm.cumulativeCharges}</strong>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                            Paid: ₹{adm.totalPaid} {Number(adm.advancePaid) > 0 ? `(Adv ₹${adm.advancePaid})` : ''}
                          </div>
                          {Number(adm.balanceDue) > 0 ? (
                            <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>
                              Due: ₹{adm.balanceDue}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bill Settled</div>
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${isAdmitted ? 'badge-green' : 'badge-gray'}`}
                            style={{ fontSize: '0.72rem', fontWeight: 700 }}
                          >
                            {isAdmitted ? '🟢 ADMITTED' : '⚪ DISCHARGED'}
                          </span>
                        </td>

                        <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Link
                              href={`/patients/${adm.patientId}`}
                              className="btn btn-ghost btn-xs"
                              title="Open Patient Profile"
                            >
                              <Users size={12} /> Profile
                            </Link>
                            <Link
                              href={`/ipd/${adm.id}/print`}
                              className="btn btn-secondary btn-xs"
                              title="Print Statement / Slip"
                            >
                              <Printer size={12} /> Slip
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── SECTION 2: OPD CONSULTATIONS & CLINICAL VISITS ─── */}
      {(activityTab === 'ALL' || activityTab === 'OPD') && (
        <div className="card" style={{ marginBottom: 20, padding: 18 }}>
          <div
            className="section-header"
            style={{
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stethoscope size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>OPD Consultations &amp; Visits</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Outpatient consultations, vitals recordings, diagnosis, and follow-up schedules
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--blue)',
                fontWeight: 700,
              }}
            >
              {filteredOpdVisits.length} Consultations
            </span>
          </div>

          {loadingVisits ? (
            <div className="skeleton" style={{ height: 260, borderRadius: 10 }} />
          ) : filteredOpdVisits.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 10px' }}>
              <Stethoscope size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
              <h4>No OPD Visits in this Period</h4>
              <p>No outpatient consultations were recorded between {startDate} and {endDate}.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Patient Name</th>
                    <th>Age / Gender</th>
                    <th>Chief Complaints</th>
                    <th>Diagnosis</th>
                    <th>BP / Pulse</th>
                    <th>Billing Status</th>
                    <th>Follow-up</th>
                    <th className="no-print">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpdVisits.map((v) => {
                    const p = patMap.get(v.patientId);
                    return (
                      <tr key={v.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 600 }}>{new Date(v.date).toLocaleDateString('en-IN')}</div>
                          <div style={{ opacity: 0.6, fontSize: '0.72rem' }}>
                            {new Date(v.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p?.name || '—'}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {p?.age ? `${p.age}y` : '—'} {p?.gender ? `/ ${p.gender}` : ''}
                        </td>
                        <td style={{ maxWidth: 160, color: 'var(--text-secondary)' }} className="truncate">
                          {v.chiefComplaints || '—'}
                        </td>
                        <td style={{ fontWeight: 500 }}>{v.diagnosis || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {v.bp ? `${v.bp}` : '—'}
                          {v.pulse ? ` / ${v.pulse}` : ''}
                        </td>
                        <td>
                          {v.bill ? (
                            Number(v.bill.balanceDue) > 0 ? (
                              <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>
                                Due ₹{v.bill.balanceDue}
                              </span>
                            ) : (
                              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                                Paid ₹{v.bill.paidAmount}
                              </span>
                            )
                          ) : (
                            <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                              Unbilled
                            </span>
                          )}
                        </td>
                        <td>
                          {v.followUpDate ? (
                            <span className={`badge ${v.followUpAttended ? 'badge-green' : 'badge-amber'}`} style={{ fontSize: '0.7rem' }}>
                              {v.followUpAttended ? '✓ Done' : new Date(v.followUpDate).toLocaleDateString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td className="no-print">
                          <Link href={`/visits/${v.id}/print`} className="btn btn-ghost btn-xs" title="Print Prescription">
                            <Printer size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
