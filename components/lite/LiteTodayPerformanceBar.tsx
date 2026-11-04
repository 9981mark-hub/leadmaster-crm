import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  PhoneCall, PhoneMissed, Send, Clock, Trophy, ChevronDown, ChevronUp, 
  Sparkles, CheckCircle2, User, Flame, ArrowUpRight 
} from 'lucide-react';
import { Case } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAgentPerformanceKPI, AgentPerformanceKPI } from '../../services/performance';

interface Props {
  cases: Case[];
  onSelectTab?: (tab: 'all' | 'today' | 'new' | 'missed') => void;
  refetchTrigger?: number;
}

const fmtDuration = (sec: number): string => {
  if (sec <= 0) return '0초';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
};

export const LiteTodayPerformanceBar: React.FC<Props> = ({
  cases,
  onSelectTab,
  refetchTrigger = 0,
}) => {
  const { org, user } = useAuth();

  // 표시 이름
  const agentName = useMemo(() => {
    return localStorage.getItem('managerName') || org?.displayName || user?.name || '상담원';
  }, [org?.displayName, user?.name]);

  // 접기/펼치기 상태 (사용자 선호 기억)
  const [expanded, setExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('lm_lite_perf_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev;
      localStorage.setItem('lm_lite_perf_expanded', String(next));
      return next;
    });
  };

  // 로컬 발신 카운터 (오늘 클릭 횟수)
  const [localDials, setLocalDials] = useState<number>(() => {
    const todayKey = new Date().toISOString().split('T')[0];
    const key = `lm_lite_dials_${todayKey}_${org?.userId || 'me'}`;
    return parseInt(localStorage.getItem(key) || '0', 10);
  });

  // RPC 통계 데이터
  const [rpcKpi, setRpcKpi] = useState<AgentPerformanceKPI | null>(null);
  const [loadingRpc, setLoadingRpc] = useState(false);

  // 로컬 활동 변경 이벤트 수신 (발신, 부재 클릭, 텔레그램 전송 등)
  useEffect(() => {
    const handleActivity = () => {
      const todayKey = new Date().toISOString().split('T')[0];
      const key = `lm_lite_dials_${todayKey}_${org?.userId || 'me'}`;
      setLocalDials(parseInt(localStorage.getItem(key) || '0', 10));
    };

    window.addEventListener('lm_lite_activity_updated', handleActivity);
    return () => window.removeEventListener('lm_lite_activity_updated', handleActivity);
  }, [org?.userId]);

  // Supabase RPC KPI 조회
  const loadKpi = useCallback(async () => {
    setLoadingRpc(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const end = now.toISOString();

      const { kpis } = await fetchAgentPerformanceKPI(start, end, cases);
      const myKpi = kpis.find(k => k.userId === org?.userId) || 
                    kpis.find(k => k.displayName === agentName) ||
                    kpis[0] || null;
      setRpcKpi(myKpi);
    } catch (e) {
      console.warn('[LiteTodayPerformanceBar] KPI fetch error:', e);
    } finally {
      setLoadingRpc(false);
    }
  }, [org?.userId, agentName, cases]);

  useEffect(() => {
    loadKpi();
  }, [loadKpi, refetchTrigger]);

  // 클라이언트 케이스 목록 기반 당일 활동 정밀 집계
  const localStats = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();

    let transferred = 0;
    let missed = 0;
    let contracts = 0;

    cases.forEach(c => {
      // 1. 부재 처리
      const lastMissedTs = c.lastMissedCallAt ? new Date(c.lastMissedCallAt).getTime() : 0;
      const hasTodayMissedLog = (c.statusLogs || []).some(l => 
        l.toStatus === '부재' && new Date(l.changedAt).getTime() >= todayMidnight
      );
      if (lastMissedTs >= todayMidnight || hasTodayMissedLog) {
        missed += 1;
      }

      // 2. 사무장 접수 / 텔레그램 전달
      const statusUpdatedTs = c.statusUpdatedAt ? new Date(c.statusUpdatedAt).getTime() : 0;
      const isTransferredStatus = c.status === '사무장 접수';
      const hasTodayTransferredLog = (c.statusLogs || []).some(l => 
        (l.toStatus === '사무장 접수' || l.memo?.includes('텔레그램')) && 
        new Date(l.changedAt).getTime() >= todayMidnight
      );
      if ((isTransferredStatus && statusUpdatedTs >= todayMidnight) || hasTodayTransferredLog) {
        transferred += 1;
      }

      // 3. 계약 체결
      const contractTs = c.contractAt ? new Date(c.contractAt).getTime() : 0;
      if (c.status === '계약 완료' && (contractTs >= todayMidnight || statusUpdatedTs >= todayMidnight)) {
        contracts += 1;
      }
    });

    return { transferred, missed, contracts };
  }, [cases]);

  // 최종 지표 합성 (RPC 데이터와 로컬 실시간 이벤트 중 최댓값 채택)
  const totalCalls = Math.max(localDials, rpcKpi?.totalCalls || 0);
  const connectedCalls = rpcKpi?.connectedCalls || 0;
  const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
  const transferredCount = Math.max(localStats.transferred, rpcKpi?.transferredCount || 0);
  const missedCount = Math.max(localStats.missed, rpcKpi?.remindersCount || 0);
  const contractCount = Math.max(localStats.contracts, rpcKpi?.contractCount || 0);
  const totalDurationSec = rpcKpi?.totalDurationSeconds || 0;
  const avgDurationSec = connectedCalls > 0 ? Math.round(totalDurationSec / connectedCalls) : 0;
  const estimatedIncentive = rpcKpi?.estimatedIncentive || 0;

  // 오늘 날짜 문자열
  const todayDateStr = useMemo(() => {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  }, []);

  return (
    <div className="bg-gradient-to-b from-amber-500/10 via-white to-white dark:from-amber-950/20 dark:via-gray-800/90 dark:to-gray-800 border-b border-gray-200/80 dark:border-gray-700/80 transition-all select-none">
      
      {/* ── Top Bar Header (접기/펼치기 제어) ── */}
      <div 
        onClick={toggleExpanded}
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
            <User size={14} />
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
              {agentName} <span className="font-normal text-gray-500 dark:text-gray-400">상담원</span>
            </span>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium shrink-0">
              {todayDateStr}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 축약 모드 요약 칩 */}
          {!expanded && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-gray-700 dark:text-gray-300">
              <span className="text-blue-600 dark:text-blue-400">📞 {totalCalls}콜</span>
              <span className="text-emerald-600 dark:text-emerald-400">⚡ 접수 {transferredCount}</span>
              <span className="text-amber-600 dark:text-amber-400">📵 부재 {missedCount}</span>
            </div>
          )}

          <button 
            type="button"
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={expanded ? '간략히 접기' : '상세 펼치기'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* ── 펼쳐진 4개 핵심 실적 카드 그리드 ── */}
      {expanded && (
        <div className="px-4 pb-3 pt-0.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            
            {/* 1. 오늘 통화 발신 */}
            <div className="bg-white dark:bg-gray-900/60 rounded-xl p-2.5 border border-blue-100 dark:border-blue-900/40 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <PhoneCall size={12} className="text-blue-500" />
                  오늘 발신콜
                </span>
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                  {connectRate}% 연결
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-black text-gray-900 dark:text-white font-mono">
                  {totalCalls}
                  <span className="text-xs font-normal text-gray-500 ml-0.5">건</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  연결 {connectedCalls}건
                </span>
              </div>
            </div>

            {/* 2. 사무장 접수 / 텔레그램 전달 (핵심 실적) */}
            <div className="bg-white dark:bg-gray-900/60 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/40 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <Send size={12} className="text-emerald-500" />
                  사무장 접수
                </span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1 py-0.2 rounded font-bold">
                  유효
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {transferredCount}
                  <span className="text-xs font-normal text-gray-500 ml-0.5">건</span>
                </span>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                  변호사 방 전달
                </span>
              </div>
            </div>

            {/* 3. 부재콜 처리 (원터치 +1) */}
            <div 
              onClick={() => onSelectTab?.('missed')}
              className="bg-white dark:bg-gray-900/60 rounded-xl p-2.5 border border-amber-100 dark:border-amber-900/40 shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors group"
              title="클릭하여 부재콜 목록 보기"
            >
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span className="text-[11px] font-semibold flex items-center gap-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  <PhoneMissed size={12} className="text-amber-500" />
                  부재콜 처리
                </span>
                <ArrowUpRight size={11} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                  {missedCount}
                  <span className="text-xs font-normal text-gray-500 ml-0.5">건</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  원터치 처리
                </span>
              </div>
            </div>

            {/* 4. 총 통화 시간 & 계약 성과 */}
            <div className="bg-white dark:bg-gray-900/60 rounded-xl p-2.5 border border-purple-100 dark:border-purple-900/40 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  {contractCount > 0 ? (
                    <Trophy size={12} className="text-purple-500" />
                  ) : (
                    <Clock size={12} className="text-purple-500" />
                  )}
                  {contractCount > 0 ? '계약 체결' : '총 통화 시간'}
                </span>
                {contractCount > 0 && (
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                    달성!
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                {contractCount > 0 ? (
                  <>
                    <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                      {contractCount}
                      <span className="text-xs font-normal text-gray-500 ml-0.5">건</span>
                    </span>
                    <span className="text-[10px] text-purple-500 font-mono font-bold">
                      +{estimatedIncentive > 0 ? `${(estimatedIncentive / 10000).toLocaleString()}만` : '축하합니다'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-black text-gray-800 dark:text-gray-200 font-mono truncate">
                      {fmtDuration(totalDurationSec)}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate">
                      평균 {fmtDuration(avgDurationSec)}
                    </span>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
