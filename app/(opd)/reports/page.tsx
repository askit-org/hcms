'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Download, FileText, Calendar, Users, Search } from 'lucide-react';
import { useReports, usePatients } from '@/lib/hooks/useQueries';
import PageTransition from '@/components/PageTransition';
import { toast } from '@/components/Toast';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [query, setQuery] = useState('');
  
  // Custom debouncing hook if available, otherwise just use a fast effect
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: patients = [] } = usePatients();
  const { data: visits = [], isLoading } = useReports(startDate, endDate);

  const patMap = new Map(patients.map(p => [p.patientId, p]));

  const filteredVisits = visits.filter(v => {
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
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Stats for the period
  const periodPatientIds = new Set(filteredVisits.map(v => v.patientId));
  const allPatientIds = new Set(patients.map(p => p.patientId));
  const newInPeriod = [...periodPatientIds].filter(id => {
    const firstVisit = visits.filter(v => v.patientId === id).sort((a, b) => a.date.localeCompare(b.date))[0];
    return firstVisit && firstVisit.date.split('T')[0] >= startDate && firstVisit.date.split('T')[0] <= endDate;
  }).length;

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Patient ID', 'Name', 'Age', 'Mobile', 'Chief Complaints', 'Diagnosis', 'BP', 'Pulse', 'Temp', 'Follow-up Date'];
    const rows = filteredVisits.map(v => {
      const p = patMap.get(v.patientId);
      return [
        new Date(v.date).toLocaleDateString('en-IN'),
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
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OPD_Report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF (via print)
  const exportPDF = () => {
    window.print();
  };

  // Daily visit counts
  const dailyCounts = filteredVisits.reduce((acc, v) => {
    const d = v.date.split('T')[0];
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const peakDay = Object.entries(dailyCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <PageTransition>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">OPD visit records and analytics</div>
        </div>
        <div className="flex-wrap-header-actions">
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={15} /> Export CSV</button>
          <button className="btn btn-secondary" onClick={exportPDF}><FileText size={15} /> Print PDF</button>
        </div>
      </div>

      {/* Date Range */}
      <div className="card card-sm" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <label className="form-label" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>From</label>
            <input
              className="form-input"
              type="date"
              value={startDate}
              max={endDate || new Date().toISOString().split('T')[0]}
              onChange={e => {
                const val = e.target.value;
                setStartDate(val);
                if (endDate && val > endDate) {
                  setEndDate(val);
                }
              }}
              style={{ width: 170 }}
            />
          </div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
            <label className="form-label" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>To</label>
            <input
              className="form-input"
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => {
                const val = e.target.value;
                if (startDate && val < startDate) {
                  toast('To Date cannot be older than From Date.', 'error');
                  setEndDate(startDate);
                  return;
                }
                setEndDate(val);
              }}
              style={{ width: 170 }}
            />
          </div>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Filter by name, mobile, diagnosis…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="dashboard-stats-grid">
        {[
          { label: 'Total Visits', value: filteredVisits.length, color: 'var(--accent-light)', icon: <BarChart3 size={20} /> },
          { label: 'Unique Patients', value: periodPatientIds.size, color: 'var(--blue)', icon: <Users size={20} /> },
          { label: 'New Patients', value: newInPeriod, color: 'var(--green)', icon: <Users size={20} /> },
          { label: 'Peak Day', value: peakDay ? `${peakDay[1]} visits` : '—', color: 'var(--amber)', icon: <Calendar size={20} />, sub: peakDay ? new Date(peakDay[0]).toLocaleDateString('en-IN') : '' },
        ].map(s => (
          <div key={s.label} className="card stat-card" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Visits Table */}
      {isLoading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 10 }} />
      ) : filteredVisits.length === 0 ? (
        <div className="empty-state"><BarChart3 /><h4>No Visits in This Period</h4><p>Adjust the date range or filters.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Patient ID</th>
                <th>Patient Name</th>
                <th>Age</th>
                <th>Chief Complaints</th>
                <th>Diagnosis</th>
                <th>BP / Pulse</th>
                <th>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.map(v => {
                const p = patMap.get(v.patientId);
                return (
                  <tr key={v.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {new Date(v.date).toLocaleDateString('en-IN')}<br />
                      <span style={{ opacity: 0.6 }}>{new Date(v.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td><span className="badge badge-teal">{v.patientId}</span></td>
                    <td style={{ fontWeight: 600 }}>{p?.name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{p?.age ? `${p.age}y` : '—'}</td>
                    <td style={{ maxWidth: 160, color: 'var(--text-secondary)' }} className="truncate">{v.chiefComplaints || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{v.diagnosis || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {v.bp ? `${v.bp}` : '—'}
                      {v.pulse ? ` / ${v.pulse}` : ''}
                    </td>
                    <td>
                      {v.followUpDate ? (
                        <span className={`badge ${v.followUpAttended ? 'badge-green' : 'badge-amber'}`}>
                          {v.followUpAttended ? '✓ Done' : new Date(v.followUpDate).toLocaleDateString('en-IN')}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
