import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Award, PhoneCall, Clock, Send, Calendar, DollarSign, Settings, RefreshCw, Trophy, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { fetchAgentPerformanceKPI, saveIncentiveSettings, AgentPerformanceKPI, IncentiveSettings, DEFAULT_INCENTIVE_SETTINGS } from '../../services/performance';
import { exportToExcel } from '../../utils/xlsxExport';

const fmtSec = (sec: number) => {
  if (sec <= 0) return '0초';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
};

export default function AgentPerformancePanel() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'last30'>('month');
  const [kpis, setKpis] = useState<AgentPerformanceKPI[]>([]);
  const [settings, setSettings] = useState<IncentiveSettings>(DEFAULT_INCENTIVE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [draftSettings, setDraftSettings] = useState<IncentiveSettings>(DEFAULT_INCENTIVE_SETTINGS);

  const getDateRange = useCallback((p: typeof period) => {
    const now = new Date();
    let start: Date;
    const end = now;

    if (p === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (p === 'week') {
      const day = now.getDay() || 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
    } else if (p === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period);
      const res = await fetchAgentPerformanceKPI(startDate, endDate);
      setKpis(res.kpis);
      setSettings(res.settings);
      setDraftSettings(res.settings);
    } catch (e: any) {
      showToast(`성과 데이터 조회 실패: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, getDateRange, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveIncentiveSettings(draftSettings);
      setSettings(draftSettings);
      setShowSettingsModal(false);
      showToast('인센티브 지급 규칙이 저장되었습니다.', 'success');
      loadData();
    } catch (err: any) {
      showToast(`저장 실패: ${err.message}`, 'error');
    }
  };

  const handleExportExcel = () => {
    if (kpis.length === 0) return;
    const rows = kpis.map((k, idx) => ({
      순위: idx + 1,
      팀원명: k.displayName,
      역할: k.role === 'owner' ? '대표' : k.role === 'admin' ? '관리자' : '상담원',
      담당리드: k.assignedCases,
      발신콜수: k.totalCalls,
      연결콜수: k.connectedCalls,
      통화연결률: `${k.connectRate}%`,
      총통화시간: fmtSec(k.totalDurationSeconds),
      평균통화시간: fmtSec(k.avgDurationSeconds),
      재통화예약: k.remindersCount,
      사무장전달: k.transferredCount,
      사무장전달률: `${k.transferRate}%`,
      계약체결: k.contractCount,
      계약전환율: `${k.contractRate}%`,
      총수임료: k.totalFeeRevenue,
      예상인센티브: k.estimatedIncentive,
    }));
    exportToExcel(`팀원_성과_인센티브_${period}`, rows);
  };

  // 총계 집계
  const totals = useMemo(() => {
    const totalCalls = kpis.reduce((acc, k) => acc + k.totalCalls, 0);
    const totalConnected = kpis.reduce((acc, k) => acc + k.connectedCalls, 0);
    const totalDuration = kpis.reduce((acc, k) => acc + k.totalDurationSeconds, 0);
    const totalReminders = kpis.reduce((acc, k) => acc + k.remindersCount, 0);
    const totalTransferred = kpis.reduce((acc, k) => acc + k.transferredCount, 0);
    const totalContracts = kpis.reduce((acc, k) => acc + k.contractCount, 0);
    const totalRevenue = kpis.reduce((acc, k) => acc + k.totalFeeRevenue, 0);
    const totalIncentive = kpis.reduce((acc, k) => acc + k.estimatedIncentive, 0);

    const overallConnectRate = totalCalls > 0 ? Number(((totalConnected / totalCalls) * 100).toFixed(1)) : 0;
    const overallAvgDuration = totalConnected > 0 ? Math.round(totalDuration / totalConnected) : 0;

    return {
      totalCalls,
      totalConnected,
      overallConnectRate,
      totalDuration,
      overallAvgDuration,
      totalReminders,
      totalTransferred,
      totalContracts,
      totalRevenue,
      totalIncentive,
    };
  }, [kpis]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-sm">
            <Trophy size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              팀원 활동 성과 & 인센티브(성과급) 대시보드
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              전화 콜 수, 통화시간, 사무장 전달, 계약 체결 성과를 실시간 집계하고 인센티브를 자동 산정합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 기간 선택 토글 */}
          <div className="bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg flex text-xs font-semibold">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'today' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'week' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              이번 주
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'month' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              이번 달
            </button>
            <button
              onClick={() => setPeriod('last30')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                period === 'last30' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              최근 30일
            </button>
          </div>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings size={14} />
            인센티브 기준 설정
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors"
          >
            <Download size={14} />
            정산 엑셀
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Aggregate KPI Banner */}
      <div className="p-5 bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200/60 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <PhoneCall size={13} className="text-blue-500" /> 총 발신 콜 / 연결
            </span>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {totals.totalCalls.toLocaleString()} <span className="text-xs font-normal text-gray-500">콜</span>
            </div>
            <span className="text-[11px] text-gray-400">
              연결 {totals.totalConnected.toLocaleString()}건 ({totals.overallConnectRate}%)
            </span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock size={13} className="text-amber-500" /> 총 통화시간
            </span>
            <div className="text-xl font-black text-gray-800 dark:text-white mt-1">
              {fmtSec(totals.totalDuration)}
            </div>
            <span className="text-[11px] text-gray-400">
              평균 {fmtSec(totals.overallAvgDuration)} / 연결건
            </span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Send size={13} className="text-purple-500" /> 사무장 전달 / 재통화
            </span>
            <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {totals.totalTransferred.toLocaleString()} <span className="text-xs font-normal text-gray-500">건</span>
            </div>
            <span className="text-[11px] text-gray-400">
              재통화 예약 {totals.totalReminders.toLocaleString()}건
            </span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Award size={13} className="text-emerald-500" /> 계약 체결 건수
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {totals.totalContracts.toLocaleString()} <span className="text-xs font-normal text-gray-500">건</span>
            </div>
            <span className="text-[11px] text-gray-400">
              총 수임료 ₩{totals.totalRevenue.toLocaleString()}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <DollarSign size={13} className="text-indigo-500" /> 지급 예상 인센티브
            </span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              ₩{totals.totalIncentive.toLocaleString()}
            </div>
            <span className="text-[11px] text-gray-400">
              {settings.calcType === 'fixed'
                ? `건당 ₩${settings.fixedAmount.toLocaleString()} 고정`
                : settings.calcType === 'percent'
                ? `수임료의 ${settings.percentRate}%`
                : '구간별 차등'}
            </span>
          </div>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 w-16 text-center">순위</th>
              <th className="px-4 py-3">팀원명 / 역할</th>
              <th className="px-3 py-3 text-right">담당 리드</th>
              <th className="px-3 py-3 text-right">발신 / 연결콜</th>
              <th className="px-3 py-3 text-right">통화시간(총/평균)</th>
              <th className="px-3 py-3 text-right">재통화 예약</th>
              <th className="px-3 py-3 text-right">사무장 전달</th>
              <th className="px-3 py-3 text-right">계약 체결</th>
              <th className="px-3 py-3 text-right">총 수임료</th>
              <th className="px-5 py-3 text-right font-bold text-indigo-600">예상 인센티브</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {kpis.map((k, idx) => {
              const rank = idx + 1;
              let medalBadge = <span className="font-bold text-gray-400">{rank}</span>;
              if (rank === 1) medalBadge = <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold inline-flex items-center justify-center text-xs">🥇</span>;
              if (rank === 2) medalBadge = <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold inline-flex items-center justify-center text-xs">🥈</span>;
              if (rank === 3) medalBadge = <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-800 font-bold inline-flex items-center justify-center text-xs">🥉</span>;

              return (
                <tr key={k.userId} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-5 py-3 text-center">{medalBadge}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-1.5">
                      <span>{k.displayName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {k.role === 'owner' ? '대표' : k.role === 'admin' ? '관리자' : '상담원'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[140px]">{k.email}</div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                    {k.assignedCases.toLocaleString()}건
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-bold text-blue-600 dark:text-blue-400">
                      {k.connectedCalls} / {k.totalCalls}
                    </div>
                    <div className="text-[11px] text-gray-400">연결률 {k.connectRate}%</div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-medium text-gray-800 dark:text-gray-100">{fmtSec(k.totalDurationSeconds)}</div>
                    <div className="text-[11px] text-gray-400">평균 {fmtSec(k.avgDurationSeconds)}</div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                    {k.remindersCount}건
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-bold text-purple-600 dark:text-purple-400">{k.transferredCount}건</div>
                    <div className="text-[11px] text-gray-400">전달률 {k.transferRate}%</div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-black text-emerald-600 dark:text-emerald-400 text-base">{k.contractCount}건</div>
                    <div className="text-[11px] text-gray-400">전환율 {k.contractRate}%</div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-800 dark:text-gray-100">
                    ₩{k.totalFeeRevenue.toLocaleString()}
                  </td>

                  <td className="px-5 py-3 text-right tabular-nums">
                    <div className="font-black text-indigo-600 dark:text-indigo-400 text-base">
                      ₩{k.estimatedIncentive.toLocaleString()}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && kpis.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-12 text-center text-gray-400">
                  해당 기간에 집계된 팀원 성과 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-gray-800 dark:text-white flex items-center gap-2">
              <Settings size={18} className="text-blue-600" /> 인센티브(성과급) 계산 규칙 설정
            </h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  산정 방식 선택
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                    <input
                      type="radio"
                      name="calcType"
                      checked={draftSettings.calcType === 'fixed'}
                      onChange={() => setDraftSettings({ ...draftSettings, calcType: 'fixed' })}
                      className="text-blue-600"
                    />
                    <span>계약 건당 고정 금액 지급</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                    <input
                      type="radio"
                      name="calcType"
                      checked={draftSettings.calcType === 'percent'}
                      onChange={() => setDraftSettings({ ...draftSettings, calcType: 'percent' })}
                      className="text-blue-600"
                    />
                    <span>계약 수임료의 일정 비율(%) 지급</span>
                  </label>
                </div>
              </div>

              {draftSettings.calcType === 'fixed' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    계약 1건당 인센티브 금액 (원)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5000}
                    value={draftSettings.fixedAmount}
                    onChange={e => setDraftSettings({ ...draftSettings, fixedAmount: parseInt(e.target.value, 10) || 0 })}
                    className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-bold"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">예: 50,000원 입력 시 10건 계약 = 50만 원</span>
                </div>
              )}

              {draftSettings.calcType === 'percent' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    수임료 대비 지급 비율 (%)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    max={50}
                    step={0.5}
                    value={draftSettings.percentRate}
                    onChange={e => setDraftSettings({ ...draftSettings, percentRate: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-bold"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">예: 3% 입력 시 수임료 1,000만 원 = 30만 원</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  규칙 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
