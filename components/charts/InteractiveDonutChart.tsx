"use client";

import { useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartEvent,
  ActiveElement,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  formattedValue?: string;
  subText?: string;
  metadata?: any;
}

export interface InteractiveDonutChartProps {
  title?: string;
  subtitle?: string;
  data: DonutSlice[];
  totalLabel?: string;
  totalFormatted?: string;
  size?: number;
  innerRadiusRatio?: number;
  onSliceClick?: (slice: DonutSlice) => void;
  emptyMessage?: string;
  showLegend?: boolean;
}

export default function InteractiveDonutChart({
  title,
  subtitle,
  data,
  totalLabel = "Total",
  totalFormatted,
  size = 240,
  onSliceClick,
  emptyMessage = "No data available for this timeframe",
  showLegend = true,
}: InteractiveDonutChartProps) {
  const chartRef = useRef<any>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validData = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const totalValue = useMemo(
    () => validData.reduce((acc, curr) => acc + curr.value, 0),
    [validData]
  );

  const chartData = useMemo(() => {
    return {
      labels: validData.map((d) => d.label),
      datasets: [
        {
          data: validData.map((d) => d.value),
          backgroundColor: validData.map((d) => d.color),
          hoverBackgroundColor: validData.map((d) => d.color),
          borderWidth: 2,
          borderColor: "rgba(17, 24, 39, 0.8)",
          hoverBorderColor: "#ffffff",
          hoverBorderWidth: 2,
          borderRadius: 4,
          spacing: validData.length > 1 ? 3 : 0,
        },
      ],
    };
  }, [validData]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "74%",
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 800,
        easing: "easeOutQuart" as const,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#94a3b8",
          borderColor: "rgba(255, 255, 255, 0.12)",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          boxPadding: 4,
          callbacks: {
            label: function (context: any) {
              const slice = validData[context.dataIndex];
              const val = slice?.formattedValue || context.parsed;
              const pct = totalValue > 0 ? ((context.parsed / totalValue) * 100).toFixed(1) : "0";
              return ` ${slice?.label || ""}: ${val} (${pct}%)`;
            },
          },
        },
      },
      onHover: (_: ChartEvent, elements: ActiveElement[]) => {
        if (elements && elements.length > 0) {
          setHoveredIndex(elements[0].index);
        } else {
          setHoveredIndex(null);
        }
      },
      onClick: (_: ChartEvent, elements: ActiveElement[]) => {
        if (elements && elements.length > 0 && onSliceClick) {
          const idx = elements[0].index;
          const slice = validData[idx];
          if (slice) onSliceClick(slice);
        }
      },
    };
  }, [validData, totalValue, onSliceClick]);

  const activeSlice = hoveredIndex !== null ? validData[hoveredIndex] : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      {/* Title & Subtitle */}
      {(title || subtitle) && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 14,
            width: "100%",
            minHeight: 46,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {title && (
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)", lineHeight: 1.3 }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3 }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* Chart Canvas & Center Readout */}
      <div
        style={{
          position: "relative",
          width: size,
          maxWidth: "100%",
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto",
          flexShrink: 0,
        }}
      >
        {totalValue === 0 ? (
          <div
            style={{
              height: size,
              width: size,
              maxWidth: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "50%",
              border: "1px dashed var(--border)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: "1.6rem", opacity: 0.5 }}>📊</div>
            <div style={{ padding: "0 16px", textAlign: "center", fontSize: "0.76rem" }}>{emptyMessage}</div>
          </div>
        ) : (
          <>
            <Doughnut ref={chartRef} data={chartData} options={chartOptions as any} />

            {/* Clean Flat Center Readout */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                textAlign: "center",
                padding: "0 24px",
              }}
            >
              {activeSlice ? (
                <div style={{ maxWidth: "100%", width: "100%" }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeSlice.label}
                  </div>
                  <div
                    style={{
                      fontSize: (activeSlice.formattedValue || "").length > 10 ? "1.08rem" : "1.25rem",
                      fontWeight: 800,
                      color: activeSlice.color,
                      marginTop: 2,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeSlice.formattedValue || activeSlice.value.toLocaleString("en-IN")}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {totalValue > 0 ? ((activeSlice.value / totalValue) * 100).toFixed(1) : 0}% of total
                  </div>
                </div>
              ) : (
                <div style={{ maxWidth: "100%", width: "100%" }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {totalLabel}
                  </div>
                  <div
                    style={{
                      fontSize: (totalFormatted || "").length > 12 ? "1.08rem" : "1.25rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      marginTop: 2,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {totalFormatted || totalValue.toLocaleString("en-IN")}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      marginTop: 3,
                    }}
                  >
                    Hover or click
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Clean Aesthetic Pill Legend */}
      {showLegend && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "8px 10px",
            marginTop: 14,
            width: "100%",
            minHeight: 52,
            alignContent: "flex-start",
          }}
        >
          {validData.length > 0 ? (
            validData.map((slice, idx) => {
              const isHovered = hoveredIndex === idx;
              const pct = totalValue > 0 ? ((slice.value / totalValue) * 100).toFixed(0) : "0";
              return (
                <button
                  type="button"
                  key={slice.id}
                  onClick={() => onSliceClick && onSliceClick(slice)}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 9px",
                    borderRadius: 20,
                    background: isHovered
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: `1px solid ${isHovered ? slice.color : "rgba(255, 255, 255, 0.07)"}`,
                    cursor: onSliceClick ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    fontSize: "0.74rem",
                    color: "var(--text-primary)",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: slice.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{slice.label}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: slice.color,
                      fontSize: "0.7rem",
                      marginLeft: 2,
                    }}
                  >
                    {pct}%
                  </span>
                </button>
              );
            })
          ) : (
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", padding: "6px 0", alignSelf: "center" }}>
              No categories recorded
            </div>
          )}
        </div>
      )}
    </div>
  );
}
