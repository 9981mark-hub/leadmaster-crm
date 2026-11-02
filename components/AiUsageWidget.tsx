import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Sparkles, RefreshCw, Zap, DollarSign, Activity, FileText, CheckCircle2,
  AlertCircle, HelpCircle, Layers, ArrowUpRight, BarChart3, Clock
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { DetailedAiUsage, fetchDetailedAiUsage, GEMINI_EXCHANGE_RATE } from '../services/aiUsage';
import { format } from 'date-fns';

interface Props {
  className?: string;
}

export default function AiUsageWidget({ className = '' }: Props) {
  const [data, setData] = useState<DetailedAiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'logs' | 'pricing'>('tasks');
  const mountedRef = useRef(true);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const result = await fetchDetailedAiUsage();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (e) {
      console.warn('[AiUsageWidget] fetch error:', e);
    } finally {
      if (mountedRef.current && !isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();

    // 1. 실시간 Supabase Realtime 구독
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('realtime:ai-usage-widget')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ai_usage_logs' },
          () => {
            loadData(true);
          }
        )
        .subscribe();
    }

    // 2. 30초 주기 백그라운드 갱신
    const interval = setInterval(() => {
      loadData(true);
    }, 30000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadData]);

  const todayCount = data?.todayCount ?? 0;
  const dailyCap = data?.dailyCap ?? 300;
  const todayPercentage = Math.min(100, Math.round((todayCount / (dailyCap || 1)) * 100));
  const isCapWarning = todayPercentage >= 80;

  return (
    <div id="ai-usage-widget" className={`glass-panel p-5 rounded-2xl space-y-4 border border-purple-100 dark:border-purple-900/40 shadow-xs ${className}`}>
      {/* 1. 위젯 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                Gemini AI 실시간 사용량 & 비용 분석
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                실시간 연동 중
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              통화 녹음 AI 분석 및 고객정보 추출 호출 현황과 실시간 발생 비용을 집계합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data?.lastUpdated && (
            <span className="text-[11px] text-gray-400 tabular-nums hidden sm:inline">
              최근 갱신: {format(data.lastUpdated, 'HH:mm:ss')}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={loading}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-purple-600' : ''} />
            <span className="font-medium">새로고침</span>
          </button>
        </div>
      </div>

      {/* 2. 상단 4대 핵심 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CARD 1: 오늘 사용량 & 상한 */}
        <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
              <span className="flex items-center gap-1">
                <Zap size={14} /> 오늘 AI 호출
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${isCapWarning ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-800'}`}>
                {todayPercentage}%
              </span>
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
              {todayCount.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ {dailyCap}회</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 space-y-1">
            <div className="w-full bg-purple-100 dark:bg-purple-900/50 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isCapWarning ? 'bg-red-500' : 'bg-purple-600'}`}
                style={{ width: `${todayPercentage}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between">
              <span>잔여: {Math.max(0, dailyCap - todayCount)}회</span>
              <span>상한: {dailyCap}회/일</span>
            </div>
          </div>
        </div>

        {/* CARD 2: 오늘 발생 비용 */}
        <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
              <span className="flex items-center gap-1">
                <DollarSign size={14} /> 오늘 예상 비용
              </span>
              <span className="text-[10px] text-indigo-500">실시간 환산</span>
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
              약 {data ? `₩${data.todayCostKrw.toLocaleString()}` : '₩0'}
            </div>
          </div>
          <div className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between border-t border-indigo-100/60 dark:border-indigo-900/40 pt-1.5">
            <span>달러 환산: ${data?.todayCostUsd.toFixed(4) || '0.0000'}</span>
            <span className="text-[10px] text-indigo-600 font-medium">Flash 요금</span>
          </div>
        </div>

        {/* CARD 3: 이번 달 누적 호출 */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
              <span className="flex items-center gap-1">
                <Activity size={14} /> 이번 달 누적 호출
              </span>
              <span className="text-[10px] text-gray-400">당월 총계</span>
            </div>
            <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
              {data?.monthCount.toLocaleString() || 0} <span className="text-xs font-normal text-gray-500">건</span>
            </div>
          </div>
          <div className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between border-t border-slate-200 dark:border-gray-700 pt-1.5">
            <span>토큰 입력: {((data?.monthInputTokens || 0) / 1000000).toFixed(2)}M</span>
            <span>출력: {((data?.monthOutputTokens || 0) / 1000000).toFixed(2)}M</span>
          </div>
        </div>

        {/* CARD 4: 이번 달 누적 비용 */}
        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
              <span className="flex items-center gap-1">
                <BarChart3 size={14} /> 이번 달 누적 비용
              </span>
              <span className="text-[10px] font-bold text-emerald-600">누적 청구</span>
            </div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
              약 {data ? `₩${data.monthCostKrw.toLocaleString()}` : '₩0'}
            </div>
          </div>
          <div className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between border-t border-emerald-100/60 dark:border-emerald-900/40 pt-1.5">
            <span>달러 합산: ${data?.monthCostUsd.toFixed(3) || '0.000'}</span>
            <span className="text-[10px] text-gray-400">환율 1,390원</span>
          </div>
        </div>
      </div>

      {/* 3. 하단 탭 네비게이션: 기능별 통계 / 최근 실시간 로그 / 요금 기준 */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Layers size={13} />
            <span>기능별 호출 현황 ({data?.taskStats.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Clock size={13} />
            <span>최근 실시간 호출 로그 ({data?.recentLogs.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`px-3 py-2 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'pricing'
                ? 'border-purple-600 text-purple-700 dark:text-purple-300'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <HelpCircle size={13} />
            <span>Gemini API 요금표 & 단가 기준</span>
          </button>
        </div>

        {/* TAB 1: 기능별 호출 현황 */}
        {activeTab === 'tasks' && (
          <div className="space-y-2">
            {data && data.taskStats.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {data.taskStats.map(st => {
                  const pct = Math.round((st.count / (data.monthCount || 1)) * 100);
                  return (
                    <div
                      key={st.task}
                      className="bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-col justify-between shadow-2xs"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                          <span>{st.icon}</span> {st.label}
                        </span>
                        <span className="text-xs font-black text-purple-700 dark:text-purple-300">
                          {st.count}건 <span className="text-[10px] text-gray-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 h-1 rounded-full overflow-hidden mb-2">
                        <div className="bg-purple-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-50 dark:border-gray-700/60">
                        <span>토큰: {((st.inputTokens + st.outputTokens) / 1000).toLocaleString()}k</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          약 ₩{st.costKrw.toLocaleString()} (${st.costUsd.toFixed(4)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400">
                아직 기록된 세부 AI 호출 내역이 없습니다. (통화 녹음 AI 분석 실행 시 자동 기록)
              </div>
            )}
          </div>
        )}

        {/* TAB 2: 최근 실시간 호출 로그 */}
        {activeTab === 'logs' && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
            {data && data.recentLogs.length > 0 ? (
              <div className="space-y-1.5">
                {data.recentLogs.map(log => {
                  const logTime = format(new Date(log.createdAt), 'MM/dd HH:mm:ss');
                  return (
                    <div
                      key={log.id}
                      className="bg-white dark:bg-gray-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{log.taskIcon}</span>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-gray-800 dark:text-gray-200">
                            <span>{log.taskLabel}</span>
                            <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {log.model}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-2">
                            <span>{logTime}</span>
                            <span>·</span>
                            <span>입력 {log.inputTokens.toLocaleString()} / 출력 {log.outputTokens.toLocaleString()} 토큰</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 text-right">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white tabular-nums">
                            약 ₩{log.costKrw}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            ${log.costUsd.toFixed(4)}
                          </div>
                        </div>
                        {log.ok ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                            성공
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" title={log.error}>
                            실패
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-gray-400">
                최근 호출된 로그가 없습니다.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: 요금 기준 및 투명성 안내 */}
        {activeTab === 'pricing' && (
          <div className="bg-slate-50 dark:bg-gray-900/40 rounded-xl p-3.5 border border-slate-200 dark:border-gray-700 text-xs space-y-2.5">
            <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>Google Gemini 공식 API 가격 정책 (2026년 기준)</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-gray-700 dark:text-gray-300">
              <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="font-bold text-purple-700 dark:text-purple-300 mb-1">
                  Gemini 1.5 / 2.0 Flash (기본 탑재 모델)
                </div>
                <div className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                  <div>· 입력(Input): 100만 토큰당 <b>$0.075</b> (약 104원)</div>
                  <div>· 출력(Output): 100만 토큰당 <b>$0.300</b> (약 417원)</div>
                  <div>· 오디오 전사: 초당 약 $0.00002 (1분 통화 약 1.6원)</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                  실제 체감 비용 가이드
                </div>
                <div className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                  <div>· 통화 1건(1~2분) 전체 요약: <b>약 3원 ~ 8원</b></div>
                  <div>· 하루 100건 통화 분석 시: <b>약 500원 내외</b></div>
                  <div>· 한 달 1,000건 통화 분석 시: <b>약 5,000원 내외</b></div>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-200 dark:border-gray-700 pt-2">
              * 기준 환율: <strong>{GEMINI_EXCHANGE_RATE.toLocaleString()}원 / 1 USD</strong>가 실시간으로 자동 적용됩니다.
              <br />
              * 리드마스터는 초저비용 고성능 모델인 Gemini Flash를 활용하여 서버 비용 부담 없이 무제한에 가까운 자동화를 실현하고 있습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
