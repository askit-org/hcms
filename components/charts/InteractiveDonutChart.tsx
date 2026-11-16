"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  innerRadiusRatio?: number; // 0 for pie, ~0.65 for donut
  onSliceClick?: (slice: DonutSlice) => void;
  emptyMessage?: string;
  showLegend?: boolean;
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
) {
  // Clamp angle delta to avoid 360-degree SVG full circle arc collapse
  const delta = Math.min(Math.max(endAngle - startAngle, 0.001), 359.999);
  const actualEndAngle = startAngle + delta;

  const p1 = polarToCartesian(cx, cy, rOuter, actualEndAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p3 = polarToCartesian(cx, cy, rInner, startAngle);
  const p4 = polarToCartesian(cx, cy, rInner, actualEndAngle);

  const largeArcFlag = delta > 180 ? 1 : 0;

  return [
    `M ${p2.x} ${p2.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${p1.x} ${p1.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

export default function InteractiveDonutChart({
  title,
  subtitle,
  data,
  totalLabel = "Total",
  totalFormatted,
  size = 280,
  innerRadiusRatio = 0.65,
  onSliceClick,
  emptyMessage = "No data available for this timeframe",
  showLegend = true,
}: InteractiveDonutChartProps) {
  const chartId = useId();
  const [hoveredSliceId, setHoveredSliceId] = useState<string | null>(null);

  const validData = data.filter((d) => d.value > 0);
  const totalValue = validData.reduce((acc, curr) => acc + curr.value, 0);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;
  const innerR = outerR * innerRadiusRatio;

  // Compute angles for each segment
  let currentAngle = 0;
  const slicesWithAngles = validData.map((slice) => {
    const sliceAngle = totalValue > 0 ? (slice.value / totalValue) * 360 : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle += sliceAngle;
    const percent = totalValue > 0 ? (slice.value / totalValue) * 100 : 0;
    return {
      ...slice,
      startAngle,
      endAngle,
      percent,
    };
  });

  const activeSlice = slicesWithAngles.find((s) => s.id === hoveredSliceId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
      }}
    >
      {(title || subtitle) && (
        <div style={{ textAlign: "center", marginBottom: 12, width: "100%" }}>
          {title && (
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</div>
          )}
          {subtitle && (
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {totalValue === 0 ? (
        <div
          style={{
            height: size,
            width: "100%",
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
          <div style={{ fontSize: "1.8rem", opacity: 0.5 }}>📊</div>
          <div>{emptyMessage}</div>
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ overflow: "visible" }}
          >
            <defs>
              <filter id={`shadow-${chartId}`} x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.25" />
              </filter>
            </defs>

            {slicesWithAngles.map((slice) => {
              const isHovered = hoveredSliceId === slice.id;
              // Expand active slice slightly outward
              const midAngle = (slice.startAngle + slice.endAngle) / 2;
              const shift = isHovered ? 5 : 0;
              const shiftOffset = polarToCartesian(0, 0, shift, midAngle);

              const path = describeDonutSegment(
                cx,
                cy,
                innerR,
                isHovered ? outerR + 4 : outerR,
                slice.startAngle,
                slice.endAngle
              );

              return (
                <g
                  key={slice.id}
                  transform={`translate(${shiftOffset.x}, ${shiftOffset.y})`}
                  style={{
                    transition: "transform 0.18s ease-out",
                    cursor: onSliceClick ? "pointer" : "default",
                  }}
                  onMouseEnter={() => setHoveredSliceId(slice.id)}
                  onMouseLeave={() => setHoveredSliceId(null)}
                  onClick={() => onSliceClick && onSliceClick(slice)}
                >
                  <path
                    d={path}
                    fill={slice.color}
                    opacity={
                      hoveredSliceId === null || isHovered ? 1 : 0.65
                    }
                    filter={isHovered ? `url(#shadow-${chartId})` : undefined}
                    stroke="var(--surface-card, #1e2230)"
                    strokeWidth={slicesWithAngles.length > 1 ? 2 : 0}
                    style={{ transition: "all 0.18s ease-out" }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Center Callout Readout for Donut */}
          {innerRadiusRatio > 0.4 && (
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
                padding: "0 14px",
              }}
            >
              <AnimatePresence mode="wait">
                {activeSlice ? (
                  <motion.div
                    key={`slice-${activeSlice.id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        fontWeight: 600,
                        maxWidth: innerR * 1.6,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {activeSlice.label}
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        color: activeSlice.color,
                        lineHeight: 1.2,
                        marginTop: 2,
                      }}
                    >
                      {activeSlice.formattedValue || activeSlice.value}
                    </div>
                    <div
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {activeSlice.percent.toFixed(1)}%
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="total-readout"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontWeight: 600,
                      }}
                    >
                      {totalLabel}
                    </div>
                    <div
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 800,
                        color: "var(--text-primary)",
                        lineHeight: 1.2,
                        marginTop: 2,
                      }}
                    >
                      {totalFormatted || totalValue.toLocaleString("en-IN")}
                    </div>
                    {onSliceClick && (
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--primary)",
                          fontWeight: 600,
                          marginTop: 3,
                        }}
                      >
                        Click slice to inspect
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Legend & Slice Summary Pills */}
      {showLegend && totalValue > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginTop: 14,
            maxWidth: size + 80,
          }}
        >
          {slicesWithAngles.map((slice) => {
            const isHovered = hoveredSliceId === slice.id;
            return (
              <button
                key={slice.id}
                type="button"
                onClick={() => onSliceClick && onSliceClick(slice)}
                onMouseEnter={() => setHoveredSliceId(slice.id)}
                onMouseLeave={() => setHoveredSliceId(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: "0.75rem",
                  background: isHovered
                    ? "var(--surface-3)"
                    : "var(--surface-1)",
                  border: isHovered
                    ? `1.5px solid ${slice.color}`
                    : "1px solid var(--border)",
                  color: "var(--text-primary)",
                  cursor: onSliceClick ? "pointer" : "default",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: slice.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>{slice.label}:</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {slice.formattedValue || slice.value} ({slice.percent.toFixed(0)}%)
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
