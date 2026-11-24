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
    <div className="bg-card border-b border-border text-card-foreground transition-all select-none">
      
      {/* ── Top Bar Header (접기/펼치기 제어) ── */}
      <div 
        onClick={toggleExpanded}
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
            <User size={13} strokeWidth={1.75} />
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-xs text-foreground truncate">
              {agentName} <span className="font-normal text-muted-foreground">상담원</span>
            </span>
            <span className="text-[11px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-medium shrink-0 font-mono">
              {todayDateStr}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 축약 모드 요약 칩 */}
          {!expanded && (
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground font-mono">
              <span className="text-foreground">📞 {totalCalls}콜</span>
              <span className="text-primary">⚡ 접수 {transferredCount}</span>
              <span className="text-amber-500">📵 부재 {missedCount}</span>
            </div>
          )}

          <button 
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={expanded ? '간략히 접기' : '상세 펼치기'}
          >
            {expanded ? <ChevronUp size={15} strokeWidth={1.75} /> : <ChevronDown size={15} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* ── 펼쳐진 4개 핵심 실적 카드 그리드 ── */}
      {expanded && (
        <div className="px-4 pb-3 pt-0.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            
            {/* 1. 오늘 통화 발신 */}
            <div className="bg-muted/30 rounded-[8px] p-2.5 border border-border shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#0073ea]" />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <PhoneCall size={12} strokeWidth={1.75} className="text-[#0073ea]" />
                  오늘 발신콜
                </span>
                <span className="text-[11px] font-mono text-[#0073ea] font-semibold">
                  {connectRate}% 연결
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-foreground font-mono tabular-nums">
                  {totalCalls}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">건</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  연결 {connectedCalls}건
                </span>
              </div>
            </div>

            {/* 2. 사무장 접수 / 텔레그램 전달 (핵심 실적) */}
            <div className="bg-muted/30 rounded-[8px] p-2.5 border border-border shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#00a2ae]" />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <Send size={12} strokeWidth={1.75} className="text-[#00a2ae]" />
                  사무장 접수
                </span>
                <span className="text-[10px] bg-[#00a2ae]/10 text-[#00a2ae] border border-[#00a2ae]/25 px-1 py-0.2 rounded-[4px] font-bold">
                  유효
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-[#00a2ae] font-mono tabular-nums">
                  {transferredCount}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">건</span>
                </span>
                <span className="text-[11px] text-[#00a2ae]/85 font-medium">
                  변호사 방 전달
                </span>
              </div>
            </div>

            {/* 3. 부재콜 처리 (원터치 +1) */}
            <div 
              onClick={() => onSelectTab?.('missed')}
              className="bg-muted/30 rounded-[8px] p-2.5 border border-border shadow-2xs flex flex-col justify-between cursor-pointer hover:border-muted-foreground/30 transition-colors group relative overflow-hidden"
              title="클릭하여 부재콜 목록 보기"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#ff642e]" />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold flex items-center gap-1 group-hover:text-foreground transition-colors">
                  <PhoneMissed size={12} strokeWidth={1.75} className="text-[#ff642e]" />
                  부재콜 처리
                </span>
                <ArrowUpRight size={11} strokeWidth={1.75} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-bold text-[#ff642e] font-mono tabular-nums">
                  {missedCount}
                  <span className="text-xs font-normal text-muted-foreground ml-0.5">건</span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  원터치 처리
                </span>
              </div>
            </div>

            {/* 4. 총 통화 시간 & 계약 성과 */}
            <div className="bg-muted/30 rounded-[8px] p-2.5 border border-border shadow-2xs flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#00c875]" />
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  {contractCount > 0 ? (
                    <Trophy size={12} strokeWidth={1.75} className="text-[#00c875]" />
                  ) : (
                    <Clock size={12} strokeWidth={1.75} className="text-muted-foreground" />
                  )}
                  {contractCount > 0 ? '계약 체결' : '총 통화 시간'}
                </span>
                {contractCount > 0 && (
                  <span className="text-[11px] text-[#00c875] font-semibold">
                    달성!
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                {contractCount > 0 ? (
                  <>
                    <span className="text-base font-bold text-[#00c875] font-mono tabular-nums">
                      {contractCount}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">건</span>
                    </span>
                    <span className="text-[11px] text-[#00c875] font-mono font-semibold">
                      +{estimatedIncentive > 0 ? `${(estimatedIncentive / 10000).toLocaleString()}만` : '축하합니다'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-foreground font-mono truncate tabular-nums">
                      {fmtDuration(totalDurationSec)}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate font-mono">
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
