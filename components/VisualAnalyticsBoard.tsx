"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  Receipt,
  Bed,
  Stethoscope,
  Activity,
  HeartPulse,
} from "lucide-react";
import InteractiveDonutChart, {
  DonutSlice,
} from "@/components/charts/InteractiveDonutChart";
import InteractiveBarChart, {
  BarGroupData,
} from "@/components/charts/InteractiveBarChart";
import AnalyticsDrilldownModal from "@/components/AnalyticsDrilldownModal";
import {
  buildUnifiedEncounters,
  aggregateAnalytics,
  filterEncountersBySlice,
  UnifiedEncounter,
} from "@/lib/utils/analyticsAggregations";
import type { Visit, IpdAdmission, Patient } from "@/lib/providers/types";

export interface VisualAnalyticsBoardProps {
  visits: Visit[];
  admissions: IpdAdmission[];
  patMap: Map<string, Patient>;
  onRefreshData?: () => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (start: string, end: string) => void;
}

export default function VisualAnalyticsBoard({
  visits,
  admissions,
  patMap,
  onRefreshData,
  startDate,
  endDate,
  onDateRangeChange,
}: VisualAnalyticsBoardProps) {
  const [granularity, setGranularity] = useState<"day" | "month" | "year">("month");

  // Selected year for monthly timeline
  const selectedYear = useMemo(() => {
    if (startDate) return new Date(startDate).getFullYear();
    return new Date().getFullYear();
  }, [startDate]);

  // Active Drill-Down state
  const [drilldownTarget, setDrilldownTarget] = useState<{
    title: string;
    subtitle?: string;
    sliceId: string;
    metadata?: any;
    color: string;
  } | null>(null);

  // Build unified encounters
  const unifiedEncounters = useMemo(() => {
    return buildUnifiedEncounters(visits, admissions, patMap);
  }, [visits, admissions, patMap]);

  // Compute aggregated analytics
  const summary = useMemo(() => {
    return aggregateAnalytics(unifiedEncounters, granularity, selectedYear);
  }, [unifiedEncounters, granularity, selectedYear]);

  // Slices for Drill-Down Modal
  const drilldownEncounters = useMemo(() => {
    if (!drilldownTarget) return [];
    return filterEncountersBySlice(
      summary.encounters,
      drilldownTarget.sliceId,
      drilldownTarget.metadata
    );
  }, [summary.encounters, drilldownTarget]);

  // Time-Horizon Quick Presets
  const applyPreset = (preset: "today" | "this-month" | "last-month" | "this-year") => {
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);

    if (preset === "today") {
      onDateRangeChange(todayISO, todayISO);
      setGranularity("day");
    } else if (preset === "this-month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      onDateRangeChange(firstDay, todayISO);
      setGranularity("day");
    } else if (preset === "last-month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
      onDateRangeChange(firstDayLastMonth, lastDayLastMonth);
      setGranularity("day");
    } else if (preset === "this-year") {
      const startYear = `${now.getFullYear()}-01-01`;
      const endYear = `${now.getFullYear()}-12-31`;
      onDateRangeChange(startYear, endYear);
      setGranularity("month");
    }
  };

  // Handlers for slice and bar clicks
  const handleSliceClick = (slice: DonutSlice, sectionName: string) => {
    setDrilldownTarget({
      title: `${slice.label} — ${sectionName}`,
      subtitle: `${slice.subText || slice.formattedValue || ""} · Click records to view or settle`,
      sliceId: slice.id,
      metadata: slice.metadata,
      color: slice.color,
    });
  };

  const handleBarClick = (bar: BarGroupData) => {
    const total =
      (bar.values.collected || 0) + (bar.values.dues || 0);
    setDrilldownTarget({
      title: `${bar.label} Overview`,
      subtitle: `${bar.subLabel ? `${bar.subLabel} · ` : ""}₹${total.toLocaleString("en-IN")} total billing · ${bar.metadata?.encountersCount || 0} encounters`,
      sliceId: bar.id,
      metadata: bar.metadata,
      color: "var(--primary)",
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── TIME-HORIZON & GRANULARITY CONTROL BAR ─── */}
      <div
        className="card card-sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          background: "var(--surface-1)",
        }}
      >
        {/* Quick Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>
            PERIOD:
          </span>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => applyPreset("today")}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => applyPreset("this-month")}
          >
            This Month
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => applyPreset("last-month")}
          >
            Last Month
          </button>
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={() => applyPreset("this-year")}
          >
            This Year ({selectedYear})
          </button>
        </div>

        {/* Date Inputs & Granularity Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
            <span style={{ color: "var(--text-muted)" }}>From:</span>
            <input
              type="date"
              className="form-input form-input-sm"
              value={startDate}
              max={endDate}
              onChange={(e) => onDateRangeChange(e.target.value, endDate)}
              style={{ width: 140 }}
            />
            <span style={{ color: "var(--text-muted)" }}>To:</span>
            <input
              type="date"
              className="form-input form-input-sm"
              value={endDate}
              min={startDate}
              onChange={(e) => onDateRangeChange(startDate, e.target.value)}
              style={{ width: 140 }}
            />
          </div>

          {/* Granularity Switcher */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--surface-2)",
              borderRadius: 8,
              padding: 2,
              border: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className={`btn btn-xs ${granularity === "day" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setGranularity("day")}
            >
              Day-Wise
            </button>
            <button
              type="button"
              className={`btn btn-xs ${granularity === "month" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setGranularity("month")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`btn btn-xs ${granularity === "year" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setGranularity("year")}
            >
              Yearly
            </button>
          </div>
        </div>
      </div>

      {/* ─── EXECUTIVE METRICS CARDS ROW ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {/* Card 1: Total Billed */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid var(--primary)",
            background: "var(--surface-1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
              TOTAL GROSS BILLING
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(59, 130, 246, 0.12)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: 8 }}>
            ₹{summary.totalBilled.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
            Across {summary.totalEncounters} clinical visits &amp; admissions
          </div>
        </div>

        {/* Card 2: Collected Earnings */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid #10b981",
            background: "var(--surface-1)",
            cursor: "pointer",
          }}
          onClick={() =>
            setDrilldownTarget({
              title: "Collected Hospital Earnings",
              subtitle: "All patient encounters with payments settled",
              sliceId: "FIN_COLLECTED",
              color: "#10b981",
            })
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
              COLLECTED EARNINGS
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: 8, color: "#10b981" }}>
            ₹{summary.totalCollected.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: 4 }}>
            {summary.collectionRate.toFixed(1)}% collection recovery rate ·{" "}
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>Inspect →</span>
          </div>
        </div>

        {/* Card 3: Pending Dues */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: `4px solid ${summary.totalPendingDues > 0 ? "#f59e0b" : "var(--border)"}`,
            background: "var(--surface-1)",
            cursor: "pointer",
          }}
          onClick={() =>
            setDrilldownTarget({
              title: "Outstanding Pending Dues",
              subtitle: "Patients with unpaid balances requiring settlement",
              sliceId: "FIN_DUES",
              color: "#f59e0b",
            })
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
              REMAINING PENDING DUES
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.12)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: 8, color: summary.totalPendingDues > 0 ? "#f59e0b" : "inherit" }}>
            ₹{summary.totalPendingDues.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: 4 }}>
            Pending balance to collect ·{" "}
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>Inspect &amp; Settle →</span>
          </div>
        </div>

        {/* Card 4: Patients Volume */}
        <div
          className="card"
          style={{
            padding: "16px 20px",
            borderLeft: "4px solid #06b6d4",
            background: "var(--surface-1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
              PATIENTS &amp; VOLUME
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(6, 182, 212, 0.12)",
                color: "#06b6d4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, marginTop: 8 }}>
            {summary.uniquePatientsCount} Patients
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
            {summary.totalEncounters} total hospital encounters
          </div>
        </div>
      </div>

      {/* ─── ROW 1: FINANCIAL FLOW & TIMELINE CHARTS ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 20,
        }}
      >
        {/* Earnings vs Remaining Dues Pie/Donut Chart */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <InteractiveDonutChart
            title="Earnings vs. Remaining Dues"
            subtitle="Realized collected earnings compared to uncollected balance"
            data={summary.financialDonut}
            totalLabel="Gross Billed"
            totalFormatted={`₹${summary.totalBilled.toLocaleString("en-IN")}`}
            size={260}
            onSliceClick={(slice) => handleSliceClick(slice, "Financial Analysis")}
          />
        </div>

        {/* Timeline Revenue Trajectory Bar Chart */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <InteractiveBarChart
            title={`Hospital Earnings Timeline (${granularity === "day" ? "Day-by-Day" : granularity === "month" ? `${selectedYear} Monthly` : "Year-over-Year"})`}
            subtitle="Collected earnings (Green) vs Remaining dues (Amber) over time"
            series={[
              { key: "collected", label: "Collected", color: "#10b981" },
              { key: "dues", label: "Pending Due", color: "#f59e0b" },
            ]}
            data={summary.timelineBars}
            height={260}
            stacked={true}
            valuePrefix="₹"
            onBarClick={handleBarClick}
          />
        </div>
      </div>

      {/* ─── ROW 2: DEPARTMENT / CATEGORY MIX & BILL STATUS ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 20,
        }}
      >
        {/* Visit Category Distribution Donut */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <InteractiveDonutChart
            title="Hospital Encounters by Category"
            subtitle="Breakdown between OPD, IPD Admissions, Emergency, and Custom Departments"
            data={summary.categoryDonut}
            totalLabel="Total Visits"
            totalFormatted={`${summary.totalEncounters} Encounters`}
            size={260}
            onSliceClick={(slice) => handleSliceClick(slice, "Category Encounter")}
          />
        </div>

        {/* Bill Status & Payment Settled Donut */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <InteractiveDonutChart
            title="Invoice & Settlement Status"
            subtitle="Distribution of fully settled, partially paid, and completely unpaid visits"
            data={summary.billStatusDonut}
            totalLabel="Invoices"
            totalFormatted={`${summary.totalEncounters} Bills`}
            size={260}
            onSliceClick={(slice) => handleSliceClick(slice, "Bill Status")}
          />
        </div>
      </div>

      {/* ─── ROW 3: CLINICAL & DEMOGRAPHIC INSIGHTS ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
        }}
      >
        {/* Top Diagnoses Card */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <HeartPulse size={18} style={{ color: "var(--accent)" }} />
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Top Diagnoses &amp; Presenting Complaints
            </div>
          </div>
          {summary.demographics.topDiagnoses.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "16px 0" }}>
              No diagnoses recorded in this period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {summary.demographics.topDiagnoses.map((dx, i) => {
                const maxCount = summary.demographics.topDiagnoses[0]?.count || 1;
                const pct = (dx.count / maxCount) * 100;
                return (
                  <div key={dx.name}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {i + 1}. {dx.name}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                        {dx.count} {dx.count === 1 ? "case" : "cases"}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--surface-3)",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--primary)",
                          borderRadius: 3,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gender Demographics Card */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Users size={18} style={{ color: "#06b6d4" }} />
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Patient Gender Demographics
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Male */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Male Patients</span>
                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                  {summary.demographics.maleCount} (
                  {summary.totalEncounters > 0
                    ? ((summary.demographics.maleCount / summary.totalEncounters) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${summary.totalEncounters > 0 ? (summary.demographics.maleCount / summary.totalEncounters) * 100 : 0}%`,
                    background: "#3b82f6",
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>

            {/* Female */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Female Patients</span>
                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                  {summary.demographics.femaleCount} (
                  {summary.totalEncounters > 0
                    ? ((summary.demographics.femaleCount / summary.totalEncounters) * 100).toFixed(0)
                    : 0}
                  %)
                </span>
              </div>
              <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${summary.totalEncounters > 0 ? (summary.demographics.femaleCount / summary.totalEncounters) * 100 : 0}%`,
                    background: "#ec4899",
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>

            {/* Other */}
            {summary.demographics.otherCount > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Other</span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                    {summary.demographics.otherCount}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${summary.totalEncounters > 0 ? (summary.demographics.otherCount / summary.totalEncounters) * 100 : 0}%`,
                      background: "#14b8a6",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── INTERACTIVE DRILL-DOWN MODAL ─── */}
      {drilldownTarget && (
        <AnalyticsDrilldownModal
          isOpen={!!drilldownTarget}
          onClose={() => setDrilldownTarget(null)}
          title={drilldownTarget.title}
          subtitle={drilldownTarget.subtitle}
          encounters={drilldownEncounters}
          badgeColor={drilldownTarget.color}
          onRefreshData={onRefreshData}
        />
      )}
    </div>
  );
}
