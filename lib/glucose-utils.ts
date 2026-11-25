import type {
  DateRangeOption,
  ExerciseLevel,
  GlucoseRecord,
  GlucoseStatus,
  GlucoseUnit,
  MealLevel,
  MeasurementContext,
  UserSettings,
} from './types';

export const MGDL_PER_MMOL = 18.0182;

// Blueprint-synchronized validation constants
export const NOTE_MAX_LENGTH = 200;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const MIN_VALUE_MMOL = 0.5;
export const MAX_VALUE_MMOL = 40.0;
export const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, 'uid' | 'displayName'> = {
  unit: 'mmol/L',
  fastingLow: 3.9,
  fastingHigh: 6.1,
  postMealLow: 3.9,
  postMealHigh: 7.8,
  generalLow: 3.9,
  generalHigh: 10.0,
};

export const CONTEXT_OPTIONS: {
  value: MeasurementContext;
  label: string;
  shortLabel: string;
  category: 'fasting' | 'post_meal' | 'other';
}[] = [
  { value: 'fasting', label: '空腹', shortLabel: '空腹', category: 'fasting' },
  { value: 'before_breakfast', label: '早餐前', shortLabel: '早餐前', category: 'fasting' },
  { value: 'after_breakfast', label: '早餐后2h', shortLabel: '早餐后', category: 'post_meal' },
  { value: 'before_lunch', label: '午餐前', shortLabel: '午餐前', category: 'fasting' },
  { value: 'after_lunch', label: '午餐后2h', shortLabel: '午餐后', category: 'post_meal' },
  { value: 'before_dinner', label: '晚餐前', shortLabel: '晚餐前', category: 'fasting' },
  { value: 'after_dinner', label: '晚餐后2h', shortLabel: '晚餐后', category: 'post_meal' },
  { value: 'bedtime', label: '睡前', shortLabel: '睡前', category: 'other' },
  { value: 'random', label: '随机', shortLabel: '随机', category: 'other' },
];

export const MEAL_OPTIONS: { value: MealLevel; label: string }[] = [
  { value: 'none', label: '未标注' },
  { value: 'light', label: '清淡' },
  { value: 'normal', label: '适量' },
  { value: 'heavy', label: '丰盛/高碳水' },
];

export const EXERCISE_OPTIONS: { value: ExerciseLevel; label: string }[] = [
  { value: 'none', label: '未运动' },
  { value: 'light', label: '轻度活动' },
  { value: 'moderate', label: '中等运动' },
  { value: 'intense', label: '高强度运动' },
];

export function getContextLabel(context: MeasurementContext): string {
  return CONTEXT_OPTIONS.find((c) => c.value === context)?.label ?? '随机';
}

export function getContextShortLabel(context: MeasurementContext): string {
  return CONTEXT_OPTIONS.find((c) => c.value === context)?.shortLabel ?? '随机';
}

export function getMealLabel(meal: MealLevel): string {
  return MEAL_OPTIONS.find((m) => m.value === meal)?.label ?? '未标注';
}

export function getExerciseLabel(exercise: ExerciseLevel): string {
  return EXERCISE_OPTIONS.find((e) => e.value === exercise)?.label ?? '未运动';
}

export function isFastingOrPreMeal(context: MeasurementContext): boolean {
  return (
    context === 'fasting' ||
    context === 'before_breakfast' ||
    context === 'before_lunch' ||
    context === 'before_dinner'
  );
}

export function isPostMeal(context: MeasurementContext): boolean {
  return (
    context === 'after_breakfast' ||
    context === 'after_lunch' ||
    context === 'after_dinner'
  );
}

export function mmolToMgdl(mmol: number): number {
  return Math.round(mmol * MGDL_PER_MMOL);
}

export function mgdlToMmol(mgdl: number): number {
  return Math.round((mgdl / MGDL_PER_MMOL) * 10) / 10;
}

export function roundMmol(mmol: number): number {
  return Math.round(mmol * 10) / 10;
}

export function displayValue(valueMmol: number, unit: GlucoseUnit): string {
  if (unit === 'mg/dL') {
    return String(mmolToMgdl(valueMmol));
  }
  return valueMmol.toFixed(1);
}

export function displayNumericValue(valueMmol: number, unit: GlucoseUnit): number {
  if (unit === 'mg/dL') {
    return mmolToMgdl(valueMmol);
  }
  return roundMmol(valueMmol);
}

export function getContextTargetRange(
  context: MeasurementContext,
  settings: Pick<
    UserSettings,
    'fastingLow' | 'fastingHigh' | 'postMealLow' | 'postMealHigh' | 'generalLow' | 'generalHigh'
  >
): { low: number; high: number } {
  if (isFastingOrPreMeal(context)) {
    return { low: settings.fastingLow, high: settings.fastingHigh };
  }
  if (isPostMeal(context)) {
    return { low: settings.postMealLow, high: settings.postMealHigh };
  }
  return { low: settings.generalLow, high: settings.generalHigh };
}

export function evaluateGlucoseStatus(
  valueMmol: number,
  context: MeasurementContext,
  settings: Pick<
    UserSettings,
    'fastingLow' | 'fastingHigh' | 'postMealLow' | 'postMealHigh' | 'generalLow' | 'generalHigh'
  >
): GlucoseStatus {
  const { low, high } = getContextTargetRange(context, settings);
  if (valueMmol < low) return 'low';
  if (valueMmol <= high) return 'normal';
  const highAlertThreshold = Math.max(high + 2.2, settings.generalHigh + 1.1);
  if (valueMmol <= highAlertThreshold) return 'elevated';
  return 'high';
}

export const STATUS_META: Record<
  GlucoseStatus,
  {
    label: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    dotColor: string;
  }
> = {
  low: {
    label: '偏低',
    textClass: 'text-sky-700',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    dotColor: '#0284c7',
  },
  normal: {
    label: '达标',
    textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    dotColor: '#16a34a',
  },
  elevated: {
    label: '偏高',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    dotColor: '#d97706',
  },
  high: {
    label: '过高',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    dotColor: '#dc2626',
  },
};

export function filterRecordsByDateRange(
  records: GlucoseRecord[],
  range: DateRangeOption,
  nowMs: number = Date.now()
): GlucoseRecord[] {
  if (range === 'all') return records;
  const daysMap: Record<Exclude<DateRangeOption, 'all'>, number> = {
    '7d': 7,
    '14d': 14,
    '30d': 30,
    '90d': 90,
  };
  const cutoffMs = nowMs - daysMap[range] * 24 * 60 * 60 * 1000;
  return records.filter((r) => r.measuredAtMs >= cutoffMs);
}

export interface GlucoseSummaryStats {
  count: number;
  avgMmol: number;
  minMmol: number;
  maxMmol: number;
  sdMmol: number;
  cvPercent: number;
  estimatedA1c: number | null;
  lowCount: number;
  normalCount: number;
  elevatedCount: number;
  highCount: number;
  lowPct: number;
  normalPct: number;
  elevatedPct: number;
  highPct: number;
  tirGeneralPct: number;
}

export function computeGlucoseSummary(
  records: GlucoseRecord[],
  settings: UserSettings
): GlucoseSummaryStats {
  const count = records.length;
  if (count === 0) {
    return {
      count: 0,
      avgMmol: 0,
      minMmol: 0,
      maxMmol: 0,
      sdMmol: 0,
      cvPercent: 0,
      estimatedA1c: null,
      lowCount: 0,
      normalCount: 0,
      elevatedCount: 0,
      highCount: 0,
      lowPct: 0,
      normalPct: 0,
      elevatedPct: 0,
      highPct: 0,
      tirGeneralPct: 0,
    };
  }

  let sum = 0;
  let minMmol = Infinity;
  let maxMmol = -Infinity;
  let lowCount = 0;
  let normalCount = 0;
  let elevatedCount = 0;
  let highCount = 0;
  let generalInRangeCount = 0;

  for (const r of records) {
    sum += r.valueMmol;
    if (r.valueMmol < minMmol) minMmol = r.valueMmol;
    if (r.valueMmol > maxMmol) maxMmol = r.valueMmol;

    const status = evaluateGlucoseStatus(r.valueMmol, r.context, settings);
    if (status === 'low') lowCount += 1;
    else if (status === 'normal') normalCount += 1;
    else if (status === 'elevated') elevatedCount += 1;
    else highCount += 1;

    if (r.valueMmol >= settings.generalLow && r.valueMmol <= settings.generalHigh) {
      generalInRangeCount += 1;
    }
  }

  const avgMmol = sum / count;
  let sqDiffSum = 0;
  for (const r of records) {
    const diff = r.valueMmol - avgMmol;
    sqDiffSum += diff * diff;
  }
  const sdMmol = Math.sqrt(sqDiffSum / count);
  const cvPercent = avgMmol > 0 ? (sdMmol / avgMmol) * 100 : 0;
  // ADAG formula: eA1c (%) = (mean_mgdL + 46.7) / 28.7
  const estimatedA1c = count >= 3 ? (avgMmol * MGDL_PER_MMOL + 46.7) / 28.7 : null;

  const lowPct = Math.round((lowCount / count) * 100);
  const normalPct = Math.round((normalCount / count) * 100);
  const elevatedPct = Math.round((elevatedCount / count) * 100);
  const highPct = Math.max(0, 100 - lowPct - normalPct - elevatedPct);

  return {
    count,
    avgMmol,
    minMmol,
    maxMmol,
    sdMmol,
    cvPercent,
    estimatedA1c,
    lowCount,
    normalCount,
    elevatedCount,
    highCount,
    lowPct,
    normalPct,
    elevatedPct,
    highPct,
    tirGeneralPct: Math.round((generalInRangeCount / count) * 100),
  };
}

export interface ContextBreakdownRow {
  context: MeasurementContext;
  label: string;
  count: number;
  avgMmol: number;
  minMmol: number;
  maxMmol: number;
  inRangePct: number;
  targetLow: number;
  targetHigh: number;
}

export function computeContextBreakdown(
  records: GlucoseRecord[],
  settings: UserSettings
): ContextBreakdownRow[] {
  const grouped = new Map<MeasurementContext, GlucoseRecord[]>();
  for (const r of records) {
    const list = grouped.get(r.context) ?? [];
    list.push(r);
    grouped.set(r.context, list);
  }

  const rows: ContextBreakdownRow[] = [];
  for (const opt of CONTEXT_OPTIONS) {
    const list = grouped.get(opt.value);
    if (!list || list.length === 0) continue;
    let sum = 0;
    let minMmol = Infinity;
    let maxMmol = -Infinity;
    let inRange = 0;
    const { low, high } = getContextTargetRange(opt.value, settings);
    for (const r of list) {
      sum += r.valueMmol;
      if (r.valueMmol < minMmol) minMmol = r.valueMmol;
      if (r.valueMmol > maxMmol) maxMmol = r.valueMmol;
      if (r.valueMmol >= low && r.valueMmol <= high) inRange += 1;
    }
    rows.push({
      context: opt.value,
      label: opt.label,
      count: list.length,
      avgMmol: sum / list.length,
      minMmol,
      maxMmol,
      inRangePct: Math.round((inRange / list.length) * 100),
      targetLow: low,
      targetHigh: high,
    });
  }
  return rows;
}

export function formatDateTimeCN(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function formatShortDateCN(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
}

export function formatTimeCN(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function toLocalDateTimeInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function sanitizeNote(raw: string): string {
  return raw.trim().slice(0, NOTE_MAX_LENGTH);
}

export function sanitizeDisplayName(raw: string): string {
  return raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function clampValueMmol(val: number): number {
  const clamped = Math.min(MAX_VALUE_MMOL, Math.max(MIN_VALUE_MMOL, val));
  return Math.round(clamped * 10) / 10;
}

export function exportRecordsToCsv(records: GlucoseRecord[], settings: UserSettings): void {
  const headers = [
    '测量时间',
    '测量时段',
    '血糖值 (mmol/L)',
    '换算值 (mg/dL)',
    '评估状态',
    '饮食情况',
    '运动强度',
    '是否按时用药',
    '备注',
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const sorted = [...records].sort((a, b) => b.measuredAtMs - a.measuredAtMs);
  const lines = sorted.map((r) => {
    const status = evaluateGlucoseStatus(r.valueMmol, r.context, settings);
    return [
      escapeCsv(formatDateTimeCN(r.measuredAtMs)),
      escapeCsv(getContextLabel(r.context)),
      r.valueMmol.toFixed(1),
      String(mmolToMgdl(r.valueMmol)),
      escapeCsv(STATUS_META[status].label),
      escapeCsv(getMealLabel(r.mealLevel)),
      escapeCsv(getExerciseLabel(r.exerciseLevel)),
      r.medicationTaken ? '是' : '否',
      escapeCsv(r.note),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().slice(0, 10);
  link.download = `血糖记录_${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
