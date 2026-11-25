'use client';

import React, { useMemo, useState } from 'react';
import { Download, Pencil, Printer, Search, Trash2, Plus } from 'lucide-react';
import {
  CONTEXT_OPTIONS,
  displayValue,
  evaluateGlucoseStatus,
  exportRecordsToCsv,
  formatDateTimeCN,
  getContextLabel,
  getExerciseLabel,
  getMealLabel,
  mmolToMgdl,
  STATUS_META,
} from '@/lib/glucose-utils';
import type {
  GlucoseRecord,
  GlucoseStatus,
  MeasurementContext,
  UserSettings,
} from '@/lib/types';

interface RecordsTableViewProps {
  records: GlucoseRecord[];
  settings: UserSettings;
  compactMode?: boolean;
  onEdit: (record: GlucoseRecord) => void;
  onDelete: (id: string) => Promise<void>;
  onAddNew: () => void;
  onViewAll?: () => void;
}

type StatusFilter = 'all' | 'abnormal' | GlucoseStatus;
type SortMode = 'newest' | 'oldest' | 'highest' | 'lowest';

export function RecordsTableView({
  records,
  settings,
  compactMode = false,
  onEdit,
  onDelete,
  onAddNew,
  onViewAll,
}: RecordsTableViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contextFilter, setContextFilter] = useState<'all' | MeasurementContext>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = records.filter((r) => {
      if (contextFilter !== 'all' && r.context !== contextFilter) return false;
      const st = evaluateGlucoseStatus(r.valueMmol, r.context, settings);
      if (statusFilter === 'abnormal' && st === 'normal') return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'abnormal' &&
        st !== statusFilter
      ) {
        return false;
      }
      if (q) {
        const ctxLabel = getContextLabel(r.context).toLowerCase();
        const noteText = r.note.toLowerCase();
        const valText = `${displayValue(r.valueMmol, settings.unit)}`;
        if (!ctxLabel.includes(q) && !noteText.includes(q) && !valText.includes(q)) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortMode === 'oldest') return a.measuredAtMs - b.measuredAtMs;
      if (sortMode === 'highest') return b.valueMmol - a.valueMmol;
      if (sortMode === 'lowest') return a.valueMmol - b.valueMmol;
      return b.measuredAtMs - a.measuredAtMs;
    });

    return compactMode ? list.slice(0, 8) : list;
  }, [records, searchTerm, statusFilter, contextFilter, sortMode, settings, compactMode]);

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {compactMode ? '最近血糖记录' : '血糖记录明细台账'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {compactMode
              ? `显示最近 ${filtered.length} 条记录，点击任意行右侧图标可修改或删除`
              : `共筛选出 ${filtered.length} 条记录（当前单位：${settings.unit}）`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {compactMode && onViewAll && records.length > 8 && (
            <button
              type="button"
              onClick={onViewAll}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors whitespace-nowrap"
            >
              查看全部 {records.length} 条
            </button>
          )}
          {!compactMode && (
            <>
              <button
                type="button"
                onClick={() => exportRecordsToCsv(filtered, settings)}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                导出 CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                打印复诊单
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters (Full view) */}
      {!compactMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 no-print">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索备注、时段或数值..."
              className="w-full pl-9 pr-3 py-2 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="按血糖状态筛选"
            className="px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          >
            <option value="all">全部状态</option>
            <option value="abnormal">仅看异常（偏低/偏高/过高）</option>
            <option value="normal">仅看达标</option>
            <option value="low">仅看偏低</option>
            <option value="elevated">仅看偏高</option>
            <option value="high">仅看过高</option>
          </select>

          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value as 'all' | MeasurementContext)}
            aria-label="按测量时段筛选"
            className="px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          >
            <option value="all">全部测量时段</option>
            {CONTEXT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label="排序方式"
            className="px-3 py-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          >
            <option value="newest">时间由近到远</option>
            <option value="oldest">时间由远到近</option>
            <option value="highest">血糖由高到低</option>
            <option value="lowest">血糖由低到高</option>
          </select>
        </div>
      )}

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/40 px-4">
          <p className="text-sm font-medium text-slate-700">
            {records.length === 0 ? '还没有血糖记录' : '没有符合当前筛选条件的记录'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {records.length === 0
              ? '记录您的第一次空腹或餐后血糖后，系统将自动生成趋势图与达标率分析。'
              : '请尝试清空搜索关键词或放宽状态筛选条件。'}
          </p>
          {records.length === 0 && (
            <button
              type="button"
              onClick={onAddNew}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              记录第一条血糖
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">测量时间</th>
                <th className="py-2.5 px-3">时段</th>
                <th className="py-2.5 px-3 text-right">血糖值</th>
                <th className="py-2.5 px-3">评估</th>
                <th className="py-2.5 px-3 hidden md:table-cell">饮食 · 运动 · 用药与备注</th>
                <th className="py-2.5 pl-3 text-right no-print">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((rec) => {
                const status = evaluateGlucoseStatus(rec.valueMmol, rec.context, settings);
                const statusMeta = STATUS_META[status];
                const isConfirming = pendingDeleteId === rec.id;
                const metaParts: string[] = [];
                if (rec.mealLevel !== 'none') metaParts.push(`饮食:${getMealLabel(rec.mealLevel)}`);
                if (rec.exerciseLevel !== 'none')
                  metaParts.push(`运动:${getExerciseLabel(rec.exerciseLevel)}`);
                metaParts.push(rec.medicationTaken ? '已用药' : '未标注用药');

                return (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDateTimeCN(rec.measuredAtMs)}
                    </td>
                    <td className="py-3 px-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {getContextLabel(rec.context)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {displayValue(rec.valueMmol, settings.unit)}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">{settings.unit}</span>
                      {settings.unit === 'mmol/L' && (
                        <span className="hidden xl:inline text-[11px] text-slate-400 font-mono tabular-nums ml-1.5">
                          ({mmolToMgdl(rec.valueMmol)} mg/dL)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${statusMeta.textClass}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell max-w-md">
                      <div className="text-xs text-slate-500 truncate">
                        <span>{metaParts.join(' · ')}</span>
                        {rec.note && (
                          <>
                            <span aria-hidden="true" className="mx-1.5 text-slate-300">
                              —
                            </span>
                            <span className="text-slate-700">{rec.note}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap no-print">
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={deletingId === rec.id}
                            onClick={() => handleConfirmDelete(rec.id)}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                          >
                            {deletingId === rec.id ? '删除中' : '确认删除'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(rec)}
                            className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
                            aria-label="编辑记录"
                            title="编辑"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(rec.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            aria-label="删除记录"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
