'use client';

import React, { useMemo, useState } from 'react';
import {
  displayNumericValue,
  displayValue,
  evaluateGlucoseStatus,
  formatDateTimeCN,
  formatShortDateCN,
  getContextLabel,
  isFastingOrPreMeal,
  isPostMeal,
  mmolToMgdl,
  STATUS_META,
} from '@/lib/glucose-utils';
import type { GlucoseRecord, UserSettings } from '@/lib/types';

interface GlucoseTrendChartProps {
  records: GlucoseRecord[];
  settings: UserSettings;
  onSelectRecord?: (record: GlucoseRecord) => void;
}

type TrendFilter = 'all' | 'fasting' | 'post_meal';

export function GlucoseTrendChart({
  records,
  settings,
  onSelectRecord,
}: GlucoseTrendChartProps) {
  const [filter, setFilter] = useState<TrendFilter>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const base =
      filter === 'fasting'
        ? records.filter((r) => isFastingOrPreMeal(r.context))
        : filter === 'post_meal'
        ? records.filter((r) => isPostMeal(r.context))
        : records;
    return [...base].sort((a, b) => a.measuredAtMs - b.measuredAtMs);
  }, [records, filter]);

  const chartGeometry = useMemo(() => {
    const width = 820;
    const height = 290;
    const padLeft = 48;
    const padRight = 56;
    const padTop = 22;
    const padBottom = 34;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxVal = filteredRecords.reduce(
      (acc, r) => Math.max(acc, r.valueMmol),
      Math.max(settings.generalHigh + 1.5, 11.5)
    );
    const minVal = filteredRecords.reduce(
      (acc, r) => Math.min(acc, r.valueMmol),
      Math.min(settings.generalLow - 0.8, 3.0)
    );
    const yMin = Math.max(1.5, Math.floor(minVal * 2) / 2);
    const yMax = Math.ceil(maxVal * 2) / 2;

    const minT = filteredRecords.length > 0 ? filteredRecords[0].measuredAtMs : 0;
    const maxT =
      filteredRecords.length > 0 ? filteredRecords[filteredRecords.length - 1].measuredAtMs : 86400000;
    const tSpan = Math.max(maxT - minT, 60 * 60 * 1000);

    const xOf = (ms: number) => {
      if (filteredRecords.length === 1) return padLeft + plotW / 2;
      return padLeft + ((ms - minT) / tSpan) * plotW;
    };

    const yOf = (mmol: number) => {
      return padTop + ((yMax - mmol) / Math.max(yMax - yMin, 1)) * plotH;
    };

    const points = filteredRecords.map((r) => ({
      record: r,
      x: xOf(r.measuredAtMs),
      y: yOf(r.valueMmol),
      status: evaluateGlucoseStatus(r.valueMmol, r.context, settings),
    }));

    const linePath = points
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');

    // Y axis ticks (4-5 clean steps)
    const stepCount = 4;
    const yTicks: number[] = [];
    for (let i = 0; i <= stepCount; i++) {
      yTicks.push(yMin + ((yMax - yMin) * i) / stepCount);
    }

    // X axis labels (up to 5 evenly spaced timestamps)
    const xTicks: { x: number; label: string }[] = [];
    if (filteredRecords.length > 0) {
      const tickCount = Math.min(5, Math.max(2, filteredRecords.length));
      for (let i = 0; i < tickCount; i++) {
        const ms = minT + (tSpan * i) / (tickCount - 1);
        xTicks.push({
          x: padLeft + (plotW * i) / (tickCount - 1),
          label: formatShortDateCN(ms),
        });
      }
    }

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      yMin,
      yMax,
      yOf,
      points,
      linePath,
      yTicks,
      xTicks,
    };
  }, [filteredRecords, settings]);

  const hoveredPoint = useMemo(() => {
    if (!hoveredId) return null;
    return chartGeometry.points.find((p) => p.record.id === hoveredId) ?? null;
  }, [hoveredId, chartGeometry.points]);

  const bandLow =
    filter === 'fasting'
      ? settings.fastingLow
      : filter === 'post_meal'
      ? settings.postMealLow
      : settings.generalLow;
  const bandHigh =
    filter === 'fasting'
      ? settings.fastingHigh
      : filter === 'post_meal'
      ? settings.postMealHigh
      : settings.generalHigh;

  const bandTopY = Math.max(chartGeometry.padTop, chartGeometry.yOf(bandHigh));
  const bandBottomY = Math.min(
    chartGeometry.padTop + chartGeometry.plotH,
    chartGeometry.yOf(bandLow)
  );
  const bandHeight = Math.max(0, bandBottomY - bandTopY);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">血糖变化趋势与目标区间</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            绿色阴影区为当前筛选时段目标范围（
            <span className="font-mono tabular-nums">
              {displayNumericValue(bandLow, settings.unit)}–{displayNumericValue(bandHigh, settings.unit)}{' '}
              {settings.unit}
            </span>
            ）
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          {(
            [
              { id: 'all', label: '全部时段' },
              { id: 'fasting', label: '空腹/餐前' },
              { id: 'post_meal', label: '餐后2h' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="h-[260px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 px-4">
          <p className="text-sm font-medium text-slate-700">当前筛选条件下暂无血糖记录</p>
          <p className="text-xs text-slate-500 mt-1">
            可切换顶部时间范围，或点击右上角“记录血糖”添加新测量。
          </p>
        </div>
      ) : (
        <div className="relative w-full">
          <svg
            viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label="血糖时间趋势折线图"
          >
            {/* Target Range Shaded Band */}
            <rect
              x={chartGeometry.padLeft}
              y={bandTopY}
              width={chartGeometry.plotW}
              height={bandHeight}
              fill="#16a34a"
              fillOpacity={0.07}
            />

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {chartGeometry.yTicks.map((tick, idx) => {
              const y = chartGeometry.yOf(tick);
              return (
                <g key={idx}>
                  <line
                    x1={chartGeometry.padLeft}
                    y1={y}
                    x2={chartGeometry.padLeft + chartGeometry.plotW}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={idx === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={chartGeometry.padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[11px] font-mono tabular-nums"
                  >
                    {displayValue(tick, settings.unit)}
                  </text>
                </g>
              );
            })}

            {/* Target High / Low Reference Dashed Lines */}
            <line
              x1={chartGeometry.padLeft}
              y1={bandTopY}
              x2={chartGeometry.padLeft + chartGeometry.plotW}
              y2={bandTopY}
              stroke="#16a34a"
              strokeOpacity={0.45}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text
              x={chartGeometry.padLeft + chartGeometry.plotW + 6}
              y={bandTopY + 3}
              className="fill-emerald-700 text-[10px] font-mono tabular-nums"
            >
              上限 {displayValue(bandHigh, settings.unit)}
            </text>

            <line
              x1={chartGeometry.padLeft}
              y1={bandBottomY}
              x2={chartGeometry.padLeft + chartGeometry.plotW}
              y2={bandBottomY}
              stroke="#0284c7"
              strokeOpacity={0.45}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text
              x={chartGeometry.padLeft + chartGeometry.plotW + 6}
              y={bandBottomY + 3}
              className="fill-sky-700 text-[10px] font-mono tabular-nums"
            >
              下限 {displayValue(bandLow, settings.unit)}
            </text>

            {/* X-Axis Labels */}
            {chartGeometry.xTicks.map((xt, idx) => (
              <text
                key={idx}
                x={xt.x}
                y={chartGeometry.height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[11px] font-mono tabular-nums"
              >
                {xt.label}
              </text>
            ))}

            {/* Trend Polyline */}
            {chartGeometry.points.length > 1 && (
              <path
                d={chartGeometry.linePath}
                fill="none"
                stroke="#0f766e"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeOpacity={0.75}
              />
            )}

            {/* Vertical hover crosshair */}
            {hoveredPoint && (
              <line
                x1={hoveredPoint.x}
                y1={chartGeometry.padTop}
                x2={hoveredPoint.x}
                y2={chartGeometry.padTop + chartGeometry.plotH}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            {/* Data Points */}
            {chartGeometry.points.map((pt) => {
              const isHovered = hoveredId === pt.record.id;
              const color = STATUS_META[pt.status].dotColor;
              return (
                <g
                  key={pt.record.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredId(pt.record.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectRecord?.(pt.record)}
                >
                  <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : 4.2}
                    fill="#ffffff"
                    stroke={color}
                    strokeWidth={isHovered ? 3 : 2.4}
                  />
                </g>
              );
            })}
          </svg>

          {/* Hover Inspection Bar (fixed height below chart, zero layout shift) */}
          <div className="mt-2 min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200/70 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
            {hoveredPoint ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-slate-700">
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {displayValue(hoveredPoint.record.valueMmol, settings.unit)} {settings.unit}
                  </span>
                  <span className="text-slate-400 font-mono tabular-nums">
                    ({hoveredPoint.record.valueMmol.toFixed(1)} mmol/L /{' '}
                    {mmolToMgdl(hoveredPoint.record.valueMmol)} mg/dL)
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
                {hoveredPoint.record.note && (
                  <span className="text-slate-600 truncate max-w-md">
                    备注：{hoveredPoint.record.note}
                  </span>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between w-full gap-2 text-slate-500">
                <span>将鼠标悬停在数据点上查看详情，点击数据点可直接编辑记录</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-600 inline-block" />
                    偏低
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                    达标
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                    偏高
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                    过高
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
