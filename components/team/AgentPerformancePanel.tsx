import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Award, PhoneCall, Clock, Send, Calendar, DollarSign, Settings,
  RefreshCw, Trophy, Download, Plus, Trash2, CheckCircle2,
  HelpCircle, Layers, Info, Check, Sparkles
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchAgentPerformanceKPI, saveIncentiveSettings, AgentPerformanceKPI,
  IncentiveSettings, DEFAULT_INCENTIVE_SETTINGS, IncentiveContractType,
  PayoutSchedule, formatPayoutSchedule, getCurrentPayoutPeriod,
  DEFAULT_CONTRACT_TYPES, DEFAULT_PAYOUT_SCHEDULE
} from '../../services/performance';
import { exportToExcel } from '../../utils/xlsxExport';
import { useQuery } from '@tanstack/react-query';
import { fetchCases } from '../../services/api';

const fmtSec = (sec: number) => {
  if (sec <= 0) return '0초';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
};

const WEEKDAYS = [
  { val: 1, label: '월요일' },
  { val: 2, label: '화요일' },
  { val: 3, label: '수요일' },
  { val: 4, label: '목요일' },
  { val: 5, label: '금요일' },
  { val: 6, label: '토요일' },
  { val: 7, label: '일요일' },
];

export default function AgentPerformancePanel() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<'payout' | 'today' | 'week' | 'month' | 'last30'>('payout');
  const [kpis, setKpis] = useState<AgentPerformanceKPI[]>([]);
  const [settings, setSettings] = useState<IncentiveSettings>(DEFAULT_INCENTIVE_SETTINGS);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'types' | 'schedule'>('types');
  const [draftSettings, setDraftSettings] = useState<IncentiveSettings>(DEFAULT_INCENTIVE_SETTINGS);

  // 상세 보기 모달 (특정 상담원의 계약 종류별 인센티브 내역)
  const [selectedAgentBreakdown, setSelectedAgentBreakdown] = useState<AgentPerformanceKPI | null>(null);

  // 전체 케이스 데이터 (정밀 계약 종류별 집계용)
  const { data: allCases = [] } = useQuery({ queryKey: ['cases'], queryFn: fetchCases });

  // 현재 정산 회차 정보 계산
  const payoutInfo = useMemo(() => {
    return getCurrentPayoutPeriod(settings.payoutSchedule);
  }, [settings.payoutSchedule]);

  const getDateRange = useCallback((p: typeof period, curPayout: typeof payoutInfo) => {
    const now = new Date();

    if (p === 'payout') {
      return {
        startDate: curPayout.startDate,
        endDate: curPayout.endDate,
      };
    }
    if (p === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (p === 'week') {
      const day = now.getDay() || 7;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (p === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    // last30
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period, payoutInfo);
      const res = await fetchAgentPerformanceKPI(startDate, endDate, allCases);
      setKpis(res.kpis);
      setSettings(res.settings);
    } catch (e: any) {
      showToast(`성과 데이터 조회 실패: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, payoutInfo, allCases, getDateRange, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 설정 모달 열기
  const openSettingsModal = () => {
    setDraftSettings(JSON.parse(JSON.stringify(settings)));
    setActiveModalTab('types');
    setShowSettingsModal(true);
  };

  // 새 계약 종류 추가 (최대 10개)
  const handleAddContractType = () => {
    if (draftSettings.contractTypes.length >= 10) {
      showToast('인센티브 종류는 최대 10개까지 등록할 수 있습니다.', 'error');
      return;
    }
    const newId = `type_${Date.now()}`;
    const newType: IncentiveContractType = {
      id: newId,
      name: `신규 계약 종류 ${draftSettings.contractTypes.length + 1}`,
      calcType: 'fixed',
      amount: 50000,
      rate: 0,
      isDefault: false,
      description: '',
    };
    setDraftSettings({
      ...draftSettings,
      contractTypes: [...draftSettings.contractTypes, newType],
    });
  };

  // 계약 종류 삭제 (최소 1개 유지)
  const handleRemoveContractType = (id: string) => {
    if (draftSettings.contractTypes.length <= 1) {
      showToast('최소 1개 이상의 계약 종류가 유지되어야 합니다.', 'error');
      return;
    }
    const filtered = draftSettings.contractTypes.filter(t => t.id !== id);
    if (!filtered.some(t => t.isDefault)) {
      filtered[0].isDefault = true;
    }
    setDraftSettings({
      ...draftSettings,
      contractTypes: filtered,
    });
  };

  // 기본 계약 종류 지정
  const handleSetDefaultType = (id: string) => {
    const updated = draftSettings.contractTypes.map(t => ({
      ...t,
      isDefault: t.id === id,
    }));
    setDraftSettings({
      ...draftSettings,
      contractTypes: updated,
    });
  };

  // 특정 계약 종류 필드 업데이트
  const handleUpdateTypeField = (id: string, field: keyof IncentiveContractType, value: any) => {
    const updated = draftSettings.contractTypes.map(t => {
      if (t.id === id) {
        return { ...t, [field]: value };
      }
      return t;
    });
    setDraftSettings({
      ...draftSettings,
      contractTypes: updated,
    });
  };

  // 설정 저장
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    for (const t of draftSettings.contractTypes) {
      if (!t.name.trim()) {
        showToast('모든 인센티브 종류의 이름을 입력해 주세요.', 'error');
        return;
      }
    }

    try {
      await saveIncentiveSettings(draftSettings);
      setSettings(draftSettings);
      setShowSettingsModal(false);
      showToast('인센티브 종류 및 정산 지급일 규칙이 저장되었습니다.', 'success');
      loadData();
    } catch (err: any) {
      showToast(`저장 실패: ${err.message}`, 'error');
    }
  };

  const handleExportExcel = () => {
    if (kpis.length === 0) return;
    const scheduleText = formatPayoutSchedule(settings.payoutSchedule);

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
      세부계약내역: k.contractBreakdown.map(b => `${b.typeName}: ${b.count}건 (₩${b.incentiveAmount.toLocaleString()})`).join(' / ') || '없음',
      정산규칙: scheduleText,
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

  const scheduleSentence = formatPayoutSchedule(settings.payoutSchedule);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden space-y-0">
      {/* 1. Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md">
            <Trophy size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              팀원 활동 성과 & 다원화 인센티브 대시보드
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              계약 종류별 차등 성과급 산정 및 회사 맞춤 지급일 스케줄 관리
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 기간 선택 토글 */}
          <div className="bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl flex text-xs font-semibold">
            <button
              onClick={() => setPeriod('payout')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                period === 'payout'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
              }`}
            >
              <Sparkles size={13} />
              이번 정산 회차
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'month' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              이번 달
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'week' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              이번 주
            </button>
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'today' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setPeriod('last30')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === 'last30' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs font-bold' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              최근 30일
            </button>
          </div>

          <button
            onClick={openSettingsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors shadow-xs"
          >
            <Settings size={14} />
            인센티브 & 지급일 설정
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Download size={14} />
            정산 엑셀
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
            title="새로고침"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. 회사 맞춤 인센티브 정산 회차 & 지급일 정보 배너 */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/40 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 border-b border-blue-100 dark:border-blue-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
            <Calendar size={15} className="text-blue-600 dark:text-blue-400" />
            <span>현재 정산 회차:</span>
            <span className="px-2 py-0.5 rounded-md bg-white dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-extrabold">
              {payoutInfo.label} ({payoutInfo.startDate.slice(5, 10)} ~ {payoutInfo.endDate.slice(5, 10)})
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-200">
            <DollarSign size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span>지급 예정일:</span>
            <span className="font-extrabold text-indigo-700 dark:text-indigo-300">
              {payoutInfo.payoutDate}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
              payoutInfo.dDay > 0
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}>
              {payoutInfo.dDay > 0 ? `D-${payoutInfo.dDay}` : payoutInfo.dDay === 0 ? 'D-Day (오늘)' : '정산 완료'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-[11px]">
          <span className="truncate max-w-[420px]" title={scheduleSentence}>
            📌 <b>지급 규칙</b>: {scheduleSentence}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">
            계약 종류 {settings.contractTypes.length}개 적용 중
          </span>
        </div>
      </div>

      {/* 3. 상단 4대 핵심 요약 카드 */}
      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40">
        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold">
            <span>총 발신 / 연결 콜</span>
            <PhoneCall size={16} className="text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-800 dark:text-white tabular-nums">
            {totals.totalCalls.toLocaleString()} <span className="text-xs font-medium text-gray-500">콜</span>
          </div>
          <div className="mt-1 text-xs text-blue-600 font-semibold">
            연결 {totals.totalConnected.toLocaleString()}건 ({totals.overallConnectRate}%)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold">
            <span>총 통화 시간</span>
            <Clock size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-gray-800 dark:text-white tabular-nums">
            {fmtSec(totals.totalDuration)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            콜당 평균 {fmtSec(totals.overallAvgDuration)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 shadow-2xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-semibold">
            <span>계약 완료 건수</span>
            <Award size={16} className="text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
            {totals.totalContracts.toLocaleString()} <span className="text-xs font-medium text-gray-500">건</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            총 수임료 ₩{totals.totalRevenue.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 text-xs font-bold">
            <span>예상 인센티브 합계</span>
            <DollarSign size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
            ₩{totals.totalIncentive.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">
            {period === 'payout' ? '이번 회차 지급 예정' : '선택 기간 발생분'}
          </div>
        </div>
      </div>

      {/* 4. 팀원 랭킹 및 세부 활동 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-center px-4 py-3 w-12">순위</th>
              <th className="text-left px-4 py-3">팀원명 / 역할</th>
              <th className="text-right px-3 py-3">담당 리드</th>
              <th className="text-right px-3 py-3">발신 / 연결 (연결률)</th>
              <th className="text-right px-3 py-3">총 통화시간 (평균)</th>
              <th className="text-right px-3 py-3">재통화 예약</th>
              <th className="text-right px-3 py-3">사무장 전달 (전달률)</th>
              <th className="text-right px-3 py-3">계약 체결</th>
              <th className="text-right px-3 py-3">수임료 매출</th>
              <th className="text-right px-5 py-3">인센티브(성과급)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {kpis.map((k, idx) => {
              const isTop = idx === 0 && k.contractCount > 0;
              return (
                <tr
                  key={k.userId}
                  className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors ${
                    isTop ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-center">
                    {idx === 0 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs shadow-xs">
                        1
                      </span>
                    ) : idx === 1 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400 text-white font-black text-xs">
                        2
                      </span>
                    ) : idx === 2 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs">
                        3
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">{idx + 1}</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                      {k.displayName}
                      {k.status === 'disabled' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-600">중지</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{k.email || '이메일 없음'}</div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {k.assignedCases.toLocaleString()}건
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                      {k.totalCalls.toLocaleString()} <span className="text-xs text-gray-400">/</span> {k.connectedCalls.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      {k.connectRate}%
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                      {fmtSec(k.totalDurationSeconds)}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      평균 {fmtSec(k.avgDurationSeconds)}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {k.remindersCount}건
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {k.transferredCount}건
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {k.transferRate}%
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className="px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-extrabold text-sm">
                      {k.contractCount}건
                    </span>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                    ₩{k.totalFeeRevenue.toLocaleString()}
                  </td>

                  <td className="px-5 py-3 text-right tabular-nums">
                    <div className="font-black text-indigo-600 dark:text-indigo-400 text-base">
                      ₩{k.estimatedIncentive.toLocaleString()}
                    </div>
                    {k.contractBreakdown && k.contractBreakdown.length > 0 && (
                      <button
                        onClick={() => setSelectedAgentBreakdown(k)}
                        className="text-[11px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-0.5"
                      >
                        종류별 내역 ({k.contractBreakdown.length})
                      </button>
                    )}
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

      {/* 5. 인센티브(성과급) 종류 및 정산 지급일 설정 모달 */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-800 dark:text-white">
                    인센티브 다원화 및 정산 지급일 설정
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    계약 종류별 금액/비율(최대 10개)과 회사 맞춤 정산 주기를 지정합니다.
                  </p>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('types')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeModalTab === 'types'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  1. 계약 종류별 인센티브 ({draftSettings.contractTypes.length}/10)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('schedule')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeModalTab === 'schedule'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  2. 정산 기간 & 지급일
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSettings} className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* TAB 1: 계약 종류별 인센티브 (최대 10개) */}
              {activeModalTab === 'types' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                        <Layers size={16} className="text-indigo-600" /> 계약 종류 등록 및 금액 설정
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        계약 종류마다 고정 성과급(원) 또는 수임료 비율(%)을 다르게 책정할 수 있습니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddContractType}
                      disabled={draftSettings.contractTypes.length >= 10}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={14} /> 새 종류 추가 ({draftSettings.contractTypes.length}/10)
                    </button>
                  </div>

                  <div className="space-y-3">
                    {draftSettings.contractTypes.map((type, idx) => (
                      <div
                        key={type.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          type.isDefault
                            ? 'border-blue-400 bg-blue-50/30 dark:bg-blue-950/20'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={type.name}
                              onChange={e => handleUpdateTypeField(type.id, 'name', e.target.value)}
                              placeholder="계약 종류 이름 (예: 개인회생 계약)"
                              className="font-bold text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg flex-1 dark:bg-gray-700 dark:text-white"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs cursor-pointer text-gray-600 dark:text-gray-300">
                              <input
                                type="radio"
                                name="defaultContractType"
                                checked={!!type.isDefault}
                                onChange={() => handleSetDefaultType(type.id)}
                                className="text-blue-600"
                              />
                              <span>기본 계약</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveContractType(type.id)}
                              disabled={draftSettings.contractTypes.length <= 1}
                              className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded"
                              title="삭제"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* 산정 방식 및 금액 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                              인센티브 지급 방식
                            </label>
                            <select
                              value={type.calcType}
                              onChange={e => handleUpdateTypeField(type.id, 'calcType', e.target.value as any)}
                              className="w-full text-xs p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            >
                              <option value="fixed">건당 고정 금액 지급 (원)</option>
                              <option value="percent">수임료 대비 일정 비율 지급 (%)</option>
                            </select>
                          </div>

                          <div>
                            {type.calcType === 'fixed' ? (
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                                  건당 인센티브 금액 (원)
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0}
                                    step={5000}
                                    value={type.amount}
                                    onChange={e => handleUpdateTypeField(type.id, 'amount', parseInt(e.target.value, 10) || 0)}
                                    className="w-full text-xs p-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg font-bold dark:bg-gray-700 dark:text-white"
                                  />
                                  <span className="absolute right-2.5 top-2 text-xs text-gray-400">원</span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                                  수임료 지급 비율 (%)
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min={0.1}
                                    max={100}
                                    step={0.5}
                                    value={type.rate}
                                    onChange={e => handleUpdateTypeField(type.id, 'rate', parseFloat(e.target.value) || 0)}
                                    className="w-full text-xs p-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg font-bold dark:bg-gray-700 dark:text-white"
                                  />
                                  <span className="absolute right-2.5 top-2 text-xs text-gray-400">%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: 정산 기간 & 지급일 설정 */}
              {activeModalTab === 'schedule' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-1.5">
                      <Calendar size={16} className="text-blue-600" /> 인센티브 정산 주기 및 지급일 지정
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      "매월 언제부터 언제까지 발생한 인센티브는 다음 달 언제 지급한다" 등의 지급 주기를 설정합니다.
                    </p>
                  </div>

                  {/* 주기 선택 */}
                  <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-750 rounded-xl">
                    <label className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      draftSettings.payoutSchedule.cycle === 'monthly'
                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="scheduleCycle"
                        checked={draftSettings.payoutSchedule.cycle === 'monthly'}
                        onChange={() => setDraftSettings({
                          ...draftSettings,
                          payoutSchedule: { ...draftSettings.payoutSchedule, cycle: 'monthly' },
                        })}
                        className="hidden"
                      />
                      <span>월간 정산 (매월)</span>
                    </label>

                    <label className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      draftSettings.payoutSchedule.cycle === 'weekly'
                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="scheduleCycle"
                        checked={draftSettings.payoutSchedule.cycle === 'weekly'}
                        onChange={() => setDraftSettings({
                          ...draftSettings,
                          payoutSchedule: { ...draftSettings.payoutSchedule, cycle: 'weekly' },
                        })}
                        className="hidden"
                      />
                      <span>주간 정산 (매주)</span>
                    </label>

                    <label className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      draftSettings.payoutSchedule.cycle === 'instant'
                        ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="scheduleCycle"
                        checked={draftSettings.payoutSchedule.cycle === 'instant'}
                        onChange={() => setDraftSettings({
                          ...draftSettings,
                          payoutSchedule: { ...draftSettings.payoutSchedule, cycle: 'instant' },
                        })}
                        className="hidden"
                      />
                      <span>건별 즉시 지급</span>
                    </label>
                  </div>

                  {/* 월간 정산 상세 옵션 */}
                  {draftSettings.payoutSchedule.cycle === 'monthly' && (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 space-y-4">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        월간 정산 상세 규칙
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {/* 산정 시작/종료일 */}
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            산정 시작일
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.monthlyStartDay}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, monthlyStartDay: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>매월 {d}일</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            산정 종료일
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.monthlyEndDay}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, monthlyEndDay: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            <option value={0}>매월 말일</option>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>매월 {d}일</option>
                            ))}
                          </select>
                        </div>

                        {/* 지급 시점 및 지급일 */}
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            지급 시점
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.monthlyPayoutOffset}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, monthlyPayoutOffset: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            <option value={0}>당월 (이번 달)</option>
                            <option value={1}>익월 (다음 달)</option>
                            <option value={2}>익익월 (다다음 달)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            지급 일자
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.monthlyPayoutDay}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, monthlyPayoutDay: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            <option value={5}>5일</option>
                            <option value={10}>10일 (권장)</option>
                            <option value={15}>15일</option>
                            <option value={20}>20일</option>
                            <option value={25}>25일</option>
                            <option value={0}>말일</option>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d}>{d}일</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 주간 정산 상세 옵션 */}
                  {draftSettings.payoutSchedule.cycle === 'weekly' && (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 space-y-4">
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        주간 정산 상세 규칙
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            산정 시작 요일
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.weeklyStartDay}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, weeklyStartDay: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            {WEEKDAYS.map(w => (
                              <option key={w.val} value={w.val}>매주 {w.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            산정 종료 요일
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.weeklyEndDay}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, weeklyEndDay: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            {WEEKDAYS.map(w => (
                              <option key={w.val} value={w.val}>매주 {w.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            지급 주차
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.weeklyPayoutOffset}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, weeklyPayoutOffset: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            <option value={0}>당주 (이번 주)</option>
                            <option value={1}>차주 (다음 주 - 권장)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            지급 요일
                          </label>
                          <select
                            value={draftSettings.payoutSchedule.weeklyPayoutDay}
                            onChange={e => setDraftSettings({
                              ...draftSettings,
                              payoutSchedule: { ...draftSettings.payoutSchedule, weeklyPayoutDay: parseInt(e.target.value, 10) },
                            })}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          >
                            {WEEKDAYS.map(w => (
                              <option key={w.val} value={w.val}>{w.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 실시간 규칙 프리뷰 배너 */}
                  <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                    <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">설정된 지급 규칙 미리보기:</div>
                      <div className="text-sm font-extrabold text-blue-700 dark:text-blue-300 mt-1">
                        "{formatPayoutSchedule(draftSettings.payoutSchedule)}"
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        설정 저장 즉시 모든 대시보드와 성과표에 이번 정산 회차가 동기화됩니다.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-400">
                  {activeModalTab === 'types' ? (
                    <span>계약 종류 {draftSettings.contractTypes.length}개 / 최대 10개</span>
                  ) : (
                    <span>지급 주기: {draftSettings.payoutSchedule.cycle}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm"
                  >
                    규칙 저장
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 특정 상담원 계약 종류별 상세 팝업 */}
      {selectedAgentBreakdown && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-base text-gray-800 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-blue-600" />
                {selectedAgentBreakdown.displayName}님의 인센티브 내역
              </h3>
              <button
                onClick={() => setSelectedAgentBreakdown(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-500 font-semibold px-1">
                <span>계약 종류</span>
                <span>체결 건수 / 인센티브</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {selectedAgentBreakdown.contractBreakdown.map(b => (
                  <div key={b.typeId} className="p-3 flex justify-between items-center bg-gray-50/50 dark:bg-gray-750">
                    <div>
                      <div className="font-bold text-gray-800 dark:text-gray-200">{b.typeName}</div>
                      <div className="text-[11px] text-gray-400">수임료 합계: {b.feeRevenueManwon}만원</div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                        ₩{b.incentiveAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-gray-500">{b.count}건 체결</div>
                    </div>
                  </div>
                ))}
                {selectedAgentBreakdown.contractBreakdown.length === 0 && (
                  <div className="p-6 text-center text-gray-400">체결된 계약 내역이 없습니다.</div>
                )}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl flex justify-between items-center font-bold text-sm">
              <span className="text-gray-700 dark:text-gray-300">총 인센티브 합계</span>
              <span className="text-indigo-600 dark:text-indigo-400 text-base">
                ₩{selectedAgentBreakdown.estimatedIncentive.toLocaleString()}
              </span>
            </div>

            <button
              onClick={() => setSelectedAgentBreakdown(null)}
              className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-bold text-xs"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
