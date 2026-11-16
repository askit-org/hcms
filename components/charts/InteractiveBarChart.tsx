"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface BarSeriesItem {
  key: string;
  label: string;
  color: string;
}

export interface BarGroupData {
  id: string;
  label: string;
  subLabel?: string;
  values: Record<string, number>; // key -> value
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
  valuePrefix?: string; // e.g. "₹"
  onBarClick?: (group: BarGroupData) => void;
  emptyMessage?: string;
}

export default function InteractiveBarChart({
  title,
  subtitle,
  series,
  data,
  height = 260,
  stacked = true,
  valuePrefix = "",
  onBarClick,
  emptyMessage = "No timeline data available for this range",
}: InteractiveBarChartProps) {
  const chartId = useId();
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Calculate maximum value for Y-axis scale
  const maxVal = Math.max(
    ...data.map((d) => {
      if (stacked) {
        return series.reduce((sum, s) => sum + (d.values[s.key] || 0), 0);
      } else {
        return Math.max(...series.map((s) => d.values[s.key] || 0), 0);
      }
    }),
    1
  );

  // Y-axis tick intervals (4 steps)
  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  const formatShortNumber = (n: number) => {
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toFixed(0);
  };

  const padLeft = 45;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 34;

  const chartWidth = Math.max(data.length * (stacked ? 36 : series.length * 20 + 20) + padLeft + padRight, 400);
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const activeGroup = data.find((d) => d.id === hoveredGroupId);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header & Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          {title && (
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</div>
          )}
          {subtitle && (
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {series.map((s) => (
            <div
              key={s.key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.74rem",
                color: "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color,
                }}
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 8,
            color: "var(--text-muted)",
            fontSize: "0.84rem",
            background: "var(--surface-1)",
            borderRadius: 12,
            border: "1px dashed var(--border)",
          }}
        >
          <div style={{ fontSize: "1.8rem", opacity: 0.5 }}>📈</div>
          <div>{emptyMessage}</div>
        </div>
      ) : (
        <div style={{ width: "100%", overflowX: "auto", position: "relative" }}>
          <svg
            width="100%"
            height={height}
            viewBox={`0 0 ${chartWidth} ${height}`}
            style={{ minWidth: chartWidth, overflow: "visible" }}
          >
            {/* Horizontal Grid lines */}
            {yTicks.map((tick, i) => {
              const y = padTop + plotHeight - (tick / maxVal) * plotHeight;
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={chartWidth - padRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray={i === 0 ? "none" : "3,3"}
                    strokeOpacity={i === 0 ? 0.6 : 0.35}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="10"
                    fontWeight="500"
                  >
                    {valuePrefix}
                    {formatShortNumber(tick)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {data.map((group, groupIdx) => {
              const groupWidth = plotWidth / data.length;
              const groupCenterX = padLeft + groupIdx * groupWidth + groupWidth / 2;
              const isHovered = hoveredGroupId === group.id;

              const totalGroupVal = series.reduce(
                (sum, s) => sum + (group.values[s.key] || 0),
                0
              );

              // Render stacked bars
              if (stacked) {
                const barWidth = Math.min(Math.max(groupWidth * 0.55, 14), 32);
                let currentStackY = padTop + plotHeight;

                return (
                  <g
                    key={group.id}
                    onMouseEnter={() => setHoveredGroupId(group.id)}
                    onMouseLeave={() => setHoveredGroupId(null)}
                    onClick={() => onBarClick && onBarClick(group)}
                    style={{ cursor: onBarClick ? "pointer" : "default" }}
                  >
                    {/* Hover column background highlight */}
                    {isHovered && (
                      <rect
                        x={groupCenterX - groupWidth / 2 + 2}
                        y={padTop}
                        width={groupWidth - 4}
                        height={plotHeight}
                        fill="rgba(59, 130, 246, 0.06)"
                        rx={6}
                      />
                    )}

                    {series.map((s, sIdx) => {
                      const val = group.values[s.key] || 0;
                      if (val <= 0) return null;
                      const segmentHeight = (val / maxVal) * plotHeight;
                      currentStackY -= segmentHeight;

                      const isTopSegment =
                        sIdx ===
                        series
                          .map((x) => group.values[x.key] || 0)
                          .reduce((topI, v, i) => (v > 0 ? i : topI), -1);

                      return (
                        <rect
                          key={s.key}
                          x={groupCenterX - barWidth / 2}
                          y={currentStackY}
                          width={barWidth}
                          height={Math.max(segmentHeight, 1.5)}
                          fill={s.color}
                          opacity={isHovered ? 1 : 0.88}
                          rx={isTopSegment ? 4 : 0}
                          style={{ transition: "all 0.15s ease-out" }}
                        />
                      );
                    })}

                    {/* Zero value placeholder line if completely empty */}
                    {totalGroupVal === 0 && (
                      <rect
                        x={groupCenterX - barWidth / 2}
                        y={padTop + plotHeight - 2}
                        width={barWidth}
                        height={2}
                        fill="var(--border)"
                        rx={1}
                      />
                    )}

                    {/* X-axis label */}
                    <text
                      x={groupCenterX}
                      y={height - 12}
                      textAnchor="middle"
                      fill={isHovered ? "var(--primary)" : "var(--text-muted)"}
                      fontSize="10"
                      fontWeight={isHovered ? 700 : 500}
                    >
                      {group.label}
                    </text>
                  </g>
                );
              }

              // Grouped side-by-side bars
              const singleBarW = Math.min(
                Math.max((groupWidth * 0.7) / series.length, 6),
                18
              );
              const groupBarTotalW = singleBarW * series.length;
              const startX = groupCenterX - groupBarTotalW / 2;

              return (
                <g
                  key={group.id}
                  onMouseEnter={() => setHoveredGroupId(group.id)}
                  onMouseLeave={() => setHoveredGroupId(null)}
                  onClick={() => onBarClick && onBarClick(group)}
                  style={{ cursor: onBarClick ? "pointer" : "default" }}
                >
                  {isHovered && (
                    <rect
                      x={groupCenterX - groupWidth / 2 + 2}
                      y={padTop}
                      width={groupWidth - 4}
                      height={plotHeight}
                      fill="rgba(59, 130, 246, 0.06)"
                      rx={6}
                    />
                  )}

                  {series.map((s, sIdx) => {
                    const val = group.values[s.key] || 0;
                    const barH = (val / maxVal) * plotHeight;
                    const barY = padTop + plotHeight - barH;
                    const barX = startX + sIdx * singleBarW;

                    return (
                      <rect
                        key={s.key}
                        x={barX}
                        y={barY}
                        width={singleBarW - 1}
                        height={Math.max(barH, 2)}
                        fill={s.color}
                        rx={3}
                        opacity={isHovered ? 1 : 0.85}
                      />
                    );
                  })}

                  <text
                    x={groupCenterX}
                    y={height - 12}
                    textAnchor="middle"
                    fill={isHovered ? "var(--primary)" : "var(--text-muted)"}
                    fontSize="10"
                    fontWeight={isHovered ? 700 : 500}
                  >
                    {group.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Active Hover Tooltip Card */}
          <AnimatePresence>
            {activeGroup && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  background: "var(--surface-solid, #1e2230)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                  pointerEvents: "none",
                  zIndex: 20,
                  fontSize: "0.76rem",
                  minWidth: 160,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  {activeGroup.label} {activeGroup.subLabel ? `(${activeGroup.subLabel})` : ""}
                </div>
                {series.map((s) => {
                  const val = activeGroup.values[s.key] || 0;
                  const formatted =
                    activeGroup.formattedValues?.[s.key] ||
                    `${valuePrefix}${val.toLocaleString("en-IN")}`;
                  return (
                    <div
                      key={s.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        marginTop: 2,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: s.color,
                          }}
                        />
                        <span style={{ color: "var(--text-muted)" }}>{s.label}:</span>
                      </span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {formatted}
                      </span>
                    </div>
                  );
                })}
                {onBarClick && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      marginTop: 6,
                      paddingTop: 4,
                      fontSize: "0.68rem",
                      color: "var(--primary)",
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    Click bar to inspect patients
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
