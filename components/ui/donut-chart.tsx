'use client';

import { useState } from 'react';

interface DonutSegment {
  value: number;
  color: string;
  label?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  gapDeg?: number;
}

export function DonutChart({
  segments,
  size = 120,
  strokeWidth = 14,
  gapDeg = 2,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const totalGapDeg = gapDeg * segments.length;
  const availableDeg = 360 - totalGapDeg;

  const paths: {
    d: string;
    color: string;
    startAngle: number;
    sweepAngle: number;
    percent: string;
    label?: string;
  }[] = [];

  let currentAngle = -90; // start from top

  segments.forEach((seg, i) => {
    currentAngle += gapDeg / 2;
    const sweepDeg = (seg.value / total) * availableDeg;
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + sweepDeg) * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArc = sweepDeg > 180 ? 1 : 0;

    const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    const percent = ((seg.value / total) * 100).toFixed(1);

    paths.push({ d, color: seg.color, startAngle: currentAngle, sweepAngle: sweepDeg, percent, label: seg.label });

    currentAngle += sweepDeg + gapDeg / 2;
  });

  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            style={{
              transition: 'opacity 0.15s',
              opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              setHoveredIndex(i);
              const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (rect) {
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
              if (rect) {
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              }
            }}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded-lg text-xs text-white font-medium whitespace-nowrap"
          style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            left: mousePos.x,
            top: mousePos.y - 32,
            transform: 'translateX(-50%)',
          }}
        >
          {paths[hoveredIndex].label ? `${paths[hoveredIndex].label}: ` : ''}{paths[hoveredIndex].percent}%
        </div>
      )}
    </div>
  );
}
