"use client";

import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartEvent,
  ActiveElement,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export interface BarSeriesItem {
  key: string;
  label: string;
  color: string;
}

export interface BarGroupData {
  id: string;
  label: string;
  subLabel?: string;
  values: Record<string, number>;
  formattedValues?: Record<string, string>;
  metadata?: any;
}

export interface InteractiveBarChartProps {
  title?: string;
  subtitle?: string;
  series: BarSeriesItem[];
  data: BarGroupData[];
  height?: number;
  stacked?: boolean;
  valuePrefix?: string;
  onBarClick?: (group: BarGroupData) => void;
  emptyMessage?: string;
  headerControls?: React.ReactNode;
}

export default function InteractiveBarChart({
  title,
  subtitle,
  series,
  data,
  height = 280,
  stacked = true,
  valuePrefix = "₹",
  onBarClick,
  emptyMessage = "No timeline data recorded for this selection",
  headerControls,
}: InteractiveBarChartProps) {
  const chartRef = useRef<any>(null);

  const formatShortNumber = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toFixed(0);
  };

  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => d.label),
      datasets: series.map((s) => ({
        label: s.label,
        data: data.map((d) => d.values[s.key] || 0),
        backgroundColor: s.color,
        hoverBackgroundColor: s.color,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 34,
      })),
    };
  }, [data, series]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: "easeOutQuart" as const,
      },
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      scales: {
        x: {
          stacked,
          grid: {
            display: false,
          },
          ticks: {
            color: "#94a3b8",
            font: {
              size: 11,
              weight: 500,
            },
          },
          border: {
            color: "rgba(255, 255, 255, 0.1)",
          },
        },
        y: {
          stacked,
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
            borderDash: [3, 4],
          },
          ticks: {
            color: "#94a3b8",
            font: {
              size: 11,
            },
            callback: function (value: any) {
              return `${valuePrefix}${formatShortNumber(value)}`;
            },
          },
          border: {
            display: false,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          boxPadding: 4,
          callbacks: {
            title: function (contexts: any[]) {
              if (!contexts || contexts.length === 0) return "";
              const idx = contexts[0].dataIndex;
              const g = data[idx];
              return `${g?.label || ""} ${g?.subLabel ? `(${g.subLabel})` : ""}`;
            },
            label: function (context: any) {
              const val = context.parsed.y || 0;
              return ` ${context.dataset.label}: ${valuePrefix}${val.toLocaleString("en-IN")}`;
            },
            afterBody: function (contexts: any[]) {
              if (!contexts || contexts.length === 0) return [];
              const idx = contexts[0].dataIndex;
              const g = data[idx];
              const encounters = g?.metadata?.encountersCount || 0;
              return [
                `Encounters: ${encounters}`,
                onBarClick ? "Click bar to drill down →" : "",
              ].filter(Boolean);
            },
          },
        },
      },
      onClick: (_: ChartEvent, elements: ActiveElement[]) => {
        if (elements && elements.length > 0 && onBarClick) {
          const idx = elements[0].index;
          const group = data[idx];
          if (group) onBarClick(group);
        }
      },
    };
  }, [data, stacked, valuePrefix, onBarClick]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {/* ─── CARD HEADER & CONTROLS ROW ─── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
          minHeight: 48,
        }}
      >
        <div style={{ flex: "1 1 260px" }}>
          {title && (
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)", lineHeight: 1.3 }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3 }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Localized Controls & Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
          {headerControls}

          {/* Series Legend */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {series.map((s) => (
              <div
                key={s.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.74rem",
                  color: "var(--text-secondary)",
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: s.color,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── CHART CANVAS ─── */}
      {data.length === 0 ? (
        <div
          style={{
            height,
            minHeight: height,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            background: "rgba(255, 255, 255, 0.02)",
            borderRadius: 14,
            border: "1px dashed var(--border)",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: "1.6rem", opacity: 0.5 }}>📈</div>
          <div>{emptyMessage}</div>
        </div>
      ) : (
        <div style={{ width: "100%", height, minHeight: height, position: "relative" }}>
          <Bar ref={chartRef} data={chartData} options={chartOptions as any} />
        </div>
      )}
    </div>
  );
}
