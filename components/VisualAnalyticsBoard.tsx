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
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
  Sparkles,
  LayoutDashboard,
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
  // Localized timeline settings (specifically for the timeline bar chart)
  const [timelineGranularity, setTimelineGranularity] = useState<"day" | "month" | "year">("month");
  
  const currentYear = new Date().getFullYear();
  const [timelineYear, setTimelineYear] = useState<number>(() => {
    if (startDate) return new Date(startDate).getFullYear();
    return currentYear;
  });

  // Active Drill-Down state
  const [drilldownTarget, setDrilldownTarget] = useState<{
    title: string;
    subtitle?: string;
    sliceId: string;
    metadata?: any;
    color: string;
  } | null>(null);

  type AnalyticsTab = "OVERVIEW" | "FINANCIALS" | "DEPARTMENTS" | "DEMOGRAPHICS" | "ALL";
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("OVERVIEW");

  // Compute number of days in selected period
  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 30;
    const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  }, [startDate, endDate]);

  // Build unified encounters
  const unifiedEncounters = useMemo(() => {
    return buildUnifiedEncounters(visits, admissions, patMap);
  }, [visits, admissions, patMap]);

  // Compute aggregated analytics
  const summary = useMemo(() => {
    return aggregateAnalytics(
      unifiedEncounters,
      timelineGranularity,
      timelineYear,
      dateRangeDays
    );
  }, [unifiedEncounters, timelineGranularity, timelineYear, dateRangeDays]);

  // Slices for Drill-Down Modal
  const drilldownEncounters = useMemo(() => {
    if (!drilldownTarget) return [];
    return filterEncountersBySlice(
      summary.encounters,
      drilldownTarget.sliceId,
      drilldownTarget.metadata
    );
  }, [summary.encounters, drilldownTarget]);

  // Determine which preset is currently active
  const activePreset = useMemo(() => {
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    const startYear = `${now.getFullYear()}-01-01`;
    const endYear = `${now.getFullYear()}-12-31`;

    if (startDate === todayISO && endDate === todayISO) return "today";
    if (startDate === firstDayThisMonth && endDate === todayISO) return "this-month";
    if (startDate === firstDayLastMonth && endDate === lastDayLastMonth) return "last-month";
    if (startDate === startYear && endDate === endYear) return "this-year";
    if (startDate <= "2020-01-01") return "all-time";
    return "custom";
  }, [startDate, endDate]);

  // Time-Horizon Quick Presets
  const applyPreset = (preset: "today" | "this-month" | "last-month" | "this-year" | "all-time") => {
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);

    if (preset === "today") {
      onDateRangeChange(todayISO, todayISO);
    } else if (preset === "this-month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      onDateRangeChange(firstDay, todayISO);
    } else if (preset === "last-month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString()
        .slice(0, 10);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10);
      onDateRangeChange(firstDayLastMonth, lastDayLastMonth);
    } else if (preset === "this-year") {
      const startYear = `${now.getFullYear()}-01-01`;
      const endYear = `${now.getFullYear()}-12-31`;
      onDateRangeChange(startYear, endYear);
      setTimelineYear(now.getFullYear());
    } else if (preset === "all-time") {
      onDateRangeChange("2020-01-01", todayISO);
    }
  };

  // Handlers for slice and bar clicks
  const handleSliceClick = (slice: DonutSlice, sectionName: string) => {
    setDrilldownTarget({
      title: `${slice.label} — ${sectionName}`,
      subtitle: `${slice.subText || slice.formattedValue || ""} · Click records to view details or settle dues`,
      sliceId: slice.id,
      metadata: slice.metadata,
      color: slice.color,
    });
  };

  const handleBarClick = (bar: BarGroupData) => {
    const total = (bar.values.collected || 0) + (bar.values.dues || 0);
    setDrilldownTarget({
      title: `${bar.label} Overview`,
      subtitle: `${bar.subLabel ? `${bar.subLabel} · ` : ""}₹${total.toLocaleString("en-IN")} total billing · ${bar.metadata?.encountersCount || 0} encounters`,
      sliceId: bar.id,
      metadata: bar.metadata,
      color: "var(--primary)",
    });
  };

  // Timeline header controls (Day / Month / Year switcher + Year selector)
  const timelineControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {/* Month Year Selector */}
      {timelineGranularity === "month" && (
        <select
          className="form-select form-select-sm"
          value={timelineYear}
          onChange={(e) => setTimelineYear(Number(e.target.value))}
          style={{
            height: 28,
            fontSize: "0.75rem",
            padding: "2px 8px",
            borderRadius: 6,
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "var(--text-primary)",
            fontWeight: 700,
          }}
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>
      )}

      {/* Segmented Switcher */}
      <div
        style={{
          display: "inline-flex",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: 8,
          padding: 2,
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <button
          type="button"
          onClick={() => setTimelineGranularity("day")}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: "0.74rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: timelineGranularity === "day" ? "var(--primary)" : "transparent",
            color: timelineGranularity === "day" ? "#fff" : "var(--text-muted)",
            boxShadow: timelineGranularity === "day" ? "0 2px 8px rgba(59, 130, 246, 0.4)" : "none",
          }}
        >
          Daily
        </button>
        <button
          type="button"
          onClick={() => setTimelineGranularity("month")}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: "0.74rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: timelineGranularity === "month" ? "var(--primary)" : "transparent",
            color: timelineGranularity === "month" ? "#fff" : "var(--text-muted)",
            boxShadow: timelineGranularity === "month" ? "0 2px 8px rgba(59, 130, 246, 0.4)" : "none",
          }}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setTimelineGranularity("year")}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: "0.74rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: timelineGranularity === "year" ? "var(--primary)" : "transparent",
            color: timelineGranularity === "year" ? "#fff" : "var(--text-muted)",
            boxShadow: timelineGranularity === "year" ? "0 2px 8px rgba(59, 130, 246, 0.4)" : "none",
          }}
        >
          Yearly
        </button>
      </div>
    </div>
  );

  // Reusable Clinical & Inpatient card components
  const renderTopDiagnosesCard = () => (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <HeartPulse size={17} style={{ color: "#ec4899" }} />
        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
          Top Diagnoses &amp; Presenting Complaints
        </div>
      </div>
      {summary.demographics.topDiagnoses.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>
          No diagnoses recorded in this reporting period.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {summary.demographics.topDiagnoses.slice(0, 6).map((dx, i) => {
            const maxCount = summary.demographics.topDiagnoses[0]?.count || 1;
            const pct = (dx.count / maxCount) * 100;
            return (
              <div key={dx.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {i + 1}. {dx.name}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                    {dx.count} {dx.count === 1 ? "case" : "cases"}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: "#ec4899",
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
  );

  const renderDemographicsCard = () => (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Users size={17} style={{ color: "#06b6d4" }} />
        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
          Patient Age &amp; Gender Demographics
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Gender Breakdown */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Gender Distribution</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
              {summary.demographics.maleCount} Male · {summary.demographics.femaleCount} Female
            </span>
          </div>
          <div style={{ height: 8, display: "flex", borderRadius: 4, overflow: "hidden", background: "rgba(255, 255, 255, 0.06)" }}>
            <div
              style={{
                height: "100%",
                width: `${summary.totalEncounters > 0 ? (summary.demographics.maleCount / summary.totalEncounters) * 100 : 0}%`,
                background: "#3b82f6",
              }}
              title="Male"
            />
            <div
              style={{
                height: "100%",
                width: `${summary.totalEncounters > 0 ? (summary.demographics.femaleCount / summary.totalEncounters) * 100 : 0}%`,
                background: "#ec4899",
              }}
              title="Female"
            />
          </div>
        </div>

        {/* Age Brackets */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Pediatric (0-14y)</div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#38bdf8", marginTop: 2 }}>
              {summary.demographics.ageBrackets.pediatric}
            </div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Youth (15-24y)</div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#a855f7", marginTop: 2 }}>
              {summary.demographics.ageBrackets.youth}
            </div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Adults (25-59y)</div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#10b981", marginTop: 2 }}>
              {summary.demographics.ageBrackets.adult}
            </div>
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Seniors (60y+)</div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f59e0b", marginTop: 2 }}>
              {summary.demographics.ageBrackets.senior}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInpatientMetricsCard = () => (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Activity size={17} style={{ color: "#10b981" }} />
        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)" }}>
          Hospital &amp; Inpatient Metrics
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Currently Admitted (IPD)</span>
          <span style={{ fontWeight: 800, color: "#10b981", fontSize: "0.92rem" }}>
            {summary.activeInpatientsCount} Inpatients
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Average Length of Stay (ALOS)</span>
          <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.92rem" }}>
            {summary.averageLengthOfStay} Days
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Patient Retention Ratio</span>
          <span style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.92rem" }}>
            {summary.returningPatientRatio}%
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Daily Encounter Velocity</span>
          <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.92rem" }}>
            {summary.dailyAverageEncounters} / day
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ─── GLOBAL REPORTING PERIOD TOOLBAR ─── */}
      <div
        className="card card-sm"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          padding: "12px 16px",
          borderRadius: 12,
        }}
      >
        {/* Quick Period Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", marginRight: 2, letterSpacing: "0.04em" }}>
            SCOPE:
          </span>
          {[
            { id: "today", label: "Today" },
            { id: "this-month", label: "This Month" },
            { id: "last-month", label: "Last Month" },
            { id: "this-year", label: `This Year (${currentYear})` },
            { id: "all-time", label: "All Time" },
          ].map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id as any)}
                style={{
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: "0.76rem",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: isActive ? "var(--primary)" : "rgba(255, 255, 255, 0.04)",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Date Inputs & Refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>From:</span>
            <input
              type="date"
              className="form-input form-input-sm"
              value={startDate}
              max={endDate}
              onChange={(e) => onDateRangeChange(e.target.value, endDate)}
              style={{ width: 130, padding: "3px 8px", fontSize: "0.78rem" }}
            />
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>To:</span>
            <input
              type="date"
              className="form-input form-input-sm"
              value={endDate}
              min={startDate}
              onChange={(e) => onDateRangeChange(startDate, e.target.value)}
              style={{ width: 130, padding: "3px 8px", fontSize: "0.78rem" }}
            />
          </div>

          {onRefreshData && (
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={onRefreshData}
              title="Refresh Analytics Dataset"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                borderRadius: 6,
                padding: "5px 9px",
                border: "1px solid var(--border)",
              }}
            >
              <RotateCcw size={13} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* ─── EXECUTIVE SECTION TABS (UNCLUTTERED ENTERPRISE NAVIGATION) ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--surface-1)",
          padding: "4px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {[
          { id: "OVERVIEW", label: "Executive Overview", icon: LayoutDashboard },
          { id: "FINANCIALS", label: "Financials & Revenue", icon: Wallet },
          { id: "DEPARTMENTS", label: "Departments & IPD", icon: Bed },
          { id: "DEMOGRAPHICS", label: "Demographics & Clinical", icon: Users },
          { id: "ALL", label: "All Analytics", icon: BarChart3 },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as AnalyticsTab)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: "0.78rem",
                fontWeight: isActive ? 700 : 500,
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
                background: isActive ? "var(--primary)" : "transparent",
                color: isActive ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── EXECUTIVE METRICS CARDS ROW (FLAT ENTERPRISE CARDS) ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 14,
        }}
      >
        {/* Card 1: Gross Billing */}
        <div
          className="card"
          style={{
            padding: "16px 18px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
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
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 6, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            ₹{summary.totalBilled.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
            {summary.totalEncounters} total encounters in period
          </div>
        </div>

        {/* Card 2: Collected Earnings */}
        <div
          className="card"
          style={{
            padding: "16px 18px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            cursor: "pointer",
            transition: "all 0.18s ease",
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
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              COLLECTED REVENUE
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
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 6, color: "#10b981", letterSpacing: "-0.02em" }}>
            ₹{summary.totalCollected.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
            {summary.collectionRate.toFixed(1)}% recovery rate ·{" "}
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>Inspect →</span>
          </div>
        </div>

        {/* Card 3: Outstanding Dues */}
        <div
          className="card"
          style={{
            padding: "16px 18px",
            background: "var(--surface-1)",
            border: `1px solid ${summary.totalPendingDues > 0 ? "rgba(245, 158, 11, 0.3)" : "var(--border)"}`,
            borderRadius: 12,
            cursor: "pointer",
            transition: "all 0.18s ease",
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
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              OUTSTANDING DUES
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
          <div
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              marginTop: 6,
              color: summary.totalPendingDues > 0 ? "#f59e0b" : "inherit",
              letterSpacing: "-0.02em",
            }}
          >
            ₹{summary.totalPendingDues.toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: 4 }}>
            Pending balance ·{" "}
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>Inspect &amp; Settle →</span>
          </div>
        </div>

        {/* Card 4: Patients & ARPU */}
        <div
          className="card"
          style={{
            padding: "16px 18px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              PATIENT VOLUME &amp; ARPU
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
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 6, letterSpacing: "-0.02em" }}>
            {summary.uniquePatientsCount} <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Patients</span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
            ₹{summary.arpu.toLocaleString("en-IN")} ARPU · {summary.dailyAverageEncounters}/day
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENT AREA ─── */}

      {/* HOSPITAL REVENUE TRAJECTORY BAR CHART (Visible on Overview, Financials, All) */}
      {(activeTab === "OVERVIEW" || activeTab === "FINANCIALS" || activeTab === "ALL") && (
        <div
          className="card"
          style={{
            padding: "18px 20px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}
        >
          <InteractiveBarChart
            title={`Hospital Revenue & Trajectory (${timelineGranularity === "day" ? "Day-by-Day" : timelineGranularity === "month" ? `${timelineYear} Monthly Timeline` : "Multi-Year Trajectory"})`}
            subtitle="Collected Cash/UPI (Green) vs. Unpaid Balance (Amber). Click any bar to inspect underlying encounters."
            series={[
              { key: "collected", label: "Collected Cash/UPI", color: "#10b981" },
              { key: "dues", label: "Unpaid Balance", color: "#f59e0b" },
            ]}
            data={summary.timelineBars}
            height={280}
            stacked={true}
            valuePrefix="₹"
            onBarClick={handleBarClick}
            headerControls={timelineControls}
          />
        </div>
      )}

      {/* ─── TAB 1: EXECUTIVE OVERVIEW ─── */}
      {activeTab === "OVERVIEW" && (
        <>
          {/* Key Visual Donuts Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <InteractiveDonutChart
                title="Earnings vs. Remaining Dues"
                subtitle="Gross billings realized vs. uncollected patient balance"
                data={summary.financialDonut}
                totalLabel="Gross Billed"
                totalFormatted={`₹${summary.totalBilled.toLocaleString("en-IN")}`}
                size={240}
                onSliceClick={(slice) => handleSliceClick(slice, "Financial Dues")}
              />
            </div>

            <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <InteractiveDonutChart
                title="Hospital Encounters by Department"
                subtitle="Distribution between OPD, IPD, Emergency, Daycare, and Custom"
                data={summary.categoryDonut}
                totalLabel="Total Visits"
                totalFormatted={`${summary.totalEncounters} Encounters`}
                size={240}
                onSliceClick={(slice) => handleSliceClick(slice, "Department Category")}
              />
            </div>
          </div>

          {/* Operational & Clinical Pulse Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
            {renderTopDiagnosesCard()}
            {renderInpatientMetricsCard()}
          </div>
        </>
      )}

      {/* ─── TAB 2: FINANCIALS & REVENUE ─── */}
      {activeTab === "FINANCIALS" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16 }}>
          <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <InteractiveDonutChart
              title="Earnings vs. Remaining Dues"
              subtitle="Gross billings realized vs. uncollected patient balance"
              data={summary.financialDonut}
              totalLabel="Gross Billed"
              totalFormatted={`₹${summary.totalBilled.toLocaleString("en-IN")}`}
              size={240}
              onSliceClick={(slice) => handleSliceClick(slice, "Financial Dues")}
            />
          </div>

          <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <InteractiveDonutChart
              title="Payment Channels & Collection Modes"
              subtitle="Breakdown between physical Cash, instant UPI / QR, and outstanding balance"
              data={summary.paymentChannelDonut}
              totalLabel="Collections"
              totalFormatted={`₹${summary.totalCollected.toLocaleString("en-IN")}`}
              size={240}
              onSliceClick={(slice) => handleSliceClick(slice, "Payment Channel")}
            />
          </div>

          <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <InteractiveDonutChart
              title="Invoice Settlement & Compliance"
              subtitle="Patient bills categorized into fully settled, partially paid, or completely unpaid"
              data={summary.billStatusDonut}
              totalLabel="Total Bills"
              totalFormatted={`${summary.totalEncounters} Invoices`}
              size={240}
              onSliceClick={(slice) => handleSliceClick(slice, "Bill Status")}
            />
          </div>
        </div>
      )}

      {/* ─── TAB 3: DEPARTMENTS & IPD ─── */}
      {activeTab === "DEPARTMENTS" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
            <InteractiveDonutChart
              title="Hospital Encounters by Department / Category"
              subtitle="Distribution between OPD, IPD Inpatients, Emergency, Daycare, and Custom"
              data={summary.categoryDonut}
              totalLabel="Total Visits"
              totalFormatted={`${summary.totalEncounters} Encounters`}
              size={240}
              onSliceClick={(slice) => handleSliceClick(slice, "Department Category")}
            />
          </div>

          {renderInpatientMetricsCard()}
        </div>
      )}

      {/* ─── TAB 4: DEMOGRAPHICS & CLINICAL ─── */}
      {activeTab === "DEMOGRAPHICS" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
          {renderTopDiagnosesCard()}
          {renderDemographicsCard()}
        </div>
      )}

      {/* ─── TAB 5: ALL ANALYTICS (FULL COMPREHENSIVE VIEW) ─── */}
      {activeTab === "ALL" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <InteractiveDonutChart
                title="Earnings vs. Remaining Dues"
                subtitle="Gross billings realized vs. uncollected patient balance"
                data={summary.financialDonut}
                totalLabel="Gross Billed"
                totalFormatted={`₹${summary.totalBilled.toLocaleString("en-IN")}`}
                size={240}
                onSliceClick={(slice) => handleSliceClick(slice, "Financial Dues")}
              />
            </div>

            <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <InteractiveDonutChart
                title="Payment Channels & Collection Modes"
                subtitle="Breakdown between physical Cash, instant UPI / QR, and outstanding balance"
                data={summary.paymentChannelDonut}
                totalLabel="Collections"
                totalFormatted={`₹${summary.totalCollected.toLocaleString("en-IN")}`}
                size={240}
                onSliceClick={(slice) => handleSliceClick(slice, "Payment Channel")}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <InteractiveDonutChart
                title="Hospital Encounters by Department / Category"
                subtitle="Distribution between OPD, IPD Inpatients, Emergency, Daycare, and Custom"
                data={summary.categoryDonut}
                totalLabel="Total Visits"
                totalFormatted={`${summary.totalEncounters} Encounters`}
                size={240}
                onSliceClick={(slice) => handleSliceClick(slice, "Department Category")}
              />
            </div>

            <div className="card" style={{ padding: "18px 20px", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <InteractiveDonutChart
                title="Invoice Settlement & Compliance"
                subtitle="Patient bills categorized into fully settled, partially paid, or completely unpaid"
                data={summary.billStatusDonut}
                totalLabel="Total Bills"
                totalFormatted={`${summary.totalEncounters} Invoices`}
                size={240}
                onSliceClick={(slice) => handleSliceClick(slice, "Bill Status")}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
            {renderTopDiagnosesCard()}
            {renderDemographicsCard()}
            {renderInpatientMetricsCard()}
          </div>
        </>
      )}

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
