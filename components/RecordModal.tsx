'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Minus, Plus, Clock } from 'lucide-react';
import {
  clampValueMmol,
  CONTEXT_OPTIONS,
  displayNumericValue,
  evaluateGlucoseStatus,
  EXERCISE_OPTIONS,
  getContextTargetRange,
  MAX_VALUE_MMOL,
  MEAL_OPTIONS,
  mgdlToMmol,
  MIN_VALUE_MMOL,
  mmolToMgdl,
  NOTE_MAX_LENGTH,
  STATUS_META,
  toLocalDateTimeInputValue,
} from '@/lib/glucose-utils';
import type {
  ExerciseLevel,
  GlucoseRecord,
  GlucoseRecordInput,
  MealLevel,
  MeasurementContext,
  UserSettings,
} from '@/lib/types';

interface RecordModalProps {
  isOpen: boolean;
  editingRecord: GlucoseRecord | null;
  settings: UserSettings;
  onClose: () => void;
  onSave: (input: GlucoseRecordInput, editingId?: string) => Promise<void>;
}

function suggestDefaultContext(): MeasurementContext {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'fasting';
  if (hour >= 8 && hour < 11) return 'after_breakfast';
  if (hour >= 11 && hour < 13) return 'before_lunch';
  if (hour >= 13 && hour < 16) return 'after_lunch';
  if (hour >= 16 && hour < 19) return 'before_dinner';
  if (hour >= 19 && hour < 21) return 'after_dinner';
  if (hour >= 21 || hour < 5) return 'bedtime';
  return 'random';
}

export function RecordModal({
  isOpen,
  editingRecord,
  settings,
  onClose,
  onSave,
}: RecordModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <RecordModalInner
          key={`${editingRecord?.id ?? 'new'}_${settings.unit}`}
          editingRecord={editingRecord}
          settings={settings}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </AnimatePresence>
  );
}

function RecordModalInner({
  editingRecord,
  settings,
  onClose,
  onSave,
}: Omit<RecordModalProps, 'isOpen'>) {
  const isMgdl = settings.unit === 'mg/dL';

  const [rawValueStr, setRawValueStr] = useState(() =>
    editingRecord
      ? String(displayNumericValue(editingRecord.valueMmol, settings.unit))
      : String(displayNumericValue(5.8, settings.unit))
  );
  const [context, setContext] = useState<MeasurementContext>(() =>
    editingRecord ? editingRecord.context : suggestDefaultContext()
  );
  const [measuredAtStr, setMeasuredAtStr] = useState(() =>
    editingRecord
      ? toLocalDateTimeInputValue(editingRecord.measuredAtMs)
      : toLocalDateTimeInputValue(Date.now())
  );
  const [mealLevel, setMealLevel] = useState<MealLevel>(() =>
    editingRecord ? editingRecord.mealLevel : 'none'
  );
  const [exerciseLevel, setExerciseLevel] = useState<ExerciseLevel>(() =>
    editingRecord ? editingRecord.exerciseLevel : 'none'
  );
  const [medicationTaken, setMedicationTaken] = useState<boolean>(() =>
    editingRecord ? editingRecord.medicationTaken : true
  );
  const [note, setNote] = useState(() => (editingRecord ? editingRecord.note : ''));
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const parsedMmol = useMemo(() => {
    const num = Number(rawValueStr);
    if (!Number.isFinite(num) || num <= 0) return null;
    const mmol = isMgdl ? mgdlToMmol(num) : num;
    return clampValueMmol(mmol);
  }, [rawValueStr, isMgdl]);

  const liveStatus = useMemo(() => {
    if (parsedMmol === null) return null;
    return evaluateGlucoseStatus(parsedMmol, context, settings);
  }, [parsedMmol, context, settings]);

  const targetRange = useMemo(() => {
    return getContextTargetRange(context, settings);
  }, [context, settings]);

  const handleStep = (delta: number) => {
    const current = Number(rawValueStr);
    const base = Number.isFinite(current) && current > 0 ? current : isMgdl ? 100 : 5.6;
    const next = isMgdl
      ? Math.min(Math.round(MAX_VALUE_MMOL * 18.0182), Math.max(10, Math.round(base + delta)))
      : Math.min(MAX_VALUE_MMOL, Math.max(MIN_VALUE_MMOL, Math.round((base + delta) * 10) / 10));
    setRawValueStr(String(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(rawValueStr);
    if (!Number.isFinite(num) || num <= 0) {
      setValidationError('请输入有效的血糖数值。');
      return;
    }

    const mmol = isMgdl ? mgdlToMmol(num) : Math.round(num * 10) / 10;
    if (mmol < MIN_VALUE_MMOL || mmol > MAX_VALUE_MMOL) {
      setValidationError(
        isMgdl
          ? `血糖值需在 ${mmolToMgdl(MIN_VALUE_MMOL)} 至 ${mmolToMgdl(MAX_VALUE_MMOL)} mg/dL 之间。`
          : `血糖值需在 ${MIN_VALUE_MMOL} 至 ${MAX_VALUE_MMOL} mmol/L 之间。`
      );
      return;
    }

    const measuredMs = measuredAtStr ? new Date(measuredAtStr).getTime() : Date.now();
    if (!Number.isFinite(measuredMs) || measuredMs <= 0) {
      setValidationError('请选择有效的测量时间。');
      return;
    }

    setSubmitting(true);
    setValidationError(null);
    try {
      await onSave(
        {
          valueMmol: mmol,
          context,
          measuredAtMs: measuredMs,
          note: note.trim().slice(0, NOTE_MAX_LENGTH),
          mealLevel,
          exerciseLevel,
          medicationTaken,
        },
        editingRecord?.id
      );
      onClose();
    } catch {
      setValidationError('保存失败，请检查网络连接后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 id="record-modal-title" className="text-base font-semibold text-slate-900">
            {editingRecord ? '编辑血糖记录' : '记录一次血糖测量'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="关闭弹窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Glucose numeric input with steppers & live status */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>血糖测量值 ({settings.unit})</span>
              <span>
                该时段参考目标：{displayNumericValue(targetRange.low, settings.unit)} –{' '}
                {displayNumericValue(targetRange.high, settings.unit)} {settings.unit}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleStep(isMgdl ? -5 : -0.2)}
                className="h-11 w-11 shrink-0 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="减少数值"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <input
                  type="number"
                  step={isMgdl ? '1' : '0.1'}
                  min={isMgdl ? 10 : 0.5}
                  max={isMgdl ? 720 : 40}
                  value={rawValueStr}
                  onChange={(e) => setRawValueStr(e.target.value)}
                  className="w-full h-12 px-4 text-center text-2xl font-semibold font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                  required
                  autoFocus
                />
              </div>

              <button
                type="button"
                onClick={() => handleStep(isMgdl ? 5 : 0.2)}
                className="h-11 w-11 shrink-0 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="增加数值"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-500 font-mono tabular-nums">
                {parsedMmol !== null
                  ? isMgdl
                    ? `约等于 ${parsedMmol.toFixed(1)} mmol/L`
                    : `约等于 ${mmolToMgdl(parsedMmol)} mg/dL`
                  : '请输入数值'}
              </span>
              {liveStatus && (
                <span className={`font-medium ${STATUS_META[liveStatus].textClass}`}>
                  当前评估：{STATUS_META[liveStatus].label}
                </span>
              )}
            </div>
          </div>

          {/* Measurement Context */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">测量时段</label>
            <div className="grid grid-cols-3 gap-2">
              {CONTEXT_OPTIONS.map((opt) => {
                const active = context === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setContext(opt.value)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="measuredAtInput" className="text-xs font-medium text-slate-700">
                测量日期与时间
              </label>
              <button
                type="button"
                onClick={() => setMeasuredAtStr(toLocalDateTimeInputValue(Date.now()))}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                设为当前时间
              </button>
            </div>
            <input
              id="measuredAtInput"
              type="datetime-local"
              value={measuredAtStr}
              onChange={(e) => setMeasuredAtStr(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
              required
            />
          </div>

          {/* Lifestyle & Medication Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">关联饮食</label>
              <div className="grid grid-cols-2 gap-1.5">
                {MEAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMealLevel(opt.value)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap truncate ${
                      mealLevel === opt.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">运动情况</label>
              <div className="grid grid-cols-2 gap-1.5">
                {EXERCISE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExerciseLevel(opt.value)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors whitespace-nowrap truncate ${
                      exerciseLevel === opt.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Medication toggle */}
          <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
            <div>
              <div className="text-xs font-medium text-slate-800">是否已按时用药 / 注射胰岛素</div>
              <div className="text-xs text-slate-500">用于复盘漏服或调整用药后的血糖响应</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={medicationTaken}
              onClick={() => setMedicationTaken((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                medicationTaken ? 'bg-teal-700' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  medicationTaken ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="noteInput" className="text-xs font-medium text-slate-700">
                备注信息（选填）
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {note.length}/{NOTE_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="noteInput"
              rows={2}
              maxLength={NOTE_MAX_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：早餐吃了全麦面包和牛奶，饭后散步25分钟..."
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 resize-none"
            />
          </div>

          {validationError && (
            <p className="text-xs text-red-600 font-medium">{validationError}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              {submitting ? '正在保存...' : editingRecord ? '保存修改' : '保存记录'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
