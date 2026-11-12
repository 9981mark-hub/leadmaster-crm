/**
 * components/auto-dial/AutoDialAgentHUD.tsx
 * 상담원 전용 무사고 몰입형 런타임 HUD (Zero-Click Auto-Dialer HUD)
 * 
 * 상담원의 인지 부하 0%를 위해 리스트 선택을 완전히 배제하고,
 * 통화 종료 시 7초 카운트다운 후 원클릭 결과 저장과 함께 강제 자동 발신이 이어지는 초밀착 런타임입니다.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhoneCall, Phone, PhoneOff, PhoneMissed, Clock,
  CheckCircle2, XCircle, AlertCircle, ArrowLeft,
  Coffee, Play, Pause, Smartphone, FileText, ChevronRight,
  ShieldCheck, Volume2
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Case } from '../../types';
import {
  AutoDialCampaign,
  AutoDialAgentAllocation,
  AutoDialQueueItem,
  fetchMyActiveAllocation,
  getNextQueueItem,
  updateQueueItemStatus,
  updateAgentLiveStatus,
  completeAutoDialCall
} from '../../services/autoDialV4Service';

interface AutoDialAgentHUDProps {
  currentUserEmail: string;
  onExit: () => void;
  cases: Case[];
}

type AgentHUDState = 'ready' | 'dialing' | 'ringing' | 'talking' | 'wrapup' | 'gap_wait' | 'paused' | 'completed';

export const AutoDialAgentHUD: React.FC<AutoDialAgentHUDProps> = ({
  currentUserEmail,
  onExit,
  cases,
}) => {
  const { showToast } = useToast();

  // 세션 & 데이터 상태
  const [campaign, setCampaign] = useState<AutoDialCampaign | null>(null);
  const [allocation, setAllocation] = useState<AutoDialAgentAllocation | null>(null);
  const [currentQueueItem, setCurrentQueueItem] = useState<AutoDialQueueItem | null>(null);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);

  // HUD 런타임 상태 머신
  const [hudState, setHudState] = useState<AgentHUDState>('ready');
  const [loading, setLoading] = useState<boolean>(true);

  // 타이머 상태
  const [ringSeconds, setRingSeconds] = useState<number>(0);
  const [talkSeconds, setTalkSeconds] = useState<number>(0);
  const [wrapUpSeconds, setWrapUpSeconds] = useState<number>(7);
  const [gapSeconds, setGapSeconds] = useState<number>(3);

  // 타이머 Refs
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const talkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrapUpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gapIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 통화 타임스탬프
  const callStartTimeRef = useRef<number>(0);
  const actualDurationRef = useRef<number>(0);

  // 상담 메모 및 일시정지 사유
  const [memo, setMemo] = useState<string>('');
  const [isPauseModalOpen, setIsPauseModalOpen] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('화장실 / 음용수');

  // 1. 초기 할당 및 캠페인 로드
  const initSession = useCallback(async () => {
    setLoading(true);
    try {
      const active = await fetchMyActiveAllocation(currentUserEmail);
      if (active) {
        setCampaign(active.campaign);
        setAllocation(active.allocation);
        setWrapUpSeconds(active.campaign.pacingSettings.wrapUpLimitSeconds || 10);
        setGapSeconds(active.campaign.pacingSettings.gapSeconds || 4);
      } else {
        showToast('현재 배정된 진행 중인 오토콜 캠페인이 없습니다.', 'info');
      }
    } catch (err) {
      console.error('[AutoDialAgentHUD] Init error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserEmail, showToast]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // 2. 타이머 클리어 유틸
  const clearAllTimers = () => {
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
    if (wrapUpIntervalRef.current) clearInterval(wrapUpIntervalRef.current);
    if (gapIntervalRef.current) clearInterval(gapIntervalRef.current);
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // 3. 발신 실행 (스마트폰 브릿지 + WebView)
  const dialNextLead = async () => {
    if (!campaign || !allocation) return;

    clearAllTimers();
    setMemo('');
    setRingSeconds(0);
    setTalkSeconds(0);
    setWrapUpSeconds(campaign.pacingSettings.wrapUpLimitSeconds || 10);

    // 다음 큐 아이템 취득
    const nextItem = await getNextQueueItem(campaign.id, allocation.agentId);
    if (!nextItem) {
      // 큐 소진 완료!
      setHudState('completed');
      await updateAgentLiveStatus(allocation.id, 'idle');
      showToast('🎉 오늘 배정받은 모든 오토콜이 완료되었습니다!', 'success');
      return;
    }

    setCurrentQueueItem(nextItem);

    // 연결된 케이스 상세 탐색
    const matchedCase = cases.find(c => c.caseId === nextItem.caseId) || null;
    setCurrentCase(matchedCase);

    setHudState('dialing');
    await updateAgentLiveStatus(allocation.id, 'dialing', {
      caseId: nextItem.caseId,
      customerName: nextItem.customerName,
    });

    const cleanPhone = nextItem.phone.replace(/[^0-9]/g, '');
    const simSlot = nextItem.simSlot ?? 0;

    // 네이티브 스마트폰 발신 연동
    const androidBridge = (window as any).AndroidBridge;
    callStartTimeRef.current = Date.now();

    if (androidBridge?.makeCallWithAccount) {
      console.log(`[AgentHUD] AndroidBridge calling ${cleanPhone} on SIM ${simSlot}`);
      androidBridge.makeCallWithAccount(cleanPhone, simSlot);
    } else if (androidBridge?.makeCall) {
      console.log(`[AgentHUD] AndroidBridge calling ${cleanPhone}`);
      androidBridge.makeCall(cleanPhone);
    } else {
      console.log(`[AgentHUD] Fallback tel: link for ${cleanPhone}`);
      window.location.href = `tel:${cleanPhone}`;
    }

    setHudState('ringing');
    await updateAgentLiveStatus(allocation.id, 'ringing', {
      caseId: nextItem.caseId,
      customerName: nextItem.customerName,
    });

    // 링 타임아웃 타이머 시작
    ringIntervalRef.current = setInterval(() => {
      setRingSeconds(prev => {
        const next = prev + 1;
        if (next >= campaign.pacingSettings.ringTimeoutSeconds) {
          // 링 타임아웃 ➔ 자동 부재 처리
          handleAutoNoAnswer();
        }
        return next;
      });
    }, 1000);
  };

  // 4. 앱 복귀 및 네이티브 통화 종료 감지 (Visibility Change + Android Native Hook)
  useEffect(() => {
    const handleCallEnd = () => {
      if (hudState === 'ringing' || hudState === 'dialing' || hudState === 'talking') {
        const elapsed = callStartTimeRef.current > 0
          ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
          : 0;
        actualDurationRef.current = elapsed;

        if (elapsed >= 12 && hudState !== 'talking') {
          setTalkSeconds(elapsed);
        }
        enterWrapUpState(elapsed);
      }
    };

    // Android WebView 네이티브 콜백 등록
    (window as any).onNativeCallEnded = (_caseId?: string) => {
      console.log('[AgentHUD] onNativeCallEnded received from Android');
      handleCallEnd();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleCallEnd();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      delete (window as any).onNativeCallEnded;
    };
  }, [hudState, campaign, allocation, currentQueueItem]);

  // 5. 자동 링 타임아웃 (부재 1차)
  const handleAutoNoAnswer = () => {
    clearAllTimers();
    actualDurationRef.current = 0;
    showToast('신호 시간 초과로 부재 처리되었습니다.', 'warning');
    enterWrapUpState(0);
  };

  // 6. 후처리 (Wrap-up) 진입 & 카운트다운 가동
  const enterWrapUpState = async (durationSec: number) => {
    clearAllTimers();
    if (!campaign || !allocation) return;

    setHudState('wrapup');
    await updateAgentLiveStatus(allocation.id, 'wrapup', {
      caseId: currentQueueItem?.caseId,
      customerName: currentQueueItem?.customerName,
    });

    let remaining = campaign.pacingSettings.wrapUpLimitSeconds || 10;
    setWrapUpSeconds(remaining);

    wrapUpIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setWrapUpSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(wrapUpIntervalRef.current!);
        // 강제 자동 다음 콜 진행
        handleQuickResult('no_answer', '부재 1차 (시간초과 자동)');
      }
    }, 1000);
  };

  // 7. 원클릭 결과 버튼 선택 ➔ 저장 후 3초 뒤 다음 콜 자동 직행!
  const handleQuickResult = async (
    resultType: 'connected' | 'no_answer' | 'busy' | 'rejected' | 'callback',
    targetCaseStatus: string
  ) => {
    clearAllTimers();
    if (!campaign || !allocation || !currentQueueItem) return;

    try {
      await completeAutoDialCall({
        queueItemId: currentQueueItem.id,
        campaignId: campaign.id,
        allocationId: allocation.id,
        caseId: currentQueueItem.caseId,
        agentId: allocation.agentId,
        result: resultType,
        caseStatusToSet: targetCaseStatus,
        resultMemo: memo.trim(),
        durationSeconds: actualDurationRef.current || talkSeconds || 0,
      });

      // 로컬 통계 실시간 반영
      setAllocation(prev => prev ? {
        ...prev,
        completedCount: prev.completedCount + 1,
        connectedCount: resultType === 'connected' ? prev.connectedCount + 1 : prev.connectedCount,
        noAnswerCount: resultType === 'no_answer' ? prev.noAnswerCount + 1 : prev.noAnswerCount,
      } : null);

      // 콜 간격 휴식 (Gap Wait) ➔ 3초 뒤 자동 다음 콜!
      setHudState('gap_wait');
      let gap = campaign.pacingSettings.gapSeconds || 3;
      setGapSeconds(gap);

      gapIntervalRef.current = setInterval(() => {
        gap -= 1;
        setGapSeconds(gap);
        if (gap <= 0) {
          clearInterval(gapIntervalRef.current!);
          dialNextLead();
        }
      }, 1000);
    } catch (err) {
      console.error('[AgentHUD] Save result error:', err);
      showToast('결과 저장 중 오류가 발생했습니다.', 'error');
    }
  };

  // 8. 일시정지 (화장실, 휴식)
  const handlePause = async () => {
    clearAllTimers();
    setHudState('paused');
    setIsPauseModalOpen(false);
    if (allocation) {
      await updateAgentLiveStatus(allocation.id, 'paused');
    }
    showToast(`오토콜이 일시정지되었습니다 (${pauseReason})`, 'info');
  };

  const handleResume = async () => {
    if (allocation) {
      await updateAgentLiveStatus(allocation.id, 'idle');
    }
    setHudState('ready');
    dialNextLead();
  };

  // 로딩 화면
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
          오토콜 배정 세션을 준비하고 있습니다...
        </p>
      </div>
    );
  }

  // 배정된 캠페인이 없을 때
  if (!campaign || !allocation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-md mx-auto text-center p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl space-y-4">
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl">
          <AlertCircle size={36} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          진행 가능한 오토콜 캠페인이 없습니다
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          관리자가 오늘 날짜의 오토콜 캠페인을 생성하고 상담원을 배정해야 시작할 수 있습니다.
        </p>
        <button
          onClick={onExit}
          className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl"
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  const progressPercent = allocation.targetCount > 0
    ? Math.round((allocation.completedCount / allocation.targetCount) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-150">
      {/* 1. 상단 몰입형 헤더 바 */}
      <header className="h-16 px-6 bg-gray-950 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-black tracking-widest uppercase text-rose-400">
              LIVE AUTO-CALL v4.0
            </span>
          </div>
          <div className="h-4 w-px bg-gray-800" />
          <span className="text-sm font-bold text-gray-200 truncate max-w-xs md:max-w-md">
            {campaign.name}
          </span>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1">
            <Smartphone size={12} />
            SIM {currentQueueItem ? currentQueueItem.simSlot + 1 : 1} 발신
          </span>
        </div>

        {/* 진행률 & 일시정지 / 종료 버튼 */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 bg-gray-900 px-4 py-1.5 rounded-xl border border-gray-800 text-xs">
            <span className="text-gray-400">당일 소화율:</span>
            <span className="font-mono font-bold text-indigo-400">
              {allocation.completedCount} / {allocation.targetCount}건 ({progressPercent}%)
            </span>
            <div className="w-24 bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 화장실/휴식 버튼 */}
          <button
            type="button"
            onClick={() => setIsPauseModalOpen(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-gray-700 transition-colors"
          >
            <Coffee size={14} className="text-amber-400" />
            잠시 휴식
          </button>

          {/* 종료 나가기 */}
          <button
            type="button"
            onClick={onExit}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
            title="오토콜 HUD 종료"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </header>

      {/* 2. 중앙 메인 스테이지 */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-between max-w-4xl mx-auto w-full space-y-6">
        {/* 시작 전 대기 화면 */}
        {hudState === 'ready' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 my-auto">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-2xl shadow-indigo-500/20">
              <PhoneCall size={40} className="animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                오토콜을 시작할 준비가 되셨습니까?
              </h2>
              <p className="text-sm text-gray-400 mt-1 max-w-md">
                시작 버튼을 누르면 배정받은 {allocation.targetCount - allocation.completedCount}건의 리드가
                휴식 갭과 후처리 타이머에 맞춰 끊김 없이 자동으로 발신됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={dialNextLead}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl text-base font-black shadow-xl shadow-indigo-600/30 flex items-center gap-3 transition-transform active:scale-95"
            >
              <Play size={20} />
              오토콜 시작 (연속 발신)
            </button>
          </div>
        )}

        {/* 일시정지 중 화면 */}
        {hudState === 'paused' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 my-auto">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Coffee size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                잠시 휴식중 ({pauseReason})
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                복귀 준비가 되셨으면 아래 버튼을 눌러 오토콜을 즉시 재개하십시오.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResume}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              <Play size={18} />
              콜 복귀 및 다음 번호 발신
            </button>
          </div>
        )}

        {/* 모든 콜 완료 화면 */}
        {hudState === 'completed' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5 my-auto">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white">
                오늘의 오토콜 목표를 달성했습니다!
              </h2>
              <p className="text-sm text-gray-400 mt-2">
                총 {allocation.completedCount}콜 소화 완료 · 연결 성공 {allocation.connectedCount}건
              </p>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl text-sm font-bold"
            >
              대시보드로 나가기
            </button>
          </div>
        )}

        {/* 통화 진행 중 (발신, 링, 통화중, 후처리) 화면 */}
        {['dialing', 'ringing', 'talking', 'wrapup', 'gap_wait'].includes(hudState) && currentQueueItem && (
          <div className="w-full flex-1 flex flex-col justify-between space-y-6">
            {/* 1. 현재 통화 고객 핵심 카드 */}
            <div className="bg-gray-800/80 rounded-3xl p-6 border border-gray-700 shadow-2xl relative overflow-hidden backdrop-blur-md">
              {/* 상단 뱃지 라인 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    hudState === 'talking'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : hudState === 'wrapup'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                    {hudState === 'talking' && '🟢 고객 통화 연결됨'}
                    {(hudState === 'dialing' || hudState === 'ringing') && `🟡 신호 연결중 (${ringSeconds}초 / 20초)`}
                    {hudState === 'wrapup' && `🔵 후처리 진행중 (${wrapUpSeconds}초 남음)`}
                    {hudState === 'gap_wait' && `⏳ 다음 발신 준비 (${gapSeconds}초)`}
                  </span>

                  <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-700 text-gray-300 font-mono">
                    {currentCase?.inflowPath || (currentCase as any)?.batchName || '신규 DB'}
                  </span>
                </div>

                {/* 통화 타이머 카운터 */}
                <div className="font-mono text-2xl font-black text-white flex items-center gap-2">
                  <Clock size={20} className="text-indigo-400" />
                  {hudState === 'talking' ? (
                    <span>{String(Math.floor(talkSeconds / 60)).padStart(2, '0')}:{String(talkSeconds % 60).padStart(2, '0')}</span>
                  ) : (
                    <span>00:{String(ringSeconds).padStart(2, '0')}</span>
                  )}
                </div>
              </div>

              {/* 고객 기본 프로필 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-gray-700/80">
                <div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-white">
                      {currentQueueItem.customerName}
                    </h3>
                    <span className="text-sm font-semibold text-gray-400">고객님</span>
                    {(currentCase as any)?.age && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        {(currentCase as any).age}세
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-mono text-indigo-300 mt-1 flex items-center gap-2">
                    <span>{currentQueueItem.phone}</span>
                    <span className="text-xs text-gray-500">· 010 스마트폰 자동 발신</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center text-xs text-gray-400 space-y-1 md:text-right">
                  <div>이전 통화 상태: <span className="font-bold text-amber-400">{currentCase?.status || '신규 접수'}</span></div>
                  <div>최근 부재 차수: <span className="font-bold text-gray-300">{currentQueueItem.attemptCount}차 시도</span></div>
                </div>
              </div>

              {/* 핵심 맞춤 스크립트 가이드 (가장 중요한 스크린 팝업 영역) */}
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/30 text-xs">
                <span className="font-bold text-indigo-300 flex items-center gap-1.5 mb-1.5">
                  <Volume2 size={14} className="text-indigo-400" />
                  상담 스크립트 가이드
                </span>
                <p className="text-gray-200 leading-relaxed font-medium">
                  "안녕하세요 <span className="text-amber-300 font-bold">{currentQueueItem.customerName}</span> 고객님,
                  어제 신청해주신 채무조정 무료상담 건으로 연락드렸습니다.
                  담당 전문 상담원 <span className="text-indigo-300 font-bold">{allocation.agentName}</span> 팀장입니다.
                  현재 가장 부담되시는 총 채무 금액이 대략 어느 정도이신가요?"
                </p>
              </div>

              {/* 간편 한 줄 메모 */}
              <div className="mt-4">
                <input
                  type="text"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="통화 특이사항 간편 메모 입력 (결과 버튼 클릭 시 고객 차트에 자동 저장됩니다)"
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 2. 후처리 카운트다운 타이머 바 (Wrap-up Timer Bar) */}
            {hudState === 'wrapup' && (
              <div className="w-full bg-blue-950/60 border border-blue-500/40 rounded-2xl p-4 text-center space-y-2 animate-in fade-in">
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-300">
                  <Clock size={16} className="animate-spin text-blue-400" />
                  <span>
                    후처리 제한시간: <span className="text-xl font-mono text-white font-black">{wrapUpSeconds}</span>초 후 다음 번호로 자동 발신됩니다!
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(wrapUpSeconds / (campaign.pacingSettings.wrapUpLimitSeconds || 10)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 3. 하단 대형 원클릭 결과 버튼 4개 (Zero Cognitive Buttons) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
              {/* 1. 부재 */}
              <button
                type="button"
                onClick={() => handleQuickResult('no_answer', '부재 1차')}
                className="py-4 px-3 bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-amber-900/30 active:scale-95 transition-all"
              >
                <PhoneMissed size={22} />
                <span className="text-sm font-black">부재 (1차)</span>
                <span className="text-[11px] text-amber-200">연결 안 됨 / 통화중</span>
              </button>

              {/* 2. 상담 완료 (접수) */}
              <button
                type="button"
                onClick={() => handleQuickResult('connected', '상담중')}
                className="py-4 px-3 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
              >
                <CheckCircle2 size={22} />
                <span className="text-sm font-black">상담완료 (접수)</span>
                <span className="text-[11px] text-emerald-200">접수 완료 / 1차 상담</span>
              </button>

              {/* 3. 재통화 예약 */}
              <button
                type="button"
                onClick={() => handleQuickResult('callback', '재통화 요망')}
                className="py-4 px-3 bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/30 active:scale-95 transition-all"
              >
                <Clock size={22} />
                <span className="text-sm font-black">재통화 예약</span>
                <span className="text-[11px] text-indigo-200">추후 재연락 요청</span>
              </button>

              {/* 4. 거절 / 불가 */}
              <button
                type="button"
                onClick={() => handleQuickResult('rejected', '진행불가(조건미달)')}
                className="py-4 px-3 bg-gradient-to-b from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <PhoneOff size={22} />
                <span className="text-sm font-black">거절 / 조건불가</span>
                <span className="text-[11px] text-gray-400">수신거부 / 자격미달</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 일시정지 사유 모달 */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Coffee size={18} className="text-amber-400" />
              오토콜 잠시 휴식 (이석)
            </h3>
            <p className="text-xs text-gray-400">
              휴식 사유를 선택하시면 관리자 실시간 전광판에 '휴식'으로 표기됩니다.
            </p>
            <div className="space-y-2">
              {['화장실 / 음용수', '서류 검토 / 메모 정리', '식사 시간', '긴급 업무'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPauseReason(r)}
                  className={`w-full p-2.5 rounded-xl text-xs font-semibold text-left border transition-all ${
                    pauseReason === r
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-gray-900 text-gray-400 border-gray-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                className="flex-1 py-2 text-xs font-bold bg-gray-700 text-gray-300 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl"
              >
                휴식 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoDialAgentHUD;
