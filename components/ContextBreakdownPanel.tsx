'use client';

import React, { useMemo, useState } from 'react';
import {
  computeContextBreakdown,
  displayValue,
  isPostMeal,
} from '@/lib/glucose-utils';
import type { GlucoseRecord, UserSettings } from '@/lib/types';

interface ContextBreakdownPanelProps {
  records: GlucoseRecord[];
  allRecords: GlucoseRecord[];
  settings: UserSettings;
}

export function ContextBreakdownPanel({
  records,
  allRecords,
  settings,
}: ContextBreakdownPanelProps) {
  const [referenceNowMs] = useState(() => Date.now());
  const rows = useMemo(
    () => computeContextBreakdown(records, settings),
    [records, settings]
  );

  // Lifestyle & short-term delta calculations (purely computed from user records)
  const correlations = useMemo(() => {
    const withExercise = records.filter((r) => r.exerciseLevel !== 'none');
    const withoutExercise = records.filter((r) => r.exerciseLevel === 'none');
    const avgWithExercise =
      withExercise.length > 0
        ? withExercise.reduce((s, r) => s + r.valueMmol, 0) / withExercise.length
        : null;
    const avgWithoutExercise =
      withoutExercise.length > 0
        ? withoutExercise.reduce((s, r) => s + r.valueMmol, 0) / withoutExercise.length
        : null;

    const postMealLightNormal = records.filter(
      (r) => isPostMeal(r.context) && (r.mealLevel === 'light' || r.mealLevel === 'normal')
    );
    const postMealHeavy = records.filter(
      (r) => isPostMeal(r.context) && r.mealLevel === 'heavy'
    );
    const avgPostLightNormal =
      postMealLightNormal.length > 0
        ? postMealLightNormal.reduce((s, r) => s + r.valueMmol, 0) / postMealLightNormal.length
        : null;
    const avgPostHeavy =
      postMealHeavy.length > 0
        ? postMealHeavy.reduce((s, r) => s + r.valueMmol, 0) / postMealHeavy.length
        : null;

    // Recent 7 days vs previous 7 days across allRecords
    const dayMs = 24 * 60 * 60 * 1000;
    const recent7 = allRecords.filter((r) => r.measuredAtMs >= referenceNowMs - 7 * dayMs);
    const prev7 = allRecords.filter(
      (r) =>
        r.measuredAtMs < referenceNowMs - 7 * dayMs &&
        r.measuredAtMs >= referenceNowMs - 14 * dayMs
    );
    const avgRecent7 =
      recent7.length > 0 ? recent7.reduce((s, r) => s + r.valueMmol, 0) / recent7.length : null;
    const avgPrev7 =
      prev7.length > 0 ? prev7.reduce((s, r) => s + r.valueMmol, 0) / prev7.length : null;

    return {
      withExerciseCount: withExercise.length,
      withoutExerciseCount: withoutExercise.length,
      avgWithExercise,
      avgWithoutExercise,
      postLightCount: postMealLightNormal.length,
      postHeavyCount: postMealHeavy.length,
      avgPostLightNormal,
      avgPostHeavy,
      recent7Count: recent7.length,
      prev7Count: prev7.length,
      avgRecent7,
      avgPrev7,
    };
  }, [records, allRecords, referenceNowMs]);

  // Global scale for range bars
  const scaleMin = 2.5;
  const scaleMax = Math.max(
    14.0,
    ...rows.map((r) => r.maxMmol + 0.5)
  );
  const pctOf = (val: number) =>
    Math.min(100, Math.max(0, ((val - scaleMin) / (scaleMax - scaleMin)) * 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Left: Context breakdown table */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">分时段血糖统计</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              对比不同测量时段的均值、波动区间及各自目标达标率
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex-1 min-h-[180px] flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50/40">
            暂无分时段数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-3">测量时段</th>
                  <th className="py-2.5 px-3 text-right">次数</th>
                  <th className="py-2.5 px-3 text-right">平均值</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">波动区间 ({settings.unit})</th>
                  <th className="py-2.5 pl-3 text-right">达标率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {rows.map((row) => {
                  const targetLeft = pctOf(row.targetLow);
                  const targetWidth = Math.max(4, pctOf(row.targetHigh) - targetLeft);
                  const rangeLeft = pctOf(row.minMmol);
                  const rangeWidth = Math.max(2, pctOf(row.maxMmol) - rangeLeft);
                  const avgLeft = pctOf(row.avgMmol);
                  const inTarget =
                    row.avgMmol >= row.targetLow && row.avgMmol <= row.targetHigh;

                  return (
                    <tr key={row.context} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-3 font-medium text-slate-800 whitespace-nowrap">
                        {row.label}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                        {row.count}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                          inTarget ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {displayValue(row.avgMmol, settings.unit)}
                      </td>
                      <td className="py-3 px-3 hidden sm:table-cell min-w-[200px]">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono tabular-nums text-slate-400 w-9 text-right">
                            {displayValue(row.minMmol, settings.unit)}
                          </span>
                          <div className="relative flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            {/* Target Zone */}
                            <div
                              className="absolute top-0 bottom-0 bg-emerald-200/70"
                              style={{ left: `${targetLeft}%`, width: `${targetWidth}%` }}
                            />
                            {/* User Min-Max Bar */}
                            <div
                              className="absolute top-0.5 bottom-0.5 bg-slate-600 rounded-full"
                              style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                            />
                            {/* Avg Marker */}
                            <div
                              className="absolute top-0 bottom-0 w-1 bg-teal-700 rounded-full"
                              style={{ left: `${avgLeft}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-400 w-9">
                            {displayValue(row.maxMmol, settings.unit)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pl-3 text-right font-mono tabular-nums font-medium text-slate-800">
                        {row.inRangePct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: Quantitative Lifestyle Correlations */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">饮食运动与周期对比</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            基于您记录的真实测量数据自动汇总
          </p>
        </div>

        <div className="divide-y divide-slate-100 flex-1 flex flex-col justify-around">
          {/* 1. 7d vs prev 7d */}
          <div className="py-3 first:pt-0">
            <div className="text-xs text-slate-500">近 7 天 vs 前 7 天均值</div>
            {correlations.avgRecent7 !== null && correlations.avgPrev7 !== null ? (
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <div className="font-mono tabular-nums text-lg font-semibold text-slate-900">
                  {displayValue(correlations.avgRecent7, settings.unit)}{' '}
                  <span className="text-xs font-normal text-slate-500">{settings.unit}</span>
                </div>
                <div
                  className={`text-xs font-mono tabular-nums font-medium ${
                    correlations.avgRecent7 <= correlations.avgPrev7
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {correlations.avgRecent7 <= correlations.avgPrev7 ? '下降 ' : '上升 '}
                  {displayValue(
                    Math.abs(correlations.avgRecent7 - correlations.avgPrev7),
                    settings.unit
                  )}{' '}
                  ({correlations.recent7Count}次 vs {correlations.prev7Count}次)
                </div>
              </div>
            ) : (
              <div className="mt-1 text-xs text-slate-400">
                需同时包含最近7天与前7天的记录以进行对比
              </div>
            )}
          </div>

          {/* 2. Exercise impact */}
          <div className="py-3">
            <div className="text-xs text-slate-500">标注运动 vs 未运动记录均值</div>
            {correlations.avgWithExercise !== null && correlations.avgWithoutExercise !== null ? (
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <div className="text-sm font-mono tabular-nums text-slate-800">
                  运动{' '}
                  <span className="font-semibold text-teal-700">
                    {displayValue(correlations.avgWithExercise, settings.unit)}
                  </span>{' '}
                  <span className="text-slate-300">/</span> 未动{' '}
                  <span className="font-semibold text-slate-700">
                    {displayValue(correlations.avgWithoutExercise, settings.unit)}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {correlations.withExerciseCount}次 / {correlations.withoutExerciseCount}次
                </span>
              </div>
            ) : (
              <div className="mt-1 text-xs text-slate-400">
                记录时标注运动强度即可生成对比
              </div>
            )}
          </div>

          {/* 3. Meal impact */}
          <div className="py-3 last:pb-0">
            <div className="text-xs text-slate-500">餐后血糖：清淡适量 vs 丰盛高碳水</div>
            {correlations.avgPostLightNormal !== null && correlations.avgPostHeavy !== null ? (
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <div className="text-sm font-mono tabular-nums text-slate-800">
                  清淡{' '}
                  <span className="font-semibold text-emerald-700">
                    {displayValue(correlations.avgPostLightNormal, settings.unit)}
                  </span>{' '}
                  <span className="text-slate-300">/</span> 丰盛{' '}
                  <span className="font-semibold text-amber-700">
                    {displayValue(correlations.avgPostHeavy, settings.unit)}
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {correlations.postLightCount}次 / {correlations.postHeavyCount}次
                </span>
              </div>
            ) : (
              <div className="mt-1 text-xs text-slate-400">
                记录餐后2h血糖并标注饮食即可查看差异
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
