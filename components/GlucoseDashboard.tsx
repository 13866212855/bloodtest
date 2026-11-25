'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Cloud, LogIn, X, CloudUpload } from 'lucide-react';
import { useGlucoseData } from './GlucoseDataProvider';
import { RecordModal } from './RecordModal';
import { GlucoseTrendChart } from './GlucoseTrendChart';
import { ModalDayChart } from './ModalDayChart';
import { ContextBreakdownPanel } from './ContextBreakdownPanel';
import { RecordsTableView } from './RecordsTableView';
import { SettingsView } from './SettingsView';
import {
  computeGlucoseSummary,
  displayNumericValue,
  displayValue,
  evaluateGlucoseStatus,
  filterRecordsByDateRange,
  formatDateTimeCN,
  getContextLabel,
  STATUS_META,
} from '@/lib/glucose-utils';
import type { DateRangeOption, GlucoseRecord, GlucoseRecordInput } from '@/lib/types';

type ActiveTab = 'overview' | 'analytics' | 'records' | 'settings';

const NAV_TABS: { id: ActiveTab; label: string }[] = [
  { id: 'overview', label: '总览看板' },
  { id: 'analytics', label: '趋势分析' },
  { id: 'records', label: '记录明细' },
  { id: 'settings', label: '控糖设置' },
];

const DATE_RANGES: { id: DateRangeOption; label: string }[] = [
  { id: '7d', label: '近7天' },
  { id: '14d', label: '近14天' },
  { id: '30d', label: '近30天' },
  { id: '90d', label: '近90天' },
  { id: 'all', label: '全部' },
];

export function GlucoseDashboard() {
  const {
    user,
    loadingData,
    isCloudMode,
    authError,
    clearAuthError,
    records,
    settings,
    localDraftCount,
    signInWithGoogle,
    signOutUser,
    addRecord,
    editRecord,
    removeRecord,
    updateSettings,
    toggleUnit,
    importSampleData,
    importLocalRecordsToCloud,
    clearLocalRecords,
  } = useGlucoseData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [dateRange, setDateRange] = useState<DateRangeOption>('14d');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GlucoseRecord | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [renderNowMs, setRenderNowMs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setRenderNowMs(Date.now());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rangedRecords = useMemo(
    () =>
      renderNowMs === null
        ? []
        : filterRecordsByDateRange(records, dateRange, renderNowMs),
    [records, dateRange, renderNowMs]
  );

  const summary = useMemo(
    () => computeGlucoseSummary(rangedRecords, settings),
    [rangedRecords, settings]
  );

  const latestRecord = records.length > 0 ? records[0] : null;
  const latestStatus = latestRecord
    ? evaluateGlucoseStatus(latestRecord.valueMmol, latestRecord.context, settings)
    : null;

  const openAddModal = () => {
    setEditingRecord(null);
    setModalOpen(true);
  };

  const openEditModal = (record: GlucoseRecord) => {
    setEditingRecord(record);
    setModalOpen(true);
  };

  const handleSaveRecord = async (input: GlucoseRecordInput, editingId?: string) => {
    if (editingId) {
      await editRecord(editingId, input);
    } else {
      await addRecord(input);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            清糖笔记
          </a>

          {/* Zone 2: 4 Single-line Nav Links */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium"
            aria-label="主导航"
          >
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-teal-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              记录血糖
            </button>
          </div>
        </div>

        {/* Mobile compact nav row */}
        <div className="md:hidden border-t border-slate-100 px-3 flex items-center justify-around">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-teal-700 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Print-only clinical summary header */}
        <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
          <h1 className="text-xl font-bold text-slate-900">
            个人血糖监测复诊汇总单 · {settings.displayName}
          </h1>
          <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
            打印时间：{renderNowMs ? formatDateTimeCN(renderNowMs) : '—'} · 统计周期：{DATE_RANGES.find((d) => d.id === dateRange)?.label} · 单位：{settings.unit} · 目标空腹 {displayNumericValue(settings.fastingLow, settings.unit)}–{displayNumericValue(settings.fastingHigh, settings.unit)} / 餐后 {displayNumericValue(settings.postMealLow, settings.unit)}–{displayNumericValue(settings.postMealHigh, settings.unit)}
          </p>
        </div>

        {/* Workspace Toolbar: Account Sync, Unit Switcher & Date Range Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 no-print">
          {/* Account & Sync Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {isCloudMode ? (
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                <Cloud className="w-4 h-4 text-teal-700 shrink-0" />
                <span className="font-medium text-slate-800">云端加密同步</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="truncate max-w-[200px]">{user?.email}</span>
                {localDraftCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const n = await importLocalRecordsToCloud();
                      setImportNotice(`已成功将 ${n} 条本地记录导入云端`);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    导入 {localDraftCount} 条本地记录
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 text-slate-600">
                <span>本地试用模式（示例与新增数据暂存当前浏览器）</span>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5 text-teal-700" />
                  登录 Google 云端同步
                </button>
              </div>
            )}
          </div>

          {/* Right Controls: Unit Switcher & Date Range */}
          {activeTab !== 'settings' && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Unit toggle */}
              <div
                className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-lg"
                role="group"
                aria-label="血糖单位切换"
              >
                {(['mmol/L', 'mg/dL'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => toggleUnit(u)}
                    className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      settings.unit === u
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              {/* Date Range Selector */}
              <div
                className="flex items-center gap-0.5 p-0.5 bg-slate-200/70 rounded-lg overflow-x-auto"
                role="group"
                aria-label="统计周期筛选"
              >
                {DATE_RANGES.map((dr) => (
                  <button
                    key={dr.id}
                    type="button"
                    onClick={() => setDateRange(dr.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      dateRange === dr.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {dr.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Auth error or import notice */}
        {authError && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 no-print">
            <span>{authError}</span>
            <button
              type="button"
              onClick={clearAuthError}
              className="p-1 hover:bg-red-100 rounded"
              aria-label="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {importNotice && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 no-print">
            <span>{importNotice}</span>
            <button
              type="button"
              onClick={() => setImportNotice(null)}
              className="p-1 hover:bg-emerald-100 rounded"
              aria-label="关闭提示"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loadingData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-[132px] bg-white border border-slate-200 rounded-xl p-5 animate-pulse space-y-3"
                >
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                  <div className="h-8 w-28 bg-slate-200 rounded" />
                  <div className="h-3 w-36 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
            <div className="h-[340px] bg-white border border-slate-200 rounded-xl p-5 animate-pulse" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* 4-Column Full-Width KPI Strip (Overview & Analytics) */}
              {(activeTab === 'overview' || activeTab === 'analytics') && (
                <section aria-label="核心血糖指标" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* KPI 1: Latest Reading */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between min-h-[132px]">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>最近一次血糖</span>
                      {latestStatus && (
                        <span className={`font-semibold ${STATUS_META[latestStatus].textClass}`}>
                          {STATUS_META[latestStatus].label}
                        </span>
                      )}
                    </div>
                    {latestRecord ? (
                      <>
                        <div className="my-1.5 flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-900">
                            {displayValue(latestRecord.valueMmol, settings.unit)}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{settings.unit}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          <span>{getContextLabel(latestRecord.context)}</span>
                          <span aria-hidden="true" className="mx-1.5 text-slate-300">
                            ·
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatDateTimeCN(latestRecord.measuredAtMs)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="my-2 text-sm text-slate-400">暂无测量记录</div>
                    )}
                  </div>

                  {/* KPI 2: Period Average & eA1c */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between min-h-[132px]">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>周期平均血糖</span>
                      <span className="font-mono tabular-nums">共 {summary.count} 次</span>
                    </div>
                    {summary.count > 0 ? (
                      <>
                        <div className="my-1.5 flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold font-mono tabular-nums tracking-tight text-slate-900">
                            {displayValue(summary.avgMmol, settings.unit)}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{settings.unit}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums truncate">
                          {summary.estimatedA1c !== null ? (
                            <span>
                              预估糖化 eA1c ≈ {summary.estimatedA1c.toFixed(1)}%
                            </span>
                          ) : (
                            <span>
                              范围 {displayValue(summary.minMmol, settings.unit)}–
                              {displayValue(summary.maxMmol, settings.unit)}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="my-2 text-sm text-slate-400">暂无统计数据</div>
                    )}
                  </div>

                  {/* KPI 3: TIR (Time in Range) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between min-h-[132px]">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>时段目标达标率 (TIR)</span>
                      <span className="font-mono tabular-nums text-slate-400">建议 ≥ 70%</span>
                    </div>
                    {summary.count > 0 ? (
                      <>
                        <div className="my-1 flex items-baseline gap-2">
                          <span
                            className={`text-3xl font-bold font-mono tabular-nums tracking-tight ${
                              summary.normalPct >= 70 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {summary.normalPct}%
                          </span>
                          <span className="text-xs text-slate-500 font-mono tabular-nums">
                            ({summary.normalCount}/{summary.count} 次)
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-100">
                            {summary.lowPct > 0 && (
                              <div
                                style={{ width: `${summary.lowPct}%` }}
                                className="bg-sky-600 h-full"
                                title={`偏低 ${summary.lowPct}%`}
                              />
                            )}
                            {summary.normalPct > 0 && (
                              <div
                                style={{ width: `${summary.normalPct}%` }}
                                className="bg-emerald-600 h-full"
                                title={`达标 ${summary.normalPct}%`}
                              />
                            )}
                            {summary.elevatedPct > 0 && (
                              <div
                                style={{ width: `${summary.elevatedPct}%` }}
                                className="bg-amber-500 h-full"
                                title={`偏高 ${summary.elevatedPct}%`}
                              />
                            )}
                            {summary.highPct > 0 && (
                              <div
                                style={{ width: `${summary.highPct}%` }}
                                className="bg-red-600 h-full"
                                title={`过高 ${summary.highPct}%`}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                            <span>低 {summary.lowPct}%</span>
                            <span>高 {summary.elevatedPct + summary.highPct}%</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="my-2 text-sm text-slate-400">暂无达标率数据</div>
                    )}
                  </div>

                  {/* KPI 4: Glycemic Variability CV% */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between min-h-[132px]">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>血糖波动系数 (CV)</span>
                      <span className="font-mono tabular-nums text-slate-400">平稳 ≤ 36%</span>
                    </div>
                    {summary.count > 0 ? (
                      <>
                        <div className="my-1.5 flex items-baseline gap-2">
                          <span
                            className={`text-3xl font-bold font-mono tabular-nums tracking-tight ${
                              summary.cvPercent <= 36 ? 'text-slate-900' : 'text-amber-700'
                            }`}
                          >
                            {summary.cvPercent.toFixed(1)}%
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            SD {displayValue(summary.sdMmol, settings.unit)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          <span>
                            {summary.count < 2
                              ? '至少需要 2 次记录评估波动'
                              : summary.cvPercent <= 36
                              ? '血糖波动平稳'
                              : '血糖波动偏大，建议关注餐后峰值'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="my-2 text-sm text-slate-400">暂无波动统计</div>
                    )}
                  </div>
                </section>
              )}

              {/* Tab-specific body */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <GlucoseTrendChart
                    records={rangedRecords}
                    settings={settings}
                    onSelectRecord={openEditModal}
                  />
                  <RecordsTableView
                    records={rangedRecords}
                    settings={settings}
                    compactMode
                    onEdit={openEditModal}
                    onDelete={removeRecord}
                    onAddNew={openAddModal}
                    onViewAll={() => setActiveTab('records')}
                  />
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <GlucoseTrendChart
                    records={rangedRecords}
                    settings={settings}
                    onSelectRecord={openEditModal}
                  />
                  <ModalDayChart
                    records={rangedRecords}
                    settings={settings}
                    onSelectRecord={openEditModal}
                  />
                  <ContextBreakdownPanel
                    records={rangedRecords}
                    allRecords={records}
                    settings={settings}
                  />
                </div>
              )}

              {activeTab === 'records' && (
                <RecordsTableView
                  records={rangedRecords}
                  settings={settings}
                  onEdit={openEditModal}
                  onDelete={removeRecord}
                  onAddNew={openAddModal}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  settings={settings}
                  isCloudMode={isCloudMode}
                  userEmail={user?.email ?? null}
                  localDraftCount={localDraftCount}
                  recordCount={records.length}
                  onUpdateSettings={updateSettings}
                  onSignIn={signInWithGoogle}
                  onSignOut={signOutUser}
                  onImportLocalToCloud={importLocalRecordsToCloud}
                  onImportSampleData={importSampleData}
                  onClearLocalRecords={clearLocalRecords}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Quiet Clinical Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>清糖笔记 · 个人血糖管理与趋势分析工具</span>
          <span>数据仅用于个人健康记录参考，诊疗方案请遵医嘱</span>
        </div>
      </footer>

      {/* Add / Edit Record Modal */}
      <RecordModal
        isOpen={modalOpen}
        editingRecord={editingRecord}
        settings={settings}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveRecord}
      />
    </div>
  );
}
