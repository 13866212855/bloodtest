'use client';

import React, { useMemo, useState } from 'react';
import {
  displayValue,
  evaluateGlucoseStatus,
  formatDateTimeCN,
  getContextLabel,
  STATUS_META,
} from '@/lib/glucose-utils';
import type { GlucoseRecord, UserSettings } from '@/lib/types';

interface ModalDayChartProps {
  records: GlucoseRecord[];
  settings: UserSettings;
  onSelectRecord?: (record: GlucoseRecord) => void;
}

export function ModalDayChart({ records, settings, onSelectRecord }: ModalDayChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const geometry = useMemo(() => {
    const width = 820;
    const height = 270;
    const padLeft = 48;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 34;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxVal = records.reduce(
      (acc, r) => Math.max(acc, r.valueMmol),
      Math.max(settings.generalHigh + 1.5, 11.5)
    );
    const minVal = records.reduce(
      (acc, r) => Math.min(acc, r.valueMmol),
      Math.min(settings.generalLow - 0.8, 3.0)
    );
    const yMin = Math.max(1.5, Math.floor(minVal * 2) / 2);
    const yMax = Math.ceil(maxVal * 2) / 2;

    const xOfHour = (hours: number) => padLeft + (hours / 24) * plotW;
    const yOf = (mmol: number) =>
      padTop + ((yMax - mmol) / Math.max(yMax - yMin, 1)) * plotH;

    const points = records.map((r) => {
      const d = new Date(r.measuredAtMs);
      const hourDecimal = d.getHours() + d.getMinutes() / 60;
      return {
        record: r,
        hourDecimal,
        x: xOfHour(hourDecimal),
        y: yOf(r.valueMmol),
        status: evaluateGlucoseStatus(r.valueMmol, r.context, settings),
      };
    });

    // Compute 2-hour bucket average curve for smooth pattern recognition
    const bucketAverages: { x: number; y: number }[] = [];
    for (let h = 0; h < 24; h += 2) {
      const inBucket = points.filter(
        (p) => p.hourDecimal >= h && p.hourDecimal < h + 2
      );
      if (inBucket.length > 0) {
        const avg =
          inBucket.reduce((acc, p) => acc + p.record.valueMmol, 0) / inBucket.length;
        bucketAverages.push({
          x: xOfHour(h + 1),
          y: yOf(avg),
        });
      }
    }

    const avgCurvePath =
      bucketAverages.length >= 2
        ? bucketAverages
            .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
            .join(' ')
        : '';

    const yTicks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      yTicks.push(yMin + ((yMax - yMin) * i) / 4);
    }

    const hourTicks = [0, 4, 8, 12, 16, 20, 24];

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      yOf,
      xOfHour,
      points,
      avgCurvePath,
      yTicks,
      hourTicks,
    };
  }, [records, settings]);

  const hoveredPoint = useMemo(() => {
    if (!hoveredId) return null;
    return geometry.points.find((p) => p.record.id === hoveredId) ?? null;
  }, [hoveredId, geometry.points]);

  const bandTopY = Math.max(geometry.padTop, geometry.yOf(settings.generalHigh));
  const bandBottomY = Math.min(
    geometry.padTop + geometry.plotH,
    geometry.yOf(settings.generalLow)
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">24小时全天时段分布图</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            将所选周期内的所有血糖值按一天中的测量时刻叠加，快速识别清晨空腹或餐后高峰规律
          </p>
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          共叠加 <span className="font-mono tabular-nums font-medium text-slate-800">{records.length}</span> 次记录
        </span>
      </div>

      {records.length === 0 ? (
        <div className="h-[240px] flex items-center justify-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 text-xs text-slate-500">
          暂无足够记录生成 24 小时分布视图
        </div>
      ) : (
        <div className="w-full">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label="24小时血糖分布图"
          >
            {/* Target Band */}
            <rect
              x={geometry.padLeft}
              y={bandTopY}
              width={geometry.plotW}
              height={Math.max(0, bandBottomY - bandTopY)}
              fill="#16a34a"
              fillOpacity={0.07}
            />

            {/* Vertical Time-of-Day Guides (Breakfast / Lunch / Dinner / Night) */}
            {[
              { h: 7, label: '早' },
              { h: 12, label: '午' },
              { h: 18, label: '晚' },
              { h: 22, label: '睡' },
            ].map((guide) => {
              const gx = geometry.xOfHour(guide.h);
              return (
                <g key={guide.h}>
                  <line
                    x1={gx}
                    y1={geometry.padTop}
                    x2={gx}
                    y2={geometry.padTop + geometry.plotH}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />
                  <text
                    x={gx}
                    y={geometry.padTop - 6}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {guide.label}
                  </text>
                </g>
              );
            })}

            {/* Y Grid */}
            {geometry.yTicks.map((tick, idx) => {
              const y = geometry.yOf(tick);
              return (
                <g key={idx}>
                  <line
                    x1={geometry.padLeft}
                    y1={y}
                    x2={geometry.padLeft + geometry.plotW}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={idx === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={geometry.padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[11px] font-mono tabular-nums"
                  >
                    {displayValue(tick, settings.unit)}
                  </text>
                </g>
              );
            })}

            {/* X Hour Ticks */}
            {geometry.hourTicks.map((hr) => (
              <text
                key={hr}
                x={geometry.xOfHour(hr)}
                y={geometry.height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[11px] font-mono tabular-nums"
              >
                {String(hr).padStart(2, '0')}:00
              </text>
            ))}

            {/* Average Curve across 2-hour buckets */}
            {geometry.avgCurvePath && (
              <path
                d={geometry.avgCurvePath}
                fill="none"
                stroke="#0f766e"
                strokeWidth={2}
                strokeDasharray="5 3"
                strokeOpacity={0.8}
              />
            )}

            {/* Scatter Points */}
            {geometry.points.map((pt) => {
              const isHovered = hoveredId === pt.record.id;
              return (
                <g
                  key={pt.record.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredId(pt.record.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectRecord?.(pt.record)}
                >
                  <circle cx={pt.x} cy={pt.y} r={10} fill="transparent" />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : 4}
                    fill={STATUS_META[pt.status].dotColor}
                    fillOpacity={0.85}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}
          </svg>

          <div className="mt-2 min-h-[36px] px-3 py-1.5 bg-slate-50 border border-slate-200/70 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            {hoveredPoint ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold tabular-nums text-slate-900">
                  {displayValue(hoveredPoint.record.valueMmol, settings.unit)} {settings.unit}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className={`font-medium ${STATUS_META[hoveredPoint.status].textClass}`}>
                  {STATUS_META[hoveredPoint.status].label}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span>{getContextLabel(hoveredPoint.record.context)}</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {formatDateTimeCN(hoveredPoint.record.measuredAtMs)}
                </span>
              </div>
            ) : (
              <span>虚线表示各时段平均走势，圆点为单次测量分布</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
